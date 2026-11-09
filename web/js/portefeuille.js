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
      var rec = per[p.ticker], kosten = afrond(p.aantal * p.koers), r = { positie: p, naam: rec ? rec.naam : (p.naam || p.ticker), kosten: kosten, status: 'ok', reden: null, waarde: null, winst: null, pct: null };
      if (!rec || !rec.koers || typeof rec.koers.slot !== 'number' || !isFinite(rec.koers.slot) || rec.koers.slot <= 0) {
        r.status = 'geen_koers'; r.reden = rec ? 'Geen koers beschikbaar.' : 'De app volgt dit aandeel niet, dus er is geen koers.';
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

  /* Londen: een aankoopkoers in GBP die zo'n 100 keer de huidige koers is, is vrijwel zeker in pence ingevoerd
     (de bank toont pence, de app rekent in ponden). Geeft de huidige koers in pence, anders null. */
  function penceVermoeden(p, rec) {
    if (!p || !rec || !/\.L$/.test(p.ticker || '') || String(p.valuta).toUpperCase() !== 'GBP' || String(rec.valuta).toUpperCase() !== 'GBP') return null;
    var slot = rec.koers && rec.koers.slot, k = Number(p.koers);
    if (!(slot > 0) || !(k > 0)) return null;
    var r = k / slot;
    return r >= 30 && r <= 300 ? Math.round(slot * 100 * 100) / 100 : null;
  }


  /* ---- Overzicht in euro (vanaf 1.10): zoals de modelportefeuille, maar met uw eigen aankopen, kosten en verkopen ----
     - Ingelegd = betaald bedrag in euro (zoals op het afschrift) + aankoopkosten. Verkoop = ontvangen euro's − verkoopkosten.
     - Waarde nu = aantal dat u nog heeft × laatste koers × ECB-koers van vandaag (alleen met een verse koers).
     - Dividend: bruto per aandeel sinds de aankoopdatum × het aantal dat u toen had, omgerekend tegen de koers van vandaag.
     - Splitsingen na de aankoop passen het aantal aan. Index: hetzelfde bedrag in de eigen index, met dezelfde kosten. */
  var INDEX_CODES = ['AEX', 'AMX', 'BEL20', 'CAC40', 'DAX', 'FTSE', 'IBEX', 'MIB', 'VS'], INDEX_VALUTA = { FTSE: 'GBP', VS: 'USD' };
  function indexVan(rec) { var ix = (rec.indices || []).filter(function (i) { return INDEX_CODES.indexOf(i) > -1; }); return ix.length ? ix[0] : ((rec.indices || []).indexOf('ASCX') > -1 || (rec.indices || []).indexOf('NLOVERIG') > -1) ? 'AMX' : (String(rec.ticker).indexOf('.') < 0 ? 'VS' : null); }
  function fxNu(fx, v) { v = String(v || '').toUpperCase(); if (v === 'EUR') return 1; if (!fx) return null; if (v === 'GBX') return fx.GBP > 0 ? fx.GBP / 100 : null; return fx[v] > 0 ? fx[v] : null; }
  function standOp(reeks, d) {          // laatste weekstand op of vóór d (hoogstens 10 dagen eerder)
    if (!reeks || !reeks.length || !d) return null;
    var lo = 0, hi = reeks.length - 1, r = -1;
    while (lo <= hi) { var m = (lo + hi) >> 1; if (reeks[m][0] <= d) { r = m; lo = m + 1; } else hi = m - 1; }
    if (r >= 0 && (Date.parse(d) - Date.parse(reeks[r][0])) / 86400000 <= 10) return reeks[r][1];
    var n = reeks[r + 1];                  // weekstanden: de stand van dezelfde week mag ook iets later vallen
    return n && (Date.parse(n[0]) - Date.parse(d)) / 86400000 <= 6 ? n[1] : null;
  }
  function factor(splits, d) { var f = 1; (splits || []).forEach(function (s) { if (!d || s[0] > d) f *= s[1]; }); return d ? f : 1; }
  /* Koers op of vlak vóór een datum: eerst de dagkoersen (reeks), anders de weekkoersen (week). In de eenheden van nu
     (Yahoo past oude koersen aan voor latere splitsingen, net als de dividenden per aandeel). */
  function koersOp(rec, d) {
    var k = rec && rec.koers; if (!k) return null;
    var dag = k.reeks && k.reeks.length && k.reeks[0][0] <= d ? standOp(k.reeks, d) : null;
    return dag || (k.week ? standOp(k.week, d) : null);
  }
  /* Elke dividenduitkering sinds de aankoop, in volgorde. modus 'aandelen': herbeleggen in hele aandelen tegen de koers van
     die dag, het restant contant; te weinig voor één aandeel = alles contant. p.divKeuze[datum] (van het afschrift) gaat voor:
     het aantal aandelen dat u werkelijk kreeg, 0 = contant. Ontvangen aandelen tellen mee voor latere dividenden en de waarde.
     Bedragen in de valuta van het fonds; aantallen in de eenheden van nu (na latere splitsingen). */
  function dividendVerloop(p, rec, vandaag, modus) {
    var uit = { regels: [], extra: 0, contant: 0, inAandelen: 0 };
    if (!p || !p.datum || !rec || !rec.koers) return uit;
    var splits = rec.koers.splitsingen || [], verk = p.verkopen || [], effKoop = p.aantal * factor(splits, p.datum), keuze = p.divKeuze || {};
    (rec.koers.dividenden || []).slice().sort(function (a, b) { return a[0] < b[0] ? -1 : 1; }).forEach(function (x) {
      if (!(x[0] > p.datum) || x[0] > vandaag || !(x[1] > 0)) return;
      var had = effKoop + uit.extra - verk.filter(function (v) { return v.datum < x[0]; }).reduce(function (a, v) { return a + v.aantal * factor(splits, v.datum); }, 0);
      if (!(had > 1e-9)) return;
      var bedrag = x[1] * had, fd = factor(splits, x[0]), koers = koersOp(rec, x[0]);
      var r = { datum: x[0], ps: x[1], had: Math.round(had * 10000) / 10000, bedrag: Math.round(bedrag * 100) / 100, koers: koers, soort: 'contant', aandelen: 0, contant: bedrag, bron: 'app' };
      var gekregen = Object.prototype.hasOwnProperty.call(keuze, x[0]) ? keuze[x[0]] : null;
      if (gekregen !== null) {                               // zoals op het afschrift
        r.bron = 'afschrift';
        if (gekregen > 0) { r.soort = 'aandelen'; r.aandelen = gekregen; r.contant = koers ? Math.max(0, bedrag - gekregen * fd * koers) : 0; }
      } else if (modus === 'aandelen') {
        if (koers) {
          var n = Math.floor(bedrag / (koers * fd) + 1e-9);         // hele aandelen zoals ze toen waren
          if (n >= 1) { r.soort = 'aandelen'; r.aandelen = n; r.contant = bedrag - n * fd * koers; }
        } else r.geenKoers = true;
      }
      r.contant = Math.round(r.contant * 100) / 100;
      r.waardeAandelen = r.aandelen && koers ? Math.round(r.aandelen * fd * koers * 100) / 100 : 0;
      uit.extra += r.aandelen * fd; uit.contant += r.contant; uit.inAandelen += r.waardeAandelen;
      uit.regels.push(r);
    });
    uit.extra = Math.round(uit.extra * 10000) / 10000;
    return uit;
  }
  function dagenTussen(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }

  function positieInEuro(p, rec, vandaag, gate, fx, reeksen, modus) {
    var r = { positie: p, naam: rec ? rec.naam : (p.naam || p.ticker), status: 'ok', reden: null, inleg: null, opbrengst: 0, waardeOpen: 0, dividend: 0, dividendAandelen: 0, resultaat: null, pct: null,
      open: 0, extraAandelen: 0, heelVerkocht: false, perJaar: null, looptijd: null, idx: null, koersNu: null, notities: [] };
    var verk = p.verkopen || [], splits = rec && rec.koers ? rec.koers.splitsingen || [] : [];
    var fKoop = factor(splits, p.datum);
    var dv = dividendVerloop(p, rec, vandaag, modus);
    r.divVerloop = dv.regels; r.extraAandelen = dv.extra;
    var effKoop = p.aantal * fKoop, effVerk = verk.reduce(function (a, v) { return a + v.aantal * factor(splits, v.datum); }, 0);
    r.open = Math.max(0, Math.round((effKoop + dv.extra - effVerk) * 10000) / 10000);
    r.heelVerkocht = verk.length > 0 && r.open <= 1e-6;
    // Geen eurobedrag (oudere aankoop): geschat met de ECB-koers van vandaag, met een opmerking.
    var fxP = fxNu(fx, p.valuta), deelP = String(p.valuta).toUpperCase() === 'GBX' ? 1 : 1;
    var eurKoop = p.eur != null ? p.eur : (fxP ? Math.round(p.aantal * p.koers * fxP * deelP * 100) / 100 : null);
    if (eurKoop == null) { r.status = 'euro'; r.reden = 'Het bedrag dat u in euro betaalde ontbreekt en er is nog geen ECB-koers om het te schatten. Vul het aan met Bewerken (staat op het afschrift van uw bank).'; return r; }
    if (p.eur == null) r.notities.push('eurobedrag van de aankoop geschat met de ECB-koers van vandaag; vul met Bewerken het bedrag van uw afschrift in');
    r.eurKoop = eurKoop;
    r.inleg = Math.round((eurKoop + (p.kosten || 0)) * 100) / 100;
    var geschatV = false;
    r.opbrengst = Math.round(verk.reduce(function (a, v) { var e = v.eur != null ? v.eur : (fxP ? v.aantal * v.koers * fxP : 0); if (v.eur == null) geschatV = true; return a + e - (v.kosten || 0); }, 0) * 100) / 100;
    if (geschatV) r.notities.push('ontvangen bedrag van een verkoop geschat met de ECB-koers van vandaag');
    if (r.open > 0) {
      if (!rec || !rec.koers || !(rec.koers.slot > 0)) { r.status = 'geen_koers'; r.reden = rec ? 'Geen koers beschikbaar.' : 'De app volgt dit aandeel niet, dus er is geen koers.'; return r; }
      var fr = gate.priceFreshness(rec.koers.datum, vandaag);
      if (!fr.fresh) { r.status = 'verouderd'; r.reden = fr.reason; return r; }
      var pv = String(p.valuta).toUpperCase(), rv = String(rec.valuta).toUpperCase();
      if (pv !== rv && !(pv === 'GBX' && rv === 'GBP')) { r.status = 'valuta'; r.reden = 'Koers staat in ' + rv + ', uw aankoop in ' + pv + ' (bijv. een andere notering).'; return r; }
      var f = fxNu(fx, rv);
      if (!f) { r.status = 'fx'; r.reden = 'Geen wisselkoers van de ECB beschikbaar.'; return r; }
      r.koersNu = rec.koers.slot;
      r.waardeOpen = Math.round(r.open * rec.koers.slot * f * 100) / 100;
    }
    // dividend sinds de aankoop (alleen met een aankoopdatum)
    if (p.datum && rec && rec.koers) {
      var fd = fxNu(fx, rec.valuta) || 0;
      r.dividend = Math.round(dv.contant * fd * 100) / 100;                  // alleen wat u contant ontving
      r.dividendAandelen = Math.round(dv.inAandelen * fd * 100) / 100;       // in aandelen: zit in de waarde (ter informatie)
      if (dv.regels.some(function (x) { return x.geenKoers; })) r.notities.push('voor een oud dividend is de koers van toen niet bekend: dat telt als contant; vul bij Dividend het aantal aandelen van uw afschrift in');
    } else if (!p.datum) r.notities.push('zonder aankoopdatum geen dividend en geen vergelijking met de index');
    r.resultaat = Math.round((r.waardeOpen + r.opbrengst + r.dividend - r.inleg) * 100) / 100;
    r.pct = r.inleg > 0 ? Math.round(r.resultaat / r.inleg * 1000) / 10 : null;
    var eind = r.heelVerkocht ? verk.reduce(function (a, v) { return v.datum > a ? v.datum : a; }, '') : vandaag;
    if (p.datum) {
      r.looptijd = Math.max(0, dagenTussen(p.datum, eind));
      var terug = r.waardeOpen + r.opbrengst + r.dividend;
      r.perJaar = r.looptijd >= 30 && terug > 0 && r.inleg > 0 ? Math.round((Math.pow(terug / r.inleg, 365 / r.looptijd) - 1) * 1000) / 10 : null;
    }
    // index: hetzelfde bedrag in de eigen index op de aankoopdatum, verkocht in dezelfde delen
    var code = rec ? indexVan(rec) : null, reeks = code && reeksen ? reeksen[code] : null, iv = code ? INDEX_VALUTA[code] || 'EUR' : null;
    var s0 = p.datum ? standOp(reeks, p.datum) : null, sNu = reeks && reeks.length ? reeks[reeks.length - 1][1] : null;
    if (s0 && sNu) {
      var pvU = String(p.valuta).toUpperCase(), lokaal = p.aantal * p.koers / (pvU === 'GBX' ? 100 : 1);
      var fxKoop = iv === 'EUR' ? 1 : ((pvU === iv || (pvU === 'GBX' && iv === 'GBP')) && lokaal > 0 ? eurKoop / lokaal : fxNu(fx, iv));
      if (fxKoop) {
        var eenheden = eurKoop / (s0 * fxKoop), terugIdx = 0, deel = 0;
        verk.forEach(function (v) {
          var q = p.aantal > 0 ? v.aantal * factor(splits, v.datum) / effKoop : 0, sv = standOp(reeks, v.datum) || sNu;
          var lv = v.aantal * v.koers / (pvU === 'GBX' ? 100 : 1), fv = iv === 'EUR' ? 1 : ((pvU === iv || (pvU === 'GBX' && iv === 'GBP')) && lv > 0 && v.eur != null ? v.eur / lv : fxNu(fx, iv));
          terugIdx += eenheden * q * sv * (fv || 1) - (v.kosten || 0); deel += q;
        });
        var fNu = fxNu(fx, iv) || 1;
        terugIdx += eenheden * Math.max(0, 1 - deel) * sNu * fNu;
        var ires = terugIdx - r.inleg;
        r.idx = { code: code, resultaat: Math.round(ires * 100) / 100, pct: r.inleg > 0 ? Math.round(ires / r.inleg * 1000) / 10 : null };
      }
    }
    return r;
  }

  /* Rendement in de tijd (laatste 2 jaar, per week): benadering met de weekkoersen van de app en de wisselkoers van vandaag. */
  function reeksInTijd(regels, aandelen, fx, reeksen) {
    var per = {}; (aandelen || []).forEach(function (a) { per[a.ticker] = a; });
    var mee = regels.filter(function (r) { return r.status === 'ok' && r.positie.datum; });
    var datums = {}; mee.forEach(function (r) { var rec = per[r.positie.ticker]; ((rec && rec.koers && rec.koers.week) || []).forEach(function (w) { datums[w[0]] = 1; }); });
    var lijst = Object.keys(datums).sort();
    return lijst.map(function (d) {
      var inleg = 0, res = 0, iInleg = 0, iRes = 0;
      mee.forEach(function (r) {
        var p = r.positie, rec = per[p.ticker]; if (p.datum > d) return;
        var wk = rec && rec.koers && rec.koers.week ? standOp(rec.koers.week, d) : null;
        var splits = rec && rec.koers ? rec.koers.splitsingen || [] : [], verk = (p.verkopen || []).filter(function (v) { return v.datum <= d; });
        var dvl = (r.divVerloop || []).filter(function (x) { return x.datum <= d; });
        var held = p.aantal * factor(splits, p.datum) + dvl.reduce(function (a, x) { return a + x.aandelen * factor(splits, x.datum); }, 0) - verk.reduce(function (a, v) { return a + v.aantal * factor(splits, v.datum); }, 0);
        if (held > 1e-9 && wk == null) return;
        var f = fxNu(fx, rec ? rec.valuta : p.valuta) || 0, waarde = held > 1e-9 ? held * wk * f : 0;
        var opbr = verk.reduce(function (a, v) { return a + (v.eur != null ? v.eur : v.aantal * v.koers * f) - (v.kosten || 0); }, 0), div = 0;
        dvl.forEach(function (x) { div += x.contant * f; });
        var inl = r.eurKoop + (p.kosten || 0);
        inleg += inl; res += waarde + opbr + div - inl;
        if (r.idx && reeksen && reeksen[r.idx.code]) {
          var s0 = standOp(reeksen[r.idx.code], p.datum), sd = standOp(reeksen[r.idx.code], d);
          if (s0 && sd) { iInleg += inl; iRes += r.eurKoop * sd / s0 - inl; }      // benadering: zonder verkopen en wisselkoerseffect
        }
      });
      return [d, Math.round(inleg * 100) / 100, Math.round(res * 100) / 100, Math.round(iInleg * 100) / 100, Math.round(iRes * 100) / 100];
    }).filter(function (x) { return x[1] > 0; });
  }

  function overzicht(posities, aandelen, vandaag, gate, opties) {
    opties = opties || {};
    var per = {}; (aandelen || []).forEach(function (a) { per[a.ticker] = a; });
    var modi = opties.dividend || {};       // { pf-id: 'aandelen' }
    var regels = (posities || []).map(function (p) { return positieInEuro(p, per[p.ticker], vandaag, gate, opties.fx, opties.indexreeksen, modi[p.pf]); });
    var t = { inleg: 0, waardeOpen: 0, opbrengst: 0, dividend: 0, dividendAandelen: 0, resultaat: 0, idxInleg: 0, idxResultaat: 0, open: 0, gesloten: 0, gewonnen: 0, buiten: 0, metIdxRes: 0, metIdxDiv: 0 };
    regels.forEach(function (r) {
      if (r.status !== 'ok') { t.buiten++; return; }
      t.inleg += r.inleg; t.waardeOpen += r.waardeOpen; t.opbrengst += r.opbrengst; t.dividend += r.dividend; t.dividendAandelen += r.dividendAandelen; t.resultaat += r.resultaat;
      if (r.heelVerkocht) { t.gesloten++; if (r.resultaat > 0) t.gewonnen++; } else t.open++;
      if (r.idx) { t.idxInleg += r.inleg; t.idxResultaat += r.idx.resultaat; t.metIdxRes += r.resultaat; t.metIdxDiv += r.dividend + r.dividendAandelen; }
    });
    ['inleg', 'waardeOpen', 'opbrengst', 'dividend', 'dividendAandelen', 'resultaat', 'idxInleg', 'idxResultaat'].forEach(function (k) { t[k] = Math.round(t[k] * 100) / 100; });
    t.pct = t.inleg > 0 ? Math.round(t.resultaat / t.inleg * 1000) / 10 : null;
    t.idxPct = t.idxInleg > 0 ? Math.round(t.idxResultaat / t.idxInleg * 1000) / 10 : null;
    t.pctMetIdx = t.idxInleg > 0 ? Math.round(t.metIdxRes / t.idxInleg * 1000) / 10 : null;
    t.pctZonderDiv = t.idxInleg > 0 ? Math.round((t.metIdxRes - t.metIdxDiv) / t.idxInleg * 1000) / 10 : null;
    return { regels: regels, totalen: t, reeks: reeksInTijd(regels, aandelen, opties.fx, opties.indexreeksen) };
  }

  /* Dividendkalender: wat er dit kalenderjaar binnenkwam en wat er de komende 12 maanden te verwachten is. Verwachting: elk
     dividend van de afgelopen 12 maanden een jaar later opnieuw, met hetzelfde bedrag per aandeel, over het aantal dat u nu
     heeft (bruto, tegen de wisselkoers van vandaag). Een schatting: bedrijven kunnen hun dividend verhogen, verlagen of schrappen. */
  function plusJaar(d) { var x = new Date(d + 'T12:00:00Z'); x.setUTCFullYear(x.getUTCFullYear() + 1); return x.toISOString().slice(0, 10); }
  function dividendKalender(posities, aandelen, vandaag, opties) {
    opties = opties || {};
    var per = {}; (aandelen || []).forEach(function (a) { per[a.ticker] = a; });
    var jaar = vandaag.slice(0, 4), jan1 = jaar + '-01-01', jaarTerug = (parseInt(jaar, 10) - 1) + vandaag.slice(4);
    var ontvangen = [], verwacht = [];
    (posities || []).forEach(function (p) {
      var rec = per[p.ticker];
      if (!rec || !rec.koers || !p.datum) return;
      var f = fxNu(opties.fx, rec.valuta); if (!f) return;
      var modus = (opties.dividend || {})[p.pf], dv = dividendVerloop(p, rec, vandaag, modus);
      var splits = rec.koers.splitsingen || [], verk = p.verkopen || [];
      var nu = p.aantal * factor(splits, p.datum) + dv.extra - verk.reduce(function (a, v) { return a + v.aantal * factor(splits, v.datum); }, 0);
      dv.regels.forEach(function (x) {
        if (x.datum >= jan1) ontvangen.push({ ticker: p.ticker, naam: rec.naam, datum: x.datum, ps: x.ps, valuta: rec.valuta, eur: Math.round(x.contant * f * 100) / 100,
          aandelen: x.aandelen, eurAandelen: Math.round(x.waardeAandelen * f * 100) / 100 });
      });
      if (nu > 1e-9) (rec.koers.dividenden || []).forEach(function (x) {
        if (!(x[1] > 0) || !(x[0] > jaarTerug) || x[0] > vandaag) return;
        var d = plusJaar(x[0]);
        if (d > vandaag) verwacht.push({ ticker: p.ticker, naam: rec.naam, datum: d, ps: x[1], valuta: rec.valuta, eur: Math.round(x[1] * nu * f * 100) / 100, inAandelen: modus === 'aandelen' });
      });
    });
    // dezelfde aandelen in meerdere aankopen: per fonds en datum samenvoegen
    function samen(l) {
      var m = {}; l.forEach(function (x) { var k = x.ticker + '|' + x.datum; if (m[k]) { m[k].eur = Math.round((m[k].eur + x.eur) * 100) / 100; if (x.eurAandelen) { m[k].eurAandelen = Math.round(((m[k].eurAandelen || 0) + x.eurAandelen) * 100) / 100; m[k].aandelen = (m[k].aandelen || 0) + x.aandelen; } } else m[k] = Object.assign({}, x); });
      return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : a.naam.localeCompare(b.naam); });
    }
    ontvangen = samen(ontvangen); verwacht = samen(verwacht);
    var maanden = {};
    verwacht.forEach(function (x) { var k = x.datum.slice(0, 7); (maanden[k] = maanden[k] || { maand: k, eur: 0, items: [] }).items.push(x); maanden[k].eur = Math.round((maanden[k].eur + x.eur) * 100) / 100; });
    var som = function (l) { return Math.round(l.reduce(function (a, x) { return a + x.eur; }, 0) * 100) / 100; };
    var somA = Math.round(ontvangen.reduce(function (a, x) { return a + (x.eurAandelen || 0); }, 0) * 100) / 100;
    return { jaar: jaar, ontvangen: ontvangen, ontvangenEur: som(ontvangen), ontvangenAandelenEur: somA, verwacht: verwacht, verwachtEur: som(verwacht), perMaand: Object.keys(maanden).sort().map(function (k) { return maanden[k]; }) };
  }

  var api = { waardeer: waardeer, herkomst: herkomst, volg: volg, koersIn: koersIn, penceVermoeden: penceVermoeden, overzicht: overzicht, dividendKalender: dividendKalender, dividendVerloop: dividendVerloop, positieInEuro: positieInEuro, indexVan: indexVan, fxNu: fxNu };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Portefeuille = api;
})(typeof self !== 'undefined' ? self : this);
