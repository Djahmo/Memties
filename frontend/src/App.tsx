import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { PreferencesButton } from './components/PreferencesButton'
import { AuthPage } from './modules/auth/AuthPage'
import { OAuthConsent } from './modules/auth/OAuthConsent'
import { GroupPage } from './modules/groups/GroupPage'
import { api, ApiError } from './services/api'
import type { User } from './types/api'

const App = () => {
  const { t } = useTranslation()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    api<User>('/auth/me').then(value => { if (active) setUser(value) }).catch((error: unknown) => {
      if (active && !(error instanceof ApiError && error.status === 401)) setError('Cannot reach Memties. Check that the backend and database are running.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [attempt])
  if (loading) return <main className="min-h-screen grid place-items-center" role="status"><div className="absolute right-5 top-5"><PreferencesButton /></div>{t("Opening Memties…")}</main>
  if (error) return <main className="min-h-screen grid place-items-center p-6"><div className="absolute right-5 top-5"><PreferencesButton /></div><div className="card max-w-lg space-y-4"><h1 className="text-2xl font-semibold">{t("Connection unavailable")}</h1><p role="alert">{t(error)}</p><button className="primary" onClick={() => { setError(''); setLoading(true); setAttempt(value => value + 1) }}>{t("Try again")}</button></div></main>
  return user ? (new URLSearchParams(window.location.search).has('oauth') ? <OAuthConsent user={user} /> : <GroupPage user={user} onLogout={() => setUser(null)} />) : <AuthPage onAuthenticated={setUser} />
}
export default App
