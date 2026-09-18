import { AnimatePresence, motion } from 'framer-motion'
import {
  Cloud,
  KeyRound,
  LogIn,
  LogOut,
  Mail,
  Phone,
  Settings,
  UserRound,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { PageTransition } from '../components/ui/PageTransition'
import { useAuth } from '../hooks/useAuth'
import { useConfirm, useToast } from '../components/ui/Feedback'
import { getSyncStatus, subscribeSyncStatus, type SyncStatus } from '../lib/cloudSync'
import { firebaseReady } from '../lib/firebase'

type AuthTab = 'login' | 'register'

export function ConfigPage() {
  const {
    ready,
    profile,
    isAnonymous,
    isRegistered,
    user,
    login,
    register,
    logout,
    saveProfile,
    authErrorMessage,
  } = useAuth()
  const { toast } = useToast()
  const { confirm } = useConfirm()

  const [tab, setTab] = useState<AuthTab>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => getSyncStatus())

  useEffect(() => {
    if (profile) {
      setEditName(profile.displayName)
      setEditPhone(profile.phone)
    }
  }, [profile])

  useEffect(() => {
    const unsub = subscribeSyncStatus(setSyncStatus)
    return () => {
      unsub()
    }
  }, [])

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(email, password)
      setPassword('')
      toast('Sessão iniciada', 'ok')
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    setBusy(true)
    try {
      await register(name, email, password)
      setPassword('')
      toast('Conta criada e dados ligados', 'ok')
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await saveProfile({
        displayName: editName,
        phone: editPhone.trim(),
      })
      toast('Perfil atualizado', 'ok')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Falha ao guardar', 'warn')
    } finally {
      setBusy(false)
    }
  }

  async function handleLogout() {
    const ok = await confirm({
      title: 'Sair da conta?',
      message: 'Os dados na nuvem ficam guardados. Podes entrar de novo noutro dispositivo.',
      confirmLabel: 'Sair',
      danger: true,
    })
    if (!ok) return
    await logout()
    toast('Sessão terminada', 'info')
  }

  if (!ready) {
    return (
      <PageTransition>
        <div className="surface config-loading">A preparar conta…</div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <header className="page-header">
        <div>
          <p className="page-kicker">Conta</p>
          <h1 className="page-title">Configuração</h1>
          <p className="page-sub">
            Os teus dados, login e sincronização com a nuvem.
          </p>
        </div>
        <span className="config-hero-icon" aria-hidden>
          <Settings size={22} />
        </span>
      </header>

      {!firebaseReady && (
        <div className="surface config-banner config-banner--warn">
          Firebase não está configurado. Verifica o ficheiro .env.
        </div>
      )}

      <section className="surface config-card">
        <div className="config-card__head">
          <span className="config-avatar">
            <UserRound size={22} />
          </span>
          <div>
            <strong>
              {isRegistered
                ? profile?.displayName || 'Utilizador'
                : 'Convidado'}
            </strong>
            <span>
              {isRegistered
                ? profile?.email || user?.email
                : 'Entra ou cria conta para sincronizar entre dispositivos'}
            </span>
          </div>
        </div>

        <div className="config-sync-row">
          <Cloud size={14} />
          <span>
            {syncStatus === 'saved'
              ? 'Dados na nuvem'
              : syncStatus === 'syncing'
                ? 'A sincronizar…'
                : syncStatus === 'offline'
                  ? 'Offline — grava local'
                  : syncStatus === 'error'
                    ? 'Erro de sincronização'
                    : 'Sincronização pronta'}
          </span>
        </div>
      </section>

      {isRegistered ? (
        <>
          <div className="section-label">
            <h2>Os teus dados</h2>
            <span>Perfil</span>
          </div>

          <form className="surface config-form" onSubmit={handleSaveProfile}>
            <label className="plan-field">
              <span>Nome</span>
              <div className="config-input">
                <UserRound size={16} />
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="O teu nome"
                  required
                />
              </div>
            </label>
            <label className="plan-field">
              <span>E-mail</span>
              <div className="config-input is-locked">
                <Mail size={16} />
                <input
                  type="email"
                  value={profile?.email || user?.email || ''}
                  readOnly
                  tabIndex={-1}
                />
              </div>
            </label>
            <label className="plan-field">
              <span>Telefone (opcional)</span>
              <div className="config-input">
                <Phone size={16} />
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Ex.: 11 99999-0000"
                />
              </div>
            </label>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={busy}
            >
              Guardar perfil
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={handleLogout}
              disabled={busy}
            >
              <LogOut size={16} />
              Sair da conta
            </button>
          </form>
        </>
      ) : (
        <>
          <div className="section-label">
            <h2>{tab === 'login' ? 'Entrar' : 'Criar conta'}</h2>
            <span>{isAnonymous ? 'Convidado' : 'Conta'}</span>
          </div>

          <div className="config-tabs">
            <button
              type="button"
              className={tab === 'login' ? 'is-active' : ''}
              onClick={() => {
                setTab('login')
                setError(null)
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              className={tab === 'register' ? 'is-active' : ''}
              onClick={() => {
                setTab('register')
                setError(null)
              }}
            >
              Cadastrar
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.form
              key={tab}
              className="surface config-form"
              onSubmit={tab === 'login' ? handleLogin : handleRegister}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {tab === 'register' && (
                <label className="plan-field">
                  <span>Nome</span>
                  <div className="config-input">
                    <UserRound size={16} />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Como queres ser chamado"
                      required
                      autoComplete="name"
                    />
                  </div>
                </label>
              )}
              <label className="plan-field">
                <span>E-mail</span>
                <div className="config-input">
                  <Mail size={16} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teu@email.com"
                    required
                    autoComplete="email"
                  />
                </div>
              </label>
              <label className="plan-field">
                <span>Senha</span>
                <div className="config-input">
                  <KeyRound size={16} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                    autoComplete={
                      tab === 'login' ? 'current-password' : 'new-password'
                    }
                  />
                </div>
              </label>

              {error && <p className="config-error">{error}</p>}

              <button
                type="submit"
                className="btn btn--primary"
                disabled={busy || !firebaseReady}
              >
                {tab === 'login' ? (
                  <>
                    <LogIn size={16} />
                    Entrar
                  </>
                ) : (
                  <>
                    <UserRound size={16} />
                    Criar conta
                  </>
                )}
              </button>

              {tab === 'register' && (
                <p className="config-hint">
                  Ao cadastrar, os dados deste dispositivo ficam ligados à tua
                  conta na nuvem.
                </p>
              )}
            </motion.form>
          </AnimatePresence>
        </>
      )}
    </PageTransition>
  )
}
