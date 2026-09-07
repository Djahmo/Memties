import type { FastifyInstance } from 'fastify'
import { contactCommitInput, contactImportInput } from '../services/contact-import.js'
import type { createContactImportService } from '../services/contact-import.js'
import { ServiceError } from '../services/errors.js'

export const importRoutes = async (app: FastifyInstance, contacts: ReturnType<typeof createContactImportService>) => {
  app.addHook('preHandler', async request => { if (!request.user) throw new ServiceError(401, 'Please sign in.') })
  const options = { bodyLimit: 3_000_000, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }
  app.post('/api/import/contacts/preview', options, async request => contacts.preview(request.user!.id, contactImportInput.parse(request.body)))
  app.post('/api/import/contacts', options, async request => contacts.commit(request.user!.id, contactCommitInput.parse(request.body)))
}
