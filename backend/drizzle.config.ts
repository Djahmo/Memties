import { defineConfig } from 'drizzle-kit'

try { process.loadEnvFile('.env') } catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')

export default defineConfig({
  dialect: 'mysql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL },
})
