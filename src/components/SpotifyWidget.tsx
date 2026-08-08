const SPOTIFY_EMBED_URL = 'https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT'

interface SpotifyWidgetProps {
  readonly isFullscreen?: boolean
}

export function SpotifyWidget({ isFullscreen = false }: SpotifyWidgetProps) {
  return (
    <iframe
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        minHeight: isFullscreen ? 'clamp(28rem, 68vh, 58rem)' : '10rem',
        border: 'none',
      }}
      src={SPOTIFY_EMBED_URL}
      title="Spotify Player"
      loading="lazy"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
    />
  )
}
