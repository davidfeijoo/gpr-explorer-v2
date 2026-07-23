import { PILLARS } from "../lib/engine.js";
import { PILLAR_COLOR } from "../lib/colors.js";

// Vertical, prominent — sits beneath the sources in the left column.
export default function CombineSliders({ displayNames, active, combine, setCombine, weights, setWeights }) {
  return (
    <div className="card combine-card">
      <div className="card-head">
        <span className="panel-title">Combine pillars</span>
        <button className={`switch${combine ? " on" : ""}`} onClick={() => setCombine(!combine)} aria-label="Combine pillars">
          <span className="knob" />
        </button>
      </div>
      <p className="muted xs" style={{ marginTop: 0 }}>Blend the active pillars into one weighted index.</p>
      {PILLARS.map((p) => {
        const on = active.includes(p);
        return (
          <div className="slider-inline" key={p} style={{ opacity: combine && on ? 1 : 0.4 }}>
            <span className="slabel" style={{ color: PILLAR_COLOR[p] }}>{displayNames?.[p] || p}</span>
            <input type="range" min="0" max="100" step="1" value={weights[p]}
                   disabled={!combine || !on}
                   onChange={(e) => setWeights({ ...weights, [p]: +e.target.value })} />
            <span className="sval">{weights[p]}</span>
          </div>
        );
      })}
    </div>
  );
}
