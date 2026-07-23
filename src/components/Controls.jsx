import { Download } from "lucide-react";

// Top bar: brand + smoothing + scale + download. (Pillar/topic selection lives in
// the left PillarPanel now.)
export default function Controls({ window, setWindow, norm, setNorm, onDownload }) {
  return (
    <div className="controls">
      <div className="brand">
        <span className="title">Geopolitical Risk Index</span>
        <span className="sub">GDELT · G20 · 2015–2026</span>
      </div>
      <span className="spacer" />
      <label className="ctl">
        Smoothing
        <select value={window} onChange={(e) => setWindow(+e.target.value)}>
          {[1, 7, 14, 30, 60, 90].map((w) => <option key={w} value={w}>{w === 1 ? "none" : `${w}d`}</option>)}
        </select>
      </label>
      <label className="ctl">
        Scale
        <select value={norm} onChange={(e) => setNorm(e.target.value)}>
          <option value="raw">Raw</option>
          <option value="z">Z-score</option>
          <option value="minmax">Min–max</option>
          <option value="pct">Percentile</option>
        </select>
      </label>
      <button className="btn" onClick={onDownload}><Download size={15} /> Download</button>
    </div>
  );
}
