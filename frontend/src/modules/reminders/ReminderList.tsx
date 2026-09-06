import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, Check, Pencil, Plus, RotateCcw } from 'lucide-react'
import { api, errorMessage } from '../../services/api'
import { useApi } from '../../hooks/useApi'
import { Pagination } from '../../components/Pagination'
import type { Page } from '../../types/api'

type Reminder = {
  id: string; entryId: string; entryTitle: string; title: string; dueAt: string; status: 'pending' | 'completed'
  canEdit: boolean; canNotify: boolean; notifyByEmail: boolean
}
const localTime = (value: string) => {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export const ReminderList = ({ groupId, personId, entryId, canCreate = false }: { groupId?: string; personId?: string; entryId?: string; canCreate?: boolean }) => {
  const { t, i18n } = useTranslation()
  const [status, setStatus] = useState('pending')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])
  const [offset, setOffset] = useState(0)
  const [editing, setEditing] = useState<Reminder | 'new' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const query = new URLSearchParams({ status, offset: String(offset) })
  if (groupId) query.set('groupId', groupId)
  if (personId) query.set('personId', personId)
  if (entryId) query.set('entryId', entryId)
  const { data, loading, error: loadError, reload } = useApi<Page<Reminder>>(`/reminders?${query}`)
  const { data: config } = useApi<{ mailEnabled: boolean }>('/reminders/config')
  const changeStatus = async (reminder: Reminder) => {
    setBusy(true); setError('')
    try {
      await api(`/reminders/${reminder.id}`, { method: 'PATCH', body: { status: reminder.status === 'pending' ? 'completed' : 'pending' } })
      reload()
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editing) return
    const form = new FormData(event.currentTarget)
    setBusy(true); setError('')
    try {
      await api(editing === 'new' ? '/reminders' : `/reminders/${editing.id}`, { method: editing === 'new' ? 'POST' : 'PATCH', body: {
        title: String(form.get('title')).trim(), dueAt: new Date(String(form.get('dueAt'))).toISOString(),
        ...(editing === 'new' ? { entryId } : {}),
        ...((editing === 'new' || editing.canNotify) && config?.mailEnabled ? { notifyByEmail: form.get('notify') === 'on', language: i18n.language.startsWith('fr') ? 'fr' : 'en' } : {}),
      } })
      setEditing(null); reload()
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  const current = editing && editing !== 'new' ? editing : null
  return <section className="space-y-3" aria-label={t('Reminders')}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-semibold flex items-center gap-2"><Bell size={17} aria-hidden="true" />{t('Reminders')}</h3>
      <div className="flex gap-2 items-center"><select className="input-field text-sm py-2" aria-label={t('Reminder status')} value={status} onChange={event => { setStatus(event.target.value); setOffset(0) }}><option value="pending">{t('Pending')}</option><option value="completed">{t('Completed')}</option><option value="all">{t('All')}</option></select>
        {entryId && canCreate && <button type="button" className="secondary shrink-0" disabled={busy} onClick={() => { setEditing('new'); setError('') }} aria-label={t('Add reminder')}><Plus size={16} /></button>}
      </div>
    </div>
    {editing && <form key={current?.id ?? 'new'} onSubmit={submit} className="rounded-lg bg-soft p-4"><fieldset disabled={busy} className="space-y-3">
      <label className="field-label">{t('Reminder title')}<input className="input-field" autoFocus name="title" maxLength={240} required defaultValue={current?.title} /></label>
      <label className="field-label">{t('Due date')}<input className="input-field" type="datetime-local" name="dueAt" required defaultValue={current ? localTime(current.dueAt) : ''} /></label>
      {(editing === 'new' || current?.canNotify) && config?.mailEnabled && <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="notify" className="mt-1" defaultChecked={current?.notifyByEmail} />{t('Email me when due')}</label>}
      <p className="muted text-xs">{t('Reminders follow the visibility of their entry. Email notifications go only to their creator.')}</p>
      <div className="flex gap-2"><button className="primary" type="submit">{busy ? t('Saving…') : t('Save changes')}</button><button className="secondary" type="button" onClick={() => setEditing(null)}>{t('Cancel')}</button></div>
    </fieldset></form>}
    {loading && <p role="status" className="muted text-sm">{t('Loading reminders…')}</p>}
    {(error || loadError) && <p role="alert" className="error">{t(error || loadError || '')}{loadError && <button className="underline ml-2" onClick={reload}>{t('Retry')}</button>}</p>}
    {data && <>{data.items.map(reminder => <div key={reminder.id} className="border border-line rounded-lg p-4 flex items-start justify-between gap-3">
      <div className="min-w-0"><p className="font-medium break-words">{reminder.title}</p>{!entryId && <p className="text-sm muted break-words mt-1">{reminder.entryTitle}</p>}<time dateTime={reminder.dueAt} className={`text-xs ${reminder.status === 'pending' && new Date(reminder.dueAt).getTime() < now ? 'text-errorink' : 'muted'}`}>{new Date(reminder.dueAt).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })}</time><span className="badge ml-2">{t(reminder.status === 'pending' ? 'Pending' : 'Completed')}</span></div>
      {reminder.canEdit && <div className="flex gap-2 shrink-0"><button className="secondary p-2" disabled={busy} aria-label={t('Edit reminder')} onClick={() => { setEditing(reminder); setError('') }}><Pencil size={15} /></button><button className="secondary p-2" disabled={busy} aria-label={t(reminder.status === 'pending' ? 'Complete reminder' : 'Reopen reminder')} onClick={() => { void changeStatus(reminder) }}>{reminder.status === 'pending' ? <Check size={15} /> : <RotateCcw size={15} />}</button></div>}
    </div>)}{!data.items.length && <p className="muted text-sm py-3">{t('No reminders in this view.')}</p>}<Pagination offset={offset} nextOffset={data.nextOffset} onChange={setOffset} /></>}
  </section>
}

export const EntryReminders = ({ entryId, canCreate }: { entryId: string; canCreate: boolean }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return <details className="mt-4 border-t border-line pt-3" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="text-sm text-accent cursor-pointer">{t('Reminders')}</summary>
    {open && <div className="mt-3"><ReminderList entryId={entryId} canCreate={canCreate} /></div>}
  </details>
}
