// Where are the open spaces? Share of each street's spaces open at 1-3 PM on a whole-day run.
// node openwhere.js 9000 6.5 '{"param":value}' [seeds]
const E = require('./engine.js'), Wd = require('./world.js');
const w = Wd.buildWorld(require('./osm/paths.json'));
const vis = +(process.argv[2] || 9000), price = +(process.argv[3] || 6.5);
Object.assign(E.P, JSON.parse(process.argv[4] || '{}'));
const seeds = (process.argv[5] || '11,23').split(',').map(Number);
function street(sp) {
  if (sp.lane === 'SJ') return 'San Jose';
  if (sp.lane === 'DG') return 'angled leg';
  if (sp.s < (w.espS0 + w.sjBot) / 2) return 'Esp west';
  if (sp.s < w.espEnd) return 'Esp east';
  if (sp.s < w.sMontJoin) return 'triangle';
  return 'Monterey';
}
const open = {}, n = {}, byType = {};
for (const seed of seeds) {
  const sim = new E.Sim(w, { seed, price, visitors: vis, prefill: 0.15 });
  for (let t = 1; t <= 7 * 3600; t++) {
    sim.step(1);
    if (t < 5 * 3600 || t % 20) continue;
    for (const sp of sim.spaces) {
      const k = street(sp); n[k] = (n[k] || 0) + 1; if (!sp.car) open[k] = (open[k] || 0) + 1;
      else if (sp.car.d) { const b = byType[k] = byType[k] || {}; b[sp.car.d.type] = (b[sp.car.d.type] || 0) + 1; }
    }
  }
}
console.log(`${vis} visitors, $${price}: share of each street's spaces open, 1-3 PM (and who holds the rest)`);
let tot = 0, totN = 0;
for (const k of ['Esp west', 'Esp east', 'San Jose', 'triangle', 'angled leg', 'Monterey']) {
  tot += open[k] || 0; totN += n[k];
  const b = byType[k] || {}, held = Object.values(b).reduce((a, x) => a + x, 0) || 1;
  console.log('  ' + k.padEnd(11) + (((open[k] || 0) / n[k]) * 100).toFixed(0).padStart(4) + '% open   beach ' + ((b.beach || 0) / held * 100).toFixed(0) + '%, shops/meals ' + (((b.shop || 0) + (b.dine || 0)) / held * 100).toFixed(0) + '%');
}
console.log('  all        ' + (tot / totN * 100).toFixed(0).padStart(4) + '% open');
