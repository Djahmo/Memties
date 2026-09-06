import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { and, eq, gt, lt } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { groupMembers, groups, identities, sessions, users } from '../db/schema.js'
import { ServiceError } from '../services/errors.js'
import { hashPassword, verifyPassword } from './password.js'

export type User = Pick<typeof users.$inferSelect, 'id' | 'email' | 'displayName'>
export const sessionLifetime = 7 * 24 * 60 * 60
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')
const dummyHash = `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`

export const createAuthService = (db: Database) => {
  const createSession = async (user: User) => {
    const token = randomBytes(32).toString('hex')
    await db.insert(sessions).values({ tokenHash: tokenHash(token), userId: user.id, expiresAt: new Date(Date.now() + sessionLifetime * 1000) })
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
    return { user, token }
  }

  return {
    externalLogin: async (provider: string, subject: string, profile: { email: string; displayName: string }, linkUserId?: string) => {
      const user = await db.transaction(async tx => {
        const [identity] = await tx.select({ user: { id: users.id, email: users.email, displayName: users.displayName } }).from(identities)
          .innerJoin(users, eq(users.id, identities.userId)).where(and(eq(identities.provider, provider), eq(identities.subject, subject))).limit(1)
        if (identity) {
          if (linkUserId && identity.user.id !== linkUserId) throw new ServiceError(409, 'This identity is already linked to another account.')
          return identity.user
        }
        if (linkUserId) {
          const [existing] = await tx.select({ id: users.id, email: users.email, displayName: users.displayName }).from(users).where(eq(users.id, linkUserId)).for('update')
          if (!existing) throw new ServiceError(401, 'Please sign in.')
          await tx.insert(identities).values({ id: randomUUID(), userId: existing.id, provider, subject })
          return existing
        }
        const [collision] = await tx.select({ id: users.id }).from(users).where(eq(users.email, profile.email)).limit(1)
        if (collision) throw new ServiceError(409, 'Sign in to your existing account and link this provider in settings.')
        const created = { id: randomUUID(), ...profile }
        await tx.insert(users).values(created)
        await tx.insert(identities).values({ id: randomUUID(), userId: created.id, provider, subject })
        const groupId = randomUUID()
        await tx.insert(groups).values({ id: groupId, name: 'Personal', personalOwnerId: created.id })
        await tx.insert(groupMembers).values({ groupId, userId: created.id, role: 'owner' })
        return created
      })
      return createSession(user)
    },
    register: async (input: { email: string; displayName: string; password: string }) => {
      const user = { id: randomUUID(), email: input.email, displayName: input.displayName }
      const passwordHash = await hashPassword(input.password)
      try {
        await db.transaction(async tx => {
          await tx.insert(users).values(user)
          await tx.insert(identities).values({ id: randomUUID(), userId: user.id, provider: 'local', subject: user.email, passwordHash })
          const groupId = randomUUID()
          await tx.insert(groups).values({ id: groupId, name: 'Personal', personalOwnerId: user.id })
          await tx.insert(groupMembers).values({ groupId, userId: user.id, role: 'owner' })
        })
      } catch (error) {
        const cause = error instanceof Error && 'cause' in error ? error.cause : error
        if (cause && typeof cause === 'object' && 'code' in cause && cause.code === 'ER_DUP_ENTRY') {
          throw new ServiceError(409, 'Unable to create an account with this email.')
        }
        throw error
      }
      return createSession(user)
    },
    login: async (email: string, password: string) => {
      const [identity] = await db.select({ user: { id: users.id, email: users.email, displayName: users.displayName }, passwordHash: identities.passwordHash })
        .from(identities).innerJoin(users, eq(users.id, identities.userId))
        .where(and(eq(identities.provider, 'local'), eq(identities.subject, email))).limit(1)
      const valid = await verifyPassword(password, identity?.passwordHash ?? dummyHash)
      if (!identity || !valid) throw new ServiceError(401, 'Email or password is incorrect.')
      return createSession(identity.user)
    },
    authenticate: async (token: string | undefined): Promise<User | null> => {
      if (!token || !/^[a-f0-9]{64}$/.test(token)) return null
      const [result] = await db.select({ id: users.id, email: users.email, displayName: users.displayName })
        .from(sessions).innerJoin(users, eq(users.id, sessions.userId))
        .where(and(eq(sessions.tokenHash, tokenHash(token)), gt(sessions.expiresAt, new Date()))).limit(1)
      return result ?? null
    },
    logout: async (token: string | undefined) => {
      if (token) await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)))
    },
  }
}
