// Do drivers who miss a space really keep circulating, and how much traffic do they add?
const E = require('./engine.js'), Wd = require('./world.js');
const w = Wd.buildWorld(require('./osm/paths.json'));
const base = Object.assign({}, E.P);
const price = +(process.argv[2] || 2), lam = +(process.argv[3] || 135);

function run(seed, over) {
  Object.assign(E.P, base, over || {});
  const sim = new E.Sim(w, { seed, price, lambda: lam, prefill: true });
  const prev = new Map();           // id -> {lane, s, kind, st, laps, leaving}
  const seekers = new Map();        // id -> journey record
  const mPass = { firstPass: 0, circling: 0, leavingAfterMiss: 0, departingParked: 0, through: 0, dropoff: 0 };
  const lanesVisited = { R: 0, SJ: 0, DG: 0 };
  let circSamples = 0, circSum = 0, missedNotCounted = 0;
  const T0 = 60 * 60, T1 = 210 * 60;
  for (let i = 0; i < T1; i++) {
    sim.step(1);
    const now = new Map();
    for (const c of sim.cars) {
      now.set(c.id, c);
      if (c.kind === 'seek' && c.tArr >= T0 && !seekers.has(c.id)) seekers.set(c.id, { laps: 0, parked: false, gaveUp: false, sj: false, dg: false, tArr: c.tArr });
      const r = seekers.get(c.id);
      if (r) {
        r.laps = Math.max(r.laps, c.laps);
        if (c.lane === 'SJ' && c.laps >= 1) r.sj = true;
        if (c.lane === 'DG') r.dg = true;
        if (c.st === 'pin' || c.st === 'parked') r.parked = true;
        if (c.leaving) r.gaveUp = true;
      }
    }
    if (i >= T0) {
      // who crossed the Monterey stop line this second?
      for (const [id, p] of prev) {
        if (p.lane !== 'R' || p.s >= w.exitS || p.s < w.exitS - 12) continue;
        const c = now.get(id);
        const crossed = !c ? true : (c.lane === 'R' && (c.s >= w.exitS || c.s < p.s - 100));
        if (!crossed) continue;
        if (p.kind === 'seek' && p.st === 'loop') {
          if (p.leaving) mPass.leavingAfterMiss++; else if (p.laps >= 1) mPass.circling++; else mPass.firstPass++;
        } else if (p.kind === 'out') mPass.departingParked++;
        else if (p.kind === 'drop') mPass.dropoff++;
        else mPass.through++;
      }
      circSum += sim.circNow; circSamples++;
      // seekers who have missed (passed the stop without parking) but aren't counted as circling yet
      for (const c of sim.cars) if (c.kind === 'seek' && c.st === 'loop' && c.searched && c.laps === 0 && !c.leaving) missedNotCounted++;
    }
    prev.clear();
    for (const c of sim.cars) if (c.st !== 'parked') prev.set(c.id, { lane: c.lane, s: c.s, kind: c.kind, st: c.st, laps: c.laps, leaving: c.leaving });
  }
  const ws = sim.windowStats(150);
  return { ws, mPass, seekers: [...seekers.values()], circAvg: circSum / circSamples, missedNotCounted: missedNotCounted / circSamples };
}

function summarize(label, over) {
  const rs = [11, 23].map(s => run(s, over));
  const m = f => rs.reduce((a, r) => a + f(r), 0) / rs.length;
  console.log('\n=== ' + label + '  ($' + price.toFixed(2) + ', ' + lam + ' drivers/hr)');
  console.log('trip around ' + m(r => r.ws.trip).toFixed(1) + ' min (Esplanade→through Monterey stop ' + m(r => r.ws.espToStop).toFixed(1) + ', back onto Esplanade ' + m(r => r.ws.back).toFixed(1) + ')  occupancy ' + (m(r => r.ws.occ) * 100).toFixed(0) + '%  extra driving ' + m(r => r.ws.cruiseMi).toFixed(1) + ' mi/hr');
  console.log('cars circling (laps≥1) on average ' + m(r => r.circAvg).toFixed(1) + '; plus missed-but-not-yet-counted ' + m(r => r.missedNotCounted).toFixed(1));
  const mp = {}; Object.keys(rs[0].mPass).forEach(k => mp[k] = m(r => r.mPass[k]) / 2.5);
  const tot = Object.values(mp).reduce((a, b) => a + b, 0);
  console.log('Monterey stop, vehicles/hr from the loop: ' + Object.entries(mp).map(([k, v]) => k + ' ' + v.toFixed(0) + ' (' + (v / tot * 100).toFixed(0) + '%)').join(', ') + ' | total ' + tot.toFixed(0));
  const all = rs.flatMap(r => r.seekers).filter(s => s.parked || s.gaveUp);
  const missed = all.filter(s => s.laps >= 1);
  const byLaps = {}; missed.forEach(s => { const k = Math.min(s.laps, 5); byLaps[k] = (byLaps[k] || 0) + 1; });
  console.log('seekers finished: ' + all.length + '; parked first pass ' + all.filter(s => s.parked && s.laps === 0).length + '; missed at least once ' + missed.length +
    ' → of those parked later ' + missed.filter(s => s.parked).length + ', gave up ' + missed.filter(s => s.gaveUp).length +
    '; laps among those who missed ' + JSON.stringify(byLaps) + '; used San Jose on a later lap ' + missed.filter(s => s.sj).length);
}

summarize('as modeled: drivers who miss keep circling');
summarize('counterfactual: drivers who miss give up after one pass', { patienceMin: 0, patienceMax: 0 });
