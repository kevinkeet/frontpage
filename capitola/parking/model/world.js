/* ---------- Geometry: the real Village loop, from OpenStreetMap ---------- */
function Poly(pts) {
  this.p = pts; this.cum = [0];
  for (var i = 1; i < pts.length; i++) {
    var dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
    this.cum.push(this.cum[i - 1] + Math.hypot(dx, dy));
  }
  this.len = this.cum[this.cum.length - 1];
}
// point, tangent and right-hand normal at distance s
Poly.prototype.at = function (s) {
  var c = this.cum, p = this.p;
  if (s <= 0) s = 0; if (s >= this.len) s = this.len - 1e-6;
  var lo = 0, hi = c.length - 1;
  while (hi - lo > 1) { var m = (lo + hi) >> 1; if (c[m] <= s) lo = m; else hi = m; }
  var f = (s - c[lo]) / ((c[hi] - c[lo]) || 1);
  var x = p[lo][0] + (p[hi][0] - p[lo][0]) * f, y = p[lo][1] + (p[hi][1] - p[lo][1]) * f;
  var tx = p[hi][0] - p[lo][0], ty = p[hi][1] - p[lo][1], n = Math.hypot(tx, ty) || 1;
  tx /= n; ty /= n;
  return { x: x, y: y, tx: tx, ty: ty, nx: ty, ny: -tx };
};
Poly.prototype.nearestS = function (x, y, s0, s1) {
  s0 = s0 || 0; s1 = s1 == null ? this.len : s1;
  var best = 1e9, bs = s0;
  for (var s = s0; s <= s1; s += 0.25) { var q = this.at(s), d = Math.hypot(q.x - x, q.y - y); if (d < best) { best = d; bs = s; } }
  return bs;
};

function buildWorld(PATHS) {
  var loop = new Poly(PATHS.loop), spur = new Poly(PATHS.spur), montN = new Poly(PATHS.montN);
  var amPath = new Poly(PATHS.montN.slice().reverse());   // Monterey Ave coming south from Park Ave
  var sj = new Poly(PATHS.sanJose);                        // San Jose Ave, one-way south
  var dg = new Poly(PATHS.diag);                           // the angled leg of Monterey Ave on the west side of the triangle
  var L = loop.len, espS0 = PATHS.sStock, espEnd = PATHS.sEspEnd, corner = PATHS.sCorner, exitS = PATHS.sMontTop;
  var sjTop = loop.nearestS(sj.p[0][0], sj.p[0][1], exitS, L);
  var sjBot = loop.nearestS(sj.p[sj.p.length - 1][0], sj.p[sj.p.length - 1][1], espS0, espEnd);
  var sMontJoin = loop.nearestS(-50.0, -15.8, corner, exitS);
  var spaces = [], i, k;
  function add(lane, s, side, type, extra) { var o = { lane: lane, s: s, side: side, type: type }; for (var key in extra || {}) o[key] = extra[key]; spaces.push(o); }
  // Esplanade: seaward angled stalls along the curve, the beach straightaway and the aisle to the corner
  var a = espS0 + 9, b = corner - 6;
  for (i = 0; i < 62; i++) add('R', a + (b - a) * i / 61, 1, 'angled');
  // Esplanade: inland parallel stalls, kept clear of the San Jose Ave corner
  [[espS0 + 40, 6], [espEnd - 52, 7]].forEach(function (r) {
    for (k = 0; k < r[1]; k++) { var s = r[0] + k * 6.3; if (Math.abs(s - sjBot) < 9) s += 18; add('R', s, -1, 'parallel'); }
  });
  // the triangle at the Monterey Ave end (positions from aerial imagery): south row, east row, west row
  var tri = [];
  for (k = 0; k < 6; k++) tri.push({ cx: -73.0 + k * 3.1, cy: -54.3, hx: 0, hy: 1 });
  for (k = 0; k < 5; k++) tri.push({ cx: -44.6, cy: -22.5 - k * 3.15, hx: 1, hy: 0 });
  for (k = 0; k < 7; k++) { var f = k / 6; tri.push({ cx: -54.0 - 13.0 * f, cy: -34.5 - 15.0 * f, hx: 0.995, hy: 0.1 }); }
  // the south and east rows face the beach aisle; the west row faces the angled leg
  tri.forEach(function (t, ix) {
    if (ix < 11) add('R', loop.nearestS(t.cx, t.cy, espEnd - 5, sMontJoin + 2), 0, 'tri', { cx: t.cx, cy: t.cy, hx: t.hx, hy: t.hy, L: 4.8, W: 2.55 });
    else add('DG', dg.nearestS(t.cx, t.cy), 0, 'tri', { cx: t.cx, cy: t.cy, hx: t.hx, hy: t.hy, L: 4.8, W: 2.55 });
  });
  // the angled leg's outer (west) curb: 4 angled spaces (aerial imagery)
  for (k = 0; k < 4; k++) add('DG', 18 + k * 3.4, -1, 'angled');
  // Monterey Ave, triangle to Capitola Ave: 7 angled on the west side, 5 on the east (aerial imagery)
  for (k = 0; k < 7; k++) add('R', loop.nearestS(-48.5, -2.5 + k * 3.2, sMontJoin, exitS), -1, 'angled');
  for (k = 0; k < 5; k++) add('R', loop.nearestS(-48.5, 0.5 + k * 3.2, sMontJoin, exitS), 1, 'angled');
  // San Jose Ave, one-way south: angled on the west (driver's right), parallel on the east (aerial imagery)
  for (k = 0; k < 7; k++) add('SJ', 14 + k * 4.0, 1, 'angled');
  for (k = 0; k < 3; k++) add('SJ', 55 + k * 4.0, 1, 'angled');
  for (k = 0; k < 11; k++) add('SJ', 14 + k * 7.0, -1, 'parallel');
  spaces.sort(function (p, q) { return p.lane === q.lane ? p.s - q.s : (p.lane < q.lane ? -1 : 1); });
  var rMax = 0; spaces.forEach(function (sp) { if (sp.lane === 'R') rMax = Math.max(rMax, sp.s); });
  var laneOrder = { R: 0, DG: 1, SJ: 2 };
  spaces.sort(function (p, q) { return laneOrder[p.lane] - laneOrder[q.lane] || p.s - q.s; });
  var xwalks = PATHS.xwalks.map(function (x) {
    var s = x[0], w = 1;
    if (s > 300 && s < 360) w = 0.8;          // Monterey Ave
    if (s >= 360 && s < 400) w = 1.3;         // the Monterey/Capitola corner, busy with people
    if (s > 200 && s < 260) w = 1.3;          // mid-beach crossing
    return { lane: 'R', s: s, w: w };
  });
  xwalks.push({ lane: 'SJ', s: sj.nearestS(-121.6, 46.4), w: 1 });
  return {
    loop: loop, spur: spur, montN: montN, amPath: amPath, sj: sj, dg: dg, dgLen: dg.len,
    loopLen: L, espS0: espS0, espEnd: espEnd, corner: corner, exitS: exitS, sMontJoin: sMontJoin,
    sjTop: sjTop, sjBot: sjBot, sjLen: sj.len, searchEnd: rMax + 1,
    loadS: corner - 2, appLen: spur.len, amLen: amPath.len, ghostLen: 140, spaces: spaces, xwalks: xwalks,
    stops: [{ s: L - 3, id: 'J' }, { s: exitS - 3, id: 'M' }]
  };
}
if (typeof module !== 'undefined') module.exports = { buildWorld: buildWorld, Poly: Poly };
