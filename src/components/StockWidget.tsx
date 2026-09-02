import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, RefreshCw } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { useSettings } from '../lib/useSettings'
import { isMotionEnabled, loadAnimeJs, MOTION_DURATIONS, MOTION_STAGGERS } from '../lib/anime'
import styles from './StockWidget.module.css'

interface StockQuote {
  symbol: string
  name: string
  exchange: string | null
  currency: string
  price: number
  previousClose: number | null
  change: number | null
  percentChange: number | null
  marketState: string | null
  closes: number[]
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

// Route through allorigins.win (free CORS proxy) → Yahoo Finance chart API
// Returns 30 days of daily closes + current price/change/meta
async function fetchStockQuote(symbol: string): Promise<StockQuote> {
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=30d`
  const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Could not load stock data.')
  }

  const data = await response.json()
  const result = data?.chart?.result?.[0]
  if (!result) {
    const errMsg = data?.chart?.error?.description
    throw new Error(typeof errMsg === 'string' ? errMsg : 'Unknown symbol or no data.')
  }

  const meta = result.meta ?? {}
  const price = parseNumber(meta.regularMarketPrice)
  if (price === null) throw new Error('Could not load stock data.')

  const previousClose = parseNumber(meta.chartPreviousClose)
  const change = previousClose !== null ? price - previousClose : null
  const percentChange = previousClose !== null && previousClose !== 0
    ? ((price - previousClose) / previousClose) * 100
    : null

  const rawCloses: unknown[] = result.indicators?.quote?.[0]?.close ?? []
  const closes = rawCloses
    .filter((c): c is number => typeof c === 'number' && Number.isFinite(c))

  return {
    symbol: typeof meta.symbol === 'string' && meta.symbol.trim()
      ? meta.symbol.trim().toUpperCase()
      : symbol.toUpperCase(),
    name: (typeof meta.longName === 'string' && meta.longName.trim()
      ? meta.longName.trim()
      : typeof meta.shortName === 'string' && meta.shortName.trim()
        ? meta.shortName.trim()
        : symbol),
    exchange: typeof meta.exchangeName === 'string' && meta.exchangeName.trim()
      ? meta.exchangeName.trim()
      : null,
    currency: typeof meta.currency === 'string' && meta.currency.trim()
      ? meta.currency.trim().toUpperCase()
      : 'USD',
    price,
    previousClose,
    change,
    percentChange,
    marketState: typeof meta.marketState === 'string' ? meta.marketState : null,
    closes,
  }
}

function formatCurrencyAmount(value: number, currency: string): string {
  const currencyCode = /^[A-Z]{3}$/.test(currency) ? currency : 'USD'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(value)
}

interface StockRowState {
  quote: StockQuote | null
  loading: boolean
  error: string | null
}

interface StockRowProps {
  symbol: string
  state: StockRowState
}

function StockRow({ symbol, state }: StockRowProps) {
  const { quote, loading, error } = state
  const change = quote?.change ?? null
  const percentChange = quote?.percentChange ?? null
  const isPositive = change !== null && change >= 0

  const chartColor = change === null
    ? 'var(--color-text-muted)'
    : isPositive ? '#22c55e' : '#ef4444'

  const chartData = quote?.closes.map((price, i) => ({ i, price })) ?? []

  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.symbol}>{symbol}</span>
        {quote && <span className={styles.name}>{quote.name}</span>}
      </div>

      {loading && <div className={styles.rowLoading}>Loading…</div>}
      {!loading && error && <div className={styles.rowError}>{error}</div>}

      {!loading && !error && quote && (
        <div className={styles.rowBody}>
          <div className={styles.rowData}>
            <div className={styles.price}>{formatCurrencyAmount(quote.price, quote.currency)}</div>
            <div className={[styles.change, isPositive ? styles.positive : styles.negative].join(' ')}>
              {change !== null && (isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />)}
              <span>
                {change === null ? 'N/A' : `${isPositive ? '+' : ''}${change.toFixed(2)}`}
                {percentChange != null && ` (${isPositive ? '+' : ''}${percentChange.toFixed(2)}%)`}
              </span>
            </div>
            <div className={styles.rowMeta}>
              {quote.exchange && <span>{quote.exchange}</span>}
              {quote.marketState && <span>{quote.marketState === 'REGULAR' ? '● Open' : '○ Closed'}</span>}
            </div>
          </div>

          {chartData.length >= 2 && (
            <div className={styles.chart}>
              <ResponsiveContainer width="100%" height={48}>
                <LineChart data={chartData} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke={chartColor}
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Tooltip
                    formatter={(v) => [formatCurrencyAmount(Number(v), quote.currency), '']}
                    labelFormatter={() => ''}
                    contentStyle={{ fontSize: '0.7rem', padding: '2px 6px' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface StockWidgetProps {
  readonly isFullscreen?: boolean
}

export function StockWidget({ isFullscreen = false }: StockWidgetProps) {
  const { settings } = useSettings()
  const symbols = settings.stockSymbols
  const refreshMs = settings.financeRefreshMinutes * 60_000
  const widgetRootRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const [rows, setRows] = useState<Map<string, StockRowState>>(() =>
    new Map(symbols.map((s) => [s, { quote: null, loading: true, error: null }])),
  )

  const loadSymbol = useCallback((symbol: string) => {
    setRows((prev) => {
      const next = new Map(prev)
      const existing = next.get(symbol) ?? { quote: null, loading: false, error: null }
      next.set(symbol, { ...existing, loading: true, error: null })
      return next
    })

    fetchStockQuote(symbol)
      .then((quote) => {
        setRows((prev) => {
          const next = new Map(prev)
          next.set(symbol, { quote, loading: false, error: null })
          return next
        })
      })
      .catch((err: unknown) => {
        setRows((prev) => {
          const next = new Map(prev)
          const existing = next.get(symbol) ?? { quote: null, loading: false, error: null }
          next.set(symbol, {
            ...existing,
            loading: false,
            error: err instanceof Error ? err.message : 'Could not load stock data.',
          })
          return next
        })
      })
  }, [])

  const loadAll = useCallback(() => {
    for (const symbol of symbols) loadSymbol(symbol)
  }, [symbols, loadSymbol])

  // Sync rows map when symbols change
  useEffect(() => {
    setRows((prev) => {
      const next = new Map<string, StockRowState>()
      for (const sym of symbols) {
        next.set(sym, prev.get(sym) ?? { quote: null, loading: true, error: null })
      }
      return next
    })
    loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(',')])

  // Auto-refresh
  useEffect(() => {
    if (refreshMs <= 0) return
    const id = setInterval(loadAll, refreshMs)
    return () => clearInterval(id)
  }, [loadAll, refreshMs])

  const anyLoading = [...rows.values()].some((r) => r.loading)
  const rowAnimationSignature = useMemo(
    () =>
      symbols
        .map((symbol) => {
          const row = rows.get(symbol)
          const price = row?.quote?.price ?? 0
          return `${symbol}:${row?.loading ? '1' : '0'}:${row?.error ? 'e' : 'ok'}:${price.toFixed(4)}`
        })
        .join('|'),
    [rows, symbols],
  )

  useEffect(() => {
    if (!isMotionEnabled()) {
      return
    }

    const listNode = listRef.current
    if (!listNode) {
      return
    }

    const rowNodes = Array.from(listNode.querySelectorAll<HTMLElement>(`.${styles.row}`))
    if (!rowNodes.length) {
      return
    }

    let cancelled = false
    let activeAnimations: Array<{ cancel?: () => void }> = []

    void loadAnimeJs().then((anime) => {
      if (cancelled || !anime?.animate) {
        return
      }

      if (anime.stagger) {
        activeAnimations = [
          anime.animate(rowNodes, {
            opacity: [0, 1],
            translateY: [8, 0],
            duration: MOTION_DURATIONS.medium,
            delay: anime.stagger(MOTION_STAGGERS.tight),
          }),
        ]
        return
      }

      activeAnimations = rowNodes.map((rowNode, index) =>
        anime.animate(rowNode, {
          opacity: [0, 1],
          translateY: [8, 0],
          duration: MOTION_DURATIONS.medium,
          delay: index * MOTION_STAGGERS.tight,
        }),
      )
    })

    return () => {
      cancelled = true
      activeAnimations.forEach((animation) => animation.cancel?.())
    }
  }, [rowAnimationSignature])

  useEffect(() => {
    if (!isMotionEnabled()) {
      return
    }

    const rootNode = widgetRootRef.current
    if (!rootNode) {
      return
    }

    let cancelled = false

    const animateRefresh = (
      button: HTMLButtonElement,
      options: { scale: number; translateY: number; duration: number },
    ) => {
      void loadAnimeJs().then((anime) => {
        if (cancelled || !anime?.animate) {
          return
        }
        anime.animate(button, options)
      })
    }

    const resolveRefreshButton = (target: EventTarget | null) => {
      if (!(target instanceof Element)) {
        return null
      }
      const button = target.closest('button')
      if (!(button instanceof HTMLButtonElement) || !button.classList.contains(styles.refresh)) {
        return null
      }
      return button
    }

    const handlePointerEnter = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') {
        return
      }
      const button = resolveRefreshButton(event.target)
      if (!button || button.disabled) {
        return
      }
      animateRefresh(button, { scale: 1.06, translateY: -1, duration: MOTION_DURATIONS.quick })
    }

    const handlePointerLeave = (event: PointerEvent) => {
      const button = resolveRefreshButton(event.target)
      if (!button) {
        return
      }
      animateRefresh(button, { scale: 1, translateY: 0, duration: MOTION_DURATIONS.quick })
    }

    const handlePointerDown = (event: PointerEvent) => {
      const button = resolveRefreshButton(event.target)
      if (!button || button.disabled) {
        return
      }
      animateRefresh(button, { scale: 0.95, translateY: 0, duration: Math.max(80, MOTION_DURATIONS.quick - 50) })
    }

    const handlePointerUp = (event: PointerEvent) => {
      const button = resolveRefreshButton(event.target)
      if (!button || button.disabled) {
        return
      }
      animateRefresh(button, {
        scale: button.matches(':hover') ? 1.06 : 1,
        translateY: button.matches(':hover') ? -1 : 0,
        duration: MOTION_DURATIONS.quick,
      })
    }

    rootNode.addEventListener('pointerenter', handlePointerEnter, true)
    rootNode.addEventListener('pointerleave', handlePointerLeave, true)
    rootNode.addEventListener('pointerdown', handlePointerDown, true)
    rootNode.addEventListener('pointerup', handlePointerUp, true)
    rootNode.addEventListener('pointercancel', handlePointerUp, true)

    return () => {
      cancelled = true
      rootNode.removeEventListener('pointerenter', handlePointerEnter, true)
      rootNode.removeEventListener('pointerleave', handlePointerLeave, true)
      rootNode.removeEventListener('pointerdown', handlePointerDown, true)
      rootNode.removeEventListener('pointerup', handlePointerUp, true)
      rootNode.removeEventListener('pointercancel', handlePointerUp, true)
    }
  }, [])

  return (
    <div ref={widgetRootRef} className={[styles.widget, isFullscreen ? styles.fullscreen : ''].join(' ')}>
      <div className={styles.header}>
        <span className={styles.title}>Stocks</span>
        {!anyLoading && (
          <button
            className={styles.refresh}
            onClick={loadAll}
            title="Refresh stock quotes"
            aria-label="Refresh stock quotes"
            type="button"
          >
            <RefreshCw size={14} />
          </button>
        )}
      </div>

      <div ref={listRef} className={styles.list}>
        {symbols.map((sym) => (
          <StockRow
            key={sym}
            symbol={sym}
            state={rows.get(sym) ?? { quote: null, loading: true, error: null }}
          />
        ))}
      </div>
    </div>
  )
}
