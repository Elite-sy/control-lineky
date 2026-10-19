'use client'

import { useState, useEffect, useCallback } from 'react'
import { logger } from '@/lib/logger'

const CSRF_HEADER = 'x-csrf-token'

export interface UseAdminCsrfReturn {
  /** Current CSRF token (null during loading) */
  token: string | null
  /** Refreshes the CSRF token and returns the new token */
  refreshToken: () => Promise<string | null>
  /** true during initial loading */
  isLoading: boolean
  /** Error that occurred during token fetch (null if no error) */
  error: Error | null
  /** Wraps a fetch call to automatically include CSRF token and handle 403 errors */
  fetchWithCsrf: (url: string, options?: RequestInit) => Promise<Response>
}

/**
 * Hook for managing CSRF tokens for admin console requests.
 * Fetches tokens from /api/admin/csrf-token and automatically includes
 * the x-csrf-token header in admin mutations.
 *
 * @example
 * const { token, fetchWithCsrf, isLoading, error } = useAdminCsrf()
 *
 * // Use fetchWithCsrf wrapper for automatic token handling
 * const response = await fetchWithCsrf('/api/admin/users', {
 *   method: 'POST',
 *   body: JSON.stringify(data),
 * })
 *
 * // Or manually use the token
 * fetch('/api/admin/users', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json', ...buildAdminCsrfHeaders(token!) },
 *   body: JSON.stringify(data),
 * })
 */
export function useAdminCsrf(): UseAdminCsrfReturn {
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refreshToken = useCallback(async (): Promise<string | null> => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/csrf-token')
      if (!res.ok) {
        const errorMsg = `Failed to fetch CSRF token: ${res.status}`
        logger.warn('[useAdminCsrf]', errorMsg)
        const err = new Error(errorMsg)
        setError(err)
        setToken(null)
        return null
      }
      const data = (await res.json()) as { token: string }
      setToken(data.token)
      setError(null)
      return data.token
    } catch (err) {
      logger.warn('[useAdminCsrf] Error fetching CSRF token:', err)
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      setToken(null)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshToken()
  }, [])

  const fetchWithCsrf = useCallback(
    async (url: string, options?: RequestInit): Promise<Response> => {
      if (!token) {
        throw new Error('CSRF token not available')
      }

      const headers = new Headers(options?.headers || {})
      headers.set(CSRF_HEADER, token)

      try {
        const response = await fetch(url, {
          ...options,
          headers,
        })

        if (response.status === 403) {
          // Clone response before consuming body to avoid "body already used" error
          const clonedResponse = response.clone()
          const errorText = await clonedResponse.text()
          
          if (errorText.includes('CSRF') || errorText.includes('csrf')) {
            logger.info('[useAdminCsrf] CSRF token expired, refreshing and retrying')
            const freshToken = await refreshToken()
            
            if (freshToken) {
              headers.set(CSRF_HEADER, freshToken)
              return fetch(url, {
                ...options,
                headers,
              })
            }
          }
        }

        return response
      } catch (err) {
        logger.error('[useAdminCsrf] Fetch error:', err)
        throw err
      }
    },
    [token, refreshToken]
  )

  return { token, refreshToken, isLoading, error, fetchWithCsrf }
}

/**
 * Utility to build CSRF headers for manual fetch calls.
 * Use with the useAdminCsrf hook for admin console requests.
 *
 * @example
 * const { token } = useAdminCsrf()
 * fetch('/api/admin/users', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json', ...buildAdminCsrfHeaders(token!) },
 *   body: JSON.stringify(data),
 * })
 */
export function buildAdminCsrfHeaders(token: string): Record<string, string> {
  return { [CSRF_HEADER]: token }
}
