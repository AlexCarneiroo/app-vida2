import { motion } from 'framer-motion'
import {
  Activity,
  Camera,
  ClipboardList,
  Droplets,
  FileDown,
  FlaskConical,
  Moon,
  Pill,
  Plus,
  Scale,
  Stethoscope,
  Trash2,
} from 'lucide-react'
import {
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import { ActivityHeatmap } from '../components/ui/ActivityHeatmap'
import { Button } from '../components/ui/Button'
import { useBusyAction } from '../hooks/useBusyAction'
import { useConfirm, useToast } from '../components/ui/Feedback'
import {
  PageTransition,
  staggerContainer,
  staggerItem,
} from '../components/ui/PageTransition'
import { PageHeader, PageScreens } from '../components/ui/PageShell'
import { ProgressRing } from '../components/ui/ProgressRing'
import {
  compressImageFile,
  EXAM_IDEAS,
  VITAL_QUICK,
} from '../data/saudeDefaults'
import { useSaude } from '../hooks/useSaude'
import { dateKey } from '../lib/date'
import { exportHealthPdf } from '../lib/saudeExport'
import type { BodySex, SleepQuality } from '../types/saude'

type View =
  | 'home'
  | 'body'
  | 'sleep'
  | 'exam'
  | 'checkin'
  | 'meds'
  | 'photos'
  | 'consult'
  | 'goals'

const QUALITY: SleepQuality[] = [1, 2, 3, 4, 5]

export function SaudePage() {
  const saude = useSaude()
  const {
    state,
    lastWeight,
    imc,
    imcLabel,
    tonightSleep,
    signals,
    score,
    insights,
    weeklyInsights,
    sleepDebt,
    dueExams,
    weightTrend,
    projectionWeeks,
    sleepWeek,
    moodLog,
    exams,
    todayCheckIn,
    setProfile,
    addWeight,
    removeMetric,
    upsertSleep,
    addExam,
    removeExam,
    upsertCheckIn,
    addMedication,
    toggleMedTaken,
    removeMedication,
    addPhoto,
    removePhoto,
    saveConsult,
    addProNote,
    seriesFor,
  } = saude
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const { busy: exporting, run: runExport } = useBusyAction()
  const { busy: photoBusy, run: runPhoto } = useBusyAction()

  const [view, setView] = useState<View>('home')
  const onPanel = view !== 'home'

  const [heightDraft, setHeightDraft] = useState('')
  const [weightDraft, setWeightDraft] = useState('')
  const [waistDraft, setWaistDraft] = useState('')
  const [armDraft, setArmDraft] = useState('')
  const [fatDraft, setFatDraft] = useState('')
  const [goalWeightDraft, setGoalWeightDraft] = useState('')
  const [sex, setSex] = useState<BodySex | ''>(state.sex ?? '')

  const [sleepHours, setSleepHours] = useState('7.5')
  const [sleepQuality, setSleepQuality] = useState<SleepQuality>(3)
  const [bedTime, setBedTime] = useState('22:30')
  const [wakeTime, setWakeTime] = useState('06:30')

  const [examName, setExamName] = useState('')
  const [examValue, setExamValue] = useState('')
  const [examUnit, setExamUnit] = useState('')
  const [examRef, setExamRef] = useState('')
  const [examDate, setExamDate] = useState(() => dateKey())
  const [examDue, setExamDue] = useState('')
  const [examFile, setExamFile] = useState<File | null>(null)
  const [chartName, setChartName] = useState('Glicemia')

  const [energy, setEnergy] = useState<SleepQuality>(3)
  const [mood, setMood] = useState<SleepQuality>(3)
  const [symptoms, setSymptoms] = useState('')

  const [medName, setMedName] = useState('')
  const [medDose, setMedDose] = useState('')
  const [medTime, setMedTime] = useState('08:00')

  const [q1, setQ1] = useState('')
  const [q2, setQ2] = useState('')
  const [q3, setQ3] = useState('')
  const [proAuthor, setProAuthor] = useState('Dra. Pulse')
  const [proBody, setProBody] = useState('')

  const [waterDaysTarget, setWaterDaysTarget] = useState(
    String(state.weeklyGoals.waterDaysTarget),
  )
  const [sleepDaysTarget, setSleepDaysTarget] = useState(
    String(state.weeklyGoals.sleepDaysTarget),
  )

  const chart = useMemo(() => seriesFor(chartName), [seriesFor, chartName])
  const spark = useMemo(() => sparkPoints(weightTrend), [weightTrend])
  const chartSpark = useMemo(
    () => sparkPoints(chart.map((c) => c.value)),
    [chart],
  )

  const titles: Record<View, { title: string; sub: string }> = {
    home: {
      title: 'Saúde',
      sub: 'Vitalidade, consultório, exames, sono e corpo.',
    },
    body: { title: 'Corpo & IMC', sub: 'Peso, medidas e meta.' },
    sleep: { title: 'Sono', sub: 'Horas, horários e lembrete.' },
    exam: { title: 'Exames', sub: 'Resultados, gráficos e anexos.' },
    checkin: { title: 'Check-in', sub: 'Energia, humor e sintomas.' },
    meds: { title: 'Medicação', sub: 'Suplementos e horários.' },
    photos: { title: 'Fotos', sub: 'Progresso privado no dispositivo.' },
    consult: {
      title: 'Consulta rápida',
      sub: '3 perguntas → plano do dia.',
    },
    goals: { title: 'Metas semanais', sub: 'Água, sono e lembretes.' },
  }

  function openBody() {
    setHeightDraft(state.heightCm > 0 ? String(state.heightCm) : '')
    setWeightDraft(lastWeight ? String(lastWeight.weightKg) : '')
    setWaistDraft(lastWeight?.waistCm ? String(lastWeight.waistCm) : '')
    setArmDraft(lastWeight?.armCm ? String(lastWeight.armCm) : '')
    setFatDraft(lastWeight?.bodyFatPct ? String(lastWeight.bodyFatPct) : '')
    setGoalWeightDraft(
      state.weightGoalKg > 0 ? String(state.weightGoalKg) : '',
    )
    setSex(state.sex ?? '')
    setView('body')
  }

  function openSleep() {
    setSleepHours(tonightSleep ? String(tonightSleep.hours) : '7.5')
    setSleepQuality(tonightSleep?.quality ?? 3)
    setBedTime(tonightSleep?.bedTime || state.sleepReminderTime || '22:30')
    setWakeTime(tonightSleep?.wakeTime || '06:30')
    setView('sleep')
  }

  function handleExport() {
    void runExport(async () => {
      await exportHealthPdf({
        state,
        waterMl: signals.waterMl,
        waterGoalMl: signals.waterGoalMl,
        score,
        sleepDebt,
      })
      toast('PDF de saúde exportado', 'ok')
    })
  }

  return (
    <PageTransition>
      <PageHeader
        kicker="Vitalidade"
        title={titles[view].title}
        sub={titles[view].sub}
        onBack={onPanel ? () => setView('home') : undefined}
        action={
          <div className="nutri-header-actions">
            <button
              type="button"
              className="btn btn--ghost"
              disabled={exporting}
              onClick={handleExport}
            >
              <FileDown size={16} />
              PDF
            </button>
            <Button
              variant="primary"
              icon={<Activity size={16} />}
              onClick={() => setView('checkin')}
            >
              Check-in
            </Button>
          </div>
        }
      />

      <PageScreens
        mode={view}
        home={
          <div className="saude-home">
            <section className="surface saude-hero">
              <div className="saude-hero__ring">
                <ProgressRing value={score} color="var(--saude)" size={96} />
              </div>
              <div>
                <p className="page-kicker">Score vitalidade</p>
                <strong className="saude-hero__score">{score}</strong>
                <p className="saude-hero__hint">
                  Água {signals.waterWeekDays}/{signals.weeklyGoals.waterDaysTarget}d
                  · Sono {signals.sleepWeekDays}/
                  {signals.weeklyGoals.sleepDaysTarget}d
                  {sleepDebt > 0 ? ` · débito ~${sleepDebt}h` : ''}
                </p>
              </div>
            </section>

            <section className="surface saude-combo">
              <Droplets size={16} />
              <div>
                <strong>Nutrição do dia</strong>
                <span>
                  {signals.kcal} kcal · {Math.round(signals.protein)} g prot ·{' '}
                  {signals.waterMl}/{signals.waterGoalMl} ml água
                </span>
              </div>
              <Link to="/nutricao" className="saude-signal__link">
                Abrir
              </Link>
            </section>

            <section className="surface saude-doc">
              <div className="saude-doc__head">
                <span className="saude-doc__avatar" aria-hidden>
                  <Stethoscope size={18} />
                </span>
                <div>
                  <p className="page-kicker">Consultório</p>
                  <strong>Dra. Pulse</strong>
                  <span>Insights do dia e da semana</span>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setView('consult')}
                >
                  Consulta
                </button>
              </div>
              <ul className="saude-insights">
                {[...weeklyInsights, ...insights].slice(0, 6).map((ins) => (
                  <li key={ins.id} className={`saude-insight is-${ins.tone}`}>
                    <strong>{ins.title}</strong>
                    <p>{ins.body}</p>
                  </li>
                ))}
              </ul>
              {state.lastConsult && (
                <div className="saude-consult-plan">
                  <strong>Plano da última consulta</strong>
                  <ul>
                    {state.lastConsult.plan.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {dueExams.length > 0 && (
              <section className="surface saude-due">
                <FlaskConical size={16} />
                <div>
                  <strong>Exames a refazer</strong>
                  <span>
                    {dueExams
                      .slice(0, 2)
                      .map((e) => `${e.name} (${e.nextDueDateKey})`)
                      .join(' · ')}
                  </span>
                </div>
              </section>
            )}

            <motion.div
              className="saude-signals"
              variants={staggerContainer}
              initial="hidden"
              animate="show"
            >
              <SignalCard
                icon={<Droplets size={16} />}
                title="Água"
                text={`${signals.waterMl}/${signals.waterGoalMl} ml`}
                ok={signals.waterOk}
                action={<Link to="/nutricao">Abrir</Link>}
              />
              <SignalCard
                icon={<Moon size={16} />}
                title="Sono"
                text={
                  signals.sleepHours !== null
                    ? `${signals.sleepHours}h`
                    : 'Sem registo'
                }
                ok={signals.sleepOk}
                action={
                  <button type="button" onClick={openSleep}>
                    Registar
                  </button>
                }
              />
              <SignalCard
                icon={<Activity size={16} />}
                title="Treino"
                text={signals.trainedToday ? 'Feito' : 'Por fazer'}
                ok={signals.trainedToday}
                action={<Link to="/treino">Abrir</Link>}
              />
              <SignalCard
                icon={<Scale size={16} />}
                title="IMC"
                text={imc !== null ? `${imc}` : 'Definir'}
                ok={signals.imcOk}
                action={
                  <button type="button" onClick={openBody}>
                    Corpo
                  </button>
                }
              />
            </motion.div>

            <div className="section-label">
              <h2>Atalhos</h2>
            </div>
            <div className="saude-actions">
              {(
                [
                  ['body', Scale, 'Corpo'],
                  ['sleep', Moon, 'Sono'],
                  ['exam', FlaskConical, 'Exames'],
                  ['meds', Pill, 'Meds'],
                  ['photos', Camera, 'Fotos'],
                  ['consult', ClipboardList, 'Consulta'],
                  ['goals', Stethoscope, 'Metas'],
                  ['checkin', Activity, 'Check-in'],
                ] as const
              ).map(([id, Icon, label]) => (
                <button
                  key={id}
                  type="button"
                  className="surface saude-action"
                  onClick={() =>
                    id === 'body'
                      ? openBody()
                      : id === 'sleep'
                        ? openSleep()
                        : setView(id)
                  }
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </div>

            {state.medications.length > 0 && (
              <section className="surface saude-meds-today">
                <strong>Medicação de hoje</strong>
                <ul>
                  {state.medications
                    .filter((m) => m.enabled)
                    .map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          className={`saude-med-check${m.lastTakenDateKey === saude.today ? ' is-done' : ''}`}
                          onClick={() => toggleMedTaken(m.id)}
                        >
                          {m.time} · {m.name}
                          {m.dose ? ` · ${m.dose}` : ''}
                        </button>
                      </li>
                    ))}
                </ul>
              </section>
            )}

            {spark && (
              <section className="surface saude-trend">
                <div className="saude-trend__head">
                  <strong>Peso</strong>
                  <span>
                    {lastWeight ? `${lastWeight.weightKg} kg` : '—'}
                    {projectionWeeks
                      ? ` · ~${projectionWeeks} sem. até meta`
                      : ''}
                  </span>
                </div>
                <Sparkline points={spark} />
              </section>
            )}

            <section className="surface saude-sleep-week">
              <strong>Sono · 7 dias</strong>
              <div className="saude-sleep-bars">
                {sleepWeek.map((d) => (
                  <div key={d.dateKey} className="saude-sleep-bar">
                    <i
                      style={{
                        height: `${Math.min(100, (d.hours / 9) * 100)}%`,
                      }}
                    />
                    <em>{d.dateKey.slice(8)}</em>
                  </div>
                ))}
              </div>
            </section>

            <ActivityHeatmap
              log={moodLog}
              range="month"
              title="Humor do mês"
            />

            {exams.length > 0 && (
              <>
                <div className="section-label">
                  <h2>Exames</h2>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setView('exam')}
                  >
                    <Plus size={14} />
                    Novo
                  </button>
                </div>
                <div className="saude-exams">
                  {exams.slice(0, 5).map((ex) => (
                    <article key={ex.id} className="surface saude-exam">
                      <div>
                        <strong>{ex.name}</strong>
                        <span>
                          {ex.dateKey.slice(8)}/{ex.dateKey.slice(5, 7)}
                          {ex.nextDueDateKey
                            ? ` · refazer ${ex.nextDueDateKey.slice(8)}/${ex.nextDueDateKey.slice(5, 7)}`
                            : ''}
                          {ex.attachmentName ? ' · anexo' : ''}
                        </span>
                      </div>
                      <em>
                        {ex.value}
                        {ex.unit ? ` ${ex.unit}` : ''}
                      </em>
                      <Button
                        variant="ghost"
                        className="finance-row__del"
                        icon={<Trash2 size={14} />}
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Remover exame?',
                            message: ex.name,
                            confirmLabel: 'Remover',
                          })
                          if (!ok) return
                          removeExam(ex.id)
                          toast('Exame removido', 'info')
                        }}
                      />
                    </article>
                  ))}
                </div>
              </>
            )}

            {todayCheckIn && (
              <p className="saude-checkin-note">
                Check-in: energia {todayCheckIn.energy}/5 · humor{' '}
                {todayCheckIn.mood}/5
              </p>
            )}
          </div>
        }
        panel={
          view === 'body' ? (
            <form
              className="surface saude-panel"
              onSubmit={(e) => {
                e.preventDefault()
                setProfile({
                  heightCm: Number(heightDraft) || 0,
                  sex: sex || null,
                  weightGoalKg: Number(goalWeightDraft) || 0,
                })
                const w = Number(weightDraft)
                if (w > 0) {
                  addWeight({
                    weightKg: w,
                    waistCm: Number(waistDraft) || undefined,
                    armCm: Number(armDraft) || undefined,
                    bodyFatPct: Number(fatDraft) || undefined,
                  })
                }
                setView('home')
                toast('Corpo atualizado', 'ok')
              }}
            >
              <label className="plan-field">
                <span>Altura (cm)</span>
                <input
                  type="number"
                  value={heightDraft}
                  onChange={(e) => setHeightDraft(e.target.value)}
                  autoFocus
                />
              </label>
              <label className="plan-field">
                <span>Peso (kg)</span>
                <input
                  type="number"
                  step={0.1}
                  value={weightDraft}
                  onChange={(e) => setWeightDraft(e.target.value)}
                />
              </label>
              <div className="saude-exam-grid">
                <label className="plan-field">
                  <span>Cintura (cm)</span>
                  <input
                    type="number"
                    value={waistDraft}
                    onChange={(e) => setWaistDraft(e.target.value)}
                  />
                </label>
                <label className="plan-field">
                  <span>Braço (cm)</span>
                  <input
                    type="number"
                    value={armDraft}
                    onChange={(e) => setArmDraft(e.target.value)}
                  />
                </label>
                <label className="plan-field">
                  <span>% gordura</span>
                  <input
                    type="number"
                    step={0.1}
                    value={fatDraft}
                    onChange={(e) => setFatDraft(e.target.value)}
                  />
                </label>
                <label className="plan-field">
                  <span>Meta peso (kg)</span>
                  <input
                    type="number"
                    step={0.1}
                    value={goalWeightDraft}
                    onChange={(e) => setGoalWeightDraft(e.target.value)}
                  />
                </label>
              </div>
              {imc !== null && (
                <p className="saude-imc-preview">
                  IMC <strong>{imc}</strong> · {imcLabel}
                  {projectionWeeks
                    ? ` · ~${projectionWeeks} semanas até à meta`
                    : ''}
                </p>
              )}
              <PanelActions onCancel={() => setView('home')} />
              <ul className="saude-weight-list">
                {state.metrics.slice(0, 8).map((m) => (
                  <li key={m.id}>
                    <span>
                      {m.dateKey.slice(8)}/{m.dateKey.slice(5, 7)} · {m.weightKg}{' '}
                      kg
                      {m.waistCm ? ` · cintura ${m.waistCm}` : ''}
                    </span>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => {
                        removeMetric(m.id)
                        toast('Removido', 'info')
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </form>
          ) : view === 'sleep' ? (
            <form
              className="surface saude-panel"
              onSubmit={(e) => {
                e.preventDefault()
                const h = Number(sleepHours)
                if (!h) {
                  toast('Indica as horas', 'warn')
                  return
                }
                upsertSleep({
                  hours: h,
                  quality: sleepQuality,
                  bedTime,
                  wakeTime,
                })
                setView('home')
                toast('Sono registado', 'ok')
              }}
            >
              <label className="plan-field">
                <span>Horas</span>
                <input
                  type="number"
                  step={0.5}
                  value={sleepHours}
                  onChange={(e) => setSleepHours(e.target.value)}
                  autoFocus
                />
              </label>
              <div className="saude-exam-grid">
                <label className="plan-field">
                  <span>Deitar</span>
                  <input
                    type="time"
                    value={bedTime}
                    onChange={(e) => setBedTime(e.target.value)}
                  />
                </label>
                <label className="plan-field">
                  <span>Acordar</span>
                  <input
                    type="time"
                    value={wakeTime}
                    onChange={(e) => setWakeTime(e.target.value)}
                  />
                </label>
              </div>
              <QualityField
                label="Qualidade"
                value={sleepQuality}
                onChange={setSleepQuality}
              />
              <p className="saude-imc-preview">
                Débito da semana: ~{sleepDebt}h
              </p>
              <PanelActions onCancel={() => setView('home')} label="Guardar sono" />
            </form>
          ) : view === 'exam' ? (
            <form
              className="surface saude-panel"
              onSubmit={async (e) => {
                e.preventDefault()
                if (!examName.trim() || !examValue.trim()) {
                  toast('Nome e valor obrigatórios', 'warn')
                  return
                }
                let attachmentName: string | undefined
                let attachmentDataUrl: string | undefined
                if (examFile) {
                  try {
                    if (examFile.type.startsWith('image/')) {
                      const c = await compressImageFile(examFile)
                      attachmentName = c.name
                      attachmentDataUrl = c.dataUrl
                    } else if (examFile.size < 350_000) {
                      const buf = new Uint8Array(await examFile.arrayBuffer())
                      let binary = ''
                      for (let i = 0; i < buf.length; i++) {
                        binary += String.fromCharCode(buf[i])
                      }
                      attachmentName = examFile.name
                      attachmentDataUrl = `data:${examFile.type};base64,${btoa(binary)}`
                    } else {
                      toast(
                        'Anexo grande demais — usa imagem ou PDF leve',
                        'warn',
                      )
                    }
                  } catch {
                    toast('Falha no anexo', 'warn')
                  }
                }
                addExam({
                  name: examName,
                  value: examValue,
                  unit: examUnit,
                  refRange: examRef,
                  dateKey: examDate,
                  nextDueDateKey: examDue || null,
                  attachmentName,
                  attachmentDataUrl,
                })
                setExamName('')
                setExamValue('')
                setExamFile(null)
                setView('home')
                toast('Exame guardado', 'ok')
              }}
            >
              <div className="habit-ideas">
                {[...EXAM_IDEAS, ...VITAL_QUICK].map((idea) => (
                  <button
                    key={idea.name}
                    type="button"
                    className="habit-idea"
                    onClick={() => {
                      setExamName(idea.name)
                      setExamUnit(idea.unit)
                      setExamRef(idea.refRange)
                      setChartName(idea.name)
                    }}
                  >
                    {idea.name}
                  </button>
                ))}
              </div>
              <label className="plan-field">
                <span>Nome</span>
                <input
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  required
                  autoFocus
                />
              </label>
              <div className="saude-exam-grid">
                <label className="plan-field">
                  <span>Valor</span>
                  <input
                    value={examValue}
                    onChange={(e) => setExamValue(e.target.value)}
                    required
                  />
                </label>
                <label className="plan-field">
                  <span>Unidade</span>
                  <input
                    value={examUnit}
                    onChange={(e) => setExamUnit(e.target.value)}
                  />
                </label>
              </div>
              <label className="plan-field">
                <span>Referência</span>
                <input
                  value={examRef}
                  onChange={(e) => setExamRef(e.target.value)}
                />
              </label>
              <div className="saude-exam-grid">
                <label className="plan-field">
                  <span>Data</span>
                  <input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                  />
                </label>
                <label className="plan-field">
                  <span>Refazer em</span>
                  <input
                    type="date"
                    value={examDue}
                    onChange={(e) => setExamDue(e.target.value)}
                  />
                </label>
              </div>
              <label className="plan-field">
                <span>Anexo (foto/PDF leve)</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setExamFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {chartSpark && (
                <div className="saude-trend">
                  <div className="saude-trend__head">
                    <strong>Série · {chartName}</strong>
                    <span>{chart.length} pontos</span>
                  </div>
                  <Sparkline points={chartSpark} />
                </div>
              )}
              <PanelActions onCancel={() => setView('home')} label="Guardar exame" />
            </form>
          ) : view === 'meds' ? (
            <form
              className="surface saude-panel"
              onSubmit={(e) => {
                e.preventDefault()
                if (!medName.trim()) return
                addMedication({
                  name: medName,
                  dose: medDose,
                  time: medTime,
                })
                setMedName('')
                setMedDose('')
                toast('Medicamento adicionado', 'ok')
              }}
            >
              <label className="plan-field">
                <span>Nome</span>
                <input
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  placeholder="Vitamina D / Losartana"
                  autoFocus
                />
              </label>
              <div className="saude-exam-grid">
                <label className="plan-field">
                  <span>Dose</span>
                  <input
                    value={medDose}
                    onChange={(e) => setMedDose(e.target.value)}
                    placeholder="1 cp"
                  />
                </label>
                <label className="plan-field">
                  <span>Horário</span>
                  <input
                    type="time"
                    value={medTime}
                    onChange={(e) => setMedTime(e.target.value)}
                  />
                </label>
              </div>
              <PanelActions onCancel={() => setView('home')} label="Adicionar" />
              <ul className="saude-weight-list">
                {state.medications.map((m) => (
                  <li key={m.id}>
                    <span>
                      {m.time} · {m.name}
                      {m.dose ? ` · ${m.dose}` : ''}
                    </span>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => removeMedication(m.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </form>
          ) : view === 'photos' ? (
            <div className="surface saude-panel">
              <p className="saude-imc-preview">
                Até 8 fotos, comprimidas e só neste dispositivo / sync da conta.
              </p>
              <label className="plan-field">
                <span>Nova foto</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={photoBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    void runPhoto(async () => {
                      await addPhoto(file)
                      toast('Foto guardada', 'ok')
                    })
                  }}
                />
              </label>
              <div className="saude-photos">
                {state.photos.map((p) => (
                  <figure key={p.id} className="saude-photo">
                    <img src={p.dataUrl} alt="" />
                    <figcaption>
                      {p.dateKey}
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => removePhoto(p.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </figcaption>
                  </figure>
                ))}
              </div>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setView('home')}
              >
                Voltar
              </button>
            </div>
          ) : view === 'consult' ? (
            <form
              className="surface saude-panel"
              onSubmit={(e) => {
                e.preventDefault()
                if (!q1.trim() || !q2.trim() || !q3.trim()) {
                  toast('Responde às 3 perguntas', 'warn')
                  return
                }
                saveConsult(q1, q2, q3)
                setView('home')
                toast('Plano do dia pronto', 'ok')
              }}
            >
              <label className="plan-field">
                <span>1. Como está a tua energia hoje?</span>
                <input
                  value={q1}
                  onChange={(e) => setQ1(e.target.value)}
                  placeholder="Cansado / bem / ansioso…"
                  autoFocus
                />
              </label>
              <label className="plan-field">
                <span>2. Algum sintoma ou dor?</span>
                <input
                  value={q2}
                  onChange={(e) => setQ2(e.target.value)}
                  placeholder="Nada / dor lombar…"
                />
              </label>
              <label className="plan-field">
                <span>3. Qual o foco do dia?</span>
                <input
                  value={q3}
                  onChange={(e) => setQ3(e.target.value)}
                  placeholder="Peso / força / mente…"
                />
              </label>
              <PanelActions
                onCancel={() => setView('home')}
                label="Gerar plano"
              />
              <hr className="saude-hr" />
              <label className="plan-field">
                <span>Nota de profissional</span>
                <input
                  value={proAuthor}
                  onChange={(e) => setProAuthor(e.target.value)}
                  placeholder="Nome"
                />
              </label>
              <label className="plan-field">
                <span>Texto</span>
                <input
                  value={proBody}
                  onChange={(e) => setProBody(e.target.value)}
                  placeholder="Insight ou recomendação"
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  addProNote(proAuthor, proBody)
                  setProBody('')
                  toast('Nota guardada', 'ok')
                }}
              >
                Guardar nota
              </Button>
              <ul className="saude-weight-list">
                {state.proNotes.slice(0, 6).map((n) => (
                  <li key={n.id}>
                    <span>
                      <strong>{n.author}</strong> — {n.body}
                    </span>
                  </li>
                ))}
              </ul>
            </form>
          ) : view === 'goals' ? (
            <form
              className="surface saude-panel"
              onSubmit={(e) => {
                e.preventDefault()
                setProfile({
                  weeklyGoals: {
                    waterDaysTarget: Number(waterDaysTarget) || 5,
                    sleepDaysTarget: Number(sleepDaysTarget) || 5,
                  },
                  sleepReminderEnabled: state.sleepReminderEnabled,
                  sleepReminderTime: state.sleepReminderTime,
                })
                setView('home')
                toast('Metas atualizadas', 'ok')
              }}
            >
              <label className="plan-field">
                <span>Dias com água ok / semana</span>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={waterDaysTarget}
                  onChange={(e) => setWaterDaysTarget(e.target.value)}
                />
              </label>
              <label className="plan-field">
                <span>Noites 7–9h / semana</span>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={sleepDaysTarget}
                  onChange={(e) => setSleepDaysTarget(e.target.value)}
                />
              </label>
              <label className="plan-field">
                <span>Lembrete de sono</span>
                <div className="saude-reminder-row">
                  <button
                    type="button"
                    className={`config-switch${state.sleepReminderEnabled ? ' is-on' : ''}`}
                    role="switch"
                    aria-checked={state.sleepReminderEnabled}
                    onClick={() =>
                      setProfile({
                        sleepReminderEnabled: !state.sleepReminderEnabled,
                      })
                    }
                  >
                    <span className="config-switch__knob" />
                  </button>
                  <input
                    type="time"
                    value={state.sleepReminderTime}
                    onChange={(e) =>
                      setProfile({ sleepReminderTime: e.target.value })
                    }
                  />
                </div>
              </label>
              <PanelActions onCancel={() => setView('home')} />
            </form>
          ) : (
            <form
              className="surface saude-panel"
              onSubmit={(e: FormEvent) => {
                e.preventDefault()
                upsertCheckIn({ energy, mood, symptoms })
                setView('home')
                toast('Check-in feito', 'ok')
              }}
            >
              <QualityField label="Energia" value={energy} onChange={setEnergy} />
              <QualityField label="Humor" value={mood} onChange={setMood} />
              <label className="plan-field">
                <span>Sintomas</span>
                <input
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                />
              </label>
              <PanelActions onCancel={() => setView('home')} label="Guardar" />
            </form>
          )
        }
      />
    </PageTransition>
  )
}

function SignalCard({
  icon,
  title,
  text,
  ok,
  action,
}: {
  icon: ReactNode
  title: string
  text: string
  ok?: boolean
  action: ReactNode
}) {
  return (
    <motion.article
      className={`surface saude-signal${ok ? ' is-ok' : ''}`}
      variants={staggerItem}
    >
      {icon}
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
      <span className="saude-signal__link">{action}</span>
    </motion.article>
  )
}

function QualityField({
  label,
  value,
  onChange,
}: {
  label: string
  value: SleepQuality
  onChange: (q: SleepQuality) => void
}) {
  return (
    <fieldset className="saude-sex">
      <legend>{label}</legend>
      <div className="habit-chips">
        {QUALITY.map((q) => (
          <button
            key={q}
            type="button"
            className={`habit-chip${value === q ? ' is-active' : ''}`}
            onClick={() => onChange(q)}
          >
            {q}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function PanelActions({
  onCancel,
  label = 'Guardar',
}: {
  onCancel: () => void
  label?: string
}) {
  return (
    <div className="habit-form__actions">
      <button type="button" className="btn btn--ghost" onClick={onCancel}>
        Cancelar
      </button>
      <Button type="submit" variant="primary">
        {label}
      </Button>
    </div>
  )
}

function sparkPoints(values: number[]): string | null {
  if (values.length < 2) return null
  const w = 120
  const h = 36
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / span) * (h - 4) - 2
      return `${x},${y}`
    })
    .join(' ')
}

function Sparkline({ points }: { points: string }) {
  return (
    <svg
      className="saude-spark"
      viewBox="0 0 120 36"
      width="100%"
      height={36}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}
