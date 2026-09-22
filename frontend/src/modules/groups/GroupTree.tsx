import { useTranslation } from 'react-i18next'
import { Fragment, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderOpen, LockKeyhole, Plus, Settings } from 'lucide-react'
import type { Group } from '../../types/api'
import { api, errorMessage } from '../../services/api'
import { InlineGroup } from './InlineGroup'
import { MoveGroupDialog } from './MoveGroupDialog'
import { canMoveGroup, compareGroups, previewGroupMove, projectGroupDrop } from './groupDrag'
import type { GroupDrop, GroupRow } from './groupDrag'
import './GroupTree.css'

export const GroupTree = ({ groups, selectedId, onSelect, onEdit, onCreated, onMoved }: {
  groups: Group[]
  selectedId: string | null
  onSelect: (id: string) => void
  onEdit: (group: Group) => void
  onCreated: (group: Group) => void
  onMoved: (group: Group) => void
}) => {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(new Set<string>())
  const [creating, setCreating] = useState<{ parentId: string | null } | null>(null)
  const [dragged, setDragged] = useState<Group | null>(null)
  const [target, setTarget] = useState<GroupDrop | null>(null)
  const [move, setMove] = useState<{ group: Group; target: GroupDrop } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const savingRef = useRef(false)
  const dragImage = useRef<HTMLCanvasElement>(null)
  const [sourceHeight, setSourceHeight] = useState(48)

  useEffect(() => {
    if (!dragged || !target?.parentId) return
    const parentId = target.parentId
    const timer = window.setTimeout(() => setCollapsed(previous => {
      if (!previous.has(parentId)) return previous
      const next = new Set(previous)
      next.delete(parentId)
      return next
    }), 500)
    return () => window.clearTimeout(timer)
  }, [dragged, target?.parentId])

  const reveal = (group: Group) => {
    setCollapsed(previous => {
      const next = new Set(previous)
      let ancestor = group.parentId
      while (ancestor) {
        next.delete(ancestor)
        ancestor = groups.find(item => item.id === ancestor)?.parentId ?? null
      }
      return next
    })
    onMoved(group)
  }

  const reorder = async (group: Group, destination: GroupDrop) => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError('')
    onMoved(previewGroupMove(groups, group, destination))
    try {
      onMoved((await api<{ group: Group }>(`/groups/${group.id}/move`, {
        method: 'POST', body: { parentId: destination.parentId, beforeId: destination.beforeId },
      })).group)
    } catch (cause) {
      onMoved(group)
      setError(errorMessage(cause))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const drop = () => {
    if (dragged && target) {
      if (dragged.parentId === target.parentId) void reorder(dragged, target)
      else setMove({ group: dragged, target })
    }
    setDragged(null)
    setTarget(null)
  }

  const startCreate = (parentId: string | null) => {
    setCreating({ parentId })
    if (parentId) setCollapsed(previous => {
      const next = new Set(previous)
      next.delete(parentId)
      return next
    })
  }
  const created = (group: Group) => {
    setCreating(current => current === creating ? null : current)
    onCreated(group)
  }
  const children = new Map<string | null, Group[]>()
  for (const group of groups) {
    const siblings = children.get(group.parentId) ?? []
    siblings.push(group)
    children.set(group.parentId, siblings)
  }
  for (const siblings of children.values()) siblings.sort(compareGroups)
  const pending = [...(children.get(null) ?? [])].reverse().map(group => ({ group, depth: 0 }))
  const rows: GroupRow[] = []
  while (pending.length) {
    const row = pending.pop()!
    rows.push(row)
    if (!collapsed.has(row.group.id)) {
      for (const child of [...(children.get(row.group.id) ?? [])].reverse()) pending.push({ group: child, depth: row.depth + 1 })
    }
  }

  const hoverRow = (event: DragEvent<HTMLDivElement>, index: number) => {
    if (!dragged) return
    event.preventDefault()
    const bounds = event.currentTarget.getBoundingClientRect()
    const offset = (event.clientY - bounds.top) / bounds.height
    const projected = projectGroupDrop(groups, rows, index, offset < 0.25 ? 'before' : offset > 0.75 ? 'after' : 'inside', dragged)
    event.dataTransfer.dropEffect = projected ? 'move' : 'none'
    setTarget(previous => previous?.parentId === projected?.parentId && previous?.beforeId === projected?.beforeId && previous?.index === projected?.index ? previous : projected)
  }

  const ghost = () => dragged && target && <div
    className="group-tree-ghost flex items-center gap-2 rounded-lg pr-3"
    style={{ minHeight: sourceHeight, paddingLeft: target.depth * 18 + 32 }}
    aria-hidden="true"
    onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }}
    onDrop={event => { event.preventDefault(); event.stopPropagation(); drop() }}
  >
    <Folder size={18} className="shrink-0" style={{ color: dragged.color }} />
    <span className="min-w-0 break-words">{dragged.name}</span>
  </div>

  return <nav aria-label={t('Groups')} aria-busy={saving} className="space-y-1 overflow-x-auto py-2" onDragLeave={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTarget(null)
  }}>
    <canvas ref={dragImage} width={1} height={1} aria-hidden="true" className="fixed top-0 left-0 pointer-events-none" />
    {move && <MoveGroupDialog group={move.group} destination={groups.find(group => group.id === move.target.parentId) ?? null} beforeId={move.target.beforeId} onCancel={() => setMove(null)} onMoved={group => {
      setMove(null)
      reveal(group)
    }} />}
    <div className="flex justify-between items-center mb-4">
      <h2 className="eyebrow">{t('Your groups')}</h2>
      <button className="p-2 rounded-lg hover:bg-hover" aria-label={t('New group')} title={t('New group')} onClick={() => startCreate(null)}><Plus size={16} aria-hidden="true" /></button>
    </div>
    {error && <p className="error text-sm" role="alert">{t(error)}</p>}
    {creating?.parentId === null && <InlineGroup parentId={null} depth={0} onSaved={created} onCancel={() => setCreating(null)} />}
    {rows.map(({ group, depth }, index) => <Fragment key={group.id}>
      {target?.index === index && ghost()}
      <div
        data-selected={group.id === selectedId}
        data-dragging={dragged?.id === group.id}
        data-drop-target={target?.parentId === group.id}
        draggable={group.role === 'owner' && !group.isPersonal && !creating && !saving}
        onDragStart={event => {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', group.id)
          setSourceHeight(event.currentTarget.getBoundingClientRect().height)
          if (dragImage.current) event.dataTransfer.setDragImage(dragImage.current, 0, 0)
          setDragged(group)
          setTarget(null)
          setError('')
        }}
        onDragEnd={() => { setDragged(null); setTarget(null) }}
        onDragOver={event => hoverRow(event, index)}
        onDrop={event => { event.preventDefault(); drop() }}
        className={`group-tree-row flex items-center rounded-lg ${group.id === selectedId ? 'bg-selected' : 'hover:bg-hover'}`}
      >
        {Array.from({ length: depth }, (_, indent) => <span key={indent} className="w-4.5 shrink-0" />)}
        {children.has(group.id) ? <button className="p-2 shrink-0" aria-label={`${collapsed.has(group.id) ? t('Expand') : t('Collapse')} ${group.name}`} aria-expanded={!collapsed.has(group.id)} onClick={() => setCollapsed(previous => {
          const next = new Set(previous)
          if (next.has(group.id)) next.delete(group.id)
          else next.add(group.id)
          return next
        })}>{collapsed.has(group.id) ? <ChevronRight size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}</button> : <span className="w-8 shrink-0" />}
        <button className="flex-1 text-left py-3 pr-2 min-w-0 flex gap-2 items-center" aria-current={group.id === selectedId ? 'page' : undefined} onClick={() => onSelect(group.id)}>
          <span className="shrink-0" style={{ color: group.color }}>{group.isPrivate ? <LockKeyhole size={18} aria-hidden="true" /> : group.id === selectedId ? <FolderOpen size={18} aria-hidden="true" /> : <Folder size={18} aria-hidden="true" />}</span>
          <span className="break-words min-w-0">{group.name}</span>
        </button>
        {group.role === 'owner' && <div className="group-tree-actions flex items-center shrink-0 pr-1">
          {!group.isPersonal && <button className="p-2 rounded-lg hover:bg-hover" aria-label={`${t('Group settings')} — ${group.name}`} title={t('Group settings')} onClick={() => onEdit(group)}><Settings size={15} aria-hidden="true" /></button>}
          <button className="p-2 rounded-lg hover:bg-hover" aria-label={`${t('Add subgroup')} — ${group.name}`} title={t('Add subgroup')} onClick={() => startCreate(group.id)}><Plus size={16} aria-hidden="true" /></button>
        </div>}
      </div>
      {creating?.parentId === group.id && <InlineGroup parentId={group.id} depth={depth + 1} onSaved={created} onCancel={() => setCreating(null)} />}
    </Fragment>)}
    {target?.index === rows.length && ghost()}
    {dragged && canMoveGroup(groups, dragged, null) && <div className="rounded-lg border border-dashed border-line p-3 text-sm muted" onDragOver={event => {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setTarget({ parentId: null, beforeId: null, index: rows.length, depth: 0 })
    }} onDrop={event => { event.preventDefault(); drop() }}>{t('Drop here to move to root')}</div>}
  </nav>
}
