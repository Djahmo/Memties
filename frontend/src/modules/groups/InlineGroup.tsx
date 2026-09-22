import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Folder } from 'lucide-react'
import type { Group } from '../../types/api'
import { api, errorMessage } from '../../services/api'

export const InlineGroup = ({ parentId, depth, onSaved, onCancel }: {
  parentId: string | null
  depth: number
  onSaved: (group: Group) => void
  onCancel: () => void
}) => {
  const { t } = useTranslation()
  const pending = useRef(false)
  const cancelled = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async (name: string) => {
    if (pending.current || cancelled.current) return
    if (!name.trim()) { onCancel(); return }
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const group = await api<Group>('/groups', {
        method: 'POST', body: { name: name.trim(), parentId },
      })
      cancelled.current = true
      onSaved(group)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return <div className="py-1 pr-2" style={{ paddingLeft: depth * 18 + 32 }}>
    <div className="flex items-center gap-2">
      <Folder size={18} className="shrink-0 text-icon" aria-hidden="true" />
      <input
        autoFocus
        className="input-field min-w-0"
        aria-label={t('New group name')}
        maxLength={120}
        readOnly={busy}
        aria-busy={busy}
        aria-invalid={!!error}
        onBlur={event => { void save(event.currentTarget.value) }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return
          if (event.key === 'Escape') {
            event.preventDefault()
            if (!pending.current) { cancelled.current = true; onCancel() }
          } else if (event.key === 'Enter' || event.key === 'Tab') {
            if (event.key === 'Enter') event.preventDefault()
            void save(event.currentTarget.value)
          }
        }}
      />
    </div>
    {error && <p className="error text-sm mt-2" role="alert">{t(error)}</p>}
  </div>
}
