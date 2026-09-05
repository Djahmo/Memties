import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderOpen, LockKeyhole } from 'lucide-react'
import type { Group } from '../../types/api'

export const GroupTree = ({ groups, selectedId, onSelect }: { groups: Group[]; selectedId: string | null; onSelect: (id: string) => void }) => {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(new Set<string>())
  const children = new Map<string | null, Group[]>()
  for (const group of groups) {
    const siblings = children.get(group.parentId) ?? []
    siblings.push(group)
    children.set(group.parentId, siblings)
  }
  for (const siblings of children.values()) siblings.sort((a, b) => Number(b.isPersonal) - Number(a.isPersonal) || a.name.localeCompare(b.name))
  const pending = [...(children.get(null) ?? [])].reverse().map(group => ({ group, depth: 0 }))
  const rows: { group: Group; depth: number }[] = []
  while (pending.length) {
    const row = pending.pop()!
    rows.push(row)
    if (!collapsed.has(row.group.id)) for (const child of [...(children.get(row.group.id) ?? [])].reverse()) pending.push({ group: child, depth: row.depth + 1 })
  }
  return <nav aria-label={t("Groups")} className="space-y-1 overflow-x-auto py-2">{rows.map(({ group, depth }) => <div key={group.id} className={`flex items-center rounded-lg ${group.id === selectedId ? 'bg-selected' : 'hover:bg-hover'}`}>
    {Array.from({ length: depth }, (_, index) => <span key={index} className="w-4.5 shrink-0" />)}
    {children.has(group.id) ? <button className="p-2 shrink-0" aria-label={`${collapsed.has(group.id) ? t("Expand") : t("Collapse")} ${group.name}`} aria-expanded={!collapsed.has(group.id)} onClick={() => setCollapsed(previous => { const next = new Set(previous); if (next.has(group.id)) next.delete(group.id); else next.add(group.id); return next })}>{collapsed.has(group.id) ? <ChevronRight size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}</button> : <span className="w-8 shrink-0" />}
    <button className="flex-1 text-left py-3 pr-3 min-w-36 flex gap-2 items-center" aria-current={group.id === selectedId ? 'page' : undefined} onClick={() => onSelect(group.id)}>{group.isPrivate ? <LockKeyhole size={18} className="shrink-0 text-icon" aria-hidden="true" /> : group.id === selectedId ? <FolderOpen size={18} className="shrink-0 text-icon" aria-hidden="true" /> : <Folder size={18} className="shrink-0 text-icon" aria-hidden="true" />}<span className="break-words">{group.name}</span>{group.isPersonal && <span className="ml-auto text-xs muted">{t("Private")}</span>}</button>
  </div>)}</nav>
}
