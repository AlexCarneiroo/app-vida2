import {
  Activity,
  FileDown,
} from 'lucide-react'
import {
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { SaudeBodyTab } from '../components/saude/SaudeBodyTab'
import { SaudeCareTab } from '../components/saude/SaudeCareTab'
import { SaudeExamsTab } from '../components/saude/SaudeExamsTab'
import { SaudeOverviewTab } from '../components/saude/SaudeOverviewTab'
import { SleepModule } from '../components/saude/SleepModule'
import { emptySleepHabits } from '../data/saudeDefaults'
import {
  PanelActions,
  QualityField,
  Sparkline,
  sparkPoints,
} from '../components/saude/SaudeShared'
import {
  SaudeTabNav,
  type SaudeTabId,
} from '../components/saude/SaudeTabNav'
import { Button } from '../components/ui/Button'
import { useConfirm, useToast } from '../components/ui/Feedback'
import { PageHeader, PageScreens } from '../components/ui/PageShell'
import { PageTransition } from '../components/ui/PageTransition'
import {
  compressImageFile,
  EXAM_IDEAS,
  sleepHoursBetween,
  VITAL_QUICK,
} from '../data/saudeDefaults'
import { useBusyAction } from '../hooks/useBusyAction'
import { useSaude } from '../hooks/useSaude'
import { dateKey } from '../lib/date'
import { exportHealthPdf } from '../lib/saudeExport'
import type { BodySex, SleepHabitFlags, SleepQuality } from '../types/saude'

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
    napsToday,
    setProfile,
    addWeight,
    removeMetric,
    upsertSleep,
    removeSleep,
    addNap,
    removeNap,
    toggleRoutineItem,
    beginSleepChallenge,
    clearSleepChallenge,
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
  const [tab, setTab] = useState<SaudeTabId>('visao')
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
  const [sleepReadiness, setSleepReadiness] = useState<SleepQuality>(3)
  const [sleepNote, setSleepNote] = useState('')
  const [sleepLatency, setSleepLatency] = useState('15')
  const [sleepAwakenings, setSleepAwakenings] = useState('0')
  const [sleepHabits, setSleepHabits] = useState<SleepHabitFlags>(() =>
    emptySleepHabits(),
  )
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
      sub: 'Painel pessoal de vitalidade, sono, corpo e exames.',
    },
    body: { title: 'Corpo & IMC', sub: 'Peso, medidas e meta.' },
    sleep: { title: 'Registar sono', sub: 'Horários, qualidade e disposição.' },
    exam: { title: 'Novo exame', sub: 'Resultado, referência e anexo.' },
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

  function applySleepClock(bed: string, wake: string) {
    setBedTime(bed)
    setWakeTime(wake)
    const hours = sleepHoursBetween(bed, wake)
    if (hours != null) setSleepHours(String(hours))
  }

  function openSleep() {
    const bed = tonightSleep?.bedTime || state.sleepReminderTime || '22:30'
    const wake = tonightSleep?.wakeTime || '06:30'
    const computed = sleepHoursBetween(bed, wake)
    setSleepHours(
      computed != null
        ? String(computed)
        : tonightSleep
          ? String(tonightSleep.hours)
          : '7.5',
    )
    setSleepQuality(tonightSleep?.quality ?? 3)
    setSleepReadiness(tonightSleep?.readiness ?? 3)
    setSleepNote(tonightSleep?.note ?? '')
    setSleepLatency(
      tonightSleep?.latencyMin != null ? String(tonightSleep.latencyMin) : '15',
    )
    setSleepAwakenings(
      tonightSleep?.awakenings != null ? String(tonightSleep.awakenings) : '0',
    )
    setSleepHabits({
      ...emptySleepHabits(),
      ...(tonightSleep?.habits ?? {}),
    })
    setBedTime(bed)
    setWakeTime(wake)
    setTab('sono')
    setView('sleep')
  }

  function goHomeTab(next: SaudeTabId) {
    setTab(next)
    setView('home')
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
              onClick={() => {
                setTab('cuidado')
                setView('checkin')
              }}
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
            <SaudeTabNav active={tab} onChange={setTab} />

            {tab === 'visao' && (
              <SaudeOverviewTab
                score={score}
                signals={signals}
                sleepDebt={sleepDebt}
                insights={insights}
                weeklyInsights={weeklyInsights}
                dueExams={dueExams}
                lastConsult={state.lastConsult}
                lastWeightKg={lastWeight?.weightKg ?? null}
                projectionWeeks={projectionWeeks}
                weightSpark={spark}
                moodLog={moodLog}
                todayCheckIn={todayCheckIn}
                onOpenSleep={openSleep}
                onOpenBody={() => {
                  setTab('corpo')
                  openBody()
                }}
                onOpenExams={() => goHomeTab('exames')}
                onOpenConsult={() => {
                  setTab('cuidado')
                  setView('consult')
                }}
                onOpenCheckin={() => {
                  setTab('cuidado')
                  setView('checkin')
                }}
              />
            )}

            {tab === 'sono' && (
              <SleepModule
                today={saude.today}
                sleep={state.sleep}
                tonightSleep={tonightSleep}
                sleepWeek={sleepWeek}
                sleepDebt={sleepDebt}
                sleepGoalHours={state.sleepGoalHours || 8}
                sleepGoalBedTime={state.sleepGoalBedTime || '22:30'}
                sleepGoalWakeTime={state.sleepGoalWakeTime || '06:30'}
                reminderEnabled={state.sleepReminderEnabled}
                reminderTime={state.sleepReminderTime}
                windDownEnabled={state.windDownEnabled !== false}
                windDownMinutes={state.windDownMinutes || 45}
                weeklySleepTarget={state.weeklyGoals.sleepDaysTarget}
                sleepWeekDays={signals.sleepWeekDays}
                sleepRoutine={state.sleepRoutine ?? []}
                sleepRoutineDone={state.sleepRoutineDone ?? {}}
                sleepChallenge={state.sleepChallenge}
                naps={state.naps ?? []}
                napsToday={napsToday}
                onRegister={openSleep}
                onOpenGoals={() => setView('goals')}
                onRemoveSleep={removeSleep}
                onAddNap={addNap}
                onRemoveNap={removeNap}
                onToggleRoutine={toggleRoutineItem}
                onBeginChallenge={beginSleepChallenge}
                onClearChallenge={clearSleepChallenge}
                onSetGoals={setProfile}
              />
            )}

            {tab === 'corpo' && (
              <SaudeBodyTab
                heightCm={state.heightCm}
                imc={imc}
                imcLabel={imcLabel}
                lastWeight={lastWeight}
                weightGoalKg={state.weightGoalKg}
                projectionWeeks={projectionWeeks}
                weightSpark={spark}
                metrics={state.metrics}
                photos={state.photos}
                onOpenBody={openBody}
                onOpenPhotos={() => setView('photos')}
                onRemoveMetric={(id) => {
                  removeMetric(id)
                  toast('Removido', 'info')
                }}
              />
            )}

            {tab === 'exames' && (
              <SaudeExamsTab
                exams={exams}
                dueExams={dueExams}
                chartName={
                  exams.some((e) => e.name === chartName)
                    ? chartName
                    : exams[0]?.name || chartName
                }
                chartSpark={chartSpark}
                chartCount={chart.length}
                onChartName={setChartName}
                onAdd={() => setView('exam')}
                onRemove={(id) => {
                  void confirm({
                    title: 'Remover exame?',
                    message: 'O registo será apagado.',
                  }).then((ok) => {
                    if (!ok) return
                    removeExam(id)
                    toast('Exame removido', 'info')
                  })
                }}
              />
            )}

            {tab === 'cuidado' && (
              <SaudeCareTab
                today={saude.today}
                medications={state.medications}
                todayCheckIn={todayCheckIn}
                lastConsult={state.lastConsult}
                proNotes={state.proNotes}
                waterDaysTarget={state.weeklyGoals.waterDaysTarget}
                sleepDaysTarget={state.weeklyGoals.sleepDaysTarget}
                waterWeekDays={signals.waterWeekDays}
                sleepWeekDays={signals.sleepWeekDays}
                reminderEnabled={state.sleepReminderEnabled}
                reminderTime={state.sleepReminderTime}
                onToggleMed={toggleMedTaken}
                onOpenMeds={() => setView('meds')}
                onOpenCheckin={() => setView('checkin')}
                onOpenConsult={() => setView('consult')}
                onOpenGoals={() => setView('goals')}
              />
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
                setTab('corpo')
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
              <fieldset className="saude-sex">
                <legend>Sexo biológico (IMC)</legend>
                <div className="habit-chips">
                  {(
                    [
                      ['m', 'Masculino'],
                      ['f', 'Feminino'],
                      ['outro', 'Outro'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`habit-chip${sex === id ? ' is-active' : ''}`}
                      onClick={() => setSex(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              {imc !== null && (
                <p className="saude-imc-preview">
                  IMC <strong>{imc}</strong> · {imcLabel}
                  {projectionWeeks
                    ? ` · ~${projectionWeeks} semanas até à meta`
                    : ''}
                </p>
              )}
              <PanelActions onCancel={() => setView('home')} />
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
                  readiness: sleepReadiness,
                  bedTime,
                  wakeTime,
                  latencyMin: Number(sleepLatency) || 0,
                  awakenings: Number(sleepAwakenings) || 0,
                  habits: sleepHabits,
                  note: sleepNote,
                })
                setTab('sono')
                setView('home')
                toast('Sono registado', 'ok')
              }}
            >
              <div className="saude-exam-grid">
                <label className="plan-field">
                  <span>Deitar</span>
                  <input
                    type="time"
                    value={bedTime}
                    onChange={(e) => applySleepClock(e.target.value, wakeTime)}
                    autoFocus
                  />
                </label>
                <label className="plan-field">
                  <span>Acordar</span>
                  <input
                    type="time"
                    value={wakeTime}
                    onChange={(e) => applySleepClock(bedTime, e.target.value)}
                  />
                </label>
              </div>
              <label className="plan-field">
                <span>Horas dormidas</span>
                <input
                  type="number"
                  min={0.5}
                  max={16}
                  step={0.1}
                  value={sleepHours}
                  onChange={(e) => setSleepHours(e.target.value)}
                />
              </label>
              <p className="saude-imc-preview">
                Calculado entre {bedTime} e {wakeTime}
                {sleepHours ? ` · ${sleepHours} h` : ''}.
              </p>
              <div className="saude-exam-grid">
                <label className="plan-field">
                  <span>Minutos até adormecer</span>
                  <input
                    type="number"
                    min={0}
                    max={180}
                    value={sleepLatency}
                    onChange={(e) => setSleepLatency(e.target.value)}
                  />
                </label>
                <label className="plan-field">
                  <span>Despertares</span>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={sleepAwakenings}
                    onChange={(e) => setSleepAwakenings(e.target.value)}
                  />
                </label>
              </div>
              <QualityField
                label="Qualidade do descanso"
                value={sleepQuality}
                onChange={setSleepQuality}
                hint="1 = péssimo · 5 = excelente"
              />
              <QualityField
                label="Disposição ao acordar"
                value={sleepReadiness}
                onChange={setSleepReadiness}
                hint="Como te sentiste ao levantar"
              />
              <fieldset className="saude-sex">
                <legend>Diário (o que pode ter influenciado)</legend>
                <div className="habit-chips">
                  {(
                    [
                      ['phoneBeforeBed', 'Telemóvel'],
                      ['caffeineLate', 'Cafeína tarde'],
                      ['exerciseLate', 'Treino tarde'],
                      ['alcohol', 'Álcool'],
                      ['heavyMeal', 'Refeição pesada'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`habit-chip${sleepHabits[key] ? ' is-active' : ''}`}
                      onClick={() =>
                        setSleepHabits((prev) => ({
                          ...prev,
                          [key]: !prev[key],
                        }))
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="plan-field">
                <span>Nota</span>
                <input
                  value={sleepNote}
                  onChange={(e) => setSleepNote(e.target.value)}
                  placeholder="Opcional — sonhos, stress, etc."
                />
              </label>
              <p className="saude-imc-preview">
                Débito da semana: ~{sleepDebt}h
              </p>
              <PanelActions
                onCancel={() => setView('home')}
                label="Guardar sono"
              />
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
                setTab('exames')
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
                  <span>Refazer / consulta</span>
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
              <PanelActions
                onCancel={() => setView('home')}
                label="Guardar exame"
              />
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
                      Remover
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
                        Remover
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
                setTab('cuidado')
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
                setTab('cuidado')
                setView('home')
                toast('Check-in feito', 'ok')
              }}
            >
              <QualityField
                label="Energia"
                value={energy}
                onChange={setEnergy}
              />
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
