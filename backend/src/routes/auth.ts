import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Config } from '../config.js'
import { sessionLifetime } from '../auth/service.js'
import type { createAuthService } from '../auth/service.js'
import { ServiceError } from '../services/errors.js'

const credentials = z.object({
  email: z.email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(1).max(256),
}).strict()
const registration = credentials.extend({
  displayName: z.string().trim().min(1).max(120),
  password: z.string().min(12).max(256),
})

export const authRoutes = async (app: FastifyInstance, auth: ReturnType<typeof createAuthService>, config: Config) => {
  const cookieOptions = { path: '/', httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'lax' as const }
  const limits = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }

  const localEnabled = config.SAML_ONLY !== 'true'
  app.get('/api/auth/config', async () => ({ localEnabled, registrationEnabled: localEnabled && config.ALLOW_REGISTRATION, ldapEnabled: localEnabled && !!config.LDAP_URL, samlEnabled: !!config.SAML_ENTRY_POINT }))
  app.get('/api/auth/me', async request => {
    if (!request.user) throw new ServiceError(401, 'Please sign in.')
    return request.user
  })
  app.post('/api/auth/register', limits, async (request, reply) => {
    if (!localEnabled || !config.ALLOW_REGISTRATION) throw new ServiceError(403, 'Registration is disabled.')
    const result = await auth.register(registration.parse(request.body))
    reply.setCookie('memties_session', result.token, { ...cookieOptions, maxAge: sessionLifetime })
    return reply.code(201).send(result.user)
  })
  app.post('/api/auth/login', limits, async (request, reply) => {
    if (!localEnabled) throw new ServiceError(403, 'Local sign-in is disabled.')
    const input = credentials.parse(request.body)
    const result = await auth.login(input.email, input.password)
    await auth.logout(request.cookies.memties_session)
    reply.setCookie('memties_session', result.token, { ...cookieOptions, maxAge: sessionLifetime })
    return result.user
  })
  app.post('/api/auth/logout', async (request, reply) => {
    await auth.logout(request.cookies.memties_session)
    reply.clearCookie('memties_session', cookieOptions)
    return { success: true }
  })
}
