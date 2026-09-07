import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { fileURLToPath } from 'node:url'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import { ZodError } from 'zod'
import type { Config } from './config.js'
import type { User } from './auth/service.js'
import type { createAuthService } from './auth/service.js'
import type { createGroupService } from './services/groups.js'
import { ServiceError } from './services/errors.js'
import { authRoutes } from './routes/auth.js'
import { groupRoutes } from './routes/groups.js'
import { contentRoutes } from './routes/content.js'
import type { ContentServices } from './routes/content.js'
import { sharingRoutes } from './routes/sharing.js'
import type { createSharingService } from './services/sharing.js'
import { reminderRoutes } from './routes/reminders.js'
import type { createReminderService } from './services/reminders.js'
import { tokenRoutes } from './routes/tokens.js'
import type { createTokenService } from './auth/tokens.js'
import { providerRoutes } from './routes/providers.js'
import type { createProviderService } from './auth/providers.js'
import { mcpRoutes } from './mcp/server.js'
import { importRoutes } from './routes/imports.js'
import type { createContactImportService } from './services/contact-import.js'
import { transferRoutes } from './routes/transfer.js'
import type { createTransferService } from './services/transfer.js'

declare module 'fastify' {
  interface FastifyRequest { user: User | null }
}

type Services = {
  contacts?: ReturnType<typeof createContactImportService>
  transfer?: ReturnType<typeof createTransferService>
  auth: ReturnType<typeof createAuthService>; groups: ReturnType<typeof createGroupService>; content?: ContentServices; sharing?: ReturnType<typeof createSharingService>
  reminders?: ReturnType<typeof createReminderService>; tokens?: ReturnType<typeof createTokenService>; providers?: Awaited<ReturnType<typeof createProviderService>>
}

export const createApp = async (config: Config, services: Services) => {
  const app = Fastify({ logger: config.NODE_ENV !== 'test' ? { redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'] } : false, bodyLimit: 128 * 1024 })
  await app.register(cookie)
  await app.register(rateLimit, { global: false })
  app.decorateRequest('user', null)
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    reply.header('X-Content-Type-Options', 'nosniff')
    const isMcp = request.routeOptions.url === '/api/mcp'
    const isSamlCallback = !!config.SAML_ENTRY_POINT && request.routeOptions.url === '/api/auth/saml/callback' && request.method === 'POST'
    if (!isMcp && !isSamlCallback && !['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.origin !== config.APP_ORIGIN) {
      throw new ServiceError(403, 'Request origin is not allowed.')
    }
    if (!isMcp) request.user = await services.auth.authenticate(request.cookies.memties_session)
  })
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ message: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ') })
    if (error instanceof ServiceError) return reply.code(error.statusCode).send({ message: error.message })
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ message: error.message })
    }
    request.log.error({ err: error }, 'Request failed')
    return reply.code(500).send({ message: 'Something went wrong. Please try again.' })
  })
  app.get('/api/health', async () => ({ status: 'ok' }))
  if (services.contacts) await app.register(async scope => importRoutes(scope, services.contacts!))
  if (services.transfer) await app.register(async scope => transferRoutes(scope, services.transfer!))
  await app.register(async scope => authRoutes(scope, services.auth, config))
  await app.register(async scope => groupRoutes(scope, services.groups))
  if (services.content) await app.register(async scope => contentRoutes(scope, services.content!))
  if (services.sharing) await app.register(async scope => sharingRoutes(scope, services.sharing!))
  if (services.reminders) await app.register(async scope => reminderRoutes(scope, services.reminders!, !!config.SMTP_HOST, new URL(config.APP_ORIGIN).host))
  if (services.tokens) await app.register(async scope => tokenRoutes(scope, services.tokens!))
  if (services.providers) await app.register(async scope => providerRoutes(scope, services.providers!, services.auth, config))
  if (services.content && services.tokens && services.reminders) {
    const mcp = { ...services.content, groups: services.groups, tokens: services.tokens, reminders: services.reminders }
    await app.register(async scope => mcpRoutes(scope, mcp, config))
  }
  if (config.SERVE_FRONTEND === 'true') {
    await app.register(fastifyStatic, { root: fileURLToPath(new URL('../../frontend/dist', import.meta.url)) })
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method)) return reply.code(404).send({ message: 'Not found.' })
      return reply.sendFile('index.html')
    })
  }
  return app
}
