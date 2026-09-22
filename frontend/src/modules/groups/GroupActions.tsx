import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import type { Group } from '../../types/api'
import { api, errorMessage } from '../../services/api'

export const GroupActions = ({ group }: { group: Group }) => {
  const { t } = useTranslation()
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const remove = async () => {
    setBusy(true)
    setError('')
    try {
      await api(`/groups/${group.id}`, { method: 'DELETE' })
      window.location.reload()
    } catch (cause) {
      setError(errorMessage(cause))
      setBusy(false)
    }
  }

  if (group.isPersonal) return null
  return <section className="mt-8 pt-6 border-t border-line" aria-label={t('Delete group')}>
    <fieldset disabled={busy} className="space-y-3">
      <h3 className="font-semibold">{t('Delete group')}</h3>
      <p className="muted text-sm">{t('Only empty groups can be deleted. Move their subgroups, contacts and entries first.')}</p>
      {deleting ? <>
        <p className="text-sm">{t('Permanently delete {{name}}?', { name: group.name })}</p>
        <div className="flex gap-3">
          <button type="button" className="secondary text-errorink" onClick={() => { void remove() }}><Trash2 size={16} />{t('Confirm deletion')}</button>
          <button type="button" className="secondary" onClick={() => setDeleting(false)}>{t('Cancel')}</button>
        </div>
      </> : <button type="button" className="secondary text-errorink" onClick={() => setDeleting(true)}><Trash2 size={16} />{t('Delete group')}</button>}
      {error && <p role="alert" className="error">{t(error)}</p>}
    </fieldset>
  </section>
}
