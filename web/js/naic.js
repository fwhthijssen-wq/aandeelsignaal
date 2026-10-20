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

  /* K/W per jaar uit hoogste en laagste koers van het boekjaar gedeeld door de (splitsingscorrecte) winst per aandeel.
     Alleen bij positieve winst en bekende koers; anders null. */
  function historischKW(jr) {
    return jaren(jr).map(function (j) {
      var e = j.comparable_eps;
      return { year: j.year, hoog: pos(e) && pos(j.koers_hoog) ? rond(j.koers_hoog / e, 1) : null, laag: pos(e) && pos(j.koers_laag) ? rond(j.koers_laag / e, 1) : null };
    });
  }
  /* Gemiddelde hoge en lage K/W over de laatste n jaren met beide waarden; minstens 3 jaar nodig, anders null. */
  function kwGemiddelden(reeks, n) {
    var v = (reeks || []).filter(function (x) { return ok(x.hoog) && ok(x.laag); }).slice(-(n || 5));
    if (v.length < 3) return null;
    var som = function (k) { return v.reduce(function (a, x) { return a + x[k]; }, 0) / v.length; };
    return { hoog: rond(som('hoog'), 1), laag: rond(som('laag'), 1), jaren: v.length, van: v[0].year, tot: v[v.length - 1].year };
  }
  /* Dividend per aandeel / gemiddelde van hoogste en laagste koers van dat jaar, in procenten. */
  function dividendRendement(jr) {
    return jaren(jr).map(function (j) {
      return { year: j.year, waarde: pos(j.dividend_ps) && pos(j.koers_hoog) && pos(j.koers_laag) ? rond(j.dividend_ps / ((j.koers_hoog + j.koers_laag) / 2) * 100, 1) : null };
    });
  }

  /* Plek van de koers in het bereik van de laatste n boekjaren (hoogste en laagste slotkoers), in drie gelijke stukken zoals in de
     Nederlandse NAIC-praktijk, en de verhouding opwaarts/neerwaarts (hoogste - koers) / (koers - laagste).
     Alleen met een verse koers en minstens minJaren jaren met beide waarden; anders null. Geen koop- of verkoopadvies. */
  function bereik(jr, koers, n, minJaren) {
    var v = jaren(jr).filter(function (j) { return pos(j.koers_hoog) && pos(j.koers_laag) && j.koers_hoog >= j.koers_laag; }).slice(-(n || 10));
    if (!pos(koers) || v.length < (minJaren || 8)) return null;
    var hoog = Math.max.apply(null, v.map(function (j) { return j.koers_hoog; })), laag = Math.min.apply(null, v.map(function (j) { return j.koers_laag; }));
    hoog = Math.max(hoog, koers); laag = Math.min(laag, koers);
    if (hoog <= laag) return null;
    var stuk = (hoog - laag) / 3, derde = koers <= laag + stuk ? 'onder' : koers < laag + 2 * stuk ? 'midden' : 'boven';
    return { hoog: rond(hoog, 2), laag: rond(laag, 2), derde: derde, positiePct: rond((koers - laag) / (hoog - laag) * 100, 0),
             verhouding: koers > laag ? rond((hoog - koers) / (koers - laag), 1) : null, van: v[0].year, tot: v[v.length - 1].year, jaren: v.length };
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

  var api = { groeiCijfers: groeiCijfers, rendementEigenVermogen: rendementEigenVermogen, nettomarges: nettomarges, margeVoorBelasting: margeVoorBelasting, uitkeringsratio: uitkeringsratio, schuldratio: schuldratio, investeringsratio: investeringsratio, historischKW: historischKW, kwGemiddelden: kwGemiddelden, dividendRendement: dividendRendement, bereik: bereik, koerszones: koerszones };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Naic = api;
})(typeof self !== 'undefined' ? self : this);
