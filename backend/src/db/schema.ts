import { datetime, index, mysqlEnum, mysqlTable, primaryKey, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'
import type { AnyMySqlColumn } from 'drizzle-orm/mysql-core'

export const users = mysqlTable('users', {
  id: varchar('id', { length: 36 }).primaryKey(),
  email: varchar('email', { length: 254 }).notNull().unique(),
  displayName: varchar('display_name', { length: 120 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
})

export const identities = mysqlTable('auth_identities', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 80 }).notNull(),
  subject: varchar('subject', { length: 254 }).notNull(),
  passwordHash: varchar('password_hash', { length: 256 }),
}, table => [uniqueIndex('identity_provider_subject').on(table.provider, table.subject)])

export const sessions = mysqlTable('sessions', {
  tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
}, table => [index('session_expiry').on(table.expiresAt)])

export const groups = mysqlTable('groups', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  description: varchar('description', { length: 2000 }).notNull().default(''),
  parentId: varchar('parent_id', { length: 36 }).references((): AnyMySqlColumn => groups.id, { onDelete: 'restrict' }),
  // Only the system Personal root has this field. Children inherit its privacy.
  personalOwnerId: varchar('personal_owner_id', { length: 36 }).unique().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, table => [index('group_parent').on(table.parentId)])

export const groupMembers = mysqlTable('group_members', {
  groupId: varchar('group_id', { length: 36 }).notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: mysqlEnum('role', ['owner', 'editor', 'viewer']).notNull(),
}, table => [primaryKey({ columns: [table.groupId, table.userId] }), index('member_user').on(table.userId)])

export const people = mysqlTable('people', {
  id: varchar('id', { length: 36 }).primaryKey(),
  firstName: varchar('first_name', { length: 120 }).notNull().default(''),
  lastName: varchar('last_name', { length: 120 }).notNull().default(''),
  displayName: varchar('display_name', { length: 240 }).notNull(),
  nickname: varchar('nickname', { length: 120 }).notNull().default(''),
  email: varchar('email', { length: 254 }).notNull().default(''),
  phone: varchar('phone', { length: 80 }).notNull().default(''),
  organization: varchar('organization', { length: 240 }).notNull().default(''),
  jobTitle: varchar('job_title', { length: 240 }).notNull().default(''),
  notes: text('notes').notNull(),
  creatorId: varchar('creator_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, table => [index('person_name').on(table.displayName), index('person_email').on(table.email)])

export const personGroups = mysqlTable('person_groups', {
  personId: varchar('person_id', { length: 36 }).notNull().references(() => people.id, { onDelete: 'cascade' }),
  groupId: varchar('group_id', { length: 36 }).notNull().references(() => groups.id, { onDelete: 'restrict' }),
}, table => [primaryKey({ columns: [table.personId, table.groupId] }), index('person_group_scope').on(table.groupId, table.personId)])

export const entries = mysqlTable('entries', {
  id: varchar('id', { length: 36 }).primaryKey(),
  title: varchar('title', { length: 240 }).notNull(),
  body: text('body').notNull(),
  occurredAt: datetime('occurred_at', { mode: 'date', fsp: 3 }).notNull(),
  groupId: varchar('group_id', { length: 36 }).notNull().references(() => groups.id, { onDelete: 'restrict' }),
  creatorId: varchar('creator_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'restrict' }),
  source: mysqlEnum('source', ['web', 'mcp']).notNull().default('web'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, table => [index('entry_group_date').on(table.groupId, table.occurredAt, table.id)])

export const entryPeople = mysqlTable('entry_people', {
  entryId: varchar('entry_id', { length: 36 }).notNull().references(() => entries.id, { onDelete: 'cascade' }),
  personId: varchar('person_id', { length: 36 }).notNull().references(() => people.id, { onDelete: 'restrict' }),
}, table => [primaryKey({ columns: [table.entryId, table.personId] }), index('person_history').on(table.personId, table.entryId)])

export const reminders = mysqlTable('reminders', {
  id: varchar('id', { length: 36 }).primaryKey(),
  entryId: varchar('entry_id', { length: 36 }).notNull().references(() => entries.id, { onDelete: 'restrict' }),
  title: varchar('title', { length: 240 }).notNull(),
  dueAt: datetime('due_at', { mode: 'date', fsp: 3 }).notNull(),
  status: mysqlEnum('status', ['pending', 'completed']).notNull().default('pending'),
  creatorId: varchar('creator_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'restrict' }),
  notifyByEmail: mysqlEnum('notify_by_email', ['yes', 'no']).notNull().default('no'),
  notifyByPush: mysqlEnum('notify_by_push', ['yes', 'no']).notNull().default('no'),
  pushNotifiedAt: datetime('push_notified_at', { mode: 'date', fsp: 3 }),
  pushAttemptAt: datetime('push_attempt_at', { mode: 'date', fsp: 3 }),
  language: mysqlEnum('language', ['fr', 'en']).notNull().default('en'),
  notifiedAt: datetime('notified_at', { mode: 'date', fsp: 3 }),
  notificationAttemptAt: datetime('notification_attempt_at', { mode: 'date', fsp: 3 }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, table => [index('reminder_entry').on(table.entryId), index('reminder_due').on(table.status, table.dueAt, table.id)])

export const apiTokens = mysqlTable('api_tokens', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  access: mysqlEnum('access', ['read', 'write']).notNull().default('read'),
  expiresAt: datetime('expires_at', { mode: 'date', fsp: 3 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, table => [index('api_token_user').on(table.userId)])

export const samlRequests = mysqlTable('saml_requests', {
  id: varchar('id', { length: 200 }).primaryKey(),
  value: text('value').notNull(),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull(),
})

export const oauthRecords = mysqlTable('oauth_records', {
  id: varchar('id', { length: 80 }).primaryKey(),
  value: text('value').notNull(),
  expiresAt: datetime('expires_at', { mode: 'date', fsp: 3 }).notNull(),
}, table => [index('oauth_expiry').on(table.expiresAt)])

export const pushSubscriptions = mysqlTable('push_subscriptions', {
  endpointHash: varchar('endpoint_hash', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  p256dh: varchar('p256dh', { length: 100 }).notNull(),
  auth: varchar('auth', { length: 30 }).notNull(),
}, table => [index('push_user').on(table.userId)])
