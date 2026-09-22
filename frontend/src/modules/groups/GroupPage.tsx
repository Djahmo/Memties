import { useTranslation } from 'react-i18next'
import { Bell, ShieldCheck } from 'lucide-react'
import { disablePush } from '../reminders/push'
import { ReminderList } from '../reminders/ReminderList'
import { useEffect, useState } from 'react'
import { ChevronRight, FilePlus2, FileText, LockKeyhole, LogOut, Network, Share2, UserPlus, UsersRound } from 'lucide-react'
import { api, errorMessage } from '../../services/api'
import type { Entry, Group, Person, User } from '../../types/api'
import { GroupTree } from './GroupTree'
import { MobileGroups } from './MobileGroups'
import { GroupForm } from './GroupForm'
import { PeopleList } from '../people/PeopleList'
import { PersonForm } from '../people/PersonForm'
import { ContactImport } from '../people/ContactImport'
import { PersonDetail } from '../people/PersonDetail'
import { EntryForm } from '../entries/EntryForm'
import { EntryTimeline } from '../entries/EntryTimeline'
import type { SelectedPerson } from '../people/PersonPicker'

import { PreferencesButton } from '../../components/PreferencesButton'
import { SharingPanel } from './SharingPanel'
type View = { kind: 'group' } | { kind: 'person'; id: string } | { kind: 'person-form'; existing?: Person } | { kind: 'sharing' }
  | { kind: 'entry-form'; person?: SelectedPerson; entry?: Entry; returnPersonId?: string }
const tabs = [{ id: 'entries', name: 'Entries', Icon: FileText }, { id: 'people', name: 'People', Icon: UsersRound }, { id: 'reminders', name: 'Reminders', Icon: Bell }] as const

