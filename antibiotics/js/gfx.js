// ============================================================================
// Graphics: palette, pixel sprites, procedural tiles, bug renderer, text
// ============================================================================
import { TILE } from './const.js';
import { mulberry32, hashStr, TAU, clamp } from './util.js';

export const FONT = '"Press Start 2P", monospace';

export function mkCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return c;
}

// ---------------------------------------------------------------------------
// Pixel sprites from strings
// ---------------------------------------------------------------------------
export function makeSprite(rows, pal, scale = 1) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const c = mkCanvas(w * scale, h * scale), x = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let i = 0; i < rows[y].length; i++) {
    const ch = rows[y][i]; if (ch === '.' || ch === ' ') continue;
    const col = pal[ch]; if (!col) continue;
    x.fillStyle = col; x.fillRect(i * scale, y * scale, scale, scale);
  }
  return c;
}
export function flipH(c) {
  const o = mkCanvas(c.width, c.height), x = o.getContext('2d');
  x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0); return o;
}

const HERO_PAL = { k: '#1b1b2f', s: '#f1c27d', h: '#5a3825', w: '#f8f9fa', g: '#cfd4da', b: '#3a86ff', d: '#2457c5', e: '#111', m: '#d4a373', t: '#2b2d42', r: '#e63946' };

const HERO_DOWN = [
  '......kkkk......', '.....khhhhk.....', '....khhhhhhk....', '....khhhhhhk....', '....kssssssk....', '....ksessesk....', '....kssssssk....', '.....kssssk.....',
  '....kwwbbwwk....', '...kwtwbbwtwk...', '...kwtwwwwtwk...', '...kswwwwwwsk...', '...kkwwwwwwkk...', '....kbbkkbbk....', '....kbbk.kbbk...', '....kkk..kkk....'];
const HERO_UP = [
  '......kkkk......', '.....khhhhk.....', '....khhhhhhk....', '....khhhhhhk....', '....khhhhhhk....', '....khhhhhhk....', '....khhhhhhk....', '.....khhhhk.....',
  '....kwwwwwwk....', '...kwwwwwwwwk...', '...kwwggggwwk...', '...kswwwwwwsk...', '...kkwwwwwwkk...', '....kbbkkbbk....', '....kbbk.kbbk...', '....kkk..kkk....'];
const HERO_RIGHT = [
  '......kkkk......', '.....khhhhk.....', '....khhhhhhk....', '....khhhhhsk....', '....khhsssek....', '....khhssssk....', '....khhsssmk....', '.....kssssk.....',
  '.....kwwwwk.....', '....kwtwwwsk....', '....kwtwwwwk....', '....kwwwwwwk....', '....kkwwwwkk....', '.....kbbbbk.....', '.....kbbkbbk....', '.....kkk.kkk....'];
function legFrames(base) {
  const stand = base;
  const l = base.slice(); l[13] = '....kbbkkbbk....'; l[14] = '....kkk..kbbk...'; l[15] = '.........kkk....';
  const r = base.slice(); r[13] = '....kbbkkbbk....'; r[14] = '....kbbk.kkk....'; r[15] = '....kkk.........';
  return [stand, l, stand, r];
}
function legFramesSide(base) {
  const stand = base;
  const a = base.slice(); a[13] = '.....kbbbbk.....'; a[14] = '....kbbk.kbbk...'; a[15] = '....kkk...kkk...';
  const b = base.slice(); b[13] = '.....kbbbbk.....'; b[14] = '......kbbk......'; b[15] = '......kkk.......';
  return [stand, a, stand, b];
}
export const HERO = (() => {
  const down = legFrames(HERO_DOWN).map((r) => makeSprite(r, HERO_PAL));
  const up = legFrames(HERO_UP).map((r) => makeSprite(r, HERO_PAL));
  const right = legFramesSide(HERO_RIGHT).map((r) => makeSprite(r, HERO_PAL));
  const left = right.map(flipH);
  return { 0: down, 1: left, 2: up, 3: right }; // 0=down 1=left 2=up 3=right
})();

// NPC base (palette-swappable)
const NPC_DOWN = [
  '......kkkk......', '.....khhhhk.....', '....khhhhhhk....', '....khhhhhhk....', '....kssssssk....', '....ksessesk....', '....kssssssk....', '.....kssmsk.....',
  '....kccccccK....', '...kcccccccck...', '...kcccccccck...', '...kscccccccsk..', '...kkccccccckk..', '....kppkkppk....', '....kppk.kppk...', '....kkk..kkk....'];
export function makeNpcSprite(pal) {
  const p = { k: '#1b1b2f', s: pal.skin || '#f1c27d', h: pal.hair || '#5a3825', e: '#111', m: '#d4a373', c: pal.coat || '#f8f9fa', K: '#1b1b2f', p: pal.pants || '#495057' };
  return makeSprite(NPC_DOWN, p);
}
export const NPCS = {
  fleming: makeNpcSprite({ hair: '#e9ecef', coat: '#f8f9fa', pants: '#343a40' }),
  nurse: makeNpcSprite({ hair: '#8d5524', coat: '#74c0fc', pants: '#1864ab' }),
  pharmacist: makeNpcSprite({ hair: '#212529', coat: '#b2f2bb', pants: '#2b8a3e', skin: '#c68642' }),
  attending: makeNpcSprite({ hair: '#868e96', coat: '#212529', pants: '#212529', skin: '#8d5524' }),
  labtech: makeNpcSprite({ hair: '#e76f51', coat: '#ffe066', pants: '#495057' }),
  villager: makeNpcSprite({ hair: '#7f5539', coat: '#f4a261', pants: '#6c584c' }),
  villager2: makeNpcSprite({ hair: '#212529', coat: '#b5179e', pants: '#3a0ca3', skin: '#f1c27d' }),
  kid: makeNpcSprite({ hair: '#ffd166', coat: '#ff6b6b', pants: '#1d3557' }),
  elder: makeNpcSprite({ hair: '#dee2e6', coat: '#9c6644', pants: '#5e503f', skin: '#c68642' }),
  patient: makeNpcSprite({ hair: '#4a4e69', coat: '#e0fbfc', pants: '#e0fbfc' }),
  sign: makeSprite(['................', '................', '..kkkkkkkkkkkk..', '..kwwwwwwwwwwk..', '..kwkkkwkkkkwk..', '..kwwwwwwwwwwk..', '..kwkkkkkwkkwk..', '..kwwwwwwwwwwk..', '..kkkkkkkkkkkk..', '.......kk.......', '.......kk.......', '.......kk.......', '.......kk.......', '......kkkk......', '................', '................'], { k: '#5a3a22', w: '#d9a066' }),
  microscope: makeSprite(['................', '......kkk.......', '.....kggggk.....', '.....kgkkk......', '......kgk.......', '.......kgk......', '.......kgkk.....', '......kgggk.....', '......kgkgk.....', '.....kkkkkk.....', '....kggggggk....', '....kgkkkkgk....', '...kggggggggk...', '..kkkkkkkkkkkk..', '..kwwwwwwwwwwk..', '..kkkkkkkkkkkk..'], { k: '#1b1b2f', g: '#adb5bd', w: '#dee2e6' }),
  bed: makeSprite(['................', '................', '................', '..kkkkkkkkkkkk..', '..kwwwwwwwwwwk..', '..kwbbbbbbbbwk..', '..kwbbbbbbbbwk..', '..kwwwwwwwwwwk..', '..kkkkkkkkkkkk..', '..k..........k..', '..k..........k..', '................', '................', '................', '................', '................'], { k: '#495057', w: '#f8f9fa', b: '#74c0fc' }),
};

