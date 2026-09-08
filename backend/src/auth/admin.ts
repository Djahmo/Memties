export const administratorEmails = (value = '') => new Set(value.split(',').map(email => email.trim().toLowerCase()).filter(Boolean))

export const accountRole = (email: string, admins: ReadonlySet<string>): 'admin' | 'user' => admins.has(email.toLowerCase()) ? 'admin' : 'user'
