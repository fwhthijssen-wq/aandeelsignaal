/* Analyse per termijn, naast NAIC (lange termijn, 3-5 jaar):
   - middellang (3-12 maanden): vier onderdelen van +1, 0 of -1 — trendsignaal, relatieve sterkte (12 maanden), bijstelling
     van de winstverwachting door analisten (90 dagen) en de verrassingen bij de laatste kwartaalcijfers. Positief vanaf +2,
     negatief vanaf -2, met minstens 3 bekende onderdelen. Trend en relatieve sterkte zijn teruggerekend (2016-2026); voor
     bijstellingen en verrassingen steunen we op onderzoek, want Yahoo bewaart die geschiedenis niet.
   - kort (dagen tot weken): alleen feiten — de volgende kwartaalcijfers, de verwachte bandbreedte voor een maand, RSI en
     de afstand tot de top. Geen signaal: op 1 maand werkte in het terugrekenen niets.
   Geen DOM, geen netwerk. Telt niet mee in het NAIC-oordeel. */
(function (root) {
  'use strict';
  function num(x) { return typeof x === 'number' && isFinite(x); }
  function dagenTussen(a, b) { var x = Date.parse(a), y = Date.parse(b); return isNaN(x) || isNaN(y) ? null : Math.round((y - x) / 86400000); }
  var STATUS_NAAM = { positief: 'Positief', neutraal: 'Neutraal', negatief: 'Negatief', onbekend: 'Te weinig gegevens' };

  /* rec: record uit aandelen.json; trend: uitkomst van Kortetermijn.kortetermijn (of null); vandaag: 'YYYY-MM-DD'. */
  function middellang(rec, trend, vandaag) {
    var k = (rec && rec.koers) || {}, v = rec && rec.verwachting;
    if (v && vandaag && v.datum && dagenTussen(v.datum, vandaag) > 10) v = null;      // verouderd: niet gebruiken
    var delen = [];
    // 1. trend
    var tp = trend && trend.status !== 'onvoldoende' ? ({ gunstig: 1, neutraal: 0, afwachten: -1 })[trend.status] : null;
    delen.push({ id: 'trend', naam: 'Trend', punt: tp == null ? null : tp,
      tekst: tp == null ? 'Niet te berekenen.' : trend.ja + ' van 5 checks van het trendsignaal (' + ({ 1: 'stijgende trend', 0: 'geen duidelijke trend', '-1': 'dalende trend' })[tp] + ').' });
    // 2. relatieve sterkte
    var rel = k.relatief, rp = rel && num(rel.m12) ? (rel.m12 > 5 ? 1 : rel.m12 < -5 ? -1 : 0) : null;
    delen.push({ id: 'relatief', naam: 'Relatieve sterkte', punt: rp,
      tekst: rp == null ? 'Geen vergelijking met een index.' : (rel.m12 >= 0 ? 'Sterker' : 'Zwakker') + ' dan de ' + rel.naam + ' over 12 maanden (' + (rel.m12 > 0 ? '+' : '') + String(rel.m12).replace('.', ',') + '%).' });
    // 3. bijstelling winstverwachting
    var bij = v && v.bijstelling, waarden = [];
    if (bij) ['dit_jaar', 'volgend_jaar'].forEach(function (p) { var x = bij[p]; if (x) { var w = num(x.d90) ? x.d90 : num(x.d30) ? x.d30 : null; if (w !== null) waarden.push(w); } });
    var bw = waarden.length ? waarden.reduce(function (a, b) { return a + b; }, 0) / waarden.length : null;
    var bp = bw == null ? null : bw > 2 ? 1 : bw < -2 ? -1 : 0;
    var ud = bij && bij.dit_jaar && num(bij.dit_jaar.omhoog) ? ' Laatste 30 dagen: ' + bij.dit_jaar.omhoog + ' analisten omhoog, ' + bij.dit_jaar.omlaag + ' omlaag.' : '';
    delen.push({ id: 'bijstelling', naam: 'Winstverwachting analisten', punt: bp,
      tekst: bp == null ? 'Geen schattingen bekend.' : 'Verwachte winst per aandeel ' + (bw > 0 ? 'verhoogd' : bw < 0 ? 'verlaagd' : 'gelijk') + ': ' + (bw > 0 ? '+' : '') + (Math.round(bw * 10) / 10).toString().replace('.', ',') + '% in 90 dagen.' + ud, waarde: bw == null ? null : Math.round(bw * 10) / 10 });
    // 4. verrassingen bij de kwartaalcijfers
    var vr = v && v.verrassingen && v.verrassingen.length ? v.verrassingen : null, vp = null, gem = null;
    if (vr) {
      gem = vr.reduce(function (a, x) { return a + x.pct; }, 0) / vr.length;
      vp = gem >= 3 && vr[0].pct > 0 ? 1 : (gem <= -3 || vr[0].pct <= -5) ? -1 : 0;
    }
    delen.push({ id: 'verrassing', naam: 'Kwartaalcijfers t.o.v. verwachting', punt: vp,
      tekst: vp == null ? 'Geen kwartaalcijfers met verwachting bekend.' : 'Laatste ' + (vr[0].pct >= 0 ? '+' : '') + String(vr[0].pct).replace('.', ',') + '% ' + (vr[0].pct >= 0 ? 'boven' : 'onder') + ' de verwachting; gemiddeld ' + (gem >= 0 ? '+' : '') + (Math.round(gem * 10) / 10).toString().replace('.', ',') + '% over ' + vr.length + ' kwartalen.' });
    var bekend = delen.filter(function (d) { return d.punt !== null; });
    var score = bekend.reduce(function (a, d) { return a + d.punt; }, 0);
    var status = bekend.length < 3 ? 'onbekend' : score >= 2 ? 'positief' : score <= -2 ? 'negatief' : 'neutraal';
    return { status: status, naam: STATUS_NAAM[status], score: score, bekend: bekend.length, delen: delen };
  }

  /* Korte termijn: alleen feiten. */
  function kort(rec, vandaag, vers) {
    var k = (rec && rec.koers) || {}, v = rec && rec.verwachting, r = k.risico || {}, uit = {};
    if (v && v.volgende_cijfers && vandaag && v.volgende_cijfers >= vandaag) uit.cijfers = { datum: v.volgende_cijfers, dagen: dagenTussen(vandaag, v.volgende_cijfers) };
    if (vers && num(k.slot) && num(r.beweeglijk) && r.beweeglijk > 0) {
      var m = r.beweeglijk / Math.sqrt(12);
      uit.band = { pct: Math.round(m * 10) / 10, laag: k.slot * (1 - m / 100), hoog: k.slot * (1 + m / 100) };
    }
    if (vers && num(k.rsi14)) uit.rsi = k.rsi14;
    if (vers && num(r.onder_top)) uit.onderTop = r.onder_top;
    return uit;
  }

  var api = { middellang: middellang, kort: kort, STATUS_NAAM: STATUS_NAAM };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Termijn = api;
})(typeof self !== 'undefined' ? self : this);
