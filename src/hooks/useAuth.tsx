import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { setCloudUser } from '../lib/cloudSync'
import { auth, db, firebaseReady } from '../lib/firebase'
import { emptyProfile, type UserProfile } from '../types/user'

type AuthMode = 'loading' | 'ready'

type AuthContextValue = {
  ready: boolean
  user: User | null
  profile: UserProfile | null
  isAnonymous: boolean
  isRegistered: boolean
  uid: string | null
  login: (email: string, password: string) => Promise<void>
  register: (
    name: string,
    email: string,
    password: string,
  ) => Promise<void>
  logout: () => Promise<void>
  saveProfile: (patch: Partial<UserProfile>) => Promise<void>
  authErrorMessage: (err: unknown) => string
}

const AuthContext = createContext<AuthContextValue | null>(null)

function profileRef(uid: string) {
  if (!db) return null
  return doc(db, 'users', uid, 'app', 'profile')
}

async function loadProfile(user: User): Promise<UserProfile> {
  const ref = profileRef(user.uid)
  const fallback = emptyProfile(user.email ?? '')
  fallback.displayName = user.displayName ?? ''
  if (!ref) return fallback

  try {
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      const initial: UserProfile = {
        ...fallback,
        displayName: user.displayName ?? '',
        email: user.email ?? '',
        createdAt: new Date().toISOString(),
        updatedAt: Date.now(),
      }
      if (!user.isAnonymous) {
        await setDoc(
          ref,
          { ...initial, savedAt: serverTimestamp() },
          { merge: true },
        )
      }
      return initial
    }
    const data = snap.data() as Partial<UserProfile>
    return {
      displayName: data.displayName ?? user.displayName ?? '',
      email: data.email ?? user.email ?? '',
      phone: data.phone ?? '',
      createdAt: data.createdAt ?? new Date().toISOString(),
      updatedAt: data.updatedAt ?? Date.now(),
    }
  } catch (err) {
    console.error('[auth] load profile', err)
    return fallback
  }
}

function mapAuthError(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code: string }).code)
      : ''
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Este e-mail já está cadastrado.'
    case 'auth/invalid-email':
      return 'E-mail inválido.'
    case 'auth/weak-password':
      return 'A senha precisa ter pelo menos 6 caracteres.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou senha incorretos.'
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Espera um pouco e tenta de novo.'
    case 'auth/network-request-failed':
      return 'Sem ligação à rede.'
    case 'auth/credential-already-in-use':
      return 'Esta conta já está ligada a outro utilizador.'
    default:
      return 'Não foi possível concluir. Tenta outra vez.'
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AuthMode>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    if (!firebaseReady || !auth) {
      setMode('ready')
      return
    }

    const unsub = onAuthStateChanged(auth, async (next) => {
      if (!next) {
        setCloudUser(null)
        try {
          await signInAnonymously(auth!)
        } catch (err) {
          console.error('[auth] anónima', err)
          setUser(null)
          setProfile(null)
          setMode('ready')
        }
        return
      }

      setUser(next)
      setCloudUser(next)
      const p = await loadProfile(next)
      setProfile(p)
      setMode('ready')
    })

    return () => unsub()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase não configurado')
    await signInWithEmailAndPassword(auth, email.trim(), password)
  }, [])

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      if (!auth) throw new Error('Firebase não configurado')
      const trimmedEmail = email.trim()
      const trimmedName = name.trim()

      let nextUser: User

      if (auth.currentUser?.isAnonymous) {
        const credential = EmailAuthProvider.credential(
          trimmedEmail,
          password,
        )
        const linked = await linkWithCredential(auth.currentUser, credential)
        nextUser = linked.user
      } else {
        const created = await createUserWithEmailAndPassword(
          auth,
          trimmedEmail,
          password,
        )
        nextUser = created.user
      }

      if (trimmedName) {
        await updateProfile(nextUser, { displayName: trimmedName })
      }

      const ref = profileRef(nextUser.uid)
      const profileData: UserProfile = {
        displayName: trimmedName,
        email: trimmedEmail,
        phone: '',
        createdAt: new Date().toISOString(),
        updatedAt: Date.now(),
      }
      if (ref) {
        await setDoc(
          ref,
          { ...profileData, savedAt: serverTimestamp() },
          { merge: true },
        )
      }
      setProfile(profileData)
      setUser(auth.currentUser)
    },
    [],
  )

  const logout = useCallback(async () => {
    if (!auth) return
    await signOut(auth)
    // onAuthStateChanged volta a criar sessão anónima
  }, [])

  const saveProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      if (!auth?.currentUser || auth.currentUser.isAnonymous) {
        throw new Error('Entra na conta para guardar o perfil.')
      }
      const uid = auth.currentUser.uid
      const ref = profileRef(uid)
      const next: UserProfile = {
        ...(profile ?? emptyProfile(auth.currentUser.email ?? '')),
        ...patch,
        email: auth.currentUser.email ?? patch.email ?? '',
        updatedAt: Date.now(),
      }
      if (patch.displayName != null) {
        await updateProfile(auth.currentUser, {
          displayName: patch.displayName.trim(),
        })
        next.displayName = patch.displayName.trim()
      }
      if (ref) {
        await setDoc(ref, { ...next, savedAt: serverTimestamp() }, { merge: true })
      }
      setProfile(next)
    },
    [profile],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      ready: mode === 'ready',
      user,
      profile,
      isAnonymous: Boolean(user?.isAnonymous),
      isRegistered: Boolean(user && !user.isAnonymous),
      uid: user?.uid ?? null,
      login,
      register,
      logout,
      saveProfile,
      authErrorMessage: mapAuthError,
    }),
    [mode, user, profile, login, register, logout, saveProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa de AuthProvider')
  return ctx
}
