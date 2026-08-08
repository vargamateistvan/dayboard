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
      src="https://podcasts.apple.com"
      title="Apple Podcasts"
      loading="lazy"
    />
  )
}
