const SPOTIFY_PODCAST_EMBED_URL = 'https://open.spotify.com/embed/show/4rOoJ6Egrf8K2IrywzwOMk'

interface SpotifyPodcastWidgetProps {
  readonly isFullscreen?: boolean
}

export function SpotifyPodcastWidget({ isFullscreen = false }: SpotifyPodcastWidgetProps) {
  return (
    <iframe
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        minHeight: isFullscreen ? 'clamp(28rem, 68vh, 58rem)' : '10rem',
        border: 'none',
      }}
      src={SPOTIFY_PODCAST_EMBED_URL}
      title="Spotify Podcast"
      loading="lazy"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
    />
  )
}
