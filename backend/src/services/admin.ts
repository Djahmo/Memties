import { asc, eq, inArray } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { apiTokens, identities, sessions, users } from '../db/schema.js'
import { accountRole, administratorEmails } from '../auth/admin.js'
import { ServiceError } from './errors.js'

export const createAdminService = (db: Database, adminEmails = '') => {
  const admins = administratorEmails(adminEmails)
  return {
    list: async (offset: number) => {
      const rows = await db.select({ id: users.id, email: users.email, displayName: users.displayName, status: users.status, createdAt: users.createdAt })
        .from(users).orderBy(asc(users.createdAt), asc(users.id)).limit(51).offset(offset)
      const page = rows.slice(0, 50)
      const methods = page.length ? await db.select({ userId: identities.userId, provider: identities.provider }).from(identities).where(inArray(identities.userId, page.map(user => user.id))) : []
      return {
        items: page.map(user => ({ ...user, role: accountRole(user.email, admins), methods: [...new Set(methods.filter(method => method.userId === user.id).map(method => method.provider.split(':')[0]))] })),
        nextOffset: rows.length > 50 ? offset + 50 : null,
      }
    },
    setStatus: async (actorId: string, userId: string, status: 'active' | 'suspended') => db.transaction(async tx => {
      const [account] = await tx.select({ email: users.email }).from(users).where(eq(users.id, userId)).for('update')
      if (!account) throw new ServiceError(404, 'User not found.')
      if (status === 'suspended' && (actorId === userId || accountRole(account.email, admins) === 'admin')) throw new ServiceError(403, 'Administrator accounts cannot be suspended. Remove their email from ADMIN_EMAILS first.')
      await tx.update(users).set({ status }).where(eq(users.id, userId))
      if (status === 'suspended') {
        await tx.delete(sessions).where(eq(sessions.userId, userId))
        await tx.delete(apiTokens).where(eq(apiTokens.userId, userId))
      }
      return { success: true }
    }),
  }
}
