# KASHTA | كشتة

An Arabic-first desert night planner for Riyadh. KASHTA compares real forecasts of
temperature, wind, rain, cloud, dust and moonlight for official camping sites around Riyadh,
ranks the next seven nights with a transparent **Kashta Score**, shows camping-permit
information with its official source, and uses **Meta Llama 4 Scout** to read trip descriptions
and explain the results.

Built for Project 4 (Meta × Startupbootcamp × Tuwaiq Academy), with Llama as its primary AI
model. Deployment and provider credentials are the remaining operator steps.

## What it does

| Page | What you can do |
| --- | --- |
| `/` | Live “this week around Riyadh” strip (best scored site when data is complete), how scoring works, the site list, permit overview, FAQ |
| `/plan` | Describe your trip in your own words → Llama turns it into settings (editable, marked “set by Llama”) → ranked nights, score breakdown, every-night matrix, Llama explanation |
| `/destinations` | Filter and sort the 14 destinations |
| `/destinations/[slug]` | 7-night forecast tiles, hourly chart (+ data table), Kashta Score and stargazing suitability, moon phase, permit panel with source and check date, verified facts, map links, packing checklist saved on the device, Llama explanation and extra packing items |
| `/stars` | Star Hunter: nights ranked for stargazing (clouds, moon, dust, wind) with moon phase and dark window |
| `/about` | Formula, thresholds and weights, data sources, what Llama does, privacy, photo credits |

Arabic (RTL) is the default; an English switch in the header stores the choice in a cookie.

## How it works

```
browser ──► /api/plan, /api/forecast ──► Open-Meteo Forecast + Air Quality (one multi-location call each, cached 30 min)
                    │                    └► SunCalc (moon, dusk, dawn: computed locally)
                    └► lib/score.ts  — deterministic Kashta Score (no AI)
browser ──► /api/ai/interpret ──► Llama ──► Zod schema ──► editable settings
browser ──► /api/ai/explain   ──► server recomputes the forecast, sends only those facts to Llama
                                  ──► Zod schema ──► number guard ──► alternative must be a real candidate
```

* **Scores are code, not AI.** `src/lib/score.ts` maps each measurement onto 0–100 with straight-line
  limits, weights them by experience (kashta or stars) and your priorities, caps the score at 35
  when one condition is dangerous, and returns *no number* when data is missing (shown as “incomplete”).
* **Llama is checked before anything is shown.** Replies must parse as JSON and pass a Zod schema;
  unknown fields are dropped; dates outside the 7-day window are discarded; any sentence quoting a
  number that is not in the forecast we sent is removed (`src/lib/ai-guards.ts`); an “alternative”
  must be one of the candidates the server supplied. Llama never decides permits or invents site facts.
* **No mock AI.** Without credentials the AI routes answer `ai_not_configured` and the UI says so.

## Data and sources

* **Destinations** (`src/lib/destinations.ts`): the 13 Riyadh-region sites in the NCVC *Camping and
  Caravan Guide in Vegetation Cover Areas 2025* (names, governorates, capacities and the entry-point
  map links published in the guide), plus Rawdat Khuraim, whose camping rules we could not confirm
  (status “غير مؤكد / unverified”). Checked 2026-11-02; re-check each season.
* **Permit status**: copied by hand from the official guide, with source URL and check date. There is
  no live permit API; the app links to the Nabati platform (https://nabati.ncvc.gov.sa) to apply.
* **Weather**: [Open-Meteo](https://open-meteo.com) Forecast and Air Quality (CAMS) APIs — free for
  non-commercial use, data CC BY 4.0, attribution shown in the footer and on every forecast.
  Forecast weather covers seven full nights, but the public air-quality forecast is shorter. Nights
  without enough dust data show an incomplete assessment instead of a fabricated Kashta Score.
* **Moon and twilight**: [SunCalc](https://github.com/mourner/suncalc).
* **Photographs**: Wikimedia Commons under CC0 / public domain / CC BY / CC BY-SA, listed in
  `public/photos/credits.json` and on `/about#credits`. They illustrate the region's terrain and are
  captioned with where they were really taken; they are not photos of the listed sites.
* **Distances**: straight line × 1.3 at 90 km/h — labelled as an estimate everywhere.
* Light pollution is **not** measured (no reliable source); the app says so.

## Tech stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS 4 · Zod 4 · SunCalc ·
lucide-react · IBM Plex Sans Arabic (`next/font`). No database: destinations are a typed local
dataset, preferences and checklist ticks live in `localStorage`.

## Run locally

Requires Node.js 20.9+ (tested on Node 24).

```bash
npm install
cp .env.example .env.local   # add Llama credentials before testing the required AI features
npm run dev                  # http://localhost:3000
```

### Llama credentials

Default: **Cloudflare Workers AI** with `@cf/meta/llama-4-scout-17b-16e-instruct`
(free allocation of 10,000 Neurons per day).

1. In the Cloudflare dashboard copy your **Account ID**.
2. Create an API token with the **Workers AI** permission.
3. Set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`.

Alternative: `LLAMA_PROVIDER=openrouter` + `OPENROUTER_API_KEY` (model `meta-llama/llama-4-scout`).
Llama 4 Scout is used because Arabic is one of its officially supported languages.

## Scripts

```bash
npm run lint        # ESLint (next/core-web-vitals + TypeScript)
npm run typecheck   # tsc --noEmit
npm test            # node:test unit tests (score, nights, AI guards, data, validation, checklist)
npm run build       # production build
npm start           # serve the production build
```

## Deploy (Vercel)

1. Push the repository to GitHub (or GitLab/Bitbucket).
2. In Vercel: **Add New → Project**, import the repository. Framework preset: Next.js (defaults are fine:
   `npm run build`, output managed by Next).
3. **Settings → Environment Variables**: add `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`
   (or the OpenRouter variables) for Production and Preview.
4. Deploy, then open `/api/ai/status` — it should return `"configured": true`.

Notes: Open-Meteo's free tier is for non-commercial use (10,000 calls/day; shared hosting IPs can hit
limits sooner) — responses are cached for 30 minutes and each plan costs two upstream calls.
For commercial use, subscribe to Open-Meteo or self-host it and set `OPEN_METEO_FORECAST_URL` /
`OPEN_METEO_AIR_URL`.

## Project structure

```
src/app/                 pages and API route handlers (api/plan, api/forecast, api/ai/*)
src/components/          UI (planner, destination forecast, checklist, star hunter, charts)
src/lib/destinations.ts  verified destination dataset and permit records
src/lib/weather.ts       Open-Meteo client (timeouts, rate limits, missing data)
src/lib/nights.ts        night windows, coverage rules, moon and twilight
src/lib/score.ts         Kashta Score
src/lib/llm.ts           Llama client (Cloudflare Workers AI / OpenRouter)
src/lib/ai-guards.ts     JSON extraction and the number-grounding guard
src/lib/i18n.ts          Arabic and English copy
tests/                   unit tests
```
