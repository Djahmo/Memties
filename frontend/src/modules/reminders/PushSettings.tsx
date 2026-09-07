import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, errorMessage } from '../../services/api'
import { disablePush } from './push'
import { useApi } from '../../hooks/useApi'

export const PushSettings = () => {
  const { t } = useTranslation()
  const { data, error: configError } = useApi<{ publicKey: string | null }>('/push/config')
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const supported = window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  useEffect(() => {
    if (!supported) return
    let cancelled = false
    void navigator.serviceWorker.getRegistration('/').then(registration => registration?.pushManager.getSubscription()).then(async subscription => {
      const registered = subscription ? await api<{ endpoint: string }[]>('/push/subscriptions') : []
      if (!cancelled) setEnabled(registered.some(item => item.endpoint === subscription?.endpoint))
    }).catch(() => { if (!cancelled) setError('Could not enable notifications. Please try again.') })
    return () => { cancelled = true }
  }, [supported])
  const toggle = async () => {
    setBusy(true); setError('')
    try {
      if (enabled) { await disablePush(); setEnabled(false); return }
      if (!data?.publicKey) return
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setError('Allow notifications in your browser settings, then try again.'); return }
      await navigator.serviceWorker.register('/sw.js')
      const registration = await navigator.serviceWorker.ready
      const key = Uint8Array.from(atob(data.publicKey.replace(/-/g, '+').replace(/_/g, '/')), character => character.charCodeAt(0))
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
      try { await api('/push/subscriptions', { method: 'POST', body: subscription.toJSON() }) }
      catch (cause) { await subscription.unsubscribe(); throw cause }
      setEnabled(true)
    } catch (cause) { setError(cause instanceof DOMException ? 'Could not enable notifications. Please try again.' : errorMessage(cause)) }
    finally { setBusy(false) }
  }
  return <section className="border-t border-line pt-5 space-y-3">
    <h3 className="font-semibold">{t('Push notifications')}</h3>
    <p className="muted text-sm">{t('Enable this device, then choose push on each reminder. Notifications contain no private content.')}</p>
    {!supported ? <p className="muted text-sm">{t('Push requires a compatible browser and HTTPS. On iPhone or iPad, add Memties to your Home Screen and open it from there.')}</p> : <>
      {data && !data.publicKey && <p className="muted text-sm">{t('Push notifications are not configured.')}</p>}
      <button type="button" className="secondary" disabled={busy || (!enabled && !data?.publicKey)} onClick={() => { void toggle() }}>{t(busy ? 'Saving…' : enabled ? 'Disable on this device' : 'Enable on this device')}</button>
      {enabled && <p role="status" className="text-sm">{t('Push is enabled on this device.')}</p>}
    </>}
    {(error || configError) && <p role="alert" className="error">{t(error || configError || '')}</p>}
  </section>
}
