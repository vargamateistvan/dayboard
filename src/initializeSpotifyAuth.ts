import { completeSpotifyLoginFromUrl, setSpotifyAuthNotice } from './lib/spotifyAuth'

export async function initializeSpotifyAuth() {
  try {
    const auth = await completeSpotifyLoginFromUrl()
    if (auth) {
      setSpotifyAuthNotice({ type: 'success', message: 'Spotify connected successfully.' })
    }
  } catch (error) {
    console.error('Spotify login failed:', error)
    setSpotifyAuthNotice({
      type: 'error',
      message: error instanceof Error ? error.message : 'Spotify login failed.',
    })
  }
}
