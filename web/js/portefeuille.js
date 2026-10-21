/* Portefeuille: wat uw aankopen nu waard zijn. Rekent alleen met een verse koers in dezelfde valuta als de aankoop.
   Er wordt nooit omgerekend of geschat; ontbreekt iets, dan staat er waarom en telt de aankoop niet mee in het totaal.
   Totalen worden per valuta gegeven en nooit bij elkaar opgeteld. */
(function (root) {
  'use strict';
  function afrond(x) { return Math.round(x * 100) / 100; }

  /* Koers van het aandeel in de valuta van de aankoop. Gelijke valuta: de koers zelf. Enige uitzondering: Londen. De app
     rekent Londense koersen in ponden (GBP), maar een aankoop kan in pence (GBX) zijn ingevoerd: 1 pond = 100 pence is een
     vaste eenheid, geen wisselkoers. Elk ander verschil: null (er wordt niet omgerekend). */
  function koersIn(rec, valuta) {
    var v = String(rec.valuta || '').toUpperCase();
    if (v === valuta) return rec.koers.slot;
    if (v === 'GBP' && valuta === 'GBX') return rec.koers.slot * 100;
    return null;
  }

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
        else if (koersIn(rec, p.valuta) === null) { r.status = 'valuta'; r.reden = 'Koers staat in ' + (rec.valuta || 'onbekende valuta') + ', uw aankoop in ' + p.valuta + '. Er wordt niet omgerekend.'; }
        else {
          r.waarde = afrond(p.aantal * koersIn(rec, p.valuta)); r.winst = afrond(r.waarde - kosten); r.pct = kosten > 0 ? Math.round((r.waarde - kosten) / kosten * 1000) / 10 : null;
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

  /* Rendement van aankopen die u op het signaal van de app deed, naast de overige aankopen. Alleen aankopen die meetellen
     (verse koers, dezelfde valuta); per valuta apart, nooit opgeteld. */
  function herkomst(regels) {
    var per = {};
    (regels || []).forEach(function (r) {
      if (r.status !== 'ok') return;
      var v = r.positie.valuta, t = per[v] || (per[v] = { valuta: v, signaal: { n: 0, kosten: 0, winst: 0 }, overig: { n: 0, kosten: 0, winst: 0 } }), d = r.positie.opSignaal === true ? t.signaal : t.overig;
      d.n++; d.kosten = afrond(d.kosten + r.kosten); d.winst = afrond(d.winst + r.winst);
    });
    return Object.keys(per).sort().map(function (k) {
      var t = per[k];
      ['signaal', 'overig'].forEach(function (g) { t[g].pct = t[g].kosten > 0 ? Math.round(t[g].winst / t[g].kosten * 1000) / 10 : null; });
      return t;
    });
  }

  /* Wat heeft een gevolgd aandeel gedaan sinds u het volgt? Alleen met een momentopname (koers en valuta), een verse koers nu
     en dezelfde valuta. Geeft de verandering in % en de dagen sinds het volgen; anders status en reden. */
  function volg(item, rec, vandaag, gate) {
    var s = item && item.sinds, uit = { status: 'geen', reden: null, pct: null, dagen: null };
    if (!s || typeof s.koers !== 'number' || !s.valuta) { uit.reden = 'Er is geen koers vastgelegd op het moment dat u dit aandeel ging volgen.'; return uit; }
    uit.dagen = Math.max(0, Math.round((Date.parse(vandaag) - Date.parse(s.datum)) / 86400000));
    if (!rec || !rec.koers || typeof rec.koers.slot !== 'number' || !(rec.koers.slot > 0)) { uit.status = 'geen_koers'; uit.reden = 'Geen koers beschikbaar.'; return uit; }
    var fr = gate.priceFreshness(rec.koers.datum, vandaag);
    if (!fr.fresh) { uit.status = 'verouderd'; uit.reden = fr.reason; return uit; }
    if (koersIn(rec, s.valuta) === null) { uit.status = 'valuta'; uit.reden = 'De koers staat nu in een andere valuta dan toen.'; return uit; }
    uit.status = 'ok'; uit.pct = Math.round((koersIn(rec, s.valuta) / s.koers - 1) * 1000) / 10;
    return uit;
  }

  var api = { waardeer: waardeer, herkomst: herkomst, volg: volg, koersIn: koersIn };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Portefeuille = api;
})(typeof self !== 'undefined' ? self : this);
