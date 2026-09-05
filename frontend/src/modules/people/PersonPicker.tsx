import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'
import { useId, useState } from 'react'
import { useApi } from '../../hooks/useApi'
import type { Page, Person } from '../../types/api'
import { Pagination } from '../../components/Pagination'

export type SelectedPerson = { id: string; displayName: string }
export const PersonPicker = ({ selected, onChange }: { selected: SelectedPerson[]; onChange: (people: SelectedPerson[]) => void }) => {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const [offset, setOffset] = useState(0)
  const heading = useId()
  const { data, error, loading, reload } = useApi<Page<Person>>(`/people?${new URLSearchParams({ q, offset: String(offset), limit: '10' })}`)
  return <section aria-labelledby={heading} className="space-y-3">
    <h3 id={heading} className="field-label">{t("People")} <span className="muted font-normal">{t("(optional)")}</span></h3>
    {!!selected.length && <div className="flex flex-wrap gap-2">{selected.map(person => <button type="button" key={person.id} className="badge inline-flex items-center gap-2" aria-label={t('Remove {{name}}', { name: person.displayName })} onClick={() => onChange(selected.filter(item => item.id !== person.id))}>{person.displayName}<X size={14} aria-hidden="true" /></button>)}</div>}
    <label className="flex items-center gap-2"><Search size={17} className="muted" aria-hidden="true" /><span className="sr-only">{t("Find participants")}</span><input className="input-field" placeholder={t("Search your contacts…")} value={q} maxLength={200} onChange={event => { setQ(event.target.value); setOffset(0) }} /></label>
    {loading && <p role="status" className="text-sm muted">{t("Loading people…")}</p>}
    {error && <p role="alert" className="error">{t(error)}<button type="button" className="underline ml-2" onClick={reload}>{t("Retry")}</button></p>}
    {data && <><div className="grid sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">{data.items.map(person => <label key={person.id} className="flex items-center gap-3 border border-line rounded-lg p-3 text-sm cursor-pointer hover:bg-hover"><input type="checkbox" className="size-4 shrink-0 accent-[#245b47]" checked={selected.some(item => item.id === person.id)} onChange={event => onChange(event.target.checked ? [...selected, { id: person.id, displayName: person.displayName }] : selected.filter(item => item.id !== person.id))} /><span className="min-w-0 break-words">{person.displayName}<span className="block muted text-xs">{person.organization}</span></span></label>)}</div>{!data.items.length && <p className="text-sm muted">{t("No matching contacts. You can save this as a standalone note.")}</p>}<Pagination offset={offset} nextOffset={data.nextOffset} onChange={setOffset} pageSize={10} /></>}
  </section>
}
