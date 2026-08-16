import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPin, RefreshCw } from "lucide-react";
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

const CHART_W = 220;
const CHART_H = 74;
const CHART_LEFT = 8;
const CHART_RIGHT = 212;
const HORIZON_Y = 44;
const UP_AMPLITUDE = 30;
const DOWN_AMPLITUDE = 22;

function minutesFromLocalIso(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const match = value.match(/T(\d{2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function formatMinutes(total: number | null): string | null {
  if (total === null) {
    return null;
  }
  const m = ((Math.floor(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function wrapMinutes(diff: number): number {
  return ((((diff + 720) % 1440) + 1440) % 1440) - 720;
}

function chartX(t: number): number {
  return CHART_LEFT + (t / 1440) * (CHART_RIGHT - CHART_LEFT);
}

function chartY(altitude: number): number {
  return HORIZON_Y - altitude * (altitude >= 0 ? UP_AMPLITUDE : DOWN_AMPLITUDE);
}

interface AltitudeCurve {
  linePath: string;
  areaPath: string;
  meridian: number;
  altitudeAt: (t: number) => number;
  yAt: (t: number) => number;
}

function buildAltitudeCurve(
  riseMinutes: number | null,
  setMinutes: number | null,
): AltitudeCurve | null {
  if (riseMinutes === null || setMinutes === null) {
    return null;
  }

  let duration = setMinutes - riseMinutes;
  if (duration <= 0) {
    duration += 1440;
  }
  const meridian = (riseMinutes + duration / 2) % 1440;
  const halfDuration = duration / 2;

  const altitudeAt = (t: number) => {
    const arg = Math.max(
      -Math.PI,
      Math.min(Math.PI, (wrapMinutes(t - meridian) / halfDuration) * (Math.PI / 2)),
    );
    return Math.cos(arg);
  };
  const yAt = (t: number) => chartY(altitudeAt(t));

  const points: string[] = [];
  for (let t = 0; t <= 1440; t += 10) {
    points.push(`${chartX(t).toFixed(1)} ${yAt(t).toFixed(1)}`);
  }
  const linePath = `M ${points.join(" L ")}`;
  const areaPath = `${linePath} L ${CHART_RIGHT} ${CHART_H} L ${CHART_LEFT} ${CHART_H} Z`;

  return { linePath, areaPath, meridian, altitudeAt, yAt };
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function toCompass(degrees: number): string {
  const points = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ] as const;
  const index = Math.round(normalizeDegrees(degrees) / 22.5) % 16;
  return points[index];
}

function progressBetween(start: number, end: number, value: number): number | null {
  let span = end - start;
  if (span <= 0) {
    span += 1440;
  }
  let offset = value - start;
  if (offset < 0) {
    offset += 1440;
  }
  if (offset < 0 || offset > span) {
    return null;
  }
  return offset / span;
}

function interpolateDirection(
  variant: "sun" | "moon",
  progress: number,
  beforeMeridian: boolean,
): number {
  const riseAzimuth = variant === "sun" ? 68 : 101;
  const setAzimuth = variant === "sun" ? 291 : 255;
  const easing = Math.pow(progress, 1.5);
  if (beforeMeridian) {
    return riseAzimuth + (180 - riseAzimuth) * easing;
  }
  return 180 + (setAzimuth - 180) * easing;
}

interface ChartDataSnapshot {
  time: string;
  altitude: string;
  direction: string;
  phaseOrPosition: string;
}

function getChartSnapshot(
  curve: AltitudeCurve | null,
  activeMinutes: number,
  riseMinutes: number | null,
  setMinutes: number | null,
  variant: "sun" | "moon",
): ChartDataSnapshot {
  const time = formatMinutes(activeMinutes) ?? "—";
  if (!curve) {
    return {
      time,
      altitude: "—",
      direction: "—",
      phaseOrPosition: variant === "sun" ? "Unknown" : "Unknown position",
    };
  }

  const altitudeDegrees = Math.round(curve.altitudeAt(activeMinutes) * 90);
  const beforeMeridian = wrapMinutes(activeMinutes - curve.meridian) < 0;
  const arrow = beforeMeridian ? "↑" : "↓";

  let azimuth = variant === "sun" ? 180 : 180;
  if (riseMinutes !== null && setMinutes !== null) {
    const spanProgress = progressBetween(riseMinutes, setMinutes, activeMinutes);
    if (spanProgress !== null) {
      if (spanProgress <= 0.5) {
        azimuth = interpolateDirection(variant, spanProgress * 2, true);
      } else {
        azimuth = interpolateDirection(variant, (spanProgress - 0.5) * 2, false);
      }
    } else {
      azimuth = variant === "sun" ? 347 : 299;
    }
  }
  const normalizedAzimuth = Math.round(normalizeDegrees(azimuth));
  const direction = `${normalizedAzimuth}° ${toCompass(normalizedAzimuth)} ${arrow}`;
  const isAboveHorizon = altitudeDegrees >= 0;
  const phaseOrPosition =
    variant === "sun"
      ? isAboveHorizon
        ? "Day"
        : "Night"
      : isAboveHorizon
        ? "Moon in sky"
        : "Moon under horizon";

  return {
    time,
    altitude: `${altitudeDegrees}°`,
    direction,
    phaseOrPosition,
  };
}

interface AltitudeChartProps {
  readonly curve: AltitudeCurve | null;
  readonly nowMinutes: number;
  readonly markerMinutes: readonly number[];
  readonly variant: "sun" | "moon";
  readonly onHoverMinutesChange?: (minutes: number | null) => void;
}

function AltitudeChart({
  curve,
  nowMinutes,
  markerMinutes,
  variant,
  onHoverMinutesChange,
}: AltitudeChartProps) {
  const clipId = `astro-${variant}-above-horizon`;
  const isSun = variant === "sun";
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverMinutes, setHoverMinutes] = useState<number | null>(null);
  const axisLevels = [90, 60, 30, 0, -30, -60, -90] as const;

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) {
      return;
    }
    const viewX = ((event.clientX - rect.left) / rect.width) * CHART_W;
    const minutes = ((viewX - CHART_LEFT) / (CHART_RIGHT - CHART_LEFT)) * 1440;
    const clamped = Math.max(0, Math.min(1439, minutes));
    setHoverMinutes(clamped);
    onHoverMinutesChange?.(clamped);
  };

  const activeMinutes = hoverMinutes ?? nowMinutes;
  const isAbove = curve ? curve.yAt(activeMinutes) < HORIZON_Y : false;
  const statusLabel = isSun
    ? isAbove
      ? "Day"
      : "Night"
    : isAbove
      ? "Moon up"
      : "Under horizon";
  const readout = curve ? `${formatMinutes(activeMinutes)} · ${statusLabel}` : null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className={styles.altSvg}
      role="img"
      aria-label={`${isSun ? "Sun" : "Moon"} altitude chart. ${readout ?? "No data"}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        setHoverMinutes(null);
        onHoverMinutesChange?.(null);
      }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={CHART_W} height={HORIZON_Y} />
        </clipPath>
      </defs>
      {curve && (
        <>
          <path
            d={curve.areaPath}
            className={isSun ? styles.sunArea : styles.moonArea}
            clipPath={`url(#${clipId})`}
          />
          <path d={curve.linePath} className={isSun ? styles.sunLine : styles.moonLine} />
        </>
      )}
      {axisLevels.map((deg) => {
        const y = chartY(deg / 90);
        return (
          <line
            key={`grid-${deg}`}
            x1={CHART_LEFT}
            y1={y}
            x2={CHART_RIGHT}
            y2={y}
            className={deg === 0 ? styles.axisGridMajor : styles.axisGrid}
          />
        );
      })}
      <line x1={CHART_RIGHT} y1={2} x2={CHART_RIGHT} y2={CHART_H - 2} className={styles.axisLine} />
      {axisLevels.map((deg) => {
        const y = chartY(deg / 90);
        return (
          <text key={`axis-${deg}`} x={CHART_W - 2} y={y + 2.5} textAnchor="end" className={styles.axisLabel}>
            {deg}°
          </text>
        );
      })}
      <line x1={0} y1={HORIZON_Y} x2={CHART_W} y2={HORIZON_Y} className={styles.horizonLine} />
      {curve &&
        markerMinutes.map((t) => (
          <line
            key={t}
            x1={chartX(t)}
            y1={HORIZON_Y - 5}
            x2={chartX(t)}
            y2={HORIZON_Y + 5}
            className={styles.tickLine}
          />
        ))}
      {curve && hoverMinutes !== null && (
        <line
          x1={chartX(activeMinutes)}
          y1={2}
          x2={chartX(activeMinutes)}
          y2={CHART_H - 2}
          className={styles.hoverGuide}
        />
      )}
      {curve && (
        <circle
          cx={chartX(activeMinutes)}
          cy={curve.yAt(activeMinutes)}
          r={isSun ? 5 : 4.5}
          className={isSun ? styles.sunBody : styles.moonBody}
        />
      )}
      {curve && hoverMinutes !== null && readout && (
        <text
          x={chartX(activeMinutes) > CHART_W / 2 ? chartX(activeMinutes) - 6 : chartX(activeMinutes) + 6}
          y={12}
          textAnchor={chartX(activeMinutes) > CHART_W / 2 ? "end" : "start"}
          className={styles.hoverReadout}
        >
          {readout}
        </text>
      )}
    </svg>
  );
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
  const [sunHoverMinutes, setSunHoverMinutes] = useState<number | null>(null);
  const [moonHoverMinutes, setMoonHoverMinutes] = useState<number | null>(null);

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
  const phaseValue = data?.moonPhase ?? 0.5;
  const phaseShift = ((phaseValue - 0.5) * 20).toFixed(2);

  const sunriseMinutes = minutesFromLocalIso(data?.sunrise ?? null);
  const sunsetMinutes = minutesFromLocalIso(data?.sunset ?? null);
  const moonriseMinutes = minutesFromLocalIso(data?.moonrise ?? null);
  const moonsetMinutes = minutesFromLocalIso(data?.moonset ?? null);

  const sunCurve = useMemo(
    () => buildAltitudeCurve(sunriseMinutes, sunsetMinutes),
    [sunriseMinutes, sunsetMinutes],
  );
  const moonCurve = useMemo(
    () => buildAltitudeCurve(moonriseMinutes, moonsetMinutes),
    [moonriseMinutes, moonsetMinutes],
  );

  const nowMinutes = useMemo(() => {
    if (data?.utcOffsetSeconds === null || data?.utcOffsetSeconds === undefined) {
      const local = new Date(now);
      return local.getHours() * 60 + local.getMinutes();
    }
    const shifted = new Date(now + data.utcOffsetSeconds * 1000);
    return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  }, [now, data?.utcOffsetSeconds]);

  const sunMeridian = formatMinutes(sunCurve?.meridian ?? null);
  const moonMeridian = formatMinutes(moonCurve?.meridian ?? null);
  const activeSunMinutes = sunHoverMinutes ?? nowMinutes;
  const activeMoonMinutes = moonHoverMinutes ?? nowMinutes;
  const sunSnapshot = getChartSnapshot(
    sunCurve,
    activeSunMinutes,
    sunriseMinutes,
    sunsetMinutes,
    "sun",
  );
  const moonSnapshot = getChartSnapshot(
    moonCurve,
    activeMoonMinutes,
    moonriseMinutes,
    moonsetMinutes,
    "moon",
  );
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

          <div className={styles.chartPanel} aria-label="Astronomy status chart">
            <div className={styles.chartCard}>
              <div className={styles.chartTitle}>Today's Sun Position</div>
              <div className={styles.chartContent}>
                <div className={styles.chartMain}>
                  <AltitudeChart
                    curve={sunCurve}
                    nowMinutes={nowMinutes}
                    markerMinutes={
                      sunriseMinutes !== null && sunsetMinutes !== null && sunCurve
                        ? [sunriseMinutes, sunCurve.meridian, sunsetMinutes]
                        : []
                    }
                    variant="sun"
                    onHoverMinutesChange={setSunHoverMinutes}
                  />
                  <div className={styles.chartFooter}>
                    <div className={styles.footerItem}>
                      <span className={styles.footerLabel}>Sunrise</span>
                      <span className={styles.footerValue}>{sunrise ?? "—"}</span>
                    </div>
                    <div className={styles.footerItem}>
                      <span className={styles.footerLabel}>Meridian</span>
                      <span className={styles.footerValue}>{sunMeridian ?? "—"}</span>
                    </div>
                    <div className={styles.footerItem}>
                      <span className={styles.footerLabel}>Sunset</span>
                      <span className={styles.footerValue}>{sunset ?? "—"}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.dataBox} aria-live="polite">
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>Time:</span>
                    <span className={styles.dataValue}>{sunSnapshot.time}</span>
                  </div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>Altitude:</span>
                    <span className={styles.dataValue}>{sunSnapshot.altitude}</span>
                  </div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>Direction:</span>
                    <span className={styles.dataValue}>{sunSnapshot.direction}</span>
                  </div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>Phase:</span>
                    <span className={styles.dataValue}>{sunSnapshot.phaseOrPosition}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.chartCard}>
              <div className={styles.moonCardHeader}>
                <div className={styles.chartTitle}>Today's Moon</div>
                <div
                  className={styles.moonDisc}
                  style={{ ["--phase-shift" as string]: `${phaseShift}px` }}
                  aria-label={`Moon phase ${moonPhase.label}`}
                >
                  <span className={styles.moonGlow} aria-hidden="true" />
                </div>
              </div>
              <div className={styles.chartContent}>
                <div className={styles.chartMain}>
                  <AltitudeChart
                    curve={moonCurve}
                    nowMinutes={nowMinutes}
                    markerMinutes={
                      moonriseMinutes !== null && moonsetMinutes !== null && moonCurve
                        ? [moonriseMinutes, moonCurve.meridian, moonsetMinutes]
                        : []
                    }
                    variant="moon"
                    onHoverMinutesChange={setMoonHoverMinutes}
                  />
                  <div className={styles.chartFooter}>
                    <div className={styles.footerItem}>
                      <span className={styles.footerLabel}>Moonrise</span>
                      <span className={styles.footerValue}>{moonrise ?? "—"}</span>
                    </div>
                    <div className={styles.footerItem}>
                      <span className={styles.footerLabel}>Meridian</span>
                      <span className={styles.footerValue}>{moonMeridian ?? "—"}</span>
                    </div>
                    <div className={styles.footerItem}>
                      <span className={styles.footerLabel}>Moonset</span>
                      <span className={styles.footerValue}>{moonset ?? "—"}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.dataBox} aria-live="polite">
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>Percent Illuminated:</span>
                    <span className={styles.dataValue}>
                      {moonIllumination !== null ? `${moonIllumination}%` : "—"}
                    </span>
                  </div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>Time:</span>
                    <span className={styles.dataValue}>{moonSnapshot.time}</span>
                  </div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>Altitude:</span>
                    <span className={styles.dataValue}>{moonSnapshot.altitude}</span>
                  </div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>Direction:</span>
                    <span className={styles.dataValue}>{moonSnapshot.direction}</span>
                  </div>
                  <div className={styles.dataRow}>
                    <span className={styles.dataLabel}>Position:</span>
                    <span className={styles.dataValue}>{moonSnapshot.phaseOrPosition}</span>
                  </div>
                </div>
              </div>
              <div className={styles.moonPhaseRow}>
                <span className={styles.phaseIcon} aria-hidden="true">
                  {moonPhase.icon}
                </span>
                <span className={styles.moonPhaseSummary}>
                  {moonPhase.label}
                  {moonIllumination !== null ? ` · ${moonIllumination}% illuminated` : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
