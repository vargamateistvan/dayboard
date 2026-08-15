import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, Moon, RefreshCw, Sunrise, Sunset } from "lucide-react";
import { useSettings } from "../lib/useSettings";
import styles from "./AstronomyWidget.module.css";

interface AstronomyData {
  location: string;
  timezone: string | null;
  utcOffsetSeconds: number | null;
  sunrise: string | null;
  sunset: string | null;
  moonrise: string | null;
  moonset: string | null;
  moonPhase: number | null;
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

function getMoonPhaseInfo(moonPhase: number | null): { label: string; icon: string } {
  if (moonPhase === null) {
    return { label: "Unknown", icon: "🌙" };
  }

  if (moonPhase < 0.03 || moonPhase >= 0.97) {
    return { label: "New Moon", icon: "🌑" };
  }
  if (moonPhase < 0.22) {
    return { label: "Waxing Crescent", icon: "🌒" };
  }
  if (moonPhase < 0.28) {
    return { label: "First Quarter", icon: "🌓" };
  }
  if (moonPhase < 0.47) {
    return { label: "Waxing Gibbous", icon: "🌔" };
  }
  if (moonPhase < 0.53) {
    return { label: "Full Moon", icon: "🌕" };
  }
  if (moonPhase < 0.72) {
    return { label: "Waning Gibbous", icon: "🌖" };
  }
  if (moonPhase < 0.78) {
    return { label: "Last Quarter", icon: "🌗" };
  }
  return { label: "Waning Crescent", icon: "🌘" };
}

function getMoonIlluminationPercent(moonPhase: number | null): number | null {
  if (moonPhase === null) {
    return null;
  }

  return Math.round(((1 - Math.cos(2 * Math.PI * moonPhase)) / 2) * 100);
}

async function fetchAstronomy(lat: number, lon: number): Promise<AstronomyData> {
  const astronomyUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    "&daily=sunrise,sunset,moonrise,moonset,moon_phase&timezone=auto&forecast_days=1";
  const geoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;

  const [astronomyRes, geoRes] = await Promise.all([fetch(astronomyUrl), fetch(geoUrl)]);
  if (!astronomyRes.ok || !geoRes.ok) {
    throw new Error("Astronomy fetch failed");
  }

  const astronomy = await astronomyRes.json();
  const geo = await geoRes.json();

  const city =
    geo.address?.city ??
    geo.address?.town ??
    geo.address?.village ??
    geo.address?.county ??
    "Unknown location";

  return {
    location: city,
    timezone: typeof astronomy.timezone === "string" ? astronomy.timezone : null,
    utcOffsetSeconds:
      typeof astronomy.utc_offset_seconds === "number"
        ? astronomy.utc_offset_seconds
        : null,
    sunrise: typeof astronomy.daily?.sunrise?.[0] === "string" ? astronomy.daily.sunrise[0] : null,
    sunset: typeof astronomy.daily?.sunset?.[0] === "string" ? astronomy.daily.sunset[0] : null,
    moonrise: typeof astronomy.daily?.moonrise?.[0] === "string" ? astronomy.daily.moonrise[0] : null,
    moonset: typeof astronomy.daily?.moonset?.[0] === "string" ? astronomy.daily.moonset[0] : null,
    moonPhase:
      typeof astronomy.daily?.moon_phase?.[0] === "number"
        ? astronomy.daily.moon_phase[0]
        : null,
  };
}

interface AstronomyWidgetProps {
  readonly isFullscreen?: boolean;
}

export function AstronomyWidget({ isFullscreen = false }: AstronomyWidgetProps) {
  const { settings } = useSettings();
  const [data, setData] = useState<AstronomyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    const runFetch = async (latitude: number, longitude: number) => {
      try {
        const result = await fetchAstronomy(latitude, longitude);
        setData(result);
        setLastRefreshedAt(Date.now());
        setNow(Date.now());
      } catch {
        setError("Could not load astronomy data.");
      } finally {
        setLoading(false);
      }
    };

    if (settings.astronomyUseDeviceLocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          void runFetch(coords.latitude, coords.longitude);
        },
        () => {
          setError("Location access denied. Enable location to see astronomy.");
          setLoading(false);
        },
      );
      return;
    }

    const latitude = Number.parseFloat(settings.astronomyManualLatitude);
    const longitude = Number.parseFloat(settings.astronomyManualLongitude);
    const hasValidCoords =
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180;

    if (!hasValidCoords) {
      setError("Enter valid manual coordinates to load astronomy data.");
      setLoading(false);
      return;
    }

    void runFetch(latitude, longitude);
  }, [
    settings.astronomyManualLatitude,
    settings.astronomyManualLongitude,
    settings.astronomyUseDeviceLocation,
  ]);

  useEffect(() => {
    load();
    const id = setInterval(load, settings.astronomyRefreshMinutes * 60 * 1000);
    return () => clearInterval(id);
  }, [load, settings.astronomyRefreshMinutes]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const sunrise = data ? formatTime(data.sunrise, data.timezone, data.utcOffsetSeconds) : null;
  const sunset = data ? formatTime(data.sunset, data.timezone, data.utcOffsetSeconds) : null;
  const moonrise = data ? formatTime(data.moonrise, data.timezone, data.utcOffsetSeconds) : null;
  const moonset = data ? formatTime(data.moonset, data.timezone, data.utcOffsetSeconds) : null;
  const moonPhase = getMoonPhaseInfo(data?.moonPhase ?? null);
  const moonIllumination = getMoonIlluminationPercent(data?.moonPhase ?? null);
  const lastRefreshLabel = useMemo(
    () => (lastRefreshedAt === null ? null : formatLastRefresh(lastRefreshedAt, now)),
    [lastRefreshedAt, now],
  );

  return (
    <div className={[styles.widget, isFullscreen ? styles.fullscreen : ""].join(" ")}>
      <div className={styles.header}>
        <span className={styles.title}>Astronomy</span>
        {!loading && (
          <div className={styles.refreshGroup}>
            {lastRefreshLabel && <span className={styles.refreshHint}>{lastRefreshLabel}</span>}
            <button
              className={styles.refresh}
              onClick={load}
              title="Refresh astronomy"
              aria-label="Refresh astronomy"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className={styles.loading} aria-label="Loading astronomy">
          Loading…
        </div>
      )}
      {!loading && error && <div className={styles.error}>{error}</div>}

      {!loading && !error && data && (
        <div className={styles.content}>
          <div className={styles.location}>
            <MapPin size={isFullscreen ? 18 : 12} />
            <span>{data.location}</span>
          </div>

          <div className={styles.grid}>
            <div className={styles.item}>
              <span className={styles.label}>
                <Sunrise size={isFullscreen ? 18 : 12} />
                Sunrise
              </span>
              <span className={styles.value}>{sunrise ?? "—"}</span>
            </div>
            <div className={styles.item}>
              <span className={styles.label}>
                <Sunset size={isFullscreen ? 18 : 12} />
                Sunset
              </span>
              <span className={styles.value}>{sunset ?? "—"}</span>
            </div>
            <div className={styles.item}>
              <span className={styles.label}>
                <Moon size={isFullscreen ? 18 : 12} />
                Moonrise
              </span>
              <span className={styles.value}>{moonrise ?? "—"}</span>
            </div>
            <div className={styles.item}>
              <span className={styles.label}>
                <Moon size={isFullscreen ? 18 : 12} />
                Moonset
              </span>
              <span className={styles.value}>{moonset ?? "—"}</span>
            </div>
            <div className={[styles.item, styles.itemWide].join(" ")}>
              <span className={styles.label}>
                <span className={styles.phaseIcon} aria-hidden="true">
                  {moonPhase.icon}
                </span>
                Moon phase
              </span>
              <span className={styles.value}>
                {moonPhase.label}
                {moonIllumination !== null ? ` · ${moonIllumination}% illuminated` : ""}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
