import { useEffect, useState } from 'react'
import { api, errorMessage } from '../services/api'

export const useApi = <T>(path: string) => {
  const [revision, setRevision] = useState(0)
  const key = `${path}:${revision}`
  const [result, setResult] = useState<{ key: string; data?: T; error?: string }>({ key: '' })
  useEffect(() => {
    const controller = new AbortController()
    api<T>(path, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setResult({ key, data })
    }).catch((error: unknown) => { if (!controller.signal.aborted) setResult({ key, error: errorMessage(error) }) })
    return () => controller.abort()
  }, [path, key])
  return {
    data: result.key === key ? result.data : undefined,
    error: result.key === key ? result.error : undefined,
    loading: result.key !== key,
    reload: () => setRevision(value => value + 1),
  }
}
