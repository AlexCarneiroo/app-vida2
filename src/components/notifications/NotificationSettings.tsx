import {
  Bell,
  BellRing,
  CalendarClock,
  CloudUpload,
  Droplets,
  Dumbbell,
  Flame,
  ListChecks,
  Moon,
  Send,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import {
  currentPermission,
  needsIosInstall,
  requestNotifPermission,
  showNotice,
  updateNotifSettings,
  useNotifSettings,
  usePushActive,
  type NotifPermission,
  type NotifSettings,
} from '../../lib/notifications'
import { pushConfigured, sendServerTest } from '../../lib/pushClient'
import { Button } from '../ui/Button'
import { useToast } from '../ui/Feedback'

const WATER_STEPS = [60, 90, 120, 180]
const WATER_LABELS: Record<number, string> = {
  60: '1h',
  90: '1h30',
  120: '2h',
  180: '3h',
}

function Row({
  icon: Icon,
  title,
  desc,
  on,
  onToggle,
  children,
}: {
  icon: LucideIcon
  title: string
  desc: string
  on: boolean
  onToggle: () => void
  children?: ReactNode
}) {
  return (
    <div className="notif-item">
      <div className="config-pref__row">
        <div className="config-pref__info">
          <span className="config-pref__icon" aria-hidden>
            <Icon size={18} />
          </span>
          <div>
            <strong>{title}</strong>
            <p>{desc}</p>
          </div>
        </div>
        <button
          type="button"
          className={`config-switch${on ? ' is-on' : ''}`}
          role="switch"
          aria-checked={on}
          aria-label={title}
          onClick={onToggle}
        >
          <span className="config-switch__knob" />
        </button>
      </div>
      {on && children ? <div className="notif-item__opts">{children}</div> : null}
    </div>
  )
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="notif-time">
      <span>{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
      />
    </label>
  )
}

export function NotificationSettings() {
  const settings = useNotifSettings()
  const { toast } = useToast()
  const [permission, setPermission] = useState<NotifPermission>(() =>
    currentPermission(),
  )
  const [sending, setSending] = useState(false)
  const [sendingServer, setSendingServer] = useState(false)
  const pushActive = usePushActive()
  const serverCapable = pushConfigured()
  const iosNeedsInstall = needsIosInstall()

  // O utilizador pode mudar a permissão nas definições do sistema.
  useEffect(() => {
    const refresh = () => setPermission(currentPermission())
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  const patch = (fn: (s: NotifSettings) => NotifSettings) =>
    updateNotifSettings(fn)

  async function toggleMaster() {
    if (settings.enabled) {
      patch((s) => ({ ...s, enabled: false }))
      toast('Notificações desligadas', 'info')
      return
    }
    if (permission === 'unsupported') {
      toast('Este navegador não suporta notificações', 'warn')
      return
    }
    const result =
      permission === 'granted' ? 'granted' : await requestNotifPermission()
    setPermission(result)
    if (result !== 'granted') {
      toast(
        result === 'denied'
          ? 'Permissão bloqueada — libere nas definições do navegador'
          : 'Permissão não concedida',
        'warn',
      )
      return
    }
    patch((s) => ({ ...s, enabled: true }))
    toast('Notificações ativadas', 'ok')
  }

  async function sendTest() {
    setSending(true)
    const ok = await showNotice({
      title: 'VIDA · teste 🔔',
      body: 'Está tudo certo! Os lembretes vão chegar assim.',
      url: '/config',
      tag: 'teste',
    })
    setSending(false)
    toast(ok ? 'Teste enviado' : 'Não foi possível enviar', ok ? 'ok' : 'warn')
  }

  async function sendServerTestPush() {
    setSendingServer(true)
    try {
      const { sent } = await sendServerTest()
      toast(
        sent > 0
          ? 'Enviado pelo servidor — pode fechar o app e esperar'
          : 'O servidor não conseguiu entregar',
        sent > 0 ? 'ok' : 'warn',
      )
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      toast(
        code.includes('not-found') || code.includes('internal')
          ? 'Servidor de push ainda não publicado'
          : code.includes('failed-precondition')
            ? 'Este aparelho ainda não está registado no servidor'
            : code.includes('resource-exhausted')
              ? 'Aguarde alguns segundos'
              : 'Não foi possível contactar o servidor',
        'warn',
      )
    } finally {
      setSendingServer(false)
    }
  }

  let status: string
  if (permission === 'unsupported') {
    status = 'Este navegador não suporta notificações.'
  } else if (permission === 'denied') {
    status =
      'Bloqueadas no navegador. Libere em Definições do site → Notificações.'
  } else if (iosNeedsInstall) {
    status =
      'No iPhone/iPad, instale o app: Compartilhar → Adicionar à Tela de Início.'
  } else if (settings.enabled && pushActive) {
    status = 'Ativas pelo servidor — chegam mesmo com o app fechado.'
  } else if (settings.enabled && serverCapable) {
    status = 'A ligar ao servidor… (enquanto isso, só com o app aberto)'
  } else if (settings.enabled) {
    status = 'Ativas só com o app aberto (servidor não configurado).'
  } else {
    status = 'Receba lembretes de treino, água, hábitos, contas e mais.'
  }

  return (
    <section className="surface config-panel" aria-label="Notificações">
      <h2 className="config-panel__title">Notificações</h2>

      <div className="config-pref__row">
        <div className="config-pref__info">
          <span className="config-pref__icon" aria-hidden>
            {settings.enabled ? <BellRing size={18} /> : <Bell size={18} />}
          </span>
          <div>
            <strong>Lembretes</strong>
            <p>{status}</p>
          </div>
        </div>
        <button
          type="button"
          className={`config-switch${settings.enabled ? ' is-on' : ''}`}
          role="switch"
          aria-checked={settings.enabled}
          aria-label="Lembretes"
          onClick={() => void toggleMaster()}
        >
          <span className="config-switch__knob" />
        </button>
      </div>

      {settings.enabled && (
        <>
          <div className="config-panel__divider" />

          <Row
            icon={Dumbbell}
            title="Treino do dia"
            desc="Só avisa nos dias com treino que ainda não foi feito."
            on={settings.treino.on}
            onToggle={() =>
              patch((s) => ({ ...s, treino: { ...s.treino, on: !s.treino.on } }))
            }
          >
            <TimeField
              label="Horário"
              value={settings.treino.time}
              onChange={(time) =>
                patch((s) => ({ ...s, treino: { ...s.treino, time } }))
              }
            />
          </Row>

          <Row
            icon={Droplets}
            title="Beber água"
            desc="Mostra quanto falta para a meta. Para quando a meta é batida."
            on={settings.agua.on}
            onToggle={() =>
              patch((s) => ({ ...s, agua: { ...s.agua, on: !s.agua.on } }))
            }
          >
            <TimeField
              label="Das"
              value={settings.agua.from}
              onChange={(from) =>
                patch((s) => ({ ...s, agua: { ...s.agua, from } }))
              }
            />
            <TimeField
              label="Até"
              value={settings.agua.to}
              onChange={(to) =>
                patch((s) => ({ ...s, agua: { ...s.agua, to } }))
              }
            />
            <div className="rest-prefs__btns" role="group" aria-label="Intervalo">
              {WATER_STEPS.map((min) => (
                <button
                  key={min}
                  type="button"
                  className={`rest-prefs__btn${settings.agua.everyMin === min ? ' is-active' : ''}`}
                  aria-pressed={settings.agua.everyMin === min}
                  onClick={() =>
                    patch((s) => ({ ...s, agua: { ...s.agua, everyMin: min } }))
                  }
                >
                  {WATER_LABELS[min]}
                </button>
              ))}
            </div>
          </Row>

          <Row
            icon={Flame}
            title="Hábitos"
            desc="Usa a hora do lembrete de cada hábito e protege sequências."
            on={settings.habitos.on}
            onToggle={() =>
              patch((s) => ({
                ...s,
                habitos: { ...s.habitos, on: !s.habitos.on },
              }))
            }
          >
            <label className="notif-check">
              <input
                type="checkbox"
                checked={settings.habitos.streakGuard}
                onChange={(e) =>
                  patch((s) => ({
                    ...s,
                    habitos: { ...s.habitos, streakGuard: e.target.checked },
                  }))
                }
              />
              <span>Avisar às 20:00 se uma sequência estiver em risco</span>
            </label>
          </Row>

          <Row
            icon={ListChecks}
            title="Blocos da rotina"
            desc="Avisa na hora de cada bloco que ainda não foi concluído."
            on={settings.rotina.on}
            onToggle={() =>
              patch((s) => ({
                ...s,
                rotina: { ...s.rotina, on: !s.rotina.on },
              }))
            }
          />

          <Row
            icon={Wallet}
            title="Contas a vencer"
            desc="Contas atrasadas, que vencem hoje ou amanhã."
            on={settings.contas.on}
            onToggle={() =>
              patch((s) => ({
                ...s,
                contas: { ...s.contas, on: !s.contas.on },
              }))
            }
          >
            <TimeField
              label="Horário"
              value={settings.contas.time}
              onChange={(time) =>
                patch((s) => ({ ...s, contas: { ...s.contas, time } }))
              }
            />
          </Row>

          <Row
            icon={Moon}
            title="Hora de dormir"
            desc="Um lembrete para desacelerar."
            on={settings.sono.on}
            onToggle={() =>
              patch((s) => ({ ...s, sono: { ...s.sono, on: !s.sono.on } }))
            }
          >
            <TimeField
              label="Horário"
              value={settings.sono.time}
              onChange={(time) =>
                patch((s) => ({ ...s, sono: { ...s.sono, time } }))
              }
            />
          </Row>

          <Row
            icon={CalendarClock}
            title="Resumo do dia"
            desc="Treino, água e hábitos numa só notificação."
            on={settings.resumo.on}
            onToggle={() =>
              patch((s) => ({
                ...s,
                resumo: { ...s.resumo, on: !s.resumo.on },
              }))
            }
          >
            <TimeField
              label="Horário"
              value={settings.resumo.time}
              onChange={(time) =>
                patch((s) => ({ ...s, resumo: { ...s.resumo, time } }))
              }
            />
          </Row>

          <div className="config-panel__divider" />

          <div className="notif-tests">
            <Button
              variant="ghost"
              icon={<Send size={16} />}
              loading={sending}
              loadingLabel="A enviar…"
              onClick={() => void sendTest()}
            >
              Testar neste aparelho
            </Button>
            {pushActive && (
              <Button
                variant="ghost"
                icon={<CloudUpload size={16} />}
                loading={sendingServer}
                loadingLabel="A enviar…"
                onClick={() => void sendServerTestPush()}
              >
                Testar pelo servidor
              </Button>
            )}
          </div>

          <p className="config-theme__hint">
            {pushActive
              ? 'Os lembretes saem do servidor na hora certa e chegam com o app fechado ou o telemóvel bloqueado. As opções acima são sincronizadas automaticamente.'
              : 'Sem o servidor, os lembretes só são verificados enquanto o app está aberto ou em segundo plano.'}
          </p>
        </>
      )}
    </section>
  )
}
