// Procedural room helpers (DOM-free). Rooms are 18x10 interior strings.
import { mulberry32, hashStr } from '../util.js';
const W = 18, H = 10;
export function blank() { return Array.from({ length: H }, () => '.'.repeat(W)); }
export function put(rows, x, y, ch) { if (x < 0 || y < 0 || x >= W || y >= H) return; rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1); }
export function get(rows, x, y) { return rows[y]?.[x] ?? '#'; }
export function rect(rows, x, y, w, h, ch) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(rows, x + i, y + j, ch); }
/** Is (x,y) on the protected cross (keeps exits connected)? */
const onCross = (x, y) => (x >= 7 && x <= 10) || (y >= 3 && y <= 6);
/**
 * Generate a filler room. opts: { density (0-1), pond (bool), pillars (bool), decor, hazard, seedStr, keepCross }
 */
export function genRoom(seedStr, opts = {}) {
  const rng = mulberry32(hashStr(seedStr));
  const rows = blank();
  const density = opts.density ?? 0.5;
  const nClusters = Math.round(2 + density * 5);
  const ob = opts.pillars ? 'T' : 'o';
  for (let k = 0; k < nClusters; k++) {
    const x = Math.floor(rng() * (W - 2)), y = Math.floor(rng() * (H - 2));
    const shape = rng();
    const cells = shape < 0.4 ? [[0, 0], [1, 0], [0, 1], [1, 1]] : shape < 0.7 ? [[0, 0], [1, 0], [2, 0]] : shape < 0.85 ? [[0, 0], [0, 1], [0, 2]] : [[0, 0], [1, 0], [1, 1]];
    let ok = true; for (const [dx, dy] of cells) if (onCross(x + dx, y + dy) || x + dx >= W || y + dy >= H) ok = false;
    if (!ok) continue;
    for (const [dx, dy] of cells) put(rows, x + dx, y + dy, ob);
  }
  if (opts.pond) {
    const pw = 3 + Math.floor(rng() * 3), ph = 2 + Math.floor(rng() * 2);
    let tries = 0;
    while (tries++ < 20) { const x = Math.floor(rng() * (W - pw)), y = Math.floor(rng() * (H - ph)); let ok = true; for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) if (onCross(x + i, y + j)) ok = false; if (ok) { rect(rows, x, y, pw, ph, '~'); break; } }
  }
  if (opts.hazard) { for (let k = 0; k < 3; k++) { const x = Math.floor(rng() * W), y = Math.floor(rng() * H); if (!onCross(x, y) && get(rows, x, y) === '.') put(rows, x, y, '^'); } }
  const nd = opts.decor ?? 4;
  for (let k = 0; k < nd; k++) { const x = Math.floor(rng() * W), y = Math.floor(rng() * H); if (get(rows, x, y) === '.') put(rows, x, y, ','); }
  return rows;
}
/** Free floor tile positions (room coords incl. border offset) not on solids, away from the center */
export function freeSpots(rows, seedStr, n, avoidCenter = true) {
  const rng = mulberry32(hashStr(seedStr + ':spots'));
  const out = []; let tries = 0;
  while (out.length < n && tries++ < 400) {
    const x = Math.floor(rng() * W), y = Math.floor(rng() * H);
    if (get(rows, x, y) !== '.' && get(rows, x, y) !== ',') continue;
    if (avoidCenter && Math.abs(x - 8.5) < 3 && Math.abs(y - 4.5) < 2.5) continue;
    if (out.some(([ox, oy]) => Math.abs(ox - x) < 2 && Math.abs(oy - y) < 2)) continue;
    out.push([x + 1, y + 1]);
  }
  return out;
}
/** Convenience: enemies scattered */
export function scatter(rows, seedStr, bugs, extra = {}) {
  const spots = freeSpots(rows, seedStr, bugs.length);
  return bugs.map((bug, i) => ({ type: 'enemy', bug, x: spots[i]?.[0] ?? 3, y: spots[i]?.[1] ?? 3, ...extra }));
}
