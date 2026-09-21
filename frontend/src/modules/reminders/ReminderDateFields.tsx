import { useTranslation } from 'react-i18next'

export const ReminderDateFields = ({ dueAt }: { dueAt?: string }) => {
  const { t } = useTranslation()
  const date = dueAt ? new Date(dueAt) : null
  const local = date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString() : ''
  return <div className="grid sm:grid-cols-2 gap-4">
    <label className="field-label">{t('Due date')}<input className="input-field" type="date" name="reminderDate" defaultValue={local.slice(0, 10)} required /></label>
    <label className="field-label">{t('Time')}<input className="input-field" type="time" name="reminderTime" defaultValue={local.slice(11, 16) || '09:00'} required /></label>
  </div>
}