// ---------------------------------------------------------------------------
// Themes & tiles
// ---------------------------------------------------------------------------
export const THEMES = {
  skin:    { name: 'Dermis Plains',    floor: '#f2c6a0', floor2: '#e9b88f', wall: '#b8744a', wallTop: '#d08b5b', wallDark: '#7a4a2c', liquid: '#8ecae6', liquid2: '#68b3d6', obst: '#a15c3e', obst2: '#c97b5a', decor: '#e0a77c', sky: '#f7d9c4' },
  village: { name: 'Keratin Village',  floor: '#e7c9a3', floor2: '#dcb98d', wall: '#8b5e3c', wallTop: '#b07a4c', wallDark: '#5a3a22', liquid: '#8ecae6', liquid2: '#68b3d6', obst: '#6c8a3c', obst2: '#8db04e', decor: '#cfa77a', sky: '#f1e0c8' },
  throat:  { name: 'Pharynx Caverns',  floor: '#f1a7b7', floor2: '#e78fa3', wall: '#9b2c3f', wallTop: '#c2424f', wallDark: '#5c1523', liquid: '#c8e6a0', liquid2: '#a7d47a', obst: '#d9536a', obst2: '#f07a8c', decor: '#f7c1cc', sky: '#f7c8d2' },
  lung:    { name: 'Lung Fortress',    floor: '#e8b8bc', floor2: '#d9a3a9', wall: '#8d8fa3', wallTop: '#b3b5c8', wallDark: '#55566b', liquid: '#9ad0f5', liquid2: '#70b8ec', obst: '#c97c86', obst2: '#e69aa3', decor: '#f1cfd2', sky: '#ecd1d6' },
  bladder: { name: 'Bladder Depths',   floor: '#f3e6a0', floor2: '#e8d784', wall: '#b89a52', wallTop: '#d9bb6d', wallDark: '#7a6232', liquid: '#ffe066', liquid2: '#f7c948', obst: '#9c9a8a', obst2: '#bdbbad', decor: '#f8efc0', sky: '#f8f0c8' },
  gut:     { name: 'Gut Labyrinth',    floor: '#d9a066', floor2: '#c88f56', wall: '#7a4a24', wallTop: '#9c6436', wallDark: '#4a2b12', liquid: '#9ab973', liquid2: '#7da05a', obst: '#b5651d', obst2: '#d1823a', decor: '#e6b07a', sky: '#e8c9a0' },
  heart:   { name: 'Heart Citadel',    floor: '#a32634', floor2: '#8f1e2c', wall: '#5a0f16', wallTop: '#7f1a25', wallDark: '#33060a', liquid: '#e63946', liquid2: '#c9242f', obst: '#f2d0a4', obst2: '#f8e2c1', decor: '#b8434f', sky: '#c8505a' },
  brain:   { name: 'Brain Citadel',    floor: '#d7c7df', floor2: '#c9b5d3', wall: '#7c6a93', wallTop: '#a28db9', wallDark: '#4b3d5e', liquid: '#b5e2fa', liquid2: '#8fd0f3', obst: '#9a7fb0', obst2: '#b69fc9', decor: '#e7dcec', sky: '#e4d8ec' },
  icu:     { name: 'Resistance Nexus', floor: '#2b2d42', floor2: '#25273a', wall: '#5c677d', wallTop: '#7d8aa3', wallDark: '#353c4d', liquid: '#7209b7', liquid2: '#560bd0', obst: '#4a4e69', obst2: '#6c7093', decor: '#3a3d56', sky: '#1a1b2b', glow: '#b5179e' },
  bone:    { name: 'Marrow Mountain',  floor: '#e9e4d0', floor2: '#ddd6bd', wall: '#b9b08f', wallTop: '#d6ceae', wallDark: '#7f7860', liquid: '#d96c6c', liquid2: '#c45151', obst: '#a39e8a', obst2: '#bfb9a3', decor: '#f1edde', sky: '#eee8d5' },
  cave:    { name: 'Cave',             floor: '#6b6b7b', floor2: '#5d5d6c', wall: '#3b3b4b', wallTop: '#55556a', wallDark: '#22222e', liquid: '#4ea8de', liquid2: '#3b8fc5', obst: '#8a8a9a', obst2: '#a2a2b2', decor: '#7a7a8a', sky: '#1d1d27' },
};

export { T, CHAR_TILE, SOLID } from './tiles.js';
import { T, CHAR_TILE, SOLID } from './tiles.js';

// Per-biome floor detail, drawn over the speckled base (S = tile size)
const FLOOR_PATTERNS = {
  icu: (x, v, r, th, S) => { x.strokeStyle = 'rgba(180,200,230,0.10)'; x.lineWidth = 1; x.beginPath(); x.moveTo(0.5, 0); x.lineTo(0.5, S); x.moveTo(0, 0.5); x.lineTo(S, 0.5); x.stroke(); if (v === 0) { x.fillStyle = 'rgba(181,23,158,0.10)'; x.fillRect(3, 3, 2, 2); } },
  brain: (x, v, r, th, S) => { x.strokeStyle = 'rgba(120,90,150,0.22)'; x.lineWidth = 1; x.beginPath(); for (let i = 0; i <= S; i += 2) x.lineTo(i, 6 + Math.sin((i + v * 4) * 0.6) * 3); x.stroke(); x.beginPath(); for (let i = 0; i <= S; i += 2) x.lineTo(i, 13 + Math.cos((i + v * 3) * 0.5) * 2.5); x.stroke(); },
  gut: (x, v, r, th, S) => { x.fillStyle = 'rgba(120,70,20,0.16)'; for (let yy = (v * 3) % 6; yy < S; yy += 6) x.fillRect(0, yy, S, 1); x.fillStyle = 'rgba(255,220,170,0.18)'; for (let yy = (v * 3) % 6 + 1; yy < S; yy += 6) x.fillRect(0, yy, S, 1); },
  lung: (x, v, r, th, S) => { x.strokeStyle = 'rgba(255,255,255,0.16)'; x.lineWidth = 1; for (let i = 0; i < 2; i++) { const cx = 3 + r() * 10, cy = 3 + r() * 10; x.beginPath(); x.arc(cx, cy, 2.5 + r() * 2, 0, TAU); x.stroke(); } },
  bladder: (x, v, r, th, S) => { x.strokeStyle = 'rgba(255,255,255,0.14)'; x.lineWidth = 1; x.beginPath(); for (let i = 0; i <= S; i += 2) x.lineTo(i, 8 + Math.sin((i + v * 4) * 0.8) * 2); x.stroke(); },
  heart: (x, v, r, th, S) => { x.strokeStyle = 'rgba(255,190,190,0.13)'; x.lineWidth = 1; const a = (v % 2) ? 0.6 : -0.6; x.beginPath(); x.moveTo(0, (v * 5) % S); x.lineTo(S, ((v * 5) % S) + a * S); x.stroke(); },
  bone: (x, v, r, th, S) => { x.fillStyle = 'rgba(150,140,110,0.20)'; for (let i = 0; i < 3; i++) { const cx = r() * S, cy = r() * S; x.beginPath(); x.arc(cx, cy, 1.5 + r(), 0, TAU); x.fill(); } },
  skin: (x, v, r, th, S) => { x.fillStyle = 'rgba(160,90,60,0.16)'; for (let i = 0; i < 3; i++) x.fillRect(Math.floor(r() * S), Math.floor(r() * S), 1, 1); },
  village: (x, v, r, th, S) => { x.strokeStyle = 'rgba(110,140,60,0.30)'; x.lineWidth = 1; if (v % 2 === 0) { const bx = 2 + r() * 12, by = 4 + r() * 10; x.beginPath(); x.moveTo(bx, by); x.lineTo(bx - 1.5, by - 3); x.moveTo(bx, by); x.lineTo(bx + 1.5, by - 3); x.stroke(); } },
  throat: (x, v, r, th, S) => { x.fillStyle = 'rgba(255,255,255,0.18)'; for (let i = 0; i < 3; i++) x.fillRect(Math.floor(r() * S), Math.floor(r() * S), 1, 1); x.strokeStyle = 'rgba(200,60,90,0.15)'; x.beginPath(); x.arc(8, 8, 6, 0, TAU); x.stroke(); },
  cave: (x, v, r, th, S) => { x.strokeStyle = 'rgba(0,0,0,0.20)'; x.lineWidth = 1; if (v % 2) { x.beginPath(); x.moveTo(r() * S, 0); x.lineTo(r() * S, S); x.stroke(); } },
};

