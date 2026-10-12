import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPin, RefreshCw } from "lucide-react";
import { isMotionEnabled, loadAnimeJs, MOTION_DURATIONS, MOTION_STAGGERS } from "../lib/anime";
import { useSettings } from "../lib/useSettings";
import { usePolledResource } from "../lib/usePolledResource";
import { getCurrentLocation, parseCoordinates, reverseGeocode, type Coordinates } from "../lib/location";
import { getMoonPosition, getSunPosition, SUN_HORIZON_ALTITUDE, type HorizontalPosition } from "../lib/celestial";
import { moonLitPath } from "../lib/moonShape";
import styles from "./AstronomyWidget.module.css";

interface AstronomyData {
  location: string;
  coordinates: Coordinates;
  timezone: string | null;
  utcOffsetSeconds: number | null;
  sunrise: string | null;
  sunset: string | null;
  moonrise: string | null;
  moonset: string | null;
  moonPhase: number | null;
  primaryMoonPhaseDates: {
    newMoon: string | null;
    firstQuarter: string | null;
    fullMoon: string | null;
    thirdQuarter: string | null;
  };
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

function MoonPhaseIcon({ phase, mini = false, label }: { phase: number; mini?: boolean; label?: string }) {
  return (
    <span
      className={[styles.moonDisc, mini ? styles.moonDiscMini : ""].join(" ")}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox="0 0 20 20" className={styles.moonSvg} aria-hidden="true">
        <path d={moonLitPath(phase, 10)} className={styles.moonLit} />
      </svg>
    </span>
  );
}

function formatPhaseDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return value;
  }
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(date);
}

