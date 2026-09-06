import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { createTokenService } from '../auth/tokens.js'
import { ServiceError } from '../services/errors.js'

export const tokenRoutes = async (app: FastifyInstance, service: ReturnType<typeof createTokenService>) => {
  app.addHook('preHandler', async request => { if (!request.user) throw new ServiceError(401, 'Please sign in.') })
  app.get('/api/tokens', async request => service.list(request.user!.id))
  app.post('/api/tokens', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => reply.code(201).send(await service.create(request.user!.id,
    z.object({ name: z.string().trim().min(1).max(120), access: z.enum(['read', 'write']).default('read'), days: z.number().int().min(1).max(365).default(90) }).strict().parse(request.body))))
  app.delete('/api/tokens/:id', async request => service.revoke(request.user!.id, z.object({ id: z.uuid() }).parse(request.params).id))
}
