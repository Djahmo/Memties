import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { en, fr } from './messages'
import { browserLanguage, getPreferences, subscribePreferences } from './preferences'

const language = () => getPreferences().language === 'browser' ? browserLanguage() : getPreferences().language
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: language(), fallbackLng: 'en', supportedLngs: ['en', 'fr'],
  keySeparator: false, nsSeparator: false, initAsync: false,
  interpolation: { escapeValue: false },
})
const applyLanguage = () => { void i18n.changeLanguage(language()) }
const syncDocument = () => {
  document.documentElement.lang = i18n.language
  document.querySelector('meta[name="description"]')?.setAttribute('content', i18n.t('A thoughtful place for your relationship memory.'))
}
i18n.on('languageChanged', syncDocument)
syncDocument()
subscribePreferences(applyLanguage)
window.addEventListener('languagechange', () => { if (getPreferences().language === 'browser') applyLanguage() })
export default i18n
