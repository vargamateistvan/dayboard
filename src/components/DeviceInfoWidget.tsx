import { useEffect, useRef, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import styles from './DeviceInfoWidget.module.css'

interface DeviceInfoWidgetProps {
  readonly isFullscreen?: boolean
}

interface DeviceInfo {
  operatingSystem: string
  browser: string
  deviceType: string
  platform: string
  language: string
  timezone: string
  network: string
  battery: string
  cpu: string
  memory: string
  disk: string
  touchSupport: string
  viewport: string
  pixelRatio: string
}

interface TelemetryPoint {
  timestamp: number
  cpuPercent: number | null
  memoryPercent: number | null
  batteryPercent: number | null
  diskPercent: number | null
  networkRxKbps: number | null
  networkTxKbps: number | null
}

interface NetworkInformationLike extends EventTarget {
  effectiveType?: string
  downlink?: number
  rtt?: number
  saveData?: boolean
}

interface NavigatorWithTelemetry extends Navigator {
  readonly connection?: NetworkInformationLike
  readonly mozConnection?: NetworkInformationLike
  readonly webkitConnection?: NetworkInformationLike
  readonly deviceMemory?: number
  getBattery?: () => Promise<BatteryManagerLike>
}

interface BatteryManagerLike extends EventTarget {
  readonly level: number
  readonly charging: boolean
}

interface PerformanceMemoryLike {
  readonly usedJSHeapSize: number
  readonly jsHeapSizeLimit: number
}

interface PerformanceWithMemory extends Performance {
  readonly memory?: PerformanceMemoryLike
}

interface DiskSample {
  percent: number | null
  label: string
}

interface BatterySample {
  percent: number | null
  label: string
}

interface NetworkThroughputSample {
  rxKbps: number | null
  txKbps: number | null
}

function detectOperatingSystem(): string {
  const platformRaw = navigator.platform ?? ''
  const platform = platformRaw.toLowerCase()
  const userAgent = navigator.userAgent.toLowerCase()
  const uaDataPlatform = navigator.userAgentData?.platform?.toLowerCase() ?? ''
  const source = `${uaDataPlatform} ${platform} ${userAgent}`
  const isIpadLikeDevice = platformRaw === 'MacIntel' && navigator.maxTouchPoints > 1

  if (source.includes('android')) return 'Android'
  if (source.includes('iphone') || source.includes('ipod')) return 'iOS'
  if (source.includes('ipad') || isIpadLikeDevice) return 'iPadOS'
  if (source.includes('windows')) return 'Windows'
  if (source.includes('mac os x') || source.includes('macintosh') || source.includes('macintel')) return 'macOS'
  return 'Unknown'
}

function detectBrowser(): string {
  const userAgent = navigator.userAgent

  if (/Edg\//.test(userAgent)) return 'Microsoft Edge'
  if (/OPR\//.test(userAgent)) return 'Opera'
  if (/Firefox\//.test(userAgent)) return 'Firefox'
  if (/CriOS\//.test(userAgent)) return 'Chrome (iOS)'
  if (/Chrome\//.test(userAgent)) return 'Chrome'
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return 'Safari'

  return 'Unknown'
}

function detectDeviceType(): string {
  const userAgent = navigator.userAgent.toLowerCase()
  const width = window.innerWidth

  if (userAgent.includes('ipad') || detectOperatingSystem() === 'iPadOS') return 'Tablet'
  if (userAgent.includes('tablet')) return 'Tablet'
  if (userAgent.includes('mobile') || width < 768) return 'Phone'
  return 'Desktop/Laptop'
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return 'Unknown'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const unitIndex = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)))
  const normalizedValue = value / 1024 ** unitIndex

  return `${normalizedValue.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function formatKbps(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return 'No data'
  }

  return `${value.toFixed(1)} kbps`
}

function getConnectionInfo(): NetworkInformationLike | undefined {
  const navigatorWithTelemetry = navigator as NavigatorWithTelemetry
  return (
    navigatorWithTelemetry.connection
    ?? navigatorWithTelemetry.mozConnection
    ?? navigatorWithTelemetry.webkitConnection
  )
}

function readConnectionThroughputEstimate(): NetworkThroughputSample {
  const connection = getConnectionInfo()
  if (!connection || typeof connection.downlink !== 'number' || !Number.isFinite(connection.downlink)) {
    return { rxKbps: null, txKbps: null }
  }

  const rxKbps = Math.max(0, connection.downlink * 1000)
  // Browsers do not expose upstream throughput directly; keep a conservative estimate.
  const txKbps = rxKbps * 0.08
  return { rxKbps, txKbps }
}

function readNetwork(): string {
  const connection = getConnectionInfo()
  const status = navigator.onLine ? 'Online' : 'Offline'

  if (!connection) {
    return status
  }

  const segments = [status]
  if (connection.effectiveType) {
    segments.push(connection.effectiveType.toUpperCase())
  }
  if (typeof connection.downlink === 'number') {
    segments.push(`${connection.downlink.toFixed(1)} Mbps`)
  }
  if (typeof connection.rtt === 'number') {
    segments.push(`${Math.round(connection.rtt)} ms`)
  }
  if (connection.saveData) {
    segments.push('Data saver')
  }

  return segments.join(' · ')
}

function readCpuLabel(usagePercent: number | null): string {
  const cores =
    typeof navigator.hardwareConcurrency === 'number'
      ? ` · ${navigator.hardwareConcurrency} cores`
      : ''
  const safePercent = usagePercent === null ? 0 : usagePercent
  return `${safePercent}% (est.)${cores}`
}

function readMemorySample(): { percent: number | null; label: string } {
  const navigatorWithTelemetry = navigator as NavigatorWithTelemetry
  const performanceWithMemory = performance as PerformanceWithMemory
  const heap = performanceWithMemory.memory
  const deviceMemory = navigatorWithTelemetry.deviceMemory

  if (heap) {
    const used = heap.usedJSHeapSize
    const limit = heap.jsHeapSizeLimit
    const usedLabel = formatBytes(used)
    const limitLabel = formatBytes(limit)
    const percent = limit > 0 ? clampPercentage((used / limit) * 100) : null
    return {
      percent,
      label: percent === null ? `${usedLabel} / ${limitLabel}` : `${percent}% (${usedLabel} / ${limitLabel})`,
    }
  }

  if (typeof deviceMemory === 'number') {
    return { percent: null, label: `${deviceMemory} GB (device)` }
  }

  const transferredBytes = readTotalResourceBytes()
  if (transferredBytes !== null) {
    return { percent: null, label: `${formatBytes(transferredBytes)} transferred` }
  }

  return { percent: null, label: 'Not exposed by browser' }
}

function readTotalResourceBytes(): number | null {
  const entries = performance.getEntriesByType('resource')
  if (entries.length === 0) {
    return null
  }

  let total = 0
  for (const entry of entries) {
    const resourceEntry = entry as PerformanceResourceTiming
    total += typeof resourceEntry.transferSize === 'number' ? resourceEntry.transferSize : 0
  }

  return total
}

function readNetworkRates(
  previousBytes: number | null,
  previousTs: number | null,
): { rxKbps: number | null; txKbps: number | null; nextBytes: number | null; nextTs: number | null } {
  const currentBytes = readTotalResourceBytes()
  const now = performance.now()
  const fallback = readConnectionThroughputEstimate()

  if (currentBytes === null || previousBytes === null || previousTs === null) {
    return { rxKbps: fallback.rxKbps, txKbps: fallback.txKbps, nextBytes: currentBytes, nextTs: now }
  }

  const elapsedSec = (now - previousTs) / 1000
  if (elapsedSec <= 0) {
    return { rxKbps: fallback.rxKbps, txKbps: fallback.txKbps, nextBytes: currentBytes, nextTs: now }
  }

  const deltaBytes = Math.max(0, currentBytes - previousBytes)
  const rxKbps = (deltaBytes * 8) / elapsedSec / 1000
  const txKbps = fallback.txKbps

  return { rxKbps, txKbps, nextBytes: currentBytes, nextTs: now }
}

function estimateCpuUsage(previousTickTs: number | null): { usagePercent: number | null; nextTickTs: number } {
  const now = performance.now()
  if (previousTickTs === null) {
    return { usagePercent: 0, nextTickTs: now }
  }

  const elapsed = now - previousTickTs
  const expected = 1000
  const lag = Math.max(0, elapsed - expected)
  const usagePercent = clampPercentage((lag / expected) * 100)
  return { usagePercent, nextTickTs: now }
}

function readDeviceInfo(): DeviceInfo {
  const operatingSystem = detectOperatingSystem()
  const browser = detectBrowser()
  const deviceType = detectDeviceType()

  return {
    operatingSystem,
    browser,
    deviceType,
    platform: navigator.platform || 'Unknown',
    language: navigator.language || 'Unknown',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown',
    network: readNetwork(),
    battery: 'Loading…',
    cpu: readCpuLabel(null),
    memory: readMemorySample().label,
    disk: 'Loading…',
    touchSupport: navigator.maxTouchPoints > 0 ? 'Yes' : 'No',
    viewport: `${window.innerWidth} × ${window.innerHeight}`,
    pixelRatio: window.devicePixelRatio?.toFixed(2) ?? 'Unknown',
  }
}

async function readBattery(): Promise<BatterySample> {
  const navigatorWithTelemetry = navigator as NavigatorWithTelemetry

  if (!navigatorWithTelemetry.getBattery) {
    return { percent: null, label: 'Unavailable' }
  }

  try {
    const battery = await navigatorWithTelemetry.getBattery()
    const percent = Math.round(battery.level * 100)
    return {
      percent,
      label: `${percent}%${battery.charging ? ' (charging)' : ' (discharging)'}`,
    }
  } catch {
    return { percent: null, label: 'Unavailable' }
  }
}

async function readDisk(): Promise<DiskSample> {
  if (!navigator.storage?.estimate) {
    let usedChars = 0
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i) ?? ''
        const value = localStorage.getItem(key) ?? ''
        usedChars += key.length + value.length
      }
    } catch {
      return { percent: null, label: 'Not exposed by browser' }
    }

    const usedBytes = usedChars * 2
    const estimatedQuotaBytes = 10 * 1024 * 1024
    const percent = clampPercentage((usedBytes / estimatedQuotaBytes) * 100)
    return {
      percent,
      label: `${percent}% (${formatBytes(usedBytes)} / ~${formatBytes(estimatedQuotaBytes)})`,
    }
  }

  try {
    const { quota, usage } = await navigator.storage.estimate()
    if (typeof quota !== 'number' || typeof usage !== 'number') {
      return { percent: null, label: 'Unavailable' }
    }

    const used = formatBytes(usage)
    const total = formatBytes(quota)
    const percent = quota > 0 ? clampPercentage((usage / quota) * 100) : null
    return {
      percent,
      label: percent === null ? `${used} / ${total}` : `${percent}% (${used} / ${total})`,
    }
  } catch {
    return { percent: null, label: 'Unavailable' }
  }
}

export function DeviceInfoWidget({ isFullscreen = false }: DeviceInfoWidgetProps) {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => readDeviceInfo())
  const [history, setHistory] = useState<TelemetryPoint[]>([])
  const lastTickTsRef = useRef<number | null>(null)
  const lastResourceBytesRef = useRef<number | null>(null)
  const lastResourceSampleTsRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const refreshExtendedInfo = async () => {
      const { usagePercent: cpuPercent, nextTickTs } = estimateCpuUsage(lastTickTsRef.current)
      lastTickTsRef.current = nextTickTs
      const { rxKbps, txKbps, nextBytes, nextTs } = readNetworkRates(
        lastResourceBytesRef.current,
        lastResourceSampleTsRef.current,
      )
      lastResourceBytesRef.current = nextBytes
      lastResourceSampleTsRef.current = nextTs
      const memory = readMemorySample()
      const [battery, disk] = await Promise.all([readBattery(), readDisk()])

      if (cancelled) {
        return
      }

      setDeviceInfo((current) => ({
        ...current,
        network: readNetwork(),
        battery: battery.label,
        cpu: readCpuLabel(cpuPercent),
        memory: memory.label,
        disk: disk.label,
      }))

      setHistory((current) => {
        const nextPoint: TelemetryPoint = {
          timestamp: Date.now(),
          cpuPercent,
          memoryPercent: memory.percent,
          batteryPercent: battery.percent,
          diskPercent: disk.percent,
          networkRxKbps: rxKbps,
          networkTxKbps: txKbps,
        }

        return [...current, nextPoint].slice(-60)
      })
    }

    const refresh = () => {
      setDeviceInfo(readDeviceInfo())
      void refreshExtendedInfo()
    }

    window.addEventListener('resize', refresh)
    window.addEventListener('orientationchange', refresh)
    window.addEventListener('online', refresh)
    window.addEventListener('offline', refresh)
    refresh()
    const tickId = window.setInterval(() => {
      void refreshExtendedInfo()
    }, 1000)

    return () => {
      cancelled = true
      window.removeEventListener('resize', refresh)
      window.removeEventListener('orientationchange', refresh)
      window.removeEventListener('online', refresh)
      window.removeEventListener('offline', refresh)
      window.clearInterval(tickId)
    }
  }, [])

  const stats: Array<{ label: string; value: string }> = [
    { label: 'Network', value: deviceInfo.network },
    { label: 'Battery', value: deviceInfo.battery },
    { label: 'CPU usage', value: deviceInfo.cpu },
    { label: 'Memory', value: deviceInfo.memory },
    { label: 'Disk', value: deviceInfo.disk },
    {
      label: 'Net throughput',
      value:
        `RX ${formatKbps(history[history.length - 1]?.networkRxKbps ?? null)} · `
        + `TX ${formatKbps(history[history.length - 1]?.networkTxKbps ?? null)} (est.)`,
    },
  ]

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Operating system', value: deviceInfo.operatingSystem },
    { label: 'Device type', value: deviceInfo.deviceType },
    { label: 'Browser', value: deviceInfo.browser },
    { label: 'Platform', value: deviceInfo.platform },
    { label: 'Language', value: deviceInfo.language },
    { label: 'Timezone', value: deviceInfo.timezone },
    { label: 'Touch support', value: deviceInfo.touchSupport },
    { label: 'Viewport', value: deviceInfo.viewport },
    { label: 'Pixel ratio', value: deviceInfo.pixelRatio },
  ]
  const tooltipContentStyle = {
    fontSize: '0.68rem',
    padding: '3px 6px',
    borderRadius: '0.38rem',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
  }

  return (
    <section className={[styles.widget, isFullscreen ? styles.fullscreen : ''].join(' ')}>
      <header className={styles.header}>
        <h3 className={styles.title}>Device Info</h3>
        <span className={styles.liveBadge}>Live</span>
      </header>
      <div className={styles.statsGrid}>
        {stats.map((stat) => (
          <div key={stat.label} className={styles.statCard}>
            <span className={styles.statLabel}>{stat.label}</span>
            <span className={styles.statValue}>{stat.value}</span>
          </div>
        ))}
      </div>
      <div className={styles.charts}>
        <div className={styles.chartCard}>
          <span className={styles.chartTitle}>Load (%)</span>
          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={[styles.legendDot, styles.cpuDot].join(' ')} />
              CPU
            </span>
            <span className={styles.legendItem}>
              <span className={[styles.legendDot, styles.memoryDot].join(' ')} />
              Memory
            </span>
            <span className={styles.legendItem}>
              <span className={[styles.legendDot, styles.batteryDot].join(' ')} />
              Battery
            </span>
            <span className={styles.legendItem}>
              <span className={[styles.legendDot, styles.diskDot].join(' ')} />
              Disk
            </span>
          </div>
          <div className={styles.chartArea}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <YAxis domain={[0, 100]} hide />
                <Line type="monotone" dataKey="cpuPercent" stroke="#f59e0b" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="memoryPercent" stroke="#3b82f6" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="batteryPercent" stroke="#22c55e" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="diskPercent" stroke="#a855f7" dot={false} isAnimationActive={false} />
                <Tooltip
                  labelFormatter={() => ''}
                  formatter={(value: number | null, name: string) => {
                    if (value === null || Number.isNaN(Number(value))) {
                      return ['Unavailable', name]
                    }
                    return [`${Math.round(Number(value))}%`, name]
                  }}
                  contentStyle={tooltipContentStyle}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.chartCard}>
          <span className={styles.chartTitle}>Network (kbps)</span>
          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={[styles.legendDot, styles.rxDot].join(' ')} />
              RX
            </span>
            <span className={styles.legendItem}>
              <span className={[styles.legendDot, styles.txDot].join(' ')} />
              TX
            </span>
          </div>
          <div className={styles.chartArea}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <Line
                  type="monotone"
                  dataKey="networkRxKbps"
                  stroke="#06b6d4"
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="networkTxKbps"
                  stroke="#94a3b8"
                  strokeDasharray="4 3"
                  dot={false}
                  isAnimationActive={false}
                />
                <Tooltip
                  labelFormatter={() => ''}
                  formatter={(value: number | null, name: string) => {
                    if (value === null || Number.isNaN(Number(value))) {
                      return ['Unavailable', name]
                    }
                    return [`${Number(value).toFixed(1)} kbps`, name]
                  }}
                  contentStyle={tooltipContentStyle}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <dl className={styles.grid}>
        {rows.map((row) => (
          <div key={row.label} className={styles.item}>
            <dt className={styles.label}>{row.label}</dt>
            <dd className={styles.value}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
