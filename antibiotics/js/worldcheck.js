// World data validator (DOM-free)
import { ROOM_W, ROOM_H } from './const.js';
import { CHAR_TILE, SOLID } from './tiles.js';
import { PROP_FOOTPRINTS } from './propmeta.js';
const DIRS = ['n', 'e', 's', 'w'];
const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
const DIR_D = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
/** Validate world data (used by tests + dev) */
export function validateWorld(data, log = console.log) {
  let errs = 0; let warns = 0;
  const err = (m) => { errs++; log('  ✗ ' + m); };
  for (const [aid, a] of Object.entries(data.areas)) {
    const grid = new Map();
    for (const [rid, r] of Object.entries(a.rooms)) {
      if (r.gx === undefined || r.gy === undefined) err(`${aid}/${rid}: missing gx/gy`);
      const key = `${r.gx},${r.gy}`; if (grid.has(key)) err(`${aid}/${rid}: duplicate grid ${key} with ${grid.get(key)}`); grid.set(key, rid);
      if (!r.rows || r.rows.length !== ROOM_H - 2) err(`${aid}/${rid}: rows must be ${ROOM_H - 2} (got ${r.rows?.length})`);
      (r.rows || []).forEach((row, i) => { if (row.length !== ROOM_W - 2) err(`${aid}/${rid}: row ${i} length ${row.length} != ${ROOM_W - 2}`); for (const ch of row) if (CHAR_TILE[ch] === undefined) err(`${aid}/${rid}: bad tile char '${ch}'`); });
      for (const alt of r.alts || []) { if (!alt.flag || !alt.rows || alt.rows.length !== ROOM_H - 2) err(`${aid}/${rid}: bad alt`); (alt.rows || []).forEach((row, i) => { if (row.length !== ROOM_W - 2) err(`${aid}/${rid}: alt row ${i} length ${row.length}`); for (const ch of row) if (CHAR_TILE[ch] === undefined) err(`${aid}/${rid}: alt bad tile char '${ch}'`); }); }
      // props: bounds + footprint bookkeeping
      const propSolid = new Set();
      for (const pr of r.props || []) {
        const [kind, px, py] = pr; const P = PROP_FOOTPRINTS[kind];
        if (!P) { err(`${aid}/${rid}: unknown prop '${kind}'`); continue; }
        if (px < 1 || py < 1 || px + P.w > ROOM_W - 1 || py + P.h > ROOM_H - 1) err(`${aid}/${rid}: prop ${kind} out of bounds at (${px},${py})`);
        const doors = new Set((P.door || []).map(([dx, dy]) => `${dx},${dy}`));
        for (let j = 0; j < P.h; j++) for (let i = 0; i < P.w; i++) { if (!doors.has(`${i},${j}`)) propSolid.add(`${px + i},${py + j}`); }
      }
      for (const e of r.ents || []) {
        if (e.x === undefined || e.y === undefined) err(`${aid}/${rid}: entity ${e.type} missing x/y`);
        if (e.x < 1 || e.x > ROOM_W - 2 || e.y < 1 || e.y > ROOM_H - 2) err(`${aid}/${rid}: entity ${e.type} ${e.bug || e.item || e.id || ''} out of bounds (${e.x},${e.y})`);
        const ch = r.rows?.[e.y - 1]?.[e.x - 1]; const tt = CHAR_TILE[ch];
        if ((SOLID.has(tt) || propSolid.has(`${e.x},${e.y}`)) && e.type !== 'warp') {
          // The engine nudges entities to the nearest free tile; only fail if none is close.
          let found = false;
          for (let rad = 1; rad <= 4 && !found; rad++) for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
            const nx = e.x + dx, ny = e.y + dy;
            if (nx < 1 || ny < 1 || nx > ROOM_W - 2 || ny > ROOM_H - 2) continue;
            const t2 = CHAR_TILE[r.rows?.[ny - 1]?.[nx - 1]];
            if (!SOLID.has(t2) && !propSolid.has(`${nx},${ny}`)) found = true;
          }
          if (!found) err(`${aid}/${rid}: entity ${e.type} ${e.bug || e.item || e.id || e.drug || ''} walled in at (${e.x},${e.y})`);
          else warns++;
        }
      }
    }
    // exits must match neighbors
    for (const [rid, r] of Object.entries(a.rooms)) {
      for (const d of DIRS) {
        const t = r.exits?.[d] || 'wall'; if (t === 'wall') continue;
        const [dx, dy] = DIR_D[d]; const nk = `${r.gx + dx},${r.gy + dy}`;
        if (!grid.has(nk)) err(`${aid}/${rid}: exit ${d} leads nowhere (${nk})`);
        else { const n = a.rooms[grid.get(nk)]; const back = n.exits?.[OPP[d]] || 'wall'; if (back === 'wall') err(`${aid}/${rid}: exit ${d} -> ${grid.get(nk)} has no matching ${OPP[d]} exit`); }
      }
    }
  }
  if (warns) log(`  (${warns} entities auto-nudged off solid tiles)`);
  return errs;
}
