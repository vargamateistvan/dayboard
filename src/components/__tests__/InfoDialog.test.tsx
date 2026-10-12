import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InfoDialog } from '../InfoDialog'

function stubReleases(response: { ok: boolean; status: number; body: unknown }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: response.ok, status: response.status, json: async () => response.body })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('InfoDialog', () => {
  it('shows only the latest version with its date and notes', async () => {
    stubReleases({
      ok: true,
      status: 200,
      body: {
        tag_name: '1.95.0',
        published_at: '2026-10-12T08:47:10Z',
        html_url: 'https://github.com/vargamateistvan/dayboard/releases/tag/1.95.0',
        body: '### Features\n\n- stable clock digits (1a804ad)\n',
      },
    })

    render(<InfoDialog onClose={() => {}} />)

    expect(await screen.findByRole('link', { name: 'v1.95.0' })).toHaveAttribute(
      'href',
      'https://github.com/vargamateistvan/dayboard/releases/tag/1.95.0',
    )
    const expectedDate = new Date('2026-10-12T08:47:10Z').toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
    expect(screen.getByText(`Released ${expectedDate}`)).toHaveAttribute('datetime', '2026-10-12T08:47:10Z')
    expect(screen.getByText('stable clock digits')).toBeInTheDocument()
    expect(screen.queryByText('Earlier releases')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'All releases on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/vargamateistvan/dayboard/releases',
    )
  })

  it('falls back to a link to GitHub when releases cannot be loaded', async () => {
    stubReleases({ ok: false, status: 403, body: {} })

    render(<InfoDialog onClose={() => {}} />)

    expect(await screen.findByText(/Couldn't load release info/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View releases on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/vargamateistvan/dayboard/releases',
    )
  })
})
