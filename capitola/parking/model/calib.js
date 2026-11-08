// Drivers' price response: the share who try the loop at each rate, and arc elasticities.
// node calib.js '[{"param":value}, ...]'. SFpark (Pierce and Shoup 2013) averaged about -0.4.
const E = require('./engine.js');
const base = Object.assign({}, E.P);
const arc = (q1, q2, p1, p2) => ((q2 - q1) / ((q1 + q2) / 2)) / ((p2 - p1) / ((p1 + p2) / 2));
for (const o of JSON.parse(process.argv[2] || '[{}]')) {
  Object.assign(E.P, base, o);
  const r = E.makeRng(7), pop = [];
  for (let i = 0; i < 20000; i++) pop.push(E.makeDriver(r));
  for (const full of [false, true]) {
    const sh = p => pop.filter(d => E.advantage(d, p, full) > 0).length / pop.length;
    const ps = [1, 2, 3, 4, 5, 6, 8, 10], s = ps.map(sh);
    console.log(JSON.stringify(o), full ? 'lots full ' : 'lots open ', ps.map((p, i) => '$' + p + ' ' + (s[i] * 100).toFixed(0) + '%').join('  '),
      '| e 2->4', arc(s[1], s[3], 2, 4).toFixed(2), ' 4->8', arc(s[3], s[6], 4, 8).toFixed(2));
  }
}
