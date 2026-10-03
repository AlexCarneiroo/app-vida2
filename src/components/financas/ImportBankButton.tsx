import { FileUp, Loader2 } from 'lucide-react'
import { useState } from 'react'
import type { ImportDraft } from '../../lib/bankImport'

type ImportButtonProps = {
  onParsed: (result: {
    drafts: ImportDraft[]
    detectedMonth: string | null
    warnings: string[]
    source: string
  }) => void
  onError: (message: string) => void
}

export function ImportBankButton({ onParsed, onError }: ImportButtonProps) {
  const [busy, setBusy] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [pwd, setPwd] = useState('')
  const [pwdHint, setPwdHint] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  async function tryParse(file: File, password?: string) {
    setBusy(true)
    try {
      const { parseBankFile } = await import('../../lib/bankImport')
      const result = await parseBankFile(file, { password })
      setPwdOpen(false)
      setPendingFile(null)
      setPwd('')
      if (result.drafts.length === 0) {
        onError(result.warnings[0] || 'Não foi possível ler o ficheiro.')
        return
      }
      onParsed(result)
    } catch (err) {
      if (
        err instanceof Error &&
        err.name === 'PdfPasswordError' &&
        'reason' in err
      ) {
        const reason = (err as { reason: 'need' | 'incorrect' }).reason
        setPendingFile(file)
        setPwdOpen(true)
        setPwdHint(
          reason === 'incorrect'
            ? 'Senha incorreta. Em muitos bancos a senha é o CPF (só números).'
            : 'Este PDF está protegido. Digite a senha — em geral o CPF (só números).',
        )
        setPwd('')
        return
      }
      onError('Falha ao ler o ficheiro do banco.')
    } finally {
      setBusy(false)
    }
  }

  async function onFile(file: File | null) {
    if (!file) return
    await tryParse(file)
  }

  function closePwd() {
    setPwdOpen(false)
    setPendingFile(null)
    setPwd('')
  }

  return (
    <>
      <label
        className={`btn btn--ghost import-bank-btn${busy ? ' is-busy is-loading' : ''}`}
      >
        {busy ? (
          <Loader2 size={16} className="btn__spinner" aria-hidden />
        ) : (
          <FileUp size={16} />
        )}
        {busy ? 'A ler…' : 'Importar extrato'}
        <input
          type="file"
          accept=".csv,.txt,.ofx,.qfx,.pdf,text/csv,text/plain,application/pdf,application/x-ofx,application/ofx"
          hidden
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            e.target.value = ''
            void onFile(f)
          }}
        />
      </label>

      {pwdOpen && pendingFile && (
        <div className="app-confirm">
          <button
            type="button"
            className="app-confirm__backdrop"
            aria-label="Fechar"
            onClick={closePwd}
          />
          <div
            className="surface app-confirm__card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pdf-pwd-title"
          >
            <h2 id="pdf-pwd-title">Senha do PDF</h2>
            <p>{pwdHint}</p>
            <label className="import-pwd-field">
              <span>Senha</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                value={pwd}
                placeholder="Ex.: CPF sem pontos"
                onChange={(e) => setPwd(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && pwd.trim() && !busy) {
                    void tryParse(pendingFile, pwd.trim())
                  }
                }}
              />
            </label>
            <div className="app-confirm__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={closePwd}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!pwd.trim() || busy}
                onClick={() => void tryParse(pendingFile, pwd.trim())}
              >
                {busy ? 'A abrir…' : 'Abrir PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
