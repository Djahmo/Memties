import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, lt } from 'drizzle-orm'
import formbody from '@fastify/formbody'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Database } from '../db/index.js'
import { oauthRecords } from '../db/schema.js'
import type { Config } from '../config.js'
import { createTokenService } from '../auth/tokens.js'

const secret = () => randomBytes(32).toString('base64url')
const digest = (value: string) => createHash('sha256').update(value).digest('base64url')
const redirectUri = z.url().max(2048).refine(value => {
  const url = new URL(value)
  return url.protocol === 'https:' && !url.hash && !url.username && !url.password
})
const registration = z.object({
  client_name: z.string().min(1).max(100).default('MCP client'),
  redirect_uris: z.array(redirectUri).min(1).max(10),
  token_endpoint_auth_method: z.literal('none').default('none'),
  grant_types: z.array(z.literal('authorization_code')).default(['authorization_code']),
  response_types: z.array(z.literal('code')).default(['code']),
})
const authorization = z.object({
  response_type: z.literal('code'), client_id: z.string().max(100), redirect_uri: redirectUri,
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/), code_challenge_method: z.literal('S256'),
  state: z.string().max(2048).optional(), scope: z.string().max(200).default('memties:read'),
  resource: z.string().max(2048).optional(),
})
type Client = z.infer<typeof registration>
type Grant = z.infer<typeof authorization> & { userId: string }

export const oauthRoutes = async (app: FastifyInstance, db: Database, config: Config) => {
  await app.register(formbody)
  const origin = config.APP_ORIGIN
  const resource = `${origin}/api/mcp`
  const tokens = createTokenService(db)
  const limits = { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }
  const save = async (id: string, value: unknown, seconds: number) => {
    await db.delete(oauthRecords).where(lt(oauthRecords.expiresAt, new Date()))
    await db.insert(oauthRecords).values({ id, value: JSON.stringify(value), expiresAt: new Date(Date.now() + seconds * 1000) })
  }
  const get = async <T,>(id: string): Promise<T | undefined> => {
    const [row] = await db.select().from(oauthRecords).where(and(eq(oauthRecords.id, id), gt(oauthRecords.expiresAt, new Date())))
    return row ? JSON.parse(row.value) as T : undefined
  }
  // OAuth endpoints use protocol error responses, never redirect unvalidated input.
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ error: 'invalid_request' })
    request.log.error({ err: error }, 'OAuth request failed')
    return reply.code(500).send({ error: 'server_error' })
  })
  const metadata = {
    issuer: origin, authorization_endpoint: `${origin}/api/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`, registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ['code'], grant_types_supported: ['authorization_code'],
    token_endpoint_auth_methods_supported: ['none'], code_challenge_methods_supported: ['S256'],
    scopes_supported: ['memties:read', 'memties:write'],
  }
  app.get('/.well-known/oauth-authorization-server', async () => metadata)
  const protectedMetadata = { resource, authorization_servers: [origin], scopes_supported: metadata.scopes_supported, bearer_methods_supported: ['header'] }
  for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/api/mcp', '/api/oauth/resource']) {
    app.get(path, async () => protectedMetadata)
  }
  app.post('/api/oauth/register', limits, async (request, reply) => {
    const parsed = registration.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_client_metadata' })
    const client_id = secret()
    await save(`client:${client_id}`, parsed.data, 365 * 86400)
    return reply.code(201).send({ ...parsed.data, client_id, client_id_issued_at: Math.floor(Date.now() / 1000) })
  })
  const validate = async (input: z.infer<typeof authorization>) => {
    const client = await get<Client>(`client:${input.client_id}`)
    if (!client?.redirect_uris.includes(input.redirect_uri)) return undefined
    if (input.resource && input.resource !== resource) return undefined
    if (!input.scope.split(' ').every(scope => ['memties:read', 'memties:write'].includes(scope))) return undefined
    return client
  }
  app.get('/api/oauth/authorize', limits, async (request, reply) => {
    const input = authorization.parse(request.query)
    if (!await validate(input)) return reply.code(400).send({ error: 'invalid_request' })
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(input)) if (value !== undefined) params.set(key, value)
    return reply.redirect(`${origin}/?oauth=${encodeURIComponent(params.toString())}`)
  })
  app.get('/api/oauth/consent', limits, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'login_required' })
    const input = authorization.parse(request.query)
    const client = await validate(input)
    if (!client) return reply.code(400).send({ error: 'invalid_request' })
    return { name: client.client_name, destination: new URL(input.redirect_uri).origin, scope: input.scope }
  })
  app.post('/api/oauth/consent', limits, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'login_required' })
    const input = authorization.extend({ approve: z.boolean() }).parse(request.body)
    if (!await validate(input)) return reply.code(400).send({ error: 'invalid_request' })
    const url = new URL(input.redirect_uri)
    if (input.state !== undefined) url.searchParams.set('state', input.state)
    if (input.approve) {
      const code = secret()
      await save(`code:${digest(code)}`, { ...input, userId: request.user.id }, 300)
      url.searchParams.set('code', code)
    } else url.searchParams.set('error', 'access_denied')
    return { redirect: url.href }
  })
  app.post('/api/oauth/token', limits, async (request, reply) => {
    reply.header('Pragma', 'no-cache')
    const input = z.object({
      grant_type: z.literal('authorization_code'), code: z.string().max(200),
      client_id: z.string().max(100), redirect_uri: redirectUri,
      code_verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/), resource: z.string().max(2048).optional(),
    }).parse(request.body)
    const id = `code:${digest(input.code)}`
    const grant = await db.transaction(async tx => {
      const [row] = await tx.select().from(oauthRecords).where(and(eq(oauthRecords.id, id), gt(oauthRecords.expiresAt, new Date()))).for('update')
      if (!row) return undefined
      const value = JSON.parse(row.value) as Grant
      if (value.client_id !== input.client_id || value.redirect_uri !== input.redirect_uri || digest(input.code_verifier) !== value.code_challenge || (input.resource !== undefined && input.resource !== resource)) return undefined
      await tx.delete(oauthRecords).where(eq(oauthRecords.id, id))
      return value
    })
    if (!grant) return reply.code(400).send({ error: 'invalid_grant' })
    const client = await get<Client>(`client:${grant.client_id}`)
    if (!client) return reply.code(400).send({ error: 'invalid_client' })
    const issued = await tokens.create(grant.userId, { name: `OAuth: ${client.client_name}`, access: grant.scope.split(' ').includes('memties:write') ? 'write' : 'read', days: 30 })
    return { access_token: issued.token, token_type: 'Bearer', expires_in: 30 * 86400, scope: grant.scope }
  })
}
