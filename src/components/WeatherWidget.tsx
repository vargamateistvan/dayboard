import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sun,
  Cloud,
  CloudSun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  Wind,
  MapPin,
  RefreshCw,
  Thermometer,
  Droplets,
  Sunrise,
  Sunset,
} from "lucide-react";
import { useSettings } from "../lib/useSettings";
import styles from "./WeatherWidget.module.css";

interface WeatherData {
  temperature: number;
  apparentTemperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  timezone: string | null;
  utcOffsetSeconds: number | null;
  weatherCode: number;
  location: string;
  todayHigh: number | null;
  todayLow: number | null;
  todayRainChance: number | null;
  sunrise: string | null;
  sunset: string | null;
}

type WeatherIconName =
  | "Sun"
  | "CloudSun"
  | "Cloud"
  | "CloudDrizzle"
  | "CloudRain"
  | "CloudSnow"
  | "CloudLightning"
  | "Wind"
  | "Thermometer";

const WMO_CODES: Record<number, { label: string; icon: WeatherIconName }> = {
  0: { label: "Clear sky", icon: "Sun" },
  1: { label: "Mainly clear", icon: "CloudSun" },
  2: { label: "Partly cloudy", icon: "CloudSun" },
  3: { label: "Overcast", icon: "Cloud" },
  45: { label: "Fog", icon: "Wind" },
  48: { label: "Icy fog", icon: "Wind" },
  51: { label: "Light drizzle", icon: "CloudDrizzle" },
  53: { label: "Drizzle", icon: "CloudDrizzle" },
  55: { label: "Dense drizzle", icon: "CloudRain" },
  61: { label: "Slight rain", icon: "CloudRain" },
  63: { label: "Rain", icon: "CloudRain" },
  65: { label: "Heavy rain", icon: "CloudRain" },
  71: { label: "Slight snow", icon: "CloudSnow" },
  73: { label: "Snow", icon: "CloudSnow" },
  75: { label: "Heavy snow", icon: "CloudSnow" },
  80: { label: "Rain showers", icon: "CloudRain" },
  81: { label: "Rain showers", icon: "CloudRain" },
  82: { label: "Violent showers", icon: "CloudLightning" },
  95: { label: "Thunderstorm", icon: "CloudLightning" },
  99: { label: "Thunderstorm + hail", icon: "CloudLightning" },
};

const ICON_MAP = {
  Sun,
  CloudSun,
  Cloud,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Wind,
  Thermometer,
  Droplets,
  Sunrise,
  Sunset,
};

function WeatherIcon({ name, size }: { name: WeatherIconName; size: number }) {
  const Icon = ICON_MAP[name];
  return <Icon size={size} />;
}

function getWeatherInfo(code: number) {
  return (
    WMO_CODES[code] ?? {
      label: "Unknown",
      icon: "Thermometer" as WeatherIconName,
    }
  );
}

function formatWindDirection(degrees: number | null) {
  if (degrees === null) {
    return null;
  }

  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(degrees / 45) % directions.length;
  return `${directions[index]} (${Math.round(degrees)}°)`;
}

function parseOpenMeteoTime(value: string, utcOffsetSeconds: number | null) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second = "0"] = match;
  const offsetMs = (utcOffsetSeconds ?? 0) * 1000;
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ) - offsetMs,
  );
}

function formatTime(
  value: string | null,
  timeZone: string | null,
  utcOffsetSeconds: number | null,
) {
  if (!value || !timeZone || utcOffsetSeconds === null) {
    return null;
  }

  const instant = parseOpenMeteoTime(value, utcOffsetSeconds);
  if (!instant) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(instant);
}

