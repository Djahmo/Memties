import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { transferInput } from '../services/transfer.js'
import type { createTransferService } from '../services/transfer.js'
import { ServiceError } from '../services/errors.js'

export const transferRoutes = async (app: FastifyInstance, service: ReturnType<typeof createTransferService>) => {
  app.addHook('preHandler', async request => { if (!request.user) throw new ServiceError(401, 'Please sign in.') })
  const options = { bodyLimit: 20_000_000, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }
  app.get('/api/transfer/export', options, async (request, reply) => reply
    .header('Content-Disposition', 'attachment; filename="memties.json"').send(await service.export(request.user!.id)))
  app.post('/api/transfer/preview', options, async request => service.preview(request.user!.id, transferInput.parse(request.body)))
  app.post('/api/transfer/import', options, async request => {
    const { data } = z.object({ data: transferInput, confirmed: z.literal(true) }).strict().parse(request.body)
    return service.import(request.user!.id, data)
  })
}
