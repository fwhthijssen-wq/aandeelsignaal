// Eenmalige telling: hoeveel fondsen krijgen een (compleet) NAIC-oordeel, nu en als alle gegevens bevestigd waren.
global.self = global;
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('web/data/aandelen.json', 'utf8'));
const Gate = require('../web/js/gate.js'), Naic = require('../web/js/naic.js'), Signaal = require('../web/js/signaal.js');
const vandaag = new Date().toISOString().slice(0, 10);
function tel(r) {
  const b = Signaal.beoordeel(r, { vandaag, gate: Gate, naic: Naic }), n = b.naic;
  if (!n || !n.oordeel) return { s: 0, reden: n ? n.reden : 'geen NAIC-uitkomst', oordeel: null };
  const l = Naic.ladder(n) || [];
  return { s: l.every(s => s.ok !== null) ? 2 : 1, oordeel: n.oordeel, open: l.filter(s => s.ok === null).map(s => s.naam) };
}
const L = D.aandelen, T = { nu: 0, nuVol: 0, als: 0, alsVol: 0 }, redenen = {}, open = {}, oordelen = {}, vol = [], deels = [];
for (const r of L) {
  const a = tel(r); if (a.s) T.nu++; if (a.s === 2) T.nuVol++;
  const g = r.gegevens && !r.gegevens.fout ? Object.assign({}, r.gegevens, { eps_status: 'independently_verified', eps_verified_years: 10, rejected_sources: 0 }) : r.gegevens;
  const x = tel(Object.assign({}, r, { gegevens: g }));
  if (x.s) { T.als++; oordelen[x.oordeel] = (oordelen[x.oordeel] || 0) + 1; }
  if (x.s === 2) { T.alsVol++; vol.push(r.ticker); }
  else if (x.s === 1) { deels.push(r.ticker); x.open.forEach(o => open[o] = (open[o] || 0) + 1); }
  else { const k = String(x.reden || '?').replace(/\d{4}/g, 'JJJJ').replace(/-?\d+[,.]?\d*%/g, 'N%').slice(0, 90); redenen[k] = (redenen[k] || 0) + 1; }
}
const srt = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => v + 'x ' + k).join(' | ');
const out = [
  ['Telling', `${L.length} fondsen (gemaakt ${D.gemaakt}), datum ${vandaag}. NU: oordeel ${T.nu}, compleet ${T.nuVol}. ALS ALLES BEVESTIGD: oordeel ${T.als}, compleet (alle 5 stappen bekend) ${T.alsVol}. Oordelen: ${JSON.stringify(oordelen)}`],
  ['Compleet', vol.join(' ')],
  ['Deels', `${deels.length}: ${deels.join(' ')} | open stappen: ${srt(open)}`],
  ['Geen oordeel', srt(redenen)]
];
for (const [t, m] of out) { console.log(t + ': ' + m); console.log(`::notice title=${t}::${m.replace(/\n/g, ' ')}`); }
