export interface SpotifyAuthSession {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export interface SpotifyAuthNotice {
  type: 'success' | 'error'
  message: string
}

const SPOTIFY_SCOPES = [
  'user-read-email',
  'user-read-private',
]
const AUTH_STORAGE_KEY = 'dayboard_spotify_auth'
const AUTH_NOTICE_KEY = 'dayboard_spotify_auth_notice'
const AUTH_CHANGED_EVENT = 'dayboard_spotify_auth_changed'
const AUTH_STATE_KEY = 'dayboard_spotify_auth_state'
const AUTH_VERIFIER_KEY = 'dayboard_spotify_auth_verifier'
const EXPIRY_BUFFER_MS = 60_000

function toBase64Url(input: ArrayBuffer): string {
  const bytes = new Uint8Array(input)
  const chars = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
  return btoa(chars).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function randomString(length: number): string {
  const values = new Uint8Array(length)
  crypto.getRandomValues(values)
  return Array.from(values, (value) => (value % 36).toString(36)).join('')
}

function getSpotifyClientId(): string {
  const configured = import.meta.env.VITE_SPOTIFY_CLIENT_ID
  if (typeof configured === 'string' && configured.trim().length > 0) {
    return configured.trim()
  }

  throw new Error('Spotify Client ID is not configured. Set VITE_SPOTIFY_CLIENT_ID in your .env file.')
}

function getRedirectUri(): string {
  const configuredRedirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI
  if (typeof configuredRedirectUri === 'string' && configuredRedirectUri.trim().length > 0) {
    return configuredRedirectUri.trim()
  }

  return `${window.location.origin}${window.location.pathname}`
}

async function createCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toBase64Url(digest)
}

function readStoredAuth(): SpotifyAuthSession | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SpotifyAuthSession>
    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.refreshToken !== 'string' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      return null
    }

    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: parsed.expiresAt,
    }
  } catch {
    return null
  }
}

function persistAuth(auth: SpotifyAuthSession) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth))
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

function clearPendingAuthState() {
  sessionStorage.removeItem(AUTH_STATE_KEY)
  sessionStorage.removeItem(AUTH_VERIFIER_KEY)
}

function clearAuthNotice() {
  sessionStorage.removeItem(AUTH_NOTICE_KEY)
}

export function setSpotifyAuthNotice(notice: SpotifyAuthNotice) {
  sessionStorage.setItem(AUTH_NOTICE_KEY, JSON.stringify(notice))
}

export function consumeSpotifyAuthNotice(): SpotifyAuthNotice | null {
  const raw = sessionStorage.getItem(AUTH_NOTICE_KEY)
  clearAuthNotice()
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SpotifyAuthNotice>
    if (
      (parsed.type !== 'success' && parsed.type !== 'error') ||
      typeof parsed.message !== 'string' ||
      parsed.message.trim().length === 0
    ) {
      return null
    }

    return {
      type: parsed.type,
      message: parsed.message,
    }
  } catch {
    return null
  }
}

function clearUrlAuthParams() {
  const url = new URL(window.location.href)
  url.searchParams.delete('code')
  url.searchParams.delete('state')
  url.searchParams.delete('error')
  const nextUrl = `${url.pathname}${url.search}${url.hash}`
  window.history.replaceState({}, '', nextUrl)
}

export function getStoredSpotifyAuth(): SpotifyAuthSession | null {
  return readStoredAuth()
}

export function clearStoredSpotifyAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

export async function startSpotifyLogin() {
  const clientId = getSpotifyClientId()
  const state = randomString(24)
  const verifier = randomString(96)
  const challenge = await createCodeChallenge(verifier)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SPOTIFY_SCOPES.join(' '),
    redirect_uri: getRedirectUri(),
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })

  sessionStorage.setItem(AUTH_STATE_KEY, state)
  sessionStorage.setItem(AUTH_VERIFIER_KEY, verifier)
  window.location.assign(`https://accounts.spotify.com/authorize?${params.toString()}`)
}

async function exchangeAuthCode(code: string, verifier: string): Promise<SpotifyAuthSession> {
  const clientId = getSpotifyClientId()
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(),
    client_id: clientId,
    code_verifier: verifier,
  })

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (!response.ok) {
    throw new Error('Spotify login failed while exchanging auth code.')
  }

  const data = await response.json() as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }

  const existing = readStoredAuth()
  const refreshToken = data.refresh_token ?? existing?.refreshToken
  if (!refreshToken) {
    throw new Error('Spotify login did not return a refresh token.')
  }

  return {
    accessToken: data.access_token,
    refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
}

export async function completeSpotifyLoginFromUrl(): Promise<SpotifyAuthSession | null> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')
  const error = params.get('error')

  if (!code && !error) {
    return null
  }

  if (error) {
    clearPendingAuthState()
    clearUrlAuthParams()
    throw new Error(`Spotify login failed: ${error}`)
  }
  if (!code) {
    clearPendingAuthState()
    clearUrlAuthParams()
    throw new Error('Spotify login response is missing an authorization code.')
  }

  const expectedState = sessionStorage.getItem(AUTH_STATE_KEY)
  const verifier = sessionStorage.getItem(AUTH_VERIFIER_KEY)
  if (!state || !expectedState || state !== expectedState || !verifier) {
    clearPendingAuthState()
    clearUrlAuthParams()
    throw new Error('Spotify login could not be verified. Please try again.')
  }

  try {
    const auth = await exchangeAuthCode(code, verifier)
    persistAuth(auth)
    return auth
  } finally {
    clearPendingAuthState()
    clearUrlAuthParams()
  }
}

async function refreshSpotifyAuth(auth: SpotifyAuthSession): Promise<SpotifyAuthSession> {
  const clientId = getSpotifyClientId()
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: auth.refreshToken,
    client_id: clientId,
  })

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (!response.ok) {
    throw new Error('Spotify session expired. Please sign in again.')
  }

  const data = await response.json() as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }

  const refreshed: SpotifyAuthSession = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? auth.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  }

  persistAuth(refreshed)
  return refreshed
}

export async function getValidSpotifyAuth(auth: SpotifyAuthSession): Promise<SpotifyAuthSession> {
  if (Date.now() + EXPIRY_BUFFER_MS < auth.expiresAt) {
    return auth
  }

  return refreshSpotifyAuth(auth)
}

export function getSpotifyRedirectUriForSetup(): string {
  return getRedirectUri()
}

export function onSpotifyAuthChanged(listener: () => void): () => void {
  window.addEventListener(AUTH_CHANGED_EVENT, listener)
  return () => window.removeEventListener(AUTH_CHANGED_EVENT, listener)
}
