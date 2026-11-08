// The model next to the city's 2008 parking study (counts on Saturday Aug 18, 2007, 11 AM to 5 PM).
// node study.js [visitors] [rate] [seeds] ['{"param":value}']
const E = require('./engine.js'), Wd = require('./world.js');
const w = Wd.buildWorld(require('./osm/paths.json'));
const vis = +(process.argv[2] || 9000), price = +(process.argv[3] || 2);
const seeds = (process.argv[4] || '11,23').split(',').map(Number);
Object.assign(E.P, JSON.parse(process.argv[5] || '{}'));
const H = h => (h - 8) * 3600;   // seconds after 8 AM

function one(seed) {
  const sim = new E.Sim(w, { seed, price, visitors: vis, prefill: 0.15 });
  const seen = new Map();   // car id -> { first, last, tPark, tDep } while parked on the loop, 11 to 5
  let occS = 0, occN = 0, occMax = 0, lotS = 0, lotMax = 0, lotFullAt = null, dgWait = [], sjWait = [];
  let dgMax = 0, sjMax = 0, pm = null, dgQ = 0, sjQ = 0, fullH = 0, espN = 0, firstFull = null, lastFull = null;
  const prevS = new Map(), CUT = 200;
  for (let t = 1; t <= H(20); t++) {
    sim.step(1);
    if (sim._lotFull()) { fullH += 1 / 3600; if (firstFull == null) firstFull = 8 + t / 3600; lastFull = 8 + t / 3600; }
    for (const c of sim.cars) { if (c.lane === 'R') { const q = prevS.get(c.id); if (q != null && q < CUT && c.s >= CUT) espN++; prevS.set(c.id, c.s); } else prevS.delete(c.id); }
    if (t > H(17)) continue;
    if (lotFullAt == null && sim._lotFull()) lotFullAt = 8 + t / 3600;
    if (t === H(15)) pm = sim.windowStats(120);
    if (t < H(11) || t % 10) continue;
    const o = sim.occNow / sim.spaces.length, l = sim.lot.out.length / E.P.lotCap;
    occS += o; occN++; occMax = Math.max(occMax, o); lotS += l; lotMax = Math.max(lotMax, l);
    for (const sp of sim.spaces) {
      const c = sp.car; if (!c || c.st !== 'parked') continue;
      const r = seen.get(c.id); if (r) r.last = t; else seen.set(c.id, { first: t, last: t, tPark: c.tPark, tDep: c.tDep });
    }
    for (const c of sim.cars) {
      if (c.lane === 'DG' && c.tStopDG != null) { dgMax = Math.max(dgMax, t - c.tStopDG); dgQ++; }
      if (c.lane === 'SJ' && c.tStopSJ != null) { sjMax = Math.max(sjMax, t - c.tStopSJ); sjQ++; }
    }
  }
  const recs = [...seen.values()];
  const inWin = recs.reduce((a, r) => a + (r.last - r.first + 10), 0) / recs.length / 3600;
  const full = recs.filter(r => r.tPark > 0).map(r => (r.tDep - r.tPark) / 3600);
  return {
    occ: occS / occN, occMax, lot: lotS / occN, lotMax, lotFullAt, fullH, espN, firstFull: firstFull || 0, lastFull: lastFull || 0,
    perSpace: recs.length / sim.spaces.length, stayWin: inWin, stayFull: full.reduce((a, b) => a + b, 0) / full.length,
    dgQ: dgQ / occN, sjQ: sjQ / occN, shopDine: pm.shopDine, beachIn: pm.beachIn, beachHeld: pm.beachHeld, shopHeld: pm.shopHeld, trip: pm.trip, standstill: pm.standstill, circ: pm.circ, far: pm.far, left: pm.left, toLot: pm.toLot, dgMax, sjMax,
    skips: sim.skips || 0
  };
}
const rs = seeds.map(one), avg = k => rs.reduce((a, r) => a + (r[k] || 0), 0) / rs.length;
const pct = x => (x * 100).toFixed(0) + '%';
console.log(`${vis} visitors, $${price}/hr  (${seeds.length} runs)`);
console.log(`  loop full 11-5: ${pct(avg('occ'))} avg, ${pct(avg('occMax'))} max   [study, Village: 99% / 99%]`);
console.log(`  lots full 11-5: ${pct(avg('lot'))} avg, ${pct(avg('lotMax'))} max, first full ${avg('lotFullAt').toFixed(1)}h   [study, Pacific Cove: 84% / 100%]`);
console.log(`  lots full ${avg('fullH').toFixed(1)} h of the day (first ${avg('firstFull').toFixed(1)}h, last ${avg('lastFull').toFixed(1)}h); Esplanade vehicles 8 AM-8 PM: ${avg('espN').toFixed(0)}   [city 2022: lots fill a few hours on ~25 days a year; RTC July 2007: 3,055 a day]`);
console.log(`  cars per loop space 11-5: ${avg('perSpace').toFixed(2)}   [study: 1.63]`);
console.log(`  average stay seen 11-5: ${avg('stayWin').toFixed(2)} h; whole stays ${avg('stayFull').toFixed(2)} h   [study: 2.75 h on street, 3.3 h in the lot, visits 3.4 h]`);
console.log(`  1-3 PM: trip ${avg('trip').toFixed(1)} min, ${pct(avg('standstill'))} stopped, ${avg('circ').toFixed(1)} circling, ${avg('toLot').toFixed(0)}/hr to lots or farther (${avg('far').toFixed(0)}/hr farther), ${avg('left').toFixed(1)}/hr leave`);
console.log(`  1-3 PM: shoppers & diners parked ${avg('shopDine').toFixed(0)}/hr, beachgoers ${avg('beachIn').toFixed(0)}/hr; spaces held by beachgoers ${pct(avg('beachHeld'))}, by shoppers & diners ${pct(avg('shopHeld'))}`);
console.log(`  merges: longest wait angled leg ${avg('dgMax').toFixed(0)} s, San Jose ${avg('sjMax').toFixed(0)} s; cars waiting on average ${avg('dgQ').toFixed(2)} / ${avg('sjQ').toFixed(2)}`);
