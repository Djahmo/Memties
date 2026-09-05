import Fastify from 'fastify'
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

declare module 'fastify' {
  interface FastifyRequest { user: User | null }
}

type Services = { auth: ReturnType<typeof createAuthService>; groups: ReturnType<typeof createGroupService>; content?: ContentServices; sharing?: ReturnType<typeof createSharingService> }

export const createApp = async (config: Config, services: Services) => {
  const app = Fastify({ logger: config.NODE_ENV !== 'test', bodyLimit: 128 * 1024 })
  await app.register(cookie)
  await app.register(rateLimit, { global: false })
  app.decorateRequest('user', null)
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    reply.header('X-Content-Type-Options', 'nosniff')
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.origin !== config.APP_ORIGIN) {
      throw new ServiceError(403, 'Request origin is not allowed.')
    }
    request.user = await services.auth.authenticate(request.cookies.memties_session)
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
  await app.register(async scope => authRoutes(scope, services.auth, config))
  await app.register(async scope => groupRoutes(scope, services.groups))
  if (services.content) await app.register(async scope => contentRoutes(scope, services.content!))
  if (services.sharing) await app.register(async scope => sharingRoutes(scope, services.sharing!))
  return app
}
