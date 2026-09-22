import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Group } from '../../types/api'
import { api, errorMessage } from '../../services/api'

export const MoveGroupDialog = ({ group, destination, beforeId, onCancel, onMoved }: {
  group: Group
  destination: Group | null
  beforeId: string | null
  onCancel: () => void
  onMoved: (group: Group) => void
}) => {
  const { t } = useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { dialog.current?.showModal() }, [])

  const move = async () => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      onMoved((await api<{ group: Group }>(`/groups/${group.id}/move`, {
        method: 'POST', body: {
          parentId: destination?.id ?? null,
          beforeId,
          confirmPrivacyChange: group.isPrivate !== (destination?.isPrivate ?? false),
        },
      })).group)
    } catch (cause) {
      setError(errorMessage(cause))
      pending.current = false
      setBusy(false)
    }
  }

  return <dialog ref={dialog} onClose={onCancel} onCancel={event => { if (busy) event.preventDefault() }} onClick={event => {
    if (event.target !== event.currentTarget || busy) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onCancel()
  }} aria-labelledby="move-group-title" className="m-auto w-[94vw] max-w-md rounded-xl border border-line bg-surface text-ink p-6 backdrop:bg-black/50">
    <h2 id="move-group-title" className="text-lg font-semibold mb-4">{t('Move group')}</h2>
    <p className="break-words">{t('Move {{name}} into {{destination}}?', { name: group.name, destination: destination?.name ?? t('Root level') })}</p>
    <p className="muted text-sm mt-3">{t(group.isPrivate === (destination?.isPrivate ?? false)
      ? 'Moving this group also moves its subgroups and may change who can access them.'
      : destination?.isPrivate
        ? 'This group and its subgroups will become private. Only you will have access. Existing direct permissions will be inactive while they remain in Personal.'
        : 'This group and its subgroups will leave Personal. Access will follow the destination, and any existing direct permissions will become active again.')}</p>
    {error && <p role="alert" className="error mt-4">{t(error)}</p>}
    <div className="flex justify-end gap-3 mt-6">
      <button autoFocus className="secondary" disabled={busy} onClick={onCancel}>{t('Cancel')}</button>
      <button className="primary" disabled={busy} onClick={() => { void move() }}>{t(busy ? 'Saving…' : 'Move group')}</button>
    </div>
  </dialog>
}
