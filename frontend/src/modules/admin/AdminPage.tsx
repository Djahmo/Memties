import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { api, errorMessage } from '../../services/api'
import { PreferencesButton } from '../../components/PreferencesButton'
import type { Page, User } from '../../types/api'

type Account = User & { role: 'admin' | 'user'; status: 'active' | 'suspended'; createdAt: string; methods: string[] }

export const AdminPage = ({ onBack }: { onBack: () => void }) => {
  const { t, i18n } = useTranslation()
  const [page, setPage] = useState<Page<Account>>({ items: [], nextOffset: null })
  const [offset, setOffset] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [deleting, setDeleting] = useState<Account | null>(null)
  const [confirmation, setConfirmation] = useState('')
  useEffect(() => {
    let active = true
    api<Page<Account>>(`/admin/users?offset=${offset}`).then(value => { if (active) setPage(value) })
      .catch(error => { if (active) setError(errorMessage(error)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [offset, attempt])
  const load = (value: number) => { setLoading(true); setError(''); setOffset(value); setAttempt(value => value + 1) }
  const update = async (account: Account) => {
    setBusy(true); setError(''); setNotice('')
    const status = account.status === 'active' ? 'suspended' : 'active'
    try {
      await api(`/admin/users/${account.id}`, { method: 'PATCH', body: { status } })
      setPage(current => ({ ...current, items: current.items.map(item => item.id === account.id ? { ...item, status } : item) }))
      setNotice(status === 'suspended' ? 'Account suspended. Sessions and API tokens revoked.' : 'Account reactivated.')
    } catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!deleting) return
    setBusy(true); setError(''); setNotice('')
    try {
      await api(`/admin/users/${deleting.id}`, { method: 'DELETE', body: { email: confirmation.trim() } })
      setDeleting(null); setConfirmation('')
      setNotice('Account and data deleted.')
      load(page.items.length === 1 && offset > 0 ? offset - 50 : offset)
    } catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
  }
  return <main className="min-h-screen bg-subtle p-4 sm:p-8">
    <div className="max-w-6xl mx-auto">
      <header className="flex items-center justify-between gap-4 mb-8"><button className="secondary" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />{t('Back to Memties')}</button><PreferencesButton authenticated /></header>
      <p className="eyebrow flex items-center gap-2"><ShieldCheck size={18} aria-hidden="true" />{t('Administration')}</p>
      <h1 className="text-3xl font-semibold mt-3">{t('Users')}</h1>
      <p className="muted mt-3 mb-6">{t('Manage account access. Personal vaults remain private.')}</p>
      {error && <p role="alert" className="error mb-4">{t(error)} <button className="underline" disabled={busy} onClick={() => load(offset)}>{t('Retry')}</button></p>}
      {notice && <p role="status" className="text-accent mb-4">{t(notice)}</p>}
      {deleting && <section className="card mb-6 space-y-4 border-red-500" aria-labelledby="delete-account-title">
        <h2 id="delete-account-title" className="text-lg font-semibold">{t('Permanently delete {{name}}?', { name: deleting.displayName })}</h2>
        <p>{t('This permanently deletes the account and its data. This cannot be undone.')}</p>
        <p>{t('Contacts and entries created by this account will also disappear from shared groups. Other members will lose access to them.')}</p>
        <p className="muted text-sm">{t('This does not revoke access at your identity provider. A later sign-in can create a new empty account.')}</p>
        <form onSubmit={event => { event.preventDefault(); void remove() }} className="space-y-4">
          <label className="field-label">{t('Type {{email}} to confirm', { email: deleting.email })}<input className="input-field" type="email" autoComplete="off" value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} required /></label>
          <div className="flex gap-3 flex-wrap"><button className="primary" disabled={busy || confirmation.trim().toLowerCase() !== deleting.email.toLowerCase()} type="submit">{t('Delete permanently')}</button><button className="secondary" type="button" disabled={busy} onClick={() => { setDeleting(null); setConfirmation('') }}>{t('Cancel')}</button></div>
        </form>
      </section>}
      {loading ? <p role="status">{t('Loading users…')}</p> : <>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm text-left"><thead><tr className="border-b border-line">{['User', 'Role', 'Sign-in methods', 'Created', 'Status', 'Actions'].map(label => <th key={label} scope="col" className="p-3 font-semibold whitespace-nowrap">{t(label)}</th>)}</tr></thead>
            <tbody>{page.items.map(account => <tr key={account.id} className="border-b border-line">
              <td className="p-3"><p className="font-semibold">{account.displayName}</p><p className="muted break-all">{account.email}</p></td>
              <td className="p-3">{t(account.role === 'admin' ? 'Administrator' : 'User')}</td>
              <td className="p-3">{account.methods.map(method => method === 'local' ? t('Local account') : method.toUpperCase()).join(', ') || '—'}</td>
              <td className="p-3 whitespace-nowrap">{new Date(account.createdAt).toLocaleDateString(i18n.language)}</td>
              <td className="p-3"><span className="badge">{t(account.status === 'active' ? 'Active' : 'Suspended')}</span></td>
              <td className="p-3"><div className="flex gap-2 flex-wrap"><button className="secondary whitespace-nowrap" disabled={busy || !!deleting || (account.role === 'admin' && account.status === 'active')} aria-label={t(account.status === 'active' ? 'Suspend {{name}}' : 'Reactivate {{name}}', { name: account.displayName })} onClick={() => { void update(account) }}>{t(account.status === 'active' ? 'Suspend' : 'Reactivate')}</button>{account.status === 'suspended' && account.role !== 'admin' && <button className="secondary text-red-600" disabled={busy || !!deleting} aria-label={t('Delete {{name}}', { name: account.displayName })} onClick={() => { setDeleting(account); setConfirmation(''); setError(''); setNotice('') }}>{t('Delete')}</button>}</div></td>
            </tr>)}</tbody>
          </table>
          {!page.items.length && <p className="muted p-4">{t('No users found.')}</p>}
        </div>
        <nav aria-label={t('Pagination')} className="flex justify-between items-center mt-5"><button className="secondary" disabled={busy || offset === 0} onClick={() => load(Math.max(0, offset - 50))}>{t('Previous')}</button><span className="muted text-sm">{t('Page {{page}}', { page: offset / 50 + 1 })}</span><button className="secondary" disabled={busy || page.nextOffset === null} onClick={() => load(page.nextOffset!)}>{t('Next')}</button></nav>
      </>}
    </div>
  </main>
}
