import { PILLARS } from "../lib/engine.js";
import { PILLAR_COLOR } from "../lib/colors.js";

// Pillars + their topics, always visible.
// In "pillars" view a pillar chip toggles it on/off; in "topics" view it selects
// which single pillar is shown topic-by-topic. Topic chips always edit the subset.
export default function PillarPanel({ meta, displayNames, pillarOn, onPillarClick, themeSel, onToggleTopic, onAllTopics, showTopics = true }) {
  const Dot = ({ on, color }) => (
    <span className="dot" style={{ background: on ? color : "transparent",
      boxShadow: on ? "none" : "inset 0 0 0 1.5px var(--muted)" }} />
  );
  return (
    <div className="card pillar-card">
      <div className="card-head"><span className="panel-title">Pillars{showTopics ? " & topics" : ""}</span></div>
      {PILLARS.map((p) => {
        const on = pillarOn(p);
        const color = PILLAR_COLOR[p];
        const order = meta.pillars[p].themeOrder;
        const names = meta.pillars[p].tagDisplayNames || {};
        const sel = themeSel[p];
        return (
          <div className="pillar-block" style={{ opacity: on ? 1 : 0.5 }} key={p}>
            <div className="pillar-head">
              <button className={`chip${on ? " on" : ""}`} onClick={() => onPillarClick(p)}>
                <Dot on={on} color={color} />{displayNames[p] || p}
              </button>
              <span className="spacer" />
              {showTopics && <>
                <span className="muted xs">{sel.length}/{order.length}</span>
                <button className="btn mini" onClick={() => onAllTopics(p, true)}>All</button>
                <button className="btn mini" onClick={() => onAllTopics(p, false)}>None</button>
              </>}
            </div>
            {showTopics && (
              <div className="topics-box">
                {order.map((t) => (
                  <button key={t} className={`topic-chip${sel.includes(t) ? " on" : ""}`} onClick={() => onToggleTopic(p, t)}>
                    <Dot on={sel.includes(t)} color={color} />{names[t] || t}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
