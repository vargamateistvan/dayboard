export interface StockQuote {
  symbol: string
  name: string
  exchange: string | null
  currency: string
  price: number
  previousClose: number | null
  change: number | null
  percentChange: number | null
  marketState: 'open' | 'closed' | null
  closes: number[]
}

// Some exchanges quote in minor units; Yahoo marks these with a lower-case
// currency code. Prices are converted so they read in the main currency.
const MINOR_UNIT_CURRENCIES: Record<string, { currency: string; divisor: number }> = {
  GBp: { currency: 'GBP', divisor: 100 },
  GBX: { currency: 'GBP', divisor: 100 },
  ZAc: { currency: 'ZAR', divisor: 100 },
  ILA: { currency: 'ILS', divisor: 100 },
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** Start of the trading day `instantSeconds` falls in, in exchange time. */
function tradingDayStart(instantSeconds: number, gmtOffsetSeconds: number): number {
  const local = instantSeconds + gmtOffsetSeconds
  return local - (((local % 86_400) + 86_400) % 86_400) - gmtOffsetSeconds
}

export function parseStockChart(symbol: string, data: unknown, nowSeconds = Date.now() / 1000): StockQuote {
  const result = (data as { chart?: { result?: unknown[]; error?: { description?: unknown } } })?.chart?.result?.[0] as
    | {
        meta?: Record<string, unknown>
        timestamp?: unknown[]
        indicators?: { quote?: Array<{ close?: unknown[] }> }
      }
    | undefined
  if (!result) {
    const errMsg = (data as { chart?: { error?: { description?: unknown } } })?.chart?.error?.description
    throw new Error(typeof errMsg === 'string' ? errMsg : 'Unknown symbol or no data.')
  }

  const meta = result.meta ?? {}
  const rawCurrency = nonEmptyString(meta.currency) ?? 'USD'
  const minorUnit = MINOR_UNIT_CURRENCIES[rawCurrency]
  const divisor = minorUnit?.divisor ?? 1
  const currency = minorUnit?.currency ?? rawCurrency.toUpperCase()

  const rawPrice = parseNumber(meta.regularMarketPrice)
  if (rawPrice === null) throw new Error('Could not load stock data.')
  const price = rawPrice / divisor

  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : []
  const rawCloses = result.indicators?.quote?.[0]?.close ?? []
  const gmtOffset = parseNumber(meta.gmtoffset) ?? 0
  const marketTime = parseNumber(meta.regularMarketTime) ?? nowSeconds
  const regular = (meta.currentTradingPeriod as { regular?: { start?: unknown; end?: unknown } } | undefined)?.regular
  const regularStart = parseNumber(regular?.start)
  const regularEnd = parseNumber(regular?.end)

  // The daily change compares with the last close before the current trading
  // day. (meta.chartPreviousClose is the close before the whole 30-day range.)
  const dayStart = regularStart ?? tradingDayStart(marketTime, gmtOffset)
  let previousClose: number | null = null
  for (let index = rawCloses.length - 1; index >= 0; index -= 1) {
    const close = parseNumber(rawCloses[index])
    const timestamp = parseNumber(timestamps[index])
    if (close !== null && timestamp !== null && timestamp < dayStart) {
      previousClose = close / divisor
      break
    }
  }

  const change = previousClose !== null ? price - previousClose : null
  const percentChange = previousClose !== null && previousClose !== 0 ? ((price - previousClose) / previousClose) * 100 : null

  const closes = rawCloses
    .map((close) => parseNumber(close))
    .filter((close): close is number => close !== null)
    .map((close) => close / divisor)

  return {
    symbol: nonEmptyString(meta.symbol)?.toUpperCase() ?? symbol.toUpperCase(),
    name: nonEmptyString(meta.longName) ?? nonEmptyString(meta.shortName) ?? symbol,
    exchange: nonEmptyString(meta.exchangeName),
    currency,
    price,
    previousClose,
    change,
    percentChange,
    marketState:
      regularStart !== null && regularEnd !== null
        ? nowSeconds >= regularStart && nowSeconds < regularEnd
          ? 'open'
          : 'closed'
        : null,
    closes,
  }
}

// Route through allorigins.win (free CORS proxy) → Yahoo Finance chart API.
export async function fetchStockQuote(symbol: string, signal?: AbortSignal): Promise<StockQuote> {
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=30d`
  const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`

  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error('Could not load stock data.')
  }

  return parseStockChart(symbol, await response.json())
}

export function formatStockPrice(value: number, currency: string): string {
  const currencyCode = /^[A-Z]{3}$/.test(currency) ? currency : 'USD'
  // Sub-unit prices (some crypto, penny stocks) would round to 0.00.
  const options: Intl.NumberFormatOptions =
    Math.abs(value) > 0 && Math.abs(value) < 1
      ? { maximumSignificantDigits: 4 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode, ...options }).format(value)
}
