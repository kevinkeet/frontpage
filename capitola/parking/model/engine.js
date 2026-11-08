/* ---------- Village loop parking and traffic simulation (1-D lanes) ---------- */
var P = {
  // drivers looking for a space on the loop
  lotPrice: 1.00, walkMin: 7, limitH: 3,
  stayMed: 1.75, staySig: 0.5,     // hours wanted
  votMed: 20, votSig: 0.7,         // $/hr value of a visitor's time
  gearMean: 3,                     // $ hassle of hauling chairs, coolers and kids a quarter mile
  leaveShare: 0.2,                 // of drivers who give up circling, share who leave Capitola
  patienceMin: 3, patienceMax: 8,  // most laps a driver will tolerate
  hoverSec: 30, hoverMax: 40,      // stop and wait for someone clearly about to pull out
  // where traffic comes from and goes
  viaMonterey: 0.35,               // arrivals coming down Monterey Ave from Park Ave (the rest come down Capitola Ave)
  sjShare: 0.65,                   // circling drivers who cut down San Jose Ave instead of going around by Stockton
  sjShareNew: 0.5,                 // drivers arriving down Monterey who take San Jose Ave to the beach
  zipper: 5,                       // seconds before traffic lets a merging car in
  dgSeek: 0.45, dgOther: 0.6,      // share taking the angled leg of the triangle: drivers still looking, everyone else
  takeFirst: 0.9,                  // on a first pass, chance a driver takes an open space near or past where they're going
  takeEarly: 0.08,                 // ... and one well short of it
  // everyone else on the loop
  bgK: 1.2, bgDropShare: 0.3, lotDropShare: 0.35, fullLoopShare: 0.5,
  dropMed: 75, dropSig: 0.55, squeezeAfter: 20,
  // pedestrians and intersections
  pedK: 1.5, pedCross: 7, pedYield: 12,
  stopDwell: 1.5, hwJ: 3, hwM: 8, crossJ: 0.4, crossM: 0.4,   // seconds per vehicle at each all-way stop; cross traffic per seeker
  // driving
  maneuver: 7, vLoop: 5.5, vEsp: 2.6, vApp: 6.5, gap: 7.0, ringCap: 0.92
};

function makeRng(seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function randn(rng) { var u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); }
function expo(rng, ratePerHr) { return ratePerHr > 0 ? -Math.log(1 - rng()) / ratePerHr * 3600 : 1e12; }
function makeDriver(rng) {
  var T = P.stayMed * Math.exp(P.staySig * randn(rng));
  var v = P.votMed * Math.exp(P.votSig * randn(rng));
  var g = -P.gearMean * Math.log(1 - rng());
  return { T: T, v: v, walk: v * (2 * P.walkMin / 60) + g,
    patience: P.patienceMin + Math.floor(rng() * (P.patienceMax - P.patienceMin + 1)) };
}
function advantage(d, price) {
  if (d.T > P.limitH) return -1;            // needs more than 3 hours: the lots allow 12
  return (P.lotPrice - price) * d.T + d.walk;
}
var _pop = null;
function tryShare(price) {
  if (!_pop) { var r = makeRng(7); _pop = []; for (var i = 0; i < 6000; i++) _pop.push(makeDriver(r)); }
  var n = 0; for (var j = 0; j < _pop.length; j++) if (advantage(_pop[j], price) > 0) n++;
  return n / _pop.length;
}
function lowerBound(a, x) { var lo = 0, hi = a.length; while (lo < hi) { var m = (lo + hi) >> 1; if (a[m] < x) lo = m + 1; else hi = m; } return lo; }

