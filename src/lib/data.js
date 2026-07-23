import { useEffect, useState, useCallback, useRef } from "react";
import { preparePatternSource } from "./engine.js";

// Loads the new web_export JSON. index.json is eager (small, drives first paint);
// the big per-pillar combos, the source cube, and the per-source pattern files are
// fetched lazily. The pattern files power the site's default equal-weight
// aggregation (exact for any topic combo × any source set); index.json's pooled
// ratios are the first-paint fallback shown until the patterns finish loading.
const BASE = import.meta.env.BASE_URL || "/";
const url = (f) => `${BASE}data/${f}`;

export function useData() {
  const [index, setIndex] = useState(null);
  const [events, setEvents] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [combos, setCombos] = useState({});        // { pillar: comboJson }
  const [sourceCube, setSourceCube] = useState(null);
  const [patIndex, setPatIndex] = useState(null);  // source_patterns_index.json
  const [patterns, setPatterns] = useState({});    // { source: preparedPatternSource }
  const [error, setError] = useState(null);
  const inflight = useRef({});

  useEffect(() => {
    let alive = true;
    fetch(url("index.json"))
      .then((r) => { if (!r.ok) throw new Error(`index.json HTTP ${r.status}`); return r.json(); })
      .then((j) => { if (alive) setIndex(j); })
      .catch((e) => alive && setError(e.message));
    fetch(url("events.json")).then((r) => r.ok ? r.json() : { events: [] })
      .then((j) => alive && setEvents(j.events || [])).catch(() => {});
    fetch(url("periods.json")).then((r) => r.ok ? r.json() : { periods: [] })
      .then((j) => alive && setPeriods(j.periods || [])).catch(() => {});
    fetch(url("source_patterns_index.json")).then((r) => r.ok ? r.json() : null)
      .then((j) => alive && j && setPatIndex(j)).catch(() => {});
    return () => { alive = false; };
  }, []);

  const loadCombos = useCallback((pillar) => {
    if (combos[pillar] || inflight.current[`c-${pillar}`]) return;
    inflight.current[`c-${pillar}`] = true;
    fetch(url(`combos_${pillar}.json`))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setCombos((c) => ({ ...c, [pillar]: j })))
      .catch(() => {});
  }, [combos]);

  const loadSourceCube = useCallback(() => {
    if (sourceCube || inflight.current.src) return;
    inflight.current.src = true;
    fetch(url("source_cube.json"))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setSourceCube(j))
      .catch(() => {});
  }, [sourceCube]);

  // Fetch (and prepare) the pattern files for `sources` that aren't loaded yet.
  // Resolves each batch into a single state update to limit re-renders.
  const loadPatterns = useCallback((sources) => {
    if (!patIndex || !index) return;
    const N = index.dates.length;
    const need = sources.filter((s) => patIndex.file[s] && !patterns[s] && !inflight.current[`p-${s}`]);
    if (!need.length) return;
    need.forEach((s) => { inflight.current[`p-${s}`] = true; });
    Promise.all(need.map((s) =>
      fetch(url(`source_patterns/${patIndex.file[s]}`))
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => [s, j ? preparePatternSource(j, N, patIndex.medianVolume[s]) : null])
        .catch(() => [s, null])
    )).then((pairs) => setPatterns((m) => {
      const c = { ...m }; for (const [s, v] of pairs) if (v) c[s] = v; return c;
    }));
  }, [patIndex, index, patterns]);

  return { index, events, periods, combos, sourceCube, patIndex, patterns,
           error, loadCombos, loadSourceCube, loadPatterns };
}
