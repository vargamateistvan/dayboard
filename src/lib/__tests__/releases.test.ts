import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchLatestRelease, parseReleaseNotes } from '../releases'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('parseReleaseNotes', () => {
  it('groups items under headings and strips commit hashes', () => {
    expect(
      parseReleaseNotes(
        '### Features\n\n- add custom fonts (1324af6)\n- add presets (65bd715)\n\n### Fixes\n\n- fix map size (a949caa)\n',
      ),
    ).toEqual([
      { title: 'Features', items: ['add custom fonts', 'add presets'] },
      { title: 'Fixes', items: ['fix map size'] },
    ])
  })

  it('puts items without a heading under a default section and drops empty sections', () => {
    expect(parseReleaseNotes('- tweak layout\n\n### Empty\n')).toEqual([
      { title: 'Changes', items: ['tweak layout'] },
    ])
  })
})

describe('fetchLatestRelease', () => {
  it('maps the latest release', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          tag_name: '1.95.0',
          published_at: '2026-10-12T08:47:10Z',
          html_url: 'https://github.com/vargamateistvan/dayboard/releases/tag/1.95.0',
          body: '### Features\n\n- stable clock digits (1a804ad)\n',
        }),
      })),
    )

    await expect(fetchLatestRelease()).resolves.toEqual({
      version: '1.95.0',
      publishedAt: '2026-10-12T08:47:10Z',
      url: 'https://github.com/vargamateistvan/dayboard/releases/tag/1.95.0',
      sections: [{ title: 'Features', items: ['stable clock digits'] }],
    })
  })

  it('returns null when no release has been published', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })))

    await expect(fetchLatestRelease()).resolves.toBeNull()
  })

  it('throws when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) })))

    await expect(fetchLatestRelease()).rejects.toThrow('Failed to load latest release (403)')
  })
})
