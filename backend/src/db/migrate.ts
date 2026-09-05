import { migrate } from 'drizzle-orm/mysql2/migrator'
import { readConfig } from '../config.js'
import { connectDatabase } from './index.js'

const { db, pool } = connectDatabase(readConfig().DATABASE_URL)
try {
  await migrate(db, { migrationsFolder: './drizzle' })
  console.info('Database migrations applied.')
} finally {
  await pool.end()
}
