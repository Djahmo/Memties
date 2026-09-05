import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_ORIGIN: z.url().refine(value => new URL(value).origin === value, 'Use an origin without a trailing slash or path'),
  DATABASE_URL: z.string().startsWith('mysql://'),
  ALLOW_REGISTRATION: z.enum(['true', 'false']).default('true').transform(value => value === 'true'),
}).superRefine((value, context) => {
  if (value.NODE_ENV === 'production' && !value.APP_ORIGIN.startsWith('https://')) {
    context.addIssue({ code: 'custom', path: ['APP_ORIGIN'], message: 'HTTPS is required in production' })
  }
})

export type Config = z.infer<typeof schema>

export const readConfig = (): Config => {
  try { process.loadEnvFile('.env') } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
  }
  return schema.parse(process.env)
}
