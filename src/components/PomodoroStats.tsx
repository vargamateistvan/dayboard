import { usePomodoroStats } from '../lib/usePomodoroStats'
import { Calendar } from 'lucide-react'
import styles from './PomodoroStats.module.css'

export function PomodoroStats() {
  const { stats, getWeeklyStats } = usePomodoroStats()
  const weeklyStats = getWeeklyStats()
  const weeklyTotal = weeklyStats.reduce((sum, day) => sum + day.minutes, 0)
  const maxMinutesInWeek = Math.max(...weeklyStats.map(d => d.minutes), 1)

  return (
    <div className={styles.statsContainer}>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Today</div>
          <div className={styles.statValue}>{stats.totalMinutes}</div>
          <div className={styles.statUnit}>min</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>Sessions</div>
          <div className={styles.statValue}>{stats.sessionCount}</div>
          <div className={styles.statUnit}>today</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>This Week</div>
          <div className={styles.statValue}>{weeklyTotal}</div>
          <div className={styles.statUnit}>min</div>
        </div>
      </div>

      <div className={styles.weeklyChart}>
        <div className={styles.chartLabel}>
          <Calendar size={12} />
          Weekly Trend
        </div>
        <div className={styles.chartBars}>
          {weeklyStats.map((day, idx) => (
            <div key={idx} className={styles.barWrapper} title={`${day.date}: ${day.minutes}min`}>
              <div
                className={styles.bar}
                style={{ height: `${(day.minutes / maxMinutesInWeek) * 100 || 5}%` }}
              />
              <div className={styles.dayLabel}>{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
