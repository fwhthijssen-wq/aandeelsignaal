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

  var KOLOMMEN = ['naam', 'afstandPct', 'omzetgroei', 'epsgroei', 'nettomarge'];

  /* Tabelregels uit Vergelijk.kant; filter en sortering. Null staat altijd onderaan. */
  function tabel(kanten, opties) {
    opties = opties || {};
    var sleutel = KOLOMMEN.indexOf(opties.sorteer) > -1 ? opties.sorteer : 'naam';
    var dir = opties.richting === 'af' ? -1 : 1;
    var lijst = (kanten || []).filter(function (k) { return !opties.alleenBevestigd || k.bevestigd; });
    return lijst.slice().sort(function (a, b) {
      var x = a[sleutel], y = b[sleutel];
      if (sleutel === 'naam') { x = String(x).toLowerCase(); y = String(y).toLowerCase(); return x < y ? -dir : x > y ? dir : 0; }
      var nx = typeof x !== 'number', ny = typeof y !== 'number';
      if (nx || ny) return nx === ny ? (a.naam < b.naam ? -1 : 1) : nx ? 1 : -1;
      return x === y ? (a.naam < b.naam ? -1 : 1) : (x - y) * dir;
    });
  }

  var api = { zoneOverzicht: zoneOverzicht, spreiding: spreiding, aandacht: aandacht, tabel: tabel, KOLOMMEN: KOLOMMEN };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Dashboard = api;
})(typeof self !== 'undefined' ? self : this);
