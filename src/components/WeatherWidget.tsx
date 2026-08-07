import { useEffect, useState } from 'react'
import styles from './WeatherWidget.module.css'

interface WeatherData {
  temperature: number
  weatherCode: number
  location: string
}

const WMO_CODES: Record<number, { label: string; emoji: string }> = {
  0: { label: 'Clear sky', emoji: '☀️' },
  1: { label: 'Mainly clear', emoji: '🌤️' },
  2: { label: 'Partly cloudy', emoji: '⛅' },
  3: { label: 'Overcast', emoji: '☁️' },
  45: { label: 'Fog', emoji: '🌫️' },
  48: { label: 'Icy fog', emoji: '🌫️' },
  51: { label: 'Light drizzle', emoji: '🌦️' },
  53: { label: 'Drizzle', emoji: '🌦️' },
  55: { label: 'Dense drizzle', emoji: '🌧️' },
  61: { label: 'Slight rain', emoji: '🌧️' },
  63: { label: 'Rain', emoji: '🌧️' },
  65: { label: 'Heavy rain', emoji: '🌧️' },
  71: { label: 'Slight snow', emoji: '🌨️' },
  73: { label: 'Snow', emoji: '❄️' },
  75: { label: 'Heavy snow', emoji: '❄️' },
  80: { label: 'Rain showers', emoji: '🌦️' },
  81: { label: 'Rain showers', emoji: '🌦️' },
  82: { label: 'Violent showers', emoji: '⛈️' },
  95: { label: 'Thunderstorm', emoji: '⛈️' },
  99: { label: 'Thunderstorm + hail', emoji: '⛈️' },
}

function getWeatherInfo(code: number) {
  return WMO_CODES[code] ?? { label: 'Unknown', emoji: '🌡️' }
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherData & { location: string }> {
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

  const { label, emoji } = data ? getWeatherInfo(data.weatherCode) : { label: '', emoji: '' }

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <span className={styles.title}>Weather</span>
        {!loading && (
          <button className={styles.refresh} onClick={load} title="Refresh weather" aria-label="Refresh weather">
            ↻
          </button>
        )}
      </div>
      {loading && <div className={styles.loading} aria-label="Loading weather">Loading…</div>}
      {!loading && error && <div className={styles.error}>{error}</div>}
      {!loading && !error && data && (
        <div className={styles.content}>
          <div className={styles.temp}>
            <span className={styles.emoji}>{emoji}</span>
            <span className={styles.degrees}>{data.temperature}°C</span>
          </div>
          <div className={styles.condition}>{label}</div>
          <div className={styles.location}>📍 {data.location}</div>
        </div>
      )}
    </div>
  )
}
