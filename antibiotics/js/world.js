// ============================================================================
// World / rooms: map parsing, borders & doors, collision, rendering, transitions
// ----------------------------------------------------------------------------
// Room spec (data/world*.js):
// {
//   gx, gy,                      grid position inside its area
//   name, theme, music, env: { cns, lung, urine, abscess, neutropenic, endocarditis, dark }
//   rows: [10 strings of 18 chars]  (interior; border auto-generated)
//   exits: { n:'open'|'locked'|'boss'|'shut'|'biofilm'|'wall', e, s, w }   (missing = wall)
//   ents: [ {type:'enemy', bug, x, y, ...}, {type:'npc', id, x, y, dialog}, {type:'item', item, x, y, flag},
//           {type:'drug', drug, x, y, flag}, {type:'warp', x, y, to:{area, room, dir|x,y}}, {type:'boss', boss, x, y}, ... ]
//   onClear: 'open' (open shut doors when enemies cleared)  |  {drop:{...}}
// }
// Coordinates: tile coords (0..19, 0..11) INCLUDING the border row/col.
// ============================================================================
import { TILE, ROOM_W, ROOM_H } from './const.js';
import { T, CHAR_TILE, SOLID } from './tiles.js';
import { tileAtlas, THEMES, mkCanvas, PROPS, propCanvas } from './gfx.js';
import { mulberry32, hashStr } from './util.js';

export const DIRS = ['n', 'e', 's', 'w'];
export const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
const DIR_D = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

const EXIT_TILE = { open: T.FLOOR, locked: T.DOOR_LOCKED, boss: T.DOOR_BOSS, shut: T.DOOR_SHUT, biofilm: T.BIOFILM, wall: T.WALL, abscess: T.ABSCESS };

/** Tiles occupied by an exit opening on a side (2 tiles wide) */
export function exitTiles(dir) {
  const cx = ROOM_W / 2, cy = ROOM_H / 2; // 10, 6
  if (dir === 'n') return [[cx - 1, 0], [cx, 0]];
  if (dir === 's') return [[cx - 1, ROOM_H - 1], [cx, ROOM_H - 1]];
  if (dir === 'w') return [[0, cy - 1], [0, cy]];
  return [[ROOM_W - 1, cy - 1], [ROOM_W - 1, cy]];
}

