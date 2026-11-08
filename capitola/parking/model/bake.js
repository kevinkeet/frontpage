// Bake the rate sweeps for the page presets and the one-pager: whole days from 8 AM, the 1-3 PM window,
// several seeds per rate (argv[3], default 2). Merges into sweeps.json.
const E = require('./engine.js'), Wd = require('./world.js'), fs = require('fs');
const w = Wd.buildWorld(require('./osm/paths.json'));
const out = fs.existsSync('sweeps.json') ? JSON.parse(fs.readFileSync('sweeps.json', 'utf8')) : {};
const SEEDS = [11, 23, 37, 53, 71, 89].slice(0, +(process.argv[3] || 2));
for (const v of (process.argv[2] || '1500,4500,6000,7500,9000').split(',').map(Number)) {
  const rows = [];
  for (let p = 1; p <= 8.001; p += 0.5) {
    const runs = SEEDS.map(sd => E.runDay(w, p, v, sd, 300, 420)), r = { p };
    ['occ', 'trip', 'circ', 'standstill', 'left', 'rev', 'search', 'cruiseMi'].forEach(f => { r[f] = +((runs.reduce((a, x) => a + x[f], 0) / runs.length).toFixed(f === 'occ' || f === 'standstill' ? 3 : 1)); });
    rows.push(r);
  }
  out[v] = rows;
  console.error(v, 'done');
}
fs.writeFileSync('sweeps.json', JSON.stringify(out));
