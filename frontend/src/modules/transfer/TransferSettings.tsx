import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, errorMessage } from '../../services/api'

type Preview = { counts: Record<string, number>; groups: string[]; people: string[]; entries: string[]; reminders: string[]; tags: string[] }
export const TransferSettings = () => {
  const { t } = useTranslation()
  const [data, setData] = useState<unknown>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const load = async (file: File) => {
    setBusy(true); setError(''); setPreview(null); setData(null); setDone(false)
    try {
      if (file.size > 20_000_000) { setError('File too large.'); return }
      const parsed: unknown = JSON.parse(await file.text())
      setPreview(await api('/transfer/preview', { method: 'POST', body: parsed })); setData(parsed)
    } catch (cause) { setError(cause instanceof SyntaxError ? 'Invalid Memties file.' : errorMessage(cause)) } finally { setBusy(false) }
  }
  const commit = async () => {
    setBusy(true); setError('')
    try {
      await api('/transfer/import', { method: 'POST', body: { data, confirmed: true } })
      setPreview(null); setData(null); setDone(true)
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  return <section className="border-t border-line mt-6 pt-5 space-y-3">
    <h3 className="font-semibold">{t('Memties import / export')}</h3>
    <p className="muted text-sm">{t('Export only your accessible data, including Personal. Keep the file private.')}</p>
    <a className="secondary inline-flex" href="/api/transfer/export">{t('Export Memties JSON')}</a>
    <label className="field-label">{t('Import Memties JSON')}<input type="file" accept=".json,application/json" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void load(file); event.target.value = '' }} /></label>
    {preview && <>
      <p className="text-sm">{t('Import creates new copies in a new folder under Personal. Existing data is never merged or overwritten. Sharing, authors and email notifications are not transferred. Reimporting creates another copy.')}</p>
      <div className="max-h-64 overflow-auto">{(['groups', 'people', 'entries', 'reminders', 'tags'] as const).map(kind => <details key={kind}><summary className="cursor-pointer">{t(kind)} ({preview.counts[kind]})</summary><ul className="pl-4 text-sm">{preview[kind].map((name, index) => <li className="break-words" key={index}>{name}</li>)}</ul></details>)}</div>
      <button className="primary" disabled={busy} onClick={() => { void commit() }}>{t('Confirm import as new private copies')}</button>
      <button className="secondary ml-2" disabled={busy} onClick={() => { setPreview(null); setData(null) }}>{t('Cancel')}</button>
    </>}
    {done && <p role="status">{t('Import completed. Reload to see the new groups.')} <button className="underline" onClick={() => window.location.reload()}>{t('Reload')}</button></p>}
    {busy && <p role="status">{t('Working…')}</p>}
    {error && <p className="error" role="alert">{t(error)}</p>}
  </section>
}
