// Find walk and gear values that give a price response near SFpark's -0.4 between $2 and $4.
const E = require('./engine.js');
function rn(rng) { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); }
function mk(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const base = Object.assign({}, E.P);
const arc = (q1, q2, p1, p2) => ((q2 - q1) / ((q1 + q2) / 2)) / ((p2 - p1) / ((p1 + p2) / 2));
for (const o of JSON.parse(process.argv[2] || '[{}]')) {
  Object.assign(E.P, base, o);
  const P = E.P, r = mk(7), pop = [];
  for (let i = 0; i < 20000; i++) { const T = P.stayMed * Math.exp(P.staySig * rn(r)), v = P.votMed * Math.exp(P.votSig * rn(r)), g = -P.gearMean * Math.log(1 - r()); pop.push({ T, v, walk: v * (2 * P.walkMin / 60) + g }); }
  const sh = p => pop.filter(d => E.advantage(d, p) > 0).length / pop.length;
  const s = [1, 2, 3, 4, 5, 6].map(sh);
  console.log(JSON.stringify(o), 'shares', s.map(x => x.toFixed(2)).join(' '), '| e 2->4', arc(s[1], s[3], 2, 4).toFixed(2), ' 2->3', arc(s[1], s[2], 2, 3).toFixed(2), ' 3->5', arc(s[2], s[4], 3, 5).toFixed(2));
}
