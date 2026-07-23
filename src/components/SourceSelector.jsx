import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { sourceName } from "../lib/sources.js";

const COUNTRY_NAMES = {
  USA: "United States", UK: "United Kingdom", DE: "Germany", FR: "France", IT: "Italy",
  ES: "Spain", JP: "Japan", CN: "China", IN: "India", AU: "Australia", CA: "Canada",
  BR: "Brazil", MX: "Mexico", AR: "Argentina", KR: "South Korea", SA: "Saudi Arabia",
  TR: "Türkiye", ZA: "South Africa", ID: "Indonesia", INTL: "International",
};

function Switch({ on, partial, onClick }) {
  return (
    <button className={`switch${on ? " on" : ""}${partial ? " partial" : ""}`} onClick={onClick} aria-label="toggle">
      <span className="knob" />
    </button>
  );
}

export default function SourceSelector({ countries, selected, onToggle, onToggleCountry, onAll }) {
  const [open, setOpen] = useState({ USA: true });
  return (
    <div className="card src-card">
      <div className="src-head">
        <span className="panel-title">Sources</span>
        <span className="spacer" />
        <span className="muted xs">{selected.size} on</span>
        <button className="btn mini" onClick={() => onAll(true)}>All</button>
        <button className="btn mini" onClick={() => onAll(false)}>None</button>
      </div>

      <div className="src-list">
      {countries.map(({ code, outlets }) => {
        const present = outlets.filter((o) => o.present);
        if (!present.length) return null;
        const onCount = present.filter((o) => selected.has(o.domain)).length;
        const allOn = onCount === present.length;
        const isOpen = !!open[code];
        return (
          <div key={code} className="country">
            <div className="country-head">
              <button className="chev" onClick={() => setOpen((o) => ({ ...o, [code]: !o[code] }))}>
                {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </button>
              <span className="country-name" onClick={() => setOpen((o) => ({ ...o, [code]: !o[code] }))}>
                {COUNTRY_NAMES[code] || code}
              </span>
              <span className="muted xs">{onCount}/{present.length}</span>
              <Switch on={allOn} partial={onCount > 0 && !allOn} onClick={() => onToggleCountry(code, !allOn)} />
            </div>
            {isOpen && present.map((o) => (
              <div key={o.domain} className="outlet-row" role="button" tabIndex={0} onClick={() => onToggle(o.domain)}>
                <span className={`switch${selected.has(o.domain) ? " on" : ""}`}><span className="knob" /></span>
                <span className="outlet-name">{sourceName(o.domain)} <span className="outlet-dom">· {o.domain}</span></span>
                {o.stateMedia && <span className="flag">state</span>}
                <span className="vol-track"><span className="vol-fill" style={{ width: `${Math.min(100, o.share * 100)}%` }} /></span>
              </div>
            ))}
          </div>
        );
      })}
      </div>
    </div>
  );
}