function formatLastRefresh(lastRefreshedAt: number, now: number): string {
  const diffMs = Math.max(0, now - lastRefreshedAt);
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes <= 0) {
    return "Updated just now";
  }

  if (diffMinutes < 60) {
    return `Updated ${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `Updated ${diffHours} hr${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `Updated ${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&timezone=auto&temperature_unit=celsius&wind_speed_unit=kmh&forecast_days=1`;
  const geoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;

  const [weatherRes, geoRes] = await Promise.all([
    fetch(weatherUrl),
    fetch(geoUrl),
  ]);
  const weather = await weatherRes.json();
  const geo = await geoRes.json();

  const city =
    geo.address?.city ??
    geo.address?.town ??
    geo.address?.village ??
    geo.address?.county ??
    "Unknown location";

  return {
    temperature: Math.round(weather.current.temperature_2m),
    apparentTemperature:
      typeof weather.current?.apparent_temperature === "number"
        ? Math.round(weather.current.apparent_temperature)
        : null,
    humidity:
      typeof weather.current?.relative_humidity_2m === "number"
        ? Math.round(weather.current.relative_humidity_2m)
        : null,
    windSpeed:
      typeof weather.current?.wind_speed_10m === "number"
        ? Math.round(weather.current.wind_speed_10m)
        : null,
    windDirection:
      typeof weather.current?.wind_direction_10m === "number"
        ? Math.round(weather.current.wind_direction_10m)
        : null,
    timezone: typeof weather.timezone === "string" ? weather.timezone : null,
    utcOffsetSeconds:
      typeof weather.utc_offset_seconds === "number"
        ? weather.utc_offset_seconds
        : null,
    weatherCode: weather.current.weather_code,
    location: city,
    todayHigh:
      typeof weather.daily?.temperature_2m_max?.[0] === "number"
        ? Math.round(weather.daily.temperature_2m_max[0])
        : null,
    todayLow:
      typeof weather.daily?.temperature_2m_min?.[0] === "number"
        ? Math.round(weather.daily.temperature_2m_min[0])
        : null,
    todayRainChance:
      typeof weather.daily?.precipitation_probability_max?.[0] === "number"
        ? Math.round(weather.daily.precipitation_probability_max[0])
        : null,
    sunrise:
      typeof weather.daily?.sunrise?.[0] === "string"
        ? weather.daily.sunrise[0]
        : null,
    sunset:
      typeof weather.daily?.sunset?.[0] === "string"
        ? weather.daily.sunset[0]
        : null,
  };
}

export function WeatherWidget() {
  const { settings } = useSettings();
  const [data, setData] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const result = await fetchWeather(coords.latitude, coords.longitude);
          setData(result);
          setLastRefreshedAt(Date.now());
          setNow(Date.now());
        } catch {
          setError("Could not load weather data.");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError("Location access denied. Enable location to see weather.");
        setLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, settings.weatherRefreshMinutes * 60 * 1000);
    return () => clearInterval(id);
  }, [load, settings.weatherRefreshMinutes]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const info = data ? getWeatherInfo(data.weatherCode) : null;
  const lastRefreshLabel = useMemo(
    () =>
      lastRefreshedAt === null ? null : formatLastRefresh(lastRefreshedAt, now),
    [lastRefreshedAt, now],
  );
  const windDirection = data ? formatWindDirection(data.windDirection) : null;
  const sunrise = data
    ? formatTime(data.sunrise, data.timezone, data.utcOffsetSeconds)
    : null;
  const sunset = data
    ? formatTime(data.sunset, data.timezone, data.utcOffsetSeconds)
    : null;

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <span className={styles.title}>Weather</span>
        {!loading && (
          <div className={styles.refreshGroup}>
            <button
              className={styles.refresh}
              onClick={load}
              title="Refresh weather"
              aria-label="Refresh weather"
            >
              <RefreshCw size={14} />
            </button>
            {lastRefreshLabel && (
              <span className={styles.refreshHint}>{lastRefreshLabel}</span>
            )}
          </div>
        )}
      </div>
      {loading && (
        <div className={styles.loading} aria-label="Loading weather">
          Loading…
        </div>
      )}
      {!loading && error && <div className={styles.error}>{error}</div>}
      {!loading && !error && data && info && (
        <div className={styles.content}>
          <div className={styles.summary}>
            <div className={styles.temp}>
              <span className={styles.weatherIcon}>
                <WeatherIcon name={info.icon} size={48} />
              </span>
              <span className={styles.degrees}>{data.temperature}°C</span>
            </div>
            <div className={styles.condition}>{info.label}</div>
            <div className={styles.location}>
              <MapPin size={12} />
              {data.location}
            </div>
            <div className={styles.todayForecast}>
              <span className={styles.forecastLabel}>Today forecast:</span>
              <span>
                H {data.todayHigh ?? "—"}°C · L {data.todayLow ?? "—"}°C · Rain{" "}
                {data.todayRainChance ?? "—"}%
              </span>
            </div>
          </div>
          <div className={styles.detailsGrid}>
            <div className={styles.detail}>
              <span className={styles.detailLabel}>Feels like</span>
              <span className={styles.detailValue}>
                {data.apparentTemperature ?? "—"}°C
              </span>
            </div>
            <div className={styles.detail}>
              <span className={styles.detailLabel}>
                <Droplets size={12} />
                Humidity
              </span>
              <span className={styles.detailValue}>
                {data.humidity ?? "—"}%
              </span>
            </div>
            <div className={styles.detail}>
              <span className={styles.detailLabel}>
                <Wind size={12} />
                Wind
              </span>
              <span className={styles.detailValue}>
                {data.windSpeed ?? "—"} km/h
                {windDirection ? ` · ${windDirection}` : ""}
              </span>
            </div>
            <div className={styles.detail}>
              <span className={styles.detailLabel}>
                <Sunrise size={12} />
                Sunrise
              </span>
              <span className={styles.detailValue}>{sunrise ?? "—"}</span>
            </div>
            <div className={styles.detail}>
              <span className={styles.detailLabel}>
                <Sunset size={12} />
                Sunset
              </span>
              <span className={styles.detailValue}>{sunset ?? "—"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