const atlasCache = new Map();
/** Build (and cache) the tile atlas for a theme: returns {[tileType]: [canvas variants]} */
export function tileAtlas(themeId) {
  if (atlasCache.has(themeId)) return atlasCache.get(themeId);
  const th = THEMES[themeId] || THEMES.cave;
  const rng = mulberry32(hashStr(themeId));
  const atlas = {};
  const mk = (type, n, fn) => { atlas[type] = []; for (let v = 0; v < n; v++) { const c = mkCanvas(TILE, TILE), x = c.getContext('2d'); fn(x, v, rng); atlas[type].push(c); } };
  const S = TILE;
  // floor: base + speckles + a per-biome pattern
  mk(T.FLOOR, 4, (x, v, r) => {
    x.fillStyle = th.floor; x.fillRect(0, 0, S, S);
    x.fillStyle = th.floor2; for (let i = 0; i < 4 + v; i++) x.fillRect(Math.floor(r() * S), Math.floor(r() * S), 1 + (r() < 0.3 ? 1 : 0), 1);
    const pat = FLOOR_PATTERNS[themeId]; if (pat) pat(x, v, r, th, S);
  });
  mk(T.DECOR, 3, (x, v, r) => { x.drawImage(atlas[T.FLOOR][v % 4], 0, 0); x.fillStyle = th.decor; const cx = 4 + Math.floor(r() * 8), cy = 4 + Math.floor(r() * 8); x.fillRect(cx - 1, cy, 3, 1); x.fillRect(cx, cy - 1, 1, 3); if (v === 2) { x.fillStyle = th.floor2; x.fillRect(2, 10, 4, 1); x.fillRect(10, 3, 3, 1); } });
  mk(T.WALL, 3, (x, v, r) => {
    x.fillStyle = th.wall; x.fillRect(0, 0, S, S);
    x.fillStyle = th.wallTop; x.fillRect(0, 0, S, 2);
    x.fillStyle = th.wallDark; x.fillRect(0, S - 2, S, 2);
    // brick-ish cracks
    x.fillStyle = th.wallDark; for (let i = 0; i < 3; i++) { const bx = Math.floor(r() * S), by = 3 + Math.floor(r() * (S - 6)); x.fillRect(bx, by, 2 + Math.floor(r() * 3), 1); }
    x.fillStyle = th.wallTop; for (let i = 0; i < 2; i++) { x.fillRect(Math.floor(r() * S), 3 + Math.floor(r() * (S - 6)), 1, 1); }
  });
  // wall face variant (used when floor is south of wall): index 3
  atlas[T.WALL].push((() => { const c = mkCanvas(S, S), x = c.getContext('2d'); x.fillStyle = th.wallDark; x.fillRect(0, 0, S, S); x.fillStyle = th.wall; x.fillRect(0, 0, S, 6); x.fillStyle = th.wallTop; x.fillRect(0, 0, S, 1); x.fillStyle = th.wallDark; for (let i = 0; i < S; i += 4) x.fillRect(i, 8, 1, 8); x.fillStyle = th.wall; for (let i = 2; i < S; i += 4) x.fillRect(i, 10, 1, 4); return c; })());
  mk(T.LIQUID, 4, (x, v, r) => { x.fillStyle = th.liquid; x.fillRect(0, 0, S, S); x.fillStyle = th.liquid2; const off = v * 4; for (let yy = 0; yy < S; yy += 8) { x.fillRect((off + 2) % S, yy + 3, 5, 1); x.fillRect((off + 9) % S, yy + 7, 4, 1); } });
  mk(T.OBST, 3, (x, v, r) => { x.drawImage(atlas[T.FLOOR][0], 0, 0); x.fillStyle = th.obst; x.beginPath(); x.ellipse(8, 9, 6, 5, 0, 0, TAU); x.fill(); x.fillStyle = th.obst2; x.beginPath(); x.ellipse(7, 7, 4, 3, 0, 0, TAU); x.fill(); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(3, 14, 10, 1); if (v === 1) { x.fillStyle = th.obst; x.fillRect(6, 3, 3, 2); } if (v === 2) { x.fillStyle = th.obst2; x.fillRect(3, 6, 2, 1); x.fillRect(11, 8, 2, 1); } });
  mk(T.BRIDGE, 1, (x) => { x.drawImage(atlas[T.LIQUID][0], 0, 0); x.fillStyle = '#a47148'; x.fillRect(0, 2, S, S - 4); x.fillStyle = '#7a5230'; for (let i = 0; i < S; i += 4) x.fillRect(i, 2, 1, S - 4); x.fillStyle = '#c9925e'; x.fillRect(0, 2, S, 1); x.fillRect(0, S - 3, S, 1); });
  mk(T.HAZARD, 2, (x, v) => { x.drawImage(atlas[T.FLOOR][0], 0, 0); x.fillStyle = '#c9184a'; for (let i = 0; i < 4; i++) { const bx = 1 + i * 4; x.beginPath(); x.moveTo(bx, 14); x.lineTo(bx + 1.5, 14 - (v ? 9 : 6)); x.lineTo(bx + 3, 14); x.fill(); } x.fillStyle = '#ff758f'; for (let i = 0; i < 4; i++) x.fillRect(1 + i * 4 + 1, 14 - (v ? 8 : 5), 1, 2); });
  mk(T.STAIRS, 1, (x) => { x.fillStyle = '#111'; x.fillRect(0, 0, S, S); x.fillStyle = th.wall; x.fillRect(0, 0, S, 3); x.fillStyle = '#2d2d3a'; for (let i = 0; i < 4; i++) { x.fillStyle = ['#3d3d4d', '#2f2f3d', '#23232e', '#171720'][i]; x.fillRect(2 + i, 4 + i * 3, S - 4 - i * 2, 3); } });
  mk(T.EXIT, 1, (x) => { x.drawImage(atlas[T.FLOOR][0], 0, 0); x.fillStyle = '#fff'; x.globalAlpha = 0.6; x.fillRect(2, 2, S - 4, S - 4); x.globalAlpha = 1; x.fillStyle = '#6fd6ff'; x.fillRect(4, 4, S - 8, S - 8); x.fillStyle = '#fff'; x.fillRect(7, 6, 2, 4); x.fillRect(6, 8, 4, 2); });
  mk(T.DOOR_OPEN, 1, (x) => { x.drawImage(atlas[T.FLOOR][1], 0, 0); x.fillStyle = th.wallDark; x.fillRect(0, 0, 2, S); x.fillRect(S - 2, 0, 2, S); });
  const door = (x, color, sym) => { x.fillStyle = th.wall; x.fillRect(0, 0, S, S); x.fillStyle = color; x.fillRect(2, 1, S - 4, S - 2); x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(2, S - 3, S - 4, 2); x.fillStyle = '#fff'; x.font = '8px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(sym, S / 2, S / 2); };
  mk(T.DOOR_LOCKED, 1, (x) => door(x, '#b08968', '🔒'.length ? '' : ''));
  // locked door: draw keyhole
  atlas[T.DOOR_LOCKED] = [(() => { const c = mkCanvas(S, S), x = c.getContext('2d'); x.fillStyle = th.wall; x.fillRect(0, 0, S, S); x.fillStyle = '#8a6a4a'; x.fillRect(2, 1, S - 4, S - 2); x.fillStyle = '#c8a27a'; x.fillRect(3, 2, S - 6, 2); x.fillStyle = '#2b2b2b'; x.fillRect(7, 6, 2, 2); x.fillRect(7, 8, 2, 4); x.fillStyle = '#ffd166'; x.fillRect(6, 5, 4, 1); return c; })()];
  atlas[T.DOOR_BOSS] = [(() => { const c = mkCanvas(S, S), x = c.getContext('2d'); x.fillStyle = th.wall; x.fillRect(0, 0, S, S); x.fillStyle = '#5c0b0b'; x.fillRect(2, 1, S - 4, S - 2); x.fillStyle = '#e63946'; x.fillRect(3, 2, S - 6, 2); x.fillStyle = '#ffd166'; x.fillRect(6, 5, 4, 2); x.fillRect(5, 7, 6, 2); x.fillRect(7, 9, 2, 3); x.fillStyle = '#111'; x.fillRect(7, 6, 2, 1); return c; })()];
  atlas[T.DOOR_SHUT] = [(() => { const c = mkCanvas(S, S), x = c.getContext('2d'); x.fillStyle = th.wall; x.fillRect(0, 0, S, S); x.fillStyle = '#6c757d'; x.fillRect(2, 1, S - 4, S - 2); x.fillStyle = '#adb5bd'; for (let i = 2; i < S - 2; i += 3) x.fillRect(2, i, S - 4, 1); return c; })()];
  atlas[T.DOOR_WALL] = [(() => { const c = mkCanvas(S, S), x = c.getContext('2d'); x.drawImage(atlas[T.WALL][0], 0, 0); return c; })()];
  mk(T.BIOFILM, 2, (x, v, r) => { x.fillStyle = th.wall; x.fillRect(0, 0, S, S); x.fillStyle = '#2ec4b6'; x.globalAlpha = 0.85; x.beginPath(); x.ellipse(8, 8, 7, 6, 0, 0, TAU); x.fill(); x.globalAlpha = 1; x.fillStyle = '#80ffdb'; for (let i = 0; i < 5; i++) x.fillRect(2 + Math.floor(r() * 12), 2 + Math.floor(r() * 12), 2, 1); x.fillStyle = '#0b6e4f'; x.fillRect(4, 12, 8, 1); });
  mk(T.ABSCESS, 2, (x, v, r) => { x.drawImage(atlas[T.FLOOR][0], 0, 0); x.fillStyle = '#e5989b'; x.beginPath(); x.ellipse(8, 9, 7, 6, 0, 0, TAU); x.fill(); x.fillStyle = '#f7ede2'; x.beginPath(); x.ellipse(8, 9, 4, 3, 0, 0, TAU); x.fill(); x.fillStyle = '#ffd166'; x.fillRect(7, 8, 2, 2); x.fillStyle = '#b5838d'; x.fillRect(3, 13, 10, 1); });
  mk(T.PILLAR, 2, (x, v) => { x.drawImage(atlas[T.FLOOR][0], 0, 0); x.fillStyle = th.wallDark; x.fillRect(4, 2, 8, 13); x.fillStyle = th.wallTop; x.fillRect(4, 2, 8, 2); x.fillStyle = th.wall; x.fillRect(5, 4, 6, 10); x.fillStyle = th.wallTop; x.fillRect(6, 5, 1, 8); if (v) { x.fillStyle = '#ffd166'; x.fillRect(7, 6, 2, 2); } });
  mk(T.HEAL, 1, (x) => { x.drawImage(atlas[T.FLOOR][0], 0, 0); x.fillStyle = '#fff'; x.fillRect(3, 3, 10, 10); x.fillStyle = '#e63946'; x.fillRect(7, 4, 2, 8); x.fillRect(4, 7, 8, 2); });
  mk(T.PORTAL, 2, (x, v) => { x.fillStyle = '#0b0b1e'; x.fillRect(0, 0, S, S); x.fillStyle = v ? '#7209b7' : '#b5179e'; x.beginPath(); x.ellipse(8, 8, 7, 7, 0, 0, TAU); x.fill(); x.fillStyle = '#f72585'; x.beginPath(); x.ellipse(8, 8, 4, 4, 0, 0, TAU); x.fill(); x.fillStyle = '#fff'; x.fillRect(7, 7, 2, 2); });
  atlas[T.PROP] = atlas[T.FLOOR];
  mk(T.SPECIAL, 1, (x) => { x.drawImage(atlas[T.FLOOR][0], 0, 0); x.fillStyle = th.decor; x.fillRect(2, 2, 12, 12); x.fillStyle = th.floor; x.fillRect(4, 4, 8, 8); });
  atlasCache.set(themeId, atlas);
  return atlas;
}


// ---------------------------------------------------------------------------
// Multi-tile props (huts, trees, machines, organ decor). Drawn into the room
// cache; their footprint (minus `door` tiles) becomes solid.
// PROPS[kind] = { w, h, door:[[x,y]..], draw(ctx, theme, rng) }  (ctx origin = prop top-left, units = px)
// ---------------------------------------------------------------------------
import { PROP_FOOTPRINTS } from './propmeta.js';
export const PROPS = {
  hut: { ...PROP_FOOTPRINTS.hut, draw(c, th) {
    const W = 64, H = 64;
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(2, H - 6, W - 4, 6);
    // body
    c.fillStyle = '#c98f5b'; c.fillRect(4, 22, W - 8, H - 26);
    c.fillStyle = '#a5713f'; c.fillRect(4, 22, W - 8, 3);
    for (let x = 6; x < W - 8; x += 6) { c.fillStyle = 'rgba(0,0,0,0.08)'; c.fillRect(x, 26, 1, H - 32); }
    // roof
    c.fillStyle = '#8b3a2e'; c.beginPath(); c.moveTo(0, 24); c.lineTo(W / 2, 2); c.lineTo(W, 24); c.closePath(); c.fill();
    c.fillStyle = '#a8483a'; c.beginPath(); c.moveTo(3, 23); c.lineTo(W / 2, 5); c.lineTo(W - 3, 23); c.closePath(); c.fill();
    for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(6 + i * 11, 24 - i, 8, 1); }
    // door + window
    c.fillStyle = '#2b1b10'; c.fillRect(22, 40, 20, 24);
    c.fillStyle = '#3d2718'; c.fillRect(24, 42, 16, 22);
    c.fillStyle = '#ffd166'; c.fillRect(10, 30, 8, 7); c.fillRect(46, 30, 8, 7);
    c.fillStyle = '#8a6a00'; c.fillRect(13, 30, 2, 7); c.fillRect(49, 30, 2, 7);
  } },
  shop: { ...PROP_FOOTPRINTS.shop, draw(c) {
    const W = 64, H = 64;
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(2, H - 6, W - 4, 6);
    c.fillStyle = '#e9ecef'; c.fillRect(4, 20, W - 8, H - 24);
    c.fillStyle = '#adb5bd'; c.fillRect(4, 20, W - 8, 3);
    c.fillStyle = '#2b8a3e'; c.beginPath(); c.moveTo(0, 22); c.lineTo(W / 2, 2); c.lineTo(W, 22); c.closePath(); c.fill();
    c.fillStyle = '#40c057'; c.beginPath(); c.moveTo(4, 21); c.lineTo(W / 2, 6); c.lineTo(W - 4, 21); c.closePath(); c.fill();
    c.fillStyle = '#e63946'; c.fillRect(26, 26, 4, 12); c.fillRect(22, 30, 12, 4);
    c.fillStyle = '#212529'; c.fillRect(22, 40, 20, 24);
    c.fillStyle = '#495057'; c.fillRect(24, 42, 16, 22);
    c.fillStyle = '#74c0fc'; c.fillRect(8, 44, 10, 10); c.fillRect(46, 44, 10, 10);
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(9, 45, 4, 4); c.fillRect(47, 45, 4, 4);
  } },
  tree: { ...PROP_FOOTPRINTS.tree, draw(c, th) {
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(16, 28, 9, 3, 0, 0, TAU); c.fill();
    c.fillStyle = '#6b4423'; c.fillRect(14, 16, 4, 12);
    c.fillStyle = th.obst || '#2d6a4f'; c.beginPath(); c.arc(16, 12, 11, 0, TAU); c.fill();
    c.fillStyle = th.obst2 || '#40916c'; c.beginPath(); c.arc(13, 9, 7, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.arc(11, 7, 3, 0, TAU); c.fill();
  } },
  villus: { ...PROP_FOOTPRINTS.villus, draw(c, th) { // gut villus
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(16, 44, 9, 3, 0, 0, TAU); c.fill();
    const g = c.createLinearGradient(0, 0, 0, 46); g.addColorStop(0, th.obst2 || '#d1823a'); g.addColorStop(1, th.obst || '#b5651d');
    c.fillStyle = g; c.beginPath(); c.moveTo(8, 44); c.quadraticCurveTo(4, 16, 16, 3); c.quadraticCurveTo(28, 16, 24, 44); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.2)'; c.beginPath(); c.moveTo(12, 40); c.quadraticCurveTo(10, 18, 16, 8); c.lineTo(18, 12); c.quadraticCurveTo(14, 22, 15, 40); c.closePath(); c.fill();
  } },
  alveolus: { ...PROP_FOOTPRINTS.alveolus, draw(c, th) {
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.ellipse(24, 42, 15, 4, 0, 0, TAU); c.fill();
    c.fillStyle = th.obst || '#c97c86'; c.beginPath(); c.arc(24, 24, 20, 0, TAU); c.fill();
    c.fillStyle = th.obst2 || '#e69aa3'; c.beginPath(); c.arc(24, 24, 16, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(18, 18, 6, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.15)'; c.lineWidth = 1; for (let i = 0; i < 6; i++) { const a = i * TAU / 6; c.beginPath(); c.moveTo(24, 24); c.lineTo(24 + Math.cos(a) * 16, 24 + Math.sin(a) * 16); c.stroke(); }
  } },
  neuron: { ...PROP_FOOTPRINTS.neuron, draw(c, th) {
    c.strokeStyle = th.obst || '#9a7fb0'; c.lineWidth = 2;
    for (let i = 0; i < 7; i++) { const a = i * TAU / 7 + 0.3; c.beginPath(); c.moveTo(24, 24); const mx = 24 + Math.cos(a) * 14, my = 24 + Math.sin(a) * 14; c.quadraticCurveTo(24 + Math.cos(a + 0.5) * 10, 24 + Math.sin(a + 0.5) * 10, mx, my); c.stroke(); }
    c.fillStyle = th.obst2 || '#b69fc9'; c.beginPath(); c.arc(24, 24, 9, 0, TAU); c.fill();
    c.fillStyle = '#e7dcec'; c.beginPath(); c.arc(22, 22, 4, 0, TAU); c.fill();
  } },
  monitor: { ...PROP_FOOTPRINTS.monitor, draw(c) {
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(4, 42, 24, 5);
    c.fillStyle = '#495057'; c.fillRect(13, 26, 6, 18); c.fillRect(8, 42, 16, 4);
    c.fillStyle = '#212529'; c.fillRect(2, 2, 28, 24);
    c.fillStyle = '#0b3d2e'; c.fillRect(4, 4, 24, 20);
    c.strokeStyle = '#52ff9a'; c.lineWidth = 1; c.beginPath(); c.moveTo(5, 16); c.lineTo(10, 16); c.lineTo(12, 8); c.lineTo(14, 20); c.lineTo(16, 16); c.lineTo(27, 16); c.stroke();
    c.fillStyle = '#ff4d6d'; c.fillRect(24, 6, 2, 2);
  } },
  ivpole: { ...PROP_FOOTPRINTS.ivpole, draw(c) {
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(8, 45, 6, 2, 0, 0, TAU); c.fill();
    c.fillStyle = '#adb5bd'; c.fillRect(7, 6, 2, 39);
    c.fillStyle = '#868e96'; c.fillRect(3, 44, 10, 2);
    c.fillStyle = '#dee2e6'; c.fillRect(9, 6, 8, 3);
    c.fillStyle = 'rgba(200,230,255,0.85)'; c.fillRect(10, 8, 6, 11); c.fillStyle = '#74c0fc'; c.fillRect(10, 13, 6, 6);
    c.strokeStyle = '#ced4da'; c.lineWidth = 1; c.beginPath(); c.moveTo(13, 19); c.quadraticCurveTo(16, 28, 12, 36); c.stroke();
  } },
  crystal: { ...PROP_FOOTPRINTS.crystal, draw(c, th) {
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(16, 28, 8, 3, 0, 0, TAU); c.fill();
    c.fillStyle = th.liquid || '#ffe066'; c.beginPath(); c.moveTo(16, 2); c.lineTo(25, 16); c.lineTo(20, 29); c.lineTo(12, 29); c.lineTo(7, 16); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.moveTo(16, 4); c.lineTo(22, 16); c.lineTo(16, 20); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1; c.stroke();
  } },
  bone: { ...PROP_FOOTPRINTS.bone, draw(c) {
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(24, 27, 18, 3, 0, 0, TAU); c.fill();
    c.fillStyle = '#f1edde'; c.fillRect(10, 12, 28, 9);
    c.beginPath(); c.arc(10, 12, 6, 0, TAU); c.arc(10, 21, 6, 0, TAU); c.arc(38, 12, 6, 0, TAU); c.arc(38, 21, 6, 0, TAU); c.fill();
    c.fillStyle = '#d6d0bb'; c.fillRect(12, 18, 24, 3);
  } },
  vessel: { ...PROP_FOOTPRINTS.vessel, draw(c, th) {
    c.fillStyle = th.liquid || '#e63946'; c.fillRect(0, 8, 64, 16);
    c.fillStyle = th.liquid2 || '#c9242f'; c.fillRect(0, 8, 64, 3); c.fillRect(0, 21, 64, 3);
    c.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 4; i++) c.fillRect(6 + i * 16, 13, 7, 2);
  } },
  bed: { ...PROP_FOOTPRINTS.bed, draw(c) {
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(4, 26, 40, 4);
    c.fillStyle = '#adb5bd'; c.fillRect(4, 6, 40, 20);
    c.fillStyle = '#f8f9fa'; c.fillRect(6, 8, 36, 16);
    c.fillStyle = '#74c0fc'; c.fillRect(6, 14, 36, 10);
    c.fillStyle = '#dee2e6'; c.fillRect(8, 9, 10, 6);
    c.fillStyle = '#868e96'; c.fillRect(2, 4, 3, 24); c.fillRect(43, 4, 3, 24);
  } },
};
const propCache = new Map();
export function propCanvas(kind, themeId) {
  const key = kind + '|' + themeId;
  if (propCache.has(key)) return propCache.get(key);
  const P = PROPS[kind]; if (!P) return null;
  const c = mkCanvas(P.w * TILE, P.h * TILE); const x = c.getContext('2d');
  P.draw(x, THEMES[themeId] || THEMES.cave);
  propCache.set(key, c); return c;
}

