# Dayboard — Flights Proxy (Cloudflare Worker)

A Cloudflare Worker that proxies [adsb.lol](https://api.adsb.lol) point queries for the Flights widget. adsb.lol is free, needs no API key and has no daily quota, but it sends no CORS headers, so the GitHub Pages build cannot call it directly.

## How it works

```
Browser (Dayboard on GitHub Pages)
    │  GET /v2/point/{lat}/{lon}/{radiusNm}
    ▼
Cloudflare Worker (this project)
    │  Cache API HIT  → cached JSON (10 s)
    │  Cache API MISS → fetch from api.adsb.lol, cache, return
    ▼
api.adsb.lol
```

- Only `/v2/point/...` requests are forwarded; anything else returns `400`.
- Every response carries `Access-Control-Allow-Origin: *` and an `X-Cache: HIT | MISS` header.
- There is no KV layer: positions change every few seconds, and the free KV plan's 1,000 writes/day would run out quickly.
- adsb.lol rejects generic user agents, so the worker sends one that names this repo.

---

## One-time setup

### 1 — Log in to Cloudflare

```bash
cd proxy
yarn install
yarn wrangler login   # opens browser → Cloudflare OAuth
```

### 2 — Deploy

```bash
yarn deploy
# → Deployed to https://dayboard-proxy.<your-subdomain>.workers.dev
```

The `workers.dev` subdomain is free and assigned to your Cloudflare account; no custom domain is needed.

### 3 — Point the app at the proxy

Add `VITE_FLIGHTS_API_BASE` as a repository secret (**Settings → Secrets and variables → Actions**):

```env
VITE_FLIGHTS_API_BASE=https://dayboard-proxy.<your-subdomain>.workers.dev
```

`.github/workflows/deploy.yml` passes it to the build. Without it, the app falls back to the public `allorigins.win` proxy, which is often rate-limited.

For local testing against the worker, put the same line (or `http://localhost:8787`) in the app's `.env.local`.

---

## Local development

```bash
cd proxy
yarn dev          # wrangler dev → http://localhost:8787
curl http://localhost:8787/v2/point/47.4979/19.0402/27
```

The app's own dev server already proxies `/api/flights` to adsb.lol, so this is only needed when changing the worker.

---

## Automated deployment (GitHub Actions)

`.github/workflows/deploy-proxy.yml` deploys the worker whenever files under `proxy/` change on `main` (or when run manually).

Add two secrets to the GitHub repository (**Settings → Secrets and variables → Actions**):

| Secret | Where to get it |
|--------|----------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → right sidebar of any Workers page |

---

## Free tier limits

| Resource | Free allowance | Notes |
|----------|---------------|-------|
| Worker requests | 100,000 / day | One dashboard polling every 10 s uses ~8,640/day |
| Cache API | Unlimited | Per-colo; viewers near each other share hits |
