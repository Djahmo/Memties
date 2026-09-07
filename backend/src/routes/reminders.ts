import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { reminderFields, reminderInput, reminderListInput } from '../services/content-input.js'
import type { createReminderService } from '../services/reminders.js'
import { ServiceError } from '../services/errors.js'
import { exportCalendar } from '../services/calendar.js'

export const reminderRoutes = async (app: FastifyInstance, service: ReturnType<typeof createReminderService>, mailEnabled: boolean, namespace = 'memties', pushEnabled = false) => {
  app.addHook('preHandler', async request => { if (!request.user) throw new ServiceError(401, 'Please sign in.') })
  app.get('/api/reminders/config', async () => ({ mailEnabled, pushEnabled }))
  app.get('/api/reminders/calendar.ics', async (request, reply) => reply
    .type('text/calendar; charset=utf-8').header('Content-Disposition', 'attachment; filename="memties-reminders.ics"')
    .send(await exportCalendar(service, request.user!.id, reminderListInput.parse(request.query), namespace)))
  app.get('/api/reminders', async request => service.list(request.user!.id, reminderListInput.parse(request.query)))
  app.post('/api/reminders', async (request, reply) => reply.code(201).send(await service.create(request.user!.id, reminderInput.parse(request.body))))
  app.patch('/api/reminders/:id', async request => service.update(request.user!.id,
    z.object({ id: z.uuid() }).parse(request.params).id,
    reminderFields.omit({ notifyByPush: true, notifyByEmail: true, language: true }).partial().extend({
      notifyByPush: z.boolean().optional(), notifyByEmail: z.boolean().optional(), language: z.enum(['fr', 'en']).optional(), status: z.enum(['pending', 'completed']).optional(),
    }).strict().parse(request.body)))
}
