import { useTranslation } from 'react-i18next'
import { ArrowLeft, Building2, FilePlus2, Mail, Pencil, Phone, UserRound } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import type { Entry, Group, Person } from '../../types/api'
import { groupLabel } from '../groups/groupLabels'
import { EntryTimeline } from '../entries/EntryTimeline'

export const PersonDetail = ({ id, groupId, groups, onBack, onEntry, onEditEntry, onPerson, onEdit }: {
  id: string; groupId: string; groups: Group[]; onBack: () => void; onEntry: (person: Person) => void; onEditEntry: (entry: Entry) => void; onPerson: (id: string) => void; onEdit: (person: Person) => void
}) => {
  const { t } = useTranslation()
  const { data: person, loading, error, reload } = useApi<Person>(`/people/${id}`)
  return <section><button className="text-sm inline-flex items-center gap-2 text-accent mb-6 hover:underline" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />{t("Back to group")}</button>
    {loading && <p role="status" className="muted">{t("Loading contact…")}</p>}
    {error && <p role="alert" className="error">{t(error)}<button className="underline ml-2" onClick={reload}>{t("Retry")}</button></p>}
    {person && <><div className="flex items-start justify-between flex-wrap gap-4"><div className="flex items-center gap-4"><span className="size-14 rounded-full bg-badge flex items-center justify-center shrink-0"><UserRound size={28} className="text-icon" aria-hidden="true" /></span><div><h1 className="text-3xl font-semibold break-words">{person.displayName}</h1>{person.nickname && <p className="muted text-sm">{person.nickname}</p>}</div></div>{groups.find(group => group.id === groupId)?.role !== 'viewer' && <button className="primary" onClick={() => onEntry(person)}><FilePlus2 size={18} aria-hidden="true" />{t("Add entry")}</button>}</div>
      {!person.canEdit && <p className="muted text-xs mt-4">{t('Editing requires write access to every group containing this contact.')}</p>}{person.canEdit && <button className="secondary mt-4" onClick={() => onEdit(person)}><Pencil size={16} aria-hidden="true" />{t("Edit contact")}</button>}<dl className="mt-6 space-y-2 text-sm">{(person.firstName || person.lastName) && <div><dt className="sr-only">{t("Full name")}</dt><dd>{[person.firstName, person.lastName].filter(Boolean).join(' ')}</dd></div>}{(person.organization || person.jobTitle) && <div><dt className="sr-only">{t("Work")}</dt><dd className="flex items-center gap-2"><Building2 size={16} className="muted shrink-0" aria-hidden="true" />{[person.jobTitle, person.organization].filter(Boolean).join(' · ')}</dd></div>}{person.email && <div><dt className="sr-only">{t("Email")}</dt><dd className="flex items-center gap-2"><Mail size={16} className="muted shrink-0" aria-hidden="true" /><a className="hover:underline break-all" href={`mailto:${person.email}`}>{person.email}</a></dd></div>}{person.phone && <div><dt className="sr-only">{t("Phone")}</dt><dd className="flex items-center gap-2"><Phone size={16} className="muted shrink-0" aria-hidden="true" /><span>{person.phone}</span></dd></div>}</dl>
      <div className="flex flex-wrap gap-2 mt-5">{person.groupIds.map(id => <span className="badge" key={id}>{groupLabel(groups, id)}</span>)}</div>
      {person.notes && <div className="rounded-lg bg-subtle p-4 text-sm whitespace-pre-wrap break-words mt-5">{person.notes}</div>}
      <h2 className="text-xl font-semibold mt-9 mb-3">{t("History")}</h2><EntryTimeline groups={groups} initialGroupId={groupId} personId={person.id} onEdit={onEditEntry} onPerson={onPerson} />
    </>}
  </section>
}
