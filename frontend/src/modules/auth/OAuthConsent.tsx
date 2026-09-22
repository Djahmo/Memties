import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PreferencesButton } from '../../components/PreferencesButton'
import { api, errorMessage } from '../../services/api'
import type { User } from '../../types/api'

export const OAuthConsent = ({ user }: { user: User }) => {
  const { t } = useTranslation()
  const [query] = useState(() => new URLSearchParams(window.location.search).get('oauth') ?? '')
  const [client, setClient] = useState<{ name: string; destination: string; scope: string } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    api<{ name: string; destination: string; scope: string }>(`/oauth/consent?${query}`)
      .then(value => { if (active) setClient(value) })
      .catch(error => { if (active) setError(errorMessage(error)) })
    return () => { active = false }
  }, [query])
  const decide = async (approve: boolean) => {
    setBusy(true)
    setError('')
    try {
      const result = await api<{ redirect: string }>('/oauth/consent', {
        method: 'POST', body: { ...Object.fromEntries(new URLSearchParams(query)), approve },
      })
      window.location.assign(result.redirect)
    } catch (error) { setError(errorMessage(error)); setBusy(false) }
  }
  return <main className="min-h-screen grid place-items-center p-6">
    <div className="absolute right-5 top-5"><PreferencesButton /></div>
    <section className="card max-w-lg space-y-5">
      <h1 className="text-2xl font-semibold">{t('Authorize a connection to Memties')}</h1>
      <p>{t('Account: {{email}}', { email: user.email })}</p>
      {client && <>
        <p>{t('{{name}} is requesting access to your Memties data.', { name: client.name })}</p>
        <p>{t('Destination: {{destination}}', { destination: client.destination })}</p>
        <p>{t(client.scope.split(' ').includes('memties:write') ? 'Read and edit your contacts, entries and reminders.' : 'Read your contacts, entries and reminders.')} {t('This includes your Personal vault and the groups you can access.')}</p>
        <p>{t('Access lasts 30 days. Revoke it in Settings → Developer → Connections and tokens.')}</p>
        <div className="flex gap-3">
          <button className="primary" disabled={busy} onClick={() => void decide(true)}>{t('Authorize')}</button>
          <button className="secondary" disabled={busy} onClick={() => void decide(false)}>{t('Deny')}</button>
        </div>
      </>}
      {!client && !error && <p role="status">{t('Loading connection…')}</p>}
      {error && <p role="alert">{t(error)}</p>}
    </section>
  </main>
}
