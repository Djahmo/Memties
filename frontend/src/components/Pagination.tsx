import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight } from 'lucide-react'

export const Pagination = ({ offset, nextOffset, onChange, pageSize = 30 }: { offset: number; nextOffset: number | null; onChange: (offset: number) => void; pageSize?: number }) => {
  const { t } = useTranslation()
  if (!offset && nextOffset === null) return null
  return <nav aria-label={t("Pagination")} className="flex justify-between items-center gap-3 mt-5">
    <button type="button" className="secondary text-sm" disabled={!offset} onClick={() => onChange(Math.max(0, offset - pageSize))}><ArrowLeft size={16} aria-hidden="true" />{t("Previous")}</button>
    <span className="text-sm muted">{t('Page {{number}}', { number: Math.floor(offset / pageSize) + 1 })}</span>
    <button type="button" className="secondary text-sm" disabled={nextOffset === null} onClick={() => { if (nextOffset !== null) onChange(nextOffset) }}>{t("Next")}<ArrowRight size={16} aria-hidden="true" /></button>
  </nav>
}
