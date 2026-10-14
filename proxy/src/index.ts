/**
 * Dayboard flights proxy — Cloudflare Worker
 *
 *   Browser (Dayboard on GitHub Pages)
 *      │  GET /v2/point/{lat}/{lon}/{radiusNm}
 *      ▼
 *   Cloudflare Cache API  ← per-colo edge cache, 10 s
 *      │  MISS
 *      ▼
 *   api.adsb.lol
 *
 * adsb.lol sends no CORS headers, so the SPA cannot call it directly. The
 * worker forwards point queries only and adds permissive CORS headers.
 *
 * Positions change every few seconds, so there is no KV layer: the free KV
 * plan's 1,000 writes/day would run out within hours of polling.
 */

const UPSTREAM_ORIGIN = "https://api.adsb.lol";
// adsb.lol rejects generic user agents and asks for contact info.
const USER_AGENT =
  "dayboard-proxy (+https://github.com/vargamateistvan/dayboard)";
const POINT_PATH = /^\/v2\/point\/-?\d+(\.\d+)?\/-?\d+(\.\d+)?\/\d+$/;
const CACHE_SECONDS = 10;

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Expose-Headers": "X-Cache, Retry-After",
};

function textResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function handleRequest(
  request: Request,
  ctx: ExecutionContext,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const requestUrl = new URL(request.url);
  if (request.method !== "GET" || !POINT_PATH.test(requestUrl.pathname)) {
    return textResponse(400, "Unsupported flights request.");
  }

  const upstreamUrl = `${UPSTREAM_ORIGIN}${requestUrl.pathname}`;
  const cacheKey = new Request(upstreamUrl);
  const cache = caches.default;

  const cached = await cache.match(cacheKey);
  if (cached) {
    const hit = new Response(cached.body, cached);
    hit.headers.set("X-Cache", "HIT");
    return hit;
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
  } catch (error: unknown) {
    return textResponse(
      502,
      error instanceof Error ? error.message : "Upstream request failed.",
    );
  }

  const headers = new Headers(CORS_HEADERS);
  headers.set(
    "Content-Type",
    upstream.headers.get("content-type") ?? "application/json",
  );
  headers.set("Cache-Control", `public, max-age=${CACHE_SECONDS}`);
  headers.set("X-Cache", "MISS");
  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) {
    headers.set("Retry-After", retryAfter);
  }

  const response = new Response(upstream.body, {
    status: upstream.status,
    headers,
  });

  if (upstream.ok) {
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  }
  return response;
}

export default {
  fetch(request, _env, ctx) {
    return handleRequest(request, ctx);
  },
} satisfies ExportedHandler;
