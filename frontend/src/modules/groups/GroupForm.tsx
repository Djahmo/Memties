import { useTranslation } from 'react-i18next'
import { GroupActions } from './GroupActions'
import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Group } from '../../types/api'
import { api, errorMessage } from '../../services/api'

export const GroupForm = ({ parent, existing, onSaved, onCancel }: { parent: Group | null; existing?: Group; onSaved: (group: Group) => void; onCancel: () => void }) => {
  const { t } = useTranslation()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      onSaved(await api<Group>(existing ? `/groups/${existing.id}` : '/groups', { method: existing ? 'PATCH' : 'POST', body: {
        name: String(form.get('name')).trim(), description: String(form.get('description')).trim(),
        ...(!existing ? { parentId: parent?.id ?? null } : {}),
      } }))
    } catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
  }
  return <section className="card max-w-xl" aria-labelledby="group-form-title"><h2 id="group-form-title" className="text-xl font-semibold mb-2">{existing ? t("Group settings") : t("Create a group")}</h2><p className="muted text-sm mb-6">{existing ? t("Update the name and context of this group.") : parent ? t('Inside {{name}}. Access is inherited from this parent.', { name: parent.isPersonal ? t('Personal') : parent.name }) : t("A new root group, initially accessible only to you.")}</p>
    {(existing?.isPrivate || parent?.isPrivate) && <p className="mb-5 p-3 rounded-lg bg-soft text-sm">{t("This group belongs to your Personal vault. It stays private, including all its subgroups.")}</p>}
    <form onSubmit={submit}><fieldset disabled={busy} className="space-y-5">
      <label className="field-label">{t("Name")}<input className="input-field" autoFocus name="name" defaultValue={existing?.name} maxLength={120} required /></label>
      <label className="field-label">{t("Description")} <span className="muted font-normal">{t("(optional)")}</span><textarea className="input-field resize-y" name="description" defaultValue={existing?.description} maxLength={2000} rows={4} /></label>
      {error && <p role="alert" className="error">{t(error)}</p>}
      <div className="flex gap-3"><button className="primary" type="submit">{busy ? t("Saving…") : existing ? t("Save changes") : t("Create group")}</button><button type="button" className="secondary" onClick={onCancel}>{t("Cancel")}</button></div>
    </fieldset></form>
      {existing && <GroupActions key={existing.id} group={existing} />}
    </section>
}
