// Where is traffic stopped at 1-3 PM on a whole-day run? Share of each street's length covered by stopped cars.
const E = require('./engine.js'), Wd = require('./world.js');
const w = Wd.buildWorld(require('./osm/paths.json'));
Object.assign(E.P, JSON.parse(process.argv[2] || '{}'));
const price = +(process.argv[3] || 2), vis = +(process.argv[4] || 9000);
const segs = [['Stockton', 0, w.espS0], ['Esp curve', w.espS0, w.sjBot], ['Esp beach', w.sjBot, w.espEnd], ['aisle', w.espEnd, w.sMontJoin], ['Monterey', w.sMontJoin, w.exitS], ['CapAve>SJ', w.exitS, w.sjTop], ['CapAve>J', w.sjTop, w.loopLen + 1]];
const len = {}; segs.forEach(s => len[s[0]] = s[2] - s[1]); len.SJ = w.sjLen; len.DG = w.dgLen;
const sim = new E.Sim(w, { seed: 11, price, visitors: vis, prefill: 0.15 });
const acc = {}, mov = {}; let n = 0;
for (let i = 0; i < 420 * 60; i++) {
  sim.step(1);
  if (i < 300 * 60 || i % 10) continue;
  n++;
  for (const c of sim.cars) {
    if (!['R', 'SJ', 'DG'].includes(c.lane) || c.st === 'parked') continue;
    let seg = c.lane;
    if (c.lane === 'R') seg = (segs.find(s => c.s >= s[1] && c.s < s[2]) || ['?'])[0];
    const stopped = c.st === 'load' || c.st === 'pin' || c.st === 'pout' || (c.v || 0) < 0.45;
    if (stopped) acc[seg] = (acc[seg] || 0) + 1; else mov[seg] = (mov[seg] || 0) + 1;
  }
}
console.log('$' + price, vis + ' visitors, 1-3 PM: share of each street covered by stopped cars (moving cars per street)');
Object.keys(len).forEach(k => console.log('  ' + k.padEnd(10) + ((acc[k] || 0) / n * E.P.gap / len[k] * 100).toFixed(0).padStart(4) + '%   (' + ((mov[k] || 0) / n).toFixed(1) + ' moving)'));
const ws = sim.windowStats(120);
console.log('trip', ws.trip.toFixed(1), 'standstill', (ws.standstill * 100).toFixed(0) + '%', 'circ', ws.circ.toFixed(1), 'waitIn', ws.waitIn.toFixed(0));
