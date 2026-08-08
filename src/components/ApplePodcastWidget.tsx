const APPLE_PODCAST_EMBED_URL = 'https://embed.podcasts.apple.com/us/podcast/the-joe-rogan-experience/id360084272'

interface ApplePodcastWidgetProps {
  readonly isFullscreen?: boolean
}

export function ApplePodcastWidget({ isFullscreen = false }: ApplePodcastWidgetProps) {
  return (
    <iframe
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        minHeight: isFullscreen ? 'clamp(28rem, 68vh, 58rem)' : '10rem',
        border: 'none',
      }}
      src={APPLE_PODCAST_EMBED_URL}
      title="Apple Podcast"
      loading="lazy"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
    />
  )
}
