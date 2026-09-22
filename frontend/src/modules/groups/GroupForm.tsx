import { useTranslation } from 'react-i18next'
import { GroupActions } from './GroupActions'
import { GroupColorPicker } from './GroupColorPicker'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Group } from '../../types/api'
import { api, errorMessage } from '../../services/api'

export const GroupForm = ({ existing, onSaved, onCancel }: { existing: Group; onSaved: (group: Group) => void; onCancel: () => void }) => {
  const { t } = useTranslation()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [color, setColor] = useState(existing.color)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      onSaved(await api<Group>(`/groups/${existing.id}`, { method: 'PATCH', body: {
        name: String(form.get('name')).trim(), description: String(form.get('description')).trim(),
        color,
      } }))
    } catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
  }
  return <dialog ref={dialog} onClose={onCancel} onCancel={event => { if (busy) event.preventDefault() }} onClick={event => {
    if (event.target !== event.currentTarget || busy) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onCancel()
  }} aria-labelledby="group-form-title" className="m-auto w-[94vw] max-w-xl max-h-[90dvh] overflow-auto rounded-xl border border-line bg-surface text-ink p-6 backdrop:bg-black/50">
    <h2 id="group-form-title" className="text-xl font-semibold mb-6">{t('Group settings')}</h2>
    <form onSubmit={submit}><fieldset disabled={busy} className="space-y-5">
      <label className="field-label">{t("Name")}<input className="input-field" autoFocus name="name" defaultValue={existing.name} maxLength={120} required /></label>
      <GroupColorPicker color={color} onChange={setColor} disabled={busy} />
      <label className="field-label">{t("Description")} <span className="muted font-normal">{t("(optional)")}</span><textarea className="input-field resize-y" name="description" defaultValue={existing?.description} maxLength={2000} rows={4} /></label>
      {error && <p role="alert" className="error">{t(error)}</p>}
      <div className="flex gap-3"><button className="primary" type="submit">{busy ? t("Saving…") : t("Save changes")}</button><button type="button" className="secondary" onClick={onCancel}>{t("Cancel")}</button></div>
    </fieldset></form>
      <GroupActions key={existing.id} group={existing} />
    </dialog>
}
