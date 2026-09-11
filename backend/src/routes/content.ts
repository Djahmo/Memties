import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { createPeopleService } from '../services/people.js'
import type { createEntryService } from '../services/entries.js'
import { entryInput, historyInput, listInput, personInput } from '../services/content-input.js'
import { ServiceError } from '../services/errors.js'

export type ContentServices = { people: ReturnType<typeof createPeopleService>; entries: ReturnType<typeof createEntryService> }
const identifier = z.object({ id: z.uuid() })

export const contentRoutes = async (app: FastifyInstance, services: ContentServices) => {
  app.addHook('preHandler', async request => {
    if (!request.user) throw new ServiceError(401, 'Please sign in.')
  })
  app.get('/api/people', async request => services.people.list(request.user!.id, listInput.parse(request.query)))
  app.get('/api/people/:id', async request => services.people.get(request.user!.id, identifier.parse(request.params).id))
  app.post('/api/people', async (request, reply) => reply.code(201).send(await services.people.create(request.user!.id, personInput.parse(request.body))))
  app.patch('/api/people/:id', async request => services.people.update(request.user!.id, identifier.parse(request.params).id, personInput.parse(request.body)))
  app.get('/api/entries', async request => services.entries.list(request.user!.id, historyInput.parse(request.query)))
  app.get('/api/entries/:id', async request => services.entries.get(request.user!.id, identifier.parse(request.params).id))
  app.delete('/api/entries/:id', async request => services.entries.remove(request.user!.id, identifier.parse(request.params).id))
  app.post('/api/entries', async (request, reply) => reply.code(201).send(await services.entries.create(request.user!.id, entryInput.parse(request.body))))
  app.patch('/api/entries/:id', async request => services.entries.update(request.user!.id, identifier.parse(request.params).id, entryInput.parse(request.body)))
}
