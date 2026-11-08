(function () {
  'use strict';
  var world = buildWorld(PATHS);
  var LOOP = world.loop, SPUR = world.spur, MONTN = world.montN, AMP = world.amPath, SJP = world.sj, DGP = world.dg;
  var NSP = world.spaces.length;
  function lanePoly(lane) { return lane === 'SJ' ? SJP : lane === 'DG' ? DGP : LOOP; }

  /* ---------- stall geometry: centers and headings ---------- */
  world.spaces.forEach(function (sp) {
    var q = lanePoly(sp.lane).at(sp.s);
    if (sp.type === 'tri') {
      // the triangle lot: positions read from aerial imagery
    } else if (sp.type === 'angled') {
      var c = Math.cos(Math.PI / 3), s = Math.sin(Math.PI / 3), sd = sp.side;
      var hx = q.tx * c + q.nx * s * sd, hy = q.ty * c + q.ny * s * sd;
      var off = sp.lane === 'R' && sp.s > world.sMontJoin ? 3.0 : 3.4;
      var bx = q.x + q.nx * off * sd, by = q.y + q.ny * off * sd;
      sp.cx = bx + hx * 2.5; sp.cy = by + hy * 2.5; sp.hx = hx; sp.hy = hy; sp.L = 5.0; sp.W = 2.25;
    } else {
      var po = sp.lane === 'SJ' ? 3.6 : 4.4;
      sp.cx = q.x + q.nx * po * sp.side; sp.cy = q.y + q.ny * po * sp.side; sp.hx = q.tx; sp.hy = q.ty; sp.L = 5.9; sp.W = 2.3;
    }
    sp.lx = q.x; sp.ly = q.y; sp.tx = q.tx; sp.ty = q.ty;
  });
  var sMontJoin = world.sMontJoin;

  /* ---------- state ---------- */
  var DAYS = { winter: { lam: 20, label: 'Tuesday' }, spring: { lam: 60, label: 'Sunday' }, summer: { lam: 135, label: 'Saturday' } };
  var ui = {
    mode: 'today', tryPrice: 5, day: 'summer', lam: 135,
    speeds: [{ k: 'Normal', v: 20 }, { k: 'Fast', v: 60 }, { k: 'Slow', v: 6 }], speedIx: 0,
    paused: false
  };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) ui.paused = true;
  var sim;
  var START_MIN = 11 * 60 + 30;   // clock starts at 11:30 AM; the warm-up brings it to 1:00 PM
  var WARM = 90;

  function currentPrice() { return ui.mode === 'today' ? 2 : ui.mode === 'try' ? ui.tryPrice : (sim ? sim.price : 2); }
  function newSim() {
    sim = new Sim(world, { seed: (Math.random() * 1e9) >>> 0, price: ui.mode === 'resp' ? 2 : currentPrice(), lambda: ui.lam, visual: true, prefill: true });
    sim.warm(WARM);
    if (ui.mode === 'resp') { sim.mode = 'responsive'; sim.nextAdjust = sim.t + 600; }
  }

  /* ---------- theme tokens for canvas ---------- */
  var T = {};
  function readTokens() {
    var cs = getComputedStyle(document.documentElement);
    ['paper', 'card', 'ink', 'ink2', 'ink3', 'rule', 'rule2', 'accent', 'amber', 'parked', 'lotc', 'out', 'good', 'open', 'band',
     'hazard', 'ped', 'pedRing', 'zebra', 'land', 'sand', 'sea', 'creek', 'park', 'asph', 'bldg', 'bldgEdge', 'stall', 'label', 'halo', 'pay', 'signBg', 'signText']
      .forEach(function (k) { T[k] = cs.getPropertyValue('--' + k).trim(); });
    T.fMono = cs.getPropertyValue('--f-mono').trim(); T.fDisp = cs.getPropertyValue('--f-display').trim(); T.fBody = cs.getPropertyValue('--f-body').trim();
  }

  /* ---------- map canvas ---------- */
  var VIEW = { x0: -284, x1: -22, y0: -118, y1: 90 };
  var mapC = document.getElementById('map'), mctx = mapC.getContext('2d');
  var stat = document.createElement('canvas'), sctx = stat.getContext('2d');
  var K = 1, DPR = 1, MW = 0, MH = 0;
  function X(x) { return (x - VIEW.x0) * K; }
  function Y(y) { return (VIEW.y1 - y) * K; }
  function sizeMap() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    MW = mapC.clientWidth || 600;
    MH = Math.round(MW * (VIEW.y1 - VIEW.y0) / (VIEW.x1 - VIEW.x0));
    mapC.style.height = MH + 'px';
    mapC.width = Math.round(MW * DPR); mapC.height = Math.round(MH * DPR);
    stat.width = mapC.width; stat.height = mapC.height;
    K = MW / (VIEW.x1 - VIEW.x0);
    drawStatic();
  }
  function poly(ctx, pts, close) {
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) { var x = X(pts[i][0]), y = Y(pts[i][1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    if (close) ctx.closePath();
  }
  function offsetPath(Pl, s0, s1, off, stepM) {
    var out = [];
    for (var s = s0; s <= s1 + 1e-6; s += stepM) { var q = Pl.at(Math.min(s, s1)); out.push([q.x + q.nx * off, q.y + q.ny * off]); }
    return out;
  }
  function label(ctx, text, x, y, opts) {
    opts = opts || {};
    ctx.save();
    ctx.translate(X(x), Y(y)); if (opts.rot) ctx.rotate(opts.rot);
    ctx.font = (opts.weight || 600) + ' ' + Math.max(9, (opts.size || 11)) + 'px ' + (opts.font || T.fMono);
    ctx.textAlign = opts.align || 'center'; ctx.textBaseline = 'middle';
    if (opts.spacing && 'letterSpacing' in ctx) ctx.letterSpacing = opts.spacing + 'px';
    ctx.lineWidth = 3; ctx.strokeStyle = T.halo; ctx.lineJoin = 'round';
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = opts.color || T.label; ctx.fillText(text, 0, 0);
    ctx.restore();
  }
  function laneOffset(s) {
    // two-way streets carry the loop in the right-hand lane; the one-way Esplanade, aisle and Monterey run down the middle
    var a = world.espS0, b = world.exitS;
    if (s < a - 10) return 1.7;
    if (s < a) return 1.7 * (a - s) / 10;
    if (s <= b) return 0;
    if (s < b + 10) return 1.7 * (s - b) / 10;
    return 1.7;
  }
  function rectPath(c, cx, cy, hx, hy, L, W) {
    var nx = hy, ny = -hx, l = L / 2, w = W / 2;
    c.beginPath();
    c.moveTo(X(cx + hx * l + nx * w), Y(cy + hy * l + ny * w));
    c.lineTo(X(cx + hx * l - nx * w), Y(cy + hy * l - ny * w));
    c.lineTo(X(cx - hx * l - nx * w), Y(cy - hy * l - ny * w));
    c.lineTo(X(cx - hx * l + nx * w), Y(cy - hy * l + ny * w));
    c.closePath();
  }
  function drawStatic() {
    readTokens();
    var c = sctx, i, q;
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.fillStyle = T.land; c.fillRect(0, 0, MW, MH);
    GEO.coast.forEach(function (cl) {
      var xs = cl.map(function (p) { return p[0]; }), ys = cl.map(function (p) { return p[1]; });
      var pts = cl.slice(); var mnx = Math.min.apply(null, xs), mxx = Math.max.apply(null, xs), mny = Math.min.apply(null, ys);
      pts.push([mxx + 400, mny - 600]); pts.push([mnx - 400, mny - 600]);
      c.fillStyle = T.sea; poly(c, pts, true); c.fill();
    });
    c.fillStyle = T.sand; GEO.beach.forEach(function (p) { poly(c, p, true); c.fill(); });
    c.fillStyle = T.park; GEO.park.forEach(function (p) { poly(c, p, true); c.fill(); });
    c.fillStyle = T.creek; GEO.water.forEach(function (p) { poly(c, p, true); c.fill(); });
    c.lineCap = 'round'; c.lineJoin = 'round';
    var widths = { 0: 1.6, 1: 4.5, 2: 8, 3: 9.5 };
    [0, 1, 2, 3].forEach(function (cls) {
      GEO.roads.forEach(function (r) {
        if (r.c !== cls) return;
        c.strokeStyle = cls === 0 ? T.rule : T.asph; c.lineWidth = widths[cls] * K;
        poly(c, r.p, false); c.stroke();
      });
    });
    // the Esplanade, the aisle along the beach, and the triangle lot are wide: a travel lane plus parking
    c.strokeStyle = T.asph;
    c.lineWidth = 15.5 * K; poly(c, offsetPath(LOOP, world.espS0 - 2, world.espEnd, 1.9, 2), false); c.stroke();
    c.lineWidth = 15 * K; poly(c, offsetPath(LOOP, world.espEnd - 2, world.corner + 1, 1.2, 1), false); c.stroke();
    c.lineWidth = 12 * K; poly(c, offsetPath(LOOP, world.corner - 1, sMontJoin, 1.0, 1), false); c.stroke();
    c.lineWidth = 15 * K; poly(c, offsetPath(LOOP, sMontJoin - 1, world.exitS - 2, 0, 1), false); c.stroke();
    c.lineWidth = 14 * K; poly(c, offsetPath(SJP, 6, SJP.len - 4, 0.8, 1), false); c.stroke();
    c.lineWidth = 12 * K; poly(c, offsetPath(DGP, 2, DGP.len - 2, -0.8, 1), false); c.stroke();
    c.fillStyle = T.asph;
    poly(c, [[-88.2, -59.2], [-72.7, -47.8], [-64, -39.7], [-58, -31.1], [-50, -15.8], [-50, -23.5], [-50.1, -53.4], [-51.2, -56.9], [-53.5, -58.8]], true); c.fill();
    // buildings and the wharf
    c.fillStyle = T.bldg; c.strokeStyle = T.bldgEdge; c.lineWidth = Math.max(0.6, 0.25 * K);
    GEO.bldg.forEach(function (p) { poly(c, p, true); c.fill(); c.stroke(); });
    c.strokeStyle = T.bldgEdge; c.lineWidth = 3 * K;
    GEO.pier.forEach(function (p) { poly(c, p, false); c.stroke(); });
    // palm planters in the triangle
    c.fillStyle = T.park;
    [[-53, -30.9], [-50.6, -41.5], [-55, -48.6], [-55.4, -54.4]].forEach(function (p) { c.beginPath(); c.arc(X(p[0]), Y(p[1]), 1.4 * K, 0, Math.PI * 2); c.fill(); });
    // stall outlines
    c.strokeStyle = T.stall; c.lineWidth = Math.max(0.8, 0.14 * K);
    world.spaces.forEach(function (sp) { rectPath(c, sp.cx, sp.cy, sp.hx, sp.hy, sp.L, sp.W); c.stroke(); });
    // crosswalks (zebra bars across the road)
    c.fillStyle = T.zebra;
    world.xwalks.forEach(function (xw) {
      var q2 = lanePoly(xw.lane).at(xw.s), half = xw.lane === 'SJ' ? 4.5 : (xw.s > world.espS0 && xw.s < world.exitS) ? 4.6 : 5;
      for (var o = -half + 0.5; o <= half - 0.4; o += 1.45) {
        var cx = q2.x + q2.nx * o, cy = q2.y + q2.ny * o;
        rectPath(c, cx, cy, q2.tx, q2.ty, 2.6, 0.75); c.fill();
      }
    });
    // stop bars at the two all-way stops (and on Capitola Ave coming in)
    c.strokeStyle = T.zebra; c.lineWidth = Math.max(1.2, 0.5 * K); c.lineCap = 'butt';
    world.stops.forEach(function (st) {
      var q3 = LOOP.at(st.s + 0.4), off = laneOffset(st.s);
      c.beginPath(); c.moveTo(X(q3.x + q3.nx * (off + 1.9)), Y(q3.y + q3.ny * (off + 1.9))); c.lineTo(X(q3.x + q3.nx * (off - 1.9)), Y(q3.y + q3.ny * (off - 1.9))); c.stroke();
    });
    q = SPUR.at(world.appLen - 0.6);
    c.beginPath(); c.moveTo(X(q.x + q.nx * 3.6), Y(q.y + q.ny * 3.6)); c.lineTo(X(q.x - q.nx * 0.2), Y(q.y - q.ny * 0.2)); c.stroke();
    q = AMP.at(world.amLen - 0.6);
    c.beginPath(); c.moveTo(X(q.x + q.nx * 3.6), Y(q.y + q.ny * 3.6)); c.lineTo(X(q.x - q.nx * 0.2), Y(q.y - q.ny * 0.2)); c.stroke();
    q = SJP.at(SJP.len - 0.8);
    c.beginPath(); c.moveTo(X(q.x + q.nx * 3.5), Y(q.y + q.ny * 3.5)); c.lineTo(X(q.x - q.nx * 3.5), Y(q.y - q.ny * 3.5)); c.stroke();
    c.lineCap = 'round';
    // the drop-off corner: yellow curb
    c.strokeStyle = T.hazard; c.lineWidth = Math.max(1.5, 0.6 * K);
    poly(c, offsetPath(LOOP, world.corner - 9, world.corner + 6, 5.6, 1), false); c.stroke();
    // one-way arrows along the loop
    c.fillStyle = 'rgba(255,255,255,.28)';
    for (var s = 30; s < world.loopLen - 10; s += 34) {
      var nearX = false;
      world.xwalks.forEach(function (xw) { if (Math.abs(xw.s - s) < 5) nearX = true; });
      if (nearX) continue;
      var q4 = LOOP.at(s), off2 = laneOffset(s), ax = q4.x + q4.nx * off2, ay = q4.y + q4.ny * off2;
      c.save(); c.translate(X(ax), Y(ay)); c.rotate(-Math.atan2(q4.ty, q4.tx));
      c.beginPath(); c.moveTo(2.2 * K, 0); c.lineTo(-1.4 * K, 1.3 * K); c.lineTo(-0.6 * K, 0); c.lineTo(-1.4 * K, -1.3 * K); c.closePath(); c.fill();
      c.restore();
    }
    c.fillStyle = 'rgba(255,255,255,.28)';
    [[SJP, 22], [SJP, 52], [SJP, 82], [DGP, 12], [DGP, 44]].forEach(function (a6) {
      var q6 = a6[0].at(a6[1]);
      c.save(); c.translate(X(q6.x), Y(q6.y)); c.rotate(-Math.atan2(q6.ty, q6.tx));
      c.beginPath(); c.moveTo(2.2 * K, 0); c.lineTo(-1.4 * K, 1.3 * K); c.lineTo(-0.6 * K, 0); c.lineTo(-1.4 * K, -1.3 * K); c.closePath(); c.fill();
      c.restore();
    });
    // blue pay stations on the seaward sidewalk
    c.fillStyle = T.pay;
    [world.espS0 + 30, world.espS0 + 78, world.espS0 + 124, world.espS0 + 165, world.espEnd + 25].forEach(function (s2) {
      var q5 = LOOP.at(s2); var x = q5.x + q5.nx * 9.6, y = q5.y + q5.ny * 9.6;
      c.fillRect(X(x) - 0.9 * K, Y(y) - 0.9 * K, 1.8 * K, 1.8 * K);
    });
    // labels
    var big = Math.round(Math.max(10, Math.min(13, 3.8 * K)));
    var e1 = LOOP.at(world.espEnd - 60);
    label(c, 'ESPLANADE →', e1.x + e1.nx * 16, e1.y + e1.ny * 16, { rot: -Math.atan2(e1.ty, e1.tx), size: big + 1, spacing: 3, weight: 700 });
    var qc = LOOP.at(world.corner);
    label(c, 'drop-offs', qc.x + 7, qc.y - 9, { size: big - 2, color: T.ink2, weight: 600 });
    label(c, 'Capitola Beach', -150, -92, { size: big + 1, font: T.fBody, weight: 600 });
    label(c, 'Soquel Creek', -258, 44, { size: big - 1, font: T.fBody, rot: -0.85, weight: 500 });
    label(c, 'Monterey Ave', -32, 14, { size: big - 1, rot: -1.5 });
    label(c, 'Capitola Ave', -110, 63, { size: big - 1, rot: 0.24 });
    label(c, 'Stockton', -218, 52, { size: big - 1, rot: -0.7 });
    label(c, 'San Jose Ave ↓', -150, 22, { size: big - 2, rot: -1.33 });
    label(c, 'Village shops', -92, 14, { size: big - 1, font: T.fBody, weight: 500, color: T.ink3 });
    label(c, 'STOP', -40, 31, { size: big - 2, color: T.accent, weight: 700 });
    label(c, 'Monterey Bay ↓', -60, -111, { size: big, font: T.fBody, weight: 500, color: T.ink3 });
  }
  function drawCar(c, x, y, hx, hy, color, alpha, halo, hazard) {
    var px = X(x), py = Y(y), ang = -Math.atan2(hy, hx);
    if (halo) {
      c.globalAlpha = 0.22 * alpha; c.fillStyle = color;
      c.beginPath(); c.arc(px, py, 4.2 * K, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = alpha;
    c.save(); c.translate(px, py); c.rotate(ang);
    var L = 4.4 * K, W = 1.95 * K, r = Math.min(1.6, 0.5 * K);
    c.fillStyle = color;
    roundRect(c, -L / 2, -W / 2, L, W, r); c.fill();
    if (hazard) { c.strokeStyle = T.hazard; c.lineWidth = Math.max(1.5, 0.45 * K); roundRect(c, -L / 2, -W / 2, L, W, r); c.stroke(); }
    c.fillStyle = 'rgba(0,0,0,.28)';
    c.fillRect(L * 0.08, -W / 2 + W * 0.18, L * 0.18, W * 0.64);
    c.restore();
    c.globalAlpha = 1;
  }
  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }
  function ease(f) { return f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2; }
  function drawDynamic(now) {
    var c = mctx, i, car, q;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(stat, 0, 0);
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    // open spaces in green
    c.fillStyle = T.open;
    for (i = 0; i < sim.spaces.length; i++) {
      if (sim.spaces[i].car) continue;
      var g0 = world.spaces[i];
      rectPath(c, g0.cx, g0.cy, g0.hx, g0.hy, g0.L - 0.5, g0.W - 0.35); c.fill();
    }
    // people crossing
    for (i = 0; i < sim.xw.length; i++) {
      var xw = sim.xw[i];
      if (xw.until <= sim.t) continue;
      var qx = lanePoly(xw.lane).at(xw.s), half = 5, ph = ((sim.t - xw.start) / P.pedCross) % 1;
      for (var k = 0; k < 3; k++) {
        var f0 = (ph + k * 0.37) % 1, off = -half + f0 * 2 * half * (k % 2 ? -1 : 1) + (k % 2 ? 2 * half : 0);
        var px = X(qx.x + qx.nx * off + qx.tx * (k - 1) * 0.7), py = Y(qx.y + qx.ny * off + qx.ty * (k - 1) * 0.7);
        c.beginPath(); c.arc(px, py, Math.max(1.8, 0.65 * K), 0, Math.PI * 2);
        c.fillStyle = T.ped; c.fill(); c.lineWidth = 1; c.strokeStyle = T.pedRing; c.stroke();
      }
    }
    // cars on their way out of the Village
    for (i = 0; i < sim.ghosts.length; i++) {
      var g = sim.ghosts[i], col = g.kind === 'lot' ? T.lotc : g.kind === 'left' ? T.accent : T.out;
      var a = Math.max(0, 1 - g.s / 140) * (g.kind === 'left' ? 0.6 : 1);
      if (g.path === 'spurOut') {
        var ss = SPUR.len - g.s; if (ss < 0) continue;
        q = SPUR.at(ss); drawCar(c, q.x - q.nx * 1.7, q.y - q.ny * 1.7, -q.tx, -q.ty, col, a, false);
      } else {
        if (g.s > MONTN.len) continue;
        q = MONTN.at(g.s); drawCar(c, q.x + q.nx * 1.7, q.y + q.ny * 1.7, q.tx, q.ty, col, a, false);
      }
    }
    var blink = Math.floor(now / 380) % 2 === 0;
    for (i = 0; i < sim.cars.length; i++) {
      car = sim.cars[i];
      var searching = car.kind === 'seek' && car.st === 'loop' && !car.leaving;
      var missed = searching && (car.laps >= 1 || car.searched);
      var col2 = searching ? (missed ? T.accent : T.amber) : car.leaving ? T.lotc : T.out;
      if (car.lane === 'AJ' || car.lane === 'AM') {
        if (car.s < 0) continue;
        var AP = car.lane === 'AJ' ? SPUR : AMP;
        q = AP.at(car.s); drawCar(c, q.x + q.nx * 1.7, q.y + q.ny * 1.7, q.tx, q.ty, car.kind === 'seek' ? T.amber : T.out, 1, false);
      } else if (car.st === 'loop' || car.st === 'drive' || car.st === 'load') {
        var lo = car.lane === 'R' ? laneOffset(car.s) : 0;
        q = lanePoly(car.lane).at(car.s);
        drawCar(c, q.x + q.nx * lo, q.y + q.ny * lo, q.tx, q.ty, col2, 1, missed, car.st === 'load' && blink);
      } else if (car.sp) {
        var sp = world.spaces[car.sp.i];
        var f = car.st === 'parked' ? 1 : car.st === 'pin' ? 1 - Math.max(0, car.timer) / P.maneuver : Math.max(0, car.timer) / P.maneuver;
        f = ease(Math.min(1, Math.max(0, f)));
        var x = sp.lx + (sp.cx - sp.lx) * f, y = sp.ly + (sp.cy - sp.ly) * f;
        var hx = sp.tx + (sp.hx - sp.tx) * f, hy = sp.ty + (sp.hy - sp.ty) * f, hn = Math.hypot(hx, hy) || 1;
        drawCar(c, x, y, hx / hn, hy / hn, T.parked, car.st === 'pout' ? 0.85 : 1, false);
      }
    }
    // sign for the lots, where Capitola Ave leaves the map
    var compact = MW < 520;
    var sx = X(-282) + (compact ? -2 : 0), sy = Y(88), fs = compact ? 10 : Math.round(Math.max(10, Math.min(12.5, 3.3 * K)));
    var w = sim.windowStats(60);
    var lines = compact
      ? [['600', '↑ Lots · $1.00/hr', T.signText], ['600', Math.round(w.toLot) + '/hr sent here', T.lotc]]
      : [['600', '↑ Beach & Village lots', T.signText], ['400', '$1.00/hr · ¼ mile walk', T.signText], ['600', Math.round(w.toLot) + ' drivers/hr sent here', T.lotc]];
    var bw = 0;
    lines.forEach(function (ln) { c.font = ln[0] + ' ' + fs + 'px ' + T.fMono; bw = Math.max(bw, c.measureText(ln[1]).width); });
    bw += compact ? 10 : 16;
    var bh = fs * lines.length * 1.35 + (compact ? 6 : 10), pad = compact ? 5 : 8;
    c.fillStyle = T.signBg; roundRect(c, sx, sy, bw, bh, 4); c.fill();
    c.textBaseline = 'top'; c.textAlign = 'left';
    lines.forEach(function (ln, j) { c.font = ln[0] + ' ' + fs + 'px ' + T.fMono; c.fillStyle = ln[2]; c.fillText(ln[1], sx + pad, sy + (compact ? 3 : 6) + fs * 1.35 * j); });
  }

  /* ---------- trend chart: last 2 hours ---------- */
  var trend = document.getElementById('trend'), tctx = trend.getContext('2d');
  function drawTrend() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2), W = trend.clientWidth, H = trend.clientHeight;
    if (trend.width !== Math.round(W * dpr)) { trend.width = Math.round(W * dpr); trend.height = Math.round(H * dpr); }
    var c = tctx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    var data = sim.min.slice(-121, -1); if (!data.length) return;
    var padL = 34, padR = 48, top = 8, mainH = H * 0.6, stripTop = top + mainH + 18, stripH = H - stripTop - 16;
    var n = 120, xw = (W - padL - padR) / (n - 1);
    var x0 = padL + (n - data.length) * xw;
    function xi(i) { return x0 + i * xw; }
    function yo(o) { return top + mainH * (1 - o); }
    c.fillStyle = T.band; c.fillRect(padL, yo(0.9), W - padL - padR, yo(0.8) - yo(0.9));
    c.strokeStyle = T.rule2; c.lineWidth = 1;
    [0, 0.5, 1].forEach(function (g) { c.beginPath(); c.moveTo(padL, yo(g) + 0.5); c.lineTo(W - padR, yo(g) + 0.5); c.stroke(); });
    c.setLineDash([3, 3]); c.strokeStyle = T.good; c.beginPath(); c.moveTo(padL, yo(0.85) + 0.5); c.lineTo(W - padR, yo(0.85) + 0.5); c.stroke(); c.setLineDash([]);
    c.font = '10px ' + T.fMono; c.fillStyle = T.ink3; c.textAlign = 'right'; c.textBaseline = 'middle';
    c.fillText('100%', padL - 4, yo(1)); c.fillText('50%', padL - 4, yo(0.5)); c.fillText('0', padL - 4, yo(0));
    var cmax = 4; data.forEach(function (b) { if (b.n) cmax = Math.max(cmax, b.circ / b.n); }); cmax = Math.ceil(cmax / 2) * 2;
    c.fillStyle = T.accent; c.globalAlpha = 0.28; c.beginPath(); c.moveTo(xi(0), yo(0));
    data.forEach(function (b, i) { c.lineTo(xi(i), yo((b.n ? b.circ / b.n : 0) / cmax)); });
    c.lineTo(xi(data.length - 1), yo(0)); c.closePath(); c.fill(); c.globalAlpha = 1;
    c.textAlign = 'left'; c.fillStyle = T.accent; c.fillText(cmax + ' cars', W - padR + 3, yo(1)); c.fillText('0', W - padR + 3, yo(0));
    c.strokeStyle = T.parked; c.lineWidth = 2; c.beginPath();
    data.forEach(function (b, i) { var o = b.n ? b.occ / b.n : 0; if (i) c.lineTo(xi(i), yo(o)); else c.moveTo(xi(i), yo(o)); });
    c.stroke();
    var pmax = 8; data.forEach(function (b) { pmax = Math.max(pmax, b.price); });
    function yp(p) { return stripTop + stripH * (1 - p / pmax); }
    c.strokeStyle = T.rule2; c.beginPath(); c.moveTo(padL, stripTop + stripH + 0.5); c.lineTo(W - padR, stripTop + stripH + 0.5); c.stroke();
    c.strokeStyle = T.ink; c.lineWidth = 1.5; c.beginPath();
    data.forEach(function (b, i) { var y = yp(b.price); if (i) { c.lineTo(xi(i), yp(data[i - 1].price)); c.lineTo(xi(i), y); } else c.moveTo(xi(i), y); });
    c.stroke();
    c.fillStyle = T.ink3; c.textAlign = 'right';
    c.fillText('$' + pmax, padL - 4, stripTop + 2); c.fillText('$0', padL - 4, stripTop + stripH);
    c.textAlign = 'left'; c.fillStyle = T.ink;
    c.fillText('$' + data[data.length - 1].price.toFixed(2), Math.min(W - padR + 3, xi(data.length - 1) + 4), yp(data[data.length - 1].price) - 6);
    c.fillStyle = T.ink3; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    data.forEach(function (b, i) { var m = START_MIN + b.t; if (m % 30 === 0) c.fillText(clockStr(m, true), xi(i), H - 1); });
  }
  function clockStr(m, short) {
    m = ((m % 1440) + 1440) % 1440; var h = Math.floor(m / 60), mm = Math.floor(m % 60), ap = h >= 12 ? 'PM' : 'AM', hh = h % 12 || 12;
    return hh + ':' + (mm < 10 ? '0' : '') + mm + (short ? '' : ' ' + ap);
  }

  /* ---------- panel text ---------- */
  var $ = function (id) { return document.getElementById(id); };
  function money(v) { return '$' + v.toFixed(2); }
  // cars stopped in a line behind the Monterey Ave stop sign
  function queueBehindM() {
    var R = sim.cars.filter(function (c) { return c.lane === 'R' && (c.st === 'loop' || c.st === 'drive' || c.st === 'load') && c.s <= world.exitS; })
      .sort(function (a, b) { return b.s - a.s; });
    var q = 0, last = world.exitS;
    for (var i = 0; i < R.length; i++) { if (last - R[i].s < 9.5) { q++; last = R[i].s; } else break; }
    return q;
  }
  function updatePanel() {
    var p = sim.price, w = sim.windowStats(60), open = NSP - sim.occNow;
    var share = tryShare(p), txt;
    if (ui.mode === 'resp') {
      txt = 'Demand-responsive: every 10 minutes the rate rises while drivers circle or the curb is over 90% full, and falls below 75%. Now ' + money(p) + '.';
    } else {
      var d = p - P.lotPrice;
      var rel = d > 0.001 ? money(d) + ' an hour more than the lots' : d < -0.001 ? money(-d) + ' an hour less than the lots' : 'the same as the lots';
      txt = 'At ' + money(p) + ', ' + Math.round(share * 100) + '% of arriving drivers try the loop first. The rest head for the $1.00 lots.';
    }
    $('status').innerHTML = txt + '<span class="live">' + open + ' of ' + NSP + ' spaces open · ' + sim.circNow + ' circling · ' + queueBehindM() + ' backed up behind the Monterey stop · ' + sim.waitingIn + ' waiting to get in</span>';
    var occ = sim.occNow / NSP;
    $('occFill').style.width = (occ * 100).toFixed(1) + '%';
    $('occFill').classList.toggle('full', occ >= 0.97);
    $('occText').textContent = Math.round(occ * 100) + '% · ' + open + ' open';
    $('tTrip').innerHTML = w.tripN ? w.trip.toFixed(1) + '<small>min</small>' : '–';
    $('tTrip').classList.toggle('hot', w.tripN > 0 && w.trip > 9); $('tTrip').classList.toggle('ok', w.tripN > 0 && w.trip <= 6);
    $('tCirc').innerHTML = sim.circNow + '<small>cars</small>'; $('tCirc').classList.toggle('hot', sim.circNow > 0);
    $('tSearch').innerHTML = w.search.toFixed(1) + '<small>min</small>'; $('tSearch').classList.toggle('hot', w.search > 5);
    $('tCruise').innerHTML = w.cruiseMi.toFixed(1) + '<small>mi/hr</small>'; $('tCruise').classList.toggle('hot', w.cruiseMi > 1);
    $('tLeft').innerHTML = w.left.toFixed(1) + '<small>/hr</small>'; $('tLeft').classList.toggle('hot', w.left > 0.5);
    $('tRev').innerHTML = '$' + Math.round(w.rev) + '<small>/hr</small>';
    var m = START_MIN + sim.t / 60;
    $('clock').innerHTML = ui.day && DAYS[ui.day] ? DAYS[ui.day].label + ' <b>' + clockStr(m) + '</b>' : 'Simulated time <b>' + clockStr(m) + '</b>';
    if (ui.mode === 'resp') { $('price').value = p; $('priceOut').textContent = money(p) + '/hr'; }
    drawTrend();
    markSweep();
  }

  /* ---------- the rate sweep ---------- */
  var sweep = null, sweepJob = 0;
  var PRICES = []; for (var pp = 1; pp <= 8.001; pp += 0.5) PRICES.push(pp);
  // the default summer Saturday, computed ahead with the same runs so the charts open complete
  var PRESET = { lam: 135, rows: [{"trip":16.3,"occ":0.983,"circ":12.3,"left":9.8,"rev":127.5,"cruiseMi":18.6,"search":18.3,"p":1},{"trip":15.9,"occ":0.984,"circ":11.6,"left":7.8,"rev":191.5,"cruiseMi":18.9,"search":16.3,"p":1.5},{"trip":15.9,"occ":0.978,"circ":7.6,"left":5,"rev":253.8,"cruiseMi":15.8,"search":14.6,"p":2},{"trip":14.8,"occ":0.987,"circ":6.7,"left":5.5,"rev":320.2,"cruiseMi":16.7,"search":13,"p":2.5},{"trip":14.4,"occ":0.987,"circ":6.8,"left":3.8,"rev":384.3,"cruiseMi":16.8,"search":12.2,"p":3},{"trip":9.2,"occ":0.981,"circ":3,"left":3,"rev":445.2,"cruiseMi":13.5,"search":7,"p":3.5},{"trip":5,"occ":0.972,"circ":0.9,"left":1,"rev":504.4,"cruiseMi":7.1,"search":3.4,"p":4},{"trip":4.3,"occ":0.904,"circ":0,"left":0,"rev":527.5,"cruiseMi":1.1,"search":2.2,"p":4.5},{"trip":4.2,"occ":0.842,"circ":0,"left":0,"rev":546.3,"cruiseMi":0.4,"search":1.9,"p":5},{"trip":4.6,"occ":0.771,"circ":0,"left":0,"rev":549.8,"cruiseMi":0,"search":1.9,"p":5.5},{"trip":4.2,"occ":0.606,"circ":0,"left":0,"rev":471.4,"cruiseMi":0,"search":1.7,"p":6},{"trip":4.2,"occ":0.532,"circ":0,"left":0,"rev":448.5,"cruiseMi":0,"search":1.6,"p":6.5},{"trip":4.3,"occ":0.443,"circ":0,"left":0,"rev":402.4,"cruiseMi":0,"search":1.5,"p":7},{"trip":4.3,"occ":0.452,"circ":0,"left":0,"rev":439.8,"cruiseMi":0,"search":1.5,"p":7.5},{"trip":4.2,"occ":0.391,"circ":0,"left":0,"rev":405.4,"cruiseMi":0,"search":1.5,"p":8}] };
  function runSweep() {
    var job = ++sweepJob, lam = ui.lam, res = [], k = 0;
    if (lam === PRESET.lam) { sweep = PRESET; drawSweep(); return; }
    function next() {
      if (job !== sweepJob) return;
      $('sweepText').innerHTML = '<span class="computing">Running the model at fifteen rates from $1 to $8 for ' + lam + ' drivers an hour… ' + k + ' of 15</span>';
      var p = PRICES[k];
      var a = runHeadless(world, p, lam, 11, 60, 120), b = runHeadless(world, p, lam, 23, 60, 120);
      var r = { p: p };
      ['occ', 'circ', 'rev', 'cruiseMi', 'left', 'toLot', 'search', 'trip'].forEach(function (f) { r[f] = (a[f] + b[f]) / 2; });
      res.push(r); k++;
      if (k < PRICES.length) setTimeout(next, 0);
      else { sweep = { lam: lam, rows: res }; drawSweep(); }
    }
    setTimeout(next, 30);
  }
  function interp(rows, p, f) {
    if (p <= rows[0].p) return rows[0][f];
    for (var i = 1; i < rows.length; i++) if (p <= rows[i].p) { var a = rows[i - 1], b = rows[i], t = (p - a.p) / (b.p - a.p); return a[f] + (b[f] - a[f]) * t; }
    return rows[rows.length - 1][f];
  }
  function bestRow(rows) {
    for (var i = 0; i < rows.length; i++) if (rows[i].occ <= 0.9 && rows[i].circ < 0.3) return rows[i];
    return null;
  }
  function drawSweep() {
    if (!sweep) return;
    var rows = sweep.rows, at2 = rows[2], best = bestRow(rows), lam = sweep.lam, t;
    if (at2.occ <= 0.9 && at2.circ < 0.3) {
      t = 'At <b>' + lam + ' drivers an hour</b>, $2.00 already works: the loop meters average <b>' + Math.round(at2.occ * 100) + '% full</b>, nobody circles, and a trip around the loop takes about ' + Math.round(at2.trip) + ' minutes.';
      if (at2.occ < 0.75) t += ' A lower rate would fill it closer to 85%, which is the case for charging less off-season.';
    } else {
      t = 'At <b>' + lam + ' drivers an hour</b>, $2.00 keeps the loop meters <b>' + Math.round(at2.occ * 100) + '% full</b>. Traffic backs up from the Monterey Ave stop, a trip around the loop takes about <b>' + Math.round(at2.trip) + ' minutes</b>, about ' + Math.round(at2.circ) + ' cars are circling at any moment, and ' + Math.round(at2.left) + ' drivers an hour give up on Capitola.';
      if (best) t += ' At about <b>' + money(best.p) + '</b> the meters run ' + Math.round(best.occ * 100) + '% full, the circling stops, a trip around takes about <b>' + Math.round(best.trip) + ' minutes</b>, and the meters take in <b>$' + Math.round(best.rev) + ' an hour instead of $' + Math.round(at2.rev) + '</b>.';
      else t += ' Even $8.00 doesn\'t clear the curb at this level of demand.';
    }
    $('sweepText').innerHTML = t;
    markSweep(true);
  }
  var lastMark = 0;
  function markSweep(force) {
    if (!sweep) return;
    var now = performance.now(); if (!force && now - lastMark < 600) return; lastMark = now;
    var rows = sweep.rows, best = bestRow(rows), p = sim ? sim.price : 2;
    var specs = [
      { id: 'sw0', f: 'occ', max: 1, fmt: function (v) { return Math.round(v * 100) + '%'; }, band: true, color: T.parked },
      { id: 'sw1', f: 'trip', max: null, fmt: function (v) { return Math.round(v) + 'm'; }, color: T.amber },
      { id: 'sw2', f: 'circ', max: null, fmt: function (v) { return v.toFixed(v < 10 ? 1 : 0); }, color: T.accent },
      { id: 'sw3', f: 'rev', max: null, fmt: function (v) { return '$' + Math.round(v); }, color: T.ink }
    ];
    specs.forEach(function (sp) {
      var cv = $(sp.id), dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
      var padL = 40, padR = 10, top = 10, bot = 22, ph = H - top - bot, pw = W - padL - padR;
      var max = sp.max; if (!max) { max = 0; rows.forEach(function (r) { max = Math.max(max, r[sp.f]); }); max = niceMax(max); }
      function xp(v) { return padL + pw * (v - 1) / 7; }
      function yv(v) { return top + ph * (1 - v / max); }
      if (sp.band) { c.fillStyle = T.band; c.fillRect(padL, yv(0.9), pw, yv(0.8) - yv(0.9)); }
      c.strokeStyle = T.rule2; c.lineWidth = 1; c.font = '10px ' + T.fMono; c.fillStyle = T.ink3; c.textAlign = 'right'; c.textBaseline = 'middle';
      [0, 0.5, 1].forEach(function (g) { var y = yv(max * g); c.beginPath(); c.moveTo(padL, y + 0.5); c.lineTo(W - padR, y + 0.5); c.stroke(); c.fillText(sp.fmt(max * g), padL - 5, y); });
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      for (var d = 1; d <= 8; d++) c.fillText('$' + d, xp(d), H - 5);
      c.setLineDash([3, 3]); c.strokeStyle = T.ink3; c.beginPath(); c.moveTo(xp(2) + 0.5, top); c.lineTo(xp(2) + 0.5, top + ph); c.stroke(); c.setLineDash([]);
      c.fillStyle = T.ink3; c.textAlign = 'left'; c.fillText('today', xp(2) + 4, top + 10);
      c.strokeStyle = sp.color; c.lineWidth = 2.2; c.beginPath();
      rows.forEach(function (r, i) { var x = xp(r.p), y = yv(r[sp.f]); if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.stroke();
      c.fillStyle = sp.color; rows.forEach(function (r) { c.beginPath(); c.arc(xp(r.p), yv(r[sp.f]), 2, 0, Math.PI * 2); c.fill(); });
      if (best) { c.strokeStyle = T.good; c.lineWidth = 2; c.beginPath(); c.arc(xp(best.p), yv(best[sp.f]), 6, 0, Math.PI * 2); c.stroke(); }
      var v = interp(rows, Math.min(8, p), sp.f);
      c.fillStyle = T.ink; c.beginPath(); c.arc(xp(Math.min(8, p)), yv(v), 4.5, 0, Math.PI * 2); c.fill();
    });
  }
  function niceMax(v) { if (v <= 0) return 1; var e = Math.pow(10, Math.floor(Math.log10(v))), m = v / e; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * e; }

  /* ---------- controls ---------- */
  function setPressed(ids, on) { ids.forEach(function (id) { $(id).setAttribute('aria-pressed', String(id === on)); }); }
  // changing the rate or demand restarts the afternoon at the new setting, already settled
  var restartTimer = null;
  function restart(delay) {
    clearTimeout(restartTimer);
    restartTimer = setTimeout(function () { newSim(); updatePanel(); drawDynamic(performance.now()); markSweep(true); }, delay || 0);
  }
  function setMode(m) {
    ui.mode = m;
    setPressed(['pToday', 'pTry', 'pResp'], m === 'today' ? 'pToday' : m === 'try' ? 'pTry' : 'pResp');
    $('price').disabled = m === 'resp';
    if (m !== 'resp') { $('price').value = currentPrice(); $('priceOut').textContent = money(currentPrice()) + '/hr'; }
    restart(0);
  }
  $('pToday').addEventListener('click', function () { setMode('today'); });
  $('pTry').addEventListener('click', function () { setMode('try'); });
  $('pResp').addEventListener('click', function () { setMode('resp'); });
  $('price').addEventListener('input', function () {
    var v = parseFloat(this.value);
    ui.tryPrice = v;
    if (ui.mode !== 'try') { ui.mode = 'try'; setPressed(['pToday', 'pTry', 'pResp'], 'pTry'); sim.mode = 'flat'; }
    if (Math.abs(v - 2) < 0.001) { ui.mode = 'today'; setPressed(['pToday', 'pTry', 'pResp'], 'pToday'); }
    $('priceOut').textContent = money(v) + '/hr';
    restart(350);
  });
  var lamTimer = null;
  function setLam(v, fromSlider) {
    ui.lam = v; $('lamOut').textContent = v + ' / hr'; if (!fromSlider) $('lam').value = v;
    restart(fromSlider ? 350 : 0);
    var match = null; Object.keys(DAYS).forEach(function (k) { if (DAYS[k].lam === v) match = k; });
    ui.day = match;
    setPressed(['dWinter', 'dSpring', 'dSummer'], match === 'winter' ? 'dWinter' : match === 'spring' ? 'dSpring' : match === 'summer' ? 'dSummer' : '');
    clearTimeout(lamTimer); lamTimer = setTimeout(runSweep, 450);
  }
  $('dWinter').addEventListener('click', function () { setLam(DAYS.winter.lam); });
  $('dSpring').addEventListener('click', function () { setLam(DAYS.spring.lam); });
  $('dSummer').addEventListener('click', function () { setLam(DAYS.summer.lam); });
  $('lam').addEventListener('input', function () { setLam(parseInt(this.value, 10), true); });
  $('pause').addEventListener('click', function () { ui.paused = !ui.paused; this.textContent = ui.paused ? 'Play' : 'Pause'; });
  $('speed').addEventListener('click', function () { ui.speedIx = (ui.speedIx + 1) % ui.speeds.length; this.textContent = 'Speed: ' + ui.speeds[ui.speedIx].k; });
  $('reset').addEventListener('click', function () { newSim(); updatePanel(); drawDynamic(performance.now()); });

  /* ---------- loop ---------- */
  var last = performance.now(), lastUI = 0;
  function frame(now) {
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!ui.paused) {
      var simDt = dt * ui.speeds[ui.speedIx].v;
      while (simDt > 0) { var h = Math.min(1, simDt); sim.step(h); simDt -= h; }
    }
    drawDynamic(now);
    if (now - lastUI > 250) { lastUI = now; updatePanel(); }
    requestAnimationFrame(frame);
  }
  function onTheme() { readTokens(); drawStatic(); drawDynamic(performance.now()); drawTrend(); markSweep(true); }
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', onTheme); else if (mq.addListener) mq.addListener(onTheme);
  }
  new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
  var rz = null;
  window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { sizeMap(); drawDynamic(performance.now()); drawTrend(); markSweep(true); }, 120); });

  // start: a summer Saturday at today's $2.00, already early-afternoon busy
  $('occH').textContent = 'Occupancy, all ' + NSP + ' loop meters';
  newSim();
  readTokens();
  sizeMap();
  $('pause').textContent = ui.paused ? 'Play' : 'Pause';
  updatePanel();
  drawDynamic(performance.now());
  runSweep();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { drawStatic(); drawDynamic(performance.now()); });
  requestAnimationFrame(function (t) { last = t; frame(t); });
})();
