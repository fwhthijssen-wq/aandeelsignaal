/* Portefeuille: wat uw aankopen nu waard zijn. Rekent alleen met een verse koers in dezelfde valuta als de aankoop.
   Er wordt nooit omgerekend of geschat; ontbreekt iets, dan staat er waarom en telt de aankoop niet mee in het totaal.
   Totalen worden per valuta gegeven en nooit bij elkaar opgeteld. */
(function (root) {
  'use strict';
  function afrond(x) { return Math.round(x * 100) / 100; }

  function waardeer(posities, aandelen, vandaag, gate) {
    var per = {}, regels = [];
    (aandelen || []).forEach(function (a) { per[a.ticker] = a; });
    (posities || []).forEach(function (p) {
      var rec = per[p.ticker], kosten = afrond(p.aantal * p.koers), r = { positie: p, naam: rec ? rec.naam : p.ticker, kosten: kosten, status: 'ok', reden: null, waarde: null, winst: null, pct: null };
      if (!rec || !rec.koers || typeof rec.koers.slot !== 'number' || !isFinite(rec.koers.slot) || rec.koers.slot <= 0) {
        r.status = 'geen_koers'; r.reden = rec ? 'Geen koers beschikbaar.' : 'Dit aandeel zit niet meer in de lijst.';
      } else {
        var fr = gate.priceFreshness(rec.koers.datum, vandaag);
        if (!fr.fresh) { r.status = 'verouderd'; r.reden = fr.reason; }
        else if (String(rec.valuta || '').toUpperCase() !== p.valuta) { r.status = 'valuta'; r.reden = 'Koers staat in ' + (rec.valuta || 'onbekende valuta') + ', uw aankoop in ' + p.valuta + '. Er wordt niet omgerekend.'; }
        else {
          r.waarde = afrond(p.aantal * rec.koers.slot); r.winst = afrond(r.waarde - kosten); r.pct = kosten > 0 ? Math.round((r.waarde - kosten) / kosten * 1000) / 10 : null;
        }
      }
      regels.push(r);
    });
    var tot = {};
    regels.forEach(function (r) {
      var v = r.positie.valuta, t = tot[v] || (tot[v] = { valuta: v, kosten: 0, waarde: 0, winst: 0, meegeteld: 0, buiten: 0, kostenAlles: 0 });
      t.kostenAlles = afrond(t.kostenAlles + r.kosten);
      if (r.status === 'ok') { t.kosten = afrond(t.kosten + r.kosten); t.waarde = afrond(t.waarde + r.waarde); t.winst = afrond(t.winst + r.winst); t.meegeteld++; }
      else t.buiten++;
    });
    var totalen = Object.keys(tot).sort().map(function (k) { var t = tot[k]; t.pct = t.kosten > 0 ? Math.round(t.winst / t.kosten * 1000) / 10 : null; return t; });
    return { regels: regels, totalen: totalen };
  }

  var api = { waardeer: waardeer };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Portefeuille = api;
})(typeof self !== 'undefined' ? self : this);
