import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Bell, ChevronRight, Code2, Database, Settings2, X } from 'lucide-react'
import { TokenSettings } from '../modules/auth/Integrations'
import { PushSettings } from '../modules/reminders/PushSettings'
import { TransferSettings } from '../modules/transfer/TransferSettings'
import { getPreferences, subscribePreferences, updatePreferences } from '../i18n/preferences'

const sections = [
  { id: 'general', label: 'General', description: 'Language, appearance and sign-in', icon: Settings2 },
  { id: 'notifications', label: 'Notifications', description: 'Reminders on this device', icon: Bell },
  { id: 'data', label: 'Data', description: 'JSON import and export', icon: Database },
  { id: 'developer', label: 'Developer', description: 'MCP, OAuth and personal tokens', icon: Code2 },
] as const

type Section = typeof sections[number]['id']

export const PreferencesButton = ({ authenticated = false }: { authenticated?: boolean }) => {
  const { t } = useTranslation()
  const preferences = useSyncExternalStore(subscribePreferences, getPreferences)
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<Section>('general')
  const [mobileDetail, setMobileDetail] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const navigation = useRef<HTMLElement>(null)

  useEffect(() => {
    if (open) dialog.current?.showModal()
    else dialog.current?.close()
  }, [open])

  const selectSection = (next: Section) => {
    setSection(next)
    setMobileDetail(true)
    requestAnimationFrame(() => heading.current?.focus())
  }

  return <>
    <button className="secondary p-2.5" aria-label={t('App settings')} onClick={() => { setSection('general'); setMobileDetail(false); setOpen(true) }}>
      <Settings2 size={18} aria-hidden="true" />
    </button>
    <dialog ref={dialog} onClose={() => setOpen(false)} className="m-auto w-[94vw] max-w-4xl max-h-[90dvh] overflow-auto rounded-xl border border-line bg-surface text-ink backdrop:bg-black/50" aria-labelledby="preferences-title">
      <header className="flex items-center justify-between gap-4 border-b border-line p-4 sm:px-6">
        <h2 id="preferences-title" className="text-xl font-semibold">{t('Settings')}</h2>
        <button className="secondary p-2" aria-label={t('Close')} onClick={() => setOpen(false)}><X size={18} aria-hidden="true" /></button>
      </header>
      <div className="sm:flex sm:min-h-[30rem]">
        <nav ref={navigation} aria-label={t('Settings')} className={`${mobileDetail ? 'hidden sm:block' : 'block'} shrink-0 p-3 sm:w-56 sm:border-r sm:border-line sm:bg-subtle`}>
          {sections.filter(item => authenticated || item.id === 'general').map(({ id, label, description, icon: Icon }) => <button
            key={id}
            type="button"
            data-section={id}
            aria-current={section === id ? 'page' : undefined}
            onClick={() => selectSection(id)}
            className={`flex w-full items-center gap-3 rounded-lg p-3 text-left mb-1 transition-colors ${section === id ? 'sm:bg-selected sm:text-accent' : 'hover:bg-hover'}`}
          >
            <Icon size={20} className="shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1"><span className="block font-medium">{t(label)}</span><span className="block text-sm muted mt-1 sm:hidden">{t(description)}</span></span>
            <ChevronRight size={18} className="sm:hidden shrink-0" aria-hidden="true" />
          </button>)}
        </nav>
        <div className={`${mobileDetail ? 'block' : 'hidden sm:block'} min-w-0 flex-1 p-4 sm:p-6`}>
          <button className="secondary mb-5 sm:hidden" onClick={() => {
            setMobileDetail(false)
            requestAnimationFrame(() => navigation.current?.querySelector<HTMLButtonElement>(`[data-section="${section}"]`)?.focus())
          }}><ArrowLeft size={18} aria-hidden="true" />{t('Settings')}</button>
          <h3 ref={heading} tabIndex={-1} className="text-lg font-semibold mb-6">{t(sections.find(item => item.id === section)!.label)}</h3>
          <div hidden={section !== 'general'} className="space-y-5">
            <label className="field-label">{t('Language')}<select className="input-field" value={preferences.language} onChange={event => { const language = event.target.value; if (language === 'browser' || language === 'en' || language === 'fr') updatePreferences({ language }) }}><option value="browser">{t('Browser language')}</option><option value="fr">Français</option><option value="en">English</option></select></label>
            <label className="field-label">{t('Appearance')}<select className="input-field" value={preferences.theme} onChange={event => { const theme = event.target.value; if (theme === 'system' || theme === 'light' || theme === 'dark') updatePreferences({ theme }) }}><option value="system">{t('System theme')}</option><option value="light">{t('Light')}</option><option value="dark">{t('Dark')}</option></select></label>
            <p className="muted text-sm">{t('Your preferences are saved in this browser.')}</p>
          </div>
          {authenticated && open && <>
            <div hidden={section !== 'notifications'}><PushSettings /></div>
            <div hidden={section !== 'data'}><TransferSettings /></div>
            <div hidden={section !== 'developer'}><TokenSettings /></div>
          </>}
        </div>
      </div>
    </dialog>
  </>
}
