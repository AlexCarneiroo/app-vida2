import { AnimatePresence, motion } from 'framer-motion'
import {
  CloudOff,
  KeyRound,
  LogIn,
  LogOut,
  Mail,
  Moon,
  Phone,
  Sun,
  Timer,
  UserRound,
} from 'lucide-react'
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { Button } from '../components/ui/Button'
import { PageTransition } from '../components/ui/PageTransition'
import { useAuth } from '../hooks/useAuth'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useTheme, ACCENT_OPTIONS } from '../hooks/useTheme'
import { useTreino } from '../hooks/useTreino'
import { useConfirm, useToast } from '../components/ui/Feedback'
import { firebaseReady } from '../lib/firebase'
import { APP_VERSION_LABEL, appVersionHint } from '../lib/appVersion'

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
  const { theme, setTheme, accent, setAccent } = useTheme()
  const { state, setRestTimerEnabled, setRestSeconds } = useTreino()
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const online = useOnlineStatus()
  const restTimerEnabled = state.settings.restTimerEnabled
  const restSeconds = state.settings.restSeconds

  const [tab, setTab] = useState<AuthTab>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')

  useEffect(() => {
    if (profile) {
      setEditName(profile.displayName)
      setEditPhone(profile.phone)
    }
  }, [profile])

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

  function toggleRestTimer() {
    const next = !restTimerEnabled
    setRestTimerEnabled(next)
    toast(next ? 'Contador ligado' : 'Contador desligado', 'ok')
  }

  function changeRestSeconds(sec: typeof restSeconds) {
    setRestSeconds(sec)
    toast(`Descanso ${sec}s`, 'ok')
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
          <p className="page-sub">Perfil, aparência e treino neste dispositivo.</p>
        </div>
        <span className="config-version-chip" title={appVersionHint()}>
          {APP_VERSION_LABEL}
        </span>
      </header>

      {!firebaseReady && (
        <div className="surface config-banner config-banner--warn">
          Firebase não está configurado. Verifica o ficheiro .env.
        </div>
      )}

      <section className="surface config-panel">
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
                : 'Entra para sincronizar entre dispositivos'}
            </span>
          </div>
        </div>

        {!online && (
          <div className="config-sync-row">
            <CloudOff size={14} />
            <span>Offline — os dados ficam neste dispositivo</span>
          </div>
        )}
      </section>

      <section className="surface config-panel" aria-label="Preferências">
        <h2 className="config-panel__title">Preferências</h2>

        <div className="config-theme__options" role="group" aria-label="Tema">
          <button
            type="button"
            className={theme === 'light' ? 'is-active' : ''}
            onClick={() => setTheme('light')}
            aria-pressed={theme === 'light'}
          >
            <Sun size={18} />
            Claro
          </button>
          <button
            type="button"
            className={theme === 'dark' ? 'is-active' : ''}
            onClick={() => setTheme('dark')}
            aria-pressed={theme === 'dark'}
          >
            <Moon size={18} />
            Escuro
          </button>
        </div>

        <div className="config-accent__swatches" role="group" aria-label="Cor principal">
          {ACCENT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`config-accent__swatch${accent === opt.id ? ' is-active' : ''}`}
              style={{ '--swatch': opt.swatch } as CSSProperties}
              onClick={() => setAccent(opt.id)}
              aria-pressed={accent === opt.id}
              aria-label={opt.label}
              title={opt.label}
            >
              <span className="config-accent__dot" aria-hidden />
              <em>{opt.label}</em>
            </button>
          ))}
        </div>

        <div className="config-panel__divider" />

        <div className="config-pref__row">
          <div className="config-pref__info">
            <span className="config-pref__icon" aria-hidden>
              <Timer size={18} />
            </span>
            <div>
              <strong>Contador de descanso</strong>
              <p>Guarda sozinho ao ligar ou desligar.</p>
            </div>
          </div>
          <button
            type="button"
            className={`config-switch${restTimerEnabled ? ' is-on' : ''}`}
            role="switch"
            aria-checked={restTimerEnabled}
            aria-label="Contador de descanso"
            onClick={toggleRestTimer}
          >
            <span className="config-switch__knob" />
          </button>
        </div>

        {restTimerEnabled && (
          <div className="config-pref__presets" role="group" aria-label="Duração padrão">
            <span>Duração</span>
            <div className="rest-prefs__btns">
              {([60, 90, 120] as const).map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className={`rest-prefs__btn${restSeconds === sec ? ' is-active' : ''}`}
                  onClick={() => changeRestSeconds(sec)}
                  aria-pressed={restSeconds === sec}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {isRegistered ? (
        <form className="surface config-panel config-form" onSubmit={handleSaveProfile}>
          <h2 className="config-panel__title">Perfil</h2>
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
          <div className="config-form__actions">
            <Button
              type="submit"
              variant="primary"
              loading={busy}
              loadingLabel="A guardar…"
            >
              Guardar perfil
            </Button>
            <button
              type="button"
              className="btn btn--ghost config-logout"
              onClick={handleLogout}
              disabled={busy}
            >
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </form>
      ) : (
        <section className="config-auth">
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
              className="surface config-panel config-form"
              onSubmit={tab === 'login' ? handleLogin : handleRegister}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2 className="config-panel__title">
                {tab === 'login' ? 'Entrar' : 'Criar conta'}
              </h2>
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

              <Button
                type="submit"
                variant="primary"
                icon={
                  tab === 'login' ? <LogIn size={16} /> : <UserRound size={16} />
                }
                loading={busy}
                loadingLabel={tab === 'login' ? 'A entrar…' : 'A criar…'}
                disabled={!firebaseReady}
              >
                {tab === 'login' ? 'Entrar' : 'Criar conta'}
              </Button>

              {tab === 'register' && (
                <p className="config-hint">
                  {isAnonymous
                    ? 'Ao cadastrar, os dados deste dispositivo ficam ligados à tua conta.'
                    : 'Os dados deste dispositivo ficam ligados à tua conta.'}
                </p>
              )}
            </motion.form>
          </AnimatePresence>
        </section>
      )}

      <p className="config-build">{appVersionHint()}</p>
    </PageTransition>
  )
}
