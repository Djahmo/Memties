export type LanguagePreference = 'browser' | 'en' | 'fr'
export type ThemePreference = 'system' | 'light' | 'dark'
export type Preferences = { language: LanguagePreference; theme: ThemePreference }
const storageKey = 'memties.preferences'

const read = (): Preferences => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
    if (value && typeof value === 'object') return {
      language: 'language' in value && (value.language === 'en' || value.language === 'fr') ? value.language : 'browser',
      theme: 'theme' in value && (value.theme === 'light' || value.theme === 'dark') ? value.theme : 'system',
    }
  } catch { /* Preferences remain usable when browser storage is unavailable. */ }
  return { language: 'browser', theme: 'system' }
}
let preferences = read()
const listeners = new Set<() => void>()
export const getPreferences = () => preferences
export const subscribePreferences = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const updatePreferences = (patch: Partial<Preferences>) => {
  preferences = { ...preferences, ...patch }
  try { localStorage.setItem(storageKey, JSON.stringify(preferences)) } catch { /* Keep the choice for this session. */ }
  for (const listener of listeners) listener()
}
window.addEventListener('storage', event => {
  if (event.key !== storageKey && event.key !== null) return
  preferences = read()
  for (const listener of listeners) listener()
})
export const browserLanguage = () => navigator.languages.map(language => language.toLowerCase().split('-')[0]).find(language => language === 'fr' || language === 'en') ?? 'en'
export const applyTheme = () => {
  const dark = preferences.theme === 'dark' || (preferences.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}
applyTheme()
subscribePreferences(applyTheme)
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)