export const GroupPage = ({ user, onLogout, onAdmin }: { user: User; onLogout: () => void; onAdmin: () => void }) => {
  const { t } = useTranslation()
  const [rawGroups, setGroups] = useState<Group[]>([])
  const groups = rawGroups.map(group => group.isPersonal ? { ...group, name: t('Personal') } : group)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<Group | null>(null)
  const [view, setView] = useState<View>({ kind: 'group' })
  const [tab, setTab] = useState<'entries' | 'people' | 'reminders'>('entries')
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [signingOut, setSigningOut] = useState(false)
  const [notice, setNotice] = useState('')
  const selected = groups.find(group => group.id === selectedId)
  useEffect(() => {
    let active = true
    api<Group[]>('/groups').then(value => {
      if (!active) return
      setGroups(value)
      setSelectedId(current => (value.some(group => group.id === current) ? current : null) ?? value.find(group => group.isPersonal)?.id ?? value[0]?.id ?? null)
    }).catch((error: unknown) => { if (active) setError(errorMessage(error)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [attempt])
  const logout = async () => {
    setSigningOut(true)
    try { await disablePush(); await api<{ success: boolean }>('/auth/logout', { method: 'POST' }); onLogout() } catch (error) { setError(errorMessage(error)); setSigningOut(false) }
  }
  const selectGroup = (id: string) => { setSelectedId(id); setForm(null); setView({ kind: 'group' }); setNotice('') }
  const saveGroup = (group: Group) => {
    setGroups(current => [...current.filter(item => item.id !== group.id), group])
    setSelectedId(group.id); setNotice(form ? 'Group updated.' : 'Group created.'); setForm(null); setView({ kind: 'group' })
  }
  const moveGroup = (moved: Group) => {
    setGroups(current => {
      const descendants = new Set([moved.id])
      const pending = [moved.id]
      while (pending.length) {
        const parentId = pending.pop()
        for (const group of current) {
          if (group.parentId === parentId && !descendants.has(group.id)) {
            descendants.add(group.id)
            pending.push(group.id)
          }
        }
      }
      return current.map(group => group.id === moved.id ? moved : descendants.has(group.id) ? { ...group, isPrivate: moved.isPrivate } : group)
    })
  }
  const editEntry = (entry: Entry) => setView({ kind: 'entry-form', entry, returnPersonId: view.kind === 'person' ? view.id : undefined })
  const cancelEntry = () => setView(view.kind === 'entry-form' && view.returnPersonId ? { kind: 'person', id: view.returnPersonId } : { kind: 'group' })
  const savedEntry = (entry: Entry) => {
    setSelectedId(entry.groupId); setRevision(value => value + 1); setNotice('Entry saved.'); setTab('entries')
    cancelEntry()
  }
  const breadcrumbs: Group[] = []
  let ancestor = selected
  while (ancestor) { breadcrumbs.unshift(ancestor); ancestor = groups.find(group => group.id === ancestor?.parentId) }
  return <div className="min-h-screen flex flex-col">
    <header className="h-16 sm:h-20 px-4 sm:px-6 lg:px-10 bg-surface border-b border-line flex items-center justify-between gap-4"><a href="/" className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-accent"><Network size={26} aria-hidden="true" />Memties</a><div className="flex items-center gap-2 sm:gap-4"><span className="text-sm hidden sm:block">{user.displayName}</span>{user.role === 'admin' && <button className="secondary text-sm" aria-label={t('Administration')} title={t('Administration')} onClick={onAdmin}><ShieldCheck size={16} aria-hidden="true" /><span className="hidden sm:inline">{t('Administration')}</span></button>}<PreferencesButton authenticated /><button className="secondary text-sm" aria-label={t('Sign out')} disabled={signingOut} onClick={logout}><LogOut size={16} aria-hidden="true" /><span className="hidden sm:inline">{signingOut ? t("Signing out…") : t("Sign out")}</span></button></div></header>
    <div className="flex-1 grid lg:grid-cols-[minmax(260px,1fr)_2fr]">
      <aside className="hidden lg:block bg-subtle border-r border-line p-7 min-w-0">
        {loading ? <p role="status" className="muted p-3">{t("Loading your groups…")}</p> : !error && <GroupTree groups={groups} selectedId={selectedId} onSelect={selectGroup} onEdit={setForm} onCreated={saveGroup} onMoved={moveGroup} />}
        <p className="text-xs muted border-t border-line mt-8 pt-5 leading-relaxed">{t("Groups give your relationships context.")}<br />{t("Your Personal vault is always private.")}</p>
      </aside>
      <main className="p-4 sm:p-6 lg:p-10 min-w-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mb-5 lg:hidden"><MobileGroups groups={groups} selectedId={selectedId} loading={loading || !!error} onSelect={selectGroup} onEdit={setForm} onCreated={saveGroup} onMoved={moveGroup} /></div>
        {error && <div className="error mb-6" role="alert">{t(error)}<button className="underline ml-3" onClick={() => { setError(''); setLoading(true); setAttempt(value => value + 1) }}>{t("Retry")}</button></div>}
        {notice && <p className="text-sm text-accent mb-5" role="status">{t(notice)}</p>}
        {form && <GroupForm key={form.id} existing={form} onSaved={saveGroup} onCancel={() => setForm(null)} />}
        {selected && <>
          {view.kind === 'person-form' ? <PersonForm groups={groups} groupId={selected.id} existing={view.existing} onSaved={person => { setView({ kind: 'person', id: person.id }); setRevision(value => value + 1); setNotice('Contact saved.') }} onCancel={() => setView({ kind: 'group' })} />
            : view.kind === 'sharing' && selected.role === 'owner' && !selected.isPrivate ? <SharingPanel key={selected.id} group={selected} onBack={() => setView({ kind: 'group' })} onChanged={() => { setAttempt(value => value + 1); setRevision(value => value + 1) }} /> : view.kind === 'entry-form' ? <EntryForm key={view.entry?.id ?? 'new'} groups={groups} groupId={selected.id} person={view.person} existing={view.entry} onSaved={savedEntry} onCancel={cancelEntry} />
            : view.kind === 'person' ? <PersonDetail key={`${view.id}:${selected.id}:${revision}`} id={view.id} groupId={selected.id} groups={groups} onBack={() => setView({ kind: 'group' })} onEntry={person => setView({ kind: 'entry-form', person, returnPersonId: person.id })} onEdit={person => setView({ kind: 'person-form', existing: person })} onEditEntry={editEntry} onPerson={id => setView({ kind: 'person', id })} />
            : <>
              <nav aria-label={t("Breadcrumb")} className="flex gap-2 flex-wrap text-sm muted mb-7">{breadcrumbs.map((group, index) => <span key={group.id} className="inline-flex items-center gap-2">{index > 0 && <ChevronRight size={14} aria-hidden="true" />}<button className="hover:underline" onClick={() => selectGroup(group.id)}>{group.name}</button></span>)}</nav>
              <div className="min-w-0"><span className="badge inline-flex items-center gap-1.5">{selected.isPrivate && <LockKeyhole size={12} aria-hidden="true" />}{selected.isPrivate ? t("Private vault") : t('{{role}} access', { role: t(selected.role) })}</span><h1 className="text-3xl md:text-4xl font-semibold tracking-tight mt-4 break-words">{selected.name}</h1></div>
              {selected.role === 'owner' && !selected.isPrivate && <button className="secondary mt-4" onClick={() => setView({ kind: 'sharing' })}><Share2 size={17} aria-hidden="true" />{t("Share group")}</button>}<p className="muted mt-4 max-w-xl whitespace-pre-wrap break-words">{selected.description || (selected.isPrivate ? t("A space just for you. Entries organized here stay within your private vault.") : t("Keep the people and context of this part of your life together."))}</p>
              {selected.role !== 'viewer' && <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3 mt-5"><button className="primary text-sm" onClick={() => setView({ kind: 'entry-form' })}><FilePlus2 size={17} aria-hidden="true" />{t("New entry")}</button><button className="secondary text-sm" onClick={() => setView({ kind: 'person-form' })}><UserPlus size={17} aria-hidden="true" />{t("Add contact")}</button></div>}
              <nav aria-label={t("Group content")} className="grid grid-cols-3 gap-1 border-b border-line mt-6 sm:mt-8 mb-5">{tabs.map(({ id, name, Icon }) => <button key={id} className={`flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-2 px-1 sm:px-3 py-3 text-xs sm:text-sm border-b-2 ${tab === id ? 'border-accent text-accent font-semibold' : 'border-transparent muted hover:text-accent'}`} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}><Icon size={16} aria-hidden="true" />{t(name)}</button>)}</nav>
              {tab === 'people' && <>{selected.role !== 'viewer' && <ContactImport key={selected.id} groupId={selected.id} onImported={() => setRevision(value => value + 1)} />}<PeopleList key={`${selected.id}:${revision}`} groupId={selected.id} onSelect={person => setView({ kind: 'person', id: person.id })} /></>}
              {tab === 'entries' && <EntryTimeline key={`${selected.id}:${revision}`} groups={groups} initialGroupId={selected.id} onEdit={editEntry} onPerson={id => setView({ kind: 'person', id })} />}
              {tab === 'reminders' && <ReminderList key={selected.id} groupId={selected.id} />}
            </>}
        </>}
      </main>
    </div>
  </div>
}
