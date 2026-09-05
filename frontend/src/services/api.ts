import i18n from '../i18n'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}
export const api = async <T>(path: string, options?: { method?: string; body?: unknown; signal?: AbortSignal }): Promise<T> => {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    signal: options?.signal,
    method: options?.method ?? 'GET',
    headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    const message = body && typeof body === 'object' && 'message' in body && typeof body.message === 'string' ? body.message : ''
    throw new ApiError(response.status, i18n.exists(message) ? message : response.status === 400 ? 'Please check the form fields.' : response.status === 429 ? 'Too many attempts. Please try again shortly.' : 'Request failed. Please try again.')
  }
  return response.json()
}
export const errorMessage = (error: unknown) => error instanceof ApiError ? error.message : error instanceof TypeError ? 'Cannot reach Memties. Check that the backend and database are running.' : 'Something went wrong. Please try again.'
