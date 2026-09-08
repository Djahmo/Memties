import { createHash, randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { Client, EqualityFilter } from 'ldapts'
import { SAML, ValidateInResponseTo } from '@node-saml/node-saml'
import type { CacheProvider } from '@node-saml/node-saml'
import { and, eq, gt, lt } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '../db/index.js'
import type { Config } from '../config.js'
import type { createAuthService } from './service.js'
import { samlRequests } from '../db/schema.js'
import { ServiceError } from '../services/errors.js'

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const profileInput = z.object({ email: z.email().max(254).transform(value => value.toLowerCase()), displayName: z.string().trim().min(1).max(120) })
const attribute = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (Buffer.isBuffer(value)) return value.toString('base64')
  if (Array.isArray(value) && value.length === 1) return attribute(value[0])
  return ''
}

export const createProviderService = async (db: Database, auth: ReturnType<typeof createAuthService>, config: Config) => {
  const samlKeys = config.SAML_ENTRY_POINT ? {
    idpCert: await readFile(config.SAML_IDP_CERT_FILE!, 'utf8'),
    privateKey: config.SAML_SP_KEY_FILE ? await readFile(config.SAML_SP_KEY_FILE, 'utf8') : undefined,
    publicCert: config.SAML_SP_CERT_FILE ? await readFile(config.SAML_SP_CERT_FILE, 'utf8') : undefined,
  } : null
  const lifetime = 10 * 60000
  type Store = Pick<Database, 'select' | 'insert' | 'delete'>
  const saml = (store: Store, state: string) => {
    if (!samlKeys) throw new ServiceError(404, 'Authentication provider is unavailable.')
    const keyId = (key: string) => `request:${hash(`${state}:${key}`)}`
    const cacheProvider: CacheProvider = {
      saveAsync: async (key, value) => {
        const createdAt = new Date()
        await store.insert(samlRequests).values({ id: keyId(key), value, createdAt })
        return { value, createdAt: createdAt.getTime() }
      },
      getAsync: async key => {
        const [row] = await store.select().from(samlRequests).where(and(eq(samlRequests.id, keyId(key)), gt(samlRequests.createdAt, new Date(Date.now() - lifetime)))).limit(1)
        return row?.value ?? null
      },
      removeAsync: async key => {
        if (!key) return null
        await store.delete(samlRequests).where(eq(samlRequests.id, keyId(key)))
        return key
      },
    }
    return new SAML({ ...samlKeys, decryptionPvk: samlKeys.privateKey, entryPoint: config.SAML_ENTRY_POINT,
      issuer: `${config.APP_ORIGIN}/api/auth/saml/metadata`, audience: `${config.APP_ORIGIN}/api/auth/saml/metadata`,
      callbackUrl: `${config.APP_ORIGIN}/api/auth/saml/callback`, idpIssuer: config.SAML_IDP_ISSUER,
      identifierFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
      wantAssertionsSigned: true, wantAuthnResponseSigned: true, signatureAlgorithm: 'sha256', digestAlgorithm: 'sha256',
      validateInResponseTo: ValidateInResponseTo.always, requestIdExpirationPeriodMs: lifetime, maxAssertionAgeMs: lifetime,
      acceptedClockSkewMs: 30000, cacheProvider, disableRequestedAuthnContext: true,
    })
  }
  return {
    ldap: async (username: string, password: string, linkUserId?: string) => {
      if (!config.LDAP_URL) throw new ServiceError(404, 'Authentication provider is unavailable.')
      const client = new Client({ url: config.LDAP_URL, connectTimeout: 10000, timeout: 10000, tlsOptions: { minVersion: 'TLSv1.2', rejectUnauthorized: true } })
      let external: { subject: string; email: string; displayName: string }
      try {
        if (!password.trim()) throw new Error('Empty LDAP password')
        await client.bind(config.LDAP_BIND_DN!, config.LDAP_BIND_PASSWORD!)
        const idAttribute = config.LDAP_ID_ATTRIBUTE ?? 'entryUUID'
        const emailAttribute = config.LDAP_EMAIL_ATTRIBUTE ?? 'mail'
        const nameAttribute = config.LDAP_NAME_ATTRIBUTE ?? 'displayName'
        const result = await client.search(config.LDAP_BASE_DN!, {
          scope: 'sub', filter: new EqualityFilter({ attribute: config.LDAP_LOGIN_ATTRIBUTE ?? 'uid', value: username }),
          attributes: [idAttribute, emailAttribute, nameAttribute], sizeLimit: 2, timeLimit: 10,
        })
        if (result.searchEntries.length !== 1) throw new Error('Ambiguous LDAP identity')
        const entry = result.searchEntries[0]
        const subject = attribute(entry[idAttribute])
        if (!subject) throw new Error('Stable LDAP identity is required')
        await client.bind(entry.dn, password)
        external = { subject: hash(subject), ...profileInput.parse({ email: attribute(entry[emailAttribute]), displayName: attribute(entry[nameAttribute]) }) }
      } catch { throw new ServiceError(401, 'Directory sign-in failed. Check your credentials or contact your administrator.') }
      finally { await client.unbind().catch(() => {}) }
      return auth.externalLogin(`ldap:${hash(`${config.LDAP_URL}|${config.LDAP_BASE_DN}`)}`, external.subject, profileInput.parse(external), linkUserId)
    },
    samlMetadata: () => saml(db, '').generateServiceProviderMetadata(samlKeys?.publicCert ?? null, samlKeys?.publicCert),
    samlStart: async (linkUserId?: string) => {
      const state = randomBytes(32).toString('hex')
      await db.delete(samlRequests).where(lt(samlRequests.createdAt, new Date(Date.now() - lifetime)))
      const url = await db.transaction(async tx => {
        await tx.insert(samlRequests).values({ id: `flow:${hash(state)}`, value: linkUserId ?? '', createdAt: new Date() })
        return saml(tx, state).getAuthorizeUrlAsync(state, undefined, {})
      })
      return { state, url }
    },
    samlComplete: async (state: string, response: string) => {
      const validated = await db.transaction(async tx => {
        const [flow] = await tx.select().from(samlRequests).where(and(eq(samlRequests.id, `flow:${hash(state)}`), gt(samlRequests.createdAt, new Date(Date.now() - lifetime)))).for('update')
        if (!flow) throw new ServiceError(401, 'Single sign-on failed. Please try again.')
        let profile
        try { profile = (await saml(tx, state).validatePostResponseAsync({ SAMLResponse: response })).profile }
        catch { throw new ServiceError(401, 'Single sign-on failed. Please try again.') }
        if (!profile || profile.issuer !== config.SAML_IDP_ISSUER || !profile.nameID || profile.nameIDFormat !== 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent') {
          throw new ServiceError(401, 'Single sign-on failed. Please try again.')
        }
        const user = profileInput.parse({ email: attribute(profile[config.SAML_EMAIL_ATTRIBUTE ?? 'email']), displayName: attribute(profile[config.SAML_NAME_ATTRIBUTE ?? 'displayName']) })
        await tx.delete(samlRequests).where(eq(samlRequests.id, flow.id))
        return { subject: hash(profile.nameID), user, linkUserId: flow.value || undefined }
      })
      return auth.externalLogin(`saml:${hash(config.SAML_IDP_ISSUER!)}`, validated.subject, validated.user, validated.linkUserId)
    },
  }
}
