const E = require('./engine.js'), Wd = require('./world.js');
const w = Wd.buildWorld(require('./osm/paths.json'));
const over = JSON.parse(process.argv[2] || '{}'); Object.assign(E.P, over);
const lams = (process.argv[3] || '60,135').split(',').map(Number);
const prices = (process.argv[4] || '2,3,4,5,6').split(',').map(Number);
const seeds = (process.argv[5] || '11,23').split(',').map(Number);
const cnt = {}; w.spaces.forEach(s => { const k = s.lane + ':' + s.type; cnt[k] = (cnt[k] || 0) + 1; });
console.log('spaces', w.spaces.length, JSON.stringify(cnt), 'sjTop', w.sjTop.toFixed(0), 'sjBot', w.sjBot.toFixed(0), 'sjLen', w.sjLen.toFixed(0), 'amLen', w.amLen.toFixed(0), JSON.stringify(over));
for (const lam of lams) {
  console.log('lambda=' + lam);
  for (const p of prices) {
    const acc = {}; const fs = ['occ', 'trip', 'espToStop', 'back', 'waitIn', 'mQ', 'circ', 'search', 'cruiseMi', 'left', 'rev', 'parked', 'tripN'];
    const t0 = Date.now();
    for (const sd of seeds) { const r = E.runHeadless(w, p, lam, sd, 60, 150); fs.forEach(f => acc[f] = (acc[f] || 0) + r[f] / seeds.length); }
    console.log('$' + p.toFixed(2) + ' occ ' + (acc.occ * 100).toFixed(0) + '% TRIP ' + acc.trip.toFixed(1) + ' (esp>stop ' + acc.espToStop.toFixed(1) + ' back ' + acc.back.toFixed(1) + ' n' + acc.tripN.toFixed(0) + ') waitIn ' + acc.waitIn.toFixed(0) + ' Mq ' + acc.mQ.toFixed(1) +
      ' circ ' + acc.circ.toFixed(1) + ' search ' + acc.search.toFixed(1) + ' cruise ' + acc.cruiseMi.toFixed(1) + ' left ' + acc.left.toFixed(1) + ' rev $' + acc.rev.toFixed(0) + ' parked ' + acc.parked.toFixed(0) + '  [' + (Date.now() - t0) + 'ms]');
  }
}
