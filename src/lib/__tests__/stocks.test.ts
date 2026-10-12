import { describe, expect, it } from 'vitest'
import { formatStockPrice, parseStockChart } from '../stocks'

const DAY = 86_400
// Trading days at 13:30 UTC (09:30 New York, EDT).
const OPEN_OCT_8 = Date.UTC(2026, 9, 8, 13, 30) / 1000
const NY_OFFSET = -4 * 3600

// Shape of a real Yahoo v8 chart response (interval=1d, range=30d), trimmed.
function chart({
  closes,
  price,
  chartPreviousClose,
  currency = 'USD',
  nowSeconds,
}: {
  closes: Array<number | null>
  price: number
  chartPreviousClose: number
  currency?: string
  nowSeconds: number
}) {
  const timestamps = closes.map((_, index) => OPEN_OCT_8 - (closes.length - 1 - index) * DAY)
  const todayOpen = timestamps[timestamps.length - 1]
  return {
    chart: {
      result: [
        {
          meta: {
            symbol: 'AAPL',
            longName: 'Apple Inc.',
            exchangeName: 'NMS',
            currency,
            regularMarketPrice: price,
            chartPreviousClose,
            regularMarketTime: nowSeconds,
            gmtoffset: NY_OFFSET,
            currentTradingPeriod: {
              regular: { start: todayOpen, end: todayOpen + 6.5 * 3600, gmtoffset: NY_OFFSET },
            },
          },
          timestamp: timestamps,
          indicators: { quote: [{ close: closes }] },
        },
      ],
      error: null,
    },
  }
}

describe('parseStockChart', () => {
  it('measures the change from the previous trading day, not from 30 days ago', () => {
    // Values from AAPL on a day it fell 1.11%; chartPreviousClose is the close before the 30-day range.
    const now = OPEN_OCT_8 + 2 * 3600
    const quote = parseStockChart(
      'AAPL',
      chart({ closes: [320.1, 340.42, 336.64], price: 336.64, chartPreviousClose: 314.58, nowSeconds: now }),
      now,
    )

    expect(quote.previousClose).toBe(340.42)
    expect(quote.change).toBeCloseTo(-3.78, 2)
    expect(quote.percentChange).toBeCloseTo(-1.11, 2)
  })

  it('skips missing closes when finding the previous trading day', () => {
    const now = OPEN_OCT_8 + 3600
    const quote = parseStockChart(
      'AAPL',
      chart({ closes: [100, null, 102], price: 102, chartPreviousClose: 90, nowSeconds: now }),
      now,
    )

    expect(quote.previousClose).toBe(100)
  })

  it('converts pence-quoted London prices to pounds', () => {
    const now = OPEN_OCT_8 + 3600
    const quote = parseStockChart(
      'VOD.L',
      chart({ closes: [69.8, 70.5], price: 70.5, chartPreviousClose: 68, currency: 'GBp', nowSeconds: now }),
      now,
    )

    expect(quote.currency).toBe('GBP')
    expect(quote.price).toBeCloseTo(0.705, 5)
    expect(quote.closes[quote.closes.length - 1]).toBeCloseTo(0.705, 5)
  })

  it('converts South African cents to rand', () => {
    const now = OPEN_OCT_8 + 3600
    const quote = parseStockChart(
      'NPN.JO',
      chart({ closes: [300000, 310000], price: 310000, chartPreviousClose: 290000, currency: 'ZAc', nowSeconds: now }),
      now,
    )

    expect(quote.currency).toBe('ZAR')
    expect(quote.price).toBe(3100)
  })

  it('works out whether the market is open from the trading period', () => {
    const response = chart({ closes: [100, 101], price: 101, chartPreviousClose: 99, nowSeconds: OPEN_OCT_8 })

    expect(parseStockChart('AAPL', response, OPEN_OCT_8 + 3600).marketState).toBe('open')
    expect(parseStockChart('AAPL', response, OPEN_OCT_8 + 8 * 3600).marketState).toBe('closed')
  })
})

describe('formatStockPrice', () => {
  it('keeps sub-cent prices readable', () => {
    expect(formatStockPrice(0.000123, 'USD')).not.toBe('$0.00')
    expect(formatStockPrice(0.000123, 'USD')).toMatch(/0\.000123/)
  })

  it('uses two decimals for normal prices', () => {
    expect(formatStockPrice(313.333, 'USD')).toMatch(/313\.33/)
  })
})