function Sim(world, opts) {
  opts = opts || {};
  var self = this;
  this.w = world; this.rng = makeRng(opts.seed || 1); this.visual = !!opts.visual;
  this.t = 0; this.lambda = opts.lambda || 135; this.price = opts.price != null ? opts.price : 2; this.mode = opts.mode || 'flat';
  this.cars = []; this.ghosts = [];
  var span = world.exitS - world.espS0;
  this.spaces = world.spaces.map(function (sp, i) {
    // where the space sits along the beach loop, 0 = Stockton end of the Esplanade, 1 = the Monterey stop
    var pos = sp.lane === 'R' ? (sp.s - world.espS0) / span
      : sp.lane === 'DG' ? (world.espEnd - world.espS0 + sp.s) / span
      : (world.sjBot - world.espS0) / span + (0.5 - sp.s / world.sjLen) * 0.25;
    return { lane: sp.lane, s: sp.s, i: i, car: null, resv: null, pos: pos };
  });
  this.spBy = { R: [], SJ: [], DG: [] };
  this.spaces.forEach(function (sp) { self.spBy[sp.lane].push(sp); });
  this.spS = {};
  for (var lk in this.spBy) this.spS[lk] = this.spBy[lk].map(function (x) { return x.s; });
  this.xw = world.xwalks.map(function (x) { return { lane: x.lane, s: x.s, w: x.w, until: 0, next: expo(self.rng, P.pedK * self.lambda * x.w), start: 0 }; });
  this.inter = {
    J: { queue: [], nextFree: 0, nextPh: expo(this.rng, P.crossJ * this.lambda), cross: 'crossJ', hw: 'hwJ' },
    M: { queue: [], nextFree: 0, nextPh: expo(this.rng, P.crossM * this.lambda), cross: 'crossM', hw: 'hwM' }
  };
  this.nextSeek = expo(this.rng, this.lambda); this.nextBg = expo(this.rng, P.bgK * this.lambda);
  this.nextAdjust = 600; this.id = 0;
  this.min = []; this._newBucket();
  this.totals = { lotFirst: 0, diverted: 0, left: 0, parked: 0 };
  this.occNow = 0; this.circNow = 0; this.waitingIn = 0; this.ringN = 0;
  // start mid-afternoon: cars already parked at random spaces, partway through their stays
  if (opts.prefill) {
    var fill = Math.min(0.95, this.lambda * tryShare(this.price) * 1.7 / this.spaces.length);
    for (var si = 0; si < this.spaces.length; si++) {
      if (this.rng() >= fill) continue;
      var sp0 = this.spaces[si], d0 = makeDriver(this.rng);
      d0.T = Math.min(d0.T, P.limitH);
      var c0 = { id: ++this.id, kind: 'seek', d: d0, lane: sp0.lane, s: sp0.s, st: 'parked', laps: 0, tArr: 0, odo: 0, odoMark: 0,
        exit: null, route: null, searched: true, dropped: false, leaving: false, sp: sp0, paid: this.price, tPark: 0, tDep: this.rng() * d0.T * 3600 };
      sp0.car = c0; this.cars.push(c0);
    }
  }
}
Sim.prototype._newBucket = function () {
  this.cur = { t: Math.floor(this.t / 60), occ: 0, circ: 0, n: 0, arr: 0, parked: 0, searchSum: 0, toLot: 0, left: 0, rev: 0, lotRev: 0,
    cruiseM: 0, price: this.price, departs: 0, aSum: 0, aN: 0, bSum: 0, bN: 0, drops: 0, waitIn: 0, mQ: 0 };
  this.min.push(this.cur);
  if (this.min.length > 300) this.min.shift();
};
Sim.prototype.setLambda = function (l) {
  this.lambda = l;
  this.nextSeek = Math.min(this.nextSeek, this.t + expo(this.rng, l));
  this.nextBg = Math.min(this.nextBg, this.t + expo(this.rng, P.bgK * l));
};
Sim.prototype._spawn = function (kind, d, tArr) {
  var rng = this.rng, viaM = rng() < P.viaMonterey;
  var c = { id: ++this.id, kind: kind, d: d, lane: viaM ? 'AM' : 'AJ', s: 0, st: kind === 'seek' ? 'loop' : 'drive', laps: 0, tArr: tArr, odo: 0, odoMark: 0,
    exit: null, route: null, searched: false, dropped: false, leaving: false };
  if (kind === 'seek') { c.adv = advantage(d, this.price); c.target = rng(); }
  else if (kind === 'drop') { c.exit = rng() < 0.5 ? 'J' : 'M'; if (viaM) c.route = 'SJ'; }
  else if (kind === 'thru') {
    if (viaM) { if (rng() < 0.5) { c.exit = 'J'; c.route = 'J'; } else { c.exit = 'M'; c.route = 'SJ'; } }
    else c.exit = rng() < P.fullLoopShare ? 'J' : 'M';
  }
  this.cars.push(c);
};

