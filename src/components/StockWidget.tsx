import { useCallback, useEffect, useMemo, useRef } from 'react'
import { ArrowDownRight, ArrowUpRight, RefreshCw } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { useSettings } from '../lib/useSettings'
import { isMotionEnabled, loadAnimeJs, MOTION_DURATIONS, MOTION_STAGGERS } from '../lib/anime'
import { usePolledResource } from '../lib/usePolledResource'
import { fetchStockQuote, formatStockPrice, type StockQuote } from '../lib/stocks'
import styles from './StockWidget.module.css'

interface StockRowState {
  /** Last good quote; kept when a refresh of this symbol fails. */
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

      {loading && !quote && <div className={styles.rowLoading}>Loading…</div>}
      {!loading && error && !quote && <div className={styles.rowError}>{error}</div>}

      {quote && (
        <div className={styles.rowBody}>
          <div className={styles.rowData}>
            <div className={styles.price}>{formatStockPrice(quote.price, quote.currency)}</div>
            <div className={[styles.change, isPositive ? styles.positive : styles.negative].join(' ')}>
              {change !== null && (isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />)}
              <span>
                {change === null ? 'N/A' : `${isPositive ? '+' : ''}${change.toFixed(2)}`}
                {percentChange != null && ` (${isPositive ? '+' : ''}${percentChange.toFixed(2)}%)`}
              </span>
            </div>
            <div className={styles.rowMeta}>
              {quote.exchange && <span>{quote.exchange}</span>}
              {quote.marketState && <span>{quote.marketState === 'open' ? '● Open' : '○ Closed'}</span>}
              {error && <span role="status">Couldn&apos;t refresh</span>}
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
                    formatter={(v) => [formatStockPrice(Number(v), quote.currency), '']}
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

  const symbolsKey = symbols.join(',')
  const lastQuotesRef = useRef(new Map<string, StockQuote>())

  // One request per symbol; a failing symbol keeps its last quote and does not
  // affect the others.
  const fetcher = useCallback(
    async (signal: AbortSignal) => {
      const requested = symbolsKey ? symbolsKey.split(',') : []
      const results = await Promise.allSettled(requested.map((symbol) => fetchStockQuote(symbol, signal)))
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')

      const nextRows = new Map<string, StockRowState>()
      results.forEach((result, index) => {
        const symbol = requested[index]
        if (result.status === 'fulfilled') {
          lastQuotesRef.current.set(symbol, result.value)
          nextRows.set(symbol, { quote: result.value, loading: false, error: null })
        } else {
          nextRows.set(symbol, {
            quote: lastQuotesRef.current.get(symbol) ?? null,
            loading: false,
            error: result.reason instanceof Error ? result.reason.message : 'Could not load stock data.',
          })
        }
      })
      return nextRows
    },
    [symbolsKey],
  )
  const { data: rows, refreshing, refresh: loadAll } = usePolledResource(fetcher, {
    intervalMs: refreshMs,
    key: symbolsKey,
  })

  const rowStateFor = (symbol: string): StockRowState =>
    rows?.get(symbol) ?? {
      quote: lastQuotesRef.current.get(symbol) ?? null,
      loading: true,
      error: null,
    }

  const anyLoading = refreshing && !rows
  const rowAnimationSignature = useMemo(
    () =>
      symbols
        .map((symbol) => {
          const row = rowStateFor(symbol)
          const price = row?.quote?.price ?? 0
          return `${symbol}:${row?.loading ? '1' : '0'}:${row?.error ? 'e' : 'ok'}:${price.toFixed(4)}`
        })
        .join('|'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, symbolsKey],
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
            state={rowStateFor(sym)}
          />
        ))}
      </div>
    </div>
  )
}
