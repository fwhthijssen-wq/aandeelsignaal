/* NAIC-gids (Stock Selection Guide) in stappen. Alles is een rekenvoorbeeld met uw eigen aannames, geen koersdoel.
   Cijfers uit de jaarverslagen komen alleen uit jaren met een getal; ontbreekt iets, dan staat er null. */
(function (root) {
  'use strict';
  function ok(x) { return typeof x === 'number' && isFinite(x); }
  function pos(x) { return ok(x) && x > 0; }
  function rond(x, d) { if (!ok(x)) return null; var f = Math.pow(10, d); return Math.round(x * f) / f; }
  function jaren(jr) { return (Array.isArray(jr) ? jr : []).filter(function (j) { return j && ok(j.year); }).sort(function (a, b) { return a.year - b.year; }); }
  function cagr(a, b, n) { return pos(a) && pos(b) && n > 0 ? rond((Math.pow(b / a, 1 / n) - 1) * 100, 1) : null; }

  /* Groei per jaar over alle jaren en over de laatste vijf jaar (zes jaarcijfers nodig). */
  function groeiCijfers(jr) {
    jr = jaren(jr); var uit = { omzet10: null, omzet5: null, eps10: null, eps5: null, van: null, tot: null };
    if (jr.length < 2) return uit;
    var f = jr[0], l = jr[jr.length - 1], n = l.year - f.year; uit.van = f.year; uit.tot = l.year;
    uit.omzet10 = cagr(f.sales, l.sales, n); uit.eps10 = cagr(f.comparable_eps, l.comparable_eps, n);
    if (jr.length >= 6) { var v = jr[jr.length - 6], n5 = l.year - v.year; uit.omzet5 = cagr(v.sales, l.sales, n5); uit.eps5 = cagr(v.comparable_eps, l.comparable_eps, n5); }
    return uit;
  }

  /* Rendement op eigen vermogen per jaar (nettowinst / eigen vermogen aan het einde van het jaar). Vermogen <= 0 telt niet mee. */
  function rendementEigenVermogen(jr) {
    var reeks = jaren(jr).map(function (j) { return { year: j.year, waarde: ok(j.net_income) && pos(j.equity) ? rond(j.net_income / j.equity * 100, 1) : null }; });
    var geldig = reeks.filter(function (r) { return r.waarde !== null; });
    return { reeks: reeks, gemiddelde: geldig.length ? rond(geldig.reduce(function (s, r) { return s + r.waarde; }, 0) / geldig.length, 1) : null, jarenMetWaarde: geldig.length };
  }

  /* Nettowinst / omzet (na belasting). De NAIC-maatstaf, winst vóór belasting, staat in margeVoorBelasting. */
  function nettomarges(jr) {
    return jaren(jr).map(function (j) { return { year: j.year, waarde: ok(j.net_income) && pos(j.sales) ? rond(j.net_income / j.sales * 100, 1) : null }; });
  }

  /* Winst vóór belasting / omzet: de marge die de NAIC bedoelt. Ontbreekt een van beide, dan null. */
  function margeVoorBelasting(jr) {
    return jaren(jr).map(function (j) { return { year: j.year, waarde: ok(j.pretax_income) && pos(j.sales) ? rond(j.pretax_income / j.sales * 100, 1) : null }; });
  }
  /* Uitgekeerd dividend (totaal) / nettowinst. Alleen bij positieve winst en een bekend, niet-negatief dividend. */
  function uitkeringsratio(jr) {
    return jaren(jr).map(function (j) { return { year: j.year, waarde: ok(j.dividends_paid) && j.dividends_paid >= 0 && pos(j.net_income) ? rond(j.dividends_paid / j.net_income * 100, 1) : null }; });
  }
  /* Langlopende schuld / (schuld + eigen vermogen). Alleen bij bekende schuld >= 0 en positief eigen vermogen. */
  function schuldratio(jr) {
    return jaren(jr).map(function (j) { return { year: j.year, waarde: ok(j.long_term_debt) && j.long_term_debt >= 0 && pos(j.equity) ? rond(j.long_term_debt / (j.long_term_debt + j.equity) * 100, 1) : null }; });
  }
  /* Investeringen in vaste activa / afschrijvingen, als verhouding (1,0 = even veel). Beide moeten positief zijn. */
  function investeringsratio(jr) {
    return jaren(jr).map(function (j) { return { year: j.year, waarde: pos(j.capex) && pos(j.depreciation) ? rond(j.capex / j.depreciation, 2) : null }; });
  }

  /* Koerszones: toekomstig hoog en laag, en waar de koers nu in dat bereik staat. Gooit bij ongeldige invoer. */
  function koerszones(i) {
    var n = i.jaren;
    [i.eps, i.epsLaag, i.groeiPct, i.kwHoog, i.kwLaag].forEach(function (v) { if (!ok(v)) throw new Error('Alle aannames moeten getallen zijn.'); });
    if (!(i.eps > 0 && i.epsLaag > 0 && i.kwHoog > 0 && i.kwLaag > 0)) throw new Error('Winst per aandeel en K/W moeten groter dan nul zijn.');
    if (!Number.isInteger(n) || n < 1 || n > 10) throw new Error('De horizon is 1 tot 10 jaar.');
    if (!(i.groeiPct > -100 && i.groeiPct <= 100)) throw new Error('Groei per jaar moet tussen −100% en 100% liggen.');
    if (!(i.kwLaag < i.kwHoog)) throw new Error('De lage K/W moet lager zijn dan de hoge K/W.');
    var epsToekomst = i.eps * Math.pow(1 + i.groeiPct / 100, n);
    var hoog = epsToekomst * i.kwHoog, laag = i.epsLaag * i.kwLaag;
    if (!(hoog > laag)) throw new Error('Met deze aannames ligt de hoge koers niet boven de lage koers.');
    var stap = (hoog - laag) / 3;
    var uit = { epsToekomst: epsToekomst, hoog: hoog, laag: laag, koop: [laag, laag + stap], houd: [laag + stap, laag + 2 * stap], verkoop: [laag + 2 * stap, hoog],
      koers: null, zone: null, opwaarts: null, neerwaarts: null, verhouding: null, rendementPerJaar: null };
    if (pos(i.koers)) {
      uit.koers = i.koers; uit.opwaarts = hoog - i.koers; uit.neerwaarts = i.koers - laag;
      uit.zone = i.koers < laag ? 'onder' : i.koers > hoog ? 'boven' : i.koers <= laag + stap ? 'koop' : i.koers <= laag + 2 * stap ? 'houd' : 'verkoop';
      uit.verhouding = uit.neerwaarts > 0 && uit.opwaarts > 0 ? uit.opwaarts / uit.neerwaarts : null;
      uit.rendementPerJaar = (Math.pow(hoog / i.koers, 1 / n) - 1) * 100;
    }
    return uit;
  }

  var api = { groeiCijfers: groeiCijfers, rendementEigenVermogen: rendementEigenVermogen, nettomarges: nettomarges, margeVoorBelasting: margeVoorBelasting, uitkeringsratio: uitkeringsratio, schuldratio: schuldratio, investeringsratio: investeringsratio, koerszones: koerszones };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Naic = api;
})(typeof self !== 'undefined' ? self : this);