function computePrimaryMoonPhaseDates(
  currentDate: unknown,
  currentPhase: unknown,
): AstronomyData["primaryMoonPhaseDates"] {
  if (typeof currentDate !== "string" || typeof currentPhase !== "number" || !Number.isFinite(currentPhase)) {
    return {
      newMoon: null,
      firstQuarter: null,
      fullMoon: null,
      thirdQuarter: null,
    };
  }

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(currentDate);
  if (!dateMatch) {
    return {
      newMoon: null,
      firstQuarter: null,
      fullMoon: null,
      thirdQuarter: null,
    };
  }

  const [, year, month, day] = dateMatch;
  const base = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const synodicDays = 29.530588;
  const toDate = (targetPhase: number): string => {
    const deltaPhase = (targetPhase - currentPhase + 1) % 1;
    const dayOffset = deltaPhase * synodicDays;
    const next = new Date(base.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const iso = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(
      next.getUTCDate(),
    ).padStart(2, "0")}`;
    return formatPhaseDate(iso);
  };

  return {
    newMoon: toDate(0),
    firstQuarter: toDate(0.25),
    fullMoon: toDate(0.5),
    thirdQuarter: toDate(0.75),
  };
}

const CHART_W = 780;
const CHART_H = 96;
const CHART_LEFT = 28;
const CHART_RIGHT = 740;
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

function buildAltitudeCurve(altitudeAtMinute: (minute: number) => number): AltitudeCurve {
  const samples = new Map<number, number>();
  for (let t = 0; t <= 1440; t += 10) {
    samples.set(t, altitudeAtMinute(t));
  }

  let meridian = 0;
  let highest = -Infinity;
  for (let t = 0; t <= 1440; t += 5) {
    const altitude = altitudeAtMinute(t);
    if (altitude > highest) {
      highest = altitude;
      meridian = t;
    }
  }

  // Normalised to -1..1 for the chart.
  const altitudeAt = (t: number) => Math.max(-90, Math.min(90, altitudeAtMinute(t))) / 90;
  const yAt = (t: number) => chartY(altitudeAt(t));

  const points = [...samples.entries()].map(([t, altitude]) => `${chartX(t).toFixed(1)} ${chartY(altitude / 90).toFixed(1)}`);
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

interface ChartDataSnapshot {
  time: string;
  altitude: string;
  direction: string;
  directionDegrees: number | null;
  phaseOrPosition: string;
}

function getChartSnapshot(
  curve: AltitudeCurve | null,
  position: HorizontalPosition | null,
  activeMinutes: number,
  variant: "sun" | "moon",
): ChartDataSnapshot {
  const time = formatMinutes(activeMinutes) ?? "—";
  if (!curve || !position) {
    return {
      time,
      altitude: "—",
      direction: "—",
      directionDegrees: null,
      phaseOrPosition: variant === "sun" ? "Unknown" : "Unknown position",
    };
  }

  const arrow = wrapMinutes(activeMinutes - curve.meridian) < 0 ? "↑" : "↓";
  const azimuth = Math.round(normalizeDegrees(position.azimuth)) % 360;
  const isUp = position.altitude > (variant === "sun" ? SUN_HORIZON_ALTITUDE : 0);

  return {
    time,
    altitude: `${Math.round(position.altitude)}°`,
    direction: `${azimuth}° ${toCompass(azimuth)} ${arrow}`,
    directionDegrees: azimuth,
    phaseOrPosition:
      variant === "sun" ? (isUp ? "Day" : "Night") : isUp ? "Moon in sky" : "Moon under horizon",
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
  const riseMinutes = markerMinutes[0] ?? null;
  const meridianMinutes = markerMinutes.length >= 3 ? markerMinutes[1] : null;
  const setMinutes = markerMinutes[markerMinutes.length - 1] ?? null;

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
      <text x={CHART_RIGHT - 4} y={HORIZON_Y - 3} textAnchor="end" className={styles.horizonLabel}>
        Horizon
      </text>
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
      {curve && riseMinutes !== null && (
        <>
          <circle cx={chartX(riseMinutes)} cy={HORIZON_Y} r={2.8} className={styles.riseSetMarker} />
        </>
      )}
      {curve && setMinutes !== null && (
        <>
          <circle cx={chartX(setMinutes)} cy={HORIZON_Y} r={2.8} className={styles.riseSetMarker} />
        </>
      )}
      {curve && riseMinutes !== null && (
        <>
          <text x={chartX(riseMinutes)} y={CHART_H - 16} textAnchor="middle" className={styles.eventLabel}>
            Rise
          </text>
          <text x={chartX(riseMinutes)} y={CHART_H - 4} textAnchor="middle" className={styles.eventTime}>
            {formatMinutes(riseMinutes)}
          </text>
        </>
      )}
      {curve && meridianMinutes !== null && (
        <>
          <text x={chartX(meridianMinutes)} y={CHART_H - 16} textAnchor="middle" className={styles.eventLabel}>
            Meridian
          </text>
          <text x={chartX(meridianMinutes)} y={CHART_H - 4} textAnchor="middle" className={styles.eventTime}>
            {formatMinutes(meridianMinutes)}
          </text>
        </>
      )}
      {curve && setMinutes !== null && (
        <>
          <text x={chartX(setMinutes)} y={CHART_H - 16} textAnchor="middle" className={styles.eventLabel}>
            Set
          </text>
          <text x={chartX(setMinutes)} y={CHART_H - 4} textAnchor="middle" className={styles.eventTime}>
            {formatMinutes(setMinutes)}
          </text>
        </>
      )}
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

async function fetchAstronomy(coordinates: Coordinates, signal: AbortSignal): Promise<AstronomyData> {
  const astronomyUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${coordinates.latitude}&longitude=${coordinates.longitude}` +
    "&daily=sunrise,sunset,moonrise,moonset,moon_phase&timezone=auto&forecast_days=1";

  const [astronomy, city] = await Promise.all([
    fetch(astronomyUrl, { signal }).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }),
    // The place name is optional: a failed lookup must not hide the sky.
    reverseGeocode(coordinates),
  ]);

  return {
    location: city ?? "Unknown location",
    coordinates,
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
    primaryMoonPhaseDates: computePrimaryMoonPhaseDates(
      astronomy.daily?.time?.[0],
      astronomy.daily?.moon_phase?.[0],
    ),
  };
}

/** Rise and set markers, or null when both are midnight (polar day or night). */
function riseSetMinutes(rise: string | null, set: string | null): [number, number] | null {
  const riseMinutes = minutesFromLocalIso(rise);
  const setMinutes = minutesFromLocalIso(set);
  if (riseMinutes === null || setMinutes === null || riseMinutes === setMinutes) return null;
  return [riseMinutes, setMinutes];
}

interface AstronomyWidgetProps {
  readonly isFullscreen?: boolean;
}

