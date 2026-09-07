import { createHash } from 'node:crypto'
import webpush from 'web-push'
import { z } from 'zod'
import { and, eq, isNull, lt, lte, or } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { Config } from '../config.js'
import type { Database } from '../db/index.js'
import { entries, reminders, pushSubscriptions } from '../db/schema.js'
import { loadAccess } from './access.js'

// Restrict outbound requests to browser push providers; never accept arbitrary URLs.
export const pushEndpoint = z.url().max(2048).refine(value => {
  const url = new URL(value)
  return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash && (
    url.hostname === 'fcm.googleapis.com' || url.hostname === 'updates.push.services.mozilla.com' ||
    url.hostname === 'web.push.apple.com' || url.hostname.endsWith('.notify.windows.com'))
}, 'Unsupported push endpoint')
export const pushInput = z.object({
  endpoint: pushEndpoint,
  keys: z.object({ p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}$/), auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/) }).strict(),
  expirationTime: z.number().nullable().optional(),
}).strict()
const hash = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex')

export const createPushService = (db: Database) => ({
  list: async (userId: string) => db.select({ endpoint: pushSubscriptions.endpoint }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)),
  subscribe: async (userId: string, input: z.infer<typeof pushInput>) => {
    await db.insert(pushSubscriptions).values({ endpointHash: hash(input.endpoint), userId, endpoint: input.endpoint, ...input.keys })
      .onDuplicateKeyUpdate({ set: { userId, ...input.keys } })
    return { success: true }
  },
  unsubscribe: async (userId: string, endpoint: string) => {
    await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpointHash, hash(endpoint))))
    return { success: true }
  },
})

export const startReminderPush = (app: FastifyInstance, db: Database, config: Config) => {
  if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY || !config.VAPID_SUBJECT) return
  const vapidDetails = { subject: config.VAPID_SUBJECT, publicKey: config.VAPID_PUBLIC_KEY, privateKey: config.VAPID_PRIVATE_KEY }
  webpush.getVapidHeaders('https://fcm.googleapis.com', vapidDetails.subject, vapidDetails.publicKey, vapidDetails.privateKey, 'aes128gcm')
  let stopping = false
  let active: Promise<void> | undefined
  const deliver = async () => {
    for (let count = 0; count < 100 && !stopping; count++) {
      const processed = await db.transaction(async tx => {
        const [row] = await tx.select().from(reminders).where(and(
          eq(reminders.status, 'pending'), eq(reminders.notifyByPush, 'yes'), isNull(reminders.pushNotifiedAt), lte(reminders.dueAt, new Date()),
          or(isNull(reminders.pushAttemptAt), lt(reminders.pushAttemptAt, new Date(Date.now() - 5 * 60000))),
        )).orderBy(reminders.dueAt).limit(1).for('update', { skipLocked: true })
        if (!row) return false
        await tx.update(reminders).set({ pushAttemptAt: new Date() }).where(eq(reminders.id, row.id))
        const [entry] = await tx.select().from(entries).where(eq(entries.id, row.entryId))
        const access = await loadAccess(tx, row.creatorId)
        if (!entry || !access.permissions.has(entry.groupId)) return true
        const subscriptions = await tx.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, row.creatorId))
        let failed = subscriptions.length === 0
        for (const subscription of subscriptions) {
          try {
            pushEndpoint.parse(subscription.endpoint)
            await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({
              title: 'Memties', body: row.language === 'fr' ? 'Un rappel vous attend dans Memties.' : 'A reminder is waiting in Memties.',
              tag: `reminder-${row.id}`,
            }), { vapidDetails, TTL: 3600, timeout: 10000 })
          } catch (error) {
            if (error instanceof webpush.WebPushError && [404, 410].includes(error.statusCode)) {
              await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.endpointHash, subscription.endpointHash))
            } else { failed = true; app.log.warn('Reminder push delivery failed; retrying later') }
          }
        }
        if (!failed) await tx.update(reminders).set({ pushNotifiedAt: new Date() }).where(eq(reminders.id, row.id))
        return true
      })
      if (!processed) break
    }
  }
  const tick = () => {
    if (active || stopping) return
    active = deliver().catch(() => app.log.error('Reminder push worker failed')).finally(() => { active = undefined })
  }
  const timer = setInterval(tick, 60000)
  timer.unref()
  app.addHook('onClose', async () => { stopping = true; clearInterval(timer); await active })
}

