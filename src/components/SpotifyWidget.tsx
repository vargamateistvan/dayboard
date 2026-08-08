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
      src="https://open.spotify.com"
      title="Spotify"
      loading="lazy"
    />
  )
}
