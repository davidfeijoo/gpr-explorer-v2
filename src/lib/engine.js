// Pure analytical engine for the GPR explorer. No React, no DOM — all functions
// take plain data (the new web_export JSON shapes) and return arrays/objects, so
// they're easy to reason about and unit-test.
//
// Data shapes (from pipeline/export.py):
//   index.json        { meta:{displayNames,pillars{p:{themeOrder,tagDisplayNames}},start,end,n},
//                       dates[], total[], ratios{p[]}, ratiosDow{p[]}, composite[], avgNegative[] }
//   combos_<p>.json   { meta:{themeOrder,n}, total[], or:{ "<mask>": [] } }
//   source_cube.json  { sources[], total:{src[]}, unions:{p:{src[]}}, singles:{p:{theme:{src[]}}} }

export const PILLARS = ["military", "economic", "operational"];

// ── bitmask over a pillar's theme order ───────────────────────────────────────
export function themeMask(selected, order) {
  let m = 0;
  order.forEach((t, i) => { if (selected.includes(t)) m |= 1 << i; });
  return m;
}

// ── transforms ────────────────────────────────────────────────────────────────
// null-aware: gaps (null/NaN) are skipped, not counted — equal-weight series can
// have gaps on days where no selected source clears its floor.
const isNum = (v) => v != null && !Number.isNaN(v);

export function rollMean(arr, w) {
  if (!w || w <= 1) return arr.slice();
  const n = arr.length, out = new Array(n);
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - w + 1);
    let a = 0, c = 0;
    for (let j = lo; j <= i; j++) { const v = arr[j]; if (isNum(v)) { a += v; c++; } }
    out[i] = c ? a / c : null;
  }
  return out;
}

export function normalize(arr, mode) {
  if (mode === "z") {
    const f = arr.filter(isNum), n = f.length || 1;
    const m = f.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(f.reduce((a, b) => a + (b - m) ** 2, 0) / n) || 1;
    return arr.map((x) => (isNum(x) ? (x - m) / sd : null));
  }
  if (mode === "minmax") {
    const f = arr.filter(isNum);
    const mn = Math.min(...f), mx = Math.max(...f);
    return arr.map((x) => (isNum(x) ? ((x - mn) / (mx - mn || 1)) * 100 : null));
  }
  if (mode === "pct") {
    const sorted = arr.filter(isNum).sort((a, b) => a - b);
    const n = sorted.length || 1;
    return arr.map((x) => {
      if (!isNum(x)) return null;
      let lo = 0, hi = sorted.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] <= x) lo = mid + 1; else hi = mid; }
      return (lo / n) * 100;
    });
  }
  return arr.slice();
}

// ── equal-weight aggregation from per-source pattern histograms ────────────────
// Each source counts equally on days it clears its floor (≈ FLOOR_FRAC × its
// median daily volume); below-floor days drop out of that day's mean. This is the
// site's default aggregation — composition-robust, so a source going quiet doesn't
// drag the level the way volume-weighting (pooled) would.
export const FLOOR_FRAC = 0.5;

// Prepare a loaded per-source pattern file into fast typed structures (once).
//   obj: { total:{d,n}, patterns:{pillar:{d,p,n}} }   (columnar, dateIdx = d)
export function preparePatternSource(obj, N, median) {
  const totalDense = new Float64Array(N);
  const td = obj.total.d, tn = obj.total.n;
  for (let k = 0; k < td.length; k++) totalDense[td[k]] = tn[k];
  const byPillar = {};
  for (const p in obj.patterns) {
    const g = obj.patterns[p];
    byPillar[p] = { d: Int32Array.from(g.d), p: Int32Array.from(g.p), n: Int32Array.from(g.n) };
  }
  return { totalDense, byPillar, floor: FLOOR_FRAC * (median || 0) };
}

// Equal-weight ratio series for a topic `mask` over `sources`, N dates.
// Per date: mean over active sources of union(mask)/total, where
//   union(mask) = Σ n over the source's patterns p with (p & mask) != 0.
// Returns null on days where no selected source is active (a gap in the line).
export function equalWeightSeries(pat, sources, pillar, mask, N) {
  if (!mask) return new Array(N).fill(0);
  const sum = new Float64Array(N), cnt = new Int32Array(N);
  const uni = new Float64Array(N);
  for (const s of sources) {
    const P = pat[s]; if (!P) continue;
    const tot = P.totalDense, floor = P.floor;
    uni.fill(0);
    const g = P.byPillar[pillar];
    if (g) { const d = g.d, pp = g.p, nn = g.n, L = d.length;
      for (let k = 0; k < L; k++) if ((pp[k] & mask) !== 0) uni[d[k]] += nn[k]; }
    for (let i = 0; i < N; i++) { const t = tot[i]; if (t > 0 && t >= floor) { sum[i] += uni[i] / t; cnt[i]++; } }
  }
  const out = new Array(N);
  for (let i = 0; i < N; i++) out[i] = cnt[i] ? sum[i] / cnt[i] : null;
  return out;
}

