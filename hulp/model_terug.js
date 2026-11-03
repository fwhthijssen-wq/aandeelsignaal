/* Terugrekenen modelportefeuille, stap 2: speelt de modelportefeuille dag voor dag af met dezelfde regels als de echte
   (web/js/model.js). Gebruik: node hulp/model_terug.js uitmap  → uitmap/terug.json en uitmap/terug.md */
'use strict';
const fs = require('fs'), path = require('path');
const M = require(path.join(__dirname, '..', 'web', 'js', 'model.js'));
const { indexVan } = require(path.join(__dirname, '..', 'modelportefeuille.js'));
const map = process.argv[2];
const inv = JSON.parse(fs.readFileSync(path.join(map, 'model_invoer.json'), 'utf8'));

/* Laatste waarde op of vóór dag d in een gesorteerde reeks [[datum, waarde], ...] (met een wijzer die alleen vooruit loopt). */
function wijzer(reeks) {
  let i = -1;
  return (d) => { while (i + 1 < reeks.length && reeks[i + 1][0] <= d) i++; return i >= 0 ? reeks[i] : null; };
}

const peil = Object.keys(inv.signalen).sort();
const start = peil[0];
const tickers = Object.keys(inv.fondsen);
const kw = {}, ixw = {}, ixv = {};
tickers.forEach((t) => { kw[t] = wijzer(inv.fondsen[t].koersen); });
Object.keys(inv.indexen).forEach((c) => { ixw[c] = wijzer(inv.indexen[c]); ixv[c] = null; });
const fxReeks = Object.entries(inv.fx).sort((a, b) => (a[0] < b[0] ? -1 : 1)), fxw = wijzer(fxReeks);
const meta = {};
tickers.forEach((t) => { const f = inv.fondsen[t]; meta[t] = { naam: f.naam, valuta: f.valuta, index: indexVan({ ticker: t, indices: f.indices }), dividenden: f.dividenden, splitsingen: f.splitsingen }; });

// alle handelsdagen vanaf de eerste peildatum
const dagenSet = new Set();
tickers.forEach((t) => inv.fondsen[t].koersen.forEach((p) => { if (p[0] >= start) dagenSet.add(p[0]); }));
const handelsdagen = [...dagenSet].sort();
const peilSet = new Set(peil);
// een peildatum valt soms niet op een handelsdag: dan op de handelsdag ervoor
const signaalOp = {};
peil.forEach((T) => { const d = handelsdagen.filter((x) => x <= T).pop(); if (d) signaalOp[d] = T; });

const staat = M.nieuw(start);
for (const d of handelsdagen) {
  const T = signaalOp[d], sig = T ? inv.signalen[T] : null, fondsen = {};
  for (const t of tickers) {
    const k = kw[t](d);
    if (!k) continue;                                       // nog niet genoteerd
    const f = Object.assign({ koers: k[1], koersDatum: k[0] }, meta[t]);
    if (sig && sig[t]) Object.assign(f, { oordeel: sig[t].oordeel, zone: sig[t].zone, moment: sig[t].moment, zekerheid: sig[t].zekerheid });
    fondsen[t] = f;
  }
  const indexen = {};
  for (const c of Object.keys(ixw)) { const x = ixw[c](d); if (x) indexen[c] = { datum: x[0], stand: x[1] }; }
  const fx = fxw(d);
  M.stap(staat, { datum: d, fx: fx ? { datum: fx[0], USD: fx[1].USD, GBP: fx[1].GBP } : null, fondsen, indexen, signalen: !!sig });
}

const eind = handelsdagen[handelsdagen.length - 1];
const uit = { periode: [start, eind], opmerking: 'Teruggerekend met de fondsen van nu en de jaarcijfers zoals nu bekend; signalen één keer per week. Geeft een indruk, geen bewijs.', staat };
fs.writeFileSync(path.join(map, 'terug.json'), JSON.stringify(uit));
let md = `# Modelportefeuille teruggerekend\n\n${start} t/m ${eind}, ${handelsdagen.length} handelsdagen, ${peil.length} peildata.\n\n`;
for (const v of staat.varianten) {
  const s = M.samenvatting(v);
  md += `## ${v.naam}\n\n- posities: ${s.open} open, ${s.gesloten} verkocht (${s.gewonnen} met winst, ${s.verloren} met verlies)\n- ingelegd ${s.inleg.toFixed(0)} euro; resultaat ${s.resultaat.toFixed(0)} euro (${s.pct}%), waarvan dividend ${s.dividend.toFixed(0)}\n- dezelfde bedragen in de index: ${s.idxResultaat.toFixed(0)} euro (${s.idxPct}%); eigen rendement op de posities met index ${s.pctMetIdx}%; zonder dividend ${s.pctZonderDiv}%\n\n`;
  const per = {};
  v.posities.forEach((p) => { const z = p.koop.signaal && p.koop.signaal.zekerheid || 'onbekend', u = M.uitkomst(p), x = per[z] || (per[z] = { n: 0, inleg: 0, res: 0, idx: 0, idxInleg: 0 }); x.n++; x.inleg += u.inleg; x.res += u.resultaat; if (u.idx) { x.idx += u.idx.resultaat; x.idxInleg += u.inleg; } });
  md += '| Zekerheid bij aankoop | posities | rendement | index |\n|---|---|---|---|\n';
  Object.entries(per).forEach(([z, x]) => { md += `| ${z} | ${x.n} | ${(x.res / x.inleg * 100).toFixed(1)}% | ${x.idxInleg ? (x.idx / x.idxInleg * 100).toFixed(1) + '%' : '-'} |\n`; });
  md += '\n';
}
fs.writeFileSync(path.join(map, 'terug.md'), md);
console.log(md);