export function AstronomyWidget({ isFullscreen = false }: AstronomyWidgetProps) {
  const { settings } = useSettings();
  const widgetRootRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [sunHoverMinutes, setSunHoverMinutes] = useState<number | null>(null);
  const [moonHoverMinutes, setMoonHoverMinutes] = useState<number | null>(null);
  const useDeviceLocation = settings.astronomyUseDeviceLocation;
  const manualLatitude = settings.astronomyManualLatitude;
  const manualLongitude = settings.astronomyManualLongitude;

  const fetcher = useCallback(
    async (signal: AbortSignal) => {
      let coordinates: Coordinates;
      if (useDeviceLocation) {
        coordinates = await getCurrentLocation("astronomy");
      } else {
        const manual = parseCoordinates(manualLatitude, manualLongitude);
        if (!manual) throw new Error("Enter valid manual coordinates to load astronomy data.");
        coordinates = manual;
      }

      try {
        return await fetchAstronomy(coordinates, signal);
      } catch (fetchError) {
        if (signal.aborted) throw fetchError;
        throw new Error("Could not load astronomy data.", { cause: fetchError });
      }
    },
    [useDeviceLocation, manualLatitude, manualLongitude],
  );
  const {
    data,
    error,
    loading,
    lastUpdatedAt: lastRefreshedAt,
    refresh: load,
  } = usePolledResource(fetcher, {
    intervalMs: settings.astronomyRefreshMinutes * 60 * 1000,
    key: useDeviceLocation ? "device" : `${manualLatitude},${manualLongitude}`,
  });

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // The API returns one day; load the new day as soon as the location's date changes.
  const utcOffsetSeconds = data?.utcOffsetSeconds ?? null;
  const localDayIndex =
    utcOffsetSeconds === null ? null : Math.floor((now + utcOffsetSeconds * 1000) / 86_400_000);
  const lastDayIndexRef = useRef<number | null>(null);
  useEffect(() => {
    if (localDayIndex === null) return;
    const previous = lastDayIndexRef.current;
    lastDayIndexRef.current = localDayIndex;
    if (previous !== null && previous !== localDayIndex) load();
  }, [localDayIndex, load]);

  const moonPhase = getMoonPhaseInfo(data?.moonPhase ?? null);
  const moonIllumination = getMoonIlluminationPercent(data?.moonPhase ?? null);
  const phaseValue = data?.moonPhase ?? 0.5;

  const sunRiseSet = riseSetMinutes(data?.sunrise ?? null, data?.sunset ?? null);
  const moonRiseSet = riseSetMinutes(data?.moonrise ?? null, data?.moonset ?? null);

  const nowMinutes = useMemo(() => {
    if (utcOffsetSeconds === null) {
      const local = new Date(now);
      return local.getHours() * 60 + local.getMinutes();
    }
    const shifted = new Date(now + utcOffsetSeconds * 1000);
    return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  }, [now, utcOffsetSeconds]);

  // Minute t of the location's day as an instant.
  const dayStartMs = now - nowMinutes * 60_000 - (now % 60_000);
  const latitude = data?.coordinates.latitude ?? null;
  const longitude = data?.coordinates.longitude ?? null;

  const sunCurve = useMemo(
    () =>
      latitude === null || longitude === null
        ? null
        : buildAltitudeCurve((t) => getSunPosition(new Date(dayStartMs + t * 60_000), latitude, longitude).altitude),
    [dayStartMs, latitude, longitude],
  );
  const moonCurve = useMemo(
    () =>
      latitude === null || longitude === null
        ? null
        : buildAltitudeCurve((t) => getMoonPosition(new Date(dayStartMs + t * 60_000), latitude, longitude).altitude),
    [dayStartMs, latitude, longitude],
  );

  const activeSunMinutes = sunHoverMinutes ?? nowMinutes;
  const activeMoonMinutes = moonHoverMinutes ?? nowMinutes;
  const positionAt = (
    getPosition: typeof getSunPosition,
    minutes: number,
  ): HorizontalPosition | null =>
    latitude === null || longitude === null
      ? null
      : getPosition(new Date(dayStartMs + minutes * 60_000), latitude, longitude);
  const sunSnapshot = getChartSnapshot(sunCurve, positionAt(getSunPosition, activeSunMinutes), activeSunMinutes, "sun");
  const moonSnapshot = getChartSnapshot(moonCurve, positionAt(getMoonPosition, activeMoonMinutes), activeMoonMinutes, "moon");
  const lastRefreshLabel = useMemo(
    () => (lastRefreshedAt === null ? null : formatLastRefresh(lastRefreshedAt, now)),
    [lastRefreshedAt, now],
  );
  const contentAnimationSignature = useMemo(() => {
    if (!data) {
      return "empty";
    }

    return [
      data.location,
      data.sunrise ?? "",
      data.sunset ?? "",
      data.moonrise ?? "",
      data.moonset ?? "",
      data.moonPhase?.toFixed(4) ?? "",
    ].join(":");
  }, [data]);

  useEffect(() => {
    if (!isMotionEnabled() || loading || error || !data) {
      return;
    }

    const contentNode = contentRef.current;
    if (!contentNode) {
      return;
    }

    const animatedNodes = Array.from(
      contentNode.querySelectorAll<HTMLElement>(
        `.${styles.location}, .${styles.chartCard}, .${styles.phaseDateRow}`,
      ),
    );
    if (!animatedNodes.length) {
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
          anime.animate(animatedNodes, {
            opacity: [0, 1],
            translateY: [8, 0],
            duration: MOTION_DURATIONS.medium,
            delay: anime.stagger(MOTION_STAGGERS.tight),
          }),
        ];
        return;
      }

      activeAnimations = animatedNodes.map((node, index) =>
        anime.animate(node, {
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
  }, [contentAnimationSignature, loading, error, data]);

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
      animateRefresh(button, {
        scale: 0.95,
        translateY: 0,
        duration: Math.max(80, MOTION_DURATIONS.quick - 50),
      });
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

  return (
    <div ref={widgetRootRef} className={[styles.widget, isFullscreen ? styles.fullscreen : ""].join(" ")}>
      <div className={styles.header}>
        <span className={styles.title}>Astronomy</span>
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
      {!loading && error && !data && <div className={styles.error}>{error}</div>}

      {data && (
        <div ref={contentRef} className={styles.content}>
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
                    markerMinutes={sunRiseSet && sunCurve ? [sunRiseSet[0], sunCurve.meridian, sunRiseSet[1]] : []}
                    variant="sun"
                    onHoverMinutesChange={setSunHoverMinutes}
                  />
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
                <MoonPhaseIcon phase={phaseValue} label={`Moon phase ${moonPhase.label}`} />
              </div>
              <div className={styles.chartContent}>
                <div className={styles.chartMain}>
                  <AltitudeChart
                    curve={moonCurve}
                    nowMinutes={nowMinutes}
                    markerMinutes={moonRiseSet && moonCurve ? [moonRiseSet[0], moonCurve.meridian, moonRiseSet[1]] : []}
                    variant="moon"
                    onHoverMinutesChange={setMoonHoverMinutes}
                  />
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
              <div className={styles.phaseDates}>
                <div className={styles.phaseDateRow}>
                  <span className={styles.phaseDateLabelWrap}>
                    <MoonPhaseIcon phase={0} mini />
                    <span className={styles.phaseDateLabel}>New Moon</span>
                  </span>
                  <span className={styles.phaseDateValue}>
                    {data.primaryMoonPhaseDates.newMoon ?? "—"}
                  </span>
                </div>
                <div className={styles.phaseDateRow}>
                  <span className={styles.phaseDateLabelWrap}>
                    <MoonPhaseIcon phase={0.25} mini />
                    <span className={styles.phaseDateLabel}>First Quarter</span>
                  </span>
                  <span className={styles.phaseDateValue}>
                    {data.primaryMoonPhaseDates.firstQuarter ?? "—"}
                  </span>
                </div>
                <div className={styles.phaseDateRow}>
                  <span className={styles.phaseDateLabelWrap}>
                    <MoonPhaseIcon phase={0.5} mini />
                    <span className={styles.phaseDateLabel}>Full Moon</span>
                  </span>
                  <span className={styles.phaseDateValue}>
                    {data.primaryMoonPhaseDates.fullMoon ?? "—"}
                  </span>
                </div>
                <div className={styles.phaseDateRow}>
                  <span className={styles.phaseDateLabelWrap}>
                    <MoonPhaseIcon phase={0.75} mini />
                    <span className={styles.phaseDateLabel}>Last Quarter</span>
                  </span>
                  <span className={styles.phaseDateValue}>
                    {data.primaryMoonPhaseDates.thirdQuarter ?? "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
