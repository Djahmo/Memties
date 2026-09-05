import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { createSharingService } from '../services/sharing.js'
import { ServiceError } from '../services/errors.js'

export const sharingRoutes = async (app: FastifyInstance, sharing: ReturnType<typeof createSharingService>) => {
  app.addHook('preHandler', async request => { if (!request.user) throw new ServiceError(401, 'Please sign in.') })
  const groupId = z.object({ id: z.uuid() })
  app.get('/api/groups/:id/members', async request => sharing.list(request.user!.id, groupId.parse(request.params).id))
  app.put('/api/groups/:id/members', async request => {
    const input = z.object({ email: z.email().max(254).transform(value => value.toLowerCase()), role: z.enum(['owner', 'editor', 'viewer']) }).strict().parse(request.body)
    await sharing.set(request.user!.id, groupId.parse(request.params).id, input)
    return { success: true }
  })
  app.delete('/api/groups/:id/members/:userId', async request => {
    const params = groupId.extend({ userId: z.uuid() }).parse(request.params)
    await sharing.remove(request.user!.id, params.id, params.userId)
    return { success: true }
  })
}