Sim.prototype.step = function (dt) {
  var w = this.w, rng = this.rng, t = this.t = this.t + dt, i, j, k, c;
  if (Math.floor(t / 60) !== this.cur.t) this._newBucket();
  var B = this.cur, L = w.loopLen, gap = P.gap, self = this;

  // 1. arrivals
  while (this.nextSeek <= t) {
    var d = makeDriver(rng); B.arr++;
    if (advantage(d, this.price) <= 0) {
      B.toLot++; this.totals.lotFirst++; B.lotRev += P.lotPrice * d.T;
      if (rng() < P.lotDropShare) this._spawn('drop', null, this.nextSeek);
    } else this._spawn('seek', d, this.nextSeek);
    this.nextSeek += expo(rng, this.lambda);
  }
  while (this.nextBg <= t) {
    this._spawn(rng() < P.bgDropShare ? 'drop' : 'thru', null, this.nextBg);
    this.nextBg += expo(rng, P.bgK * this.lambda);
  }

  // 2. people crossing
  for (k = 0; k < this.xw.length; k++) {
    var x = this.xw[k];
    while (x.next <= t) {
      if (x.until < x.next) x.start = x.next;
      x.until = Math.max(x.until, x.next + P.pedCross);
      x.next += expo(rng, P.pedK * this.lambda * x.w);
    }
  }

  // sort cars into lanes
  var lanes = { R: [], SJ: [], DG: [], AJ: [], AM: [] };
  for (i = 0; i < this.cars.length; i++) { c = this.cars[i]; if (c.st !== 'parked' && c.st !== 'gone') lanes[c.lane].push(c); }
  for (var ln in lanes) lanes[ln].sort(function (p, q) { return p.s - q.s; });
  var R = lanes.R;
  this.ringN = R.length;
  var ringRoom = function (from, to) {
    for (var m = 0; m < R.length; m++) { var q = R[m].s; if (q >= from && q < to) return false; }
    return true;
  };

  // 3. all-way stops: one vehicle at a time, cross traffic included; nobody enters without room beyond
  for (var id in this.inter) {
    var I = this.inter[id];
    while (I.nextPh <= t) { I.queue.push({ ph: true }); I.nextPh += expo(rng, P[I.cross] * this.lambda); }
    while (I.queue.length && I.queue[0].st === 'gone') I.queue.shift();
    if (t >= I.nextFree && I.queue.length) {
      // first come, first served, but a car with nowhere to go doesn't hold up the other directions
      for (var qi = 0; qi < I.queue.length && qi < 6; qi++) {
        var f = I.queue[qi];
        if (f.ph) { I.queue.splice(qi, 1); I.nextFree = t + P[I.hw]; break; }
        if (f.st === 'gone') continue;
        if (t - f.tStop >= P.stopDwell && this._roomPast(f, id, ringRoom, R.length)) {
          I.queue.splice(qi, 1); f.granted = id; I.nextFree = t + P[I.hw]; break;
        }
      }
    }
  }

  // 4. approach lanes: Capitola Ave down to Stockton (J), Monterey Ave down to Capitola (M)
  this.waitingIn = 0;
  [['AJ', w.appLen, 'J', 0], ['AM', w.amLen, 'M', w.exitS + 0.5]].forEach(function (a) {
    var lane = lanes[a[0]], len = a[1], sid = a[2], mergeS = a[3];
    for (var m = lane.length - 1; m >= 0; m--) {
      var cc = lane[m], lim = m === lane.length - 1 ? len - 1 : lane[m + 1].s - gap;
      var ns = Math.max(cc.s, Math.min(cc.s + P.vApp * dt, lim));
      if (ns - cc.s < 0.05 * dt) self.waitingIn++;
      cc.odo += ns - cc.s; cc.s = ns;
      if (m === lane.length - 1 && cc.s >= len - 1.6) {
        if (cc.queued !== sid) { cc.queued = sid; cc.tStop = t; self.inter[sid].queue.push(cc); }
        if (cc.granted === sid) {
          cc.lane = 'R'; cc.s = mergeS; cc.granted = cc.queued = null;
          if (sid === 'M') cc.tB = t;
          R.push(cc); R.sort(function (p, q) { return p.s - q.s; });
        }
      }
    }
  });

  // 5. San Jose Ave (one-way south): park, then stop and merge onto the Esplanade
  var SJ = lanes.SJ, sjStop = w.sjLen - 0.6;
  for (var m2 = SJ.length - 1; m2 >= 0; m2--) {
    c = SJ[m2];
    if (c.lane !== 'SJ' || c.st === 'pin' || c.st === 'pout') continue;
    var lead = m2 + 1 < SJ.length ? SJ[m2 + 1].s : Infinity;
    var lim3 = Math.min(lead - gap, sjStop);
    lim3 = this._crosswalkLimit(c, 'SJ', lim3, P.vEsp * dt, t);
    if (c.hoverSp) lim3 = this._hoverLimit(c, lim3, dt);
    var ns3 = Math.max(c.s, Math.min(c.s + P.vEsp * dt, lim3));
    this._afterMove(c, ns3, t);
    if (c.st === 'loop') ns3 = this._scan(c, 'SJ', c.s, ns3, t);
    c.odo += ns3 - c.s; c.s = ns3;
    if ((c.st === 'loop' || c.st === 'drive') && c.s >= sjStop - 0.6) {
      if (c.tStopSJ == null) c.tStopSJ = t;
      var waited = t - c.tStopSJ, sb = w.sjBot;
      var room = ringRoom(sb - 3, sb + gap) && (waited >= P.zipper || ringRoom(sb - 14, sb - 3)) && R.length < P.ringCap * L / gap;
      if (waited >= P.stopDwell && room) {
        c.lane = 'R'; c.s = sb; c.tStopSJ = null;
        if (c.tB != null) { B.bSum += t - c.tB; B.bN++; c.tB = null; }
        c.tEsp = t;
        R.push(c); R.sort(function (p, q) { return p.s - q.s; });
      }
    }
  }

  // 5b. the angled leg on the west side of the triangle: park, then merge back where it meets the beach aisle
  var DG = lanes.DG, dgEnd = w.dgLen - 0.6, sm = w.sMontJoin;
  for (var m3 = DG.length - 1; m3 >= 0; m3--) {
    c = DG[m3];
    if (c.lane !== 'DG' || c.st === 'pin' || c.st === 'pout') continue;
    var lead4 = m3 + 1 < DG.length ? DG[m3 + 1].s : Infinity;
    var lim4 = Math.min(lead4 - gap, dgEnd);
    if (c.hoverSp) lim4 = this._hoverLimit(c, lim4, dt);
    var ns4 = Math.max(c.s, Math.min(c.s + P.vEsp * dt, lim4));
    if (c.st === 'loop' && !c.leaving) ns4 = this._scan(c, 'DG', c.s, ns4, t);
    c.odo += ns4 - c.s; c.s = ns4;
    if ((c.st === 'loop' || c.st === 'drive') && c.s >= dgEnd - 0.6) {
      if (c.tStopDG == null) c.tStopDG = t;
      if (ringRoom(sm - 3, sm + gap) && (t - c.tStopDG >= P.zipper || ringRoom(sm - 14, sm - 3))) {
        c.lane = 'R'; c.s = sm + 0.1; c.tStopDG = null;
        R.push(c); R.sort(function (p, q) { return p.s - q.s; });
      }
    }
  }

  // 6. the loop
  var n = R.length, olds = new Array(n);
  for (i = 0; i < n; i++) olds[i] = R[i].s;
  var stops = w.stops;
  for (i = 0; i < n; i++) {
    c = R[i];
    if (c.lane !== 'R' || c.st === 'pin' || c.st === 'pout' || c.st === 'load' || c.st === 'gone') continue;
    var leadS = Infinity, leadLoad = false;
    for (j = 1; j < n; j++) {
      var o = R[(i + j) % n];
      if (o.lane !== 'R' || o.st === 'gone') continue;
      if (o.st === 'load' && t - o.loadStart >= P.squeezeAfter) continue;  // once there's room, traffic edges around
      leadS = olds[(i + j) % n] + (i + j >= n ? L : 0); leadLoad = o.st === 'load'; break;
    }
    var inEsp = c.s >= w.espS0 - 5 && c.s <= w.searchEnd + 5;
    var v = inEsp ? P.vEsp : P.vLoop;
    var lim2 = leadS - gap, reach = c.s + v * dt + 1;
    lim2 = this._crosswalkLimit(c, 'R', lim2, v * dt, t);
    for (k = 0; k < stops.length; k++) {
      var ss = stops[k].s, sid2 = stops[k].id;
      if (ss > c.s - 0.8 && ss <= reach + gap && c.granted !== sid2) {
        var atLine = c.s >= ss - 0.8 || (leadS > ss && leadS - gap - c.s < 0.6);
        if (atLine && c.queued !== sid2) { c.queued = sid2; c.tStop = t; this.inter[sid2].queue.push(c); }
        if (ss <= reach) lim2 = Math.min(lim2, ss - 0.5);
      }
    }
    if (c.hoverSp) lim2 = this._hoverLimit(c, lim2, dt);
    var ns2 = Math.max(c.s, Math.min(c.s + v * dt, lim2));
    if (ns2 - c.s < 0.02) { if (leadLoad) c.squeeze = (c.squeeze || 0) + dt; } else c.squeeze = 0;
    this._afterMove(c, ns2, t);
    if (c.st === 'loop' && !c.leaving) ns2 = this._scan(c, 'R', c.s, ns2, t);
    // onto the Esplanade from Stockton
    if (c.s < w.espS0 && ns2 >= w.espS0) { if (c.tB != null) { B.bSum += t - c.tB; B.bN++; c.tB = null; } c.tEsp = t; }
    // at the end of the Esplanade: the angled leg, or the aisle around the beach side of the triangle
    if (c.s < w.espEnd && ns2 >= w.espEnd && c.st !== 'load' && c.st !== 'pin') {
      var seeking = c.kind === 'seek' && c.st === 'loop' && !c.leaving;
      var dropping = c.kind === 'drop' && !c.dropped;
      if (!dropping && rng() < (seeking ? P.dgSeek : P.dgOther)) {
        var dgFree = true;
        for (k = 0; k < DG.length; k++) if (DG[k].lane === 'DG' && DG[k].s < gap) { dgFree = false; break; }
        if (dgFree) {
          c.odo += ns2 - c.s; c.lane = 'DG'; c.s = ns2 - w.espEnd; c.granted = c.queued = null;
          DG.unshift(c);
          continue;
        }
      }
    }
    // drop-offs at the corner by the triangle
    if (c.kind === 'drop' && !c.dropped && c.st === 'drive' && c.s < w.loadS && ns2 >= w.loadS) {
      ns2 = w.loadS; c.st = 'load'; c.loadStart = t; c.timer = Math.min(240, P.dropMed * Math.exp(P.dropSig * randn(rng))); B.drops++;
    }
    // through the Monterey stop
    if (c.s < w.exitS && ns2 >= w.exitS) {
      if (c.tEsp != null) { B.aSum += t - c.tEsp; B.aN++; c.tEsp = null; }
      if (c.kind === 'seek' && c.st === 'loop') c.searched = true;
      if (c.exit === 'M') {
        c.st = 'gone';
        if (this.visual) this.ghosts.push({ kind: c.kind === 'out' ? 'out' : 'thru', path: 'montN', s: ns2 - w.exitS });
        continue;
      }
      c.tB = t;
    }
    // the San Jose Ave corner on Capitola Ave: decide where to go next
    if (c.s < w.sjTop && ns2 >= w.sjTop) {
      if (c.kind === 'seek' && c.st === 'loop' && !c.leaving) {
        if (c.searched) {
          c.laps++; B.cruiseM += c.odo + (ns2 - c.s) - c.odoMark; c.odoMark = c.odo + (ns2 - c.s); c.hovered = false;
          var searchedH = (t - c.tArr) / 3600;
          if (c.d.v * searchedH > c.adv || c.laps >= c.d.patience) { c.leaving = true; c.exit = 'J'; c.route = 'J'; }
          else c.route = rng() < P.sjShare ? 'SJ' : 'J';
        } else c.route = rng() < P.sjShareNew ? 'SJ' : 'J';
      }
      if (c.route === 'SJ') {
        var sjFree = true;
        for (k = 0; k < SJ.length; k++) if (SJ[k].lane === 'SJ' && SJ[k].s < gap) { sjFree = false; break; }
        if (sjFree) {
          c.odo += ns2 - c.s; c.lane = 'SJ'; c.s = ns2 - w.sjTop; c.granted = c.queued = null; c.route = null;
          SJ.unshift(c);
          continue;
        }
      }
    }
    // back at the Stockton corner
    if (ns2 >= L) {
      c.granted = c.queued = null;
      if (c.exit === 'J' || c.leaving) {
        c.st = 'gone';
        if (c.leaving) {
          var gone = rng() < P.leaveShare;
          if (gone) { B.left++; this.totals.left++; } else { B.toLot++; this.totals.diverted++; B.lotRev += P.lotPrice * c.d.T; }
          if (this.visual) this.ghosts.push({ kind: gone ? 'left' : 'lot', path: 'spurOut', s: 0 });
        } else if (this.visual) this.ghosts.push({ kind: 'thru', path: 'spurOut', s: 0 });
        continue;
      }
      ns2 -= L;
    }
    if (c.granted && stopPassed(stops, c, ns2)) c.granted = c.queued = null;
    c.odo += ns2 - c.s; c.s = ns2;
  }

  // 7. maneuvers, loading, parked cars
  var occ = 0, circ = 0;
  for (i = 0; i < this.cars.length; i++) {
    c = this.cars[i];
    if (c.st === 'pin') {
      c.timer -= dt;
      if (c.timer <= 0) { c.st = 'parked'; c.tPark = t; c.tDep = t + c.d.T * 3600; c.paid = this.price; c.tEsp = c.tB = null; B.parked++; this.totals.parked++; B.searchSum += (t - c.tArr); }
    } else if (c.st === 'parked') {
      B.rev += c.paid * dt / 3600;
      if (t >= c.tDep && canPullOut(lanes[c.lane], c.s, c.sp.resv, t >= c.tDep + 30)) { c.st = 'pout'; c.timer = P.maneuver; }
    } else if (c.st === 'pout') {
      c.timer -= dt;
      if (c.timer <= 0) { c.sp.car = null; c.sp = null; c.st = 'drive'; c.kind = 'out'; c.exit = 'M'; c.route = null; B.departs++; }
    } else if (c.st === 'load') {
      c.timer -= dt;
      if (c.timer <= 0) { c.st = 'drive'; c.dropped = true; }
    }
    if (c.kind === 'seek' && c.st === 'loop' && (c.laps >= 1 || c.searched) && !c.leaving) circ++;   // missed at least once
    if (c.st === 'gone' && c.hoverSp) { c.hoverSp.resv = null; c.hoverSp = null; }
  }
  for (i = 0; i < this.spaces.length; i++) if (this.spaces[i].car) occ++;
  var keep = [];
  for (i = 0; i < this.cars.length; i++) if (this.cars[i].st !== 'gone') keep.push(this.cars[i]);
  this.cars = keep;
  B.occ += occ / this.spaces.length * dt; B.circ += circ * dt; B.n += dt; B.price = this.price;
  B.waitIn += this.waitingIn * dt; B.mQ += this.inter.M.queue.length * dt;
  this.occNow = occ; this.circNow = circ;

  // 8. demand-responsive pricing: nudge the rate every 10 minutes toward ~85% full
  if (this.mode === 'responsive' && t >= this.nextAdjust) {
    this.nextAdjust = t + 600;
    var oo = this.avg('occ', 5), cc2 = this.avg('circ', 10);
    var prev = this.min.slice(-16, -11), po = 0, pn = 0;
    for (k = 0; k < prev.length; k++) { po += prev[k].occ; pn += prev[k].n; }
    var trend = pn ? oo - po / pn : 0, p = this.price;
    if (cc2 > 2) p += 0.5;
    else if (cc2 > 0.3) p += 0.25;
    else if (oo > 0.90 && trend >= -0.01) p += 0.25;
    else if (oo < 0.75 && trend <= 0.01) p -= 0.25;
    this.price = Math.max(1, Math.min(10, Math.round(p * 4) / 4));
  }
  if (this.visual) {
    for (i = 0; i < this.ghosts.length; i++) this.ghosts[i].s += P.vApp * dt;
    var maxS = w.ghostLen;
    this.ghosts = this.ghosts.filter(function (g) { return g.s < maxS; });
  }
};
// would this car have somewhere to go once it's through the intersection?
Sim.prototype._roomPast = function (f, id, ringRoom, ringN) {
  var w = this.w, gap = P.gap, L = w.loopLen;
  if (id === 'M') {
    if (f.lane === 'R' && f.exit === 'M') return true;                   // leaving north on Monterey
    if (f.lane === 'AM' && ringN >= P.ringCap * L / gap) return false;   // the loop is packed: wait on Monterey
    return ringRoom(w.exitS - 1, w.exitS + gap);
  }
  if (f.lane === 'R' && (f.exit === 'J' || f.leaving)) return true;      // leaving up Capitola Ave
  if (f.lane === 'AJ') return ringN < P.ringCap * L / gap && ringRoom(0, 2 * gap) && ringRoom(L - 1, L + 1);
  return ringRoom(0, gap);
};
Sim.prototype._crosswalkLimit = function (c, lane, lim, step, t) {
  for (var k = 0; k < this.xw.length; k++) {
    var x = this.xw[k];
    if (x.lane !== lane) continue;
    if (x.s > c.s + 0.01 && x.s <= c.s + step + 1 && x.until > t) {
      if (c.xwS !== x.s) { c.xwS = x.s; c.xwT = 0; }
      if (c.xwT < P.pedYield) lim = Math.min(lim, x.s - 0.6);
    }
  }
  return lim;
};
Sim.prototype._afterMove = function (c, ns, t) {
  if (ns - c.s < 0.02 && c.xwS != null && Math.abs(c.s - (c.xwS - 0.6)) < 1) c.xwT += t - (c._lastT || t);
  c._lastT = t;
  if (c.xwS != null && ns > c.xwS) c.xwS = null;
};
Sim.prototype._hoverLimit = function (c, lim, dt) {
  var hs = c.hoverSp;
  if (!hs.car) return Math.min(lim, hs.s);
  c.hoverT = (c.hoverT || 0) + dt;
  if (c.hoverT > P.hoverMax) { hs.resv = null; c.hoverSp = null; return lim; }
  return Math.min(lim, Math.max(c.s, hs.s - 6));
};
// look for an open space passed this step, or stop to wait for someone about to leave
Sim.prototype._scan = function (c, lane, a, b, t) {
  var arr = this.spBy[lane], sArr = this.spS[lane], hoverCand = null;
  for (var j = lowerBound(sArr, a - 0.001); j < arr.length && arr[j].s <= b; j++) {
    var sp = arr[j];
    if (!sp.car && (!sp.resv || sp.resv === c)) {
      if (c.laps === 0 && sp.resv !== c && this.rng() > (sp.pos < (c.target || 0) - 0.15 ? P.takeEarly : P.takeFirst)) continue;   // holding out for one closer
      if (c.hoverSp && c.hoverSp !== sp) c.hoverSp.resv = null;
      sp.car = c; sp.resv = null; c.sp = sp; c.hoverSp = null; c.st = 'pin'; c.timer = P.maneuver;
      return sp.s;
    }
    if (!hoverCand && !c.hoverSp && !c.hovered && sp.car && sp.car.st === 'parked' && !sp.resv && sp.car.tDep - t < P.hoverSec) hoverCand = sp;
  }
  if (hoverCand) { hoverCand.resv = c; c.hoverSp = hoverCand; c.hoverT = 0; c.hovered = true; return Math.min(b, Math.max(a, hoverCand.s - 6)); }
  return b;
};
function stopPassed(stops, c, ns) {
  for (var k = 0; k < stops.length; k++) if (stops[k].id === c.granted) return ns > stops[k].s + 0.5 || ns < c.s;
  return true;
}
function canPullOut(lane, s, ignore, courtesy) {
  for (var i = 0; i < lane.length; i++) {
    var o = lane[i]; if (o === ignore || o.st === 'gone' || o.st === 'parked') continue;
    var q = o.s;
    if (q > s - 2.5 && q < s + 6.5) return false;
    if (!courtesy && q >= s - 9 && q <= s - 2.5) return false;
  }
  return true;
}
Sim.prototype.avg = function (field, m) {
  var arr = this.min.slice(-m - 1, -1); if (!arr.length) arr = this.min.slice(-1);
  var s = 0, n = 0;
  for (var i = 0; i < arr.length; i++) { s += arr[i][field]; n += arr[i].n; }
  return n ? s / n : 0;
};
Sim.prototype.windowStats = function (m) {
  var arr = this.min.slice(-m - 1, -1); if (!arr.length) arr = this.min.slice(-1);
  var o = { occ: 0, circ: 0, n: 0, parked: 0, searchSum: 0, toLot: 0, left: 0, rev: 0, lotRev: 0, cruiseM: 0, departs: 0, arr: 0, aSum: 0, aN: 0, bSum: 0, bN: 0, drops: 0, waitIn: 0, mQ: 0 };
  for (var i = 0; i < arr.length; i++) for (var k in o) o[k] += arr[i][k];
  var hrs = arr.length / 60, segA = o.aN ? o.aSum / o.aN / 60 : 0, segB = o.bN ? o.bSum / o.bN / 60 : 0;
  return {
    occ: o.n ? o.occ / o.n : 0, circ: o.n ? o.circ / o.n : 0,
    search: o.parked ? o.searchSum / o.parked / 60 : 0,
    espToStop: segA, back: segB, trip: segA + segB, tripN: o.aN,
    toLot: o.toLot / hrs, left: o.left / hrs, rev: o.rev / hrs, lotRev: o.lotRev / hrs,
    cruiseMi: o.cruiseM / 1609.34 / hrs, turnover: o.departs / hrs / this.spaces.length,
    arr: o.arr / hrs, parked: o.parked / hrs, drops: o.drops / hrs,
    waitIn: o.n ? o.waitIn / o.n : 0, mQ: o.n ? o.mQ / o.n : 0
  };
};
Sim.prototype.warm = function (minutes) { for (var i = 0; i < minutes * 60; i++) this.step(1); };
function runHeadless(world, price, lambda, seed, warmMin, measureMin) {
  var sim = new Sim(world, { seed: seed, price: price, lambda: lambda, prefill: true });
  for (var i = 0; i < (warmMin + measureMin) * 60; i++) sim.step(1);
  return sim.windowStats(measureMin);
}
if (typeof module !== 'undefined') module.exports = { P: P, Sim: Sim, runHeadless: runHeadless, tryShare: tryShare, advantage: advantage };
