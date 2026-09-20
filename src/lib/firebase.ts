import { initializeApp, getApps } from 'firebase/app'
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

/** Lê env do Vite; sem .env (ou chaves vazias) o app fica só local. */
function env(name: keyof ImportMetaEnv): string {
  const raw = import.meta.env[name]
  return typeof raw === 'string' ? raw.trim() : ''
}

const firebaseConfig = {
  apiKey: env('VITE_FIREBASE_API_KEY'),
  authDomain: env('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: env('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: env('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: env('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: env('VITE_FIREBASE_APP_ID'),
  measurementId: env('VITE_FIREBASE_MEASUREMENT_ID'),
}

/** false = modo local (sem nuvem). true quando o .env tiver as chaves mínimas. */
export const firebaseReady = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
)

export const firebaseApp = firebaseReady
  ? getApps().length
    ? getApps()[0]
    : initializeApp(firebaseConfig)
  : null

export const auth = firebaseApp ? getAuth(firebaseApp) : null
export const db = firebaseApp ? getFirestore(firebaseApp) : null

let analyticsPromise: Promise<Analytics | null> | null = null

export function initAnalytics() {
  if (!firebaseApp || analyticsPromise) return analyticsPromise
  analyticsPromise = isSupported()
    .then((ok) => (ok ? getAnalytics(firebaseApp!) : null))
    .catch(() => null)
  return analyticsPromise
}
