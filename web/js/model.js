/* Modelportefeuille: een fictieve portefeuille die de signalen van de app automatisch volgt, om te zien hoe betrouwbaar
   ze over langere tijd zijn. Dezelfde regels voor de nachtelijke run, het terugrekenen en de tests.

   Regels
   - Kopen: het NAIC-oordeel is Kopen (variant "moment": ook een gunstig koopmoment). Voor ongeveer BEDRAG euro, en
     minstens 1 aandeel als één aandeel duurder is.
   - Verkopen: de koers staat in de NAIC-verkoopzone of erboven; een tijdelijk Neutraal verandert niets. Variant
     "kwaliteit" verkoopt ook als de kwaliteit wegvalt: geen groeibedrijf meer, een verliesjaar, of een NAIC-kwaliteitstoets
     (omzet, marge, rendement op eigen vermogen) valt af.
   - Uitvoering: het signaal ontstaat op een slotkoers; gekocht of verkocht wordt tegen de slotkoers van de eerstvolgende
     handelsdag (geen vooruitkijken). Kosten: KOSTEN euro per transactie.
   - Bedragen in euro met de dagkoers van de ECB (fx = euro per eenheid valuta). Dividend bruto op de ex-datum, als geld
     (niet herbelegd). Splitsingen passen het aantal aan. Valt een fonds uit de lijst, dan wordt het verkocht tegen de
     laatste koers.
   - Vergelijking: bij elke aankoop hetzelfde bedrag fictief in de eigen index (met dezelfde kosten), verkocht op hetzelfde
     moment. Indexen zonder dividend, behalve de DAX (die is inclusief dividend). */
