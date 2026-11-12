import { Camera, Plus, Scale, Trash2 } from 'lucide-react'
import type { BodyMetric, ProgressPhoto } from '../../types/saude'
import { Button } from '../ui/Button'
import { Sparkline, StatTile } from './SaudeShared'

export function SaudeBodyTab({
  heightCm,
  imc,
  imcLabel,
  lastWeight,
  weightGoalKg,
  projectionWeeks,
  weightSpark,
  metrics,
  photos,
  onOpenBody,
  onOpenPhotos,
  onRemoveMetric,
}: {
  heightCm: number
  imc: number | null
  imcLabel: string | null
  lastWeight: BodyMetric | null
  weightGoalKg: number
  projectionWeeks: number | null
  weightSpark: string | null
  metrics: BodyMetric[]
  photos: ProgressPhoto[]
  onOpenBody: () => void
  onOpenPhotos: () => void
  onRemoveMetric: (id: string) => void
}) {
  return (
    <div className="saude-tab-panel">
      <section className="surface saude-module-hero is-body">
        <div>
          <p className="page-kicker">Corpo & composição</p>
          <strong>
            {lastWeight ? `${lastWeight.weightKg} kg` : 'Sem peso registado'}
          </strong>
          <span>
            {imc != null
              ? `IMC ${imc} · ${imcLabel}`
              : 'Define altura e peso para calcular o IMC'}
            {weightGoalKg > 0 ? ` · meta ${weightGoalKg} kg` : ''}
          </span>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={onOpenBody}
        >
          Atualizar
        </Button>
      </section>

      <div className="saude-stat-grid">
        <StatTile
          label="IMC"
          value={imc != null ? String(imc) : '—'}
          hint={imcLabel ?? 'Completa o perfil'}
        />
        <StatTile
          label="Altura"
          value={heightCm > 0 ? `${heightCm} cm` : '—'}
        />
        <StatTile
          label="Cintura"
          value={lastWeight?.waistCm ? `${lastWeight.waistCm} cm` : '—'}
        />
        <StatTile
          label="Projeção"
          value={
            projectionWeeks != null ? `~${projectionWeeks} sem.` : '—'
          }
          hint={weightGoalKg > 0 ? 'até à meta' : 'define uma meta'}
        />
      </div>

      {weightSpark && (
        <section className="surface saude-trend">
          <div className="saude-trend__head">
            <strong>Evolução do peso</strong>
            <span>{metrics.length} registos</span>
          </div>
          <Sparkline points={weightSpark} />
        </section>
      )}

      <section className="surface saude-history">
        <div className="saude-trend__head">
          <strong>Medições</strong>
          <button type="button" className="btn btn--ghost" onClick={onOpenBody}>
            <Scale size={14} />
            Novo
          </button>
        </div>
        {metrics.length === 0 ? (
          <p className="saude-empty">
            Ainda sem medições. Regista peso e, se quiseres, cintura, braço e %
            gordura.
          </p>
        ) : (
          <ul className="saude-weight-list">
            {metrics.slice(0, 10).map((m) => (
              <li key={m.id}>
                <span>
                  {m.dateKey.slice(8)}/{m.dateKey.slice(5, 7)} · {m.weightKg} kg
                  {m.waistCm ? ` · cintura ${m.waistCm}` : ''}
                  {m.bodyFatPct ? ` · ${m.bodyFatPct}%` : ''}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => onRemoveMetric(m.id)}
                  aria-label="Remover medição"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="surface saude-history">
        <div className="saude-trend__head">
          <strong>Fotos de progresso</strong>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onOpenPhotos}
          >
            <Camera size={14} />
            Gerir
          </button>
        </div>
        {photos.length === 0 ? (
          <p className="saude-empty">
            Fotos privadas no dispositivo (até 8), úteis para ver evolução além
            da balança.
          </p>
        ) : (
          <div className="saude-photos is-compact">
            {photos.slice(0, 4).map((p) => (
              <figure key={p.id} className="saude-photo">
                <img src={p.dataUrl} alt="" />
                <figcaption>{p.dateKey.slice(8)}/{p.dateKey.slice(5, 7)}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
