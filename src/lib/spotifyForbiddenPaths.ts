import { readJson, removeStorage, writeJson } from './storage'

// Library endpoints the current Spotify sign-in is not allowed to read (403),
// remembered so they are not requested on every refresh. The list belongs to
// one sign-in, so it holds no token and is cleared on disconnect or a new login.
const STORAGE_KEY = 'dayboard_spotify_forbidden_optional_paths_v2'
// The v1 cache was keyed by refresh token, which left the token in storage.
const LEGACY_STORAGE_KEY = 'dayboard_spotify_forbidden_optional_paths_v1'

const asPathList = (value: unknown) =>
  Array.isArray(value) ? value.filter((path): path is string => typeof path === 'string') : null

export function readSpotifyForbiddenPaths(): Set<string> {
  removeStorage(LEGACY_STORAGE_KEY)
  return new Set(readJson(STORAGE_KEY, asPathList, []))
}

export function addSpotifyForbiddenPath(path: string): void {
  const paths = readSpotifyForbiddenPaths()
  if (paths.has(path)) return
  paths.add(path)
  writeJson(STORAGE_KEY, [...paths])
}

export function clearSpotifyForbiddenPaths(): void {
  removeStorage(STORAGE_KEY)
  removeStorage(LEGACY_STORAGE_KEY)
}
