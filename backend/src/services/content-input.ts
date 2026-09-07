import { z } from 'zod'

const shortText = (length: number) => z.string().trim().max(length).default('')
const ids = z.array(z.uuid()).max(200)

export const reminderFields = z.object({
  title: z.string().trim().min(1).max(240),
  dueAt: z.iso.datetime({ offset: true }).transform(value => new Date(value)).refine(value => value.getUTCFullYear() >= 1000 && value.getUTCFullYear() <= 9999, 'Invalid reminder date'),
  notifyByPush: z.boolean().default(false),
  notifyByEmail: z.boolean().default(false),
  language: z.enum(['fr', 'en']).default('en'),
}).strict()
export const reminderInput = reminderFields.extend({ entryId: z.uuid() })
export const reminderListInput = z.object({
  groupId: z.uuid().optional(), entryId: z.uuid().optional(), personId: z.uuid().optional(),
  status: z.enum(['pending', 'completed', 'all']).default('pending'),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(30),
}).strict()

export const personInput = z.object({
  displayName: z.string().trim().min(1).max(240),
  firstName: shortText(120), lastName: shortText(120), nickname: shortText(120),
  email: z.union([z.email().max(254), z.literal('')]).default(''),
  phone: shortText(80), organization: shortText(240), jobTitle: shortText(240), notes: shortText(10000),
  groupIds: ids.min(1),
}).strict()

export const entryInput = z.object({
  title: z.string().trim().min(1).max(240), body: z.string().max(10000).default(''),
  occurredAt: z.iso.datetime({ offset: true }).transform(value => new Date(value)).refine(value => value.getUTCFullYear() >= 1000 && value.getUTCFullYear() <= 9999, 'Date must be between years 1000 and 9999'),
  groupId: z.uuid(), personIds: ids.default([]),
  reminder: reminderFields.optional(),
}).strict()

export const listInput = z.object({
  groupId: z.uuid().optional(), q: z.string().trim().max(200).default(''),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(30),
}).strict()

export const historyInput = listInput.extend({
  personId: z.uuid().optional(), participantId: z.uuid().optional(),
  from: z.iso.datetime({ offset: true }).transform(value => new Date(value)).optional(),
  to: z.iso.datetime({ offset: true }).transform(value => new Date(value)).optional(),
}).refine(input => !input.from || !input.to || input.from <= input.to, 'The end date must follow the start date')

export type PersonInput = z.infer<typeof personInput>
export type EntryInput = z.infer<typeof entryInput>
export type ListInput = z.infer<typeof listInput>
export type HistoryInput = z.infer<typeof historyInput>
export const searchPattern = (text: string) => `%${text.replace(/[!%_]/g, value => `!${value}`)}%`
