import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { LockKeyhole, UserPlus } from 'lucide-react'
import { api, errorMessage } from '../../services/api'
import type { Group, Person } from '../../types/api'
import { includeParentGroups, toggleGroupSelection } from '../groups/groupSelection'
import { groupLabel, groupRows } from '../groups/groupLabels'

const fields = [
  { name: 'nickname', label: 'Nickname', max: 120 }, { name: 'email', label: 'Email', max: 254, type: 'email' },
  { name: 'phone', label: 'Phone', max: 80, type: 'tel' }, { name: 'organization', label: 'Organization', max: 240 },
  { name: 'jobTitle', label: 'Job title', max: 240 },
] as const

export const PersonForm = ({ groups, groupId, existing, onSaved, onCancel }: { groups: Group[]; groupId: string; existing?: Person; onSaved: (person: Person) => void; onCancel: () => void }) => {
  const { t } = useTranslation()
  const [selected, setSelected] = useState(() => includeParentGroups(groups, existing?.groupIds ?? (groups.find(group => group.id === groupId)?.isPersonal ? [] : [groupId])))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [firstName, setFirstName] = useState(existing?.firstName ?? '')
  const [lastName, setLastName] = useState(existing?.lastName ?? '')
  const [customName, setCustomName] = useState(!!existing && existing.displayName !== [existing.firstName, existing.lastName].filter(Boolean).join(' '))
  const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!customName && fullName.length > 240) { setError('The full name must not exceed 240 characters.'); return }
    if (!selected.length) { setError('Select at least one group. Use Personal to keep this contact private.'); return }
    const form = new FormData(event.currentTarget)
    setError(''); setBusy(true)
    try {
      onSaved(await api<Person>(existing ? `/people/${existing.id}` : '/people', { method: existing ? 'PATCH' : 'POST', body: {
        displayName: customName ? String(form.get('displayName')).trim() : fullName,
        firstName: firstName.trim(), lastName: lastName.trim(), notes: String(form.get('notes')).trim(), groupIds: selected,
        ...Object.fromEntries(fields.map(field => [field.name, String(form.get(field.name)).trim()])),
      } }))
    } catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
  }
  return <section className="card max-w-3xl"><h2 className="flex items-center gap-2 text-xl font-semibold"><UserPlus size={22} aria-hidden="true" />{existing ? t("Edit contact") : t("New contact")}</h2><p className="muted text-sm mt-2 mb-6">{t("One person, across all the contexts where you know them.")}</p>
    <form onSubmit={submit}><fieldset disabled={busy} className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="field-label">{t('First name')}<input className="input-field" autoFocus autoComplete="given-name" value={firstName} onChange={event => setFirstName(event.target.value)} maxLength={120} required={!lastName.trim() && !customName} /></label>
        <label className="field-label">{t('Last name')}<input className="input-field" autoComplete="family-name" value={lastName} onChange={event => setLastName(event.target.value)} maxLength={120} required={!firstName.trim() && !customName} /></label>
      </div>
      <label className="flex items-center gap-3 min-h-11 text-sm"><input type="checkbox" className="size-4 shrink-0" checked={customName} onChange={event => setCustomName(event.target.checked)} />{t('Use a custom display name')}</label>
      {customName && <label className="field-label">{t('Display name')}<input className="input-field" name="displayName" defaultValue={existing?.displayName ?? fullName} maxLength={240} required /></label>}
      <div className="grid sm:grid-cols-2 gap-4">{fields.filter(field => field.name === 'email' || field.name === 'phone').map(field => <label key={field.name} className="field-label">{t(field.label)}<input className="input-field" name={field.name} defaultValue={existing?.[field.name]} type={field.type} maxLength={field.max} /></label>)}</div>
      <details className="border border-line rounded-lg p-4"><summary className="cursor-pointer font-medium text-sm py-1">{t('Additional contact details')}</summary><div className="grid sm:grid-cols-2 gap-4 mt-4">{fields.filter(field => field.name !== 'email' && field.name !== 'phone').map(field => <label key={field.name} className="field-label">{t(field.label)}<input className="input-field" name={field.name} defaultValue={existing?.[field.name]} maxLength={field.max} /></label>)}</div>
      <label className="field-label">{t("General notes")}<textarea className="input-field resize-y" name="notes" defaultValue={existing?.notes} rows={3} maxLength={10000} /><span className="muted text-xs font-normal">{t("These notes are part of the contact profile and visible wherever this contact is shared. Use a Personal entry for private notes.")}</span></label>
      </details>
      <fieldset className="space-y-2 min-w-0">
        <legend className="field-label mb-2">{t('Groups')}</legend>
        <div className="max-h-72 overflow-auto space-y-1">
          {groupRows(groups).map(({ group, depth }) => <div key={group.id} style={{ paddingInlineStart: `${Math.min(depth, 6) * 1.25}rem` }}>
            <label className={`flex items-center gap-3 text-sm min-h-11 rounded-lg px-3 ${selected.includes(group.id) ? 'bg-selected' : 'hover:bg-soft'} ${group.role === 'viewer' ? 'text-muted' : 'cursor-pointer'}`}>
              <input type="checkbox" className="size-4 shrink-0 accent-[#245b47]" aria-label={groupLabel(groups, group.id)} disabled={group.role === 'viewer'} checked={selected.includes(group.id)} onChange={event => setSelected(current => toggleGroupSelection(groups, current, group.id, event.target.checked))} />
              <span className="min-w-0 break-words">{group.name}</span>
              {group.isPrivate && <LockKeyhole className="shrink-0" size={14} aria-label={t('Private group')} />}
              {group.role === 'viewer' && <span className="ml-auto text-xs">{t('Read only')}</span>}
            </label>
          </div>)}
        </div>
      </fieldset>
      <p className="muted text-sm">{t("Everyone with access to any selected group can see this profile. Linking a person never shares their private entries.")}</p>
      {error && <p role="alert" className="error">{t(error)}</p>}
      <div className="grid grid-cols-1 sm:flex gap-3"><button className="primary" type="submit">{busy ? t("Saving…") : existing ? t("Save contact") : t("Create contact")}</button><button className="secondary" type="button" onClick={onCancel}>{t("Cancel")}</button></div>
    </fieldset></form>
  </section>
}
