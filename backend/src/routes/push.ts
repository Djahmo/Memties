import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Config } from '../config.js'
import { pushEndpoint, pushInput, type createPushService } from '../services/push.js'
import { ServiceError } from '../services/errors.js'

export const pushRoutes = async (app: FastifyInstance, service: ReturnType<typeof createPushService>, config: Config) => {
  app.addHook('preHandler', async request => { if (!request.user) throw new ServiceError(401, 'Please sign in.') })
  app.get('/api/push/subscriptions', async request => service.list(request.user!.id))
  app.get('/api/push/config', async () => ({ publicKey: config.VAPID_PUBLIC_KEY ?? null }))
  app.post('/api/push/subscriptions', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async request => {
    if (!config.VAPID_PUBLIC_KEY) throw new ServiceError(503, 'Push notifications are not configured.')
    return service.subscribe(request.user!.id, pushInput.parse(request.body))
  })
  app.delete('/api/push/subscriptions', async request => service.unsubscribe(request.user!.id, z.object({ endpoint: pushEndpoint }).strict().parse(request.body).endpoint))
}
