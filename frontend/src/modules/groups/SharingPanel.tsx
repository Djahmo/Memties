import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Trash2, UserPlus } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { api, errorMessage } from '../../services/api'
import type { Group, GroupMember } from '../../types/api'

export const SharingPanel = ({ group, busy, setBusy, onChanged }: { group: Group; busy: boolean; setBusy: (busy: boolean) => void; onChanged: () => void }) => {
  const { t } = useTranslation()
  const { data, loading, error, reload } = useApi<GroupMember[]>(`/groups/${group.id}/members`)
  const [failure, setFailure] = useState('')
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const change = async (email: string, role: string) => {
    setBusy(true); setFailure('')
    try {
      await api(`/groups/${group.id}/members`, { method: 'PUT', body: { email, role } })
      reload(); onChanged(); return true
    } catch (error) { setFailure(errorMessage(error)); return false } finally { setBusy(false) }
  }
  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const input = new FormData(form)
    if (await change(String(input.get('email')).trim(), String(input.get('role')))) form.reset()
  }
  const remove = async (id: string) => {
    setBusy(true); setFailure('')
    try { await api(`/groups/${group.id}/members/${id}`, { method: 'DELETE' }); setConfirmRemove(null); reload(); onChanged() }
    catch (error) { setFailure(errorMessage(error)) } finally { setBusy(false) }
  }
  return <section className="max-w-3xl">
    <p className="muted text-sm mb-4">{t('Permission changes are saved immediately.')}</p>
    <p className="card text-sm mb-6">{t("Access extends to all subgroups. Owners manage permissions, editors maintain content, and viewers can only read. Personal vaults are never shared.")}</p>
    <form onSubmit={add} className="card mb-6"><fieldset disabled={busy} className="space-y-4"><h2 className="text-lg font-semibold">{t("Add an existing user")}</h2><label className="field-label">{t("Email")}<input className="input-field" name="email" type="email" required maxLength={254} /></label><label className="field-label">{t("Role")}<select className="input-field" aria-label={t("Role")} name="role" defaultValue="viewer"><option value="viewer">{t("Viewer")}</option><option value="editor">{t("Editor")}</option><option value="owner">{t("Owner")}</option></select></label><button className="primary" type="submit"><UserPlus size={17} aria-hidden="true" />{t("Grant access")}</button></fieldset></form>
    {(error || failure) && <p role="alert" className="error mb-4">{t(failure || error || 'Request failed. Please try again.')}</p>}
    {loading && <p role="status" className="muted">{t("Loading members…")}</p>}
    <div className="space-y-3">{data?.map(member => <article key={member.userId} className="card space-y-3">
      <div className="flex justify-between items-start gap-4 flex-wrap"><div className="min-w-0"><h2 className="font-semibold break-words">{member.displayName}</h2><p className="muted text-sm break-all">{member.email}</p></div><span className="badge">{t(member.role)}</span></div>
      {member.inheritedRole && <p className="text-sm muted">{t('Inherited access: {{role}}. Change it in the parent group; a lower direct role cannot reduce it.', { role: t(member.inheritedRole) })}</p>}
      <div className="flex items-center gap-3 flex-wrap"><label className="field-label">{t("Role")}<select aria-label={t('Role for {{name}}', { name: member.displayName })} className="input-field" value={member.directRole ?? member.role} disabled={busy} onChange={event => { if (event.target.value) void change(member.email, event.target.value) }}><option value="viewer">{t("Viewer")}</option><option value="editor">{t("Editor")}</option><option value="owner">{t("Owner")}</option></select></label>{member.directRole && <button className="secondary text-sm" disabled={busy} onClick={() => setConfirmRemove(member.userId)}><Trash2 size={16} aria-hidden="true" />{t("Remove direct access")}</button>}</div>
      {confirmRemove === member.userId && <div className="rounded-lg border border-warningline bg-warning p-4 space-y-3"><p className="text-sm">{t("Remove this direct access? Any inherited access will remain.")}</p><div className="flex gap-2"><button className="primary" disabled={busy} onClick={() => remove(member.userId)}>{t("Confirm removal")}</button><button className="secondary" disabled={busy} onClick={() => setConfirmRemove(null)}>{t("Cancel")}</button></div></div>}
    </article>)}</div>
  </section>
}
