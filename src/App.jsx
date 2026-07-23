import { useEffect, useMemo, useState } from "react";
import { X, Pin } from "lucide-react";
import { useData } from "./lib/data.js";
import {
  PILLARS, rollMean, normalize, dowAdjust, sourceRatio, dateRangeToIndices,
  liftTopicsMulti, liftSources, liftTopicsEW, liftSourcesEW, themeMask, equalWeightSeries,
} from "./lib/engine.js";
import { PILLAR_COLOR } from "./lib/colors.js";
import { sourceName } from "./lib/sources.js";
import Controls from "./components/Controls.jsx";
import PillarPanel from "./components/PillarPanel.jsx";
import IndexChart from "./components/IndexChart.jsx";
import PillarSentiment from "./components/PillarSentiment.jsx";
import ReactivePanel from "./components/ReactivePanel.jsx";
import SourceSelector from "./components/SourceSelector.jsx";
import CombineSliders from "./components/CombineSliders.jsx";

const THEME_PAL = ["#4d8dff", "#a779ff", "#2dd4bf", "#f4a23f", "#ef5da8",
  "#3ddc84", "#ffd54f", "#ff7043", "#5fd0e6"];

export default function App() {
  const { index, events, periods, combos, sourceCube, patIndex, patterns,
          error, loadCombos, loadSourceCube, loadPatterns } = useData();

  const [active, setActive] = useState([...PILLARS]);
  const [themeSel, setThemeSel] = useState(null);
  const [window, setWindow] = useState(14);
  const [norm, setNorm] = useState("raw");
  const [combine, setCombine] = useState(false);
  const [weights, setWeights] = useState({ military: 100, economic: 100, operational: 100 });
  const [selWindow, setSelWindow] = useState(null);
  const [activePreset, setActivePreset] = useState(null);
  const [tab, setTab] = useState("topics");
  const [selectedSources, setSelectedSources] = useState(null);
  const [viewMode, setViewMode] = useState("pillars");   // "pillars" | "topics"
  const [topicPillar, setTopicPillar] = useState("military");
  const [pins, setPins] = useState([]);                  // frozen snapshots for comparison

  const focusPillar = viewMode === "topics" ? topicPillar : null;
  const liftPillar = focusPillar || (viewMode === "sentiment" ? topicPillar : active[0]) || "military";
  const displayNames = index?.meta?.displayNames || {};

  useEffect(() => {
    if (index && !themeSel) {
      const s = {}; PILLARS.forEach((p) => { s[p] = [...index.meta.pillars[p].themeOrder]; });
      setThemeSel(s);
    }
  }, [index, themeSel]);
  // equal-weight (the default) reads every source's patterns — load them all in the
  // background once index + pattern-index are ready; cached, so this is a one-time cost.
  useEffect(() => { if (index && patIndex) loadPatterns(patIndex.sources); }, [index, patIndex, loadPatterns]);
  useEffect(() => { if (focusPillar) loadCombos(focusPillar); }, [focusPillar, loadCombos]);
  useEffect(() => { if (selWindow) { active.forEach(loadCombos); loadSourceCube(); } }, [selWindow, active, loadCombos, loadSourceCube]);
  // a pillar's combos are needed the moment its topic selection is a proper subset (OR-mask lookup)
  useEffect(() => {
    if (!index || !themeSel) return;
    active.forEach((p) => {
      const n = index.meta.pillars[p].themeOrder.length;
      const k = themeSel[p] ? themeSel[p].length : 0;
      if (k > 0 && k < n) loadCombos(p);
    });
  }, [index, themeSel, active, loadCombos]);

  // the source universe is the set we actually have patterns for (index of 82),
  // not the raw config list — so "some deselected" is size < that count
  const srcCount = patIndex ? patIndex.sources.length : (sourceCube ? sourceCube.sources.length : null);
  const sourceFiltered = !!(selectedSources && srcCount != null && selectedSources.size < srcCount);
  const toggleP = (p) => {
    if (active.includes(p)) { setActive((a) => a.filter((x) => x !== p)); return; }
    setActive((a) => [...a, p]);
    if ((themeSel?.[p] || []).length === 0)                              // turning an empty pillar on -> restore its topics
      setThemeSel((s) => ({ ...s, [p]: [...index.meta.pillars[p].themeOrder] }));
  };
  const toggleTopic = (p, t) => {
    const next = themeSel[p].includes(t) ? themeSel[p].filter((x) => x !== t) : [...themeSel[p], t];
    setThemeSel((s) => ({ ...s, [p]: next }));
    if (next.length === 0) setActive((a) => a.filter((x) => x !== p));    // last topic off -> deactivate the pillar
  };
  const allTopics = (p, on) => {
    setThemeSel((s) => ({ ...s, [p]: on ? [...index.meta.pillars[p].themeOrder] : [] }));
    setActive((a) => on ? (a.includes(p) ? a : [...a, p]) : a.filter((x) => x !== p));  // All -> activate pillar, None -> deactivate
  };

  // selection helpers — manual drag clears any active preset
  const pickPreset = (i, p) => { setSelWindow([p.start, p.end]); setActivePreset(i); };
  const pickDrag = (a, b) => { setSelWindow([a, b]); setActivePreset(null); };
  const clearSel = () => { setSelWindow(null); setActivePreset(null); };

  const built = useMemo(() => {
    if (!index || !themeSel) return { points: [], lines: [] };
    const n = index.dates.length;
    const ms = index.dates.map((d) => Date.parse(d + "T00:00:00Z"));
    const proc = (s) => normalize(rollMean(dowAdjust(s, index.dates), window), norm);

    // equal-weight over the selected sources (default = all) once their patterns are
    // loaded; until then, the pooled index/combos/source-cube path is the fallback.
    const ewSrcs = sourceFiltered ? [...selectedSources] : (patIndex ? patIndex.sources : []);
    const ewOk = !!(patIndex && ewSrcs.length && ewSrcs.every((s) => patterns[s] || !patIndex.file[s]));
    const orderOf = (p) => index.meta.pillars[p].themeOrder;
    const ratio = (p, mask) => {
      if (ewOk) return equalWeightSeries(patterns, ewSrcs, p, mask, n);
      const full = (1 << orderOf(p).length) - 1;
      if (sourceFiltered) return sourceRatio(sourceCube, p, ewSrcs) || index.ratios[p];
      if (mask === full || !combos[p]) return index.ratios[p];
      const orArr = combos[p].or[String(mask)];
      return orArr ? orArr.map((o, i) => (index.total[i] > 0 ? o / index.total[i] : 0)) : index.ratios[p];
    };
    const pSeries = (p) => ratio(p, themeMask(themeSel[p], orderOf(p)));

    const series = {}; const lines = []; const act = active;
    const noSources = selectedSources && selectedSources.size === 0;   // user deselected every source

    if (noSources) {
      // nothing selected -> render an empty chart (no index lines)
    } else if (combine && !focusPillar && act.length) {
      const wsum = act.reduce((a, p) => a + (weights[p] || 0), 0) || 1;
      const b = new Array(n).fill(0);
      act.forEach((p) => { const r = pSeries(p); for (let i = 0; i < n; i++) b[i] += (weights[p] || 0) * (r[i] ?? 0); });
      for (let i = 0; i < n; i++) b[i] /= wsum;
      series.composite = proc(b); lines.push({ key: "composite", color: "#9aa6b4", name: "Composite" });
    } else if (focusPillar) {
      series[focusPillar] = proc(pSeries(focusPillar));
      lines.push({ key: focusPillar, color: PILLAR_COLOR[focusPillar], name: displayNames[focusPillar] || focusPillar });
      const tdn = index.meta.pillars[focusPillar].tagDisplayNames || {};
      orderOf(focusPillar).forEach((th, ti) => {
        if (!themeSel[focusPillar].includes(th)) return;
        const key = "th_" + th; series[key] = proc(ratio(focusPillar, 1 << ti));
        lines.push({ key, color: THEME_PAL[ti % THEME_PAL.length], name: tdn[th] || th, faint: true });
      });
    } else {
      act.forEach((p) => { series[p] = proc(pSeries(p)); lines.push({ key: p, color: PILLAR_COLOR[p], name: displayNames[p] || p }); });
    }
    const points = ms.map((t, i) => { const o = { t }; for (const k in series) o[k] = series[k][i]; return o; });
    return { points, lines };
  }, [index, themeSel, active, window, norm, combine, weights, focusPillar, combos, sourceCube, selectedSources, sourceFiltered, displayNames, patIndex, patterns]);

  const liftData = useMemo(() => {
    if (!index || !selWindow) return { topics: [], sources: [] };
    const N = index.dates.length;
    const win = dateRangeToIndices(index.dates, selWindow[0], selWindow[1]);
    const liftPillars = focusPillar ? [focusPillar] : (viewMode === "sentiment" ? [topicPillar] : active);
    const nameTopic = (r) => ({ ...r, label: index.meta.pillars[r.pillar]?.tagDisplayNames?.[r.key] || r.key });

    // equal-weight lift over the selected sources (topics) / all sources (sources),
    // matching the equal-weight index — fall back to pooled combos/cube until loaded.
    const ewSrcs = sourceFiltered ? [...selectedSources] : (patIndex ? patIndex.sources : []);
    const allSrcs = patIndex ? patIndex.sources : [];
    const ewOk = !!(patIndex && ewSrcs.length && ewSrcs.every((s) => patterns[s] || !patIndex.file[s]));
    const allOk = !!(allSrcs.length && allSrcs.every((s) => patterns[s]));

    const topics = ewOk
      ? liftTopicsEW(patterns, ewSrcs, liftPillars, index, win, N).map(nameTopic)
      : liftTopicsMulti(liftPillars, combos, index, win).map(nameTopic);

    let sources;
    if (allOk && themeSel) {
      const order = index.meta.pillars[liftPillar].themeOrder;
      const mask = themeMask(themeSel[liftPillar], order);
      sources = liftSourcesEW(patterns, allSrcs, liftPillar, mask, win, N).map((r) => ({ ...r, label: sourceName(r.key) }));
    } else {
      sources = sourceCube ? liftSources(liftPillar, sourceCube, win).map((r) => ({ ...r, label: sourceName(r.key) })) : [];
    }
    return { topics, sources };
  }, [index, selWindow, active, focusPillar, liftPillar, combos, sourceCube, patIndex, patterns, sourceFiltered, selectedSources, themeSel]);

  const countries = useMemo(() => {
    if (!index) return [];
    const byC = index.meta.sourcesByCountry || {};
    const stateSet = new Set(Object.values(index.meta.stateMedia || {}).flat());
    // a source that appears under two countries in config shows only in the first,
    // so toggling one country can't silently flip another (dw.com, aljazeera.com)
    const dataSet = patIndex ? new Set(patIndex.sources) : (sourceCube ? new Set(sourceCube.sources) : null);
    let vol = {}, maxVol = 1;
    if (sourceCube) { for (const s of sourceCube.sources) vol[s] = sourceCube.total[s].reduce((a, b) => a + b, 0); maxVol = Math.max(1, ...Object.values(vol)); }
    else if (patIndex) { vol = patIndex.medianVolume || {}; maxVol = Math.max(1, ...Object.values(vol)); }
    const seen = new Set();
    return Object.entries(byC).map(([code, domains]) => ({
      code, outlets: domains.filter((d) => !seen.has(d) && (seen.add(d), true)).map((d) => ({
        domain: d, present: dataSet ? dataSet.has(d) : true,
        stateMedia: stateSet.has(d), share: vol[d] ? vol[d] / maxVol : 0 })),
    }));
  }, [index, sourceCube, patIndex]);

  const allDomains = () => (patIndex ? patIndex.sources
    : sourceCube ? sourceCube.sources : countries.flatMap((c) => c.outlets.map((o) => o.domain)));
  const toggleSource = (domain) => { loadSourceCube(); setSelectedSources((sel) => { const cur = sel ? new Set(sel) : new Set(allDomains()); cur.has(domain) ? cur.delete(domain) : cur.add(domain); return cur; }); };
  const toggleCountry = (code, on) => { loadSourceCube(); const doms = (countries.find((c) => c.code === code)?.outlets || []).filter((o) => o.present).map((o) => o.domain); setSelectedSources((sel) => { const cur = sel ? new Set(sel) : new Set(allDomains()); doms.forEach((d) => (on ? cur.add(d) : cur.delete(d))); return cur; }); };
  const allSources = (on) => { loadSourceCube(); setSelectedSources(on ? new Set(allDomains()) : new Set()); };

  // ── pins: freeze the current index to compare against new settings ──────────
  const describe = () => {
    const scope = viewMode === "topics" ? (displayNames[topicPillar] || topicPillar)
      : combine ? "Composite" : (active.map((p) => displayNames[p] || p).join(" + ") || "—");
    const nSrc = selectedSources ? selectedSources.size : allDomains().length;
    const src = sourceFiltered ? `${nSrc} sources` : "all G20";
    return `${scope} · ${src} · ${window === 1 ? "no smooth" : window + "d"} · ${norm}`;
  };
  const pinCurrent = () => {
    if (pins.length >= 3 || !built.points.length) return;
    setPins((ps) => [...ps, { id: Date.now(), label: describe(), points: built.points, lines: built.lines }]);
  };
  const removePin = (id) => setPins((ps) => ps.filter((p) => p.id !== id));

  const sentIdx = useMemo(() => {
    if (!index) return [];
    const p = topicPillar, n = index.dates.length;
    const proc = (s) => normalize(rollMean(dowAdjust(s, index.dates), window), norm);
    const full = (1 << index.meta.pillars[p].themeOrder.length) - 1;   // whole pillar — topics don't apply here
    const ewSrcs = sourceFiltered ? [...selectedSources] : (patIndex ? patIndex.sources : []);
    const ewOk = !!(patIndex && ewSrcs.length && ewSrcs.every((s) => patterns[s] || !patIndex.file[s]));
    const r = ewOk ? equalWeightSeries(patterns, ewSrcs, p, full, n)
      : (sourceFiltered ? (sourceRatio(sourceCube, p, ewSrcs) || index.ratios[p]) : index.ratios[p].slice());
    const rr = proc(r);
    return index.dates.map((d, i) => ({ t: Date.parse(d + "T00:00:00Z"), val: rr[i] }));
  }, [index, window, norm, sourceFiltered, selectedSources, sourceCube, topicPillar, patIndex, patterns]);

  const sentTone = useMemo(() => {
    if (!index || !index.avgNegative) return [];
    const an = index.avgNegative;
    const arr = Array.isArray(an) ? (topicPillar === "military" ? an : null) : an[topicPillar];  // {pillar:[]} (new) or [] (old, military)
    if (!arr) return [];
    const sm = rollMean(dowAdjust(arr, index.dates), window);
    return index.dates.map((d, i) => ({ t: Date.parse(d + "T00:00:00Z"), neg: sm[i] }));
  }, [index, window, topicPillar]);

  const chartData = useMemo(() => {
    if (!pins.length) return built.points;
    return built.points.map((pt, i) => {
      const o = { ...pt };
      for (const pin of pins) { const pp = pin.points[i]; if (pp) for (const l of pin.lines) o[`${pin.id}__${l.key}`] = pp[l.key]; }
      return o;
    });
  }, [built.points, pins]);
  const chartLines = useMemo(() => [
    ...built.lines,
    ...pins.flatMap((pin) => pin.lines.filter((l) => !l.faint).map((l) => ({
      key: `${pin.id}__${l.key}`, color: l.color, dash: true, name: `${l.name} (pinned)` }))),
  ], [built.lines, pins]);

  const downloadCsv = () => {
    if (!built.points.length) return;
    const keys = built.lines.map((l) => l.key);
    const header = ["date", ...built.lines.map((l) => l.name)].join(",");
    const rows = built.points.map((p) => [new Date(p.t).toISOString().slice(0, 10), ...keys.map((k) => (p[k] != null ? p[k] : ""))].join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "gpr_index.csv"; a.click();
  };

  if (error) return <div className="app"><p className="muted">Couldn't load data ({error}). Run <code>pipeline.cli export public/data</code>.</p></div>;
  if (!index || !themeSel) return <div className="app"><p className="muted">Loading…</p></div>;

  const highPeriods = periods.filter((p) => p.regime && p.regime !== "low");
  const periodGroups = (() => {
    const g = {}; highPeriods.forEach((p, i) => { const k = p.pillar || "mixed"; (g[k] || (g[k] = [])).push({ p, i }); });
    Object.values(g).forEach((arr) => arr.sort((a, b) => a.p.start.localeCompare(b.p.start)));  // chronological by start
    const order = [...PILLARS, ...Object.keys(g).filter((k) => !PILLARS.includes(k))];
    return order.filter((k) => g[k]).map((k) => [k, g[k]]);
  })();
  const selPeriod = activePreset != null ? highPeriods[activePreset] : null;
  const selLabel = selWindow ? `${selWindow[0]} → ${selWindow[1]}` : "";

  // high-tension period picker + summary + "what's driving" — shared by all views
  const analysisBox = (
    <div className="card combined-box">
      {!selWindow ? (
        <div className="periods-full">
          <div className="presets-head">
            <span className="panel-title">High-tension periods</span>
            <span className="muted xs">click a period — or drag on the chart — to analyse it vs the full-sample average</span>
          </div>
          <div className="presets-groups">
            {periodGroups.map(([pil, items]) => (
              <div className="preset-group" key={pil}>
                <div className="preset-group-head" style={{ color: PILLAR_COLOR[pil] || "var(--muted)" }}>
                  {displayNames[pil] || pil}
                </div>
                <div className="presets">
                  {items.map(({ p, i }) => (
                    <button key={i} className={`preset${activePreset === i ? " on" : ""}`}
                      onClick={() => pickPreset(i, p)}>{p.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="period-summary">
          <div className="ps-info">
            {selPeriod ? (
              <>
                <div className="pd-title" style={{ color: PILLAR_COLOR[selPeriod.pillar] || "var(--text)" }}>{selPeriod.label}</div>
                <div className="muted sm">{selPeriod.start} → {selPeriod.end} · {displayNames[selPeriod.pillar] || selPeriod.pillar}{selPeriod.set === "validation" ? " · held-out" : ""}</div>
                {selPeriod.trigger && <div className="pd-trigger">{selPeriod.trigger}</div>}
              </>
            ) : (
              <>
                <div className="pd-title">Manual period selected</div>
                <div className="muted sm">{selWindow[0]} → {selWindow[1]}</div>
              </>
            )}
          </div>
          <button className="preset clear" onClick={clearSel}>CLEAR <X size={12} /></button>
        </div>
      )}

      <hr className="box-sep" />

      <ReactivePanel hasWindow={!!selWindow} displayNames={displayNames}
        subtitle={selWindow ? `${selLabel}  ·  vs ${index.meta.start}–${index.meta.end} average` : ""}
        tab={tab} setTab={setTab} topics={liftData.topics} sources={liftData.sources} />
    </div>
  );

  return (
    <div className="app">
      <Controls window={window} setWindow={setWindow} norm={norm} setNorm={setNorm} onDownload={downloadCsv} />

      <div className="board">
        <div className="left-col">
          {viewMode !== "sentiment" && (
            <PillarPanel meta={index.meta} displayNames={displayNames} themeSel={themeSel}
              pillarOn={(p) => (viewMode === "topics" ? p === topicPillar : active.includes(p))}
              onPillarClick={(p) => (viewMode === "topics" ? setTopicPillar(p) : toggleP(p))}
              onToggleTopic={toggleTopic} onAllTopics={allTopics} />
          )}
          <SourceSelector countries={countries} selected={selectedSources || new Set(allDomains())}
            onToggle={toggleSource} onToggleCountry={toggleCountry} onAll={allSources} />
          <CombineSliders displayNames={displayNames} active={active}
            combine={combine} setCombine={setCombine} weights={weights} setWeights={setWeights} />
        </div>

        <div className="right-col">
          <div className="view-bar">
            <div className="tabs">
              <button className={`tab${viewMode === "pillars" ? " on" : ""}`} onClick={() => setViewMode("pillars")}>3 pillars</button>
              <button className={`tab${viewMode === "topics" ? " on" : ""}`} onClick={() => setViewMode("topics")}>Topic by topic</button>
              <button className={`tab${viewMode === "sentiment" ? " on" : ""}`} onClick={() => setViewMode("sentiment")}>Sentiment</button>
            </div>
            {viewMode === "topics" && (
              <span className="muted xs">showing <b style={{ color: PILLAR_COLOR[topicPillar] }}>{displayNames[topicPillar]}</b> — pick a pillar on the left</span>
            )}
            <span className="spacer" />
            <button className="btn mini" onClick={pinCurrent} disabled={pins.length >= 3}
              title="Freeze the current index (dashed) to compare against new settings">
              <Pin size={13} /> Pin current
            </button>
          </div>

          {viewMode === "sentiment" && (
            <div className="sent-pillar-bar">
              {PILLARS.map((p) => (
                <button key={p} className={`pill-btn${p === topicPillar ? " on" : ""}`}
                  style={p === topicPillar ? { borderColor: PILLAR_COLOR[p], background: PILLAR_COLOR[p] + "22", color: "var(--text)" } : undefined}
                  onClick={() => setTopicPillar(p)}>
                  <span className="dot" style={{ background: p === topicPillar ? PILLAR_COLOR[p] : "transparent",
                    boxShadow: p === topicPillar ? "none" : "inset 0 0 0 1.5px var(--muted)" }} />
                  {displayNames[p] || p}
                </button>
              ))}
            </div>
          )}

          {pins.length > 0 && (
            <div className="pins-bar">
              <span className="muted xs">Pinned:</span>
              {pins.map((pin) => (
                <span className="pin-chip" key={pin.id}
                  style={{ borderColor: pin.lines[0]?.color || "var(--border2)" }}>
                  <span className="pin-dash" style={{ background: pin.lines[0]?.color }} />
                  {pin.label}
                  <button className="pin-x" onClick={() => removePin(pin.id)} aria-label="remove pin"><X size={11} /></button>
                </span>
              ))}
            </div>
          )}

          {viewMode === "sentiment"
            ? <PillarSentiment idx={sentIdx} sent={sentTone} color={PILLAR_COLOR[topicPillar]} name={displayNames[topicPillar] || topicPillar}
                events={events} selWindow={selWindow} activePreset={activePreset} onSelectWindow={pickDrag} onClear={clearSel} />
            : <IndexChart data={chartData} lines={chartLines} events={events}
                selWindow={selWindow} activePreset={activePreset} onSelectWindow={pickDrag} onClear={clearSel} />}

          {analysisBox}
        </div>
      </div>
    </div>
  );
}
