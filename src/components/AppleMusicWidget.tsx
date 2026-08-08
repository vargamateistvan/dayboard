const APPLE_MUSIC_EMBED_URL = 'https://embed.music.apple.com/us/album/blinding-lights/1499378108?i=1499378110'

interface AppleMusicWidgetProps {
  readonly isFullscreen?: boolean
}

export function AppleMusicWidget({ isFullscreen = false }: AppleMusicWidgetProps) {
  return (
    <iframe
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        minHeight: isFullscreen ? 'clamp(28rem, 68vh, 58rem)' : '10rem',
        border: 'none',
      }}
      src={APPLE_MUSIC_EMBED_URL}
      title="Apple Music Player"
      loading="lazy"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
    />
  )
}
