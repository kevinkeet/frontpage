// Small utilities
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
export const choice = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)];
export const rand = (a, b, rng = Math.random) => a + rng() * (b - a);
export const randInt = (a, b, rng = Math.random) => Math.floor(rand(a, b + 1, rng));
export const TAU = Math.PI * 2;

// Deterministic PRNG (mulberry32)
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
export function dirVec(d) { // 0=down 1=left 2=up 3=right
  return [[0, 1], [-1, 0], [0, -1], [1, 0]][d];
}
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