export class Room {
  constructor(areaId, id, spec, area) {
    this.areaId = areaId; this.id = id; this.spec = spec; this.area = area;
    this.gx = spec.gx; this.gy = spec.gy; this.name = spec.name || area.name || '';
    this.theme = spec.theme || area.theme || 'cave';
    this.music = spec.music || area.music || 'overworld';
    this.env = Object.assign({}, area.env || {}, spec.env || {});
    this.exits = {}; for (const d of DIRS) this.exits[d] = spec.exits?.[d] || 'wall';
    this.ents = spec.ents || [];
    this.onClear = spec.onClear || null;
    this.tiles = []; this.cache = null; this.dirty = true; this.liquidPhase = 0;
    this.build();
  }
  build(flags = {}) {
    const alt = (this.spec.alts || []).find((a) => flags[a.flag]);
    const rows = alt ? alt.rows : (this.spec.rows || []);
    if (alt && alt.exits) for (const d of DIRS) if (alt.exits[d]) this.exits[d] = alt.exits[d];
    this.tiles = [];
    const th = this.theme;
    const rng = mulberry32(hashStr(this.id));
    for (let y = 0; y < ROOM_H; y++) {
      const row = [];
      for (let x = 0; x < ROOM_W; x++) {
        let t;
        if (y === 0 || y === ROOM_H - 1 || x === 0 || x === ROOM_W - 1) t = T.WALL;
        else { const ch = rows[y - 1]?.[x - 1] ?? '.'; t = CHAR_TILE[ch] ?? T.FLOOR; }
        row.push(t);
      }
      this.tiles.push(row);
    }
    // exits
    for (const d of DIRS) {
      const type = this.exits[d]; if (type === 'wall') continue;
      const tt = EXIT_TILE[type] ?? T.FLOOR;
      for (const [x, y] of exitTiles(d)) this.tiles[y][x] = tt;
    }
    // props: mark footprint solid (doors stay walkable)
    this.props = (alt && alt.props) || this.spec.props || [];
    for (const [kind, px, py] of this.props) {
      const P = PROPS[kind]; if (!P) continue;
      const doors = new Set((P.door || []).map(([dx, dy]) => `${dx},${dy}`));
      for (let j = 0; j < P.h; j++) for (let i = 0; i < P.w; i++) {
        if (doors.has(`${i},${j}`)) continue;
        const tx = px + i, ty = py + j;
        if (tx > 0 && ty > 0 && tx < ROOM_W - 1 && ty < ROOM_H - 1) this.tiles[ty][tx] = T.PROP;
      }
    }
    // variant map for floor/wall randomness
    this.variants = [];
    for (let y = 0; y < ROOM_H; y++) { const r = []; for (let x = 0; x < ROOM_W; x++) r.push(Math.floor(rng() * 4)); this.variants.push(r); }
    this.dirty = true;
  }
  tileAt(tx, ty) { if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H) return T.WALL; return this.tiles[ty][tx]; }
  setTile(tx, ty, t) { if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H) return; this.tiles[ty][tx] = t; this.dirty = true; }
  typeAtPx(px, py) { return this.tileAt(Math.floor(px / TILE), Math.floor(py / TILE)); }
  solidAt(px, py, opts = {}) {
    const t = this.typeAtPx(px, py);
    if (opts.flying && t === T.LIQUID) return false;
    if (opts.flying && t === T.HAZARD) return false;
    return SOLID.has(t);
  }
  /** Is the rect free of solids? */
  rectFree(x, y, w, h, opts) {
    return !this.solidAt(x, y, opts) && !this.solidAt(x + w - 1, y, opts) && !this.solidAt(x, y + h - 1, opts) && !this.solidAt(x + w - 1, y + h - 1, opts)
      && !this.solidAt(x + w / 2, y, opts) && !this.solidAt(x + w / 2, y + h - 1, opts) && !this.solidAt(x, y + h / 2, opts) && !this.solidAt(x + w - 1, y + h / 2, opts);
  }
  setExit(dir, type) { this.exits[dir] = type; const tt = EXIT_TILE[type] ?? T.FLOOR; for (const [x, y] of exitTiles(dir)) this.tiles[y][x] = tt; this.dirty = true; }
  openExit(dir) { if (this.exits[dir] !== 'wall') this.setExit(dir, 'open'); }
  shutAll() { for (const d of DIRS) if (this.exits[d] === 'open') { this.setExit(d, 'shut'); this._wasOpen = this._wasOpen || {}; this._wasOpen[d] = true; } }
  unshutAll() { for (const d of DIRS) if (this.exits[d] === 'shut') this.setExit(d, 'open'); }
  /** Which exit direction does a rect leave through? returns dir or null */
  exitDir(x, y, w, h) {
    const cx = x + w / 2, cy = y + h / 2;
    if (cy < 2) return 'n';
    if (cy > ROOM_H * TILE - 2) return 's';
    if (cx < 2) return 'w';
    if (cx > ROOM_W * TILE - 2) return 'e';
    return null;
  }
  /** Player entry position when arriving from direction `from` (the side they appear at) */
  entryPos(from, w = 12, h = 12) {
    const cx = ROOM_W * TILE / 2 - w / 2, cy = ROOM_H * TILE / 2 - h / 2;
    if (from === 'n') return { x: cx, y: TILE + 2 };
    if (from === 's') return { x: cx, y: (ROOM_H - 1) * TILE - h - 2 };
    if (from === 'w') return { x: TILE + 2, y: cy };
    if (from === 'e') return { x: (ROOM_W - 1) * TILE - w - 2, y: cy };
    return { x: cx, y: cy };
  }
  /** Nearest non-solid tile to (tx,ty) within radius, spiralling out. Returns [tx,ty] or null. */
  nearestFree(tx, ty, radius = 4) {
    const free = (x, y) => x > 0 && y > 0 && x < ROOM_W - 1 && y < ROOM_H - 1 && !SOLID.has(this.tileAt(x, y));
    if (free(tx, ty)) return [tx, ty];
    for (let r = 1; r <= radius; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (free(tx + dx, ty + dy)) return [tx + dx, ty + dy];
      }
    }
    return null;
  }
  /** Find a tile of a given type (e.g., STAIRS) */
  findTile(type) { for (let y = 0; y < ROOM_H; y++) for (let x = 0; x < ROOM_W; x++) if (this.tiles[y][x] === type) return { tx: x, ty: y }; return null; }
  render(ctx, frame) {
    const phase = Math.floor(frame / 12) % 4;
    if (this.dirty || phase !== this.liquidPhase || !this.cache) {
      this.liquidPhase = phase; this.dirty = false;
      if (!this.cache) this.cache = mkCanvas(ROOM_W * TILE, ROOM_H * TILE);
      const c = this.cache.getContext('2d');
      const atlas = tileAtlas(this.theme);
      for (let y = 0; y < ROOM_H; y++) for (let x = 0; x < ROOM_W; x++) {
        const t = this.tiles[y][x]; let arr = atlas[t] || atlas[T.FLOOR];
        let v = this.variants[y][x] % arr.length;
        if (t === T.LIQUID) v = phase % arr.length;
        if (t === T.WALL) { const below = this.tileAt(x, y + 1); v = (below !== T.WALL && below !== T.DOOR_WALL && y < ROOM_H - 1) ? 3 : (this.variants[y][x] % 3); }
        c.drawImage(arr[v], x * TILE, y * TILE);
      }
      // props drawn on top of the tile layer
      for (const [kind, px, py] of this.props) { const pc = propCanvas(kind, this.theme); if (pc) c.drawImage(pc, px * TILE, py * TILE); }
      // darkness overlay hint for env.dark
      if (this.env.dark) { c.fillStyle = 'rgba(0,0,20,0.25)'; c.fillRect(0, 0, ROOM_W * TILE, ROOM_H * TILE); }
    }
    ctx.drawImage(this.cache, 0, 0);
  }
}

export class World {
  constructor(data) {
    this.data = data; this.areas = {};
    for (const [aid, a] of Object.entries(data.areas)) {
      const area = { id: aid, spec: a, name: a.name, theme: a.theme, music: a.music, env: a.env, rooms: new Map(), grid: new Map(), dungeon: a.dungeon || null, boss: a.boss || null };
      for (const [rid, spec] of Object.entries(a.rooms)) {
        const room = new Room(aid, rid, spec, area);
        area.rooms.set(rid, room); area.grid.set(`${spec.gx},${spec.gy}`, room);
      }
      this.areas[aid] = area;
    }
  }
  room(areaId, roomId) { return this.areas[areaId]?.rooms.get(roomId) || null; }
  neighbor(room, dir) { const [dx, dy] = DIR_D[dir]; return this.areas[room.areaId].grid.get(`${room.gx + dx},${room.gy + dy}`) || null; }
  roomAt(areaId, gx, gy) { return this.areas[areaId]?.grid.get(`${gx},${gy}`) || null; }
}

export { validateWorld } from './worldcheck.js';
