import { useTranslation } from 'react-i18next'
import { useApi } from '../../hooks/useApi'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { FilePenLine, LockKeyhole, UsersRound } from 'lucide-react'
import { api, errorMessage } from '../../services/api'
import type { Entry, Group } from '../../types/api'
import { PersonPicker } from '../people/PersonPicker'
import type { SelectedPerson } from '../people/PersonPicker'
import { groupLabel } from '../groups/groupLabels'

const localDateTime = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export const EntryForm = ({ groups, groupId, person, existing, onSaved, onCancel }: {
  groups: Group[]; groupId: string; person?: SelectedPerson; existing?: Entry; onSaved: (entry: Entry) => void; onCancel: () => void
}) => {
  const { t, i18n } = useTranslation()
  const [addReminder, setAddReminder] = useState(false)
  const { data: reminderConfig } = useApi<{ mailEnabled: boolean; pushEnabled: boolean }>('/reminders/config')
  const [destination, setDestination] = useState(existing?.groupId ?? groupId)
  const [selected, setSelected] = useState<SelectedPerson[]>(existing?.people ?? (person ? [person] : []))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const target = groups.find(group => group.id === destination)
  const moved = !!existing && existing.groupId !== destination
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError(''); setBusy(true)
    try {
      onSaved(await api<Entry>(existing ? `/entries/${existing.id}` : '/entries', { method: existing ? 'PATCH' : 'POST', body: {
        title: String(form.get('title')).trim(), body: String(form.get('body')),
        occurredAt: new Date(String(form.get('occurredAt'))).toISOString(), groupId: destination, personIds: selected.map(person => person.id),
        ...(!existing && addReminder ? { reminder: { title: String(form.get('reminderTitle')).trim(), dueAt: new Date(String(form.get('reminderDue'))).toISOString(), notifyByPush: form.get('reminderPush') === 'on', notifyByEmail: form.get('reminderEmail') === 'on', language: i18n.language.startsWith('fr') ? 'fr' : 'en' } } : {}),
      } }))
    } catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
  }
  return <section className="card max-w-3xl"><h2 className="text-xl font-semibold flex items-center gap-2"><FilePenLine size={22} aria-hidden="true" />{existing ? t("Edit entry") : t("New entry")}</h2><p className="muted text-sm mt-2 mb-6">{t("Capture a conversation, meeting, or a note to yourself.")}</p>
    <form onSubmit={submit}><fieldset disabled={busy} className="space-y-5">
      <label className="field-label">{t("Title")}<input className="input-field" autoFocus name="title" defaultValue={existing?.title} maxLength={240} required /></label>
      <div className="grid sm:grid-cols-2 gap-4"><label className="field-label">{t("Date and time")}<input className="input-field" type="datetime-local" name="occurredAt" defaultValue={localDateTime(existing ? new Date(existing.occurredAt) : new Date())} required /></label><label className="field-label">{t("Group")}<select aria-label={t("Group")} className="input-field" value={destination} required onChange={event => setDestination(event.target.value)}>{groups.filter(group => group.role !== 'viewer').map(group => <option key={group.id} value={group.id}>{groupLabel(groups, group.id)}</option>)}</select></label></div>
      <p className="rounded-lg bg-soft text-sm p-3 flex items-start gap-2">{target?.isPrivate ? <LockKeyhole size={17} className="shrink-0 mt-0.5" aria-hidden="true" /> : <UsersRound size={17} className="shrink-0 mt-0.5" aria-hidden="true" />}{target?.isPrivate ? t("Only you can see this entry. Your Personal vault and its subgroups stay private.") : t('This entry is visible to everyone with access to {{name}}.', { name: target?.name ?? t('Group') })}</p>
      {moved && <label key={destination} className="flex gap-3 text-sm rounded-lg border border-warningline bg-warning p-3"><input type="checkbox" className="size-4 shrink-0 mt-0.5 accent-[#245b47]" required />{t("I understand that moving this entry changes who can access it.")}</label>}
      <label className="field-label">{t("Content")}<textarea className="input-field resize-y" name="body" defaultValue={existing?.body} rows={7} maxLength={10000} placeholder={t("What would you like to remember?")} /></label>
      <PersonPicker selected={selected} onChange={setSelected} />
      {!existing && <div className="rounded-lg bg-soft p-4 space-y-3"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={addReminder} onChange={event => setAddReminder(event.target.checked)} />{t('Add reminder')}</label>{addReminder && <>
        <label className="field-label">{t('Reminder title')}<input className="input-field" name="reminderTitle" maxLength={240} required /></label>
        <label className="field-label">{t('Due date')}<input className="input-field" type="datetime-local" name="reminderDue" required /></label>
        {reminderConfig?.pushEnabled && <><label className="flex gap-2 items-center text-sm"><input type="checkbox" name="reminderPush" />{t('Push me when due')}</label><p className="muted text-xs">{t('Enable notifications on your devices in App settings.')}</p></>}
        {reminderConfig?.mailEnabled && <label className="flex gap-2 items-center text-sm"><input type="checkbox" name="reminderEmail" />{t('Email me when due')}</label>}
      </>}</div>}
      <p className="muted text-xs">{t("Linked contact profiles keep their own group permissions.")}</p>
      {error && <p role="alert" className="error">{t(error)}</p>}
      <div className="flex gap-3"><button className="primary" type="submit">{busy ? t("Saving…") : existing ? t("Save entry") : t("Create entry")}</button><button className="secondary" type="button" onClick={onCancel}>{t("Cancel")}</button></div>
    </fieldset></form>
  </section>
}
