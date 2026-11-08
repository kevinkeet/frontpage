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
  var DAYS = { winter: { v: 1500, label: 'Tuesday' }, spring: { v: 4500, label: 'Sunday' }, summer: { v: 9000, label: 'Saturday' } };
  var ui = {
    mode: 'today', tryPrice: 6, day: 'summer', visitors: 9000,
    speeds: [{ k: 'Normal', v: 20 }, { k: 'Fast', v: 60 }, { k: 'Slow', v: 6 }], speedIx: 0,
    paused: false
  };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) ui.paused = true;
  var sim;
  var START_MIN = 8 * 60;   // the day starts at 8 AM; opening the page runs the morning, to 1 PM
  var WARM = 300;

  function matchedPrice() { var r = sweep && sweep.v === ui.visitors ? bestRow(sweep.rows) : null; return r ? r.p : null; }
  function currentPrice() { return ui.mode === 'today' ? 2 : ui.mode === 'try' ? ui.tryPrice : (matchedPrice() || 2); }
  function newSim() {
    sim = new Sim(world, { seed: (Math.random() * 1e9) >>> 0, price: currentPrice(), visitors: ui.visitors, visual: true, prefill: 0.15 });
    sim.warm(WARM);
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
    // shade the road under traffic: red where it's stopped, amber where it crawls
    c.lineCap = 'round';
    for (i = 0; i < sim.cars.length; i++) {
      car = sim.cars[i];
      if (car.st === 'parked' || car.st === 'gone') continue;
      var inLine = car.lane === 'AJ' || car.lane === 'AM';
      var stopped = car.st === 'load' || car.st === 'pin' || car.st === 'pout' || (inLine ? true : (car.v || 0) < 0.45);
      var slow = !stopped && (car.v || 0) < 1.3;
      if (inLine && car.s < 0) continue;
      if (inLine && car.queued == null && sim.waitingIn === 0) continue;
      if (!stopped && !slow) continue;
      var PL = car.lane === 'AJ' ? SPUR : car.lane === 'AM' ? AMP : lanePoly(car.lane), lo2 = inLine ? 1.7 : car.lane === 'R' ? laneOffset(car.s) : 0;
      var q1 = PL.at(Math.max(0, car.s - 4)), q2 = PL.at(Math.min(PL.len, car.s + 4));
      c.strokeStyle = stopped ? T.accent : T.amber; c.globalAlpha = stopped ? 0.32 : 0.22; c.lineWidth = 6.5 * K;
      c.beginPath(); c.moveTo(X(q1.x + q1.nx * lo2), Y(q1.y + q1.ny * lo2)); c.lineTo(X(q2.x + q2.nx * lo2), Y(q2.y + q2.ny * lo2)); c.stroke();
    }
    c.globalAlpha = 1;
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

  /* ---------- trend chart: the day so far, 8 AM to 8 PM ---------- */
  var trend = document.getElementById('trend'), tctx = trend.getContext('2d');
  function drawTrend() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2), W = trend.clientWidth, H = trend.clientHeight;
    if (trend.width !== Math.round(W * dpr)) { trend.width = Math.round(W * dpr); trend.height = Math.round(H * dpr); }
    var c = tctx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    var data = sim.min.slice(0, -1); if (!data.length) return;
    var padL = 34, padR = 40, y0 = 8, mainH = H * 0.6, stripTop = y0 + mainH + 18, stripH = H - stripTop - 16;
    var span = 720, x0 = padL, xw = (W - padL - padR) / span;
    function xi(b) { return x0 + b.t * xw; }
    function yo(o) { return y0 + mainH * (1 - o); }
    c.fillStyle = T.band; c.fillRect(padL, yo(0.9), W - padL - padR, yo(0.8) - yo(0.9));
    c.strokeStyle = T.rule2; c.lineWidth = 1;
    [0, 0.5, 1].forEach(function (g) { c.beginPath(); c.moveTo(padL, yo(g) + 0.5); c.lineTo(W - padR, yo(g) + 0.5); c.stroke(); });
    c.font = '10px ' + T.fMono; c.fillStyle = T.ink3; c.textAlign = 'right'; c.textBaseline = 'middle';
    c.fillText('100%', padL - 4, yo(1)); c.fillText('50%', padL - 4, yo(0.5)); c.fillText('0', padL - 4, yo(0));
    // share of the loop at a standstill (shaded), occupancy (line)
    c.fillStyle = T.accent; c.globalAlpha = 0.3; c.beginPath(); c.moveTo(xi(data[0]), yo(0));
    data.forEach(function (b) { c.lineTo(xi(b), yo(b.n ? b.stopLen / b.n : 0)); });
    c.lineTo(xi(data[data.length - 1]), yo(0)); c.closePath(); c.fill(); c.globalAlpha = 1;
    c.strokeStyle = T.parked; c.lineWidth = 2; c.beginPath();
    data.forEach(function (b, i) { var o = b.n ? b.occ / b.n : 0; if (i) c.lineTo(xi(b), yo(o)); else c.moveTo(xi(b), yo(o)); });
    c.stroke();
    var pmax = 8; data.forEach(function (b) { pmax = Math.max(pmax, b.price); });
    function yp(p) { return stripTop + stripH * (1 - p / pmax); }
    c.strokeStyle = T.rule2; c.beginPath(); c.moveTo(padL, stripTop + stripH + 0.5); c.lineTo(W - padR, stripTop + stripH + 0.5); c.stroke();
    c.strokeStyle = T.ink; c.lineWidth = 1.5; c.beginPath();
    data.forEach(function (b, i) { var y = yp(b.price); if (i) { c.lineTo(xi(b), yp(data[i - 1].price)); c.lineTo(xi(b), y); } else c.moveTo(xi(b), y); });
    c.stroke();
    c.fillStyle = T.ink3; c.textAlign = 'right';
    c.fillText('$' + pmax, padL - 4, stripTop + 2); c.fillText('$0', padL - 4, stripTop + stripH);
    c.textAlign = 'left'; c.fillStyle = T.ink;
    var lastB = data[data.length - 1];
    c.fillText('$' + lastB.price.toFixed(2), Math.min(W - padR + 2, xi(lastB) + 4), yp(lastB.price) - 6);
    c.fillStyle = T.ink3; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    for (var hh = 0; hh <= 12; hh += 2) c.fillText(clockStr(START_MIN + hh * 60, true), x0 + hh * 60 * xw, H - 1);
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
  function fmtV(v) { return v.toLocaleString('en-US'); }
  function updatePanel() {
    var p = sim.price, w = sim.windowStats(60), open = NSP - sim.occNow;
    var share = tryShare(p), txt;
    if (ui.mode === 'match') txt = 'Matched to the crowd: ' + money(p) + ' all day is the lowest rate the model finds keeps the loop moving with ' + fmtV(ui.visitors) + ' visitors. ' + Math.round(share * 100) + '% of arriving drivers try the loop first.';
    else txt = 'At ' + money(p) + ', ' + Math.round(share * 100) + '% of arriving drivers try the loop first. The rest head for the $1.00 lots.';
    var stop = Math.round((sim.stopShare || 0) * 100);
    $('status').innerHTML = txt + '<span class="live">' + open + ' of ' + NSP + ' spaces open · ' + sim.circNow + ' circling · ' + stop + '% of the loop stopped · ' + sim.waitingIn + ' waiting to get in</span>';
    var occ = sim.occNow / NSP;
    $('occFill').style.width = (occ * 100).toFixed(1) + '%';
    $('occFill').classList.toggle('full', occ >= 0.97);
    $('occText').textContent = Math.round(occ * 100) + '% · ' + open + ' open';
    $('tTrip').innerHTML = w.tripN ? w.trip.toFixed(1) + '<small>min</small>' : '–';
    $('tTrip').classList.toggle('hot', w.tripN > 0 && w.trip > 9); $('tTrip').classList.toggle('ok', w.tripN > 0 && w.trip <= 6);
    $('tStop').innerHTML = Math.round(w.standstill * 100) + '<small>%</small>'; $('tStop').classList.toggle('hot', w.standstill > 0.15);
    $('tCirc').innerHTML = sim.circNow + '<small>cars</small>'; $('tCirc').classList.toggle('hot', sim.circNow > 0);
    $('tSearch').innerHTML = w.search.toFixed(1) + '<small>min</small>'; $('tSearch').classList.toggle('hot', w.search > 5);
    $('tLeft').innerHTML = w.left.toFixed(1) + '<small>/hr</small>'; $('tLeft').classList.toggle('hot', w.left > 0.5);
    $('tRev').innerHTML = '$' + Math.round(w.rev) + '<small>/hr</small>';
    var m = START_MIN + sim.t / 60;
    $('clock').innerHTML = (ui.day && DAYS[ui.day] ? DAYS[ui.day].label : 'A day with ' + fmtV(ui.visitors) + ' visitors,') + ' <b>' + clockStr(m) + '</b>';
    if (ui.mode === 'match') { $('price').value = p; $('priceOut').textContent = money(p) + '/hr'; }
    drawTrend();
    markSweep();
  }

  /* ---------- the rate sweep: whole days at each rate, 1 to 3 PM ---------- */
  var sweep = null, sweepJob = 0;
  // computed ahead with the same engine (bake.js): two runs per rate, so the charts open complete
  var SWEEPS = {"1500":[{"p":1,"occ":0.579,"trip":3,"circ":0,"standstill":0.003,"left":0,"rev":66.6,"search":1.3,"cruiseMi":0},{"p":1.5,"occ":0.486,"trip":3.1,"circ":0,"standstill":0.003,"left":0,"rev":82.3,"search":1.3,"cruiseMi":0},{"p":2,"occ":0.455,"trip":3.3,"circ":0,"standstill":0.004,"left":0,"rev":106,"search":1.2,"cruiseMi":0},{"p":2.5,"occ":0.387,"trip":3.2,"circ":0,"standstill":0.004,"left":0,"rev":109.1,"search":1.2,"cruiseMi":0},{"p":3,"occ":0.452,"trip":3,"circ":0,"standstill":0.003,"left":0,"rev":159.2,"search":1.3,"cruiseMi":0},{"p":3.5,"occ":0.376,"trip":3.2,"circ":0,"standstill":0.004,"left":0,"rev":157.4,"search":1.2,"cruiseMi":0},{"p":4,"occ":0.297,"trip":3.2,"circ":0,"standstill":0.004,"left":0,"rev":139.8,"search":1.2,"cruiseMi":0},{"p":4.5,"occ":0.251,"trip":3.3,"circ":0,"standstill":0.004,"left":0,"rev":133.1,"search":1.1,"cruiseMi":0},{"p":5,"occ":0.28,"trip":3.3,"circ":0,"standstill":0.003,"left":0,"rev":164.1,"search":1.1,"cruiseMi":0},{"p":5.5,"occ":0.234,"trip":3.3,"circ":0,"standstill":0.004,"left":0,"rev":155.2,"search":1.2,"cruiseMi":0},{"p":6,"occ":0.16,"trip":3.3,"circ":0,"standstill":0.004,"left":0,"rev":112,"search":1.2,"cruiseMi":0},{"p":6.5,"occ":0.189,"trip":3.3,"circ":0,"standstill":0.004,"left":0,"rev":139.3,"search":1,"cruiseMi":0},{"p":7,"occ":0.172,"trip":3.3,"circ":0,"standstill":0.004,"left":0,"rev":141.5,"search":1,"cruiseMi":0},{"p":7.5,"occ":0.218,"trip":3.3,"circ":0,"standstill":0.004,"left":0,"rev":195,"search":1.1,"cruiseMi":0},{"p":8,"occ":0.147,"trip":3.5,"circ":0,"standstill":0.005,"left":0,"rev":138.7,"search":1,"cruiseMi":0}],"4500":[{"p":1,"occ":0.997,"trip":4.5,"circ":8.6,"standstill":0.062,"left":6.3,"rev":105.2,"search":8.5,"cruiseMi":32.6},{"p":1.5,"occ":0.997,"trip":4,"circ":8.1,"standstill":0.066,"left":4.3,"rev":161.9,"search":8.8,"cruiseMi":32.3},{"p":2,"occ":0.994,"trip":3.2,"circ":2.9,"standstill":0.015,"left":4,"rev":220.7,"search":5.1,"cruiseMi":16.9},{"p":2.5,"occ":0.995,"trip":3.6,"circ":5.4,"standstill":0.028,"left":2.8,"rev":276.6,"search":6.4,"cruiseMi":26.4},{"p":3,"occ":0.988,"trip":3.3,"circ":1.9,"standstill":0.016,"left":2,"rev":334.8,"search":4.2,"cruiseMi":12.4},{"p":3.5,"occ":0.971,"trip":3.2,"circ":0.8,"standstill":0.011,"left":0.8,"rev":380.9,"search":3.2,"cruiseMi":7.1},{"p":4,"occ":0.907,"trip":3.4,"circ":0.1,"standstill":0.012,"left":0.3,"rev":412.4,"search":2,"cruiseMi":1.4},{"p":4.5,"occ":0.884,"trip":3.4,"circ":0.1,"standstill":0.012,"left":0,"rev":469.3,"search":1.8,"cruiseMi":0.8},{"p":5,"occ":0.843,"trip":3.3,"circ":0,"standstill":0.01,"left":0,"rev":508.6,"search":1.7,"cruiseMi":0.2},{"p":5.5,"occ":0.7,"trip":3.5,"circ":0,"standstill":0.013,"left":0,"rev":460.3,"search":1.5,"cruiseMi":0},{"p":6,"occ":0.615,"trip":3.4,"circ":0,"standstill":0.011,"left":0,"rev":442.1,"search":1.5,"cruiseMi":0},{"p":6.5,"occ":0.56,"trip":3.5,"circ":0,"standstill":0.012,"left":0,"rev":442,"search":1.5,"cruiseMi":0},{"p":7,"occ":0.487,"trip":3.4,"circ":0,"standstill":0.011,"left":0,"rev":409.1,"search":1.4,"cruiseMi":0},{"p":7.5,"occ":0.484,"trip":3.5,"circ":0,"standstill":0.012,"left":0,"rev":442.7,"search":1.4,"cruiseMi":0},{"p":8,"occ":0.394,"trip":3.6,"circ":0,"standstill":0.013,"left":0,"rev":383.8,"search":1.3,"cruiseMi":0}],"6000":[{"p":1,"occ":0.994,"trip":16.5,"circ":25.2,"standstill":0.466,"left":10.5,"rev":99.3,"search":29.3,"cruiseMi":25.6},{"p":1.5,"occ":0.996,"trip":13.9,"circ":22.1,"standstill":0.384,"left":10.1,"rev":152.6,"search":24.8,"cruiseMi":29.3},{"p":2,"occ":0.994,"trip":13.5,"circ":20.6,"standstill":0.37,"left":7.9,"rev":209.5,"search":25.2,"cruiseMi":25.6},{"p":2.5,"occ":0.995,"trip":7.2,"circ":10.8,"standstill":0.156,"left":7,"rev":262,"search":12.5,"cruiseMi":31.9},{"p":3,"occ":0.994,"trip":6.2,"circ":6.7,"standstill":0.095,"left":4.8,"rev":328.7,"search":9.4,"cruiseMi":24.6},{"p":3.5,"occ":0.992,"trip":5.3,"circ":6.4,"standstill":0.138,"left":4.5,"rev":378.9,"search":9.8,"cruiseMi":24.8},{"p":4,"occ":0.987,"trip":4.7,"circ":4.1,"standstill":0.051,"left":4,"rev":431.4,"search":6.5,"cruiseMi":18.7},{"p":4.5,"occ":0.981,"trip":3.8,"circ":2.1,"standstill":0.025,"left":2.3,"rev":509,"search":4.5,"cruiseMi":12.6},{"p":5,"occ":0.973,"trip":3.9,"circ":2.1,"standstill":0.033,"left":1.9,"rev":568.4,"search":4.2,"cruiseMi":12.1},{"p":5.5,"occ":0.92,"trip":3.6,"circ":0.3,"standstill":0.018,"left":0,"rev":598.9,"search":2.3,"cruiseMi":2.9},{"p":6,"occ":0.861,"trip":3.7,"circ":0,"standstill":0.019,"left":0.1,"rev":596.1,"search":1.8,"cruiseMi":0.4},{"p":6.5,"occ":0.835,"trip":3.6,"circ":0,"standstill":0.016,"left":0,"rev":627.7,"search":1.8,"cruiseMi":0.1},{"p":7,"occ":0.73,"trip":3.7,"circ":0,"standstill":0.018,"left":0,"rev":605.9,"search":1.6,"cruiseMi":0},{"p":7.5,"occ":0.611,"trip":3.8,"circ":0,"standstill":0.019,"left":0,"rev":557.4,"search":1.6,"cruiseMi":0},{"p":8,"occ":0.52,"trip":3.6,"circ":0,"standstill":0.017,"left":0,"rev":494.2,"search":1.4,"cruiseMi":0}],"7500":[{"p":1,"occ":0.975,"trip":22.2,"circ":25.4,"standstill":0.603,"left":13.8,"rev":100.9,"search":48,"cruiseMi":24.2},{"p":1.5,"occ":0.989,"trip":19.9,"circ":24.3,"standstill":0.556,"left":11.8,"rev":148.9,"search":46,"cruiseMi":27.6},{"p":2,"occ":0.984,"trip":19.5,"circ":21.5,"standstill":0.557,"left":11.6,"rev":198,"search":39.9,"cruiseMi":26.9},{"p":2.5,"occ":0.989,"trip":18.6,"circ":18.7,"standstill":0.513,"left":10.5,"rev":251.5,"search":28.1,"cruiseMi":22.9},{"p":3,"occ":0.996,"trip":14.9,"circ":16.4,"standstill":0.398,"left":7.6,"rev":325.1,"search":22.6,"cruiseMi":24.4},{"p":3.5,"occ":0.992,"trip":15.2,"circ":13.9,"standstill":0.382,"left":9,"rev":375.7,"search":20.9,"cruiseMi":24.6},{"p":4,"occ":0.995,"trip":13.2,"circ":11.3,"standstill":0.312,"left":8.3,"rev":430.7,"search":18.7,"cruiseMi":22},{"p":4.5,"occ":0.991,"trip":8.4,"circ":6,"standstill":0.16,"left":4.1,"rev":497.1,"search":10.7,"cruiseMi":20},{"p":5,"occ":0.996,"trip":6.6,"circ":5.4,"standstill":0.116,"left":4.6,"rev":563.7,"search":8.8,"cruiseMi":20.4},{"p":5.5,"occ":0.973,"trip":5.2,"circ":1.7,"standstill":0.059,"left":1.6,"rev":597.1,"search":4.9,"cruiseMi":9.1},{"p":6,"occ":0.947,"trip":4.5,"circ":0.7,"standstill":0.041,"left":0.8,"rev":664.4,"search":3,"cruiseMi":4.6},{"p":6.5,"occ":0.94,"trip":4.1,"circ":0.5,"standstill":0.034,"left":0.3,"rev":736.5,"search":2.7,"cruiseMi":3.8},{"p":7,"occ":0.871,"trip":4,"circ":0,"standstill":0.027,"left":0,"rev":723.3,"search":2,"cruiseMi":0.6},{"p":7.5,"occ":0.814,"trip":3.9,"circ":0,"standstill":0.025,"left":0,"rev":720.1,"search":1.8,"cruiseMi":0.2},{"p":8,"occ":0.711,"trip":3.9,"circ":0,"standstill":0.024,"left":0,"rev":683,"search":1.7,"cruiseMi":0}],"9000":[{"p":1,"occ":0.974,"trip":25.9,"circ":20.8,"standstill":0.67,"left":8.9,"rev":92.6,"search":49.6,"cruiseMi":16.1},{"p":1.5,"occ":0.973,"trip":22.9,"circ":23,"standstill":0.619,"left":9.8,"rev":144.7,"search":44.7,"cruiseMi":20.3},{"p":2,"occ":0.964,"trip":22.4,"circ":21.6,"standstill":0.639,"left":9.4,"rev":197.2,"search":48.4,"cruiseMi":19.4},{"p":2.5,"occ":0.97,"trip":22.7,"circ":21.3,"standstill":0.629,"left":10.3,"rev":249,"search":46.5,"cruiseMi":21.8},{"p":3,"occ":0.98,"trip":21.6,"circ":18.6,"standstill":0.575,"left":12.1,"rev":298.5,"search":41,"cruiseMi":23.2},{"p":3.5,"occ":0.984,"trip":19.5,"circ":17.1,"standstill":0.532,"left":11.3,"rev":378.4,"search":31.8,"cruiseMi":24.6},{"p":4,"occ":0.987,"trip":20.8,"circ":11.4,"standstill":0.512,"left":8.4,"rev":427.7,"search":27,"cruiseMi":18.3},{"p":4.5,"occ":0.988,"trip":19.6,"circ":11,"standstill":0.503,"left":7,"rev":497,"search":27.5,"cruiseMi":17.8},{"p":5,"occ":0.992,"trip":18.3,"circ":8.7,"standstill":0.457,"left":5.6,"rev":544.9,"search":19.4,"cruiseMi":15.6},{"p":5.5,"occ":0.986,"trip":17.3,"circ":7.2,"standstill":0.411,"left":7.3,"rev":612.4,"search":20.2,"cruiseMi":16.1},{"p":6,"occ":0.987,"trip":16.1,"circ":3.7,"standstill":0.328,"left":2.3,"rev":670.1,"search":12.8,"cruiseMi":9.7},{"p":6.5,"occ":0.984,"trip":11.9,"circ":2.4,"standstill":0.221,"left":1.6,"rev":722,"search":8.8,"cruiseMi":8},{"p":7,"occ":0.973,"trip":11.5,"circ":1.8,"standstill":0.208,"left":1.5,"rev":805.4,"search":6.9,"cruiseMi":5.7},{"p":7.5,"occ":0.92,"trip":6.7,"circ":0.3,"standstill":0.082,"left":0.5,"rev":821,"search":3.4,"cruiseMi":2.3},{"p":8,"occ":0.824,"trip":5.9,"circ":0,"standstill":0.073,"left":0.3,"rev":782.2,"search":2.2,"cruiseMi":0.7}]};
  function runSweep() {
    var job = ++sweepJob, v = ui.visitors, res = [], k = 0, prices = [1, 2, 3, 4, 5, 6, 7, 8];
    if (SWEEPS[v]) { sweep = { v: v, rows: SWEEPS[v] }; drawSweep(); afterSweep(); return; }
    function next() {
      if (job !== sweepJob) return;
      $('sweepText').innerHTML = '<span class="computing">Running whole days at eight rates for ' + fmtV(v) + ' visitors… ' + k + ' of 8</span>';
      var p = prices[k], a = runDay(world, p, v, 11, 300, 420), r = { p: p };
      ['occ', 'circ', 'rev', 'left', 'search', 'trip', 'standstill', 'cruiseMi'].forEach(function (f) { r[f] = a[f]; });
      res.push(r); k++;
      if (k < prices.length) setTimeout(next, 0);
      else { sweep = { v: v, rows: res }; drawSweep(); afterSweep(); }
    }
    setTimeout(next, 30);
  }
  function afterSweep() { if (ui.mode === 'match' && sim && Math.abs(sim.price - currentPrice()) > 0.001) restart(0); }
  function interp(rows, p, f) {
    if (p <= rows[0].p) return rows[0][f];
    for (var i = 1; i < rows.length; i++) if (p <= rows[i].p) { var a = rows[i - 1], b = rows[i], t = (p - a.p) / (b.p - a.p); return a[f] + (b[f] - a[f]) * t; }
    return rows[rows.length - 1][f];
  }
  // the lowest rate with the loop moving: little circling and almost none of it stopped
  function bestRow(rows) {
    for (var i = 0; i < rows.length; i++) if (rows[i].circ < 1.5 && rows[i].standstill < 0.1) return rows[i];
    return null;
  }
  function drawSweep() {
    if (!sweep) return;
    var rows = sweep.rows, at2 = rows.filter(function (r) { return r.p === 2; })[0], best = bestRow(rows), t, who = '<b>' + fmtV(sweep.v) + ' visitors</b>';
    if (best && best.p <= 2) {
      t = 'With ' + who + ', $2.00 works: at 1 to 3 PM the loop meters are ' + Math.round(at2.occ * 100) + '% full, traffic keeps moving and a trip around takes about ' + Math.round(at2.trip) + ' minutes.' + (best.p < 2 ? ' A lower rate would work too.' : '');
    } else {
      t = 'With ' + who + ', $2.00 leaves the loop meters ' + Math.round(at2.occ * 100) + '% full at 1 to 3 PM. ' + Math.round(at2.standstill * 100) + '% of the loop is at a standstill, a trip around takes about <b>' + Math.round(at2.trip) + ' minutes</b>, about ' + Math.round(at2.circ) + ' cars are circling, and drivers take ' + Math.round(at2.search) + ' minutes from arriving to parking.';
      if (best) t += ' At about <b>' + money(best.p) + '</b> all day, the meters run ' + Math.round(best.occ * 100) + '% full, traffic moves, a trip around takes about <b>' + Math.round(best.trip) + ' minutes</b>, and the meters take in $' + Math.round(best.rev) + ' an hour instead of $' + Math.round(at2.rev) + '.';
      else t += ' Even $8.00 doesn\'t keep the loop moving with this many visitors: through traffic and drop-offs alone fill it.';
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
      { id: 'sw2', f: 'standstill', max: 1, fmt: function (v) { return Math.round(v * 100) + '%'; }, color: T.accent },
      { id: 'sw3', f: 'rev', max: null, fmt: function (v) { return '$' + Math.round(v); }, color: T.ink }
    ];
    specs.forEach(function (sp) {
      var cv = $(sp.id), dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
      var padL = 40, padR = 10, y0 = 10, bot = 22, ph = H - y0 - bot, pw = W - padL - padR;
      var max = sp.max; if (!max) { max = 0; rows.forEach(function (r) { max = Math.max(max, r[sp.f]); }); max = niceMax(max); }
      function xp(v) { return padL + pw * (v - 1) / 7; }
      function yv(v) { return y0 + ph * (1 - v / max); }
      if (sp.band) { c.fillStyle = T.band; c.fillRect(padL, yv(0.9), pw, yv(0.8) - yv(0.9)); }
      c.strokeStyle = T.rule2; c.lineWidth = 1; c.font = '10px ' + T.fMono; c.fillStyle = T.ink3; c.textAlign = 'right'; c.textBaseline = 'middle';
      [0, 0.5, 1].forEach(function (g) { var y = yv(max * g); c.beginPath(); c.moveTo(padL, y + 0.5); c.lineTo(W - padR, y + 0.5); c.stroke(); c.fillText(sp.fmt(max * g), padL - 5, y); });
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      for (var d = 1; d <= 8; d++) c.fillText('$' + d, xp(d), H - 5);
      c.setLineDash([3, 3]); c.strokeStyle = T.ink3; c.beginPath(); c.moveTo(xp(2) + 0.5, y0); c.lineTo(xp(2) + 0.5, y0 + ph); c.stroke(); c.setLineDash([]);
      c.fillStyle = T.ink3; c.textAlign = 'left'; c.fillText('today', xp(2) + 4, y0 + 10);
      c.strokeStyle = sp.color; c.lineWidth = 2.2; c.beginPath();
      rows.forEach(function (r, i) { var x = xp(r.p), y = yv(r[sp.f]); if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.stroke();
      c.fillStyle = sp.color; rows.forEach(function (r) { c.beginPath(); c.arc(xp(r.p), yv(r[sp.f]), 2, 0, Math.PI * 2); c.fill(); });
      if (best) { c.strokeStyle = T.good; c.lineWidth = 2; c.beginPath(); c.arc(xp(best.p), yv(best[sp.f]), 6, 0, Math.PI * 2); c.stroke(); }
      var vv = interp(rows, Math.min(8, p), sp.f);
      c.fillStyle = T.ink; c.beginPath(); c.arc(xp(Math.min(8, p)), yv(vv), 4.5, 0, Math.PI * 2); c.fill();
    });
  }
  function niceMax(v) { if (v <= 0) return 1; var e = Math.pow(10, Math.floor(Math.log10(v))), m = v / e; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * e; }

  /* ---------- controls ---------- */
  function setPressed(ids, on) { ids.forEach(function (id) { $(id).setAttribute('aria-pressed', String(id === on)); }); }
  // changing the rate or the crowd restarts the day and runs the morning, so you see 1 PM at the new setting
  var restartTimer = null;
  function restart(delay) {
    clearTimeout(restartTimer);
    restartTimer = setTimeout(function () {
      $('status').innerHTML = 'Running the morning at the new setting…';
      setTimeout(function () { newSim(); updatePanel(); drawDynamic(performance.now()); markSweep(true); }, 30);
    }, delay || 0);
  }
  function setMode(m) {
    ui.mode = m;
    setPressed(['pToday', 'pTry', 'pMatch'], m === 'today' ? 'pToday' : m === 'try' ? 'pTry' : 'pMatch');
    $('price').disabled = m === 'match';
    $('price').value = currentPrice(); $('priceOut').textContent = money(currentPrice()) + '/hr';
    restart(0);
  }
  $('pToday').addEventListener('click', function () { setMode('today'); });
  $('pTry').addEventListener('click', function () { setMode('try'); });
  $('pMatch').addEventListener('click', function () { setMode('match'); });
  $('price').addEventListener('input', function () {
    var v = parseFloat(this.value);
    ui.tryPrice = v;
    if (ui.mode !== 'try') { ui.mode = 'try'; setPressed(['pToday', 'pTry', 'pMatch'], 'pTry'); }
    if (Math.abs(v - 2) < 0.001) { ui.mode = 'today'; setPressed(['pToday', 'pTry', 'pMatch'], 'pToday'); }
    $('priceOut').textContent = money(v) + '/hr';
    restart(400);
  });
  var visTimer = null;
  function setVisitors(v, fromSlider) {
    ui.visitors = v; $('visOut').textContent = fmtV(v) + ' a day'; if (!fromSlider) $('vis').value = v;
    var match = null; Object.keys(DAYS).forEach(function (k) { if (DAYS[k].v === v) match = k; });
    ui.day = match;
    setPressed(['dWinter', 'dSpring', 'dSummer'], match === 'winter' ? 'dWinter' : match === 'spring' ? 'dSpring' : match === 'summer' ? 'dSummer' : '');
    clearTimeout(visTimer); visTimer = setTimeout(runSweep, 450);
    restart(fromSlider ? 400 : 0);
  }
  $('dWinter').addEventListener('click', function () { setVisitors(DAYS.winter.v); });
  $('dSpring').addEventListener('click', function () { setVisitors(DAYS.spring.v); });
  $('dSummer').addEventListener('click', function () { setVisitors(DAYS.summer.v); });
  $('vis').addEventListener('input', function () { setVisitors(parseInt(this.value, 10), true); });
  $('pause').addEventListener('click', function () { ui.paused = !ui.paused; this.textContent = ui.paused ? 'Play' : 'Pause'; });
  $('speed').addEventListener('click', function () { ui.speedIx = (ui.speedIx + 1) % ui.speeds.length; this.textContent = 'Speed: ' + ui.speeds[ui.speedIx].k; });
  $('reset').addEventListener('click', function () { restart(0); });

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
  function onTheme() { readTokens(); drawStatic(); if (!sim) return; drawDynamic(performance.now()); drawTrend(); markSweep(true); }
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', onTheme); else if (mq.addListener) mq.addListener(onTheme);
  }
  new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
  var rz = null;
  window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { sizeMap(); if (!sim) return; drawDynamic(performance.now()); drawTrend(); markSweep(true); }, 120); });

  // start: a summer Saturday at today's $2.00. Draw the map, then run the morning to 1 PM.
  $('occH').textContent = 'Occupancy, all ' + NSP + ' loop meters';
  readTokens();
  sizeMap();
  var mctx0 = mapC.getContext('2d'); mctx0.setTransform(1, 0, 0, 1, 0, 0); mctx0.drawImage(stat, 0, 0);
  $('pause').textContent = ui.paused ? 'Play' : 'Pause';
  $('status').innerHTML = 'Running the morning: 8 AM to 1 PM on a busy summer Saturday…';
  runSweep();
  setTimeout(function () {
    newSim();
    updatePanel();
    drawDynamic(performance.now());
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { drawStatic(); drawDynamic(performance.now()); });
    requestAnimationFrame(function (t) { last = t; frame(t); });
  }, 40);
})();
