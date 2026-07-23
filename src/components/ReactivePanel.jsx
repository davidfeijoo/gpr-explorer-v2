import { POS, NEG, PILLAR_COLOR } from "../lib/colors.js";

const pct = (x) => `${x >= 0 ? "+" : ""}${Math.round(x * 100)}%`;

function DivergingBars({ rows, dot }) {
  if (!rows || !rows.length) return <p className="muted sm">No data for this window yet.</p>;
  const top = rows.slice(0, 12);
  const max = Math.max(0.01, ...top.map((r) => Math.abs(r.lift)));
  return (
    <div>
      {top.map((r) => {
        const w = (Math.abs(r.lift) / max) * 46;
        const pos = r.lift >= 0;
        return (
          <div className="bar-row" key={r.key + (r.pillar || "")}>
            <span className="bar-key">
              {dot && <span className="dot" style={{ background: dot(r) }} />}
              <span className="bar-label" title={r.label || r.key}>{r.label || r.key}</span>
            </span>
            <div className="bar-track">
              <div className="bar-zero" />
              <div className="bar-fill" style={{
                [pos ? "left" : "right"]: "50%", width: `${w}%`,
                background: pos ? POS : NEG,
              }} />
            </div>
            <span className="bar-val">{pct(r.lift)}</span>
          </div>
        );
      })}
    </div>
  );
}

// "What's driving this window" — Topics (colored by pillar) and Sources.
// Topics grouped by pillar (each pillar its own labelled section of bars).
function TopicsByPillar({ rows, displayNames }) {
  if (!rows || !rows.length) return <p className="muted sm">No data for this window yet.</p>;
  const groups = {};
  rows.forEach((r) => { (groups[r.pillar] || (groups[r.pillar] = [])).push(r); });
  const order = ["military", "economic", "operational"].filter((p) => groups[p]);
  return (
    <>
      {order.map((p) => (
        <div key={p} style={{ marginBottom: 12 }}>
          <div className="panel-title" style={{ fontSize: 12, color: PILLAR_COLOR[p], marginBottom: 4 }}>
            {displayNames?.[p] || p}
          </div>
          <DivergingBars rows={groups[p]} dot={() => PILLAR_COLOR[p]} />
        </div>
      ))}
    </>
  );
}

export default function ReactivePanel({ hasWindow, subtitle, tab, setTab, topics, sources, displayNames }) {
  return (
    <div className="lifts-card">
      <div className="panel-title">What's driving this window</div>
      <div className="muted xs" style={{ margin: "3px 0 10px" }}>{subtitle}</div>
      {!hasWindow ? (
        <p className="muted sm">Drag across the chart to pick a period — or click a preset — to see which topics and sources are elevated vs the full-sample average.</p>
      ) : (
        <>
          <div className="tabs">
            <button className={`tab${tab === "topics" ? " on" : ""}`} onClick={() => setTab("topics")}>Topics</button>
            <button className={`tab${tab === "sources" ? " on" : ""}`} onClick={() => setTab("sources")}>Sources</button>
          </div>
          {tab === "topics"
            ? <TopicsByPillar rows={topics} displayNames={displayNames} />
            : <DivergingBars rows={sources} />}
        </>
      )}
    </div>
  );
}
