import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const derive = (password: string, salt: string): Promise<Buffer> => new Promise((resolve, reject) => {
  scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
    if (error) reject(error)
    else resolve(key)
  })
})

export const hashPassword = async (password: string) => {
  const salt = randomBytes(16).toString('hex')
  return `scrypt$${salt}$${(await derive(password, salt)).toString('hex')}`
}

export const verifyPassword = async (password: string, hash: string) => {
  const [algorithm, salt, expected] = hash.split('$')
  if (algorithm !== 'scrypt' || !salt || !expected || !/^[a-f0-9]{128}$/.test(expected)) return false
  return timingSafeEqual(await derive(password, salt), Buffer.from(expected, 'hex'))
}
