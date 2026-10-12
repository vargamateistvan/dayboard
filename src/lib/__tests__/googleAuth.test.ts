import { afterEach, describe, expect, it, vi } from 'vitest'
import { disconnectGoogle, getStoredGoogleAuth } from '../googleAuth'

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