// ── day-of-week de-seasonalization (trailing 17-week window, causal) ─────────
// Applied client-side (the pipeline publishes unadjusted ratios). For each day,
// the weekday factor = (mean of that weekday over the previous 119 days) ÷
// (mean of all days over the previous 119 days), clipped to [0.5, 2], divided
// out. 119 days = 17 whole weeks, so every weekday appears equally often in
// the window. STRICTLY TRAILING -> causal: adjusted values never revise.
// Head of sample (first 119 days): factors from the FIRST quarter of data
// (fixed historical initialization — that period is never served in real time).
// NOTE: redundant on smoothed views (7/14/28d MAs already cancel the weekly
// cycle); only applied to the raw daily view.
export function dowAdjust(series, dates, clip = [0.5, 2]) {
  const n = series.length;
  if (!n || !dates || dates.length !== n) return series.slice();
  const W = 119;                                    // 17 whole weeks
  const w = (d) => new Date(d + "T00:00:00Z").getUTCDay();
  const wd = new Array(n);
  for (let i = 0; i < n; i++) wd[i] = w(dates[i]);
  const [lo, hi] = clip, out = new Array(n);

  // head factors: from the first calendar quarter (~first 90 valid days)
  const headS = new Array(7).fill(0), headC = new Array(7).fill(0);
  let headSum = 0, headCnt = 0;
  for (let i = 0; i < Math.min(n, 90); i++) {
    const v = series[i]; if (v == null || Number.isNaN(v)) continue;
    headS[wd[i]] += v; headC[wd[i]]++; headSum += v; headCnt++;
  }
  const headMean = headCnt ? headSum / headCnt : 0;
  const headF = headS.map((s2, k) =>
    headC[k] && headMean ? Math.min(hi, Math.max(lo, (s2 / headC[k]) / headMean)) : 1);

  // rolling trailing sums over the previous W days (exclusive of today)
  const rs = new Array(7).fill(0), rc = new Array(7).fill(0);
  let rSum = 0, rCnt = 0;
  for (let i = 0; i < n; i++) {
    let f = 1;
    if (i < W) {
      f = headF[wd[i]];
    } else {
      const rm = rCnt ? rSum / rCnt : 0;
      f = rc[wd[i]] && rm ? (rs[wd[i]] / rc[wd[i]]) / rm : 1;
      f = Math.min(hi, Math.max(lo, f));
    }
    const v = series[i];
    out[i] = (v == null || Number.isNaN(v)) ? v : v / f;
    // push today into the window, pop the day falling out (i - W + 1 .. i kept)
    const vi = series[i];
    if (vi != null && !Number.isNaN(vi)) { rs[wd[i]] += vi; rc[wd[i]]++; rSum += vi; rCnt++; }
    const j = i - W + 1 - 1;                        // index leaving the trailing window
    if (j >= 0) {
      const vj = series[j];
      if (vj != null && !Number.isNaN(vj)) { rs[wd[j]] -= vj; rc[wd[j]]--; rSum -= vj; rCnt--; }
    }
  }
  return out;
}

// ── pillar ratio for a selected theme subset (from a pillar's combos file) ────
// Falls back to the eager index.ratios[pillar] until the combos file has loaded
// or when every theme is selected.
export function pillarRatio(pillar, selected, combos, index) {
  const order = index.meta.pillars[pillar].themeOrder;
  const sel = selected.filter((t) => order.includes(t));
  const n = index.total.length;
  if (sel.length === 0) return new Array(n).fill(0);
  const full = (1 << order.length) - 1;
  const mask = themeMask(sel, order);
  if (mask === full || !combos) return index.ratios[pillar].slice();
  const orArr = combos.or[String(mask)];
  if (!orArr) return index.ratios[pillar].slice();
  return orArr.map((o, i) => (index.total[i] > 0 ? o / index.total[i] : 0));
}

// per-source: pillar union over a chosen set of outlets / their total
export function sourceRatio(sourceCube, pillar, selectedSources) {
  const srcs = selectedSources.filter((s) => sourceCube.total[s]);
  if (!srcs.length) return null;
  const n = sourceCube.total[srcs[0]].length;
  const num = new Array(n).fill(0), den = new Array(n).fill(0);
  for (const s of srcs) {
    const t = sourceCube.total[s], u = sourceCube.unions[pillar][s];
    for (let i = 0; i < n; i++) { den[i] += t[i]; num[i] += u[i]; }
  }
  return den.map((d, i) => (d > 0 ? num[i] / d : 0));
}

// ── period selection ──────────────────────────────────────────────────────────
export function dateRangeToIndices(dates, startStr, endStr) {
  let lo = dates.findIndex((d) => d >= startStr);
  let hi = dates.length - 1;
  for (let i = dates.length - 1; i >= 0; i--) { if (dates[i] <= endStr) { hi = i; break; } }
  if (lo < 0) lo = 0;
  return [lo, Math.max(lo, hi)];
}

const sumRange = (arr, [lo, hi]) => { let s = 0; for (let i = lo; i <= hi; i++) s += arr[i]; return s; };

