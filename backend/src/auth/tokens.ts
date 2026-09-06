import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { and, desc, eq, gt } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { apiTokens, users } from '../db/schema.js'
import { ServiceError } from '../services/errors.js'

const hash = (token: string) => createHash('sha256').update(token).digest('hex')
export const createTokenService = (db: Database) => ({
  list: async (userId: string) => db.select({ id: apiTokens.id, name: apiTokens.name, access: apiTokens.access, createdAt: apiTokens.createdAt, expiresAt: apiTokens.expiresAt })
    .from(apiTokens).where(eq(apiTokens.userId, userId)).orderBy(desc(apiTokens.createdAt)),
  create: async (userId: string, input: { name: string; access: 'read' | 'write'; days: number }) => {
    const token = `mem_${randomBytes(32).toString('hex')}`
    const id = randomUUID()
    const expiresAt = new Date(Date.now() + input.days * 86400000)
    await db.transaction(async tx => {
      await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update')
      const active = await tx.select({ id: apiTokens.id }).from(apiTokens).where(and(eq(apiTokens.userId, userId), gt(apiTokens.expiresAt, new Date())))
      if (active.length >= 20) throw new ServiceError(409, 'Revoke an existing token before creating another.')
      await tx.insert(apiTokens).values({ id, tokenHash: hash(token), userId, name: input.name, access: input.access, expiresAt })
    })
    return { id, token, expiresAt }
  },
  revoke: async (userId: string, id: string) => {
    await db.delete(apiTokens).where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)))
    return { success: true }
  },
  authenticate: async (token: string | undefined) => {
    if (!token || !/^mem_[a-f0-9]{64}$/.test(token)) return null
    const [row] = await db.select({ userId: apiTokens.userId, access: apiTokens.access }).from(apiTokens)
      .where(and(eq(apiTokens.tokenHash, hash(token)), gt(apiTokens.expiresAt, new Date()))).limit(1)
    return row ?? null
  },
})
