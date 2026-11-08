/* ---------- Village loop parking and traffic simulation (1-D lanes) ---------- */
var P = {
  // drivers looking for a space on the loop
  lotPrice: 1.00, walkMin: 7, limitH: 3,   // meters charge for at most 3 hours
  // who's coming: the main reason for the visit on a summer Saturday (2008 city survey: beach 53%, shopping 21%, restaurants
  // 12%, other 14%), and how long each stays (assumed, set so the average visit is the survey's 3.4 hours)
  types: [
    { k: 'beach', share: 0.53, stayMed: 4.5, staySig: 0.35, gear: 10 },  // a beach day; $ hassle of hauling chairs, coolers and kids
    { k: 'shop', share: 0.21, stayMed: 1.0, staySig: 0.5, gear: 1 },
    { k: 'dine', share: 0.12, stayMed: 1.5, staySig: 0.35, gear: 1 },
    { k: 'other', share: 0.14, stayMed: 2.5, staySig: 0.6, gear: 3 }    // work, visiting, everything else
  ],
  citeCost: 10,                    // $ expected cost of overstaying the 3-hour limit (a ticket, sometimes)
  // the Beach & Village lots up Capitola Ave fill on busy days; then the fallback is free parking farther out
  lotCap: 458, lotOther: 0.3,      // lot spaces (two lots, 2025-26 city fee schedule); share of other arriving cars (not trying the loop first) that park there
  lotAware: 0.57,                  // visitors who know the lots exist (2008 city survey, summer Saturday: 57%); the rest compare the meter with parking farther out
  farWalkMin: 15, farGear: 1.5,    // when the lots are full: about a 15-minute walk each way, and more hauling
  // a day of visitors
  dayStart: 8,                     // the simulated day starts at 8 AM
  carShare: 0.82, perCar: 2.8,     // visitors who come by car, people per car (2008 city study)
  loopShare: 0.45,                 // arriving cars that look for a space on the beach loop first
  profile: [0.03, 0.07, 0.12, 0.14, 0.14, 0.12, 0.10, 0.08, 0.07, 0.06, 0.04, 0.03],  // share of the day's arrivals, 8 AM to 8 PM
  votMed: 20, votSig: 0.8,         // $/hr value of a visitor's time
  leaveShare: 0.2,                 // of drivers who give up circling, share who leave Capitola
  patienceMin: 3, patienceMax: 8,  // most laps a driver will tolerate
  hoverSec: 30, hoverMax: 40,      // stop and wait for someone clearly about to pull out
  // where traffic comes from and goes
  viaMonterey: 0.35,               // arrivals coming down Monterey Ave from Park Ave (the rest come down Capitola Ave)
  sjShare: 0.65,                   // circling drivers who cut down San Jose Ave instead of going around by Stockton
  sjShareNew: 0.5,                 // drivers arriving down Monterey who take San Jose Ave to the beach
  zipper: 5,                       // seconds before traffic lets a merging car in
  sjWaitMax: 25,                   // seconds a driver waits on Capitola Ave to turn onto a backed-up San Jose Ave
  balkSec: 6, balkFrac: 0.6, balkCars: 50,   // a car in line ahead costs ~6 s; drivers turn away when the wait eats much of what the space is worth
  dgSeek: 0.45, dgOther: 0.6,      // share taking the angled leg of the triangle: drivers still looking, everyone else
  takeEarly: 0.08,                 // on a quiet loop, share of drivers who take the first open space they see, even well short of where they're going
  choosyFull: 0.9, grabFull: 0.98, // ... rising to all of them as the loop fills from 90% to 98%; the rest hold out for one near their destination
  nearWin: 0.03,                   // "near where they're going": within about 10 m before it, or anywhere past it
  seeSide: 0.9,                    // chance a driver looking spots an open space down the angled leg or San Jose Ave and heads for it
  // everyone else on the loop
  bgK: 1.2, bgDropShare: 0.3, lotDropShare: 0.35, fullLoopShare: 0.5,
  dropMed: 75, dropSig: 0.55, squeezeAfter: 20,
  // pedestrians and intersections
  pedK: 1.5, pedCross: 7, pedYield: 12,
  stopDwell: 1.5, hwJ: 5, hwM: 8, crossJ: 0.5, crossM: 0.4,   // seconds per vehicle at each all-way stop; cross traffic per seeker
  // driving
  maneuver: 7, vLoop: 5.5, vEsp: 2.6, vApp: 6.5, gap: 7.0, ringCap: 0.92, carLen: 4.6
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
  var u = rng(), ty = P.types[P.types.length - 1];
  for (var i = 0, acc = 0; i < P.types.length; i++) { acc += P.types[i].share; if (u < acc) { ty = P.types[i]; break; } }
  var T = ty.stayMed * Math.exp(ty.staySig * randn(rng));
  var v = P.votMed * Math.exp(P.votSig * randn(rng));
  var g = -ty.gear * Math.log(1 - rng());
  return { type: ty.k, T: T, v: v, walk: v * (2 * P.walkMin / 60) + g, walkFar: v * (2 * P.farWalkMin / 60) + g * P.farGear,
    patience: P.patienceMin + Math.floor(rng() * (P.patienceMax - P.patienceMin + 1)), aware: rng() < P.lotAware };
}
// $ a driver saves by parking on the loop instead of the lots: the lots charge for the whole stay (12 hours allowed),
// the meters for at most 3 hours, plus the risk of a ticket for staying longer; the lots cost the walk.
// Drivers who don't know the lots, or find them full, compare the meter with free parking farther out: a longer walk.
function advantage(d, price, lotFull) {
  var meter = price * Math.min(d.T, P.limitH) + (d.T > P.limitH ? P.citeCost : 0);
  return lotFull || d.aware === false ? d.walkFar - meter : P.lotPrice * Math.min(d.T, 12) + d.walk - meter;
}
// cars an hour looking for a loop space, at a time of day, for a given number of daily visitors
function arrivalsPerHour(visitors, tSec) {
  var h = tSec / 3600 - 0.5, i = Math.floor(h), f = h - i, pr = P.profile;
  var a = i < 0 ? pr[0] * (1 + h) : i >= pr.length - 1 ? pr[pr.length - 1] * Math.max(0, 1 - (h - pr.length + 1)) : pr[i] + (pr[i + 1] - pr[i]) * f;
  return visitors * P.carShare / P.perCar * P.loopShare * Math.max(0, a);
}
var _pop = null;
function tryShare(price, lotFull) {
  if (!_pop) { var r = makeRng(7); _pop = []; for (var i = 0; i < 6000; i++) _pop.push(makeDriver(r)); }
  var n = 0; for (var j = 0; j < _pop.length; j++) if (advantage(_pop[j], price, lotFull) > 0) n++;
  return n / _pop.length;
}
function lowerBound(a, x) { var lo = 0, hi = a.length; while (lo < hi) { var m = (lo + hi) >> 1; if (a[m] < x) lo = m + 1; else hi = m; } return lo; }

