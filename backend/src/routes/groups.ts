import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { createGroupService } from '../services/groups.js'
import { ServiceError } from '../services/errors.js'

const fields = z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(2000).default('') }).strict()

export const groupRoutes = async (app: FastifyInstance, groups: ReturnType<typeof createGroupService>) => {
  app.addHook('preHandler', async request => {
    if (!request.user) throw new ServiceError(401, 'Please sign in.')
  })
  app.get('/api/groups', async request => groups.list(request.user!.id))
  app.post('/api/groups', async (request, reply) => {
    const input = fields.extend({ parentId: z.uuid().nullable().default(null) }).parse(request.body)
    return reply.code(201).send(await groups.create(request.user!.id, input))
  })
  app.patch('/api/groups/:id', async request => {
    const { id } = z.object({ id: z.uuid() }).parse(request.params)
    return groups.update(request.user!.id, id, fields.parse(request.body))
  })
}
