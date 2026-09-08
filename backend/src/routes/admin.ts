import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { createAdminService } from '../services/admin.js'
import { ServiceError } from '../services/errors.js'

export const adminRoutes = async (app: FastifyInstance, service: ReturnType<typeof createAdminService>) => {
  app.addHook('preHandler', async request => {
    if (!request.user) throw new ServiceError(401, 'Please sign in.')
    if (request.user.role !== 'admin') throw new ServiceError(403, 'Administrator access is required.')
  })
  app.get('/api/admin/users', async request => {
    const { offset } = z.object({ offset: z.coerce.number().int().min(0).max(1000000).default(0) }).parse(request.query)
    return service.list(offset)
  })
  app.patch('/api/admin/users/:id', async request => {
    const { id } = z.object({ id: z.uuid() }).parse(request.params)
    const { status } = z.object({ status: z.enum(['active', 'suspended']) }).strict().parse(request.body)
    const result = await service.setStatus(request.user!.id, id, status)
    request.log.info({ actorId: request.user!.id, userId: id, status }, 'Administrator changed account status')
    return result
  })
  app.delete('/api/admin/users/:id', async request => {
    const { id } = z.object({ id: z.uuid() }).parse(request.params)
    const { email } = z.object({ email: z.email().max(254) }).strict().parse(request.body)
    const result = await service.remove(request.user!.id, id, email)
    request.log.info({ actorId: request.user!.id, userId: id }, 'Administrator deleted account and data')
    return result
  })
}
