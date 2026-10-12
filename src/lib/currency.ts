export interface CurrencyRate {
  base: string
  target: string
  rate: number
  date: string | null
}

interface RateTable {
  rates: Record<string, number>
  date: string | null
  /** The provider publishes new rates once a day; reuse these until then. */
  validUntilMs: number
}

const FALLBACK_CACHE_MS = 60 * 60_000
const rateTables = new Map<string, Promise<RateTable>>()

export function clearCurrencyRateCache(): void {
  rateTables.clear()
}

// open.er-api.com: free, no API key, CORS open (access-control-allow-origin: *)
async function loadRateTable(base: string): Promise<RateTable> {
  const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`)
  if (!response.ok) throw new Error('Could not load currency data.')

  const data = await response.json()
  if (data?.result !== 'success' || !data.rates || typeof data.rates !== 'object') {
    throw new Error('Could not load currency data.')
  }

  // time_last_update_utc e.g. "Sun, 09 Aug 2026 00:02:31 +0000": keep the date part.
  const rawDate = typeof data.time_last_update_utc === 'string' ? data.time_last_update_utc : null
  const nextUpdateMs = typeof data.time_next_update_unix === 'number' ? data.time_next_update_unix * 1000 : null

  return {
    rates: data.rates as Record<string, number>,
    date: rawDate ? rawDate.split(' ').slice(1, 4).join(' ') : null,
    validUntilMs: nextUpdateMs && nextUpdateMs > Date.now() ? nextUpdateMs : Date.now() + FALLBACK_CACHE_MS,
  }
}

async function getRateTable(base: string): Promise<RateTable> {
  const cached = rateTables.get(base)
  if (cached) {
    try {
      const table = await cached
      if (table.validUntilMs > Date.now()) return table
    } catch {
      // A failed lookup is retried below.
    }
  }

  const request = loadRateTable(base)
  rateTables.set(base, request)
  request.catch(() => {
    if (rateTables.get(base) === request) rateTables.delete(base)
  })
  return request
}

/** Rates for each [base, target] pair, one request per base currency. */
export async function fetchPairRates(
  pairs: ReadonlyArray<readonly [string, string]>,
): Promise<PromiseSettledResult<CurrencyRate>[]> {
  return Promise.allSettled(
    pairs.map(async ([base, target]) => {
      if (base === target) return { base, target, rate: 1, date: null }

      const table = await getRateTable(base)
      const rate = table.rates[target]
      if (typeof rate !== 'number') throw new Error(`Unknown currency code: ${target}.`)
      return { base, target, rate, date: table.date }
    }),
  )
}
