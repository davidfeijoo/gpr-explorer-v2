// Calendar-aligned x-axis ticks. Recharts' automatic "nice" ticks fall on
// arbitrary dates, so a tick labelled "2022" could sit in late 2021. This
// pins year ticks to exactly 1 Jan, month ticks to exactly the 1st, and day
// ticks to even steps from the first visible day.
export function calendarTicks(t0, t1, vspan) {
  if (!(t1 > t0)) return undefined;
  const ticks = [];
  const d0 = new Date(t0), d1 = new Date(t1);
  if (vspan >= 730) {                                   // year level: every 1 Jan in view
    const yFirst = d0.getUTCFullYear() + (Date.UTC(d0.getUTCFullYear(), 0, 1) < t0 ? 1 : 0);
    for (let y = yFirst; y <= d1.getUTCFullYear(); y++) ticks.push(Date.UTC(y, 0, 1));
  } else if (vspan >= 92) {                             // month level: every 1st, thinned
    const months = [];
    let y = d0.getUTCFullYear(), m = d0.getUTCMonth();
    if (Date.UTC(y, m, 1) < t0) { m++; if (m > 11) { m = 0; y++; } }
    for (let t = Date.UTC(y, m, 1); t <= t1; ) { months.push(t); m++; if (m > 11) { m = 0; y++; } t = Date.UTC(y, m, 1); }
    const step = Math.max(1, Math.ceil(months.length / 10));
    for (let i = 0; i < months.length; i += step) ticks.push(months[i]);
  } else {                                              // day level: even steps
    const step = Math.max(1, Math.ceil(vspan / 10));
    for (let t = t0; t <= t1; t += step * 864e5) ticks.push(t);
  }
  return ticks.length ? ticks : undefined;
}