(function (root) {
  'use strict';
  var BEDRAG = 1000, KOSTEN = 3, MAX_OUD = 5;
  var VARIANTEN = [
    { id: 'naic', naam: 'Alle kansen', regel: 'NAIC Kopen' },
    { id: 'kwaliteit', naam: 'Ook verkopen bij zwakkere kwaliteit', regel: 'NAIC Kopen; verkopen in de verkoopzone én als de kwaliteit wegvalt' },
    { id: 'moment', naam: 'Kansen met gunstig koopmoment', regel: 'NAIC Kopen én een gunstig koopmoment' }
  ];
  var INDEX_VALUTA = { FTSE: 'GBP', VS: 'USD' };
  var INDEX_NAAM = { AEX: 'AEX', AMX: 'AMX', BEL20: 'BEL 20', CAC40: 'CAC 40', DAX: 'DAX', FTSE: 'FTSE 100', IBEX: 'IBEX 35', MIB: 'FTSE MIB', VS: 'S&P 500' };

  function r2(x) { return Math.round(x * 100) / 100; }
  function r4(x) { return Math.round(x * 10000) / 10000; }
  function pos(x) { return typeof x === 'number' && isFinite(x) && x > 0; }
  function dagen(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }

  function koopt(variant, f) { return f.oordeel === 'kopen' && (variant.id !== 'moment' || f.moment === 'gunstig'); }
  /* Reden om te verkopen, of null. */
  function verkoopt(variant, f) {
    if (f.zone === 'verkoop' || f.zone === 'boven') return 'Verkoopzone';
    if (variant && variant.id === 'kwaliteit' && f.kwaliteit === 'zwak') return 'Kwaliteit';
    return null;
  }
  function zorgVarianten(staat) {          // nieuwe varianten in een bestaande staat: beginnen leeg vanaf nu
    VARIANTEN.forEach(function (v, i) {
      if (!staat.varianten.some(function (x) { return x.id === v.id; })) staat.varianten.splice(Math.min(i, staat.varianten.length), 0, { id: v.id, naam: v.naam, regel: v.regel, posities: [], wacht: [], historie: [], sinds: null });
    });
    staat.varianten.forEach(function (x) { var d = VARIANTEN.filter(function (v) { return v.id === x.id; })[0]; if (d) { x.naam = d.naam; x.regel = d.regel; } });
  }

  function nieuw(start, opties) {
    opties = opties || {};
    return { versie: 1, start: start, bijgewerkt: null, bedrag: opties.bedrag || BEDRAG, kosten: opties.kosten == null ? KOSTEN : opties.kosten, fx: null, teller: 0,
      varianten: VARIANTEN.map(function (v) { return { id: v.id, naam: v.naam, regel: v.regel, posities: [], wacht: [], historie: [] }; }) };
  }

  function open(v) { return v.posities.filter(function (p) { return !p.verkoop; }); }
  function openVoor(v, t) { return v.posities.filter(function (p) { return !p.verkoop && p.ticker === t; })[0] || null; }

  /* Euro per eenheid valuta. EUR is altijd 1; anders uit de dag, of de laatst bekende (hoogstens 7 dagen oud). */
  function fxVan(staat, dag, valuta) {
    if (valuta === 'EUR') return 1;
    if (dag.fx && pos(dag.fx[valuta])) return dag.fx[valuta];
    if (staat.fx && pos(staat.fx[valuta]) && dagen(staat.fx.datum, dag.datum) <= 7) return staat.fx[valuta];
    return null;
  }
  function indexStand(dag, code, datum) {
    var ix = code && dag.indexen && dag.indexen[code];
    if (!ix || !pos(ix.stand)) return null;
    if (datum && ix.datum > datum && ix.vorige && ix.vorige.datum <= datum) return ix.vorige;
    return !datum || Math.abs(dagen(ix.datum, datum)) <= 4 ? ix : null;     // stand van (vrijwel) dezelfde handelsdag
  }

  function koop(staat, v, f, order, dag) {
    var fx = fxVan(staat, dag, f.valuta);
    if (!fx || !pos(f.koers)) return null;
    var aantal = Math.max(1, Math.floor(staat.bedrag / (f.koers * fx)));
    var bedrag = r2(aantal * f.koers * fx);
    var p = { id: v.id + '-' + (++staat.teller), ticker: order.ticker, naam: f.naam || order.ticker, valuta: f.valuta, index: f.index || null, aantal: aantal,
      koop: { datum: f.koersDatum, koers: f.koers, fx: r4(fx), aantal: aantal, bedrag: bedrag, kosten: staat.kosten, signaal: order.signaal },
      dividend: [], dividendEur: 0, splitsingen: [], laatst: { datum: f.koersDatum, koers: f.koers, fx: r4(fx) }, idx: null, verkoop: null };
    var ix = indexStand(dag, p.index, f.koersDatum), ivx = ix ? fxVan(staat, dag, INDEX_VALUTA[p.index] || 'EUR') : null;
    if (ix && ivx) p.idx = { code: p.index, koop: ix.stand, eenheden: bedrag / (ix.stand * ivx), fx: r4(ivx), laatst: ix.stand, lfx: r4(ivx), verkoop: null };
    v.posities.push(p);
    return p;
  }

  function verkoop(staat, p, koers, datum, fx, reden, signaalDatum, dag) {
    p.verkoop = { datum: datum, koers: koers, fx: r4(fx), bedrag: r2(p.aantal * koers * fx), kosten: staat.kosten, reden: reden, signaal: signaalDatum || null };
    p.laatst = { datum: datum, koers: koers, fx: r4(fx) };
    if (p.idx) {
      var ix = indexStand(dag, p.idx.code, datum), ivx = fxVan(staat, dag, INDEX_VALUTA[p.idx.code] || 'EUR');
      p.idx.verkoop = ix && ivx ? ix.stand : p.idx.laatst;
      p.idx.vfx = ivx ? r4(ivx) : p.idx.lfx;
    }
  }

  /* Splitsingen en dividend sinds de aankoop, in datumvolgorde; elk maar één keer. */
  function acties(staat, p, f, dag) {
    var gezienS = {}, gezienD = {};
    p.splitsingen.forEach(function (s) { gezienS[s.datum] = true; });
    p.dividend.forEach(function (d) { gezienD[d.datum] = true; });
    var ev = [];
    (f.splitsingen || []).forEach(function (s) { if (s[0] > p.koop.datum && s[0] <= f.koersDatum && !gezienS[s[0]] && pos(s[1])) ev.push({ d: s[0], s: s[1] }); });
    (f.dividenden || []).forEach(function (x) { if (x[0] > p.koop.datum && x[0] <= f.koersDatum && !gezienD[x[0]] && pos(x[1])) ev.push({ d: x[0], div: x[1] }); });
    ev.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : (a.s ? -1 : 1); });
    ev.forEach(function (e) {
      if (e.s) { p.aantal = r4(p.aantal * e.s); p.splitsingen.push({ datum: e.d, ratio: e.s }); return; }
      var fx = fxVan(staat, dag, p.valuta) || p.laatst.fx, eur = r2(e.div * p.aantal * fx);
      p.dividend.push({ datum: e.d, ps: e.div, aantal: p.aantal, eur: eur }); p.dividendEur = r2(p.dividendEur + eur);
    });
  }

  /* Eén dag verwerken: eerst de orders van eerder uitvoeren (op een nieuwere koers), dan koersen, dividend en splitsingen
     bijwerken, dan nieuwe signalen als orders vastleggen, en tot slot de stand van die dag bewaren. Twee keer dezelfde dag
     verwerken verandert niets. */
  function stap(staat, dag) {
    var uit = { gekocht: [], verkocht: [] };
    zorgVarianten(staat);
    staat.varianten.forEach(function (v) { if (v.sinds == null) v.sinds = dag.datum; });
    if (dag.fx) staat.fx = { datum: dag.fx.datum || dag.datum, USD: dag.fx.USD, GBP: dag.fx.GBP };
    var F = dag.fondsen || {};
    staat.varianten.forEach(function (v) {
      var def = VARIANTEN.filter(function (x) { return x.id === v.id; })[0];
      // 1. orders uitvoeren
      v.wacht = v.wacht.filter(function (o) {
        var f = F[o.ticker], p = openVoor(v, o.ticker);
        if (o.soort === 'verkoop') {
          if (!p) return false;
          if (!f) { verkoop(staat, p, p.laatst.koers, p.laatst.datum, p.laatst.fx, 'Niet meer in de lijst', o.datum, dag); uit.verkocht.push(p); return false; }
          if (!(f.koersDatum > o.koersDatum) || !pos(f.koers)) return true;
          verkoop(staat, p, f.koers, f.koersDatum, fxVan(staat, dag, p.valuta) || p.laatst.fx, o.reden || 'Verkoopzone', o.datum, dag); uit.verkocht.push(p); return false;
        }
        if (p) return false;
        if (!f) return false;                                              // fonds verdwenen voordat er gekocht kon worden
        if (!(f.koersDatum > o.koersDatum) || !pos(f.koers)) return true;
        var n = koop(staat, v, f, o, dag);
        if (!n) return dagen(o.datum, dag.datum) <= 10;                    // geen wisselkoers: nog even wachten
        uit.gekocht.push(n); return false;
      });
      // 2. open posities bijwerken
      open(v).forEach(function (p) {
        var f = F[p.ticker];
        if (!f) { if (!v.wacht.some(function (o) { return o.ticker === p.ticker && o.soort === 'verkoop'; })) { verkoop(staat, p, p.laatst.koers, p.laatst.datum, p.laatst.fx, 'Niet meer in de lijst', dag.datum, dag); uit.verkocht.push(p); } return; }
        acties(staat, p, f, dag);
        if (pos(f.koers) && f.koersDatum >= p.laatst.datum) { var fx = fxVan(staat, dag, p.valuta); p.laatst = { datum: f.koersDatum, koers: f.koers, fx: fx ? r4(fx) : p.laatst.fx }; }
        if (p.idx) { var ix = indexStand(dag, p.idx.code), ivx = fxVan(staat, dag, INDEX_VALUTA[p.idx.code] || 'EUR'); if (ix) p.idx.laatst = ix.stand; if (ivx) p.idx.lfx = r4(ivx); }
      });
      // 3. nieuwe signalen (alleen op een verse koers en op dagen met signalen)
      if (dag.signalen !== false) Object.keys(F).sort().forEach(function (t) {
        var f = F[t];
        if (!f.koersDatum || dagen(f.koersDatum, dag.datum) > MAX_OUD || !pos(f.koers)) return;
        var p = openVoor(v, t), wacht = v.wacht.some(function (o) { return o.ticker === t; });
        if (wacht) return;
        var reden = p ? verkoopt(def, f) : null;
        if (reden) v.wacht.push({ ticker: t, soort: 'verkoop', datum: dag.datum, koersDatum: f.koersDatum, reden: reden });
        else if (!p && koopt(def, f)) v.wacht.push({ ticker: t, soort: 'koop', datum: dag.datum, koersDatum: f.koersDatum,
          signaal: { datum: f.koersDatum, koers: f.koers, zone: f.zone || null, moment: f.moment || null, zekerheid: f.zekerheid || null } });
      });
      // 4. stand van de dag
      var s = samenvatting(v), regel = [dag.datum, s.inleg, s.resultaat, s.idxInleg, s.idxResultaat];
      if (v.historie.length && v.historie[v.historie.length - 1][0] === dag.datum) v.historie[v.historie.length - 1] = regel;
      else v.historie.push(regel);
    });
    staat.bijgewerkt = dag.datum;
    return uit;
  }

  /* Uitkomst van één positie in euro. Open: tegen de laatste koers (zonder verkoopkosten). */
  function uitkomst(p) {
    var inleg = r2(p.koop.bedrag + p.koop.kosten);
    var waarde = p.verkoop ? r2(p.verkoop.bedrag - p.verkoop.kosten) : r2(p.aantal * p.laatst.koers * p.laatst.fx);
    var res = r2(waarde + p.dividendEur - inleg), idx = null;
    if (p.idx) {
      var iw = p.idx.verkoop != null ? p.idx.eenheden * p.idx.verkoop * p.idx.vfx - p.koop.kosten : p.idx.eenheden * p.idx.laatst * p.idx.lfx;
      idx = { resultaat: r2(iw - inleg), pct: inleg > 0 ? Math.round((iw - inleg) / inleg * 1000) / 10 : null };
    }
    var eind = p.verkoop ? p.verkoop.datum : p.laatst.datum, looptijd = Math.max(0, dagen(p.koop.datum, eind));
    var perJaar = looptijd >= 30 && inleg > 0 && (waarde + p.dividendEur) > 0 ? Math.round((Math.pow((waarde + p.dividendEur) / inleg, 365 / looptijd) - 1) * 1000) / 10 : null;
    return { inleg: inleg, waarde: waarde, dividend: p.dividendEur, resultaat: res, pct: inleg > 0 ? Math.round(res / inleg * 1000) / 10 : null, idx: idx, looptijd: looptijd, perJaar: perJaar };
  }

  function samenvatting(v) {
    var s = { open: 0, gesloten: 0, inleg: 0, inlegOpen: 0, waardeOpen: 0, dividend: 0, resultaat: 0, idxInleg: 0, idxResultaat: 0, gewonnen: 0, verloren: 0, wacht: v.wacht.length };
    v.posities.forEach(function (p) {
      var u = uitkomst(p);
      s.inleg += u.inleg; s.resultaat += u.resultaat; s.dividend += u.dividend;
      if (p.verkoop) { s.gesloten++; if (u.resultaat > 0) s.gewonnen++; else s.verloren++; } else { s.open++; s.inlegOpen += u.inleg; s.waardeOpen += u.waarde; }
      if (u.idx) { s.idxInleg += u.inleg; s.idxResultaat += u.idx.resultaat; }
    });
    ['inleg', 'inlegOpen', 'waardeOpen', 'dividend', 'resultaat', 'idxInleg', 'idxResultaat'].forEach(function (k) { s[k] = r2(s[k]); });
    s.pct = s.inleg > 0 ? Math.round(s.resultaat / s.inleg * 1000) / 10 : null;
    s.idxPct = s.idxInleg > 0 ? Math.round(s.idxResultaat / s.idxInleg * 1000) / 10 : null;
    // dezelfde posities zonder index (Helsinki) tellen niet mee in de vergelijking: daarom ook het eigen rendement over de posities mét index
    var metIdx = v.posities.filter(function (p) { return p.idx; }), rI = 0, iI = 0, dI = 0;
    metIdx.forEach(function (p) { var u = uitkomst(p); rI += u.resultaat; iI += u.inleg; dI += u.dividend; });
    s.pctMetIdx = iI > 0 ? Math.round(rI / iI * 1000) / 10 : null;
    // de meeste indexen zijn zonder dividend: daarom ook het rendement zonder dividend (alleen koers en kosten)
    s.pctZonderDiv = iI > 0 ? Math.round((rI - dI) / iI * 1000) / 10 : null;
    return s;
  }

  /* Historie verkleinen voor de app: hoogstens één punt per week, plus het laatste. */
  function perWeek(h) {
    var uit = [], wk = null;
    h.forEach(function (r, i) {
      var d = new Date(r[0] + 'T12:00:00Z'), k = d.getUTCFullYear() + '-' + Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / 604800000);
      if (k === wk) uit[uit.length - 1] = r; else uit.push(r);       // per week het laatste punt
      wk = k;
    });
    return uit;
  }

  /* Wat de app laat zien: per variant de samenvatting, de posities met hun uitkomst, wachtende orders en de historie. */
  function voorApp(staat, opties) {
    opties = opties || {};
    return { start: staat.start, bijgewerkt: staat.bijgewerkt, bedrag: staat.bedrag, kosten: staat.kosten, fx: staat.fx,
      varianten: staat.varianten.map(function (v) {
        return { id: v.id, naam: v.naam, regel: v.regel, sinds: v.sinds || staat.start, samenvatting: samenvatting(v), wacht: v.wacht.map(function (o) { return { ticker: o.ticker, soort: o.soort, datum: o.datum, reden: o.reden || null }; }),
          posities: v.posities.map(function (p) {
            return { ticker: p.ticker, naam: p.naam, valuta: p.valuta, index: p.index, aantal: p.aantal, koop: p.koop, verkoop: p.verkoop, laatst: p.laatst,
              dividend: p.dividend.length, splitsingen: p.splitsingen, uitkomst: uitkomst(p) };
          }),
          historie: opties.dagelijks ? v.historie : perWeek(v.historie) };
      }) };
  }

  var api = { BEDRAG: BEDRAG, KOSTEN: KOSTEN, VARIANTEN: VARIANTEN, INDEX_NAAM: INDEX_NAAM, INDEX_VALUTA: INDEX_VALUTA, nieuw: nieuw, stap: stap, uitkomst: uitkomst, samenvatting: samenvatting, voorApp: voorApp, perWeek: perWeek, koopt: koopt, verkoopt: verkoopt };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Model = api;
})(typeof self !== 'undefined' ? self : this);
