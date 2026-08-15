import { normalizeApplePodcastEmbedUrl } from '../lib/musicEmbeds'
import { searchApplePodcastCatalog } from '../lib/appleSearchApi'
import { AppleMediaWidget, type AppleMediaConfig } from './AppleMediaWidget'
import { PodcastEmbedWidget } from './PodcastEmbedWidget'

const APPLE_PODCAST_CONFIG: AppleMediaConfig = {
  brand: 'apple-podcasts',
  title: 'Apple Podcasts',
  subtitle: 'Catalog search',
  placementKey: 'applePodcast',
  urlSettingKey: 'applePodcastEmbedUrl',
  linksSettingKey: 'applePodcastEmbedLinks',
  normalizeUrl: normalizeApplePodcastEmbedUrl,
  search: async (query) => {
    const results = await searchApplePodcastCatalog(query)
    return [
      { title: 'Podcasts', items: results.shows },
      { title: 'Episodes', items: results.episodes },
    ]
  },
  searchPlaceholder: 'Podcasts, episodes…',
  searchHint: 'Search the Apple Podcasts catalog, then tap to play.',
  addPlaceholder: 'Paste another Apple Podcast show or episode link',
  invalidLinkMessage: 'Please paste a valid Apple Podcast show or episode link.',
  renderEmbed: ({ shareUrl, embedSize, colorScheme }) => (
    <PodcastEmbedWidget
      title="Apple Podcast"
      provider="apple-podcast"
      shareUrl={shareUrl}
      showHeader={false}
      showStatus={false}
      showActions={false}
      embedSize={embedSize}
      colorScheme={colorScheme}
    />
  ),
}

interface ApplePodcastWidgetProps {
  readonly isFullscreen?: boolean
}

export function ApplePodcastWidget({ isFullscreen = false }: ApplePodcastWidgetProps) {
  return <AppleMediaWidget config={APPLE_PODCAST_CONFIG} isFullscreen={isFullscreen} />
}
