import nodemailer from 'nodemailer'
import { and, eq, isNull, lt, lte, or } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { Config } from '../config.js'
import type { Database } from '../db/index.js'
import { entries, reminders, users } from '../db/schema.js'
import { loadAccess } from './access.js'

export const startReminderMail = (app: FastifyInstance, db: Database, config: Config) => {
  if (!config.SMTP_HOST || !config.SMTP_FROM) return
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST, port: config.SMTP_PORT ?? 587, secure: config.SMTP_SECURE === 'true',
    requireTLS: config.SMTP_SECURE !== 'true', connectionTimeout: 10000, socketTimeout: 15000,
    ...(config.SMTP_USER ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } } : {}),
  })
  let stopping = false
  let active: Promise<void> | undefined
  const deliver = async () => {
    for (let count = 0; count < 100 && !stopping; count++) {
      const processed = await db.transaction(async tx => {
        const [row] = await tx.select().from(reminders).where(and(
          eq(reminders.status, 'pending'), eq(reminders.notifyByEmail, 'yes'), isNull(reminders.notifiedAt), lte(reminders.dueAt, new Date()),
          or(isNull(reminders.notificationAttemptAt), lt(reminders.notificationAttemptAt, new Date(Date.now() - 5 * 60000))),
        )).orderBy(reminders.dueAt).limit(1).for('update', { skipLocked: true })
        if (!row) return false
        await tx.update(reminders).set({ notificationAttemptAt: new Date() }).where(eq(reminders.id, row.id))
        const [entry] = await tx.select().from(entries).where(eq(entries.id, row.entryId)).limit(1)
        const access = await loadAccess(tx, row.creatorId)
        if (!entry || !access.permissions.has(entry.groupId)) return true
        const [user] = await tx.select().from(users).where(eq(users.id, row.creatorId)).limit(1)
        if (!user) return true
        try {
          // Email contains no relationship data, even if access changes during delivery.
          await transport.sendMail({ from: config.SMTP_FROM, to: user.email,
            subject: row.language === 'fr' ? 'Memties : un rappel est arrivé à échéance' : 'Memties: a reminder is due',
            text: row.language === 'fr' ? `Un rappel vous attend dans Memties. Connectez-vous pour le consulter :\n${config.APP_ORIGIN}\n` : `A reminder is waiting in Memties. Sign in to view it:\n${config.APP_ORIGIN}\n`,
          })
          await tx.update(reminders).set({ notifiedAt: new Date() }).where(eq(reminders.id, row.id))
        } catch { app.log.warn('Reminder email delivery failed; retrying later') }
        return true
      })
      if (!processed) break
    }
  }
  const tick = () => {
    if (active || stopping) return
    active = deliver().catch(() => { app.log.error('Reminder notification worker failed') }).finally(() => { active = undefined })
  }
  const timer = setInterval(tick, 60000)
  timer.unref()
  app.addHook('onClose', async () => { stopping = true; clearInterval(timer); await active; transport.close() })
}
