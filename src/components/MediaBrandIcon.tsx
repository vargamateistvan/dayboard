type MediaBrand = 'spotify' | 'apple-music' | 'apple-podcasts'

interface Props {
  readonly brand: MediaBrand
  readonly size?: number
  readonly className?: string
}

export function MediaBrandIcon({ brand, size = 14, className }: Props) {
  const base = import.meta.env.BASE_URL
  const src =
    brand === 'spotify'
      ? `${base}media-logos/spotify.png`
      : brand === 'apple-music'
        ? `${base}media-logos/apple-music.png`
        : `${base}media-logos/apple-podcasts.png`

  return (
    <img
      className={className}
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="eager"
      draggable={false}
    />
  )
}
