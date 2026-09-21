import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Plus } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { api, errorMessage } from '../../services/api'
import type { Tag } from '../../types/api'

export const TagPicker = ({ selected, onChange, disabled = false }: {
  selected: Tag | null; onChange: (tag: Tag | null) => void; disabled?: boolean
}) => {
  const { t } = useTranslation()
  const { data, error: loadError, reload } = useApi<Tag[]>('/tags')
  const [editing, setEditing] = useState<'new' | string | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3b82f6')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const id = useId()

  const save = async () => {
    if (!name.trim()) { setError('Enter a tag name.'); return }
    setBusy(true); setError('')
    try {
      onChange(await api<Tag>(editing === 'new' ? '/tags' : `/tags/${editing}`, {
        method: editing === 'new' ? 'POST' : 'PATCH', body: { name: name.trim(), color },
      }))
      setEditing(null)
      reload()
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }

  return <fieldset disabled={disabled || busy} className="space-y-3 min-w-0">
    <legend className="text-sm font-semibold mb-2">{t('Personal tag')}</legend>
    <p className="muted text-xs">{t('Only you see your tags, even on shared entries.')}</p>
    <div className="flex flex-wrap items-center gap-2">
      {selected && <span className="size-4 shrink-0 rounded-full border border-strongline" style={{ backgroundColor: selected.color }} aria-hidden="true" />}
      <label className="sr-only" htmlFor={id}>{t('Personal tag')}</label>
      <select id={id} className="input-field flex-1 basis-40" value={selected?.id ?? ''} disabled={!data} onChange={event => { onChange(data?.find(tag => tag.id === event.target.value) ?? null); setEditing(null); setError('') }}>
        <option value="">{t('No tag')}</option>
        {selected && !data?.some(tag => tag.id === selected.id) && <option value={selected.id}>{selected.name}</option>}
        {data?.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
      </select>
      {selected && <button type="button" className="secondary" aria-label={t('Edit tag')} onClick={() => { setEditing(selected.id); setName(selected.name); setColor(selected.color); setError('') }}><Pencil size={16} aria-hidden="true" /></button>}
      <button type="button" className="secondary" onClick={() => { setEditing('new'); setName(''); setColor('#3b82f6'); setError('') }}><Plus size={16} aria-hidden="true" />{t('New tag')}</button>
    </div>
    {!data && !loadError && <p className="muted text-sm" role="status">{t('Loading tags…')}</p>}
    {editing && <div className="rounded-lg border border-line bg-subtle p-4 space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <label className="field-label flex-1 min-w-0">{t('Tag name')}<input className="input-field" value={name} maxLength={80} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void save() } }} /></label>
        <label className="field-label">{t('Tag color')}<input className="block w-14 h-11 mt-2 mb-1 rounded-lg border border-strongline bg-surface p-1 cursor-pointer" type="color" value={color} onChange={event => setColor(event.target.value)} /></label>
      </div>
      <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm max-w-full">
        <span className="size-3 shrink-0 rounded-full border border-strongline" style={{ backgroundColor: color }} aria-hidden="true" /><span className="break-words min-w-0">{name.trim() || t('Tag preview')}</span>
      </span>
      {editing !== 'new' && <p className="muted text-xs">{t('Changes apply to all your entries with this tag.')}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="primary" onClick={() => { void save() }}>{t(busy ? 'Saving…' : 'Save tag')}</button>
        <button type="button" className="secondary" onClick={() => { setEditing(null); setError('') }}>{t('Cancel')}</button>
      </div>
    </div>}
    {(error || loadError) && <p className="error" role="alert">{t(error || loadError || '')}{loadError && <button type="button" className="underline ml-2" onClick={reload}>{t('Retry')}</button>}</p>}
  </fieldset>
}