// ---------------------------------------------------------------------------
// Bug renderer (procedural)
// ---------------------------------------------------------------------------
function rr(x, y, w, h, r, c) { // rounded rect path
  c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}
function circ(c, x, y, r, fill, stroke) { c.beginPath(); c.arc(x, y, r, 0, TAU); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); } }

/**
 * Draw a bacterium centered at (x,y).
 * opts: { t (time), size, angle (movement dir), vis, flash, stasis, hiding, dormant, scale, boss, hpFrac }
 */
export function drawBug(c, bug, x, y, opts = {}) {
  const vis = opts.vis || bug.vis, t = opts.t || 0, sz = (opts.size || bug.size || 12) * (opts.scale || 1);
  const r = sz / 2, ang = opts.angle ?? 0;
  const col = opts.flash ? '#ffffff' : (opts.stasis ? mix(vis.color, '#90e0ef', 0.5) : vis.color), dark = opts.flash ? '#ffffff' : vis.dark;
  const wob = 1 + Math.sin(t * 0.15 + (opts.seed || 0)) * 0.06;
  c.save(); c.translate(Math.round(x), Math.round(y));
  // shadow / slime / glow underneath
  if (vis.slime) { c.fillStyle = vis.slime; c.globalAlpha = 0.45; c.beginPath(); c.ellipse(0, r * 0.6, r * 1.4, r * 0.55, 0, 0, TAU); c.fill(); c.globalAlpha = 1; }
  else { c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(0, r * 0.8, r * 0.9, r * 0.3, 0, 0, TAU); c.fill(); }
  if (vis.glow) { c.fillStyle = vis.glow; c.globalAlpha = 0.18 + 0.08 * Math.sin(t * 0.2); c.beginPath(); c.arc(0, 0, r * 1.5, 0, TAU); c.fill(); c.globalAlpha = 1; }
  if (opts.hiding || vis.host && opts.hostShown) { // host cell
    c.fillStyle = 'rgba(255,214,165,0.55)'; c.beginPath(); c.arc(0, 0, r * 1.7, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(160,100,60,0.7)'; c.lineWidth = 1; c.stroke();
    c.fillStyle = 'rgba(120,70,40,0.5)'; c.beginPath(); c.arc(r * 0.9, -r * 0.8, r * 0.5, 0, TAU); c.fill();
  }
  if (vis.aura) { // β-lactamase aura
    c.strokeStyle = vis.aura; c.globalAlpha = 0.55 + 0.3 * Math.sin(t * 0.25); c.lineWidth = 1; c.beginPath(); c.arc(0, 0, r * 1.45 + Math.sin(t * 0.1), 0, TAU); c.stroke();
    c.globalAlpha = 0.25; c.fillStyle = vis.aura; c.beginPath(); c.arc(0, 0, r * 1.45, 0, TAU); c.fill(); c.globalAlpha = 1;
  }
  if (bug.traits?.includes('capsule') || vis.capsuleThick) { c.fillStyle = 'rgba(255,255,255,0.28)'; c.beginPath(); c.ellipse(0, 0, r * (vis.capsuleThick ? 1.45 : 1.3), r * (vis.capsuleThick ? 1.3 : 1.25), 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,255,255,0.5)'; c.stroke(); }
  c.scale(wob, 1 / wob);
  // flagella
  if (vis.flagella) {
    c.strokeStyle = dark; c.lineWidth = 1; c.globalAlpha = 0.9;
    const n = vis.flagella;
    for (let i = 0; i < n; i++) {
      const a = ang + Math.PI + (n > 1 ? (i / (n - 1) - 0.5) * 1.6 : 0);
      c.beginPath(); const sx = Math.cos(a) * r * 0.9, sy = Math.sin(a) * r * 0.9; c.moveTo(sx, sy);
      for (let k = 1; k <= 4; k++) { const d = r * 0.9 + k * 2.2; const w = Math.sin(t * 0.5 + k * 1.3 + i) * 1.6; c.lineTo(Math.cos(a) * d - Math.sin(a) * w, Math.sin(a) * d + Math.cos(a) * w); }
      c.stroke();
    }
    c.globalAlpha = 1;
  }
  const shape = vis.shape;
  const body = (fx, fy, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(fx, fy, rx, ry, rot, 0, TAU); c.fillStyle = col; c.fill(); c.strokeStyle = dark; c.lineWidth = 1; c.stroke(); c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(fx - rx * 0.3, fy - ry * 0.35, rx * 0.35, ry * 0.25, rot, 0, TAU); c.fill(); };
  switch (shape) {
    case 'coccus': body(0, 0, r, r); break;
    case 'diplo': {
      if (vis.lancet) { body(-r * 0.45, 0, r * 0.5, r * 0.8, -0.3); body(r * 0.45, 0, r * 0.5, r * 0.8, 0.3); }
      else if (vis.kidney) { body(-r * 0.45, 0, r * 0.45, r * 0.7, 0); body(r * 0.45, 0, r * 0.45, r * 0.7, 0); c.fillStyle = dark; c.fillRect(-1, -r * 0.3, 2, r * 0.6); }
      else { body(-r * 0.5, 0, r * 0.55, r * 0.55); body(r * 0.5, 0, r * 0.55, r * 0.55); }
      break;
    }
    case 'chain': { const n = vis.n || 5; for (let i = 0; i < n; i++) { const a = (i - (n - 1) / 2) * (r * 0.75); const yy = Math.sin(t * 0.08 + i * 1.2) * r * 0.35; body(a, yy, r * 0.42, r * 0.42); } break; }
    case 'cluster': { const n = vis.n || 5; const pts = [[0, 0], [-r * 0.6, -r * 0.35], [r * 0.6, -r * 0.3], [-r * 0.35, r * 0.55], [r * 0.4, r * 0.55], [0, -r * 0.75]]; for (let i = 0; i < n; i++) body(pts[i][0], pts[i][1], r * 0.45, r * 0.45); break; }
    case 'rod': { if (vis.swarm && !opts.noSwarm) { body(-r * 0.5, -r * 0.6, r * 0.9, r * 0.38, ang); body(r * 0.4, r * 0.5, r * 0.9, r * 0.38, ang); } body(0, 0, r * 1.1, r * 0.5, ang); if (vis.spore) { c.fillStyle = '#f8f9fa'; c.beginPath(); c.ellipse(Math.cos(ang) * r * 0.8, Math.sin(ang) * r * 0.8, r * 0.42, r * 0.42, 0, 0, TAU); c.fill(); c.strokeStyle = dark; c.stroke(); } break; }
    case 'coccobacillus': body(0, 0, r * 0.8, r * 0.55, ang); break;
    case 'spiral': { c.strokeStyle = dark; c.lineWidth = 3; c.beginPath(); for (let i = -8; i <= 8; i++) { const px = i * (r / 8), py = Math.sin(i * 0.9 + t * 0.3) * r * 0.45; const rx = px * Math.cos(ang) - py * Math.sin(ang), ry = px * Math.sin(ang) + py * Math.cos(ang); if (i === -8) c.moveTo(rx, ry); else c.lineTo(rx, ry); } c.stroke(); c.strokeStyle = col; c.lineWidth = 1.5; c.stroke(); break; }
    case 'curved': { c.strokeStyle = dark; c.lineWidth = 4; c.beginPath(); c.arc(0, r * 0.3, r * 0.8, Math.PI * 1.1 + ang, Math.PI * 1.9 + ang); c.stroke(); c.strokeStyle = col; c.lineWidth = 2; c.stroke(); break; }
    case 'yeast': body(0, 0, r, r * 0.95); if (vis.bud !== false) body(r * 0.8, -r * 0.7, r * 0.45, r * 0.45); break;
    case 'tbrod': { body(0, 0, r * 1.15, r * 0.42, ang); c.fillStyle = dark; for (let i = -2; i <= 2; i++) { const px = i * r * 0.42; c.beginPath(); c.arc(px * Math.cos(ang), px * Math.sin(ang), 1.2, 0, TAU); c.fill(); } break; }
    case 'ghost': {
      c.globalAlpha = opts.stasis ? 0.9 : 0.75; c.fillStyle = col; c.beginPath(); c.arc(0, -r * 0.15, r * 0.85, Math.PI, 0); const by = r * 0.75;
      for (let i = 3; i >= -3; i--) { c.lineTo(i * r * 0.28, by + (i % 2 ? -r * 0.25 : 0) + Math.sin(t * 0.2 + i) * 1); } c.closePath(); c.fill(); c.strokeStyle = dark; c.lineWidth = 1; c.stroke();
      c.fillStyle = dark; c.beginPath(); c.arc(-r * 0.3, -r * 0.25, 1.4, 0, TAU); c.arc(r * 0.3, -r * 0.25, 1.4, 0, TAU); c.fill();
      if (vis.spiky) { c.strokeStyle = dark; c.lineWidth = 1; for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + t * 0.02; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9 - r * 0.15); c.lineTo(Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25 - r * 0.15); c.stroke(); } }
      c.globalAlpha = 1; break;
    }
    default: body(0, 0, r, r);
  }
  // overlays: armor studs, spikes, frost, crown
  if (vis.armor) { c.fillStyle = dark; for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.6; c.fillRect(Math.cos(a) * r * 0.7 - 1, Math.sin(a) * r * 0.7 - 1, 2, 2); } }
  if (vis.spikes) { c.fillStyle = dark; for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + t * 0.01; c.beginPath(); c.moveTo(Math.cos(a) * r, Math.sin(a) * r); c.lineTo(Math.cos(a + 0.2) * r * 1.35, Math.sin(a + 0.2) * r * 1.35); c.lineTo(Math.cos(a + 0.4) * r, Math.sin(a + 0.4) * r); c.fill(); } }
  if (vis.frost) { c.strokeStyle = '#e0fbfc'; c.lineWidth = 1; for (let i = 0; i < 3; i++) { const a = t * 0.02 + i * 2.1, px = Math.cos(a) * r * 1.3, py = Math.sin(a) * r * 1.1; c.beginPath(); c.moveTo(px - 2, py); c.lineTo(px + 2, py); c.moveTo(px, py - 2); c.lineTo(px, py + 2); c.stroke(); } }
  if (vis.crown) { c.fillStyle = '#ffd166'; c.beginPath(); c.moveTo(-r * 0.6, -r * 1.05); c.lineTo(-r * 0.6, -r * 1.45); c.lineTo(-r * 0.25, -r * 1.2); c.lineTo(0, -r * 1.55); c.lineTo(r * 0.25, -r * 1.2); c.lineTo(r * 0.6, -r * 1.45); c.lineTo(r * 0.6, -r * 1.05); c.closePath(); c.fill(); }
  if (vis.dust) { c.fillStyle = 'rgba(200,200,200,0.7)'; for (let i = 0; i < 4; i++) { const a = t * 0.03 + i * 1.6; c.fillRect(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5, 1, 1); } }
  if (opts.stasis) { c.strokeStyle = '#caf0f8'; c.globalAlpha = 0.8; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, r * 1.2, t * 0.1, t * 0.1 + 4.5); c.stroke(); c.globalAlpha = 1; }
  if (opts.dormant) { c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.arc(0, 0, r * 1.2, 0, TAU); c.fill(); }
  c.restore();
}

