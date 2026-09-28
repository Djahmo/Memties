import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { Search, UsersRound, UserRound } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import type { Page, Person } from '../../types/api'
import { Pagination } from '../../components/Pagination'
import { api, errorMessage } from '../../services/api'

export const PeopleList = ({ groupId, onSelect }: { groupId: string; onSelect: (person: Person) => void }) => {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const [direct, setDirect] = useState(false)
  const [offset, setOffset] = useState(0)
  const [directRevision, setDirectRevision] = useState(0)
  const [directResult, setDirectResult] = useState<{ key: string; items?: Person[]; error?: string }>({ key: '' })
  const requestKey = JSON.stringify([groupId, q, directRevision])
  const { data: serverData, error: serverError, loading: serverLoading, reload } = useApi<Page<Person>>(`/people?${new URLSearchParams({ groupId, q, offset: String(direct ? 0 : offset) })}`)

  useEffect(() => {
    if (!direct) return
    const controller = new AbortController()
    void (async () => {
      const items: Person[] = []
      let pageOffset: number | null = 0
      try {
        while (pageOffset !== null) {
          const page: Page<Person> = await api(`/people?${new URLSearchParams({ groupId, q, offset: String(pageOffset), limit: '100' })}`, { signal: controller.signal })
          items.push(...page.items)
          pageOffset = page.nextOffset
        }
        if (!controller.signal.aborted) setDirectResult({ key: requestKey, items: items.filter(person => person.groupIds.includes(groupId)) })
      } catch (cause) {
        if (!controller.signal.aborted) setDirectResult({ key: requestKey, error: errorMessage(cause) })
      }
    })()
    return () => controller.abort()
  }, [direct, groupId, q, requestKey])

  const directPeople = directResult.key === requestKey ? directResult.items : undefined
  const data = direct ? directPeople && { items: directPeople.slice(offset, offset + 30), nextOffset: offset + 30 < directPeople.length ? offset + 30 : null } : serverData
  const error = direct ? directResult.key === requestKey ? directResult.error : undefined : serverError
  const loading = direct ? !data && !error : serverLoading
  return <section aria-label={t("People in this group")}>
    <label className="flex items-center gap-3 mb-5"><Search size={18} className="muted" aria-hidden="true" /><span className="sr-only">{t("Search people")}</span><input className="input-field" placeholder={t("Search names, organizations, roles…")} value={q} maxLength={200} onChange={event => { setQ(event.target.value); setOffset(0) }} /></label>
    <button type="button" role="switch" aria-checked={direct} className="flex items-center gap-3 text-sm mb-5" onClick={() => { setDirect(value => !value); setDirectResult({ key: '' }); setOffset(0) }}>
      <span aria-hidden="true" className={`relative w-10 h-6 rounded-full transition-colors ${direct ? 'bg-brand' : 'bg-strongline'}`}><span className={`absolute top-1 left-1 size-4 rounded-full bg-white transition-transform ${direct ? 'translate-x-4' : ''}`} /></span>
      {t('Only contacts directly in this group')}
    </button>
    {loading && <p role="status" className="muted">{t("Loading people…")}</p>}
    {error && <p role="alert" className="error">{t(error)}<button className="underline ml-2" onClick={() => { if (direct) setDirectRevision(value => value + 1); else reload() }}>{t("Retry")}</button></p>}
    {data && <>{data.items.length ? <div className="grid xl:grid-cols-2 gap-3">{data.items.map(person => <button key={person.id} className="card flex gap-4 text-left hover:(border-strongline bg-hover)" onClick={() => onSelect(person)}><span className="size-11 rounded-full bg-badge flex items-center justify-center shrink-0"><UserRound size={21} className="text-icon" aria-hidden="true" /></span><span className="min-w-0"><span className="block font-semibold break-words">{person.displayName}</span><span className="block text-sm muted break-words">{[person.jobTitle, person.organization].filter(Boolean).join(' · ') || person.email || t("Contact")}</span></span></button>)}</div> : <div className="border border-dashed border-strongline rounded-xl text-center p-10"><UsersRound size={32} className="mx-auto text-icon" aria-hidden="true" /><h3 className="font-semibold mt-4">{q ? t("No matching people") : t("Start with someone you know")}</h3><p className="muted text-sm mt-2">{q ? t("Try another name, organization, or role.") : direct ? t("Add a contact directly to this group.") : t("Add a contact to this group or one of its subgroups.")}</p></div>}<Pagination offset={offset} nextOffset={data.nextOffset} onChange={setOffset} /></>}
  </section>
}
