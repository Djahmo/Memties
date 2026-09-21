import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
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
  const fileInput = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const load = async (file: File) => {
    setBusy(true); setError(''); setPreview(null); setData(null); setDone(false); setFileName(file.name)
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
  return <section className="space-y-5">
    <h4 className="font-semibold">{t('Memties import / export')}</h4>
    <p className="muted text-sm">{t('Export only your accessible data, including Personal. Keep the file private.')}</p>
    <a className="secondary" href="/api/transfer/export"><Download size={18} aria-hidden="true" />{t('Export JSON')}</a>
    <div className="border-t border-line pt-5 space-y-3">
      <h5 className="font-medium">{t('Import JSON')}</h5>
      <p className="muted text-sm">{t('Choose a Memties JSON file, up to 20 MB. Preview before importing.')}</p>
      <button type="button" className="secondary" disabled={busy} onClick={() => fileInput.current?.click()}><Upload size={18} aria-hidden="true" />{t('Choose JSON file')}</button>
      {fileName && <p className="text-sm muted break-words">{fileName}</p>}
    </div>
    <input ref={fileInput} hidden aria-label={t('Import JSON')} type="file" accept=".json,application/json" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void load(file); event.target.value = '' }} />
    {preview && <>
      <p className="text-sm">{t('Import creates new copies in a new folder under Personal. Existing data is never merged or overwritten. Sharing, authors and notifications are not transferred. Reimporting creates another copy.')}</p>
      <div className="max-h-64 overflow-auto">{(['groups', 'people', 'entries', 'reminders', 'tags'] as const).map(kind => <details key={kind}><summary className="cursor-pointer">{t(kind)} ({preview.counts[kind]})</summary><ul className="pl-4 text-sm">{preview[kind].map((name, index) => <li className="break-words" key={index}>{name}</li>)}</ul></details>)}</div>
      <div className="flex flex-wrap gap-2"><button className="primary" disabled={busy} onClick={() => { void commit() }}>{t('Confirm import as new private copies')}</button>
      <button className="secondary" disabled={busy} onClick={() => { setPreview(null); setData(null) }}>{t('Cancel')}</button></div>
    </>}
    {done && <p role="status">{t('Import completed. Reload to see the new groups.')} <button className="underline" onClick={() => window.location.reload()}>{t('Reload')}</button></p>}
    {busy && <p role="status">{t('Working…')}</p>}
    {error && <p className="error" role="alert">{t(error)}</p>}
  </section>
}