function Sim(world, opts) {
  opts = opts || {};
  var self = this;
  this.w = world; this.rng = makeRng(opts.seed || 1); this.visual = !!opts.visual;
  this.t = 0; this.fixedLambda = opts.lambda || null; this.visitors = opts.visitors || 9000;
  this.lambda = this.fixedLambda || arrivalsPerHour(this.visitors, 0);
  this.price = opts.price != null ? opts.price : 2; this.mode = opts.mode || 'flat';
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
  this.nextLot = expo(this.rng, this._lotRate());
  // the lots: cars parked there, by when they leave (sorted)
  this.lot = { out: [] };
  this.merge = { SJ: { s: world.sjBot, wait: null, rPassed: 1 }, DG: { s: world.sMontJoin, wait: null, rPassed: 1 } };
  this.nextAdjust = 600; this.id = 0;
  this.min = []; this._newBucket();
  this.totals = { lotFirst: 0, diverted: 0, left: 0, parked: 0, far: 0 };
  if (opts.prefill) {   // the lots start the morning about as full as the loop
    var lf = typeof opts.prefill === 'number' ? opts.prefill : 0.5;
    for (var li = 0; li < P.lotCap * lf; li++) this._lotAdd(makeDriver(this.rng), this.rng());
  }
  this.occNow = 0; this.circNow = 0; this.waitingIn = 0; this.ringN = 0;
  // start mid-afternoon: cars already parked at random spaces, partway through their stays
  if (opts.prefill) {
    var fill = typeof opts.prefill === 'number' ? opts.prefill : Math.min(0.95, this.lambda * tryShare(this.price) * 1.7 / this.spaces.length);
    for (var si = 0; si < this.spaces.length; si++) {
      if (this.rng() >= fill) continue;
      var sp0 = this.spaces[si], d0 = makeDriver(this.rng);

      var c0 = { id: ++this.id, kind: 'seek', d: d0, lane: sp0.lane, s: sp0.s, st: 'parked', laps: 0, tArr: 0, odo: 0, odoMark: 0,
        exit: null, route: null, searched: true, dropped: false, leaving: false, sp: sp0, paid: this.price, tPark: 0, tDep: this.rng() * d0.T * 3600 };
      sp0.car = c0; this.cars.push(c0);
    }
  }
}
// other arriving cars an hour (not trying the loop first) that head straight for the lots
Sim.prototype._lotRate = function () {
  if (this.fixedLambda) return this.fixedLambda * (1 - P.loopShare) / P.loopShare * P.lotOther;
  return arrivalsPerHour(this.visitors, this.t) * (1 - P.loopShare) / P.loopShare * P.lotOther;
};
Sim.prototype._lotFull = function () { return this.lot.out.length >= P.lotCap; };
// park in the lots if there's room (a fraction of the stay already used, for cars there at the start), else farther out
Sim.prototype._lotAdd = function (d, used) {
  if (this._lotFull()) { if (this.cur) this.cur.far++; this.totals.far++; return false; }
  var tOut = this.t + d.T * 3600 * (1 - (used || 0));
  this.lot.out.splice(lowerBound(this.lot.out, tOut), 0, tOut);
  if (this.cur && !used) this.cur.lotRev += P.lotPrice * Math.min(d.T, 12);
  return true;
};
// a driver who passes on the loop: the lots if they know them, otherwise somewhere farther out
Sim.prototype._divert = function (d) {
  if (d.aware === false) { this.cur.far++; this.totals.far++; return false; }
  return this._lotAdd(d);
};
Sim.prototype._newBucket = function () {
  this.cur = { t: Math.floor(this.t / 60), occ: 0, circ: 0, n: 0, arr: 0, parked: 0, searchSum: 0, toLot: 0, left: 0, rev: 0, lotRev: 0,
    cruiseM: 0, price: this.price, departs: 0, aSum: 0, aN: 0, bSum: 0, bN: 0, drops: 0, waitIn: 0, mQ: 0, stopLen: 0, balked: 0, lam: this.lambda,
    lotOcc: 0, far: 0, lotFull: 0, pShop: 0, pBeach: 0, occBeach: 0, occShop: 0 };
  this.min.push(this.cur);
  if (this.min.length > 720) this.min.shift();
  // demand follows the time of day: re-time the next arrivals at the new rates (arrivals have no memory)
  if (!this.fixedLambda && this.rng) {
    var l = arrivalsPerHour(this.visitors, this.t), self = this;
    if (Math.abs(l - this.lambda) > 1e-9) {
      this.lambda = l;
      this.nextSeek = this.t + expo(this.rng, l); this.nextBg = this.t + expo(this.rng, P.bgK * l);
      this.nextLot = this.t + expo(this.rng, this._lotRate());
      this.xw.forEach(function (x) { x.next = self.t + expo(self.rng, P.pedK * l * x.w); });
      for (var k in this.inter) this.inter[k].nextPh = this.t + expo(this.rng, P[this.inter[k].cross] * l);
    }
  }
};
Sim.prototype.setVisitors = function (v) { this.visitors = v; this.fixedLambda = null; };
Sim.prototype.setLambda = function (l) {
  this.lambda = l;
  this.nextSeek = Math.min(this.nextSeek, this.t + expo(this.rng, l));
  this.nextBg = Math.min(this.nextBg, this.t + expo(this.rng, P.bgK * l));
};
Sim.prototype._spawn = function (kind, d, tArr) {
  var rng = this.rng, viaM = rng() < P.viaMonterey;
  // a long line into the Village turns people away: drivers head for the lots, others go elsewhere
  var q = (viaM ? this.qAM : this.qAJ) || 0;
  if (kind === 'seek' && d.v * (q * P.balkSec / 3600) > P.balkFrac * advantage(d, this.price, this._lotFull())) {
    this.cur.toLot++; this.totals.lotFirst++; this.cur.balked++; this._divert(d);
    return;
  }
  if (kind !== 'seek' && rng() < Math.min(0.8, q / P.balkCars)) return;
  var c = { id: ++this.id, kind: kind, d: d, lane: viaM ? 'AM' : 'AJ', s: 0, st: kind === 'seek' ? 'loop' : 'drive', laps: 0, tArr: tArr, odo: 0, odoMark: 0,
    exit: null, route: null, searched: false, dropped: false, leaving: false };
  if (kind === 'seek') { c.adv = advantage(d, this.price, this._lotFull()); c.tsp = this.spaces[Math.floor(rng() * this.spaces.length)]; c.target = c.tsp.pos; c.grab = rng() < this._takeEarly(); }   // destinations spread like the spaces
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
  var LO = this.lot.out;
  while (LO.length && LO[0] <= t) LO.shift();
  while (this.nextLot <= t) { this._lotAdd(makeDriver(rng)); this.nextLot += expo(rng, this._lotRate()); }
  while (this.nextSeek <= t) {
    var d = makeDriver(rng); B.arr++;
    if (advantage(d, this.price, this._lotFull()) <= 0) {
      B.toLot++; this.totals.lotFirst++; this._divert(d);
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
  this.ringN = R.length; this.qAJ = lanes.AJ.length; this.qAM = lanes.AM.length;
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

  // 5. San Jose Ave (one-way south): park, then stop and merge onto the Esplanade.
  // Merges zipper: once a car on the main lane has gone by, the next one holds back for the waiting car.
  var MG = this.merge; MG.SJ.wait = MG.DG.wait = null;
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
      var waited = t - c.tStopSJ, sb = w.sjBot, capOK = R.length < P.ringCap * L / gap;
      if (capOK && waited >= P.stopDwell) MG.SJ.wait = c;
      var room = ringRoom(sb - P.carLen, sb + gap) && (MG.SJ.rPassed >= 1 || ringRoom(sb - 14, sb - P.carLen));
      if (waited >= P.stopDwell && capOK && room) {
        MG.SJ.wait = null; MG.SJ.rPassed = 0;
        c.lane = 'R'; c.s = sb; c.tStopSJ = null;
        if (c.tB != null) { B.bSum += t - c.tB; B.bN++; c.tB = null; }
        c.tEsp = t;
        R.push(c); R.sort(function (p, q) { return p.s - q.s; });
      }
    }
  }

  // cars already circling, waiting at the foot of San Jose, go before new cars enter the loop
  this.sjWaiting = 0;
  for (var m5 = 0; m5 < SJ.length; m5++) if (SJ[m5].lane === 'SJ' && SJ[m5].tStopSJ != null) this.sjWaiting++;

  // 5b. the angled leg on the west side of the triangle: park, then merge back where it meets the beach aisle
  var DG = lanes.DG, dgEnd = w.dgLen - 0.6, sm = w.sMontJoin;
  for (var m3 = DG.length - 1; m3 >= 0; m3--) {
    c = DG[m3];
    if (c.lane !== 'DG' || c.st === 'pin' || c.st === 'pout') continue;
    var lead4 = m3 + 1 < DG.length ? DG[m3 + 1].s : Infinity;
    var lim4 = Math.min(lead4 - gap, dgEnd);
    if (c.hoverSp) lim4 = this._hoverLimit(c, lim4, dt);
    var ns4 = Math.max(c.s, Math.min(c.s + P.vEsp * dt, lim4));
    this._afterMove(c, ns4, t);
    if (c.st === 'loop' && !c.leaving) ns4 = this._scan(c, 'DG', c.s, ns4, t);
    c.odo += ns4 - c.s; c.s = ns4;
    if ((c.st === 'loop' || c.st === 'drive') && c.s >= dgEnd - 0.6) {
      if (c.tStopDG == null) c.tStopDG = t;
      MG.DG.wait = c;
      if (ringRoom(sm - P.carLen, sm + gap) && (MG.DG.rPassed >= 1 || ringRoom(sm - 14, sm - P.carLen))) {
        MG.DG.wait = null; MG.DG.rPassed = 0;
        c.lane = 'R'; c.s = sm + 0.1; c.tStopDG = null;
        R.push(c); R.sort(function (p, q) { return p.s - q.s; });
      }
    }
  }

  // 6. the loop
  for (var gk0 in MG) { var g0 = MG[gk0]; g0.hold = !!g0.wait && g0.rPassed >= 1; }
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
    for (var gk in MG) {   // zipper: when it's the merging car's turn, stop just short of the merge point and let it in
      var g = MG[gk];
      if (g.hold && c.s <= g.s - P.carLen - 0.1 && c.s > g.s - 40) lim2 = Math.min(lim2, g.s - P.carLen - 0.1);
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
      var goDG = rng() < (seeking ? P.dgSeek : P.dgOther);
      if (seeking && c.laps === 0 && c.tsp && rng() < P.seeSide) {   // headed for one side of the triangle: take that side
        if (c.tsp.lane === 'DG') goDG = true;
        else if (c.tsp.lane === 'R' && c.tsp.s > w.espEnd && c.tsp.s < w.sMontJoin) goDG = false;
      }
      if (seeking && rng() < P.seeSide) {   // the triangle is small: a driver looking can see an open space on either side
        var openDG = this._openOn('DG', 0, w.dgLen), openAisle = this._openOn('R', w.espEnd, w.sMontJoin);
        if (openDG && !openAisle) goDG = true; else if (openAisle && !openDG) goDG = false;
      }
      if (!dropping && goDG) {
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
    // the San Jose Ave corner on Capitola Ave: decide where to go next, and wait to turn if San Jose is backed up
    if (c.s < w.sjTop && ns2 >= w.sjTop) {
      if (!c.atSJ) {
        c.atSJ = true; c.sjWait = 0;
        if (c.kind === 'seek' && c.st === 'loop' && !c.leaving) {
          if (c.searched) {
            c.laps++; B.cruiseM += c.odo + (ns2 - c.s) - c.odoMark; c.odoMark = c.odo + (ns2 - c.s); c.hovered = false;
            var searchedH = (t - c.tArr) / 3600;
            if (c.d.v * searchedH > c.adv || c.laps >= c.d.patience) { c.leaving = true; c.exit = 'J'; c.route = 'J'; }
            else c.route = rng() < P.sjShare ? 'SJ' : 'J';
          } else c.route = rng() < P.sjShareNew ? 'SJ' : 'J';
          if (!c.leaving && c.route === 'J' && rng() < P.seeSide && (this._openOn('SJ', 0, w.sjLen) || (c.laps === 0 && c.tsp && c.tsp.lane === 'SJ'))) c.route = 'SJ';   // an open space down San Jose, or headed there
        }
      }
      if (c.route === 'SJ') {
        var sjFree = true;
        for (k = 0; k < SJ.length; k++) if (SJ[k].lane === 'SJ' && SJ[k].s < gap) { sjFree = false; break; }
        if (sjFree) {
          c.odo += ns2 - c.s; c.lane = 'SJ'; c.s = ns2 - w.sjTop; c.granted = c.queued = null; c.route = null; c.atSJ = false;
          SJ.unshift(c);
          continue;
        }
        if (c.sjWait < P.sjWaitMax) { c.sjWait += dt; ns2 = w.sjTop - 0.05; }   // stopped in the lane, waiting to turn
        else c.route = 'J';
      }
      if (ns2 >= w.sjTop) c.atSJ = false;
    }
    // back at the Stockton corner
    if (ns2 >= L) {
      c.granted = c.queued = null;
      if (c.exit === 'J' || c.leaving) {
        c.st = 'gone';
        if (c.leaving) {
          var gone = rng() < P.leaveShare;
          if (gone) { B.left++; this.totals.left++; } else { B.toLot++; this.totals.diverted++; this._lotAdd(c.d); }
          if (this.visual) this.ghosts.push({ kind: gone ? 'left' : 'lot', path: 'spurOut', s: 0 });
        } else if (this.visual) this.ghosts.push({ kind: 'thru', path: 'spurOut', s: 0 });
        continue;
      }
      ns2 -= L;
    }
    if (c.granted && stopPassed(stops, c, ns2)) c.granted = c.queued = null;
    for (var gk2 in MG) if (c.s < MG[gk2].s && ns2 >= MG[gk2].s) MG[gk2].rPassed++;
    c.odo += ns2 - c.s; c.s = ns2;
  }

  // 7. maneuvers, loading, parked cars
  var occ = 0, circ = 0;
  for (i = 0; i < this.cars.length; i++) {
    c = this.cars[i];
    if (c.st === 'pin') {
      c.timer -= dt;
      if (c.timer <= 0) {
        c.st = 'parked'; c.tPark = t; c.tDep = t + c.d.T * 3600; c.paid = this.price; c.tEsp = c.tB = null; B.parked++; this.totals.parked++; B.searchSum += (t - c.tArr);
        if (c.d.type === 'shop' || c.d.type === 'dine') B.pShop++; else if (c.d.type === 'beach') B.pBeach++;
      }
    } else if (c.st === 'parked') {
      if (t - c.tPark < P.limitH * 3600) B.rev += c.paid * dt / 3600;
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
  var occB = 0, occS = 0;
  for (i = 0; i < this.spaces.length; i++) {
    var sc = this.spaces[i].car; if (!sc) continue;
    occ++; var ty = sc.d && sc.d.type;
    if (ty === 'beach') occB++; else if (ty === 'shop' || ty === 'dine') occS++;
  }
  B.occBeach += occB / this.spaces.length * dt; B.occShop += occS / this.spaces.length * dt;
  var keep = [];
  for (i = 0; i < this.cars.length; i++) if (this.cars[i].st !== 'gone') keep.push(this.cars[i]);
  this.cars = keep;
  B.occ += occ / this.spaces.length * dt; B.circ += circ * dt; B.n += dt; B.price = this.price;
  B.lotOcc += Math.min(1, LO.length / P.lotCap) * dt; if (this._lotFull()) B.lotFull += dt;
  B.waitIn += this.waitingIn * dt; B.mQ += this.inter.M.queue.length * dt;
  var stopped = 0;
  for (i = 0; i < this.cars.length; i++) {
    c = this.cars[i];
    if ((c.lane === 'R' || c.lane === 'SJ' || c.lane === 'DG') && c.st !== 'parked' && (c.st === 'load' || c.st === 'pin' || c.st === 'pout' || (c.v || 0) < 0.45)) stopped++;
  }
  this.stopShare = Math.min(1, stopped * P.gap / (w.loopLen + w.sjLen + w.dgLen));
  B.stopLen += this.stopShare * dt;
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
    if (f.lane === 'AM' && ringN + (this.sjWaiting || 0) >= P.ringCap * L / gap) return false;   // the loop is packed: wait on Monterey
    return ringRoom(w.exitS - 1, w.exitS + gap);
  }
  if (f.lane === 'R' && (f.exit === 'J' || f.leaving)) return true;      // leaving up Capitola Ave
  if (f.lane === 'AJ') return ringN + (this.sjWaiting || 0) < P.ringCap * L / gap && ringRoom(0, 2 * gap) && ringRoom(L - 1, L + 1);
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
  var el = t - (c._lastT || t - 1);
  c.v = 0.8 * (c.v || 0) + 0.2 * Math.max(0, ns - c.s) / Math.max(el, 0.001);   // smoothed speed, m/s
  if (ns - c.s < 0.02 && c.xwS != null && Math.abs(c.s - (c.xwS - 0.6)) < 1) c.xwT += t - (c._lastT || t);
  c._lastT = t;
  if (c.xwS != null && ns > c.xwS) c.xwS = null;
};
Sim.prototype._hoverLimit = function (c, lim, dt) {
  var hs = c.hoverSp;
  if (hs.lane !== c.lane || hs.s < c.s - 0.5) { hs.resv = null; c.hoverSp = null; return lim; }   // took another street, or already past it
  if (!hs.car) return Math.min(lim, hs.s);
  c.hoverT = (c.hoverT || 0) + dt;
  if (c.hoverT > P.hoverMax) { hs.resv = null; c.hoverSp = null; return lim; }
  return Math.min(lim, Math.max(c.s, hs.s - 6));
};
// on a quiet loop drivers hold out for a space near where they're going; on a busy one they take the first they see
Sim.prototype._takeEarly = function () {
  var occ = this.occNow / this.spaces.length, f = (occ - P.choosyFull) / (P.grabFull - P.choosyFull);
  return P.takeEarly + (1 - P.takeEarly) * Math.max(0, Math.min(1, f));
};
// is there an open, unclaimed space on this lane between a and b?
Sim.prototype._openOn = function (lane, a, b) {
  var arr = this.spBy[lane];
  for (var j = 0; j < arr.length; j++) if (arr[j].s >= a && arr[j].s <= b && !arr[j].car && !arr[j].resv) return true;
  return false;
};
// look for an open space passed this step, or stop to wait for someone about to leave
Sim.prototype._scan = function (c, lane, a, b, t) {
  var arr = this.spBy[lane], sArr = this.spS[lane], hoverCand = null;
  for (var j = lowerBound(sArr, a - 0.001); j < arr.length && arr[j].s <= b; j++) {
    var sp = arr[j];
    if (!sp.car && (!sp.resv || sp.resv === c)) {
      if (c.laps === 0 && sp.resv !== c && !c.grab && sp.pos < (c.target || 0) - P.nearWin) continue;   // holding out for one closer
      if (c.hoverSp && c.hoverSp !== sp) c.hoverSp.resv = null;
      sp.car = c; sp.resv = null; c.sp = sp; c.hoverSp = null; c.st = 'pin'; c.timer = P.maneuver;
      return sp.s;
    }
    if (!hoverCand && !c.hoverSp && !c.hovered && sp.car && sp.car.st === 'parked' && !sp.resv && sp.car.tDep - t < P.hoverSec &&
        (c.laps > 0 || c.grab || sp.pos >= (c.target || 0) - P.nearWin)) hoverCand = sp;
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
  var o = { occ: 0, circ: 0, n: 0, parked: 0, searchSum: 0, toLot: 0, left: 0, rev: 0, lotRev: 0, cruiseM: 0, departs: 0, arr: 0, aSum: 0, aN: 0, bSum: 0, bN: 0, drops: 0, waitIn: 0, mQ: 0, stopLen: 0, balked: 0, lotOcc: 0, far: 0, lotFull: 0, pShop: 0, pBeach: 0, occBeach: 0, occShop: 0 };
  for (var i = 0; i < arr.length; i++) for (var k in o) o[k] += arr[i][k];
  var hrs = arr.length / 60, segA = o.aN ? o.aSum / o.aN / 60 : 0, segB = o.bN ? o.bSum / o.bN / 60 : 0;
  return {
    occ: o.n ? o.occ / o.n : 0, circ: o.n ? o.circ / o.n : 0,
    search: o.parked ? o.searchSum / o.parked / 60 : 0,
    espToStop: segA, back: segB, trip: segA + segB, tripN: o.aN,
    toLot: o.toLot / hrs, left: o.left / hrs, rev: o.rev / hrs, lotRev: o.lotRev / hrs,
    cruiseMi: o.cruiseM / 1609.34 / hrs, turnover: o.departs / hrs / this.spaces.length,
    arr: o.arr / hrs, parked: o.parked / hrs, drops: o.drops / hrs,
    waitIn: o.n ? o.waitIn / o.n : 0, mQ: o.n ? o.mQ / o.n : 0, standstill: o.n ? o.stopLen / o.n : 0, balked: o.balked / hrs,
    lotOcc: o.n ? o.lotOcc / o.n : 0, lotFull: o.n ? o.lotFull / o.n : 0, far: o.far / hrs,
    shopDine: o.pShop / hrs, beachIn: o.pBeach / hrs, beachHeld: o.n ? o.occBeach / o.n : 0, shopHeld: o.n ? o.occShop / o.n : 0
  };
};
Sim.prototype.warm = function (minutes) { for (var i = 0; i < minutes * 60; i++) this.step(1); };
// a whole day from 8 AM; measure the window from fromMin to toMin minutes after 8 AM
function runDay(world, price, visitors, seed, fromMin, toMin) {
  var sim = new Sim(world, { seed: seed, price: price, visitors: visitors, prefill: 0.15 });
  for (var i = 0; i < toMin * 60; i++) sim.step(1);
  return sim.windowStats(toMin - fromMin);
}
function runHeadless(world, price, lambda, seed, warmMin, measureMin) {
  var sim = new Sim(world, { seed: seed, price: price, lambda: lambda, prefill: true });
  for (var i = 0; i < (warmMin + measureMin) * 60; i++) sim.step(1);
  return sim.windowStats(measureMin);
}
if (typeof module !== 'undefined') module.exports = { P: P, Sim: Sim, makeDriver: makeDriver, makeRng: makeRng, runHeadless: runHeadless, runDay: runDay, tryShare: tryShare, advantage: advantage, arrivalsPerHour: arrivalsPerHour };
