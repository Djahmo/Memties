import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, errorMessage } from '../../services/api'

type Row = { index: number; valid: boolean; duplicate: boolean; contact: { displayName: string; firstName: string; lastName: string; email: string; phone: string; organization: string } }
export const ContactImport = ({ groupId, onImported }: { groupId: string; onImported: () => void }) => {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const preview = async (file: File) => {
    setBusy(true); setError(''); setRows(null); setResult(null)
    try {
      if (file.size > 2_000_000) { setError('File too large.'); return }
      const content = await file.text()
      const items = await api<Row[]>('/import/contacts/preview', { method: 'POST', body: { text: content, groupId } })
      setText(content); setRows(items); setSelected(items.filter(row => row.valid && !row.duplicate).map(row => row.index))
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  const commit = async () => {
    setBusy(true); setError('')
    try {
      setResult(await api('/import/contacts', { method: 'POST', body: { text, groupId, selected } }))
      setRows(null); setText(''); onImported()
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  return <details className="border border-line rounded-lg p-3 mt-4"><summary className="cursor-pointer text-sm text-accent">{t('Import contacts (VCF)')}</summary>
    <div className="space-y-3 mt-3"><p className="text-sm muted">{t('vCard 3.0 / 4.0. Import into the current group. Likely duplicates are skipped without merging.')}</p>
      <input type="file" accept=".vcf,.vcard,text/vcard" disabled={busy} aria-label={t('Contact file')} onChange={event => { const file = event.target.files?.[0]; if (file) void preview(file); event.target.value = '' }} />
      {rows && <><div className="max-h-80 overflow-auto space-y-2">{rows.map(row => <label key={row.index} className="flex gap-2 border-b border-line py-2 text-sm"><input type="checkbox" disabled={busy || !row.valid || row.duplicate} checked={selected.includes(row.index)} onChange={event => setSelected(current => event.target.checked ? [...current, row.index] : current.filter(index => index !== row.index))} /><span><strong>{row.contact.displayName}</strong><span className="block">{[row.contact.firstName, row.contact.lastName, row.contact.email, row.contact.phone, row.contact.organization].filter(Boolean).join(' · ')}</span>{(!row.valid || row.duplicate) && <span className="muted">{t(row.duplicate ? 'Likely duplicate — skipped' : 'Invalid contact — skipped')}</span>}</span></label>)}</div>
        <button className="primary" disabled={busy || !selected.length} onClick={() => { void commit() }}>{t('Import selected contacts')} ({selected.length})</button></>}
      {result && <p role="status">{t('Imported: {{imported}}. Skipped: {{skipped}}.', result)}</p>}
      {error && <p className="error" role="alert">{t(error)}</p>}
    </div>
  </details>
}
