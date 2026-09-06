import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import formbody from '@fastify/formbody'
import type { Config } from '../config.js'
import type { createProviderService } from '../auth/providers.js'
import type { createAuthService } from '../auth/service.js'
import { sessionLifetime } from '../auth/service.js'
import { ServiceError } from '../services/errors.js'

export const providerRoutes = async (app: FastifyInstance, service: Awaited<ReturnType<typeof createProviderService>>, auth: ReturnType<typeof createAuthService>, config: Config) => {
  const limits = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }
  const sessionCookie = { path: '/', httpOnly: true, secure: config.NODE_ENV === 'production' || config.APP_ORIGIN.startsWith('https://'), sameSite: 'lax' as const, maxAge: sessionLifetime }
  const flowCookie = { path: '/api/auth/saml', httpOnly: true, secure: true, sameSite: 'none' as const, maxAge: 600 }
  if (config.LDAP_URL) app.post('/api/auth/ldap', limits, async (request, reply) => {
    const input = z.object({ username: z.string().trim().min(1).max(254), password: z.string().min(1).max(256), link: z.boolean().default(false) }).strict().parse(request.body)
    if (input.link && !request.user) throw new ServiceError(401, 'Please sign in.')
    const result = await service.ldap(input.username, input.password, input.link ? request.user!.id : undefined)
    await auth.logout(request.cookies.memties_session)
    reply.setCookie('memties_session', result.token, sessionCookie)
    return result.user
  })
  if (!config.SAML_ENTRY_POINT) return
  await app.register(formbody)
  app.get('/api/auth/saml/metadata', async (_request, reply) => reply.type('application/samlmetadata+xml').send(service.samlMetadata()))
  app.post('/api/auth/saml/start', limits, async (request, reply) => {
    const { link } = z.object({ link: z.boolean().default(false) }).strict().parse(request.body ?? {})
    if (link && !request.user) throw new ServiceError(401, 'Please sign in.')
    const result = await service.samlStart(link ? request.user!.id : undefined)
    reply.setCookie('memties_saml', result.state, flowCookie)
    return { url: result.url }
  })
  app.post('/api/auth/saml/callback', limits, async (request, reply) => {
    try {
      const input = z.object({ SAMLResponse: z.string().min(1).max(120000), RelayState: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(request.body)
      if (!request.cookies.memties_saml || input.RelayState !== request.cookies.memties_saml) throw new ServiceError(401, 'Single sign-on failed. Please try again.')
      const result = await service.samlComplete(input.RelayState, input.SAMLResponse)
      await auth.logout(request.cookies.memties_session)
      reply.setCookie('memties_session', result.token, sessionCookie)
      reply.clearCookie('memties_saml', flowCookie)
      return reply.redirect(config.APP_ORIGIN)
    } catch (error) {
      reply.clearCookie('memties_saml', flowCookie)
      const collision = error instanceof ServiceError && error.message === 'Sign in to your existing account and link this provider in settings.'
      return reply.redirect(`${config.APP_ORIGIN}/?authError=${collision ? 'link' : 'saml'}`)
    }
  })
}
