import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { LockKeyhole, UserPlus } from 'lucide-react'
import { api, errorMessage } from '../../services/api'
import type { Group, Person } from '../../types/api'
import { groupLabel } from '../groups/groupLabels'

const fields = [
  { name: 'firstName', label: 'First name', max: 120 }, { name: 'lastName', label: 'Last name', max: 120 },
  { name: 'nickname', label: 'Nickname', max: 120 }, { name: 'email', label: 'Email', max: 254, type: 'email' },
  { name: 'phone', label: 'Phone', max: 80, type: 'tel' }, { name: 'organization', label: 'Organization', max: 240 },
  { name: 'jobTitle', label: 'Job title', max: 240 },
] as const

export const PersonForm = ({ groups, groupId, existing, onSaved, onCancel }: { groups: Group[]; groupId: string; existing?: Person; onSaved: (person: Person) => void; onCancel: () => void }) => {
  const { t } = useTranslation()
  const [selected, setSelected] = useState(existing?.groupIds ?? [groupId])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected.length) { setError('Select at least one group. Use Personal to keep this contact private.'); return }
    const form = new FormData(event.currentTarget)
    setError(''); setBusy(true)
    try {
      onSaved(await api<Person>(existing ? `/people/${existing.id}` : '/people', { method: existing ? 'PATCH' : 'POST', body: {
        displayName: String(form.get('displayName')).trim(), notes: String(form.get('notes')).trim(), groupIds: selected,
        ...Object.fromEntries(fields.map(field => [field.name, String(form.get(field.name)).trim()])),
      } }))
    } catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
  }
  return <section className="card max-w-3xl"><h2 className="flex items-center gap-2 text-xl font-semibold"><UserPlus size={22} aria-hidden="true" />{existing ? t("Edit contact") : t("New contact")}</h2><p className="muted text-sm mt-2 mb-6">{t("One person, across all the contexts where you know them.")}</p>
    <form onSubmit={submit}><fieldset disabled={busy} className="space-y-5">
      <label className="field-label">{t("Display name")}<input className="input-field" name="displayName" defaultValue={existing?.displayName} autoFocus maxLength={240} required /></label>
      <div className="grid sm:grid-cols-2 gap-4">{fields.map(field => <label key={field.name} className="field-label">{t(field.label)}<input className="input-field" name={field.name} defaultValue={existing?.[field.name]} type={'type' in field ? field.type : 'text'} maxLength={field.max} /></label>)}</div>
      <label className="field-label">{t("General notes")}<textarea className="input-field resize-y" name="notes" defaultValue={existing?.notes} rows={3} maxLength={10000} /><span className="muted text-xs font-normal">{t("These notes are part of the contact profile and visible wherever this contact is shared. Use a Personal entry for private notes.")}</span></label>
      <fieldset className="space-y-2"><legend className="field-label mb-2">{t("Groups")}</legend>{groups.filter(group => group.role !== 'viewer').map(group => <label className="flex items-center gap-3 text-sm" key={group.id}><input type="checkbox" className="size-4 accent-[#245b47]" checked={selected.includes(group.id)} onChange={event => setSelected(current => event.target.checked ? [...current, group.id] : current.filter(id => id !== group.id))} />{groupLabel(groups, group.id)}{group.isPrivate && <LockKeyhole size={14} aria-label={t("Private group")} />}</label>)}</fieldset>
      <p className="muted text-sm">{t("Everyone with access to any selected group can see this profile. Linking a person never shares their private entries.")}</p>
      {error && <p role="alert" className="error">{t(error)}</p>}
      <div className="flex gap-3"><button className="primary" type="submit">{busy ? t("Saving…") : existing ? t("Save contact") : t("Create contact")}</button><button className="secondary" type="button" onClick={onCancel}>{t("Cancel")}</button></div>
    </fieldset></form>
  </section>
}
