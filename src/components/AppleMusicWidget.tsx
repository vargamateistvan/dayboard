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
      src="https://music.apple.com"
      title="Apple Music"
      loading="lazy"
    />
  )
}
