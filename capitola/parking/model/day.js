// whole-day runs: results for the 1-3 PM window
const E = require('./engine.js'), Wd = require('./world.js');
const w = Wd.buildWorld(require('./osm/paths.json'));
const over = JSON.parse(process.argv[2] || '{}'); Object.assign(E.P, over);
const vis = (process.argv[3] || '9000').split(',').map(Number);
const prices = (process.argv[4] || '2,4,5,6').split(',').map(Number);
const seeds = (process.argv[5] || '11').split(',').map(Number);
console.log(JSON.stringify(over));
for (const v of vis) for (const p of prices) {
  const t0 = Date.now(), acc = {}, fs = ['occ', 'trip', 'standstill', 'circ', 'left', 'rev', 'mQ', 'waitIn', 'search', 'cruiseMi', 'balked'];
  for (const sd of seeds) { const r = E.runDay(w, p, v, sd, 300, 420); fs.forEach(f => acc[f] = (acc[f] || 0) + r[f] / seeds.length); }
  console.log(v + ' visitors $' + p.toFixed(2) + ': occ ' + (acc.occ * 100).toFixed(0) + '% trip ' + acc.trip.toFixed(1) + 'm standstill ' + (acc.standstill * 100).toFixed(0) + '% circ ' + acc.circ.toFixed(1) +
    ' left ' + acc.left.toFixed(1) + '/h rev $' + acc.rev.toFixed(0) + ' Mq ' + acc.mQ.toFixed(1) + ' waitIn ' + acc.waitIn.toFixed(0) + ' search ' + acc.search.toFixed(1) + ' balked ' + acc.balked.toFixed(0) + '/h [' + (Date.now() - t0) + 'ms]');
}
