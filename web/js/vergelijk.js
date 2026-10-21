/* Twee aandelen naast elkaar. Cijfers uit de jaarverslagen (groei, marge, koers-winstverhouding) worden alleen
   getoond als het aandeel volledig bevestigd is (zelfde label-slot als overal in de app). Anders staat er een streepje
   met de reden. Er staan alleen percentages en verhoudingen, geen bedragen in verschillende valuta's naast elkaar,
   en er wordt nooit een winnaar aangewezen. */
(function (root) {
  'use strict';
  function jaren(g) { return (g && Array.isArray(g.jaren) ? g.jaren : []).filter(function (j) { return j && typeof j.year === 'number'; }).sort(function (a, b) { return a.year - b.year; }); }
  function pos(x) { return typeof x === 'number' && isFinite(x) && x > 0; }
  function groei(a, b, n) { return pos(a) && pos(b) && n > 0 ? (Math.pow(b / a, 1 / n) - 1) * 100 : null; }
  function rond(x, d) { var f = Math.pow(10, d); return x == null ? null : Math.round(x * f) / f; }

  function kant(rec, vandaag, gate) {
    var rij = gate.maakRij(rec, vandaag), g = rec.gegevens && !rec.gegevens.fout ? rec.gegevens : null, k = rec.koers;
    var fr = k ? gate.priceFreshness(k.datum, vandaag) : { fresh: false };
    var uit = { niveau: rij.niveau || null, ticker: rec.ticker, naam: rec.naam, valuta: rec.valuta, indices: Array.isArray(rec.indices) ? rec.indices : [], bevestigd: rij.bevestigd, reden: rij.bevestigd ? null : (rij.redenen && rij.redenen.length ? rij.redenen.join(' ') : 'Nog niet gecontroleerd.'),
      koers: fr.fresh && typeof k.slot === 'number' ? k.slot : null, afstandPct: fr.fresh ? rij.afstandPct : null,
      omzetgroei: null, epsgroei: null, nettomarge: null, kw: null, jarenBereik: null,
      positiePct: null, verhouding: null, trend200: fr.fresh && typeof k.slot === 'number' && typeof k.sma200 === 'number' && k.sma200 > 0 ? (k.slot > k.sma200 ? 'boven' : 'onder') : null };
    // Plek in het koersbereik (uit de koersreeks); alleen bij verse koers en minstens 8 jaar. Geldt ook voor onbevestigde aandelen: het is een koersfeit.
    var b = k && k.bereik;
    if (fr.fresh && b && typeof b.hoog === 'number' && typeof b.laag === 'number' && b.jaren >= 8 && typeof k.slot === 'number' && k.slot > 0) {
      var hi = Math.max(b.hoog, k.slot), lo = Math.min(b.laag, k.slot);
      if (hi > lo) {
        uit.positiePct = rond((k.slot - lo) / (hi - lo) * 100, 0);
        uit.verhouding = k.slot > lo ? rond((hi - k.slot) / (k.slot - lo), 1) : null;
      }
    }
    if (!g || (!rij.bevestigd && rij.niveau !== 'jaarverslag' && rij.niveau !== 'indicatief')) return uit;
    var jr = jaren(g), f = jr[0], l = jr[jr.length - 1];
    if (!f || !l || l.year <= f.year) return uit;
    var n = l.year - f.year;
    uit.jarenBereik = [f.year, l.year];
    uit.omzetgroei = rond(groei(f.sales, l.sales, n), 1);
    uit.epsgroei = rond(groei(f.comparable_eps, l.comparable_eps, n), 1);
    if (pos(l.sales) && typeof l.net_income === 'number' && isFinite(l.net_income)) uit.nettomarge = rond(l.net_income / l.sales * 100, 1);
    if (rij.bevestigd && uit.koers != null && pos(l.comparable_eps) && g.currencies && g.currencies.length === 1) uit.kw = rond(uit.koers / l.comparable_eps, 1);
    return uit;
  }

  function vergelijk(a, b, vandaag, gate) { return { a: kant(a, vandaag, gate), b: kant(b, vandaag, gate) }; }

  var api = { vergelijk: vergelijk, kant: kant };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Vergelijk = api;
})(typeof self !== 'undefined' ? self : this);
