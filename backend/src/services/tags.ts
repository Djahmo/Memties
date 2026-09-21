import { randomUUID } from 'node:crypto'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { ServiceDatabase } from '../db/index.js'
import { entryTags, tags } from '../db/schema.js'
import { ServiceError } from './errors.js'

export const tagInput = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).transform(value => value.toLowerCase()),
}).strict()

export const assignEntryTag = async (db: ServiceDatabase, userId: string, entryId: string, tagId: string | null | undefined) => {
  if (tagId === undefined) return
  if (tagId !== null) {
    if (!(await db.select({ id: tags.id }).from(tags).where(and(eq(tags.id, tagId), eq(tags.userId, userId))).for('update')).length) throw new ServiceError(404, 'Tag not found.')
  }
  await db.delete(entryTags).where(and(eq(entryTags.entryId, entryId), eq(entryTags.userId, userId)))
  if (tagId !== null) await db.insert(entryTags).values({ entryId, userId, tagId })
}

export const createTagService = (db: ServiceDatabase) => ({
  list: async (userId: string) => db.select({ id: tags.id, name: tags.name, color: tags.color }).from(tags).where(eq(tags.userId, userId)).orderBy(asc(tags.name), asc(tags.id)),
  create: async (userId: string, input: z.infer<typeof tagInput>) => {
    const id = randomUUID()
    await db.insert(tags).values({ id, userId, ...input })
    return { id, ...input }
  },
  update: async (userId: string, id: string, input: z.infer<typeof tagInput>) => db.transaction(async tx => {
    if (!(await tx.select({ id: tags.id }).from(tags).where(and(eq(tags.id, id), eq(tags.userId, userId))).for('update')).length) throw new ServiceError(404, 'Tag not found.')
    await tx.update(tags).set(input).where(and(eq(tags.id, id), eq(tags.userId, userId)))
    return { id, ...input }
  }),
})
