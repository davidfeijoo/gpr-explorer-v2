# gpr-explorer-v2

Interactive front end for the GDELT-based geopolitical risk index, live at
**[davidfeijoo.com/gpr-explorer](https://davidfeijoo.com/gpr-explorer)**.

The data is produced by the pipeline repository
**[gpr-davidfr](https://github.com/davidfeijoo/gpr-davidfr)**, which also
documents the methodology, installation and how to build your own variant of the
index. This repo only displays the JSON that pipeline exports (3 pillars,
per-topic, per-source). Vite + React + Recharts, static deploy.

## Run

```bash
npm install
npm run dev        # http://localhost:5173/gpr-explorer/
npm run build      # static site in dist/
```

The app is served under `/gpr-explorer/` (`base` in `vite.config.js`); change
that if you host it elsewhere. The live site is deployed on Vercel from this
repository.

Data lives in `public/data/` (already populated). To regenerate it after a new
pipeline build, clone both repos side by side and run:

```bash
# from the gpr-davidfr repo:
python -m pipeline.cli export ../gpr-explorer-v2/public/data
```

To use your own variant of the index, build it with the pipeline and export into
`public/data/`. Tags, pillars, sources and display names are read from the data,
so no front-end code needs to change.

## Data it reads (new format)

- `index.json` — eager: dates, per-pillar ratios + dow-adjusted, composite, meta
  (display names, theme order, lifts, sources-by-country, flags).
- `combos_{military,economic,operational}.json` — lazy: per-pillar OR-combination
  counts for exact theme-subset recomputation.
- `source_cube.json` — lazy: per-source totals, pillar unions, and per-theme
  singles for all three pillars (source × topic).
- `source_patterns_index.json` + `source_patterns/<source>.json` — lazy, per
  outlet: tag-combination histograms for exact equal-weight recomputation of
  any topic selection × source selection.
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

## Citation and license

If you use the index or this site, please cite it as described in the
[gpr-davidfr README](https://github.com/davidfeijoo/gpr-davidfr#citation) and
link to [davidfeijoo.com/gpr-explorer](https://davidfeijoo.com/gpr-explorer).

Code released under the [MIT License](LICENSE).
