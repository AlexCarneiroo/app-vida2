import { FlaskConical, Plus, Trash2 } from 'lucide-react'
import type { LabExam } from '../../types/saude'
import { Button } from '../ui/Button'
import { Sparkline } from './SaudeShared'

export function SaudeExamsTab({
  exams,
  dueExams,
  chartName,
  chartSpark,
  chartCount,
  onChartName,
  onAdd,
  onRemove,
}: {
  exams: LabExam[]
  dueExams: LabExam[]
  chartName: string
  chartSpark: string | null
  chartCount: number
  onChartName: (name: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
}) {
  const names = Array.from(new Set(exams.map((e) => e.name))).slice(0, 8)

  return (
    <div className="saude-tab-panel">
      <section className="surface saude-module-hero is-exam">
        <div>
          <p className="page-kicker">Exames & acompanhamento</p>
          <strong>
            {exams.length > 0
              ? `${exams.length} registos`
              : 'Arquivo clínico pessoal'}
          </strong>
          <span>
            Resultados, referências, anexos e datas para refazer/consulta
          </span>
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={onAdd}>
          Novo
        </Button>
      </section>

      {dueExams.length > 0 && (
        <section className="surface saude-due-list">
          <div className="saude-trend__head">
            <strong>A refazer / agendar</strong>
            <span>{dueExams.length}</span>
          </div>
          <ul className="saude-history-list">
            {dueExams.map((e) => (
              <li key={e.id}>
                <strong>{e.name}</strong>
                <span>
                  {e.nextDueDateKey
                    ? `até ${e.nextDueDateKey.slice(8)}/${e.nextDueDateKey.slice(5, 7)}`
                    : 'sem data'}
                  {e.value ? ` · último ${e.value}${e.unit ? ` ${e.unit}` : ''}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {names.length > 0 && (
        <section className="surface saude-trend">
          <div className="saude-trend__head">
            <strong>Tendência</strong>
            <select
              className="saude-inline-select"
              value={chartName}
              onChange={(e) => onChartName(e.target.value)}
              aria-label="Exame do gráfico"
            >
              {names.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          {chartSpark ? (
            <>
              <Sparkline points={chartSpark} />
              <span className="saude-challenge__hint">
                {chartCount} pontos · {chartName}
              </span>
            </>
          ) : (
            <p className="saude-empty">
              Precisas de pelo menos 2 valores numéricos do mesmo exame.
            </p>
          )}
        </section>
      )}

      <section className="surface saude-history">
        <div className="saude-trend__head">
          <strong>Histórico</strong>
          <button type="button" className="btn btn--ghost" onClick={onAdd}>
            <FlaskConical size={14} />
            Adicionar
          </button>
        </div>
        {exams.length === 0 ? (
          <p className="saude-empty">
            Guarda glicemia, hemograma, lípidos e outros. Podes anexar foto ou
            PDF leve e marcar a próxima data.
          </p>
        ) : (
          <div className="saude-exams">
            {exams.map((ex) => (
              <article key={ex.id} className="surface saude-exam">
                <div>
                  <strong>{ex.name}</strong>
                  <span>
                    {ex.dateKey.slice(8)}/{ex.dateKey.slice(5, 7)}
                    {ex.nextDueDateKey
                      ? ` · refazer ${ex.nextDueDateKey.slice(8)}/${ex.nextDueDateKey.slice(5, 7)}`
                      : ''}
                  </span>
                  <em>
                    {ex.value}
                    {ex.unit ? ` ${ex.unit}` : ''}
                    {ex.refRange ? ` · ref ${ex.refRange}` : ''}
                  </em>
                  {ex.attachmentName ? (
                    <small className="saude-exam-attach">
                      Anexo: {ex.attachmentName}
                    </small>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => onRemove(ex.id)}
                  aria-label="Remover exame"
                >
                  <Trash2 size={14} />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
