import { useTranslation } from 'react-i18next'
import { TagPicker } from './TagPicker'
import { EntryReminders } from '../reminders/ReminderList'
import { useState } from 'react'
import { Archive, ArchiveRestore, CalendarDays, FileText, Filter, LockKeyhole, Pencil, Search, Trash2, X } from 'lucide-react'
import { api, errorMessage } from '../../services/api'
import { useApi } from '../../hooks/useApi'
import type { Entry, Group, Page } from '../../types/api'
import { Pagination } from '../../components/Pagination'
import { groupLabel, groupRows } from '../groups/groupLabels'
import { PersonPicker } from '../people/PersonPicker'
import type { SelectedPerson } from '../people/PersonPicker'

export const EntryTimeline = ({ groups, initialGroupId, personId, onEdit, onPerson }: { groups: Group[]; initialGroupId: string; personId?: string; onEdit: (entry: Entry) => void; onPerson: (id: string) => void }) => {
  const { t, i18n } = useTranslation()
  const [groupId, setGroupId] = useState(initialGroupId)
  const [tagEntryId, setTagEntryId] = useState<string | null>(null)
  const [archive, setArchive] = useState('active')
  const [archiveError, setArchiveError] = useState('')
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [participant, setParticipant] = useState<SelectedPerson | null>(null)
  const [offset, setOffset] = useState(0)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const archiveQuery = new URLSearchParams({ archive: 'archived', limit: '1' })
  if (groupId) archiveQuery.set('groupId', groupId)
  if (personId) archiveQuery.set('personId', personId)
  const { data: archivedEntries, reload: reloadArchives } = useApi<Page<Entry>>(`/entries?${archiveQuery}`)
  if (archive === 'archived' && archivedEntries?.items.length === 0) {
    setArchive('active')
    setOffset(0)
  }
  const query = new URLSearchParams({ archive, q, offset: String(offset) })
  if (groupId) query.set('groupId', groupId)
  if (personId) query.set('personId', personId)
  if (participant) query.set('participantId', participant.id)
  if (from) query.set('from', new Date(`${from}T00:00:00`).toISOString())
  if (to) query.set('to', new Date(`${to}T23:59:59.999`).toISOString())
  const { data, error, loading, reload } = useApi<Page<Entry>>(`/entries?${query}`)
  const toggleArchive = async (entry: Entry) => {
    setBusy(true); setArchiveError('')
    try {
      await api(`/entries/${entry.id}/archive`, { method: 'PATCH', body: { archived: !entry.archivedAt } })
      reload()
      reloadArchives()
    } catch (cause) { setArchiveError(errorMessage(cause)) } finally { setBusy(false) }
  }
  const setTag = async (entryId: string, tagId: string | null) => {
    setBusy(true); setArchiveError('')
    try {
      await api(`/entries/${entryId}/tag`, { method: 'PATCH', body: { tagId } })
      reload()
    } catch (cause) { setArchiveError(errorMessage(cause)) } finally { setBusy(false) }
  }
  const remove = async (id: string) => {
    if (busy) return
    setBusy(true)
    setDeleteError('')
    try {
      await api<{ success: boolean }>(`/entries/${id}`, { method: 'DELETE' })
      setDeletingId(null)
      if (data?.items.length === 1 && offset > 0) setOffset(0)
      reload()
      reloadArchives()
    } catch (error) { setDeleteError(errorMessage(error)) }
    finally { setBusy(false) }
  }
  return <section aria-label={t("Entry history")} className="space-y-4">
    {(archive === 'archived' || !!archivedEntries?.items.length) && <div className="flex gap-2" role="group" aria-label={t('Entry history')}>
      <button className={archive === 'active' ? 'primary' : 'secondary'} aria-pressed={archive === 'active'} onClick={() => { setArchive('active'); setOffset(0) }}>{t('Active entries')}</button>
      <button className={archive === 'archived' ? 'primary' : 'secondary'} aria-pressed={archive === 'archived'} onClick={() => { setArchive('archived'); setOffset(0) }}><Archive size={16} aria-hidden="true" />{t('Archives')}</button>
    </div>}
    {archive === 'archived' && <p className="muted text-sm">{t('Archived entries remain visible to members of their group.')}</p>}
    {archiveError && <p role="alert" className="error">{t(archiveError)}</p>}
    <label className="flex items-center gap-3"><Search size={18} className="muted" aria-hidden="true" /><span className="sr-only">{t("Search entries")}</span><input className="input-field" value={q} maxLength={200} placeholder={t("Search entries…")} onChange={event => { setQ(event.target.value); setOffset(0) }} /></label>
    <details className="rounded-lg border border-line p-4"><summary className="cursor-pointer text-sm font-medium"><Filter size={16} className="inline mr-2" aria-hidden="true" />{t("Filter history")}</summary><div className="mt-4 grid sm:grid-cols-2 gap-4">
      <label className="field-label sm:col-span-2">{t("Context")}<select aria-label={t("Context")} className="input-field" value={groupId} onChange={event => { setGroupId(event.target.value); setOffset(0) }}><option value="">{t("All accessible groups")}</option>{groupRows(groups).map(({ group }) => <option key={group.id} value={group.id}>{groupLabel(groups, group.id)}</option>)}</select></label>
      <label className="field-label">{t("From")}<input className="input-field" type="date" value={from} max={to || undefined} onChange={event => { setFrom(event.target.value); setOffset(0) }} /></label>
      <label className="field-label">{t("To")}<input className="input-field" type="date" value={to} min={from || undefined} onChange={event => { setTo(event.target.value); setOffset(0) }} /></label>
    </div><details className="mt-3"><summary className="text-sm cursor-pointer">{participant ? t('Participant: {{name}}', { name: participant.displayName }) : t("Filter by another participant")}</summary><div className="mt-3"><PersonPicker selected={participant ? [participant] : []} onChange={people => { setParticipant(people.at(-1) ?? null); setOffset(0) }} /></div></details>
      <button className="text-sm text-accent mt-4 inline-flex items-center gap-1 hover:underline" onClick={() => { setGroupId(initialGroupId); setQ(''); setFrom(''); setTo(''); setParticipant(null); setOffset(0) }}><X size={14} aria-hidden="true" />{t("Reset filters")}</button>
    </details>
    {loading && <p role="status" className="muted">{t("Loading entries…")}</p>}
    {error && <p role="alert" className="error">{t(error)}<button className="underline ml-2" onClick={reload}>{t("Retry")}</button></p>}
    {data && <>{data.items.length ? <div className="space-y-4">{data.items.map(entry => <article key={entry.id} className="card relative">
      {entry.tag && <span className="absolute left-0 top-3 bottom-3 w-1 rounded-full" style={{ backgroundColor: entry.tag.color }} aria-hidden="true" />}
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center flex-wrap gap-2 text-xs muted mb-3"><CalendarDays size={14} aria-hidden="true" /><time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })}</time><span>· {entry.creatorName}</span></div><h3 className="text-lg font-semibold break-words">{entry.title}</h3></div>{entry.canEdit && <button className="secondary shrink-0 p-2" aria-label={t('Edit {{title}}', { title: entry.title })} onClick={() => onEdit(entry)}><Pencil size={16} aria-hidden="true" /></button>}</div>
      <p className="badge mt-3 inline-flex gap-1 items-center max-w-full break-words">{groups.find(group => group.id === entry.groupId)?.isPrivate && <LockKeyhole size={12} className="shrink-0" aria-hidden="true" />}{groupLabel(groups, entry.groupId)}</p>
      <div className="mt-3">
        <button type="button" className="inline-flex items-center gap-2 min-h-11 max-w-full rounded-lg border border-line px-3 py-2 text-sm hover:bg-hover" aria-expanded={tagEntryId === entry.id} onClick={() => setTagEntryId(tagEntryId === entry.id ? null : entry.id)}>
          {entry.tag && <span className="size-3 shrink-0 rounded-full border border-strongline" style={{ backgroundColor: entry.tag.color }} aria-hidden="true" />}<span className="break-words min-w-0">{entry.tag?.name ?? t('Add tag')}</span>
        </button>
        {tagEntryId === entry.id && <div className="mt-3 border border-line rounded-lg p-4"><TagPicker selected={entry.tag} disabled={busy} onChange={tag => { void setTag(entry.id, tag?.id ?? null) }} /></div>}
      </div>
      <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap break-words">{entry.body}</p>
      {!!entry.people.length && <div className="mt-4 flex flex-wrap gap-2">{entry.people.map(person => <button key={person.id} className="text-xs border border-line rounded-full px-3 py-1 hover:(bg-soft border-strongline)" onClick={() => onPerson(person.id)}>{person.displayName}</button>)}</div>}
      {entry.canEdit && <button className="secondary mt-4 text-sm" disabled={busy} onClick={() => { void toggleArchive(entry) }}>{entry.archivedAt ? <ArchiveRestore size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}{t(entry.archivedAt ? 'Restore entry' : 'Archive entry')}</button>}
      <EntryReminders entryId={entry.id} canCreate={entry.canEdit} />
      {entry.canEdit && <div className="mt-4 border-t border-line pt-4">
        {deletingId === entry.id ? <fieldset disabled={busy} className="space-y-3">
          <p className="text-sm">{t('Permanently delete {{name}}?', { name: entry.title })}</p>
          <p className="muted text-sm">{t('This entry and all its reminders will be permanently deleted. Linked contacts will be kept.')}</p>
          <div className="flex flex-wrap gap-3"><button type="button" className="secondary text-errorink" onClick={() => { void remove(entry.id) }}><Trash2 size={16} aria-hidden="true" />{t('Confirm deletion')}</button><button type="button" className="secondary" onClick={() => { setDeletingId(null); setDeleteError('') }}>{t('Cancel')}</button></div>
          {busy && <p role="status" className="muted text-sm">{t('Deleting…')}</p>}
          {deleteError && <p role="alert" className="error">{t(deleteError)}</p>}
        </fieldset> : <button type="button" className="secondary text-errorink" disabled={busy} aria-label={t('Delete {{name}}', { name: entry.title })} onClick={() => { setDeletingId(entry.id); setDeleteError('') }}><Trash2 size={16} aria-hidden="true" />{t('Delete entry')}</button>}
      </div>}
    </article>)}</div> : <div className="border border-dashed border-strongline rounded-xl text-center p-10"><FileText size={32} className="mx-auto text-icon" aria-hidden="true" /><h3 className="font-semibold mt-4">{t("No entries in this view")}</h3><p className="muted text-sm mt-2">{t("Add your first memory, or adjust the filters.")}</p></div>}<Pagination offset={offset} nextOffset={data.nextOffset} onChange={setOffset} /></>}
  </section>
}
