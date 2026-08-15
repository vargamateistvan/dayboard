import { normalizeAppleMusicEmbedUrl } from '../lib/musicEmbeds'
import { searchAppleMusicCatalog } from '../lib/appleSearchApi'
import { AppleMediaWidget, type AppleMediaConfig } from './AppleMediaWidget'
import { MusicEmbedWidget } from './MusicEmbedWidget'

const APPLE_MUSIC_CONFIG: AppleMediaConfig = {
  brand: 'apple-music',
  title: 'Apple Music',
  subtitle: 'Catalog search',
  placementKey: 'appleMusic',
  urlSettingKey: 'appleMusicEmbedUrl',
  linksSettingKey: 'appleMusicEmbedLinks',
  normalizeUrl: normalizeAppleMusicEmbedUrl,
  search: async (query) => {
    const results = await searchAppleMusicCatalog(query)
    return [
      { title: 'Songs', items: results.songs },
      { title: 'Albums', items: results.albums },
      { title: 'Artists', items: results.artists },
    ]
  },
  searchPlaceholder: 'Songs, albums, artists…',
  searchHint: 'Search the Apple Music catalog, then tap to play.',
  addPlaceholder: 'Paste another Apple Music song / album / playlist link',
  invalidLinkMessage: 'Please paste a valid Apple Music album, playlist, song, or artist link.',
  renderEmbed: ({ shareUrl, embedSize, colorScheme }) => (
    <MusicEmbedWidget
      title="Apple Music Player"
      provider="apple-music"
      shareUrl={shareUrl}
      showHeader={false}
      showStatus={false}
      showActions={false}
      embedSize={embedSize}
      colorScheme={colorScheme}
    />
  ),
}

interface AppleMusicWidgetProps {
  readonly isFullscreen?: boolean
}

export function AppleMusicWidget({ isFullscreen = false }: AppleMusicWidgetProps) {
  return <AppleMediaWidget config={APPLE_MUSIC_CONFIG} isFullscreen={isFullscreen} />
}
