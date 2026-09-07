import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from './schema.js'

export const connectDatabase = (url: string) => {
  const pool = mysql.createPool({ uri: url, connectionLimit: 10, timezone: 'Z' })
  return { db: drizzle(pool, { schema, mode: 'default' }), pool }
}

export type Database = ReturnType<typeof connectDatabase>['db']
export type ServiceDatabase = Pick<Database, 'select' | 'insert' | 'update' | 'delete' | 'transaction'>
