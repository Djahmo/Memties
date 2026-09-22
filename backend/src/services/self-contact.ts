import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { ServiceDatabase } from '../db/index.js'
import { people, personGroups } from '../db/schema.js'
import { ServiceError } from './errors.js'

export const createSelfContact = async (db: ServiceDatabase, user: { id: string; displayName: string; email: string }, groupId: string) => {
  const id = randomUUID()
  await db.insert(people).values({ id, userId: user.id, creatorId: user.id, displayName: user.displayName, email: user.email, notes: '' })
  await db.insert(personGroups).values({ personId: id, groupId })
}

export const selfContactId = async (db: Pick<ServiceDatabase, 'select'>, userId: string) => {
  const [person] = await db.select({ id: people.id }).from(people).where(eq(people.userId, userId)).limit(1)
  if (!person) throw new ServiceError(404, 'Your personal contact is unavailable.')
  return person.id
}
