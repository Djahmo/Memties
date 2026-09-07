import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings2, X } from 'lucide-react'
import { ProviderSettings, TokenSettings } from '../modules/auth/Integrations'
import { PushSettings } from '../modules/reminders/PushSettings'
import { TransferSettings } from '../modules/transfer/TransferSettings'
import { getPreferences, subscribePreferences, updatePreferences } from '../i18n/preferences'

export const PreferencesButton = ({ authenticated = false }: { authenticated?: boolean }) => {
  const { t } = useTranslation()
  const preferences = useSyncExternalStore(subscribePreferences, getPreferences)
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close() }, [open])
  return <>
    <button className="secondary p-2.5" aria-label={t('App settings')} onClick={() => setOpen(true)}><Settings2 size={18} aria-hidden="true" /></button>
    <dialog ref={dialog} onClose={() => setOpen(false)} className="card m-auto w-[90vw] max-w-lg max-h-[90vh] overflow-auto text-ink backdrop:bg-black/50" aria-labelledby="preferences-title">
      <div className="flex items-center justify-between gap-4 mb-6"><h2 id="preferences-title" className="text-xl font-semibold">{t('App settings')}</h2><button className="secondary p-2" aria-label={t('Close')} onClick={() => setOpen(false)}><X size={18} aria-hidden="true" /></button></div>
      <label className="field-label">{t('Language')}<select className="input-field" aria-label={t('Language')} value={preferences.language} onChange={event => { const language = event.target.value; if (language === 'browser' || language === 'en' || language === 'fr') updatePreferences({ language }) }}><option value="browser">{t('Browser language')}</option><option value="fr">Français</option><option value="en">English</option></select></label>
      <label className="field-label mt-5">{t('Appearance')}<select className="input-field" aria-label={t('Appearance')} value={preferences.theme} onChange={event => { const theme = event.target.value; if (theme === 'system' || theme === 'light' || theme === 'dark') updatePreferences({ theme }) }}><option value="system">{t('System theme')}</option><option value="light">{t('Light')}</option><option value="dark">{t('Dark')}</option></select></label>
      <p className="muted text-sm mt-5">{t('Your preferences are saved in this browser.')}</p>
      {authenticated && open && <><PushSettings /><TransferSettings /><ProviderSettings /><TokenSettings /></>}
    </dialog>
  </>
}
