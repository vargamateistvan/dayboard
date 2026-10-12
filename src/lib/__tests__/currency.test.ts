import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearCurrencyRateCache, fetchPairRates } from '../currency'

function ratesResponse(base: string, rates: Record<string, number>, nextUpdateUnix: number) {
  return {
    ok: true,
    json: async () => ({
      result: 'success',
      base_code: base,
      rates,
      time_last_update_utc: 'Mon, 12 Oct 2026 00:02:31 +0000',
      time_next_update_unix: nextUpdateUnix,
    }),
  }
}

describe('fetchPairRates', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-12T09:00:00Z'))
    clearCurrencyRateCache()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const nextUpdate = Date.parse('2026-10-13T00:00:00Z') / 1000

  it('fetches each base currency once for all its pairs', async () => {
    const fetchMock = vi.fn(async () => ratesResponse('USD', { EUR: 0.92, GBP: 0.79 }, nextUpdate))
    vi.stubGlobal('fetch', fetchMock)

    const results = await fetchPairRates([
      ['USD', 'EUR'],
      ['USD', 'GBP'],
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(results.map((result) => (result.status === 'fulfilled' ? result.value.rate : null))).toEqual([0.92, 0.79])
  })

  it('reuses rates until the provider publishes new ones', async () => {
    const fetchMock = vi.fn(async () => ratesResponse('USD', { EUR: 0.92 }, nextUpdate))
    vi.stubGlobal('fetch', fetchMock)

    await fetchPairRates([['USD', 'EUR']])
    vi.setSystemTime(new Date('2026-10-12T20:00:00Z'))
    await fetchPairRates([['USD', 'EUR']])
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.setSystemTime(new Date('2026-10-13T00:05:00Z'))
    await fetchPairRates([['USD', 'EUR']])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('reports an unknown target for that pair only', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ratesResponse('USD', { EUR: 0.92 }, nextUpdate)))

    const [good, bad] = await fetchPairRates([
      ['USD', 'EUR'],
      ['USD', 'XXX'],
    ])

    expect(good.status).toBe('fulfilled')
    expect(bad.status).toBe('rejected')
  })

  it('returns 1 for a currency against itself without a request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const [same] = await fetchPairRates([['EUR', 'EUR']])

    expect(same.status === 'fulfilled' && same.value.rate).toBe(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
