/* Dashboard op Start: spreiding van de portefeuille, aandachtspunten en een sorteerbare tabel.
   Alleen tellen en verhoudingen; geen advies. Onbekend blijft onbekend (null) en telt nergens mee.
   Spreiding per valuta: er wordt nooit omgerekend tussen valuta's. */
(function (root) {
  'use strict';
  function afrond(x) { return Math.round(x * 10) / 10; }

  /* Verdeling van de waarde per land, apart voor elke valuta. Alleen aankopen met een verse koers (status ok). */
  function spreiding(regels, aandelen) {
    var land = {}, per = {};
    (aandelen || []).forEach(function (a) { land[a.ticker] = a.land || 'Onbekend'; });
    (regels || []).forEach(function (r) {
      if (!r || r.status !== 'ok' || typeof r.waarde !== 'number' || !(r.waarde > 0)) return;
      var v = r.positie.valuta, l = land[r.positie.ticker] || 'Onbekend';
      var o = per[v] || (per[v] = { valuta: v, totaal: 0, landen: {} });
      o.totaal += r.waarde; o.landen[l] = (o.landen[l] || 0) + r.waarde;
    });
    return Object.keys(per).sort().map(function (v) {
      var o = per[v];
      var delen = Object.keys(o.landen).map(function (l) { return { land: l, waarde: o.landen[l], pct: afrond(o.landen[l] / o.totaal * 100) }; })
        .sort(function (a, b) { return b.waarde - a.waarde || (a.land < b.land ? -1 : 1); });
      return { valuta: v, totaal: o.totaal, delen: delen };
    });
  }

  /* Aandachtspunten: tellingen met een duidelijke reden; geen oordelen over aandelen. */
  function aandacht(rijen, volgTickers, regels) {
    var vol = {}; (volgTickers || []).forEach(function (t) { vol[t] = true; });
    var inVolg = (rijen || []).filter(function (r) { return vol[r.ticker]; });
    var buiten = (regels || []).filter(function (r) { return r.status !== 'ok'; }).length;
    return {
      bevestigd: (rijen || []).filter(function (r) { return r.bevestigd; }).length,
      totaal: (rijen || []).length,
      verouderdVolglijst: inVolg.filter(function (r) { return !r.koersActueel; }).length,
      volglijst: inVolg.length,
      positiesZonderWaarde: buiten
    };
  }

  /* Hoeveel volglijst-aandelen heeft u een kwaliteitscheck gedaan? Alleen tellen; geen oordeel, geen score. */
  function checklistStand(volTickers, antwoordenVan, voortgang) {
    var uit = { volglijst: 0, klaar: 0, bezig: 0, leeg: 0 }, gezien = {};
    (volTickers || []).forEach(function (t) {
      if (gezien[t]) return; gezien[t] = true; uit.volglijst++;
      var v = voortgang(antwoordenVan(t));
      if (v.beantwoord === 0) uit.leeg++; else if (v.beantwoord >= v.totaal) uit.klaar++; else uit.bezig++;
    });
    return uit;
  }

  /* Waar staat de koers nu in uw eigen koerszones? Alleen bij een bevestigd aandeel met verse koers; anders null met reden.
     De zones zijn uw eigen aannames, geen koersdoel. */
  function zoneOverzicht(zones, recs, vandaag, gate, naic) {
    var per = {}; (recs || []).forEach(function (r) { per[r.ticker] = r; });
    return Object.keys(zones || {}).sort().map(function (t) {
      var rec = per[t]; if (!rec) return null;
      var rij = gate.maakRij(rec, vandaag), z = zones[t], uit = { ticker: t, naam: rec.naam, zone: null, reden: null, koers: null, verhouding: null };
      if (!rij.koersActueel) { uit.reden = 'Geen actuele koers.'; return uit; }
      if (!rij.bevestigd) { uit.reden = 'Gegevens nog niet bevestigd.'; return uit; }
      try {
        var k = naic.koerszones({ eps: z.eps, epsLaag: z.epsLaag, groeiPct: z.groeiPct, jaren: z.jaren, kwHoog: z.kwHoog, kwLaag: z.kwLaag, koers: rec.koers.slot });
        uit.zone = k.zone; uit.koers = rec.koers.slot; uit.verhouding = k.verhouding == null ? null : Math.round(k.verhouding * 10) / 10;
      } catch (e) { uit.reden = 'Uw aannames kloppen niet meer: ' + e.message; }
      return uit;
    }).filter(Boolean);
  }

  var KOLOMMEN = ['naam', 'afstandPct', 'omzetgroei', 'epsgroei', 'nettomarge', 'positiePct', 'verhouding'];

  /* Tabelregels uit Vergelijk.kant; filter en sortering. Null staat altijd onderaan. */
  function tabel(kanten, opties) {
    opties = opties || {};
    var sleutel = KOLOMMEN.indexOf(opties.sorteer) > -1 ? opties.sorteer : 'naam';
    var dir = opties.richting === 'af' ? -1 : 1;
    var lijst = (kanten || []).filter(function (k) { return (!opties.alleenBevestigd || k.bevestigd) && (opties.trend200 !== 'boven' && opties.trend200 !== 'onder' || k.trend200 === opties.trend200) && (!opties.index || (k.indices || []).indexOf(opties.index) > -1); });
    return lijst.slice().sort(function (a, b) {
      var x = a[sleutel], y = b[sleutel];
      if (sleutel === 'naam') { x = String(x).toLowerCase(); y = String(y).toLowerCase(); return x < y ? -dir : x > y ? dir : 0; }
      var nx = typeof x !== 'number', ny = typeof y !== 'number';
      if (nx || ny) return nx === ny ? (a.naam < b.naam ? -1 : 1) : nx ? 1 : -1;
      return x === y ? (a.naam < b.naam ? -1 : 1) : (x - y) * dir;
    });
  }

  /* ---- Fondsen: alle aandelen, per index gegroepeerd en sorteerbaar ---- */
  var INDEX_VOLGORDE = ['AEX', 'AMX', 'BEL20', 'CAC40', 'DAX', 'FTSE', 'IBEX', 'MIB', 'VS', 'OVERIG'];
  // Elke sortering heeft één vaste, logische richting (geen knop nodig).
  var FONDS_SORTERING = { kansrijk: 0, naicRang: -1, koopAfstand: 1, naam: 1, positiePct: 1, afstandPct: 1, epsgroei: -1, omzetgroei: -1, nettomarge: -1, verhouding: -1 };
  // Kansrijkheid: eerst Kopen, dan Neutraal, dan Vermijden, dan geen oordeel; binnen elke groep de hoogste rang (gemiddelde score).
  function kansKlasse(a) { var o = a.oordeel; return o === 'kopen' || o === 'positief' ? 0 : o === 'neutraal' ? 1 : o === 'vermijden' ? 2 : 3; }
  function telt(a) { return a.oordeel === 'kopen' || a.oordeel === 'positief'; }
  function getalOfNull(x) { return typeof x === 'number' && isFinite(x) ? x : null; }

  /* items: [{ticker, naam, indices, bevestigd, oordeel, rang, dekking, positiePct, ...}]. Filter op zoektekst, index en
     bevestigd; sorteer. Kansrijkheid: eerst positief, dan neutraal, dan vermijden, dan te weinig gegevens; binnen elke
     groep de hoogste rang (score gewogen met de dekking) bovenaan. Onbekende waarden staan altijd onderaan. */
  function fondsen(items, opties) {
    opties = opties || {};
    var q = String(opties.zoek || '').trim().toLowerCase(), ix = opties.index || '';
    var sleutel = Object.prototype.hasOwnProperty.call(FONDS_SORTERING, opties.sorteer) ? opties.sorteer : 'kansrijk';
    var lijst = (items || []).filter(function (a) {
      return (!q || String(a.naam).toLowerCase().indexOf(q) > -1 || String(a.ticker).toLowerCase().indexOf(q) > -1) &&
        (!ix || indexGroepen(a).indexOf(ix) > -1) && (!opties.alleenBevestigd || a.bevestigd);
    });
    function opNaam(a, b) { var x = String(a.naam).toLowerCase(), y = String(b.naam).toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; }
    return lijst.slice().sort(function (a, b) {
      if (sleutel === 'naam') return opNaam(a, b);
      if (sleutel === 'kansrijk') {
        var k = kansKlasse(a) - kansKlasse(b); if (k) return k;
        var ra = getalOfNull(a.rang), rb = getalOfNull(b.rang);
        if (ra !== rb) { if (ra === null) return 1; if (rb === null) return -1; return rb - ra; }
        return (getalOfNull(b.dekking) || 0) - (getalOfNull(a.dekking) || 0) || opNaam(a, b);
      }
      var x = getalOfNull(a[sleutel]), y = getalOfNull(b[sleutel]);
      if (x === null || y === null) return x === y ? opNaam(a, b) : x === null ? 1 : -1;
      return x === y ? opNaam(a, b) : (x - y) * FONDS_SORTERING[sleutel];
    });
  }

  /* De groepen waar een aandeel onder valt: zijn indices, of 'VS' (Amerikaanse notering zonder punt) of 'OVERIG'. */
  function indexGroepen(a) {
    var ix = Array.isArray(a.indices) ? a.indices.filter(Boolean) : [];
    return ix.length ? ix : [String(a.ticker).indexOf('.') < 0 ? 'VS' : 'OVERIG'];
  }

  /* Gesorteerde lijst opdelen per index (een aandeel in twee indices staat in beide), in vaste volgorde. */
  function perIndex(lijst) {
    var per = {};
    (lijst || []).forEach(function (a) { indexGroepen(a).forEach(function (g) { (per[g] = per[g] || []).push(a); }); });
    var namen = Object.keys(per).sort(function (x, y) {
      var i = INDEX_VOLGORDE.indexOf(x), j = INDEX_VOLGORDE.indexOf(y);
      return (i < 0 ? 99 : i) - (j < 0 ? 99 : j) || (x < y ? -1 : 1);
    });
    return namen.map(function (g) {
      return { index: g, items: per[g], positief: per[g].filter(telt).length };
    });
  }

  var api = { zoneOverzicht: zoneOverzicht, spreiding: spreiding, aandacht: aandacht, checklistStand: checklistStand, tabel: tabel, KOLOMMEN: KOLOMMEN,
    fondsen: fondsen, perIndex: perIndex, indexGroepen: indexGroepen, FONDS_SORTERING: FONDS_SORTERING };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Dashboard = api;
})(typeof self !== 'undefined' ? self : this);
