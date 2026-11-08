// Recommended meter rate for each crowd size, from the baked sweeps (sweeps.json: whole days, 1-3 PM, 6 runs per rate).
// node recommend.js            -> prints the analysis and writes recommend.json (build.py puts it on both pages)
//
// The rule:
// 1. A rate "keeps the loop moving" when, on average from 1 to 3 PM, fewer than one car is circling and less than
//    10% of the loop is at a standstill.
// 2. For each crowd, take the lowest rate that keeps the loop moving and also does at the next step up ($0.50 more),
//    so one lucky run doesn't set the rate.
// 3. A bigger crowd never gets a lower rate: smooth across crowd sizes (pool-adjacent-violators, weighted equally),
//    then round to the nearest $0.50.
// 4. Never below today's $2.00: on quiet days the loop has room at $2.00, so the recommendation is no change.
// 5. If no rate up to $12 works, there is no recommendation: through traffic and drop-offs alone back up the loop.
const fs = require('fs');
const SW = JSON.parse(fs.readFileSync(__dirname + '/sweeps.json', 'utf8'));
const CIRC = 1, STAND = 0.1, FLOOR = 2, TOP = 12;
const works = r => r && r.circ < CIRC && r.standstill < STAND;

const crowds = Object.keys(SW).map(Number).sort((a, b) => a - b);
const raw = crowds.map(v => {
  const rows = SW[v];
  for (let i = 0; i < rows.length; i++) if (works(rows[i]) && (i + 1 >= rows.length || works(rows[i + 1]))) return rows[i].p;
  return null;
});

// pool-adjacent-violators: the closest non-decreasing sequence (crowds with no working rate are left out)
const idx = raw.map((p, i) => p == null ? -1 : i).filter(i => i >= 0);
const blocks = [];
for (const i of idx) {
  blocks.push({ sum: raw[i], n: 1, ids: [i] });
  while (blocks.length > 1 && blocks[blocks.length - 2].sum / blocks[blocks.length - 2].n > blocks[blocks.length - 1].sum / blocks[blocks.length - 1].n) {
    const b = blocks.pop(), a = blocks[blocks.length - 1];
    a.sum += b.sum; a.n += b.n; a.ids = a.ids.concat(b.ids);
  }
}
const smooth = raw.slice();
for (const b of blocks) for (const i of b.ids) smooth[i] = b.sum / b.n;

const out = crowds.map((v, i) => {
  const rows = SW[v], at = p => rows.find(r => Math.abs(r.p - p) < 1e-6);
  const rate = smooth[i] == null ? null : Math.max(FLOOR, Math.round(smooth[i] * 2) / 2);
  const today = at(2), rec = rate == null ? null : at(rate);
  const pick = r => r && { p: r.p, occ: r.occ, trip: r.trip, circ: r.circ, standstill: r.standstill, search: r.search, left: r.left, rev: r.rev, shopDine: r.shopDine, beachHeld: r.beachHeld };
  return { v, raw: raw[i], rate, todayWorks: works(today), today: pick(today), rec: pick(rec) };
});
fs.writeFileSync(__dirname + '/recommend.json', JSON.stringify(out));

const pad = (s, n) => String(s).padStart(n);
console.log('visitors  lowest  smoothed  rate   | at $2: full trip stop circ | at the rate: full trip stop circ  shops/hr  $/hr');
for (const o of out) {
  const t = o.today, r = o.rec;
  console.log(pad(o.v.toLocaleString(), 8) + pad(o.raw == null ? '-' : '$' + o.raw.toFixed(2), 8) + pad(o.rate == null ? '-' : '$' + smooth[out.indexOf(o)].toFixed(2), 10) + pad(o.rate == null ? 'none' : '$' + o.rate.toFixed(2), 7) +
    '  | ' + pad(Math.round(t.occ * 100) + '%', 9) + pad(t.trip.toFixed(1), 5) + pad(Math.round(t.standstill * 100) + '%', 5) + pad(t.circ.toFixed(1), 5) +
    (r ? '  | ' + pad(Math.round(r.occ * 100) + '%', 14) + pad(r.trip.toFixed(1), 5) + pad(Math.round(r.standstill * 100) + '%', 5) + pad(r.circ.toFixed(1), 5) + pad(r.shopDine.toFixed(0), 10) + pad(r.rev.toFixed(0), 6) : ''));
}
