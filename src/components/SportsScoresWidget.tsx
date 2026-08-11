import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useSettings } from '../lib/useSettings'
import { fetchLastGameForTeam, type SportsLastGame } from '../lib/sports'
import type { SportsFavoriteTeam } from '../lib/settings'
import styles from './SportsScoresWidget.module.css'

interface SportsScoresWidgetProps {
  readonly isFullscreen?: boolean
}

interface TeamRowState {
  game: SportsLastGame | null
  loading: boolean
  error: string | null
}

function favoriteKey(team: SportsFavoriteTeam): string {
  return `${team.leagueId}:${team.id}`
}

function formatResultLabel(result: SportsLastGame['result']): string {
  if (result === 'W') return 'Win'
  if (result === 'L') return 'Loss'
  return 'Draw'
}

function formatPlayedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatLastRefresh(lastRefreshedAt: number, now: number): string {
  const diffMs = Math.max(0, now - lastRefreshedAt)
  const diffMinutes = Math.floor(diffMs / 60_000)

  if (diffMinutes <= 0) return 'Updated just now'
  if (diffMinutes < 60) return `Updated ${diffMinutes} min ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `Updated ${diffHours} hr${diffHours === 1 ? '' : 's'} ago`
  const diffDays = Math.floor(diffHours / 24)
  return `Updated ${diffDays} day${diffDays === 1 ? '' : 's'} ago`
}

export function SportsScoresWidget({ isFullscreen = false }: SportsScoresWidgetProps) {
  const { settings } = useSettings()
  const favorites = settings.sportsFavoriteTeams
  const refreshMs = settings.sportsRefreshMinutes * 60_000
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [rows, setRows] = useState<Map<string, TeamRowState>>(() => {
    return new Map(
      favorites.map((team) => [favoriteKey(team), { game: null, loading: true, error: null }]),
    )
  })

  const loadTeam = useCallback((team: SportsFavoriteTeam) => {
    const key = favoriteKey(team)
    setRows((prev) => {
      const next = new Map(prev)
      const existing = next.get(key) ?? { game: null, loading: false, error: null }
      next.set(key, { ...existing, loading: true, error: null })
      return next
    })

    fetchLastGameForTeam(team)
      .then((game) => {
        setRows((prev) => {
          const next = new Map(prev)
          next.set(key, { game, loading: false, error: null })
          return next
        })
      })
      .catch((error: unknown) => {
        setRows((prev) => {
          const next = new Map(prev)
          const existing = next.get(key) ?? { game: null, loading: false, error: null }
          next.set(key, {
            ...existing,
            loading: false,
            error: error instanceof Error ? error.message : 'Could not load last game.',
          })
          return next
        })
      })
  }, [])

  const loadAll = useCallback(() => {
    const startedAt = Date.now()
    setNow(startedAt)
    favorites.forEach((team) => loadTeam(team))
    if (favorites.length > 0) {
      setLastRefreshedAt(startedAt)
    }
  }, [favorites, loadTeam])

  useEffect(() => {
    setRows((prev) => {
      const next = new Map<string, TeamRowState>()
      favorites.forEach((team) => {
        const key = favoriteKey(team)
        next.set(key, prev.get(key) ?? { game: null, loading: true, error: null })
      })
      return next
    })

    if (favorites.length > 0) {
      loadAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favorites.map((team) => favoriteKey(team)).join(',')])

  useEffect(() => {
    if (favorites.length === 0 || refreshMs <= 0) {
      return
    }

    const intervalId = window.setInterval(loadAll, refreshMs)
    return () => window.clearInterval(intervalId)
  }, [favorites.length, loadAll, refreshMs])

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(intervalId)
  }, [])

  const anyLoading = useMemo(
    () => [...rows.values()].some((state) => state.loading),
    [rows],
  )
  const lastRefreshLabel = useMemo(
    () => (lastRefreshedAt === null ? null : formatLastRefresh(lastRefreshedAt, now)),
    [lastRefreshedAt, now],
  )

  return (
    <div className={[styles.widget, isFullscreen ? styles.fullscreen : ''].join(' ')}>
      <div className={styles.header}>
        <span className={styles.title}>Sports Scores</span>
        {!anyLoading && favorites.length > 0 ? (
          <div className={styles.refreshGroup}>
            {lastRefreshLabel ? <span className={styles.refreshHint}>{lastRefreshLabel}</span> : null}
            <button
              className={styles.refresh}
              onClick={loadAll}
              title="Refresh sports scores"
              aria-label="Refresh sports scores"
              type="button"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        ) : null}
      </div>

      {favorites.length === 0 ? (
        <p className={styles.emptyState}>
          Pick favorite teams in Settings to see each team&apos;s latest final score.
        </p>
      ) : (
        <div className={styles.list}>
          {favorites.map((team) => {
            const key = favoriteKey(team)
            const row = rows.get(key) ?? { game: null, loading: true, error: null }

            return (
              <article key={key} className={styles.row}>
                <div className={styles.rowHeader}>
                  <span className={styles.leagueName}>{team.leagueName}</span>
                </div>

                {row.loading ? <div className={styles.rowLoading}>Loading…</div> : null}
                {!row.loading && row.error ? <div className={styles.rowError}>{row.error}</div> : null}

                {!row.loading && !row.error && row.game ? (
                  <div className={styles.rowBody}>
                    <div className={styles.matchupGrid}>
                      <div className={styles.teamBlock}>
                        {row.game.teamBadgeUrl ?? team.badgeUrl ? (
                          <img
                            src={row.game.teamBadgeUrl ?? team.badgeUrl}
                            alt={`${team.name} logo`}
                            className={styles.badge}
                            loading="lazy"
                          />
                        ) : null}
                        <span className={styles.teamName}>{team.name}</span>
                      </div>

                      <div className={styles.scoreBlock}>
                        <span className={styles.score}>
                          {row.game.teamScore} - {row.game.opponentScore}
                        </span>
                        <span className={styles.matchup}>Final</span>
                      </div>

                      <div className={[styles.teamBlock, styles.teamBlockRight].join(' ')}>
                        {row.game.opponentBadgeUrl ? (
                          <img
                            src={row.game.opponentBadgeUrl}
                            alt={`${row.game.opponentName} logo`}
                            className={styles.badge}
                            loading="lazy"
                          />
                        ) : null}
                        <span className={styles.teamName}>{row.game.opponentName}</span>
                      </div>
                    </div>

                    <div className={styles.metaRow}>
                      <div className={styles.gameMeta}>
                        <span>{formatPlayedAt(row.game.playedAt)}</span>
                        <span>{row.game.status}</span>
                      </div>
                      <span
                        className={[
                          styles.resultBadge,
                          row.game.result === 'W' ? styles.win : row.game.result === 'L' ? styles.loss : styles.draw,
                        ].join(' ')}
                      >
                        {formatResultLabel(row.game.result)}
                      </span>
                    </div>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