export function mix(a, b, t) {
  const pa = hex(a), pb = hex(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t), g = Math.round(pa[1] + (pb[1] - pa[1]) * t), bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
export function hex(h) { if (h.startsWith('rgb')) { const m = h.match(/\d+/g); return [+m[0], +m[1], +m[2]]; } const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function rgba(h, a) { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; }

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------
export function drawHeart(c, x, y, s = 8, fill = '#e63946', frac = 1, outline = '#1b1b2f') {
  // s = total width
  const r = s / 4;
  c.save(); c.translate(x, y);
  const path = () => { c.beginPath(); c.moveTo(s / 2, s * 0.95); c.lineTo(0.5, s * 0.45); c.arc(r + 0.5, r * 1.3, r, Math.PI * 0.9, Math.PI * 1.9); c.arc(s - r - 0.5, r * 1.3, r, Math.PI * 1.1, Math.PI * 2.1); c.lineTo(s - 0.5, s * 0.45); c.closePath(); };
  path(); c.fillStyle = '#2b2b3a'; c.fill();
  if (frac > 0) { c.save(); c.beginPath(); c.rect(0, 0, s * frac, s); c.clip(); path(); c.fillStyle = fill; c.fill(); c.restore(); }
  if (outline) { path(); c.strokeStyle = outline; c.lineWidth = 1; c.stroke(); }
  if (frac > 0) { c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(2, 2, 1, 1); }
  c.restore();
}
export function drawItemIcon(c, type, x, y, t = 0, extra = {}) {
  c.save(); c.translate(Math.round(x), Math.round(y));
  const bob = Math.sin(t * 0.1) * 1;
  switch (type) {
    case 'heart': drawHeart(c, -4, -4 + bob, 8); break;
    case 'heartContainer': drawHeart(c, -6, -6 + bob, 12, '#ff4d6d'); c.strokeStyle = '#ffd166'; c.lineWidth = 1; c.strokeRect(-7.5, -7.5 + bob, 15, 15); break;
    case 'heartPiece': drawHeart(c, -5, -5 + bob, 10, '#c9184a'); c.fillStyle = '#1b1b2f'; c.fillRect(-5, -5 + bob, 10, 1); c.fillRect(0, -5 + bob, 1, 10); c.fillStyle = '#ff4d6d'; c.fillRect(1, -4 + bob, 4, 4); break;
    case 'pearl': circ(c, 0, bob, 3.5, '#e9f5ff', '#5c8ab8'); c.fillStyle = '#fff'; c.fillRect(-2, -2 + bob, 1, 1); break;
    case 'pearl5': circ(c, 0, bob, 4.5, '#caf0f8', '#0077b6'); c.fillStyle = '#fff'; c.fillRect(-2, -2 + bob, 2, 1); break;
    case 'key': c.fillStyle = '#ffd166'; circ(c, -2, -2 + bob, 3, '#ffd166', '#8a6a00'); c.fillRect(-1, -1 + bob, 6, 2); c.fillRect(3, 1 + bob, 1, 2); c.fillRect(1, 1 + bob, 1, 2); c.fillStyle = '#8a6a00'; c.fillRect(-2, -2 + bob, 1, 1); break;
    case 'bosskey': circ(c, -2, -2 + bob, 3.5, '#e63946', '#5c0b0b'); c.fillStyle = '#e63946'; c.fillRect(-1, -1 + bob, 7, 2); c.fillRect(4, 1 + bob, 1, 3); c.fillRect(2, 1 + bob, 1, 2); c.fillStyle = '#ffd166'; c.fillRect(-3, -3 + bob, 2, 2); break;
    case 'dose': c.fillStyle = '#dee2e6'; rr(-3, -5 + bob, 6, 10, 2, c); c.fill(); c.strokeStyle = '#495057'; c.stroke(); c.fillStyle = extra.color || '#b197fc'; c.fillRect(-2, -1 + bob, 4, 4); c.fillStyle = '#495057'; c.fillRect(-3, -6 + bob, 6, 2); break;
    case 'probiotic': c.fillStyle = '#f8f9fa'; rr(-4, -4 + bob, 8, 9, 2, c); c.fill(); c.strokeStyle = '#adb5bd'; c.stroke(); c.fillStyle = '#52b788'; c.fillRect(-3, -3 + bob, 6, 2); c.fillStyle = '#2d6a4f'; c.fillRect(-2, 1 + bob, 1, 1); c.fillRect(1, 2 + bob, 1, 1); break;
    case 'scalpel': c.save(); c.rotate(-0.6); c.fillStyle = '#adb5bd'; c.fillRect(-1, -7, 2, 7); c.fillStyle = '#e9ecef'; c.beginPath(); c.moveTo(-1, -7); c.lineTo(1, -7); c.lineTo(0, -11); c.fill(); c.fillStyle = '#343a40'; c.fillRect(-1.5, 0, 3, 6); c.restore(); break;
    case 'lens': circ(c, -1, -1 + bob, 4, 'rgba(173,216,230,0.7)', '#1b4965'); c.fillStyle = '#1b4965'; c.save(); c.rotate(0.8); c.fillRect(2, -1, 6, 2); c.restore(); c.fillStyle = '#9b5de5'; c.fillRect(-2, -2 + bob, 1, 1); c.fillStyle = '#f15bb5'; c.fillRect(0, 0 + bob, 1, 1); break;
    case 'culture': circ(c, 0, bob, 5, '#ffe8a3', '#8a6a00'); c.fillStyle = '#e63946'; c.fillRect(-2, -2 + bob, 1, 1); c.fillRect(1, 1 + bob, 1, 1); c.fillRect(-1, 2 + bob, 1, 1); c.fillStyle = '#52b788'; c.fillRect(2, -2 + bob, 1, 1); break;
    case 'map': c.fillStyle = '#f4e1b5'; c.fillRect(-5, -4 + bob, 10, 8); c.strokeStyle = '#8a6a44'; c.strokeRect(-5.5, -4.5 + bob, 11, 9); c.fillStyle = '#e63946'; c.fillRect(1, -1 + bob, 2, 2); c.fillStyle = '#8a6a44'; c.fillRect(-4, -2 + bob, 3, 1); c.fillRect(-3, 1 + bob, 2, 1); break;
    case 'compass': circ(c, 0, bob, 5, '#ffd166', '#8a6a00'); c.fillStyle = '#e63946'; c.beginPath(); c.moveTo(0, -4 + bob); c.lineTo(-1.5, bob); c.lineTo(1.5, bob); c.fill(); c.fillStyle = '#1b1b2f'; c.beginPath(); c.moveTo(0, 4 + bob); c.lineTo(-1.5, bob); c.lineTo(1.5, bob); c.fill(); break;
    case 'drug': { const col = extra.color || '#5ec9ff'; c.fillStyle = '#f8f9fa'; rr(-4, -6 + bob, 8, 12, 2, c); c.fill(); c.strokeStyle = '#495057'; c.lineWidth = 1; c.stroke(); c.fillStyle = col; c.fillRect(-3, -1 + bob, 6, 4); c.fillStyle = '#495057'; c.fillRect(-4, -7 + bob, 8, 2); c.fillStyle = '#fff'; c.fillRect(-2, -4 + bob, 1, 2); break; }
    case 'vial': { const col = extra.color || '#5ec9ff'; c.fillStyle = 'rgba(255,255,255,0.8)'; rr(-3, -5 + bob, 6, 10, 2, c); c.fill(); c.strokeStyle = '#495057'; c.stroke(); c.fillStyle = col; c.fillRect(-2, -1 + bob, 4, 3); c.fillStyle = '#495057'; c.fillRect(-3, -6 + bob, 6, 1); break; }
    case 'clavulanate': c.fillStyle = '#20c997'; rr(-5, -3 + bob, 10, 7, 3, c); c.fill(); c.strokeStyle = '#0b7a5a'; c.stroke(); c.fillStyle = '#fff'; c.fillRect(-3, -1 + bob, 2, 2); c.fillRect(1, -1 + bob, 2, 2); c.fillStyle = '#0b7a5a'; c.fillRect(-1, -1 + bob, 1, 3); break;
    case 'potion': c.fillStyle = '#e63946'; rr(-4, -3 + bob, 8, 9, 3, c); c.fill(); c.strokeStyle = '#5c0b0b'; c.stroke(); c.fillStyle = '#adb5bd'; c.fillRect(-2, -6 + bob, 4, 3); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(-2, -1 + bob, 1, 3); break;
    case 'vaccine': c.fillStyle = '#caf0f8'; rr(-5, -2 + bob, 10, 4, 1, c); c.fill(); c.strokeStyle = '#0077b6'; c.stroke(); c.fillStyle = '#0077b6'; c.fillRect(5, -1 + bob, 4, 2); c.fillRect(-7, -1 + bob, 2, 2); c.fillStyle = '#ff4d6d'; c.fillRect(-3, -1 + bob, 3, 2); break;
    case 'soap': c.fillStyle = '#f8f9fa'; rr(-5, -3 + bob, 10, 7, 3, c); c.fill(); c.strokeStyle = '#90e0ef'; c.stroke(); c.fillStyle = '#90e0ef'; c.fillRect(-3, -1 + bob, 2, 2); c.fillRect(1, 0 + bob, 1, 1); circ(c, 3, -5 + bob, 1.5, 'rgba(255,255,255,0.8)', '#90e0ef'); break;
    case 'ripe': c.fillStyle = '#e8590c'; rr(-6, -3 + bob, 12, 6, 2, c); c.fill(); c.fillStyle = '#fff'; c.font = '5px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('RIPE', 0, bob + 0.5); break;
    case 'star': c.fillStyle = '#ffd166'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? 2.5 : 6; c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad + bob); } c.closePath(); c.fill(); break;
    default: circ(c, 0, bob, 4, '#fff', '#000');
  }
  c.restore();
}

