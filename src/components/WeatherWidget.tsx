import { useEffect, useState } from 'react'
import {
  Sun, Cloud, CloudSun, CloudRain, CloudSnow, CloudLightning,
  CloudDrizzle, Wind, MapPin, RefreshCw, Thermometer,
} from 'lucide-react'
import styles from './WeatherWidget.module.css'

interface WeatherData {
  temperature: number
  weatherCode: number
  location: string
}

type WeatherIconName = 'Sun' | 'CloudSun' | 'Cloud' | 'CloudDrizzle' | 'CloudRain' | 'CloudSnow' | 'CloudLightning' | 'Wind' | 'Thermometer'

const WMO_CODES: Record<number, { label: string; icon: WeatherIconName }> = {
  0:  { label: 'Clear sky',          icon: 'Sun' },
  1:  { label: 'Mainly clear',       icon: 'CloudSun' },
  2:  { label: 'Partly cloudy',      icon: 'CloudSun' },
  3:  { label: 'Overcast',           icon: 'Cloud' },
  45: { label: 'Fog',                icon: 'Wind' },
  48: { label: 'Icy fog',            icon: 'Wind' },
  51: { label: 'Light drizzle',      icon: 'CloudDrizzle' },
  53: { label: 'Drizzle',            icon: 'CloudDrizzle' },
  55: { label: 'Dense drizzle',      icon: 'CloudRain' },
  61: { label: 'Slight rain',        icon: 'CloudRain' },
  63: { label: 'Rain',               icon: 'CloudRain' },
  65: { label: 'Heavy rain',         icon: 'CloudRain' },
  71: { label: 'Slight snow',        icon: 'CloudSnow' },
  73: { label: 'Snow',               icon: 'CloudSnow' },
  75: { label: 'Heavy snow',         icon: 'CloudSnow' },
  80: { label: 'Rain showers',       icon: 'CloudRain' },
  81: { label: 'Rain showers',       icon: 'CloudRain' },
  82: { label: 'Violent showers',    icon: 'CloudLightning' },
  95: { label: 'Thunderstorm',       icon: 'CloudLightning' },
  99: { label: 'Thunderstorm + hail',icon: 'CloudLightning' },
}

const ICON_MAP = { Sun, CloudSun, Cloud, CloudDrizzle, CloudRain, CloudSnow, CloudLightning, Wind, Thermometer }

function WeatherIcon({ name, size }: { name: WeatherIconName; size: number }) {
  const Icon = ICON_MAP[name]
  return <Icon size={size} />
}

function getWeatherInfo(code: number) {
  return WMO_CODES[code] ?? { label: 'Unknown', icon: 'Thermometer' as WeatherIconName }
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=celsius`
  const geoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`

  const [weatherRes, geoRes] = await Promise.all([fetch(weatherUrl), fetch(geoUrl)])
  const weather = await weatherRes.json()
  const geo = await geoRes.json()

  const city =
    geo.address?.city ?? geo.address?.town ?? geo.address?.village ?? geo.address?.county ?? 'Unknown location'

  return {
    temperature: Math.round(weather.current.temperature_2m),
    weatherCode: weather.current.weather_code,
    location: city,
  }
}

export function WeatherWidget() {
  const [data, setData] = useState<WeatherData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const result = await fetchWeather(coords.latitude, coords.longitude)
          setData(result)
        } catch {
          setError('Could not load weather data.')
        } finally {
          setLoading(false)
        }
      },
      () => {
        setError('Location access denied. Enable location to see weather.')
        setLoading(false)
      },
    )
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 60 * 60 * 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const info = data ? getWeatherInfo(data.weatherCode) : null

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <span className={styles.title}>Weather</span>
        {!loading && (
          <button className={styles.refresh} onClick={load} title="Refresh weather" aria-label="Refresh weather">
            <RefreshCw size={14} />
          </button>
        )}
      </div>
      {loading && <div className={styles.loading} aria-label="Loading weather">Loading…</div>}
      {!loading && error && <div className={styles.error}>{error}</div>}
      {!loading && !error && data && info && (
        <div className={styles.content}>
          <div className={styles.temp}>
            <span className={styles.weatherIcon}><WeatherIcon name={info.icon} size={48} /></span>
            <span className={styles.degrees}>{data.temperature}°C</span>
          </div>
          <div className={styles.condition}>{info.label}</div>
          <div className={styles.location}><MapPin size={12} />{data.location}</div>
        </div>
      )}
    </div>
  )
}
