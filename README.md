# gpr-explorer-v2

Rebuilt front end for the GDELT geopolitical risk index — reads the **new**
`gpr-davidfr` export format (3 pillars, per-topic, per-source). Vite + React +
Recharts, static deploy.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

Data lives in `public/data/` (already populated). To regenerate after a new
backend build:

```bash
# from the gpr-davidfr backend repo:
python -m pipeline.cli export "../gpr-explorer-v2/public/data"
```

## Data it reads (new format)

- `index.json` — eager: dates, per-pillar ratios + dow-adjusted, composite, meta
  (display names, theme order, lifts, sources-by-country, flags).
- `combos_{military,economic,operational}.json` — lazy: per-pillar OR-combination
  counts for exact theme-subset recomputation.
- `source_cube.json` — lazy: per-source totals, pillar unions, and per-theme
  singles for all three pillars (source × topic).
- `events.json`, `periods.json` — annotations and preset windows.

## Structure (modular, data-driven)

```
src/
  lib/
    data.js      useData() — fetch + lazy-load hook
    engine.js    pure functions: ratios, smoothing, normalization, lift
    colors.js    pillar line colors
  components/
    Controls.jsx        pillar chips (all toggleable) · smoothing · scale · download
    IndexChart.jsx      hero chart · 3 pillar lines · drag-to-select window
    ReactivePanel.jsx   "what's driving this window": Topics / Sources / Pillars lift
    SourceSelector.jsx  full-row outlets · modern toggles · volume · flags
    CombineSliders.jsx  weighted multi-pillar blend
  App.jsx        orchestration + state
```

Constants (theme order, lifts, sources, display names) come from the data, not
hardcoded — so the site never drifts from the backend.

## What works in this v1

- 3 pillars as separate lines; toggle each on/off; isolate one → its per-theme
  lines appear.
- Smoothing window + normalization (raw / z / min–max / percentile).
- Drag a window on the chart (or click a preset) → lift vs the full-sample
  average, by topic / source / pillar.
- Per-source filtering (recomputes from the source cube); combine-pillars sliders;
  CSV download.

## Next (not yet built)

- Polish the brush UX (snap, keyboard); multi-window heatmap; log-ratio / CI lift
  options; advanced drawer (CI overlay, hourly demo); per-theme selection UI when
  a pillar is isolated.
