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
     Alleen met een verse koers en minstens minJaren jaren met beide waarden; anders null. Het label (positief/neutraal/vermijden) is alleen een beschrijving; de app toont het alleen bij bevestigde gegevens. */
  function plaats(hoog, laag, koers) {
    hoog = Math.max(hoog, koers); laag = Math.min(laag, koers);
    if (!(hoog > laag)) return null;
    var stuk = (hoog - laag) / 3, derde = koers <= laag + stuk ? 'onder' : koers < laag + 2 * stuk ? 'midden' : 'boven';
    var verh = koers > laag ? rond((hoog - koers) / (koers - laag), 1) : null;
    return { hoog: rond(hoog, 2), laag: rond(laag, 2), derde: derde, label: derde === 'boven' ? 'vermijden' : derde === 'onder' && verh !== null && verh >= 3 ? 'positief' : 'neutraal',
             positiePct: rond((koers - laag) / (hoog - laag) * 100, 0), verhouding: verh };
  }
  function bereik(jr, koers, n, minJaren) {
    var v = jaren(jr).filter(function (j) { return pos(j.koers_hoog) && pos(j.koers_laag) && j.koers_hoog >= j.koers_laag; }).slice(-(n || 10));
    if (!pos(koers) || v.length < (minJaren || 8)) return null;
    var p = plaats(Math.max.apply(null, v.map(function (j) { return j.koers_hoog; })), Math.min.apply(null, v.map(function (j) { return j.koers_laag; })), koers);
    if (!p) return null;
    p.van = v[0].year; p.tot = v[v.length - 1].year; p.jaren = v.length;
    return p;
  }
  /* Zelfde, maar uit het kant-en-klare bereik van de koersreeks (koers.bereik: hoog, laag, van, tot, jaren); voor aandelen zonder jaarcijfers. */
  function bereikUitKoers(b, koers) {
    if (!b || !pos(b.hoog) || !pos(b.laag) || b.hoog < b.laag || !pos(koers) || !pos(b.jaren) || b.jaren < 8) return null;
    var p = plaats(b.hoog, b.laag, koers);
    if (!p) return null;
    p.van = String(b.van || '').slice(0, 4) * 1 || null; p.tot = String(b.tot || '').slice(0, 4) * 1 || null; p.jaren = Math.round(b.jaren);
    return p;
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

  /* NAIC Stock Selection Guide, automatisch met vaste, voorzichtige aannames:
     - groei: trendgroei van de winst per aandeel (rechte lijn door de logaritme, hoogstens 10 jaar), begrensd op GROEI_MAX;
       minder dan GROEI_MIN per jaar is geen NAIC-groeibedrijf;
     - hoge en lage K/W: gemiddelden van de laatste 5 jaar (minstens 3), zonder ongewone jaren (hoge K/W boven 60);
     - hoge koers over 5 jaar = winst per aandeel over 5 jaar × hoge K/W; lage koers = laagste winst per aandeel van de laatste
       5 jaar × lage K/W; daartussen drie gelijke zones: kopen, houden, verkopen;
     - deel 1: draagt de omzetgroei de winstgroei (omzet groeit, winst niet meer dan 10 procentpunt sneller)?
     - deel 2 (management): marge vóór belasting en rendement op eigen vermogen over 5 jaar stabiel of stijgend?
     - deel 5: totaalrendement = koersstijging per jaar tot de hoge koers + gemiddeld dividendrendement (5 jaar); NAIC vraagt
       ongeveer 15% per jaar (geld verdubbelen in 5 jaar);
     - Kopen: koers in de koopzone (of eronder) én minstens 3 : 1 opwaarts tegen neerwaarts, totaalrendement minstens TOTAAL_MIN,
       en geen kwaliteitstoets afgevallen (anders hoogstens Neutraal). Verkoopzone of erboven: Vermijden.
     jr: jaarcijfers met comparable_eps, koers_hoog, koers_laag; koers: verse slotkoers in dezelfde valuta, of null. */
  var GROEI_MAX = 15, GROEI_MIN = 5, HORIZON = 5, KW_UITSCHIETER = 60, TOTAAL_MIN = 15, RV_LAAG = 85, RV_HOOG = 110;
  /* Trendgroei zoals NAIC hem tekent: rechte lijn door de logaritme van alle positieve waarden (hoogstens 10 jaar), als % per jaar.
     Eén slecht begin- of eindjaar (zoals 2020) weegt zo veel minder dan bij groei van eerste naar laatste jaar. Null bij < 4 punten. */
  function trendGroei(v, veld) {
    var p = v.slice(-10).filter(function (j) { return pos(j[veld]); });
    if (p.length < 4) return null;
    var mx = p.reduce(function (a, j) { return a + j.year; }, 0) / p.length, my = p.reduce(function (a, j) { return a + Math.log(j[veld]); }, 0) / p.length;
    var t = 0, nm = 0;
    p.forEach(function (j) { t += (j.year - mx) * (Math.log(j[veld]) - my); nm += (j.year - mx) * (j.year - mx); });
    return nm ? rond((Math.exp(t / nm) - 1) * 100, 1) : null;
  }
  /* Helling (per jaar) van een reeks {year, waarde} over de laatste n jaren met waarde; null bij minder dan 4 punten. */
  function helling(reeks, n) {
    var v = (reeks || []).filter(function (r) { return ok(r.waarde); }).slice(-(n || 5));
    if (v.length < 4) return null;
    var mx = v.reduce(function (a, r) { return a + r.year; }, 0) / v.length, my = v.reduce(function (a, r) { return a + r.waarde; }, 0) / v.length;
    var t = 0, nm = 0;
    v.forEach(function (r) { t += (r.year - mx) * (r.waarde - my); nm += (r.year - mx) * (r.year - mx); });
    return nm ? { per_jaar: rond(t / nm, 2), gemiddeld: rond(my, 1), van: v[0].year, tot: v[v.length - 1].year, jaren: v.length } : null;
  }
  /* SSG deel 1 en 2: groeien omzet en winst gelijk op, en houdt het management marge en rendement op peil?
     Elke toets: { ok: true/false/null (onbekend), tekst }. Stabiel = helling binnen de grens; dalend = eronder. */
  function kwaliteit(jr, bank) {
    var v = jaren(jr).slice(-10), uit = [];
    var f = v[0], l = v[v.length - 1];
    var go = trendGroei(v, 'sales'), ge = trendGroei(v, 'comparable_eps');
    if (bank) uit.push({ id: 'omzet', ok: null, tekst: 'Omzet zegt bij een bank of verzekeraar weinig; niet getoetst.' });
    else if (go === null || ge === null) uit.push({ id: 'omzet', ok: null, tekst: 'Te weinig jaren met positieve omzet en winst per aandeel (minstens 4).' });
    else {
      var draagt = go >= 0 && ge - go <= 10;
      uit.push({ id: 'omzet', ok: draagt, tekst: 'Omzet ' + (go >= 0 ? '+' : '') + String(go).replace('.', ',') + '% en winst per aandeel ' + (ge >= 0 ? '+' : '') + String(ge).replace('.', ',') + '% per jaar (trend ' + f.year + '–' + l.year + '). ' +
        (draagt ? 'De omzet draagt de winstgroei.' : go < 0 ? 'De omzet krimpt: de winstgroei komt niet uit groei van het bedrijf.' : 'De winst groeit veel sneller dan de omzet (meer dan 10 procentpunt): dat komt uit hogere marges of minder aandelen en houdt meestal niet lang aan.') });
    }
    var pm = helling(margeVoorBelasting(v), 5), roe = helling(rendementEigenVermogen(v).reeks, 5);
    function toets(id, naam, h, grens, nvt) {
      if (nvt) return { id: id, ok: null, tekst: naam + ' zegt bij een bank of verzekeraar weinig; niet getoetst.' };
      if (!h) return { id: id, ok: null, tekst: naam + ': te weinig jaren (minstens 4).' };
      var w = h.per_jaar >= grens ? 'stijgend' : h.per_jaar <= -grens ? 'dalend' : 'stabiel';
      return { id: id, ok: w !== 'dalend', tekst: naam + ' gemiddeld ' + String(h.gemiddeld).replace('.', ',') + '% (' + h.van + '–' + h.tot + '), ' + w + ' (' + (h.per_jaar >= 0 ? '+' : '') + String(h.per_jaar).replace('.', ',') + ' procentpunt per jaar).', helling: h };
    }
    uit.push(toets('marge', 'Marge vóór belasting', pm, 0.5, bank));
    // Bij heel klein of negatief eigen vermogen (veel inkoop van eigen aandelen, zoals Home Depot) zegt het rendement niets.
    if (roe && Math.abs(roe.gemiddeld) > 60) uit.push({ id: 'roe', ok: null, tekst: 'Rendement op eigen vermogen gemiddeld ' + String(roe.gemiddeld).replace('.', ',') + '%: het eigen vermogen is te klein (bijv. door inkoop van eigen aandelen) om hier iets over te zeggen; niet getoetst.' });
    else uit.push(toets('roe', 'Rendement op eigen vermogen', roe, 1, false));
    return uit;
  }
  /* opties.groei: uw eigen groeiverwachting (% per jaar), zoals in de echte SSG. Dan rekent de gids daarmee in plaats van met de
     historische trend (ook voor de toets of het een groeibedrijf is); de historische trend blijft ter vergelijking zichtbaar. */
  function ssg(jr, koers, bank, opties) {
    var v = jaren(jr).filter(function (j) { return ok(j.comparable_eps); });
    var uit = { oordeel: null, reden: null, totaal: null, relatief: null, par: null, groeiHistorisch: null, groei: null, kw: null, eps: null, epsLaag: null, zones: null, van: null, tot: null, horizon: HORIZON, kwaliteit: [] };
    if (v.length < 4) { uit.reden = 'Minder dan 4 jaar vergelijkbare winst per aandeel.'; return uit; }
    uit.kwaliteit = kwaliteit(v, bank);
    var l = v[v.length - 1], f = v.slice(-10)[0];
    uit.van = f.year; uit.tot = l.year;
    if (!pos(l.comparable_eps)) { uit.reden = 'De winst per aandeel van ' + l.year + ' is niet positief.'; return uit; }
    uit.groeiHistorisch = trendGroei(v, 'comparable_eps');
    if (uit.groeiHistorisch === null) { uit.reden = 'Te weinig jaren met positieve winst per aandeel voor een trend (minstens 4).'; return uit; }
    var eigen = opties && typeof opties.groei === 'number' && isFinite(opties.groei) ? opties.groei : null;
    uit.groeiEigen = eigen;
    uit.groei = eigen !== null ? eigen : Math.min(uit.groeiHistorisch, GROEI_MAX);
    // Ongewone jaren (eenmalige lasten: winst per aandeel bijna nul, K/W boven KW_UITSCHIETER) doen niet mee, zoals NAIC voorschrijft.
    var kwReeks = historischKW(v), normaal = {};
    kwReeks.forEach(function (x) { if (ok(x.hoog) && ok(x.laag) && x.hoog <= KW_UITSCHIETER) normaal[x.year] = true; });
    uit.weggelaten = kwReeks.filter(function (x) { return ok(x.hoog) && x.hoog > KW_UITSCHIETER; }).map(function (x) { return x.year; });
    uit.kw = kwGemiddelden(kwReeks.filter(function (x) { return normaal[x.year]; }), 5);
    uit.eps = l.comparable_eps;
    var laatste5 = v.slice(-5).filter(function (j) { return normaal[j.year] || !ok(j.koers_hoog); }).map(function (j) { return j.comparable_eps; }).filter(pos);
    uit.epsLaag = laatste5.length ? Math.min.apply(null, laatste5) : null;
    if ((eigen !== null ? eigen : uit.groeiHistorisch) < GROEI_MIN) {
      uit.oordeel = 'vermijden'; uit.reden = eigen !== null ? 'Uw groeiverwachting is ' + String(eigen).replace('.', ',') + '% per jaar: minder dan de ' + GROEI_MIN + '% die NAIC van een groeibedrijf vraagt.' :
        'De winst per aandeel groeide ' + String(uit.groeiHistorisch).replace('.', ',') + '% per jaar (trend ' + f.year + '–' + l.year + '): minder dan de ' + GROEI_MIN + '% die NAIC van een groeibedrijf vraagt.';
      return uit;
    }
    if (!uit.kw) { uit.reden = 'Te weinig jaren met hoogste en laagste koers voor de gemiddelde K/W (minstens 3).'; return uit; }
    if (!pos(uit.eps) || !pos(uit.epsLaag)) { uit.reden = 'De winst per aandeel van het laatste jaar is niet positief.'; return uit; }
    try {
      uit.zones = koerszones({ eps: uit.eps, epsLaag: uit.epsLaag, groeiPct: uit.groei, jaren: HORIZON, kwHoog: uit.kw.hoog, kwLaag: uit.kw.laag, koers: pos(koers) ? koers : null });
    } catch (e) { uit.reden = 'Geen koerszones: ' + e.message; return uit; }
    if (!pos(koers)) { uit.reden = 'Geen verse koers in dezelfde valuta als de winst.'; return uit; }
    var z = uit.zones;
    uit.oordeel = z.zone === 'onder' || (z.zone === 'koop' && z.verhouding !== null && z.verhouding >= 3) ? 'kopen' : z.zone === 'verkoop' || z.zone === 'boven' ? 'vermijden' : 'neutraal';
    var zwak = uit.kwaliteit.filter(function (q) { return q.ok === false; });
    // Deel 5: totaalrendement. Dividendrendement = gemiddelde van de laatste 5 jaar met een bekend dividend; onbekend telt als 0 (voorzichtig).
    var dr = dividendRendement(v).slice(-5).map(function (x) { return x.waarde; }).filter(ok);
    var dgem = dr.length ? rond(dr.reduce(function (a, x) { return a + x; }, 0) / dr.length, 1) : null;
    if (z.rendementPerJaar !== null) {
      var tot = rond(z.rendementPerJaar + (dgem || 0), 1);
      uit.totaal = { koers: rond(z.rendementPerJaar, 1), dividend: dgem, totaal: tot, ok: tot >= TOTAAL_MIN, min: TOTAAL_MIN };
    }
    // Ter informatie (telt niet mee in het oordeel):
    // deel 3, relatieve waarde = K/W nu ÷ gemiddelde K/W (5 jaar) × 100; NAIC ziet het liefst 85-110%.
    // deel 5, verwacht gemiddeld rendement (PAR) = koersstijging per jaar tot winst over 5 jaar × gemiddelde K/W, plus dividend.
    var kwGem = (uit.kw.hoog + uit.kw.laag) / 2, kwNu = koers / uit.eps;
    uit.relatief = { kwNu: rond(kwNu, 1), kwGem: rond(kwGem, 1), pct: rond(kwNu / kwGem * 100, 0) };
    uit.relatief.oordeel = uit.relatief.pct > RV_HOOG ? 'duur' : uit.relatief.pct < RV_LAAG ? 'laag' : 'normaal';
    var gemKoers = z.epsToekomst * kwGem;
    uit.par = { koersDoel: rond(gemKoers, 2), pct: rond((Math.pow(gemKoers / koers, 1 / HORIZON) - 1) * 100 + (dgem || 0), 1) };
    uit.reden = z.zone === 'onder' ? 'De koers staat onder de verwachte lage koers.' : z.zone === 'boven' ? 'De koers staat boven de verwachte hoge koers.' :
      z.zone === 'koop' ? 'De koers staat in de koopzone' + (uit.oordeel === 'kopen' ? ', met minstens 3 : 1 opwaarts tegen neerwaarts.' : ', maar met minder dan 3 : 1 opwaarts tegen neerwaarts.') :
      z.zone === 'houd' ? 'De koers staat in de houdzone.' : 'De koers staat in de verkoopzone.';
    // NAIC koopt alleen een goed bedrijf: valt een kwaliteitstoets af (deel 1 of 2), dan hoogstens Neutraal.
    var bezwaar = zwak.map(function (q) { return { omzet: 'de omzet draagt de winstgroei niet', marge: 'de marge vóór belasting daalt', roe: 'het rendement op eigen vermogen daalt' }[q.id]; });
    if (uit.totaal && !uit.totaal.ok) bezwaar.push('het verwachte totaalrendement is ' + String(uit.totaal.totaal).replace('.', ',') + '% per jaar, minder dan de ' + TOTAAL_MIN + '% die NAIC vraagt');
    if (uit.oordeel === 'kopen' && bezwaar.length) {
      uit.oordeel = 'neutraal';
      uit.reden += ' Toch geen Kopen: ' + bezwaar.join(' en ') + '.';
    }
    return uit;
  }

  var api = { trendGroei: trendGroei, ssg: ssg, kwaliteit: kwaliteit, helling: helling, GROEI_MAX: GROEI_MAX, GROEI_MIN: GROEI_MIN, TOTAAL_MIN: TOTAAL_MIN, RV_LAAG: RV_LAAG, RV_HOOG: RV_HOOG, groeiCijfers: groeiCijfers, rendementEigenVermogen: rendementEigenVermogen, nettomarges: nettomarges, margeVoorBelasting: margeVoorBelasting, uitkeringsratio: uitkeringsratio, schuldratio: schuldratio, investeringsratio: investeringsratio, historischKW: historischKW, kwGemiddelden: kwGemiddelden, dividendRendement: dividendRendement, bereik: bereik, bereikUitKoers: bereikUitKoers, koerszones: koerszones };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Naic = api;
})(typeof self !== 'undefined' ? self : this);
