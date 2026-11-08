// Bake the rate sweeps for the page presets and the one-pager: whole days from 8 AM, the 1-3 PM window,
// several seeds per rate (argv[3], default 2), rates $1 to $12. Merges into sweeps.json, or into argv[4] if given
// (bake crowds in parallel into separate files, then `node bake.js merge a.json b.json ...`).
const fs = require('fs');
if (process.argv[2] === 'merge') {
  const out = fs.existsSync('sweeps.json') ? JSON.parse(fs.readFileSync('sweeps.json', 'utf8')) : {};
  for (const f of process.argv.slice(3)) Object.assign(out, JSON.parse(fs.readFileSync(f, 'utf8')));
  fs.writeFileSync('sweeps.json', JSON.stringify(out));
  console.error('merged', Object.keys(out).join(','));
  process.exit(0);
}
const E = require('./engine.js'), Wd = require('./world.js');
const w = Wd.buildWorld(require('./osm/paths.json'));
const file = process.argv[4] || 'sweeps.json';
const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
const SEEDS = [11, 23, 37, 53, 71, 89].slice(0, +(process.argv[3] || 2));
const FIELDS = ['occ', 'trip', 'circ', 'standstill', 'left', 'rev', 'search', 'cruiseMi', 'lotOcc', 'lotFull', 'far', 'toLot'];
for (const v of (process.argv[2] || '1500,4500,6000,7500,9000').split(',').map(Number)) {
  const rows = [];
  for (let p = 1; p <= 12.001; p += 0.5) {
    const runs = SEEDS.map(sd => E.runDay(w, p, v, sd, 300, 420)), r = { p };
    FIELDS.forEach(f => { r[f] = +((runs.reduce((a, x) => a + x[f], 0) / runs.length).toFixed(['occ', 'standstill', 'lotOcc', 'lotFull'].includes(f) ? 3 : 1)); });
    rows.push(r);
  }
  out[v] = rows;
  console.error(v, 'done');
}
fs.writeFileSync(file, JSON.stringify(out));
