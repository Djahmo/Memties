import { useTranslation } from 'react-i18next'
import { CalendarDays } from 'lucide-react'
import { useApi } from '../../hooks/useApi'

type AnnualDate = { id: string; personId: string; personName: string; label: string; date: string; nextDate: string }

export const AnnualDates = ({ groupId, onPerson }: { groupId: string; onPerson: (id: string) => void }) => {
  const { t, i18n } = useTranslation()
  const { data, error, reload } = useApi<AnnualDate[]>(`/people/dates/upcoming?groupId=${groupId}`)
  return <section className="card space-y-3" aria-label={t('Upcoming important dates')}>
    <h2 className="font-semibold flex items-center gap-2"><CalendarDays size={18} aria-hidden="true" />{t('Upcoming important dates')}</h2>
    <p className="muted text-xs">{t('Annual reminders appear here when enabled on a contact.')}</p>
    {error && <p className="error" role="alert">{t(error)}<button type="button" className="underline ml-2" onClick={reload}>{t('Retry')}</button></p>}
    {data && <>{data.length ? <ul className="space-y-2">{data.map(date => <li key={date.id} className="flex flex-wrap items-center justify-between gap-2 text-sm border-t border-line pt-2"><span><button type="button" className="text-accent hover:underline" onClick={() => onPerson(date.personId)}>{date.personName}</button> · {date.label}</span><time dateTime={date.nextDate}>{new Date(`${date.nextDate}T12:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })}</time></li>)}</ul> : <p className="muted text-sm">{t('No upcoming important dates.')}</p>}</>}
  </section>
}
