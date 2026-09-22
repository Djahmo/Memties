import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, KeyRound, Trash2 } from 'lucide-react'
import { api, errorMessage } from '../../services/api'
import { useApi } from '../../hooks/useApi'

type Token = { id: string; name: string; access: 'read' | 'write'; expiresAt: string }
export const TokenSettings = () => {
  const { t, i18n } = useTranslation()
  const { data, error: loadError, reload } = useApi<Token[]>('/tokens')
  const [secret, setSecret] = useState('')
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const copyUrl = async () => {
    setCopied(false); setCopyError(false)
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/api/mcp`)
      setCopied(true)
    } catch { setCopyError(true) }
  }
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
  return <section className="space-y-5">
    <h4 className="font-semibold flex items-center gap-2"><KeyRound size={18} />{t('MCP access')}</h4>
    <h5 className="font-medium">{t('Connect with OAuth')}</h5>
    <p className="text-sm muted">{t('Add this URL to your compatible MCP client and choose OAuth. Leave optional client credentials empty, then sign in and approve access.')}</p>
    <div className="space-y-2">
      <label className="field-label" htmlFor="mcp-url">{t('Server URL')}</label>
      <div className="flex flex-wrap items-center gap-2">
        <input id="mcp-url" className="input-field text-xs flex-1 basis-48" readOnly value={`${window.location.origin}/api/mcp`} onFocus={event => event.target.select()} />
        <button type="button" className="secondary" onClick={() => { void copyUrl() }} aria-label={t('Copy MCP URL')}>
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{t(copied ? 'Copied' : 'Copy')}
        </button>
      </div>
      <p role="status" className="text-sm text-accent">{copied ? t('URL copied.') : ''}</p>
      {copyError && <p role="alert" className="error">{t('Could not copy. Select the URL and copy it manually.')}</p>}
    </div>
    <p className="text-sm muted">{t('Access lasts 30 days. Reconnect when it expires.')}</p>
    <details className="border border-line rounded-lg p-3" onToggle={event => { if (!event.currentTarget.open) setSecret('') }}>
    <summary className="cursor-pointer font-medium">{t('Personal tokens')}</summary>
    <div className="space-y-3 mt-3">
    <p className="text-sm muted">{t('For scripts and clients that accept a personal token, use Streamable HTTP with Bearer authentication. Tokens can access your visible data, including Personal. Keep them secret.')}</p>
    <form onSubmit={create}><fieldset disabled={busy} className="space-y-3">
      <label className="field-label">{t('Token name')}<input name="name" className="input-field" maxLength={120} required /></label>
      <div className="grid grid-cols-2 gap-3"><label className="field-label">{t('Access')}<select name="access" className="input-field"><option value="read">{t('Read only')}</option><option value="write">{t('Read and write')}</option></select></label><label className="field-label">{t('Expires in days')}<input name="days" className="input-field" type="number" min={1} max={365} defaultValue={90} required /></label></div>
      <button type="submit" className="secondary">{t('Create token')}</button>
    </fieldset></form>
    {secret && <div className="bg-warning border border-warningline rounded-lg p-3 space-y-2"><p className="text-sm">{t('Copy this token now. It will only be shown once.')}</p><input className="input-field text-xs" aria-label={t('New token')} readOnly value={secret} onFocus={event => event.target.select()} /><button className="secondary text-sm" onClick={() => setSecret('')}>{t('Hide token')}</button></div>}
    </div>
    </details>
    <h5 className="font-medium">{t('Connections and tokens')}</h5>
    <p className="text-sm muted">{t('Revoke access to disconnect a client.')}</p>
    {(error || loadError) && <p className="error" role="alert">{t(error || loadError || '')}{loadError && <button className="underline ml-2" onClick={reload}>{t('Retry')}</button>}</p>}
    {!data && !loadError && <p role="status" className="muted text-sm">{t('Loading connections…')}</p>}
    {data?.length === 0 && <p className="rounded-lg bg-subtle p-4 text-sm muted">{t('No connections or tokens yet.')}</p>}
    {data?.map(token => <div key={token.id} className="border border-line rounded-lg p-3 space-y-2"><div className="flex justify-between items-start gap-2"><div className="min-w-0"><p className="font-medium break-words">{token.name}</p><p className="text-xs muted">{t(token.access === 'read' ? 'Read only' : 'Read and write')} · {new Date(token.expiresAt).toLocaleDateString(i18n.language)}</p></div><button className="secondary p-2" disabled={busy} aria-label={t('Revoke token')} onClick={() => setRevokeId(token.id)}><Trash2 size={16} /></button></div>{revokeId === token.id && <div className="flex gap-2"><button className="secondary text-errorink text-sm" disabled={busy} onClick={() => { void revoke(token.id) }}>{t('Confirm revocation')}</button><button className="secondary text-sm" disabled={busy} onClick={() => setRevokeId(null)}>{t('Cancel')}</button></div>}</div>)}
  </section>
}