// Mechanism target icons (for drug cards in canvas HUD)
export function drawTargetIcon(c, target, x, y, col) {
  c.save(); c.translate(x, y); c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 1;
  switch (target) {
    case 'wall': for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c.fillRect(i * 4 - 5 + (j % 2) * 2, j * 3 - 4, 3, 2); break;
    case 'r30': case 'r50': circ(c, 0, -1, 4, col); circ(c, 0, 3, 2.5, col); break;
    case 'dna': c.beginPath(); for (let i = -6; i <= 6; i++) { c.lineTo(i, Math.sin(i * 0.8) * 3); } c.stroke(); c.beginPath(); for (let i = -6; i <= 6; i++) { c.lineTo(i, -Math.sin(i * 0.8) * 3); } c.stroke(); break;
    case 'rna': c.beginPath(); for (let i = -6; i <= 6; i++) c.lineTo(i, Math.sin(i * 0.9) * 3); c.stroke(); c.fillRect(-1, -5, 2, 2); break;
    case 'folate': c.fillRect(-6, -1, 4, 2); c.fillRect(-1, -1, 4, 2); c.fillRect(4, -1, 3, 2); c.fillRect(-5, -4, 2, 8); c.fillRect(0, -4, 2, 8); break;
    case 'membrane': for (let i = -6; i <= 6; i += 3) { c.fillRect(i, -4, 2, 2); c.fillRect(i, 2, 2, 2); c.fillRect(i + 0.5, -2, 1, 4); } break;
    case 'myco': c.fillRect(-6, -2, 12, 4); c.fillStyle = '#000'; c.globalAlpha = 0.3; for (let i = -5; i < 6; i += 3) c.fillRect(i, -1, 1, 2); break;
    case 'fungal': circ(c, 0, 0, 5, col); circ(c, 4, -4, 2.5, col); break;
    default: circ(c, 0, 0, 4, col);
  }
  c.restore();
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------
export function text(c, str, x, y, opt = {}) {
  const size = opt.size || 8;
  c.font = `${size}px ${opt.font || FONT}`;
  c.textAlign = opt.align || 'left'; c.textBaseline = opt.baseline || 'top';
  if (opt.shadow !== false) { c.fillStyle = opt.shadowColor || 'rgba(0,0,0,0.8)'; c.fillText(str, x + 1, y + 1); }
  c.fillStyle = opt.color || '#fff'; c.fillText(str, x, y);
}
export function textW(c, str, size = 8) { c.font = `${size}px ${FONT}`; return c.measureText(str).width; }

export function bar(c, x, y, w, h, frac, fill, back = '#222', border = '#000') {
  c.fillStyle = back; c.fillRect(x, y, w, h);
  c.fillStyle = fill; c.fillRect(x + 1, y + 1, Math.round((w - 2) * clamp(frac, 0, 1)), h - 2);
  c.strokeStyle = border; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

export const COMPANION = (() => {
  const rows = ['...kkkk...', '..kwwwwk..', '.kwwppwwk.', 'kwwpppwwwk', 'kwpppwppwk', 'kwwppwwwwk', 'kwwwwwpwwk', '.kwwwwwwk.', '..kwwwwk..', '...kkkk...'];
  return makeSprite(rows, { k: '#4a4e69', w: '#f8f9fa', p: '#9b5de5' });
})();
