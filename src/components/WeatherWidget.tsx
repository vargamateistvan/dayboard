import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { usePolledResource } from "../lib/usePolledResource";
import { getCurrentLocation, reverseGeocode, type Coordinates } from "../lib/location";
import { isMotionEnabled, loadAnimeJs, MOTION_DURATIONS, MOTION_STAGGERS } from "../lib/anime";
import styles from "./WeatherWidget.module.css";
import type { WeatherUnitSystem } from "../lib/settings";

// Missing values are null so they render as "—" rather than a real-looking 0.
interface ForecastDay {
  date: string;
  high: number | null;
  low: number | null;
  rainChance: number | null;
  rainAmount: number | null;
  windSpeed: number | null;
  weatherCode: number | null;
}

interface WeatherData {
  temperature: number;
  apparentTemperature: number | null;
  humidity: number | null;
  cloudCover: number | null;
  uvIndex: number | null;
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
  forecast: ForecastDay[];
  /** Units the numbers were fetched in, so labels always match the data. */
  unitSystem: WeatherUnitSystem;
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
  56: { label: "Freezing drizzle", icon: "CloudDrizzle" },
  57: { label: "Freezing drizzle", icon: "CloudDrizzle" },
  61: { label: "Slight rain", icon: "CloudRain" },
  63: { label: "Rain", icon: "CloudRain" },
  65: { label: "Heavy rain", icon: "CloudRain" },
  66: { label: "Freezing rain", icon: "CloudRain" },
  67: { label: "Freezing rain", icon: "CloudRain" },
  71: { label: "Slight snow", icon: "CloudSnow" },
  73: { label: "Snow", icon: "CloudSnow" },
  75: { label: "Heavy snow", icon: "CloudSnow" },
  77: { label: "Snow grains", icon: "CloudSnow" },
  80: { label: "Rain showers", icon: "CloudRain" },
  81: { label: "Rain showers", icon: "CloudRain" },
  82: { label: "Violent showers", icon: "CloudLightning" },
  85: { label: "Snow showers", icon: "CloudSnow" },
  86: { label: "Snow showers", icon: "CloudSnow" },
  95: { label: "Thunderstorm", icon: "CloudLightning" },
  96: { label: "Thunderstorm + hail", icon: "CloudLightning" },
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

function getWeatherInfo(code: number | null) {
  if (code === null) {
    return { label: "Unknown", icon: "Thermometer" as WeatherIconName };
  }
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

function getTemperatureUnit(unitSystem: WeatherUnitSystem) {
  return unitSystem === "imperial" ? "°F" : "°C";
}

function getWindUnit(unitSystem: WeatherUnitSystem) {
  return unitSystem === "imperial" ? "mph" : "km/h";
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

function formatForecastDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function numberAt(values: unknown, index: number, round: (value: number) => number = Math.round): number | null {
  const value = Array.isArray(values) ? values[index] : undefined;
  return typeof value === "number" && Number.isFinite(value) ? round(value) : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

// In polar day or night Open-Meteo reports midnight for both sunrise and sunset.
function isPolarDay(sunrise: unknown, sunset: unknown): boolean {
  return typeof sunrise === "string" && typeof sunset === "string" && sunrise.endsWith("T00:00") && sunset.endsWith("T00:00");
}

async function fetchWeather(
  { latitude, longitude }: Coordinates,
  unitSystem: WeatherUnitSystem,
  signal: AbortSignal,
): Promise<WeatherData> {
  const isImperial = unitSystem === "imperial";
  // Today plus the next seven days for the 7-day forecast.
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,cloud_cover,uv_index,wind_speed_10m,wind_direction_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,sunrise,sunset,weather_code&timezone=auto&temperature_unit=${isImperial ? "fahrenheit" : "celsius"}&wind_speed_unit=${isImperial ? "mph" : "kmh"}&precipitation_unit=mm&forecast_days=8`;

  const [weather, city] = await Promise.all([
    fetch(weatherUrl, { signal }).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }),
    // The place name is optional: a failed lookup must not hide the weather.
    reverseGeocode({ latitude, longitude }),
  ]);

  const daily = weather.daily ?? {};
  const forecast: ForecastDay[] = (Array.isArray(daily.time) ? daily.time : []).slice(1, 8).map((date: string, offset: number) => {
    const index = offset + 1;
    return {
      date,
      high: numberAt(daily.temperature_2m_max, index),
      low: numberAt(daily.temperature_2m_min, index),
      rainChance: numberAt(daily.precipitation_probability_max, index),
      rainAmount: numberAt(daily.precipitation_sum, index, (value) => Math.round(value * 10) / 10),
      windSpeed: numberAt(daily.wind_speed_10m_max, index),
      weatherCode: numberAt(daily.weather_code, index, (value) => value),
    };
  });

  const polar = isPolarDay(daily.sunrise?.[0], daily.sunset?.[0]);

  return {
    temperature: Math.round(weather.current.temperature_2m),
    apparentTemperature: numberOrNull(weather.current?.apparent_temperature),
    humidity: numberOrNull(weather.current?.relative_humidity_2m),
    cloudCover: numberOrNull(weather.current?.cloud_cover),
    uvIndex: numberOrNull(weather.current?.uv_index),
    windSpeed: numberOrNull(weather.current?.wind_speed_10m),
    windDirection: numberOrNull(weather.current?.wind_direction_10m),
    timezone: typeof weather.timezone === "string" ? weather.timezone : null,
    utcOffsetSeconds: typeof weather.utc_offset_seconds === "number" ? weather.utc_offset_seconds : null,
    weatherCode: typeof weather.current?.weather_code === "number" ? weather.current.weather_code : -1,
    location: city ?? "Unknown location",
    todayHigh: numberAt(daily.temperature_2m_max, 0),
    todayLow: numberAt(daily.temperature_2m_min, 0),
    todayRainChance: numberAt(daily.precipitation_probability_max, 0),
    sunrise: !polar && typeof daily.sunrise?.[0] === "string" ? daily.sunrise[0] : null,
    sunset: !polar && typeof daily.sunset?.[0] === "string" ? daily.sunset[0] : null,
    forecast,
    unitSystem,
  };
}

interface WeatherWidgetProps {
  readonly isFullscreen?: boolean
}

export function WeatherWidget({ isFullscreen = false }: WeatherWidgetProps) {
  const { settings } = useSettings();
  const widgetRootRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const unitSystem = settings.weatherUnitSystem;

  const fetcher = useCallback(
    async (signal: AbortSignal) => {
      // Location errors already carry a user-facing message.
      const coordinates = await getCurrentLocation("weather");
      try {
        return await fetchWeather(coordinates, unitSystem, signal);
      } catch (fetchError) {
        if (signal.aborted) throw fetchError;
        throw new Error("Could not load weather data.", { cause: fetchError });
      }
    },
    [unitSystem],
  );
  const {
    data,
    error,
    loading,
    lastUpdatedAt: lastRefreshedAt,
    refresh: load,
  } = usePolledResource(fetcher, {
    intervalMs: settings.weatherRefreshMinutes * 60 * 1000,
    key: unitSystem,
  });

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
  const temperatureUnit = getTemperatureUnit(data?.unitSystem ?? unitSystem);
  const windUnit = getWindUnit(data?.unitSystem ?? unitSystem);
  const sunrise = data
    ? formatTime(data.sunrise, data.timezone, data.utcOffsetSeconds)
    : null;
  const sunset = data
    ? formatTime(data.sunset, data.timezone, data.utcOffsetSeconds)
    : null;
  const weatherAnimationSignature = useMemo(
    () =>
      data
        ? [
            data.location,
            data.temperature,
            data.weatherCode,
            data.forecast.map((day) => `${day.date}-${day.high}-${day.low}-${day.weatherCode}`).join("|"),
            settings.weatherShowExtraDetails ? "details-on" : "details-off",
            isFullscreen ? "fullscreen" : "normal",
          ].join(":")
        : "empty",
    [data, isFullscreen, settings.weatherShowExtraDetails],
  );

  useEffect(() => {
    if (!isMotionEnabled()) {
      return;
    }

    const rootNode = widgetRootRef.current;
    if (!rootNode) {
      return;
    }

    let cancelled = false;

    const animateRefresh = (
      button: HTMLButtonElement,
      options: { scale: number; translateY: number; duration: number },
    ) => {
      void loadAnimeJs().then((anime) => {
        if (cancelled || !anime?.animate) {
          return;
        }
        anime.animate(button, options);
      });
    };

    const resolveRefreshButton = (target: EventTarget | null) => {
      if (!(target instanceof Element)) {
        return null;
      }
      const button = target.closest("button");
      if (!(button instanceof HTMLButtonElement) || !button.classList.contains(styles.refresh)) {
        return null;
      }
      return button;
    };

    const handlePointerEnter = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        return;
      }
      const button = resolveRefreshButton(event.target);
      if (!button || button.disabled) {
        return;
      }
      animateRefresh(button, { scale: 1.06, translateY: -1, duration: MOTION_DURATIONS.quick });
    };

    const handlePointerLeave = (event: PointerEvent) => {
      const button = resolveRefreshButton(event.target);
      if (!button) {
        return;
      }
      animateRefresh(button, { scale: 1, translateY: 0, duration: MOTION_DURATIONS.quick });
    };

    const handlePointerDown = (event: PointerEvent) => {
      const button = resolveRefreshButton(event.target);
      if (!button || button.disabled) {
        return;
      }
      animateRefresh(button, { scale: 0.95, translateY: 0, duration: Math.max(80, MOTION_DURATIONS.quick - 50) });
    };

    const handlePointerUp = (event: PointerEvent) => {
      const button = resolveRefreshButton(event.target);
      if (!button || button.disabled) {
        return;
      }
      animateRefresh(button, {
        scale: button.matches(":hover") ? 1.06 : 1,
        translateY: button.matches(":hover") ? -1 : 0,
        duration: MOTION_DURATIONS.quick,
      });
    };

    rootNode.addEventListener("pointerenter", handlePointerEnter, true);
    rootNode.addEventListener("pointerleave", handlePointerLeave, true);
    rootNode.addEventListener("pointerdown", handlePointerDown, true);
    rootNode.addEventListener("pointerup", handlePointerUp, true);
    rootNode.addEventListener("pointercancel", handlePointerUp, true);

    return () => {
      cancelled = true;
      rootNode.removeEventListener("pointerenter", handlePointerEnter, true);
      rootNode.removeEventListener("pointerleave", handlePointerLeave, true);
      rootNode.removeEventListener("pointerdown", handlePointerDown, true);
      rootNode.removeEventListener("pointerup", handlePointerUp, true);
      rootNode.removeEventListener("pointercancel", handlePointerUp, true);
    };
  }, []);

  useEffect(() => {
    if (!isMotionEnabled() || loading || error || !data) {
      return;
    }

    const contentNode = contentRef.current;
    if (!contentNode) {
      return;
    }

    const summaryNode = contentNode.querySelector(`.${styles.summary}`);
    const detailNodes = Array.from(contentNode.querySelectorAll<HTMLElement>(`.${styles.detail}`));
    const forecastNodes = Array.from(contentNode.querySelectorAll<HTMLElement>(`.${styles.forecastDay}`));
    const targets = [
      ...(summaryNode instanceof HTMLElement ? [summaryNode] : []),
      ...detailNodes,
      ...forecastNodes,
    ];

    if (!targets.length) {
      return;
    }

    let cancelled = false;
    let activeAnimations: Array<{ cancel?: () => void }> = [];

    void loadAnimeJs().then((anime) => {
      if (cancelled || !anime?.animate) {
        return;
      }

      if (anime.stagger) {
        activeAnimations = [
          anime.animate(targets, {
            opacity: [0, 1],
            translateY: [8, 0],
            duration: MOTION_DURATIONS.medium,
            delay: anime.stagger(MOTION_STAGGERS.tight),
          }),
        ];
        return;
      }

      activeAnimations = targets.map((target, index) =>
        anime.animate(target, {
          opacity: [0, 1],
          translateY: [8, 0],
          duration: MOTION_DURATIONS.medium,
          delay: index * MOTION_STAGGERS.tight,
        }),
      );
    });

    return () => {
      cancelled = true;
      activeAnimations.forEach((animation) => animation.cancel?.());
    };
  }, [weatherAnimationSignature, loading, error, data]);

  return (
    <div ref={widgetRootRef} className={[styles.widget, isFullscreen ? styles.fullscreen : ''].join(' ')}>
      <div className={styles.header}>
        <span className={styles.title}>Weather</span>
        {!loading && (
          <div className={styles.refreshGroup}>
            {error && data ? (
              <span className={styles.refreshHint} role="status">Couldn&apos;t refresh</span>
            ) : (
              lastRefreshLabel && <span className={styles.refreshHint}>{lastRefreshLabel}</span>
            )}
            <button
              className={styles.refresh}
              onClick={load}
              title="Refresh weather"
              aria-label="Refresh weather"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        )}
      </div>
      {loading && (
        <div className={styles.loading} aria-label="Loading weather">
          Loading…
        </div>
      )}
      {!loading && error && !data && <div className={styles.error}>{error}</div>}
      {data && info && (
        <div
          ref={contentRef}
          className={`${styles.content} ${
            settings.weatherShowExtraDetails ? "" : styles.contentFull
          }`}
        >
          <div className={styles.summary}>
            <div className={styles.temp}>
              <span className={styles.weatherIcon}>
                <WeatherIcon name={info.icon} size={isFullscreen ? 88 : 40} />
              </span>
              <span className={styles.degrees}>{data.temperature}{temperatureUnit}</span>
            </div>
            <div className={styles.condition}>{info.label}</div>
            <div className={styles.location}>
              <MapPin size={isFullscreen ? 18 : 12} />
              {data.location}
            </div>
            <div className={styles.todayForecast}>
              <span className={styles.forecastLabel}>Today forecast:</span>
              <span>
              H {data.todayHigh ?? "—"}{temperatureUnit} · L {data.todayLow ?? "—"}{temperatureUnit} · Rain{" "}
                {data.todayRainChance ?? "—"}%
              </span>
            </div>
          </div>
          {settings.weatherShowExtraDetails && (
            <div className={styles.detailsGrid}>
            <div className={styles.detail}>
              <span className={styles.detailLabel}>Feels like</span>
              <span className={styles.detailValue}>
              {data.apparentTemperature ?? "—"}{temperatureUnit}
              </span>
            </div>
            <div className={styles.detail}>
              <span className={styles.detailLabel}>
                <Droplets size={isFullscreen ? 18 : 12} />
                Humidity
              </span>
              <span className={styles.detailValue}>
                {data.humidity ?? "—"}%
              </span>
            </div>
            <div className={styles.detail}>
              <span className={styles.detailLabel}>
                <Wind size={isFullscreen ? 18 : 12} />
                Wind
              </span>
              <span className={styles.detailValue}>
                {data.windSpeed ?? "—"} {windUnit}
                {windDirection ? ` · ${windDirection}` : ""}
              </span>
            </div>
            <div className={styles.detail}>
              <span className={styles.detailLabel}>
                <Cloud size={isFullscreen ? 18 : 12} />
                Clouds
              </span>
              <span className={styles.detailValue}>
                {data.cloudCover ?? "—"}%
              </span>
            </div>
            <div className={styles.detail}>
              <span className={styles.detailLabel}>
                <Sunrise size={isFullscreen ? 18 : 12} />
                Sunrise
              </span>
              <span className={styles.detailValue}>{sunrise ?? "—"}</span>
            </div>
            <div className={styles.detail}>
              <span className={styles.detailLabel}>
                <Sunset size={isFullscreen ? 18 : 12} />
                Sunset
              </span>
              <span className={styles.detailValue}>{sunset ?? "—"}</span>
            </div>
            <div className={styles.detail}>
              <span className={styles.detailLabel}>
                <Sun size={12} />
                UV index
              </span>
              <span className={styles.detailValue}>{data.uvIndex ?? "—"}</span>
            </div>
            </div>
          )}
          {isFullscreen && data.forecast && data.forecast.length > 0 && (
            <div className={styles.forecastGrid}>
              <div className={styles.forecastTitle}>7-Day Forecast</div>
              {data.forecast.map((day) => {
                const dayInfo = getWeatherInfo(day.weatherCode);
                return (
                  <div key={day.date} className={styles.forecastDay}>
                    <div className={styles.forecastDateLabel}>{formatForecastDate(day.date)}</div>
                    <div className={styles.forecastIcon}>
                      <WeatherIcon name={dayInfo.icon} size={28} />
                    </div>
                    <div className={styles.forecastTemps}>
                      <span className={styles.forecastHigh}>{day.high !== null ? `${day.high}°` : "—"}</span>
                      <span className={styles.forecastLow}>{day.low !== null ? `${day.low}°` : "—"}</span>
                    </div>
                    <div className={styles.forecastInfo}>
                      <div className={styles.infoRow}>{dayInfo.label}</div>
                      <div className={styles.infoRow}>Rain: {day.rainChance !== null ? `${day.rainChance}%` : "—"}</div>
                      {day.rainAmount !== null && day.rainAmount > 0 && (
                        <div className={styles.infoRow}>Precip: {day.rainAmount}mm</div>
                      )}
                      <div className={styles.infoRow}>
                        Wind: {day.windSpeed !== null ? `${day.windSpeed} ${windUnit}` : "—"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
