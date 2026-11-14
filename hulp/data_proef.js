/* Hulpmiddel (ontwikkeling): de gepubliceerde gegevens per fonds bekijken, zoals de app ze ziet.
   Gebruik: node hulp/data_proef.js aandelen.json TICKER [TICKER ...]
   Per fonds: valuta van notering en cijfers, omrekening, laatste winst per aandeel, koers, K/W, NAIC-oordeel en -zone,
   nagerekende jaren en per open jaar (laatste 10) de reden. */
'use strict';
const fs = require('fs'), path = require('path');
const { fondsVoorModel } = require(path.join(__dirname, '..', 'modelportefeuille.js'));
const [pad, ...tickers] = process.argv.slice(2);
const d = JSON.parse(fs.readFileSync(pad, 'utf8')), vandaag = new Date().toISOString().slice(0, 10);
// Overzicht: welke fondsen hebben een splitsing na het laatste verslag, of een fout daarin
for (const a of d.aandelen) {
  const g = a.gegevens || {};
  if (g.split_na_verslag || g.split_fout) console.log(`-- splitsing na verslag ${a.ticker}: ${g.split_fout || g.split_na_verslag.uitleg}`);
}
const zonderDatum = d.aandelen.filter((a) => (a.gegevens || {}).jaren && a.gegevens.bron !== 'Yahoo Finance' && !(a.gegevens.jaren || []).some((j) => j.ingediend));
console.log(`-- officieel zonder indieningsdatum: ${zonderDatum.length} ${zonderDatum.slice(0, 40).map((a) => a.ticker).join(' ')}`);
// Dekking van de gegevens voor de kwaliteitscheck
{
  const n = d.aandelen.length, tel = (f) => d.aandelen.filter(f).length;
  const heeft = (v) => (a) => ((a.gegevens || {}).jaren || []).some((j) => j[v] != null);
  console.log(`-- kwaliteitscheck: ${n} fondsen; sector ${tel((a) => a.sector_yahoo)}, R&D ${tel(heeft('rd_expense'))}, verkoopkosten ${tel(heeft('selling_expense'))}, SG&A ${tel(heeft('sga_expense'))}, groei analisten ${tel((a) => (a.verwachting || {}).groei)}, governance ${tel((a) => (a.management || {}).governance)}`);
}
// Overzicht van alle fondsen die niet Bevestigd zijn (status, nagerekende jaren, bron, niveau, eerste open reden)
if (tickers.includes('ALLE')) {
  for (const a of d.aandelen) {
    const g = a.gegevens || {}, jr = (g.jaren || []).filter((j) => j.comparable_eps != null);
    if (g.eps_status === 'independently_verified' && (g.eps_verified_years || 0) >= 10) continue;
    const open_ = jr.slice(-10).filter((j) => j.eps_check !== 'onderbouwd').map((j) => `${j.year}:${String(j.eps_reden || j.eps_check || '-').slice(0, 110)}`);
    console.log(`## ${a.ticker} | ${(a.indices || []).join('/')} | ${g.bron || '-'} | ${g.niveau || '-'} | ${g.eps_status || '-'} | ${g.eps_verified_years || 0} | ${jr.length} | ${jr.length ? jr[0].year + '-' + jr[jr.length - 1].year : '-'} | ${String(g.eps_note || g.eps_verification_note || '').slice(0, 160)} | ${open_.slice(0, 2).join(' ;; ')}`);
  }
}
for (const t of tickers.filter((x) => x !== 'ALLE')) {
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
