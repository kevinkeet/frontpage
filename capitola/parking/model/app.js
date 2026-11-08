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
     'hazard', 'ped', 'pedRing', 'zebra', 'land', 'sand', 'sea', 'creek', 'park', 'asph', 'bldg', 'bldgEdge', 'stall', 'label', 'halo', 'pay', 'signBg', 'signText', 'shopc', 'otherc']
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
        var ty = car.d && car.d.type, pc = ty === 'shop' || ty === 'dine' ? T.shopc : ty === 'other' ? T.otherc : T.parked;
        drawCar(c, x, y, hx / hn, hy / hn, pc, car.st === 'pout' ? 0.85 : 1, false);
      }
    }
    // sign for the lots, where Capitola Ave leaves the map
    var compact = MW < 520;
    var sx = X(-282) + (compact ? -2 : 0), sy = Y(88), fs = compact ? 10 : Math.round(Math.max(10, Math.min(12.5, 3.3 * K)));
    var w = sim.windowStats(60);
    var lotPct = Math.round(Math.min(1, sim.lot.out.length / P.lotCap) * 100), lotFull = lotPct >= 99;
    var lines = compact
      ? [['600', '↑ Lots · $1.00/hr', T.signText], ['600', lotFull ? 'FULL' : lotPct + '% full', lotFull ? T.accent : T.signText], ['600', Math.round(w.toLot) + '/hr sent', T.lotc]]
      : [['600', '↑ Beach & Village lots', T.signText], ['400', '$1.00/hr · ¼ mile walk', T.signText],
         ['600', lotFull ? 'FULL: drivers park farther out' : lotPct + '% full', lotFull ? T.accent : T.signText],
         ['600', Math.round(w.toLot) + ' drivers/hr turned away from the loop', T.lotc]];
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
    var full = sim.lot.out.length >= 0.99 * P.lotCap, share = tryShare(p, full), txt;
    var rest = full ? 'The $1.00 lots are full, so the rest park farther out and walk about 15 minutes.' : 'The rest head for the $1.00 lots, or park farther out if they don\'t know the lots are there.';
    if (ui.mode === 'match') txt = 'Matched to the crowd: ' + money(p) + ' all day is the lowest rate the model finds keeps the loop moving with ' + fmtV(ui.visitors) + ' visitors. ' + Math.round(share * 100) + '% of arriving drivers try the loop first. ' + rest;
    else txt = 'At ' + money(p) + ', ' + Math.round(share * 100) + '% of arriving drivers try the loop first. ' + rest;
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
    $('tShop').innerHTML = Math.round(w.shopDine) + '<small>/hr</small>';
    var held = 0; for (var si = 0; si < sim.spaces.length; si++) { var sc = sim.spaces[si].car; if (sc && sc.d && sc.d.type === 'beach') held++; }
    $('tBeach').innerHTML = Math.round(held / NSP * 100) + '<small>%</small>';
    var m = START_MIN + sim.t / 60;
    $('clock').innerHTML = (ui.day && DAYS[ui.day] ? DAYS[ui.day].label : 'A day with ' + fmtV(ui.visitors) + ' visitors,') + ' <b>' + clockStr(m) + '</b>';
    if (ui.mode === 'match') { $('price').value = p; $('priceOut').textContent = money(p) + '/hr'; }
    drawTrend();
    markSweep();
  }

  /* ---------- the rate sweep: whole days at each rate, 1 to 3 PM ---------- */
  var sweep = null, sweepJob = 0, PMAX = 12;
  // computed ahead with the same engine (bake.js): two runs per rate, so the charts open complete
  var SWEEPS = {"1500":[{"p":1,"occ":0.51,"trip":3,"circ":0,"standstill":0.003,"left":0,"rev":51,"search":1.2,"cruiseMi":0,"lotOcc":0.082,"lotFull":0,"far":1.3,"toLot":3,"shopDine":8.5,"beachIn":8,"beachHeld":0.352,"shopHeld":0.096},{"p":1.5,"occ":0.452,"trip":2.9,"circ":0,"standstill":0.003,"left":0,"rev":70,"search":1.2,"cruiseMi":0,"lotOcc":0.099,"lotFull":0,"far":1,"toLot":3.3,"shopDine":7.8,"beachIn":7.8,"beachHeld":0.315,"shopHeld":0.085},{"p":2,"occ":0.401,"trip":3.2,"circ":0,"standstill":0.004,"left":0,"rev":76.7,"search":1.1,"cruiseMi":0,"lotOcc":0.096,"lotFull":0,"far":1,"toLot":4.3,"shopDine":6.5,"beachIn":7.3,"beachHeld":0.304,"shopHeld":0.053},{"p":2.5,"occ":0.361,"trip":3,"circ":0,"standstill":0.002,"left":0,"rev":94.6,"search":1.1,"cruiseMi":0,"lotOcc":0.09,"lotFull":0,"far":1.3,"toLot":5,"shopDine":5,"beachIn":6.8,"beachHeld":0.239,"shopHeld":0.05},{"p":3,"occ":0.402,"trip":3,"circ":0,"standstill":0.003,"left":0,"rev":128.7,"search":1.2,"cruiseMi":0,"lotOcc":0.093,"lotFull":0,"far":3.5,"toLot":6.8,"shopDine":8.5,"beachIn":5.8,"beachHeld":0.259,"shopHeld":0.082},{"p":3.5,"occ":0.347,"trip":3.1,"circ":0,"standstill":0.003,"left":0,"rev":133.2,"search":1.1,"cruiseMi":0,"lotOcc":0.111,"lotFull":0,"far":1.5,"toLot":6.8,"shopDine":6,"beachIn":8,"beachHeld":0.237,"shopHeld":0.064},{"p":4,"occ":0.248,"trip":3.4,"circ":0,"standstill":0.004,"left":0,"rev":108.1,"search":1.1,"cruiseMi":0,"lotOcc":0.116,"lotFull":0,"far":2.5,"toLot":10.5,"shopDine":4.8,"beachIn":6.5,"beachHeld":0.162,"shopHeld":0.056},{"p":4.5,"occ":0.266,"trip":3.4,"circ":0,"standstill":0.003,"left":0,"rev":124.8,"search":1.1,"cruiseMi":0,"lotOcc":0.125,"lotFull":0,"far":3,"toLot":11.3,"shopDine":5.5,"beachIn":6.8,"beachHeld":0.182,"shopHeld":0.056},{"p":5,"occ":0.248,"trip":3.2,"circ":0,"standstill":0.004,"left":0,"rev":128,"search":1,"cruiseMi":0,"lotOcc":0.126,"lotFull":0,"far":4,"toLot":11.5,"shopDine":4.3,"beachIn":5.8,"beachHeld":0.18,"shopHeld":0.047},{"p":5.5,"occ":0.189,"trip":3.2,"circ":0,"standstill":0.003,"left":0,"rev":111.5,"search":1.1,"cruiseMi":0,"lotOcc":0.129,"lotFull":0,"far":3.5,"toLot":12.5,"shopDine":4,"beachIn":5.5,"beachHeld":0.132,"shopHeld":0.029},{"p":6,"occ":0.246,"trip":3.3,"circ":0,"standstill":0.004,"left":0,"rev":150.4,"search":1,"cruiseMi":0,"lotOcc":0.131,"lotFull":0,"far":5,"toLot":13.8,"shopDine":5.3,"beachIn":6.5,"beachHeld":0.173,"shopHeld":0.044},{"p":6.5,"occ":0.175,"trip":3.3,"circ":0,"standstill":0.003,"left":0,"rev":109,"search":1,"cruiseMi":0,"lotOcc":0.138,"lotFull":0,"far":5,"toLot":15,"shopDine":4,"beachIn":4.8,"beachHeld":0.131,"shopHeld":0.026},{"p":7,"occ":0.15,"trip":3.5,"circ":0,"standstill":0.004,"left":0,"rev":95.1,"search":1,"cruiseMi":0,"lotOcc":0.14,"lotFull":0,"far":6.8,"toLot":14.8,"shopDine":2.8,"beachIn":3.5,"beachHeld":0.122,"shopHeld":0.021},{"p":7.5,"occ":0.139,"trip":3.4,"circ":0,"standstill":0.004,"left":0,"rev":102.6,"search":0.9,"cruiseMi":0,"lotOcc":0.154,"lotFull":0,"far":6.5,"toLot":17.3,"shopDine":4,"beachIn":1.8,"beachHeld":0.098,"shopHeld":0.028},{"p":8,"occ":0.149,"trip":3.4,"circ":0,"standstill":0.004,"left":0,"rev":117.2,"search":1,"cruiseMi":0,"lotOcc":0.141,"lotFull":0,"far":6.5,"toLot":15.3,"shopDine":3.5,"beachIn":5,"beachHeld":0.108,"shopHeld":0.023},{"p":8.5,"occ":0.131,"trip":3.3,"circ":0,"standstill":0.003,"left":0,"rev":107.2,"search":0.9,"cruiseMi":0,"lotOcc":0.139,"lotFull":0,"far":5,"toLot":16,"shopDine":2.8,"beachIn":2.3,"beachHeld":0.073,"shopHeld":0.023},{"p":9,"occ":0.163,"trip":3.2,"circ":0,"standstill":0.004,"left":0,"rev":157.2,"search":1,"cruiseMi":0,"lotOcc":0.16,"lotFull":0,"far":5.5,"toLot":17,"shopDine":3.8,"beachIn":2.8,"beachHeld":0.113,"shopHeld":0.028},{"p":9.5,"occ":0.111,"trip":3.3,"circ":0,"standstill":0.004,"left":0,"rev":107.5,"search":0.9,"cruiseMi":0,"lotOcc":0.153,"lotFull":0,"far":6.5,"toLot":18.3,"shopDine":2.8,"beachIn":3,"beachHeld":0.082,"shopHeld":0.022},{"p":10,"occ":0.08,"trip":3.3,"circ":0,"standstill":0.003,"left":0,"rev":71.9,"search":0.8,"cruiseMi":0,"lotOcc":0.147,"lotFull":0,"far":5,"toLot":15.3,"shopDine":1,"beachIn":1.5,"beachHeld":0.059,"shopHeld":0.011},{"p":10.5,"occ":0.091,"trip":3.2,"circ":0,"standstill":0.004,"left":0,"rev":90,"search":0.9,"cruiseMi":0,"lotOcc":0.153,"lotFull":0,"far":5.5,"toLot":16.5,"shopDine":1.5,"beachIn":1.3,"beachHeld":0.068,"shopHeld":0.01},{"p":11,"occ":0.068,"trip":3.4,"circ":0,"standstill":0.004,"left":0,"rev":62.5,"search":1.1,"cruiseMi":0,"lotOcc":0.157,"lotFull":0,"far":5,"toLot":16.5,"shopDine":1.5,"beachIn":0.3,"beachHeld":0.042,"shopHeld":0.012},{"p":11.5,"occ":0.056,"trip":3.5,"circ":0,"standstill":0.004,"left":0,"rev":65.7,"search":0.8,"cruiseMi":0,"lotOcc":0.145,"lotFull":0,"far":6,"toLot":17.5,"shopDine":1.8,"beachIn":0.8,"beachHeld":0.034,"shopHeld":0.015},{"p":12,"occ":0.063,"trip":3.5,"circ":0,"standstill":0.004,"left":0,"rev":77,"search":0.9,"cruiseMi":0,"lotOcc":0.152,"lotFull":0,"far":9.5,"toLot":23.3,"shopDine":1.3,"beachIn":2.3,"beachHeld":0.048,"shopHeld":0.006}],"4500":[{"p":1,"occ":0.996,"trip":3.5,"circ":5.9,"standstill":0.022,"left":3,"rev":97.1,"search":6.6,"cruiseMi":27.6,"lotOcc":0.288,"lotFull":0,"far":2.8,"toLot":29.8,"shopDine":14,"beachIn":20.8,"beachHeld":0.742,"shopHeld":0.146},{"p":1.5,"occ":0.995,"trip":3.1,"circ":3.3,"standstill":0.014,"left":3,"rev":143,"search":5.2,"cruiseMi":18.1,"lotOcc":0.28,"lotFull":0,"far":5.5,"toLot":21.5,"shopDine":15.3,"beachIn":18.3,"beachHeld":0.725,"shopHeld":0.155},{"p":2,"occ":0.998,"trip":3.7,"circ":6,"standstill":0.028,"left":4.8,"rev":184.4,"search":7,"cruiseMi":28,"lotOcc":0.316,"lotFull":0,"far":4.5,"toLot":32,"shopDine":12.8,"beachIn":19.3,"beachHeld":0.753,"shopHeld":0.138},{"p":2.5,"occ":0.985,"trip":3.2,"circ":2.8,"standstill":0.013,"left":1.3,"rev":249.1,"search":4.2,"cruiseMi":14.3,"lotOcc":0.314,"lotFull":0,"far":6.3,"toLot":26.5,"shopDine":16.3,"beachIn":14.8,"beachHeld":0.729,"shopHeld":0.162},{"p":3,"occ":0.979,"trip":3.2,"circ":1.5,"standstill":0.011,"left":0.8,"rev":298.2,"search":3.4,"cruiseMi":9,"lotOcc":0.295,"lotFull":0,"far":2.5,"toLot":20,"shopDine":15.8,"beachIn":16.8,"beachHeld":0.688,"shopHeld":0.161},{"p":3.5,"occ":0.874,"trip":3.3,"circ":0.1,"standstill":0.01,"left":0,"rev":314.5,"search":1.8,"cruiseMi":0.6,"lotOcc":0.325,"lotFull":0,"far":8.8,"toLot":21.5,"shopDine":16.8,"beachIn":16,"beachHeld":0.633,"shopHeld":0.168},{"p":4,"occ":0.926,"trip":3.4,"circ":0.2,"standstill":0.013,"left":0.3,"rev":383.5,"search":2.1,"cruiseMi":1.9,"lotOcc":0.292,"lotFull":0,"far":10.3,"toLot":27.5,"shopDine":15.5,"beachIn":19.5,"beachHeld":0.679,"shopHeld":0.163},{"p":4.5,"occ":0.753,"trip":3.4,"circ":0,"standstill":0.01,"left":0,"rev":365.1,"search":1.5,"cruiseMi":0,"lotOcc":0.35,"lotFull":0,"far":12,"toLot":29.3,"shopDine":17.3,"beachIn":16.3,"beachHeld":0.502,"shopHeld":0.161},{"p":5,"occ":0.668,"trip":3.5,"circ":0,"standstill":0.012,"left":0,"rev":340.9,"search":1.4,"cruiseMi":0,"lotOcc":0.387,"lotFull":0,"far":11.8,"toLot":36.5,"shopDine":13.8,"beachIn":14.5,"beachHeld":0.443,"shopHeld":0.143},{"p":5.5,"occ":0.656,"trip":3.4,"circ":0,"standstill":0.011,"left":0,"rev":362.4,"search":1.4,"cruiseMi":0,"lotOcc":0.365,"lotFull":0,"far":9.5,"toLot":33.8,"shopDine":12,"beachIn":14,"beachHeld":0.493,"shopHeld":0.103},{"p":6,"occ":0.622,"trip":3.4,"circ":0,"standstill":0.011,"left":0,"rev":394.4,"search":1.4,"cruiseMi":0,"lotOcc":0.391,"lotFull":0,"far":11,"toLot":30.8,"shopDine":14.5,"beachIn":10.8,"beachHeld":0.427,"shopHeld":0.132},{"p":6.5,"occ":0.554,"trip":3.4,"circ":0,"standstill":0.01,"left":0,"rev":393.5,"search":1.4,"cruiseMi":0,"lotOcc":0.389,"lotFull":0,"far":11.8,"toLot":35.3,"shopDine":14.5,"beachIn":11.8,"beachHeld":0.374,"shopHeld":0.136},{"p":7,"occ":0.495,"trip":3.4,"circ":0,"standstill":0.011,"left":0,"rev":342.3,"search":1.3,"cruiseMi":0,"lotOcc":0.413,"lotFull":0,"far":15,"toLot":41.8,"shopDine":10.5,"beachIn":10,"beachHeld":0.364,"shopHeld":0.081},{"p":7.5,"occ":0.408,"trip":3.4,"circ":0,"standstill":0.01,"left":0,"rev":313.6,"search":1.1,"cruiseMi":0,"lotOcc":0.373,"lotFull":0,"far":15,"toLot":42.5,"shopDine":8.3,"beachIn":7.5,"beachHeld":0.298,"shopHeld":0.071},{"p":8,"occ":0.382,"trip":3.5,"circ":0,"standstill":0.011,"left":0,"rev":328.5,"search":1.2,"cruiseMi":0,"lotOcc":0.425,"lotFull":0,"far":15,"toLot":44,"shopDine":11,"beachIn":8.3,"beachHeld":0.253,"shopHeld":0.088},{"p":8.5,"occ":0.367,"trip":3.5,"circ":0,"standstill":0.012,"left":0,"rev":338,"search":1.2,"cruiseMi":0,"lotOcc":0.392,"lotFull":0,"far":17.8,"toLot":46.8,"shopDine":7.5,"beachIn":7,"beachHeld":0.261,"shopHeld":0.064},{"p":9,"occ":0.326,"trip":3.5,"circ":0,"standstill":0.011,"left":0,"rev":292.5,"search":1.1,"cruiseMi":0,"lotOcc":0.411,"lotFull":0,"far":19.3,"toLot":48.8,"shopDine":6.8,"beachIn":7.3,"beachHeld":0.241,"shopHeld":0.06},{"p":9.5,"occ":0.314,"trip":3.4,"circ":0,"standstill":0.011,"left":0,"rev":314.9,"search":1.1,"cruiseMi":0,"lotOcc":0.424,"lotFull":0,"far":17.3,"toLot":50.5,"shopDine":6.5,"beachIn":5.3,"beachHeld":0.214,"shopHeld":0.074},{"p":10,"occ":0.279,"trip":3.5,"circ":0,"standstill":0.011,"left":0,"rev":308.9,"search":1.1,"cruiseMi":0,"lotOcc":0.421,"lotFull":0,"far":20,"toLot":49.5,"shopDine":8,"beachIn":6.5,"beachHeld":0.183,"shopHeld":0.071},{"p":10.5,"occ":0.241,"trip":3.6,"circ":0,"standstill":0.013,"left":0,"rev":286,"search":1.1,"cruiseMi":0,"lotOcc":0.421,"lotFull":0,"far":22,"toLot":51.8,"shopDine":9,"beachIn":5.8,"beachHeld":0.152,"shopHeld":0.067},{"p":11,"occ":0.207,"trip":3.5,"circ":0,"standstill":0.011,"left":0,"rev":238.6,"search":1,"cruiseMi":0,"lotOcc":0.474,"lotFull":0,"far":24.8,"toLot":58.8,"shopDine":7.3,"beachIn":5,"beachHeld":0.14,"shopHeld":0.048},{"p":11.5,"occ":0.201,"trip":3.5,"circ":0,"standstill":0.012,"left":0,"rev":262.3,"search":1.1,"cruiseMi":0,"lotOcc":0.454,"lotFull":0,"far":18.8,"toLot":52,"shopDine":4.5,"beachIn":4,"beachHeld":0.135,"shopHeld":0.042},{"p":12,"occ":0.228,"trip":3.6,"circ":0,"standstill":0.012,"left":0,"rev":280.5,"search":1,"cruiseMi":0,"lotOcc":0.396,"lotFull":0,"far":16,"toLot":44.5,"shopDine":6.8,"beachIn":3.3,"beachHeld":0.147,"shopHeld":0.055}],"6000":[{"p":1,"occ":0.999,"trip":7.2,"circ":14,"standstill":0.171,"left":9.8,"rev":89.8,"search":12.8,"cruiseMi":40.3,"lotOcc":0.492,"lotFull":0,"far":3,"toLot":48.4,"shopDine":13,"beachIn":19.1,"beachHeld":0.785,"shopHeld":0.121},{"p":1.5,"occ":0.999,"trip":6.9,"circ":12.3,"standstill":0.16,"left":8.8,"rev":137.6,"search":12.1,"cruiseMi":38,"lotOcc":0.473,"lotFull":0,"far":5.9,"toLot":51.4,"shopDine":15.1,"beachIn":21,"beachHeld":0.761,"shopHeld":0.15},{"p":2,"occ":0.998,"trip":4.9,"circ":8.3,"standstill":0.073,"left":5.6,"rev":188.8,"search":8.4,"cruiseMi":31.6,"lotOcc":0.495,"lotFull":0,"far":7.6,"toLot":45.8,"shopDine":14.8,"beachIn":19.1,"beachHeld":0.74,"shopHeld":0.136},{"p":2.5,"occ":0.998,"trip":4.7,"circ":6.6,"standstill":0.059,"left":5.5,"rev":251.8,"search":7.9,"cruiseMi":28.9,"lotOcc":0.462,"lotFull":0,"far":7.4,"toLot":46,"shopDine":19.3,"beachIn":19,"beachHeld":0.73,"shopHeld":0.18},{"p":3,"occ":0.996,"trip":4.3,"circ":4.1,"standstill":0.042,"left":2.9,"rev":299.4,"search":5.6,"cruiseMi":19.9,"lotOcc":0.463,"lotFull":0,"far":8.9,"toLot":40.6,"shopDine":14.1,"beachIn":22.9,"beachHeld":0.729,"shopHeld":0.13},{"p":3.5,"occ":0.996,"trip":3.9,"circ":3.7,"standstill":0.033,"left":2.6,"rev":358.3,"search":5.8,"cruiseMi":19.6,"lotOcc":0.484,"lotFull":0,"far":12.3,"toLot":45.1,"shopDine":17.1,"beachIn":23.4,"beachHeld":0.729,"shopHeld":0.172},{"p":4,"occ":0.988,"trip":3.5,"circ":2.2,"standstill":0.019,"left":2.5,"rev":400,"search":4.5,"cruiseMi":13.5,"lotOcc":0.471,"lotFull":0,"far":11.9,"toLot":43.3,"shopDine":16.9,"beachIn":20.6,"beachHeld":0.73,"shopHeld":0.169},{"p":4.5,"occ":0.957,"trip":3.5,"circ":0.9,"standstill":0.017,"left":0.9,"rev":454.8,"search":3,"cruiseMi":6.8,"lotOcc":0.476,"lotFull":0,"far":11.3,"toLot":41.8,"shopDine":16.8,"beachIn":21.5,"beachHeld":0.692,"shopHeld":0.174},{"p":5,"occ":0.935,"trip":3.5,"circ":0.3,"standstill":0.016,"left":0.3,"rev":487.5,"search":2.2,"cruiseMi":2.1,"lotOcc":0.488,"lotFull":0,"far":14.9,"toLot":41.3,"shopDine":17,"beachIn":19,"beachHeld":0.692,"shopHeld":0.155},{"p":5.5,"occ":0.86,"trip":3.6,"circ":0,"standstill":0.015,"left":0,"rev":509.6,"search":1.6,"cruiseMi":0,"lotOcc":0.49,"lotFull":0,"far":14.6,"toLot":44.1,"shopDine":17.8,"beachIn":19.3,"beachHeld":0.596,"shopHeld":0.178},{"p":6,"occ":0.754,"trip":3.6,"circ":0,"standstill":0.015,"left":0,"rev":467.9,"search":1.5,"cruiseMi":0,"lotOcc":0.495,"lotFull":0,"far":17.1,"toLot":48.8,"shopDine":16.4,"beachIn":14.8,"beachHeld":0.512,"shopHeld":0.159},{"p":6.5,"occ":0.679,"trip":3.7,"circ":0,"standstill":0.017,"left":0,"rev":467,"search":1.5,"cruiseMi":0,"lotOcc":0.53,"lotFull":0,"far":18.9,"toLot":54.4,"shopDine":14.9,"beachIn":12.4,"beachHeld":0.491,"shopHeld":0.123},{"p":7,"occ":0.604,"trip":3.6,"circ":0,"standstill":0.016,"left":0,"rev":430.9,"search":1.4,"cruiseMi":0,"lotOcc":0.524,"lotFull":0,"far":16.9,"toLot":51.1,"shopDine":15.5,"beachIn":11.1,"beachHeld":0.399,"shopHeld":0.129},{"p":7.5,"occ":0.628,"trip":3.6,"circ":0,"standstill":0.016,"left":0,"rev":478.5,"search":1.4,"cruiseMi":0,"lotOcc":0.566,"lotFull":0,"far":19.9,"toLot":54.3,"shopDine":13.6,"beachIn":11.6,"beachHeld":0.46,"shopHeld":0.118},{"p":8,"occ":0.548,"trip":3.6,"circ":0,"standstill":0.017,"left":0,"rev":461.3,"search":1.3,"cruiseMi":0,"lotOcc":0.566,"lotFull":0,"far":20,"toLot":58.9,"shopDine":13.9,"beachIn":9.6,"beachHeld":0.385,"shopHeld":0.116},{"p":8.5,"occ":0.451,"trip":3.6,"circ":0,"standstill":0.016,"left":0,"rev":410.7,"search":1.3,"cruiseMi":0,"lotOcc":0.558,"lotFull":0,"far":24.8,"toLot":66.9,"shopDine":12,"beachIn":8.3,"beachHeld":0.292,"shopHeld":0.106},{"p":9,"occ":0.44,"trip":3.6,"circ":0,"standstill":0.015,"left":0,"rev":423.6,"search":1.3,"cruiseMi":0,"lotOcc":0.564,"lotFull":0,"far":23.6,"toLot":64.9,"shopDine":10.8,"beachIn":10.8,"beachHeld":0.306,"shopHeld":0.089},{"p":9.5,"occ":0.45,"trip":3.6,"circ":0,"standstill":0.016,"left":0,"rev":453.2,"search":1.2,"cruiseMi":0,"lotOcc":0.567,"lotFull":0,"far":24.5,"toLot":66.3,"shopDine":10.1,"beachIn":6.5,"beachHeld":0.298,"shopHeld":0.105},{"p":10,"occ":0.386,"trip":3.6,"circ":0,"standstill":0.015,"left":0,"rev":392.1,"search":1.2,"cruiseMi":0,"lotOcc":0.56,"lotFull":0,"far":24.8,"toLot":64.6,"shopDine":8.8,"beachIn":7.4,"beachHeld":0.272,"shopHeld":0.072},{"p":10.5,"occ":0.364,"trip":3.6,"circ":0,"standstill":0.015,"left":0,"rev":380.1,"search":1.2,"cruiseMi":0,"lotOcc":0.559,"lotFull":0,"far":25,"toLot":62.6,"shopDine":8.5,"beachIn":7,"beachHeld":0.261,"shopHeld":0.067},{"p":11,"occ":0.314,"trip":3.6,"circ":0,"standstill":0.016,"left":0,"rev":351.5,"search":1.1,"cruiseMi":0,"lotOcc":0.561,"lotFull":0,"far":28.3,"toLot":69.4,"shopDine":9.8,"beachIn":7.3,"beachHeld":0.214,"shopHeld":0.069},{"p":11.5,"occ":0.302,"trip":3.6,"circ":0,"standstill":0.016,"left":0,"rev":361.5,"search":1.1,"cruiseMi":0,"lotOcc":0.561,"lotFull":0,"far":29.8,"toLot":72.8,"shopDine":8.5,"beachIn":6.8,"beachHeld":0.202,"shopHeld":0.062},{"p":12,"occ":0.225,"trip":3.6,"circ":0,"standstill":0.016,"left":0,"rev":297.8,"search":1,"cruiseMi":0,"lotOcc":0.612,"lotFull":0,"far":26.5,"toLot":70,"shopDine":8.8,"beachIn":3.5,"beachHeld":0.135,"shopHeld":0.062}],"7500":[{"p":1,"occ":0.999,"trip":10.9,"circ":16.7,"standstill":0.336,"left":14,"rev":81.3,"search":25.2,"cruiseMi":42.6,"lotOcc":0.664,"lotFull":0,"far":6.1,"toLot":69,"shopDine":12.9,"beachIn":20.6,"beachHeld":0.791,"shopHeld":0.12},{"p":1.5,"occ":0.999,"trip":10.8,"circ":14.5,"standstill":0.327,"left":11.9,"rev":132.4,"search":20.5,"cruiseMi":37.9,"lotOcc":0.657,"lotFull":0,"far":8.4,"toLot":66.5,"shopDine":13.6,"beachIn":20.1,"beachHeld":0.769,"shopHeld":0.132},{"p":2,"occ":0.999,"trip":10.1,"circ":13,"standstill":0.293,"left":10.5,"rev":174.5,"search":19.9,"cruiseMi":35.5,"lotOcc":0.637,"lotFull":0,"far":8.4,"toLot":66.3,"shopDine":15.1,"beachIn":20.8,"beachHeld":0.761,"shopHeld":0.141},{"p":2.5,"occ":0.999,"trip":9.9,"circ":12.2,"standstill":0.28,"left":11.4,"rev":218.9,"search":15.8,"cruiseMi":33.7,"lotOcc":0.67,"lotFull":0,"far":11.6,"toLot":72.4,"shopDine":14.1,"beachIn":20,"beachHeld":0.786,"shopHeld":0.127},{"p":3,"occ":0.998,"trip":8.5,"circ":9,"standstill":0.209,"left":7.1,"rev":279.6,"search":11.8,"cruiseMi":29.5,"lotOcc":0.665,"lotFull":0,"far":8.6,"toLot":70,"shopDine":18.5,"beachIn":19,"beachHeld":0.742,"shopHeld":0.158},{"p":3.5,"occ":0.998,"trip":6.1,"circ":6.1,"standstill":0.106,"left":4.6,"rev":343.1,"search":8.1,"cruiseMi":25.4,"lotOcc":0.608,"lotFull":0,"far":13.4,"toLot":59.8,"shopDine":16.5,"beachIn":19.1,"beachHeld":0.744,"shopHeld":0.15},{"p":4,"occ":0.998,"trip":6.6,"circ":5.7,"standstill":0.124,"left":5,"rev":388,"search":8.1,"cruiseMi":22.7,"lotOcc":0.644,"lotFull":0,"far":13.8,"toLot":62.8,"shopDine":19.5,"beachIn":17.8,"beachHeld":0.735,"shopHeld":0.161},{"p":4.5,"occ":0.993,"trip":5.1,"circ":3,"standstill":0.059,"left":3.5,"rev":456.1,"search":4.9,"cruiseMi":16.1,"lotOcc":0.632,"lotFull":0,"far":16.6,"toLot":63.3,"shopDine":18,"beachIn":19.9,"beachHeld":0.75,"shopHeld":0.154},{"p":5,"occ":0.991,"trip":4.5,"circ":3.1,"standstill":0.052,"left":3.5,"rev":523.2,"search":5.2,"cruiseMi":14.1,"lotOcc":0.585,"lotFull":0,"far":16.8,"toLot":55.9,"shopDine":20,"beachIn":18.5,"beachHeld":0.702,"shopHeld":0.191},{"p":5.5,"occ":0.981,"trip":4.1,"circ":2,"standstill":0.037,"left":1.8,"rev":564.7,"search":3.9,"cruiseMi":11,"lotOcc":0.644,"lotFull":0,"far":17.1,"toLot":61.4,"shopDine":19.8,"beachIn":19.3,"beachHeld":0.699,"shopHeld":0.178},{"p":6,"occ":0.903,"trip":3.8,"circ":0.3,"standstill":0.024,"left":0.1,"rev":592.4,"search":2.2,"cruiseMi":2.5,"lotOcc":0.638,"lotFull":0,"far":20.5,"toLot":61.8,"shopDine":19.6,"beachIn":17.4,"beachHeld":0.598,"shopHeld":0.193},{"p":6.5,"occ":0.904,"trip":3.8,"circ":0.3,"standstill":0.024,"left":0.6,"rev":624.2,"search":2.1,"cruiseMi":1.5,"lotOcc":0.634,"lotFull":0,"far":22.5,"toLot":66.1,"shopDine":20,"beachIn":17.3,"beachHeld":0.614,"shopHeld":0.192},{"p":7,"occ":0.854,"trip":3.7,"circ":0.1,"standstill":0.021,"left":0.3,"rev":641.1,"search":2,"cruiseMi":1.4,"lotOcc":0.636,"lotFull":0,"far":21.4,"toLot":63.3,"shopDine":19.1,"beachIn":16.8,"beachHeld":0.59,"shopHeld":0.184},{"p":7.5,"occ":0.752,"trip":3.8,"circ":0,"standstill":0.023,"left":0,"rev":605,"search":1.7,"cruiseMi":0,"lotOcc":0.684,"lotFull":0,"far":24.9,"toLot":74.4,"shopDine":19.5,"beachIn":16.3,"beachHeld":0.516,"shopHeld":0.17},{"p":8,"occ":0.663,"trip":3.8,"circ":0,"standstill":0.021,"left":0,"rev":572.8,"search":1.5,"cruiseMi":0,"lotOcc":0.673,"lotFull":0,"far":21.6,"toLot":66.3,"shopDine":17,"beachIn":14.4,"beachHeld":0.453,"shopHeld":0.151},{"p":8.5,"occ":0.561,"trip":3.7,"circ":0,"standstill":0.022,"left":0,"rev":513.8,"search":1.4,"cruiseMi":0,"lotOcc":0.716,"lotFull":0,"far":25.9,"toLot":74.9,"shopDine":14.3,"beachIn":11,"beachHeld":0.39,"shopHeld":0.125},{"p":9,"occ":0.52,"trip":3.8,"circ":0,"standstill":0.023,"left":0,"rev":503,"search":1.4,"cruiseMi":0,"lotOcc":0.69,"lotFull":0,"far":29.5,"toLot":79.5,"shopDine":11.5,"beachIn":10.9,"beachHeld":0.355,"shopHeld":0.112},{"p":9.5,"occ":0.474,"trip":3.8,"circ":0,"standstill":0.023,"left":0,"rev":474.3,"search":1.3,"cruiseMi":0,"lotOcc":0.694,"lotFull":0,"far":26.4,"toLot":80.9,"shopDine":11.8,"beachIn":9.5,"beachHeld":0.34,"shopHeld":0.095},{"p":10,"occ":0.434,"trip":3.8,"circ":0,"standstill":0.022,"left":0,"rev":470.4,"search":1.3,"cruiseMi":0,"lotOcc":0.713,"lotFull":0,"far":30.4,"toLot":83,"shopDine":13.1,"beachIn":9,"beachHeld":0.289,"shopHeld":0.105},{"p":10.5,"occ":0.406,"trip":3.8,"circ":0,"standstill":0.022,"left":0,"rev":444.7,"search":1.3,"cruiseMi":0,"lotOcc":0.741,"lotFull":0,"far":29.5,"toLot":78.6,"shopDine":11,"beachIn":8.4,"beachHeld":0.28,"shopHeld":0.085},{"p":11,"occ":0.389,"trip":3.9,"circ":0,"standstill":0.025,"left":0,"rev":459.7,"search":1.3,"cruiseMi":0,"lotOcc":0.727,"lotFull":0,"far":33.1,"toLot":92.8,"shopDine":10.4,"beachIn":9.5,"beachHeld":0.261,"shopHeld":0.086},{"p":11.5,"occ":0.359,"trip":3.8,"circ":0,"standstill":0.023,"left":0,"rev":429.3,"search":1.2,"cruiseMi":0,"lotOcc":0.723,"lotFull":0,"far":31.8,"toLot":85.5,"shopDine":9.1,"beachIn":7,"beachHeld":0.245,"shopHeld":0.08},{"p":12,"occ":0.32,"trip":3.7,"circ":0,"standstill":0.02,"left":0,"rev":415.7,"search":1.2,"cruiseMi":0,"lotOcc":0.721,"lotFull":0,"far":29.8,"toLot":86.8,"shopDine":11.6,"beachIn":5.5,"beachHeld":0.197,"shopHeld":0.079}],"9000":[{"p":1,"occ":0.999,"trip":12.5,"circ":16.5,"standstill":0.386,"left":18.3,"rev":85.3,"search":32.7,"cruiseMi":41.7,"lotOcc":0.785,"lotFull":0,"far":10.4,"toLot":89.1,"shopDine":15.9,"beachIn":22.1,"beachHeld":0.76,"shopHeld":0.136},{"p":1.5,"occ":0.999,"trip":12.3,"circ":15.4,"standstill":0.375,"left":16.6,"rev":132.3,"search":29,"cruiseMi":42.2,"lotOcc":0.778,"lotFull":0,"far":10.6,"toLot":97,"shopDine":14,"beachIn":20,"beachHeld":0.759,"shopHeld":0.129},{"p":2,"occ":0.999,"trip":12,"circ":15.2,"standstill":0.364,"left":17.4,"rev":167.5,"search":28.1,"cruiseMi":41.2,"lotOcc":0.796,"lotFull":0,"far":9.8,"toLot":94.4,"shopDine":12,"beachIn":19.6,"beachHeld":0.785,"shopHeld":0.108},{"p":2.5,"occ":0.999,"trip":12.1,"circ":11.3,"standstill":0.363,"left":13.9,"rev":218.3,"search":24.2,"cruiseMi":35.4,"lotOcc":0.807,"lotFull":0,"far":11.6,"toLot":95.6,"shopDine":15,"beachIn":21.1,"beachHeld":0.778,"shopHeld":0.131},{"p":3,"occ":0.998,"trip":11.1,"circ":9.7,"standstill":0.323,"left":13.1,"rev":268.3,"search":20,"cruiseMi":32,"lotOcc":0.829,"lotFull":0,"far":15.9,"toLot":92.3,"shopDine":15.4,"beachIn":21.5,"beachHeld":0.775,"shopHeld":0.13},{"p":3.5,"occ":0.998,"trip":11.3,"circ":8.7,"standstill":0.321,"left":9.9,"rev":323.5,"search":19.3,"cruiseMi":27,"lotOcc":0.776,"lotFull":0,"far":16.3,"toLot":86.1,"shopDine":15.3,"beachIn":20.9,"beachHeld":0.789,"shopHeld":0.125},{"p":4,"occ":0.998,"trip":10.2,"circ":7,"standstill":0.277,"left":6.4,"rev":378.3,"search":14.6,"cruiseMi":22.8,"lotOcc":0.829,"lotFull":0,"far":18.4,"toLot":90.1,"shopDine":15.9,"beachIn":20.3,"beachHeld":0.754,"shopHeld":0.141},{"p":4.5,"occ":0.998,"trip":9.2,"circ":6,"standstill":0.234,"left":6.8,"rev":411.3,"search":11.6,"cruiseMi":22,"lotOcc":0.784,"lotFull":0,"far":20.4,"toLot":82.1,"shopDine":17.1,"beachIn":21.1,"beachHeld":0.771,"shopHeld":0.145},{"p":5,"occ":0.997,"trip":8.6,"circ":4.2,"standstill":0.205,"left":6,"rev":507,"search":9.8,"cruiseMi":19,"lotOcc":0.806,"lotFull":0,"far":22.9,"toLot":89.5,"shopDine":19,"beachIn":21.5,"beachHeld":0.728,"shopHeld":0.17},{"p":5.5,"occ":0.995,"trip":7.7,"circ":4,"standstill":0.162,"left":4.6,"rev":539.8,"search":8.6,"cruiseMi":17.2,"lotOcc":0.763,"lotFull":0,"far":21.9,"toLot":81.3,"shopDine":17.5,"beachIn":19.9,"beachHeld":0.752,"shopHeld":0.149},{"p":6,"occ":0.995,"trip":7.4,"circ":3.6,"standstill":0.157,"left":4.1,"rev":610.2,"search":8.6,"cruiseMi":16.4,"lotOcc":0.795,"lotFull":0,"far":25.6,"toLot":90.4,"shopDine":16.4,"beachIn":20.9,"beachHeld":0.74,"shopHeld":0.151},{"p":6.5,"occ":0.957,"trip":4.6,"circ":0.3,"standstill":0.046,"left":0.4,"rev":657.6,"search":2.6,"cruiseMi":2.9,"lotOcc":0.806,"lotFull":0,"far":26,"toLot":79,"shopDine":21.9,"beachIn":19.6,"beachHeld":0.635,"shopHeld":0.204},{"p":7,"occ":0.937,"trip":4.1,"circ":0.2,"standstill":0.032,"left":0.3,"rev":686.1,"search":2.2,"cruiseMi":1.3,"lotOcc":0.815,"lotFull":0,"far":28.5,"toLot":82.3,"shopDine":20.8,"beachIn":18.3,"beachHeld":0.67,"shopHeld":0.19},{"p":7.5,"occ":0.877,"trip":4.5,"circ":0,"standstill":0.042,"left":0,"rev":709.9,"search":1.9,"cruiseMi":0,"lotOcc":0.788,"lotFull":0,"far":32.6,"toLot":90.5,"shopDine":21.4,"beachIn":20.6,"beachHeld":0.613,"shopHeld":0.182},{"p":8,"occ":0.816,"trip":4.1,"circ":0,"standstill":0.031,"left":0,"rev":699.6,"search":1.7,"cruiseMi":0,"lotOcc":0.779,"lotFull":0,"far":27.4,"toLot":82.4,"shopDine":18.6,"beachIn":18.9,"beachHeld":0.585,"shopHeld":0.159},{"p":8.5,"occ":0.723,"trip":4.2,"circ":0,"standstill":0.033,"left":0,"rev":647.5,"search":1.7,"cruiseMi":0,"lotOcc":0.819,"lotFull":0,"far":33.8,"toLot":89.3,"shopDine":16.4,"beachIn":15.5,"beachHeld":0.513,"shopHeld":0.147},{"p":9,"occ":0.668,"trip":4.3,"circ":0,"standstill":0.036,"left":0,"rev":646,"search":1.7,"cruiseMi":0,"lotOcc":0.846,"lotFull":0,"far":31.4,"toLot":92.9,"shopDine":16,"beachIn":16.4,"beachHeld":0.472,"shopHeld":0.141},{"p":9.5,"occ":0.554,"trip":4.2,"circ":0,"standstill":0.032,"left":0,"rev":568.1,"search":1.5,"cruiseMi":0,"lotOcc":0.826,"lotFull":0,"far":34.9,"toLot":94.9,"shopDine":17.3,"beachIn":10.3,"beachHeld":0.37,"shopHeld":0.134},{"p":10,"occ":0.553,"trip":4.2,"circ":0,"standstill":0.032,"left":0,"rev":601.4,"search":1.4,"cruiseMi":0,"lotOcc":0.825,"lotFull":0,"far":39.3,"toLot":99.8,"shopDine":14.6,"beachIn":10.5,"beachHeld":0.382,"shopHeld":0.121},{"p":10.5,"occ":0.508,"trip":4.3,"circ":0,"standstill":0.034,"left":0,"rev":575.5,"search":1.5,"cruiseMi":0,"lotOcc":0.886,"lotFull":0,"far":35.5,"toLot":96.8,"shopDine":13.5,"beachIn":10.9,"beachHeld":0.355,"shopHeld":0.106},{"p":11,"occ":0.44,"trip":4.2,"circ":0,"standstill":0.031,"left":0,"rev":528.6,"search":1.4,"cruiseMi":0,"lotOcc":0.877,"lotFull":0,"far":39.4,"toLot":103.8,"shopDine":12.9,"beachIn":9,"beachHeld":0.294,"shopHeld":0.107},{"p":11.5,"occ":0.402,"trip":4.2,"circ":0,"standstill":0.033,"left":0,"rev":488.4,"search":1.3,"cruiseMi":0,"lotOcc":0.855,"lotFull":0,"far":38.8,"toLot":98.4,"shopDine":11.1,"beachIn":8.4,"beachHeld":0.272,"shopHeld":0.091},{"p":12,"occ":0.37,"trip":4.1,"circ":0,"standstill":0.031,"left":0,"rev":474.5,"search":1.3,"cruiseMi":0,"lotOcc":0.847,"lotFull":0,"far":36.3,"toLot":100,"shopDine":10.4,"beachIn":7.1,"beachHeld":0.261,"shopHeld":0.082}]};
  function runSweep() {
    var job = ++sweepJob, v = ui.visitors, res = [], k = 0, prices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    if (SWEEPS[v]) { sweep = { v: v, rows: SWEEPS[v] }; drawSweep(); afterSweep(); return; }
    function next() {
      if (job !== sweepJob) return;
      $('sweepText').innerHTML = '<span class="computing">Running whole days at twelve rates for ' + fmtV(v) + ' visitors… ' + k + ' of 12</span>';
      var p = prices[k], a = runDay(world, p, v, 11, 300, 420), r = { p: p };
      ['occ', 'circ', 'rev', 'left', 'search', 'trip', 'standstill', 'cruiseMi', 'shopDine', 'beachHeld'].forEach(function (f) { r[f] = a[f]; });
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
      if (best) t += ' At about <b>' + money(best.p) + '</b> all day, the meters run ' + Math.round(best.occ * 100) + '% full, traffic moves, a trip around takes about <b>' + Math.round(best.trip) + ' minutes</b>, and the meters take in $' + Math.round(best.rev) + ' an hour instead of $' + Math.round(at2.rev) + '.' +
        (best.beachHeld != null ? ' All-day beachgoers hold ' + Math.round(best.beachHeld * 100) + '% of the spaces instead of ' + Math.round(at2.beachHeld * 100) + '%, and ' + Math.round(best.shopDine) + ' shoppers and diners an hour park on the loop instead of ' + Math.round(at2.shopDine) + '.' : '');
      else t += ' Even $12.00 doesn\'t keep the loop moving with this many visitors: through traffic and drop-offs alone fill it.';
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
      function xp(v) { return padL + pw * (v - 1) / (PMAX - 1); }
      function yv(v) { return y0 + ph * (1 - v / max); }
      if (sp.band) { c.fillStyle = T.band; c.fillRect(padL, yv(0.9), pw, yv(0.8) - yv(0.9)); }
      c.strokeStyle = T.rule2; c.lineWidth = 1; c.font = '10px ' + T.fMono; c.fillStyle = T.ink3; c.textAlign = 'right'; c.textBaseline = 'middle';
      [0, 0.5, 1].forEach(function (g) { var y = yv(max * g); c.beginPath(); c.moveTo(padL, y + 0.5); c.lineTo(W - padR, y + 0.5); c.stroke(); c.fillText(sp.fmt(max * g), padL - 5, y); });
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      for (var d = 1; d <= PMAX; d += (W < 300 ? 2 : 1)) c.fillText('$' + d, xp(d), H - 5);
      c.setLineDash([3, 3]); c.strokeStyle = T.ink3; c.beginPath(); c.moveTo(xp(2) + 0.5, y0); c.lineTo(xp(2) + 0.5, y0 + ph); c.stroke(); c.setLineDash([]);
      c.fillStyle = T.ink3; c.textAlign = 'left'; c.fillText('today', xp(2) + 4, y0 + 10);
      c.strokeStyle = sp.color; c.lineWidth = 2.2; c.beginPath();
      rows.forEach(function (r, i) { var x = xp(r.p), y = yv(r[sp.f]); if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.stroke();
      c.fillStyle = sp.color; rows.forEach(function (r) { c.beginPath(); c.arc(xp(r.p), yv(r[sp.f]), 2, 0, Math.PI * 2); c.fill(); });
      if (best) { c.strokeStyle = T.good; c.lineWidth = 2; c.beginPath(); c.arc(xp(best.p), yv(best[sp.f]), 6, 0, Math.PI * 2); c.stroke(); }
      var vv = interp(rows, Math.min(PMAX, p), sp.f);
      c.fillStyle = T.ink; c.beginPath(); c.arc(xp(Math.min(PMAX, p)), yv(vv), 4.5, 0, Math.PI * 2); c.fill();
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
