import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_FORMAT: z.enum(['pretty', 'json']).optional(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).optional(),
  HOST: z.string().default('127.0.0.1'),
  SERVE_FRONTEND: z.enum(['true', 'false']).optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_ORIGIN: z.url().refine(value => new URL(value).origin === value, 'Use an origin without a trailing slash or path'),
  DATABASE_URL: z.string().startsWith('mysql://'),
  ALLOW_REGISTRATION: z.enum(['true', 'false']).default('true').transform(value => value === 'true'),
  VAPID_PUBLIC_KEY: z.string().regex(/^[A-Za-z0-9_-]{87}$/).optional(),
  VAPID_PRIVATE_KEY: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
  VAPID_SUBJECT: z.string().regex(/^(mailto:|https:\/\/).+/).optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_SECURE: z.enum(['true', 'false']).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.email().optional(),
  LDAP_URL: z.url().refine(value => value.startsWith('ldaps://'), 'Use LDAPS with a trusted certificate').optional(),
  LDAP_BIND_DN: z.string().min(1).optional(),
  LDAP_BIND_PASSWORD: z.string().min(1).optional(),
  LDAP_BASE_DN: z.string().min(1).optional(),
  LDAP_LOGIN_ATTRIBUTE: z.string().regex(/^[a-zA-Z][a-zA-Z0-9-]*$/).optional(),
  LDAP_ID_ATTRIBUTE: z.string().regex(/^[a-zA-Z][a-zA-Z0-9-]*$/).optional(),
  LDAP_EMAIL_ATTRIBUTE: z.string().regex(/^[a-zA-Z][a-zA-Z0-9-]*$/).optional(),
  LDAP_NAME_ATTRIBUTE: z.string().regex(/^[a-zA-Z][a-zA-Z0-9-]*$/).optional(),
  SAML_ENTRY_POINT: z.url().refine(value => value.startsWith('https://')).optional(),
  SAML_ONLY: z.enum(['true', 'false']).optional(),
  ADMIN_EMAILS: z.string().optional().superRefine((value, context) => {
    if (value && value.split(',').some(email => !z.email().safeParse(email.trim()).success)) context.addIssue({ code: 'custom', message: 'Use comma-separated administrator email addresses' })
  }),
  SAML_IDP_ISSUER: z.string().min(1).optional(),
  SAML_IDP_CERT_FILE: z.string().min(1).optional(),
  SAML_SP_KEY_FILE: z.string().min(1).optional(),
  SAML_SP_CERT_FILE: z.string().min(1).optional(),
  SAML_EMAIL_ATTRIBUTE: z.string().optional(),
  SAML_NAME_ATTRIBUTE: z.string().optional(),
}).superRefine((value, context) => {
  if (value.SAML_ONLY === 'true' && !value.SAML_ENTRY_POINT) context.addIssue({ code: 'custom', path: ['SAML_ENTRY_POINT'], message: 'Required when SAML_ONLY is true' })
  if (value.NODE_ENV === 'production' && !value.APP_ORIGIN.startsWith('https://')) {
    context.addIssue({ code: 'custom', path: ['APP_ORIGIN'], message: 'HTTPS is required in production' })
  }
  for (const [enabled, required] of [
    [value.VAPID_PUBLIC_KEY || value.VAPID_PRIVATE_KEY || value.VAPID_SUBJECT, ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']],
    [value.SMTP_HOST, ['SMTP_FROM']],
    [value.LDAP_URL, ['LDAP_BIND_DN', 'LDAP_BIND_PASSWORD', 'LDAP_BASE_DN']],
    [value.SAML_ENTRY_POINT, ['SAML_IDP_ISSUER', 'SAML_IDP_CERT_FILE']],
    [value.SAML_SP_KEY_FILE || value.SAML_SP_CERT_FILE, ['SAML_SP_KEY_FILE', 'SAML_SP_CERT_FILE']],
  ] as const) {
    if (enabled) for (const field of required) if (!value[field]) context.addIssue({ code: 'custom', path: [field], message: 'Required when this integration is enabled' })
  }
  if (!!value.SMTP_USER !== !!value.SMTP_PASSWORD) context.addIssue({ code: 'custom', path: ['SMTP_USER'], message: 'Set both SMTP_USER and SMTP_PASSWORD' })
  if (value.SAML_ENTRY_POINT && !value.APP_ORIGIN.startsWith('https://')) context.addIssue({ code: 'custom', path: ['APP_ORIGIN'], message: 'SAML requires HTTPS for its cross-site correlation cookie' })
})

export type Config = z.infer<typeof schema>

export const readConfig = (): Config => {
  try { process.loadEnvFile('.env') } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
  }
  return schema.parse(process.env)
}
