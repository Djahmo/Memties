import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { reminderFields, reminderInput, reminderListInput } from '../services/content-input.js'
import type { createReminderService } from '../services/reminders.js'
import { ServiceError } from '../services/errors.js'

export const reminderRoutes = async (app: FastifyInstance, service: ReturnType<typeof createReminderService>, mailEnabled: boolean) => {
  app.addHook('preHandler', async request => { if (!request.user) throw new ServiceError(401, 'Please sign in.') })
  app.get('/api/reminders/config', async () => ({ mailEnabled }))
  app.get('/api/reminders', async request => service.list(request.user!.id, reminderListInput.parse(request.query)))
  app.post('/api/reminders', async (request, reply) => reply.code(201).send(await service.create(request.user!.id, reminderInput.parse(request.body))))
  app.patch('/api/reminders/:id', async request => service.update(request.user!.id,
    z.object({ id: z.uuid() }).parse(request.params).id,
    reminderFields.omit({ notifyByEmail: true, language: true }).partial().extend({
      notifyByEmail: z.boolean().optional(), language: z.enum(['fr', 'en']).optional(), status: z.enum(['pending', 'completed']).optional(),
    }).strict().parse(request.body)))
}
