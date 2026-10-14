/**
 * Dayboard flights proxy — Cloudflare Worker
 *
 *   Browser (Dayboard on GitHub Pages)
 *      │  GET /v2/point/{lat}/{lon}/{radiusNm}
 *      ▼
 *   Cloudflare Cache API  ← per-colo edge cache, 10 s
 *      │  MISS
 *      ▼
 *   OpenSky (with credentials)  →  adsb.lol  →  adsb.fi  →  OpenSky (anonymous)
 *
 * None of the upstreams send CORS headers for our origin, so the SPA cannot
 * call them directly. The worker forwards point queries only and adds
 * permissive CORS headers.
 *
 * adsb.lol and adsb.fi throttle or block Cloudflare's shared egress IPs, and
 * anonymous OpenSky quota is per IP, so the reliable path is OpenSky with the
 * account's own API client (OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET).
 * Responses are passed through as `{ ac: [...] }` (adsb) or
 * `{ time, states }` (OpenSky); the app parses both.
 *
 * Positions change every few seconds, so there is no KV layer: the free KV
 * plan's 1,000 writes/day would run out within hours of polling.
 */

export interface Env {
  /**
   * OpenSky API client credentials (Account → API Client on opensky-network.org).
   *
   * Set with:
   *   wrangler secret put OPENSKY_CLIENT_ID
   *   wrangler secret put OPENSKY_CLIENT_SECRET
   */
  OPENSKY_CLIENT_ID?: string;
  OPENSKY_CLIENT_SECRET?: string;
}

// adsb.lol rejects generic user agents and asks for contact info.
const USER_AGENT =
  "dayboard-proxy (+https://github.com/vargamateistvan/dayboard)";
const POINT_PATH = /^\/v2\/point\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(\d+)$/;
const CACHE_SECONDS = 10;
const KM_PER_NAUTICAL_MILE = 1.852;
const OPENSKY_TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
// Refresh the token a minute before OpenSky expires it.
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Expose-Headers": "X-Cache, X-Upstream",
};

interface PointQuery {
  latitude: number;
  longitude: number;
  radiusNm: number;
}

interface UpstreamResult {
  source: string;
  body: string;
}

let openSkyToken: { value: string; expiresAtMs: number } | null = null;

function textResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function getOpenSkyToken(env: Env): Promise<string> {
  if (openSkyToken !== null && openSkyToken.expiresAtMs > Date.now()) {
    return openSkyToken.value;
  }

  const response = await fetch(OPENSKY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.OPENSKY_CLIENT_ID ?? "",
      client_secret: env.OPENSKY_CLIENT_SECRET ?? "",
    }),
  });
  if (!response.ok) {
    throw new Error(`token HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!payload.access_token) {
    throw new Error("token response had no access_token");
  }

  openSkyToken = {
    value: payload.access_token,
    expiresAtMs:
      Date.now() + (payload.expires_in ?? 1800) * 1000 - TOKEN_EXPIRY_MARGIN_MS,
  };
  return openSkyToken.value;
}

function buildOpenSkyUrl({ latitude, longitude, radiusNm }: PointQuery): string {
  const radiusKm = radiusNm * KM_PER_NAUTICAL_MILE;
  // A degree of longitude shrinks toward the poles, so widen east-west.
  const latitudeDelta = radiusKm / 111;
  const longitudeDelta =
    radiusKm / (111 * Math.max(0.05, Math.cos((latitude * Math.PI) / 180)));

  const url = new URL("https://opensky-network.org/api/states/all");
  url.searchParams.set("lamin", (latitude - latitudeDelta).toFixed(4));
  url.searchParams.set("lomin", (longitude - longitudeDelta).toFixed(4));
  url.searchParams.set("lamax", (latitude + latitudeDelta).toFixed(4));
  url.searchParams.set("lomax", (longitude + longitudeDelta).toFixed(4));
  return url.toString();
}

async function fetchOpenSky(
  query: PointQuery,
  env: Env,
  authenticated: boolean,
): Promise<UpstreamResult> {
  const headers: Record<string, string> = { "User-Agent": USER_AGENT };
  if (authenticated) {
    headers.Authorization = `Bearer ${await getOpenSkyToken(env)}`;
  }

  const response = await fetch(buildOpenSkyUrl(query), { headers });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { time?: unknown; states?: unknown };
  return {
    source: authenticated ? "opensky" : "opensky-anonymous",
    // OpenSky returns `states: null` for an empty sky.
    body: JSON.stringify({ time: payload.time, states: payload.states ?? [] }),
  };
}

async function fetchAdsb(source: string, url: string): Promise<UpstreamResult> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  // adsb.lol calls the list `ac`, adsb.fi calls it `aircraft`.
  const payload = (await response.json()) as { ac?: unknown; aircraft?: unknown };
  const aircraft = payload.ac ?? payload.aircraft;
  if (!Array.isArray(aircraft)) {
    throw new Error("unexpected payload");
  }
  return { source, body: JSON.stringify({ ac: aircraft }) };
}

type Upstream = [name: string, fetch: () => Promise<UpstreamResult>];

function buildUpstreams(query: PointQuery, env: Env): Upstream[] {
  const { latitude, longitude, radiusNm } = query;
  const hasOpenSkyCredentials = Boolean(
    env.OPENSKY_CLIENT_ID && env.OPENSKY_CLIENT_SECRET,
  );

  return [
    ...(hasOpenSkyCredentials
      ? [["opensky", () => fetchOpenSky(query, env, true)] satisfies Upstream]
      : []),
    [
      "adsb.lol",
      () =>
        fetchAdsb(
          "adsb.lol",
          `https://api.adsb.lol/v2/point/${latitude}/${longitude}/${radiusNm}`,
        ),
    ],
    [
      "adsb.fi",
      () =>
        fetchAdsb(
          "adsb.fi",
          `https://opendata.adsb.fi/api/v2/lat/${latitude}/lon/${longitude}/dist/${radiusNm}`,
        ),
    ],
    ...(hasOpenSkyCredentials
      ? []
      : [
          [
            "opensky-anonymous",
            () => fetchOpenSky(query, env, false),
          ] satisfies Upstream,
        ]),
  ];
}

async function handleRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const requestUrl = new URL(request.url);
  const pointMatch = POINT_PATH.exec(requestUrl.pathname);
  if (request.method !== "GET" || pointMatch === null) {
    return textResponse(400, "Unsupported flights request.");
  }

  const query: PointQuery = {
    latitude: Number(pointMatch[1]),
    longitude: Number(pointMatch[2]),
    radiusNm: Math.min(250, Math.max(1, Number(pointMatch[3]))),
  };

  const cacheKey = new Request(
    `https://dayboard-proxy.cache${requestUrl.pathname}`,
  );
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) {
    const hit = new Response(cached.body, cached);
    hit.headers.set("X-Cache", "HIT");
    return hit;
  }

  const failures: string[] = [];
  for (const [name, fetchUpstream] of buildUpstreams(query, env)) {
    let upstream: UpstreamResult;
    try {
      upstream = await fetchUpstream();
    } catch (error: unknown) {
      failures.push(`${name}: ${describeError(error)}`);
      continue;
    }

    if (failures.length > 0) {
      console.warn(`Served by ${name} after: ${failures.join("; ")}`);
    }

    const response = new Response(upstream.body, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
        "X-Cache": "MISS",
        "X-Upstream": upstream.source,
      },
    });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  }

  console.warn(`All upstreams failed: ${failures.join("; ")}`);
  return textResponse(
    503,
    `Flight data is temporarily unavailable. ${failures.join("; ")}`,
  );
}

export default {
  fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
