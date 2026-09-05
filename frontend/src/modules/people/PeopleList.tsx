import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Search, UsersRound, UserRound } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import type { Page, Person } from '../../types/api'
import { Pagination } from '../../components/Pagination'

export const PeopleList = ({ groupId, onSelect }: { groupId: string; onSelect: (person: Person) => void }) => {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const [offset, setOffset] = useState(0)
  const { data, error, loading, reload } = useApi<Page<Person>>(`/people?${new URLSearchParams({ groupId, q, offset: String(offset) })}`)
  return <section aria-label={t("People in this group")}>
    <label className="flex items-center gap-3 mb-5"><Search size={18} className="muted" aria-hidden="true" /><span className="sr-only">{t("Search people")}</span><input className="input-field" placeholder={t("Search names, organizations, roles…")} value={q} maxLength={200} onChange={event => { setQ(event.target.value); setOffset(0) }} /></label>
    {loading && <p role="status" className="muted">{t("Loading people…")}</p>}
    {error && <p role="alert" className="error">{t(error)}<button className="underline ml-2" onClick={reload}>{t("Retry")}</button></p>}
    {data && <>{data.items.length ? <div className="grid xl:grid-cols-2 gap-3">{data.items.map(person => <button key={person.id} className="card flex gap-4 text-left hover:(border-strongline bg-hover)" onClick={() => onSelect(person)}><span className="size-11 rounded-full bg-badge flex items-center justify-center shrink-0"><UserRound size={21} className="text-icon" aria-hidden="true" /></span><span className="min-w-0"><span className="block font-semibold break-words">{person.displayName}</span><span className="block text-sm muted break-words">{[person.jobTitle, person.organization].filter(Boolean).join(' · ') || person.email || t("Contact")}</span></span></button>)}</div> : <div className="border border-dashed border-strongline rounded-xl text-center p-10"><UsersRound size={32} className="mx-auto text-icon" aria-hidden="true" /><h3 className="font-semibold mt-4">{q ? t("No matching people") : t("Start with someone you know")}</h3><p className="muted text-sm mt-2">{q ? t("Try another name, organization, or role.") : t("Add a contact to this group or one of its subgroups.")}</p></div>}<Pagination offset={offset} nextOffset={data.nextOffset} onChange={setOffset} /></>}
  </section>
}
