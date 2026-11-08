// where does the time go? per-segment car-seconds and the queue behind the Monterey stop
const E = require('./engine.js'), Wd = require('./world.js');
const w = Wd.buildWorld(require('./osm/paths.json'));
Object.assign(E.P, JSON.parse(process.argv[2] || '{}'));
const prices = (process.argv[3] || '2,5').split(',').map(Number), lam = +(process.argv[4] || 135);
const segs = [['Stk', 0, w.espS0], ['curve', w.espS0, w.sjBot], ['beach', w.sjBot, w.espEnd], ['aisle', w.espEnd, w.sMontJoin], ['Mont', w.sMontJoin, w.exitS], ['Cap>SJ', w.exitS, w.sjTop], ['Cap>J', w.sjTop, w.loopLen + 1]];
for (const price of prices) {
  const res = [];
  for (const seed of [11, 23]) {
    const sim = new E.Sim(w, { seed, price, lambda: lam, prefill: true });
    const acc = {}; let qSum = 0, qN = 0, qMax = 0;
    for (let i = 0; i < 210 * 60; i++) {
      sim.step(1);
      if (i < 60 * 60) continue;
      for (const c of sim.cars) {
        if (c.st === 'parked' || c.st === 'pin' || c.st === 'pout') continue;
        let seg = c.lane;
        if (c.lane === 'R') seg = (segs.find(s => c.s >= s[1] && c.s < s[2]) || ['?'])[0];
        acc[seg] = (acc[seg] || 0) + 1;
      }
      if (i % 30 === 0) {
        const R = sim.cars.filter(c => c.lane === 'R' && !['parked', 'pin', 'pout', 'gone'].includes(c.st) && c.s <= w.exitS).sort((a, b) => b.s - a.s);
        let q = 0, lastS = w.exitS;
        for (const c of R) { if (lastS - c.s < 9.5) { q++; lastS = c.s; } else break; }
        qSum += q; qN++; qMax = Math.max(qMax, q);
      }
    }
    const ws = sim.windowStats(150);
    res.push({ acc, q: qSum / qN, qMax, trip: ws.trip, a: ws.espToStop, b: ws.back, circ: ws.circ, occ: ws.occ, rev: ws.rev, left: ws.left });
  }
  const avgAcc = {}; res.forEach(r => { for (const k in r.acc) avgAcc[k] = (avgAcc[k] || 0) + r.acc[k] / 150 / 60 / res.length; });
  const m = f => (res.reduce((s, r) => s + r[f], 0) / res.length);
  console.log('$' + price.toFixed(2), 'trip', m('trip').toFixed(1), '(esp>stop', m('a').toFixed(1), 'back', m('b').toFixed(1) + ')', 'queue behind M avg', m('q').toFixed(1), 'max', Math.max(...res.map(r => r.qMax)),
    'occ', (m('occ') * 100).toFixed(0) + '%', 'circ', m('circ').toFixed(1), 'left', m('left').toFixed(1), 'rev $' + m('rev').toFixed(0));
  console.log('   avg cars on each segment:', Object.entries(avgAcc).map(([k, v]) => k + ' ' + v.toFixed(1)).join(', '));
}
