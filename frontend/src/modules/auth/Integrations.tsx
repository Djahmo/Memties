import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound, Link2, Trash2 } from 'lucide-react'
import { api, errorMessage } from '../../services/api'
import { useApi } from '../../hooks/useApi'

type Token = { id: string; name: string; access: 'read' | 'write'; expiresAt: string }
export const TokenSettings = () => {
  const { t, i18n } = useTranslation()
  const { data, error: loadError, reload } = useApi<Token[]>('/tokens')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revokeId, setRevokeId] = useState<string | null>(null)
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const element = event.currentTarget
    const form = new FormData(element)
    setBusy(true); setError(''); setSecret('')
    try {
      const result = await api<{ token: string }>('/tokens', { method: 'POST', body: { name: String(form.get('name')).trim(), access: String(form.get('access')), days: Number(form.get('days')) } })
      setSecret(result.token); element.reset(); reload()
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  const revoke = async (id: string) => {
    setBusy(true); setError('')
    try { await api(`/tokens/${id}`, { method: 'DELETE' }); setRevokeId(null); setSecret(''); reload() }
    catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  return <section className="border-t border-line mt-6 pt-5 space-y-4">
    <h3 className="font-semibold flex items-center gap-2"><KeyRound size={18} />{t('MCP access')}</h3>
    <p className="text-sm muted">{t('Connect an assistant using Streamable HTTP and a Bearer token. Tokens can access your visible data, including Personal. Keep them secret.')}</p>
    <label className="field-label">{t('Server URL')}<input className="input-field text-xs" readOnly value={`${window.location.origin}/api/mcp`} onFocus={event => event.target.select()} /></label>
    <form onSubmit={create}><fieldset disabled={busy} className="space-y-3">
      <label className="field-label">{t('Token name')}<input name="name" className="input-field" maxLength={120} required /></label>
      <div className="grid grid-cols-2 gap-3"><label className="field-label">{t('Access')}<select name="access" className="input-field"><option value="read">{t('Read only')}</option><option value="write">{t('Read and write')}</option></select></label><label className="field-label">{t('Expires in days')}<input name="days" className="input-field" type="number" min={1} max={365} defaultValue={90} required /></label></div>
      <button type="submit" className="secondary">{t('Create token')}</button>
    </fieldset></form>
    {secret && <div className="bg-warning border border-warningline rounded-lg p-3 space-y-2"><p className="text-sm">{t('Copy this token now. It will only be shown once.')}</p><input className="input-field text-xs" aria-label={t('New token')} readOnly value={secret} onFocus={event => event.target.select()} /><button className="secondary text-sm" onClick={() => setSecret('')}>{t('Hide token')}</button></div>}
    {(error || loadError) && <p className="error" role="alert">{t(error || loadError || '')}{loadError && <button className="underline ml-2" onClick={reload}>{t('Retry')}</button>}</p>}
    {data?.map(token => <div key={token.id} className="border border-line rounded-lg p-3 space-y-2"><div className="flex justify-between items-start gap-2"><div className="min-w-0"><p className="font-medium break-words">{token.name}</p><p className="text-xs muted">{t(token.access === 'read' ? 'Read only' : 'Read and write')} · {new Date(token.expiresAt).toLocaleDateString(i18n.language)}</p></div><button className="secondary p-2" disabled={busy} aria-label={t('Revoke token')} onClick={() => setRevokeId(token.id)}><Trash2 size={16} /></button></div>{revokeId === token.id && <div className="flex gap-2"><button className="secondary text-errorink text-sm" disabled={busy} onClick={() => { void revoke(token.id) }}>{t('Confirm revocation')}</button><button className="secondary text-sm" disabled={busy} onClick={() => setRevokeId(null)}>{t('Cancel')}</button></div>}</div>)}
  </section>
}

export const ProviderSettings = () => {
  const { t } = useTranslation()
  const { data } = useApi<{ ldapEnabled: boolean; samlEnabled: boolean }>('/auth/config')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const linkLdap = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const element = event.currentTarget
    const form = new FormData(element)
    setBusy(true); setError(''); setNotice('')
    try {
      await api('/auth/ldap', { method: 'POST', body: { username: String(form.get('username')).trim(), password: String(form.get('password')), link: true } })
      element.reset(); setNotice('Authentication provider linked.')
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  const linkSaml = async () => {
    setBusy(true); setError('')
    try { window.location.assign((await api<{ url: string }>('/auth/saml/start', { method: 'POST', body: { link: true } })).url) }
    catch (cause) { setError(errorMessage(cause)); setBusy(false) }
  }
  if (!data?.ldapEnabled && !data?.samlEnabled) return null
  return <section className="border-t border-line mt-6 pt-5 space-y-4"><h3 className="font-semibold flex items-center gap-2"><Link2 size={18} />{t('Linked sign-in methods')}</h3><p className="muted text-sm">{t('Link your directory or single sign-on identity to this account to keep the same data.')}</p>
    {data.ldapEnabled && <form onSubmit={linkLdap}><fieldset disabled={busy} className="space-y-3"><label className="field-label">{t('Directory username')}<input className="input-field" name="username" autoComplete="username" maxLength={254} required /></label><label className="field-label">{t('Directory password')}<input className="input-field" type="password" name="password" autoComplete="current-password" maxLength={256} required /></label><button className="secondary" type="submit">{t('Link directory account')}</button></fieldset></form>}
    {data.samlEnabled && <button className="secondary" disabled={busy} onClick={() => { void linkSaml() }}>{t('Link single sign-on')}</button>}
    {error && <p className="error" role="alert">{t(error)}</p>}{notice && <p className="text-sm text-accent" role="status">{t(notice)}</p>}
  </section>
}
