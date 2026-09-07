import { createPushService, startReminderPush } from './services/push.js'
import { readConfig } from './config.js'
import { connectDatabase } from './db/index.js'
import { createAuthService } from './auth/service.js'
import { createGroupService } from './services/groups.js'
import { createApp } from './app.js'
import { users } from './db/schema.js'
import { createPeopleService } from './services/people.js'
import { createEntryService } from './services/entries.js'
import { createSharingService } from './services/sharing.js'
import { createReminderService } from './services/reminders.js'
import { createTokenService } from './auth/tokens.js'
import { createProviderService } from './auth/providers.js'
import { startReminderMail } from './services/mail.js'
import { createContactImportService } from './services/contact-import.js'
import { createTransferService } from './services/transfer.js'

const config = readConfig()
const { db, pool } = connectDatabase(config.DATABASE_URL)
const auth = createAuthService(db)
const app = await createApp(config, {
  db,
  push: createPushService(db),
  contacts: createContactImportService(db),
  transfer: createTransferService(db),
  auth, providers: await createProviderService(db, auth, config), tokens: createTokenService(db), reminders: createReminderService(db),
  groups: createGroupService(db), sharing: createSharingService(db), content: { people: createPeopleService(db), entries: createEntryService(db) },
})
app.addHook('onClose', async () => { await pool.end() })
startReminderMail(app, db, config)
startReminderPush(app, db, config)
const shutdown = async () => { await app.close() }
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

try {
  await db.select({ id: users.id }).from(users).limit(1)
  await app.listen({ host: config.HOST, port: config.PORT })
} catch (error) {
  app.log.error({ err: error }, 'Startup failed. Check DATABASE_URL and run pnpm db:migrate.')
  await app.close()
  process.exitCode = 1
}
