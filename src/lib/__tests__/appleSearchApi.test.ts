import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchAppleMusicCatalog, searchApplePodcastCatalog } from '../appleSearchApi'

function mockFetchResponses(responses: Record<string, unknown[]>) {
  return vi.fn(async (input: string | URL) => {
    const url = new URL(String(input))
    const entity = url.searchParams.get('entity') ?? ''
    return {
      ok: true,
      status: 200,
      json: async () => ({ results: responses[entity] ?? [] }),
    }
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('searchAppleMusicCatalog', () => {
  it('maps songs, albums, and artists from the iTunes response', async () => {
    const fetchMock = mockFetchResponses({
      song: [
        {
          wrapperType: 'track',
          kind: 'song',
          trackName: 'Dreams',
          artistName: 'Fleetwood Mac',
          trackViewUrl:
            'https://music.apple.com/us/album/dreams/202271826?i=202272624&uo=4',
          artworkUrl100: 'https://example.com/dreams.jpg',
        },
      ],
      album: [
        {
          wrapperType: 'collection',
          collectionName: 'Rumours',
          artistName: 'Fleetwood Mac',
          collectionViewUrl:
            'https://music.apple.com/us/album/rumours/594061854?uo=4',
          artworkUrl100: 'https://example.com/rumours.jpg',
        },
      ],
      musicArtist: [
        {
          wrapperType: 'artist',
          artistName: 'Fleetwood Mac',
          primaryGenreName: 'Rock',
          artistLinkUrl:
            'https://music.apple.com/us/artist/fleetwood-mac/158038?uo=4',
        },
      ],
    })
    vi.stubGlobal('fetch', fetchMock)

    const results = await searchAppleMusicCatalog('fleetwood mac')

    expect(results.songs).toEqual([
      {
        url: 'https://music.apple.com/us/album/dreams/202271826?i=202272624',
        title: 'Dreams',
        subtitle: 'Fleetwood Mac',
        artworkUrl: 'https://example.com/dreams.jpg',
      },
    ])
    expect(results.albums).toEqual([
      {
        url: 'https://music.apple.com/us/album/rumours/594061854',
        title: 'Rumours',
        subtitle: 'Fleetwood Mac',
        artworkUrl: 'https://example.com/rumours.jpg',
      },
    ])
    expect(results.artists).toEqual([
      {
        url: 'https://music.apple.com/us/artist/fleetwood-mac/158038',
        title: 'Fleetwood Mac',
        subtitle: 'Rock',
        artworkUrl: undefined,
      },
    ])

    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]))
    expect(requestedUrls).toHaveLength(3)
    requestedUrls.forEach((url) => {
      expect(url).toContain('https://itunes.apple.com/search')
      expect(url).toContain('media=music')
    })
  })

  it('drops results without usable Apple Music links', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchResponses({
        song: [
          { trackName: 'No URL' },
          {
            trackName: 'Wrong host',
            trackViewUrl: 'https://example.com/song',
          },
        ],
      }),
    )

    const results = await searchAppleMusicCatalog('test')
    expect(results.songs).toEqual([])
  })

  it('throws when the iTunes API responds with an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })),
    )

    await expect(searchAppleMusicCatalog('test')).rejects.toThrow(
      'Apple catalog search failed (503).',
    )
  })
})

describe('searchApplePodcastCatalog', () => {
  it('maps shows and episodes from the iTunes response', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchResponses({
        podcast: [
          {
            wrapperType: 'track',
            kind: 'podcast',
            collectionName: 'Huberman Lab',
            artistName: 'Scicomm Media',
            collectionViewUrl:
              'https://podcasts.apple.com/us/podcast/huberman-lab/id1545953110?uo=4',
            artworkUrl100: 'https://example.com/huberman.jpg',
          },
        ],
        podcastEpisode: [
          {
            wrapperType: 'podcastEpisode',
            kind: 'podcast-episode',
            trackName: 'Sleep Toolkit',
            collectionName: 'Huberman Lab',
            trackViewUrl:
              'https://podcasts.apple.com/us/podcast/sleep-toolkit/id1545953110?i=1000575000000&uo=4',
            artworkUrl160: 'https://example.com/episode.jpg',
          },
        ],
      }),
    )

    const results = await searchApplePodcastCatalog('huberman')

    expect(results.shows).toEqual([
      {
        url: 'https://podcasts.apple.com/us/podcast/huberman-lab/id1545953110',
        title: 'Huberman Lab',
        subtitle: 'Scicomm Media',
        artworkUrl: 'https://example.com/huberman.jpg',
      },
    ])
    expect(results.episodes).toEqual([
      {
        url: 'https://podcasts.apple.com/us/podcast/sleep-toolkit/id1545953110?i=1000575000000',
        title: 'Sleep Toolkit',
        subtitle: 'Huberman Lab',
        artworkUrl: 'https://example.com/episode.jpg',
      },
    ])
  })
})
