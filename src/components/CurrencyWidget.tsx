import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { useSettings } from '../lib/useSettings'
import { isMotionEnabled, loadAnimeJs, MOTION_DURATIONS, MOTION_STAGGERS } from '../lib/anime'
import styles from './CurrencyWidget.module.css'

interface CurrencyRate {
  base: string
  target: string
  rate: number
  date: string | null
}

// open.er-api.com: free, no API key, CORS open (access-control-allow-origin: *)
async function fetchCurrencyRate(base: string, target: string): Promise<CurrencyRate> {
  if (base === target) {
    return { base, target, rate: 1, date: null }
  }

  const response = await fetch(
    `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`,
  )

  if (!response.ok) {
    throw new Error('Could not load currency data.')
  }

  const data = await response.json()
  if (data?.result !== 'success') {
    throw new Error('Could not load currency data.')
  }

  const rate = typeof data?.rates?.[target] === 'number' ? data.rates[target] : null
  if (rate === null) {
    throw new Error(`Unknown currency code: ${target}.`)
  }

  // time_last_update_utc e.g. "Sun, 09 Aug 2026 00:02:31 +0000" — extract the date portion
  const rawDate = typeof data.time_last_update_utc === 'string' ? data.time_last_update_utc : null
  const date = rawDate ? rawDate.split(' ').slice(1, 4).join(' ') : null

  return {
    base: typeof data.base === 'string' && data.base.trim() ? data.base.trim().toUpperCase() : base,
    target,
    rate,
    date,
  }
}

function formatRate(value: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 6,
  }).format(value)
}

interface RatePoint {
  t: number
  rate: number
}

interface PairRowState {
  rate: CurrencyRate | null
  loading: boolean
  error: string | null
  history: RatePoint[]
}

function pairKey(base: string, target: string): string {
  return `${base}/${target}`
}

interface PairRowProps {
  pairId: string
  state: PairRowState
}

function PairRow({ pairId, state }: PairRowProps) {
  const { rate, loading, error, history } = state
  const inverseRate = rate && rate.rate !== 0 ? 1 / rate.rate : null

  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.pairLabel}>{pairId}</span>
        {rate?.date && <span className={styles.date}>{rate.date}</span>}
      </div>

      {loading && <div className={styles.rowLoading}>Loading…</div>}
      {!loading && error && <div className={styles.rowError}>{error}</div>}

      {!loading && !error && rate && (
        <div className={styles.rowBody}>
          <div className={styles.rowData}>
            <div className={styles.rate}>
              {formatRate(rate.rate)}
            </div>
            <div className={styles.rowMeta}>
              <span>1 {rate.base} = {formatRate(rate.rate)} {rate.target}</span>
              {inverseRate !== null && (
                <span>1 {rate.target} = {formatRate(inverseRate)} {rate.base}</span>
              )}
            </div>
          </div>

          {history.length >= 2 && (
            <div className={styles.chart}>
              <ResponsiveContainer width="100%" height={40}>
                <LineChart data={history} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="var(--color-accent, #4f46e5)"
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Tooltip
                    formatter={(v) => [formatRate(Number(v)), '']}
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

interface CurrencyWidgetProps {
  readonly isFullscreen?: boolean
}

export function CurrencyWidget({ isFullscreen = false }: CurrencyWidgetProps) {
  const { settings } = useSettings()
  const pairs = settings.currencyPairs
  const refreshMs = settings.financeRefreshMinutes * 60_000
  const widgetRootRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const [rows, setRows] = useState<Map<string, PairRowState>>(() =>
    new Map(pairs.map(([b, t]) => [pairKey(b, t), { rate: null, loading: true, error: null, history: [] }])),
  )

  const historyRef = useRef<Map<string, RatePoint[]>>(new Map())

  const loadPair = useCallback((base: string, target: string) => {
    const key = pairKey(base, target)

    setRows((prev) => {
      const next = new Map(prev)
      const existing = next.get(key) ?? { rate: null, loading: false, error: null, history: [] }
      next.set(key, { ...existing, loading: true, error: null })
      return next
    })

    fetchCurrencyRate(base, target)
      .then((rate) => {
        const point: RatePoint = { t: Date.now(), rate: rate.rate }
        const hist = historyRef.current.get(key) ?? []
        const updated = [...hist, point].slice(-30)
        historyRef.current.set(key, updated)

        setRows((prev) => {
          const next = new Map(prev)
          next.set(key, { rate, loading: false, error: null, history: updated })
          return next
        })
      })
      .catch((err: unknown) => {
        setRows((prev) => {
          const next = new Map(prev)
          const existing = next.get(key) ?? { rate: null, loading: false, error: null, history: [] }
          next.set(key, {
            ...existing,
            loading: false,
            error: err instanceof Error ? err.message : 'Could not load currency data.',
          })
          return next
        })
      })
  }, [])

  const loadAll = useCallback(() => {
    for (const [base, target] of pairs) {
      loadPair(base, target)
    }
  }, [pairs, loadPair])

  // Sync rows map when pairs change
  useEffect(() => {
    setRows((prev) => {
      const next = new Map<string, PairRowState>()
      for (const [b, t] of pairs) {
        const key = pairKey(b, t)
        next.set(key, prev.get(key) ?? { rate: null, loading: true, error: null, history: historyRef.current.get(key) ?? [] })
      }
      return next
    })
    loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs.map(([b, t]) => pairKey(b, t)).join(',')])

  // Auto-refresh
  useEffect(() => {
    if (refreshMs <= 0) return
    const id = setInterval(loadAll, refreshMs)
    return () => clearInterval(id)
  }, [loadAll, refreshMs])

  const anyLoading = [...rows.values()].some((r) => r.loading)
  const rowAnimationSignature = useMemo(
    () =>
      pairs
        .map(([base, target]) => {
          const key = pairKey(base, target)
          const row = rows.get(key)
          const rateValue = row?.rate?.rate ?? 0
          return `${key}:${row?.loading ? '1' : '0'}:${row?.error ? 'e' : 'ok'}:${rateValue.toFixed(6)}`
        })
        .join('|'),
    [pairs, rows],
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
        <span className={styles.title}>Currencies</span>
        {!anyLoading && (
          <button
            className={styles.refresh}
            onClick={loadAll}
            title="Refresh exchange rates"
            aria-label="Refresh exchange rates"
            type="button"
          >
            <RefreshCw size={14} />
          </button>
        )}
      </div>

      <div ref={listRef} className={styles.list}>
        {pairs.map(([base, target]) => {
          const key = pairKey(base, target)
          return (
            <PairRow
              key={key}
              pairId={key}
              state={rows.get(key) ?? { rate: null, loading: true, error: null, history: [] }}
            />
          )
        })}
      </div>
    </div>
  )
}
