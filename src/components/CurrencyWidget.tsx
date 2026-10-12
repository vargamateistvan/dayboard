import { useCallback, useEffect, useMemo, useRef } from 'react'
import { RefreshCw } from 'lucide-react'
import { useSettings } from '../lib/useSettings'
import { isMotionEnabled, loadAnimeJs, MOTION_DURATIONS, MOTION_STAGGERS } from '../lib/anime'
import { usePolledResource } from '../lib/usePolledResource'
import { fetchPairRates, type CurrencyRate } from '../lib/currency'
import styles from './CurrencyWidget.module.css'

function formatRate(value: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 6,
  }).format(value)
}

interface PairRowState {
  /** Last good rate; kept when a refresh of this pair fails. */
  rate: CurrencyRate | null
  loading: boolean
  error: string | null
}

function pairKey(base: string, target: string): string {
  return `${base}/${target}`
}

interface PairRowProps {
  pairId: string
  state: PairRowState
}

function PairRow({ pairId, state }: PairRowProps) {
  const { rate, loading, error } = state
  const inverseRate = rate && rate.rate !== 0 ? 1 / rate.rate : null

  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.pairLabel}>{pairId}</span>
        {rate?.date && <span className={styles.date}>{rate.date}</span>}
      </div>

      {loading && !rate && <div className={styles.rowLoading}>Loading…</div>}
      {!loading && error && !rate && <div className={styles.rowError}>{error}</div>}

      {rate && (
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
              {error && <span role="status">Couldn&apos;t refresh</span>}
            </div>
          </div>

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

  const pairsKey = pairs.map(([b, t]) => pairKey(b, t)).join(',')
  const lastRatesRef = useRef(new Map<string, CurrencyRate>())

  const fetcher = useCallback(async () => {
    const requested = pairsKey ? pairsKey.split(',').map((key) => key.split('/') as [string, string]) : []
    const results = await fetchPairRates(requested)

    const nextRows = new Map<string, PairRowState>()
    results.forEach((result, index) => {
      const key = pairKey(...requested[index])
      if (result.status === 'fulfilled') {
        lastRatesRef.current.set(key, result.value)
        nextRows.set(key, { rate: result.value, loading: false, error: null })
      } else {
        nextRows.set(key, {
          rate: lastRatesRef.current.get(key) ?? null,
          loading: false,
          error: result.reason instanceof Error ? result.reason.message : 'Could not load currency data.',
        })
      }
    })
    return nextRows
  }, [pairsKey])
  const { data: rows, refreshing, refresh: loadAll } = usePolledResource(fetcher, {
    intervalMs: refreshMs,
    key: pairsKey,
  })

  const rowStateFor = (key: string): PairRowState =>
    rows?.get(key) ?? { rate: lastRatesRef.current.get(key) ?? null, loading: true, error: null }

  const anyLoading = refreshing && !rows
  const rowAnimationSignature = useMemo(
    () =>
      pairs
        .map(([base, target]) => {
          const key = pairKey(base, target)
          const row = rowStateFor(key)
          const rateValue = row?.rate?.rate ?? 0
          return `${key}:${row?.loading ? '1' : '0'}:${row?.error ? 'e' : 'ok'}:${rateValue.toFixed(6)}`
        })
        .join('|'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pairsKey, rows],
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
              state={rowStateFor(key)}
            />
          )
        })}
      </div>
    </div>
  )
}
