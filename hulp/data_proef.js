/* Hulpmiddel (ontwikkeling): de gepubliceerde gegevens per fonds bekijken, zoals de app ze ziet.
   Gebruik: node hulp/data_proef.js aandelen.json TICKER [TICKER ...]
   Per fonds: valuta van notering en cijfers, omrekening, laatste winst per aandeel, koers, K/W, NAIC-oordeel en -zone,
   nagerekende jaren en per open jaar (laatste 10) de reden. */
'use strict';
const fs = require('fs'), path = require('path');
const { fondsVoorModel } = require(path.join(__dirname, '..', 'modelportefeuille.js'));
const [pad, ...tickers] = process.argv.slice(2);
const d = JSON.parse(fs.readFileSync(pad, 'utf8')), vandaag = new Date().toISOString().slice(0, 10);
for (const t of tickers) {
  const a = d.aandelen.find((x) => x.ticker === t);
  if (!a) { console.log(t, 'ONTBREEKT'); continue; }
  const g = a.gegevens || {}, jr = (g.jaren || []).filter((j) => j.comparable_eps != null), l = jr[jr.length - 1] || {};
  const f = fondsVoorModel(a, vandaag) || {};
  const kw = a.koers && l.comparable_eps > 0 ? (a.koers.slot / l.comparable_eps).toFixed(1) : '-';
  console.log(`== ${t} ${a.naam} | notering ${a.valuta} | cijfers ${(g.currencies || []).join('/')} | omrekening ${g.omrekening ? g.omrekening.van + '->' + g.omrekening.naar : '-'}` +
    ` | ${l.year}: EPS ${l.comparable_eps} ${l.currency} | koers ${a.koers && a.koers.slot} | K/W ${kw} | NAIC ${f.oordeel} zone ${f.zone} | status ${g.eps_status} ${g.eps_verified_years}${g.omrekening_fout ? ' | FOUT ' + g.omrekening_fout : ''}`);
  for (const j of jr.slice(-10)) {
    if (j.eps_check !== 'onderbouwd' && !j.eps_narekening) console.log(`   open ${j.year}: ${j.eps_check || '-'} | ${String(j.eps_reden || '').slice(0, 400)}`);
  }
}
