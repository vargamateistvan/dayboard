import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { disconnectGoogle, fetchGoogleCalendarEvents, getStoredGoogleAuth, getValidGoogleAuth } from '../googleAuth'
import { parseIcs } from '../parseCalendarFeed'

const KEY = 'dayboard_google_auth'

describe('disconnectGoogle', () => {
  afterEach(() => {
    localStorage.clear()
    delete window.google
  })

  it('revokes the stored token with Google and clears it', () => {
    const revoke = vi.fn()
    window.google = {
      accounts: { oauth2: { initTokenClient: vi.fn(), revoke } },
    }
    localStorage.setItem(KEY, JSON.stringify({ accessToken: 'tok', expiresAt: Date.now() + 60_000 }))

    disconnectGoogle()

    expect(revoke).toHaveBeenCalledWith('tok', expect.any(Function))
    expect(getStoredGoogleAuth()).toBeNull()
  })

  it('still clears the token when Google Identity Services is not loaded', () => {
    localStorage.setItem(KEY, JSON.stringify({ accessToken: 'tok', expiresAt: Date.now() + 60_000 }))

    expect(() => disconnectGoogle()).not.toThrow()
    expect(getStoredGoogleAuth()).toBeNull()
  })
})

type TokenResponse = { access_token?: string; expires_in?: number; error?: string }
type TokenClientConfig = {
  callback: (response: TokenResponse) => void
  error_callback?: (error: { type: string }) => void
}

function stubGis(onRequest: (config: TokenClientConfig) => void) {
  const initTokenClient = vi.fn((config: TokenClientConfig) => ({
    requestAccessToken: vi.fn(() => onRequest(config)),
  }))
  window.google = { accounts: { oauth2: { initTokenClient, revoke: vi.fn() } } } as unknown as typeof window.google
  return initTokenClient
}

function storeToken(expiresInMs: number) {
  localStorage.setItem('dayboard_google_auth', JSON.stringify({ accessToken: 'old', expiresAt: Date.now() + expiresInMs }))
}

describe('Google token refresh', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    localStorage.clear()
    delete window.google
  })

  it('keeps an expired token so the connection can be refreshed silently', async () => {
    storeToken(-60_000)
    stubGis((config) => config.callback({ access_token: 'fresh', expires_in: 3600 }))

    const stored = getStoredGoogleAuth()
    expect(stored).not.toBeNull()

    const refreshed = await getValidGoogleAuth(stored!)
    expect(refreshed.accessToken).toBe('fresh')
  })

  it('fails instead of hanging when the refresh popup cannot open', async () => {
    storeToken(-60_000)
    stubGis((config) => config.error_callback?.({ type: 'popup_failed_to_open' }))

    await expect(getValidGoogleAuth(getStoredGoogleAuth()!)).rejects.toThrow(/sign in again/i)
  })

  it('fails instead of hanging when Google never answers', async () => {
    vi.useFakeTimers()
    storeToken(-60_000)
    stubGis(() => {})

    const pending = getValidGoogleAuth(getStoredGoogleAuth()!)
    const assertion = expect(pending).rejects.toThrow(/sign in again/i)
    await vi.advanceTimersByTimeAsync(60_000)
    await assertion
  })

  it('shares one refresh between concurrent callers', async () => {
    storeToken(-60_000)
    const initTokenClient = stubGis((config) => {
      setTimeout(() => config.callback({ access_token: 'fresh', expires_in: 3600 }), 0)
    })
    const auth = getStoredGoogleAuth()!

    const [first, second] = await Promise.all([getValidGoogleAuth(auth), getValidGoogleAuth(auth)])

    expect(initTokenClient).toHaveBeenCalledTimes(1)
    expect(first.accessToken).toBe('fresh')
    expect(second.accessToken).toBe('fresh')
  })
})

describe('fetchGoogleCalendarEvents', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  function event(id: string, extra: Record<string, unknown> = {}) {
    return {
      id,
      summary: `Event ${id}`,
      start: { dateTime: '2026-10-12T09:00:00Z' },
      end: { dateTime: '2026-10-12T10:00:00Z' },
      ...extra,
    }
  }

  it('follows nextPageToken to fetch every page', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      const page = url.searchParams.get('pageToken')
      return {
        ok: true,
        json: async () => (page ? { items: [event('2')] } : { items: [event('1')], nextPageToken: 'p2' }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    const ics = await fetchGoogleCalendarEvents('primary', { accessToken: 't', expiresAt: Date.now() + 3_600_000 })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(ics).toContain('SUMMARY:Event 1')
    expect(ics).toContain('SUMMARY:Event 2')
  })

  it('keeps organizer and attendee names that contain ":" or ";"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          items: [
            event('1', {
              organizer: { displayName: 'Ops: Team', email: 'ops@example.com' },
              attendees: [{ displayName: 'Doe; Jane', email: 'jane@example.com', responseStatus: 'accepted' }],
            }),
          ],
        }),
      })),
    )

    const ics = await fetchGoogleCalendarEvents('primary', { accessToken: 't', expiresAt: Date.now() + 3_600_000 })
    const [parsed] = parseIcs(ics, { start: new Date('2026-10-12T00:00:00Z'), end: new Date('2026-10-13T00:00:00Z') })

    expect(parsed.organizer).toEqual({ name: 'Ops: Team', email: 'ops@example.com' })
    expect(parsed.attendees?.[0]).toMatchObject({ name: 'Doe; Jane', email: 'jane@example.com' })
  })
})
