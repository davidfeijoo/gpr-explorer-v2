import { useState, useEffect, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, ReferenceLine, Brush,
} from "recharts";
import { calendarTicks } from "../lib/calendarTicks.js";

const ms2day = (ms) => new Date(ms).toISOString().slice(0, 10);
const yr = (ms) => new Date(ms).getUTCFullYear();
const RANGES = [["6M", 182], ["1Y", 365], ["5Y", 1825], ["All", null]];
const NEG = "#d98c7a";

// Sentiment view: a pillar's index (top) and its negative-tone series (bottom),
// locked to the SAME time window — one brush at the bottom drives both, each plot
// has its own right-side legend. Drag on the top plot selects a period. `idx` rows
// are { t, val }; `sent` rows are { t, neg }.
export default function PillarSentiment({ idx, sent, color, name, events = [], selWindow, activePreset, onSelectWindow, onClear }) {
  const n = idx.length;
  const [view, setView] = useState([0, 0]);
  const [drag, setDrag] = useState({ a: null, b: null });
  const [hoverT, setHoverT] = useState(null);

  useEffect(() => { setView([0, Math.max(0, n - 1)]); }, [n]);
  // selecting a period (preset click OR manual drag) zooms both plots to it with
  // margin on both sides; clearing snaps back to the full-period view.
  useEffect(() => {
    if (!n) return;
    if (!selWindow) { setView([0, n - 1]); return; }
    const x1 = Date.parse(selWindow[0] + "T00:00:00Z");
    const x2 = Date.parse(selWindow[1] + "T00:00:00Z");
    const margin = Math.max(182 * 864e5, 0.25 * (x2 - x1));   // ≥6 months, or 25% of the span
    let s = idx.findIndex((p) => p.t >= x1 - margin); if (s < 0) s = 0;
    let e = idx.findIndex((p) => p.t >= x2 + margin); if (e < 0) e = n - 1;
    setView([s, Math.max(s, e)]);
  }, [selWindow]);  // eslint-disable-line react-hooks/exhaustive-deps

  const setRange = (days) => {
    if (days == null || days >= n) setView([0, n - 1]);
    else setView([Math.max(0, n - days), n - 1]);
  };

  const dom = (n && view[1] > view[0]) ? [idx[view[0]].t, idx[Math.min(view[1], n - 1)].t] : ["dataMin", "dataMax"];
  const vspan = (n && view[1] > view[0]) ? (idx[Math.min(view[1], n - 1)].t - idx[view[0]].t) / 864e5 : n;
  const fmtX = (ms) => {
    const d = new Date(ms);
    if (vspan < 92)  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" });
    if (vspan < 730) return d.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
    return String(d.getUTCFullYear());
  };
  // Calendar-aligned ticks (years at exactly 1 Jan etc.) — see lib/calendarTicks.js
  const t0 = n ? idx[view[0]].t : 0;
  const t1 = n ? idx[Math.min(view[1], n - 1)].t : 0;
  const xTicks = useMemo(() => (n ? calendarTicks(t0, t1, vspan) : undefined), [n, t0, t1, vspan]);

  const down = (e) => { if (e && e.activeLabel != null) setDrag({ a: e.activeLabel, b: e.activeLabel }); };
  const move = (e) => {
    if (drag.a != null && e && e.activeLabel != null) setDrag((d) => ({ ...d, b: e.activeLabel }));
    if (e && e.activeLabel != null) setHoverT(e.activeLabel);
  };
  const up = () => {
    if (drag.a != null && drag.b != null && drag.a !== drag.b) onSelectWindow(ms2day(Math.min(drag.a, drag.b)), ms2day(Math.max(drag.a, drag.b)));
    else if (drag.a != null) onClear();
    setDrag({ a: null, b: null });
  };

  const at = (arr, key) => {
    if (!arr.length) return null;
    const row = hoverT != null ? arr.find((p) => p.t === hoverT) : arr[arr.length - 1];
    return row ? row[key] : null;
  };
  const Legend = ({ c, nm, value, dp }) => (
    <div className="chart-legend">
      <div className="leg-date">{hoverT != null ? ms2day(hoverT) : "latest"}</div>
      <div className="leg-row">
        <span className="leg-dot" style={{ background: c }} />
        <span className="leg-name" title={nm}>{nm}</span>
        <span className="leg-val">{typeof value === "number" ? value.toFixed(dp) : "—"}</span>
      </div>
    </div>
  );

  return (
    <div className="card chart-card sentpair-card">
      <div className="chart-head">
        <span className="muted sm">{name} index &amp; negative tone{n ? ` · ${yr(idx[0].t)}–${yr(idx[n - 1].t)}` : ""}</span>
        <div className="range-btns">
          {RANGES.map(([lbl, d]) => <button key={lbl} className="btn mini" onClick={() => setRange(d)}>{lbl}</button>)}
        </div>
        <span className="spacer" />
        <span className="muted xs">drag on the top chart to select a period</span>
      </div>

      {/* top — pillar index */}
      <div className="chart-body">
        <div className="chart-plot">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={idx} onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={() => setHoverT(null)}
                       margin={{ top: 6, right: 12, bottom: 0, left: -6 }}>
              <CartesianGrid strokeOpacity={0.10} vertical={false} />
              {/* x-axis hidden here: it's shared with the bottom plot (same window) to save space */}
              <XAxis dataKey="t" type="number" domain={dom} scale="time" allowDataOverflow hide />
              <YAxis tick={{ fontSize: 11 }} width={46} />
              <Tooltip content={() => null} cursor={{ stroke: "#8b97a7", strokeOpacity: 0.4 }} />
              {events.map((e, i) => (
                <ReferenceLine key={i} x={Date.parse(e.date + "T00:00:00Z")} stroke="#8b97a7" strokeOpacity={0.22} strokeWidth={1} />
              ))}
              {selWindow && (
                <ReferenceArea x1={Date.parse(selWindow[0] + "T00:00:00Z")} x2={Date.parse(selWindow[1] + "T00:00:00Z")}
                               strokeOpacity={0} fill="#237D7D" fillOpacity={0.20} />
              )}
              {drag.a != null && drag.b != null && (
                <ReferenceArea x1={Math.min(drag.a, drag.b)} x2={Math.max(drag.a, drag.b)} strokeOpacity={0} fill="#237D7D" fillOpacity={0.20} />
              )}
              <Line type="monotone" dataKey="val" stroke={color} dot={false} isAnimationActive={false} strokeWidth={1.8} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <Legend c={color} nm={name} value={at(idx, "val")} dp={3} />
      </div>

      {/* bottom — negative tone + the single shared brush */}
      <div className="chart-body">
        <div className="chart-plot">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sent} onMouseMove={move} onMouseLeave={() => setHoverT(null)}
                       margin={{ top: 6, right: 12, bottom: 0, left: -6 }}>
              <CartesianGrid strokeOpacity={0.10} vertical={false} />
              <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} scale="time" tickFormatter={fmtX}
                     tick={{ fontSize: 11 }} minTickGap={40} ticks={xTicks} allowDataOverflow />
              <YAxis tick={{ fontSize: 11 }} width={46} domain={["auto", "auto"]} allowDataOverflow />
              <Tooltip content={() => null} cursor={{ stroke: "#8b97a7", strokeOpacity: 0.4 }} />
              <Line type="monotone" dataKey="neg" stroke={NEG} dot={false} isAnimationActive={false} strokeWidth={1.6} connectNulls />
              <Brush dataKey="t" height={26} travellerWidth={8} stroke="#3d4757" fill="#161b22"
                     tickFormatter={yr} startIndex={view[0]} endIndex={view[1]}
                     onChange={(r) => r && setView([r.startIndex, r.endIndex])} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <Legend c={NEG} nm="Negative tone" value={at(sent, "neg")} dp={2} />
      </div>
    </div>
  );
}
