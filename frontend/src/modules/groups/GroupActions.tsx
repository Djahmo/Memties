import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderInput, Trash2 } from 'lucide-react'
import type { Group } from '../../types/api'
import { api, errorMessage } from '../../services/api'
import { groupLabel } from './groupLabels'

export const GroupActions = ({ group }: { group: Group }) => {
  const { t } = useTranslation()
  const [groups, setGroups] = useState<Group[]>([])
  const [parentId, setParentId] = useState(group.parentId ?? '')
  const [loaded, setLoaded] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    api<Group[]>('/groups', { signal: controller.signal }).then(value => {
      if (!controller.signal.aborted) { setGroups(value); setLoaded(true) }
    }).catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)) })
    return () => controller.abort()
  }, [])
  const descendants = new Set([group.id])
  const pending = [group.id]
  while (pending.length) {
    const id = pending.pop()
    for (const child of groups) {
      if (child.parentId === id && !descendants.has(child.id)) {
        descendants.add(child.id)
        pending.push(child.id)
      }
    }
  }
  const labels = groups.map(item => item.isPersonal ? { ...item, name: t('Personal') } : item)
  const destinations = labels.filter(item => item.role === 'owner' && item.isPrivate === group.isPrivate && !descendants.has(item.id))
  const execute = async (remove: boolean) => {
    setBusy(true)
    setError('')
    try {
      await api<{ success: boolean }>(`/groups/${group.id}${remove ? '' : '/move'}`, {
        method: remove ? 'DELETE' : 'POST',
        ...(!remove ? { body: { parentId: parentId || null } } : {}),
      })
      // Reload the tree and all inherited permissions after a structural change.
      window.location.reload()
    } catch (cause) {
      setError(errorMessage(cause))
      setBusy(false)
    }
  }
  if (group.isPersonal) return null
  return <section className="mt-8 pt-6 border-t border-line space-y-5" aria-label={t('Move or delete group')}>
    <fieldset disabled={busy} className="space-y-4">
      <h3 className="font-semibold flex items-center gap-2"><FolderInput size={18} />{t('Move group')}</h3>
      <label className="field-label">{t('Destination group')}
        <select className="input-field" aria-label={t('Destination group')} value={parentId} disabled={!loaded} onChange={event => { setParentId(event.target.value); setConfirmed(false) }}>
          {!group.isPrivate && <option value="">{t('Root level')}</option>}
          {destinations.map(item => <option key={item.id} value={item.id}>{groupLabel(labels, item.id)}</option>)}
        </select>
      </label>
      <p className="muted text-sm">{t('The group and its subgroups inherit access from the new parent. Direct memberships remain. Moving to the root makes you an owner.')}</p>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />{t('I understand that moving this group changes who can access its content.')}</label>
      <button type="button" className="secondary" disabled={!loaded || !confirmed || parentId === (group.parentId ?? '')} onClick={() => { void execute(false) }}><FolderInput size={16} />{t('Move group')}</button>
      <div className="pt-5 border-t border-line space-y-3">
        <h3 className="font-semibold">{t('Delete group')}</h3>
        <p className="muted text-sm">{t('Only empty groups can be deleted. Move their subgroups, contacts and entries first.')}</p>
        {deleting ? <div className="space-y-3">
          <p className="text-sm">{t('Permanently delete {{name}}?', { name: group.name })}</p>
          <div className="flex gap-3"><button type="button" className="secondary text-errorink" onClick={() => { void execute(true) }}><Trash2 size={16} />{t('Confirm deletion')}</button><button type="button" className="secondary" onClick={() => setDeleting(false)}>{t('Cancel')}</button></div>
        </div> : <button type="button" className="secondary text-errorink" onClick={() => setDeleting(true)}><Trash2 size={16} />{t('Delete group')}</button>}
      </div>
      {busy && <p role="status" className="muted text-sm">{t('Saving…')}</p>}
      {error && <p role="alert" className="error">{t(error)}</p>}
    </fieldset>
  </section>
}