// ── lift: prevalence in a window vs the full-sample average ───────────────────
// Returns [{ key, lift }] sorted by |lift| desc. baseline = whole series.
function lift(seriesByKey, total, win) {
  const totWin = sumRange(total, win);
  const totAll = total.reduce((a, b) => a + b, 0);
  const out = [];
  for (const [key, s] of Object.entries(seriesByKey)) {
    const pWin = totWin > 0 ? sumRange(s, win) / totWin : 0;
    const pAll = totAll > 0 ? s.reduce((a, b) => a + b, 0) / totAll : 0;
    out.push({ key, lift: pAll > 0 ? pWin / pAll - 1 : 0, pWin, pAll });
  }
  return out.sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift));
}

export function liftTopics(pillar, combos, index, win) {
  const order = index.meta.pillars[pillar].themeOrder;
  if (!combos) return [];
  const byTheme = {};
  order.forEach((t, i) => { byTheme[t] = combos.or[String(1 << i)]; });
  return lift(byTheme, combos.total, win);
}

// Topics across several pillars at once, each tagged with its pillar (for the
// color-dot legend). Skips pillars whose combos haven't loaded yet.
export function liftTopicsMulti(pillars, combosMap, index, win) {
  const out = [];
  for (const p of pillars) {
    const c = combosMap[p];
    if (!c) continue;
    const order = index.meta.pillars[p].themeOrder;
    const totWin = sumRange(c.total, win);
    const totAll = c.total.reduce((a, b) => a + b, 0);
    order.forEach((t, i) => {
      const s = c.or[String(1 << i)];
      const pWin = totWin > 0 ? sumRange(s, win) / totWin : 0;
      const pAll = totAll > 0 ? s.reduce((a, b) => a + b, 0) / totAll : 0;
      out.push({ key: t, pillar: p, lift: pAll > 0 ? pWin / pAll - 1 : 0 });
    });
  }
  return out.sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift));
}

export function liftSources(pillar, sourceCube, win) {
  const bySrc = {};
  for (const s of sourceCube.sources) bySrc[s] = sourceCube.unions[pillar][s];
  // baseline denominator is per-source total, so compute lift per source individually
  return sourceCube.sources.map((s) => {
    const tot = sourceCube.total[s];
    const totWin = sumRange(tot, win), totAll = tot.reduce((a, b) => a + b, 0);
    const u = sourceCube.unions[pillar][s];
    const pWin = totWin > 0 ? sumRange(u, win) / totWin : 0;
    const pAll = totAll > 0 ? u.reduce((a, b) => a + b, 0) / totAll : 0;
    return { key: s, lift: pAll > 0 ? pWin / pAll - 1 : 0 };
  }).sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift));
}

// ── equal-weight lift (matches the equal-weight index) ────────────────────────
// Prevalence = the equal-weight ratio averaged over the window vs the whole
// sample (null days skipped), so the ranking reflects the same aggregation the
// chart shows rather than the volume-weighted (pooled) combos.
const meanRange = (arr, lo, hi) => { let s = 0, c = 0; for (let i = lo; i <= hi; i++) { const v = arr[i]; if (isNum(v)) { s += v; c++; } } return c ? s / c : 0; };
const meanAll = (arr) => { let s = 0, c = 0; for (const v of arr) if (isNum(v)) { s += v; c++; } return c ? s / c : 0; };

// Per single topic (across `pillars`), equal-weight over `sources`.
export function liftTopicsEW(patterns, sources, pillars, index, win, N) {
  const out = [];
  for (const p of pillars) {
    index.meta.pillars[p].themeOrder.forEach((t, i) => {
      const s = equalWeightSeries(patterns, sources, p, 1 << i, N);
      const pWin = meanRange(s, win[0], win[1]), pAll = meanAll(s);
      out.push({ key: t, pillar: p, lift: pAll > 0 ? pWin / pAll - 1 : 0 });
    });
  }
  return out.sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift));
}

// Per source, its own ratio (union(mask)/total) window-mean vs all-mean.
export function liftSourcesEW(patterns, sources, pillar, mask, win, N) {
  const out = [];
  for (const s of sources) {
    if (!patterns[s]) continue;
    const r = equalWeightSeries(patterns, [s], pillar, mask, N);   // single source == its own floored ratio
    const pWin = meanRange(r, win[0], win[1]), pAll = meanAll(r);
    out.push({ key: s, lift: pAll > 0 ? pWin / pAll - 1 : 0 });
  }
  return out.sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift));
}

export function liftPillars(index, win) {
  return PILLARS.map((p) => {
    const r = index.ratios[p];
    const mWin = (sumRange(r, win)) / (win[1] - win[0] + 1);
    const mAll = r.reduce((a, b) => a + b, 0) / r.length;
    return { key: p, lift: mAll > 0 ? mWin / mAll - 1 : 0 };
  }).sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift));
}

// ── summary stats for a displayed series ──────────────────────────────────────
export function statsOf(vals) {
  const n = vals.length;
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  let mi = 0; for (let i = 1; i < n; i++) if (vals[i] > vals[mi]) mi = i;
  return { latest: vals[n - 1], mean, std, max: vals[mi], maxIdx: mi };
}
