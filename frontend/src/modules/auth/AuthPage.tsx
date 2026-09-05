import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { PreferencesButton } from '../../components/PreferencesButton'
import { Network } from 'lucide-react'
import type { FormEvent } from 'react'
import { api, errorMessage } from '../../services/api'
import type { User } from '../../types/api'

export const AuthPage = ({ onAuthenticated }: { onAuthenticated: (user: User) => void }) => {
  const { t } = useTranslation()
  const [register, setRegister] = useState(false)
  const [registrationEnabled, setRegistrationEnabled] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    api<{ registrationEnabled: boolean }>('/auth/config').then(value => { if (active) setRegistrationEnabled(value.registrationEnabled) }).catch(() => { if (active) setError('Unable to load account settings. Refresh to try again.') })
    return () => { active = false }
  }, [])
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      onAuthenticated(await api<User>(register ? '/auth/register' : '/auth/login', { method: 'POST', body: {
        email: String(form.get('email')).trim(), password: String(form.get('password')),
        ...(register ? { displayName: String(form.get('displayName')).trim() } : {}),
      } }))
    } catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
  }
  return <main className="min-h-screen grid md:grid-cols-2"><div className="absolute top-5 right-5"><PreferencesButton /></div>
    <section className="bg-[#173e36] text-white p-8 md:p-16 flex flex-col justify-between gap-14">
      <a href="/" className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight"><Network size={26} aria-hidden="true" />Memties</a>
      <div className="max-w-lg"><p className="uppercase tracking-[.2em] text-xs text-[#bad1c8] mb-5">{t("Your relationship memory")}</p><h1 className="text-4xl md:text-5xl font-semibold leading-tight">{t("Remember the people.")}<br />{t("Keep the context.")}</h1><p className="mt-6 text-[#d4e2db] text-lg leading-relaxed">{t("A quiet place to organize the people, conversations, and follow-ups that matter.")}</p></div>
      <p className="text-sm text-[#bad1c8]">{t("Personal by default. Shared with intention.")}</p>
    </section>
    <section className="flex items-center justify-center p-6 md:p-12">
      <div className="w-full max-w-sm"><p className="eyebrow">{t("Welcome to Memties")}</p><h2 className="text-3xl font-semibold mt-3 mb-2">{register ? t("Create your account") : t("Welcome back")}</h2><p className="muted mb-8">{register ? t("Your private Personal space is created automatically.") : t("Sign in to your relationship workspace.")}</p>
        <form onSubmit={submit}><fieldset disabled={busy} className="space-y-5">
          {register && <label className="field-label">{t("Your name")}<input className="input-field" name="displayName" autoComplete="name" maxLength={120} required /></label>}
          <label className="field-label">{t("Email")}<input className="input-field" name="email" type="email" autoComplete="email" maxLength={254} required /></label>
          <label className="field-label">{t("Password")}<input className="input-field" key={register ? 'new' : 'current'} name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 12 : 1} maxLength={256} required />{register && <span className="text-xs muted font-normal">{t("Use at least 12 characters.")}</span>}</label>
          {error && <p className="error" role="alert">{t(error)}</p>}
          <button className="primary w-full" type="submit">{busy ? t("Please wait…") : register ? t("Create account") : t("Sign in")}</button>
        </fieldset></form>
        {registrationEnabled && <button disabled={busy} className="mt-6 text-sm text-accent underline underline-offset-4" onClick={() => { setRegister(value => !value); setError('') }}>{register ? t("Already have an account? Sign in") : t("New here? Create an account")}</button>}
      </div>
    </section>
  </main>
}
