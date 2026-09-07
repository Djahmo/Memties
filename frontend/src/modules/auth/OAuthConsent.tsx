import { useEffect, useState } from 'react'
import { api, errorMessage } from '../../services/api'
import type { User } from '../../types/api'

export const OAuthConsent = ({ user }: { user: User }) => {
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
    <section className="card max-w-lg space-y-5">
      <h1 className="text-2xl font-semibold">Autoriser une connexion à Memties</h1>
      <p>Compte : {user.email}</p>
      {client && <>
        <p><strong>{client.name}</strong> demande à accéder à vos données Memties.</p>
        <p>Destination : {client.destination}</p>
        <p>{client.scope.split(' ').includes('memties:write') ? 'Lecture et modification de vos contacts, souvenirs et rappels.' : 'Lecture de vos contacts, souvenirs et rappels.'} Cela inclut votre espace Personal et les groupes auxquels vous avez accès.</p>
        <p>Accès valable 30 jours, révocable dans les paramètres Memties, rubrique tokens.</p>
        <div className="flex gap-3">
          <button className="primary" disabled={busy} onClick={() => void decide(true)}>Autoriser</button>
          <button className="secondary" disabled={busy} onClick={() => void decide(false)}>Refuser</button>
        </div>
      </>}
      {!client && !error && <p role="status">Chargement…</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  </main>
}
