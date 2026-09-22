import { useTranslation } from 'react-i18next'
import { GroupActions } from './GroupActions'
import { GroupColorPicker } from './GroupColorPicker'
import { useEffect, useRef, useState } from 'react'
import { Check, Users, X } from 'lucide-react'
import type { FormEvent } from 'react'
import type { Group } from '../../types/api'
import { api, errorMessage } from '../../services/api'

export const GroupForm = ({ existing, onSaved, onCancel }: { existing: Group; onSaved: (group: Group) => void; onCancel: () => void }) => {
  const { t } = useTranslation()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [color, setColor] = useState(existing.color)
  const [name, setName] = useState(existing.name)
  const [description, setDescription] = useState(existing.description ?? '')
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
  }} aria-labelledby="group-form-title" aria-describedby="group-form-description" className="m-auto w-[94vw] max-w-2xl max-h-[90dvh] overflow-auto rounded-2xl border border-line bg-surface text-ink p-5 sm:p-8 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm">
    <header className="flex items-start gap-4 sm:gap-5 mb-8">
      <span className="hidden sm:flex size-16 shrink-0 items-center justify-center rounded-full bg-selected text-accent"><Users size={30} aria-hidden="true" /></span>
      <div className="flex-1 min-w-0">
        <h2 id="group-form-title" className="text-xl sm:text-2xl font-semibold">{t('Edit group')}</h2>
        <p id="group-form-description" className="muted mt-2 leading-relaxed">{t('Customize the appearance and information of your group.')}</p>
      </div>
      <button type="button" className="size-11 shrink-0 flex items-center justify-center rounded-lg text-muted hover:bg-hover" aria-label={t('Close')} disabled={busy} onClick={onCancel}><X size={24} aria-hidden="true" /></button>
    </header>
    <form onSubmit={submit}><fieldset disabled={busy} className="space-y-7">
      <div>
        <label className="field-label">{t('Group name')}<input className="input-field py-3.5" autoFocus name="name" value={name} onChange={event => setName(event.target.value)} maxLength={120} required aria-describedby="group-name-count" /></label>
        <p id="group-name-count" className="text-right text-sm muted mt-2">{name.length}/120</p>
      </div>
      <GroupColorPicker color={color} onChange={setColor} disabled={busy} />
      <div>
        <label className="field-label">{t('Description')} <span className="muted font-normal">{t('(optional)')}</span><textarea className="input-field resize-y" name="description" value={description} onChange={event => setDescription(event.target.value)} placeholder={t('Add a short description of the group…')} maxLength={2000} rows={4} aria-describedby="group-description-count" /></label>
        <p id="group-description-count" className="text-right text-sm muted mt-2">{description.length}/2000</p>
      </div>
      {error && <p role="alert" className="error">{t(error)}</p>}
      <footer className="flex flex-wrap items-start justify-between gap-4 border-t border-line pt-6">
        <GroupActions key={existing.id} group={existing} />
        <div className="flex gap-3 ml-auto"><button type="button" className="secondary" onClick={onCancel}>{t('Cancel')}</button><button className="primary" type="submit"><Check size={20} aria-hidden="true" />{busy ? t('Saving…') : t('Save')}</button></div>
      </footer>
    </fieldset></form>
    </dialog>
}
