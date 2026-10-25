/* Signalen volgens NAIC, zonder server: wat het NAIC-oordeel nu zegt over uw eigen aandelen, en wat er veranderde sinds de
   vorige gegevensupdate die u in de app zag. Het vorige overzicht staat alleen op dit toestel. Selectiehulp, geen advies. */
(function (root) {
  'use strict';
  var OORDEEL = { kopen: 'Kopen', neutraal: 'Neutraal', vermijden: 'Vermijden' };

  /* Het signaal bij één aandeel uit de NAIC-uitkomst (Naic.ssg via Signaal.beoordeel: b.naic).
     koop: koers in de koopzone (of eronder) en NAIC Kopen; verkoop: verkoopzone of erboven; kwaliteit: een NAIC-toets valt af
     (omzet draagt de winst niet, marge of rendement daalt); groei: minder groei dan NAIC vraagt; anders null (geen signaal). */
  function naicSignaal(b) {
    var n = b && b.naic;
    if (!n) return null;
    var z = n.zones, zwak = (n.kwaliteit || []).filter(function (q) { return q.ok === false; });
    if (z && (z.zone === 'verkoop' || z.zone === 'boven')) return { soort: 'verkoop', tekst: z.zone === 'boven' ? 'Koers boven de verwachte hoge koers: NAIC overweegt verkopen.' : 'Koers in de verkoopzone: NAIC overweegt verkopen.' };
    if (n.oordeel === 'kopen') return { soort: 'koop', tekst: z && z.zone === 'onder' ? 'Koers onder de verwachte lage koers: NAIC Kopen.' : 'Koers in de koopzone met minstens 3 : 1: NAIC Kopen.' };
    if (zwak.length) return { soort: 'kwaliteit', tekst: 'Kwaliteit loopt terug: ' + zwak.map(function (q) { return { omzet: 'de omzet draagt de winstgroei niet', marge: 'de marge vóór belasting daalt', roe: 'het rendement op eigen vermogen daalt' }[q.id] || q.id; }).join(' en ') + '.' };
    if (n.oordeel === 'vermijden') return { soort: 'groei', tekst: n.reden || 'NAIC Vermijden.' };
    return null;
  }

  /* NAIC-oordelen per ticker uit een lijst beoordelingen ({ticker, naic}). Zonder oordeel: niet opgenomen. */
  function oordelen(lijst) {
    var o = {};
    (lijst || []).forEach(function (b) { if (b && b.ticker && b.naic && OORDEEL[b.naic.oordeel]) o[b.ticker] = b.naic.oordeel; });
    return o;
  }

  /* Bewaarde stand bijwerken. opslag: { basis: {datum, oordelen}, laatst: {datum, oordelen} } (of null).
     datum = datum van de gegevens (nachtelijke update). Bij een nieuwe datum schuift 'laatst' door naar 'basis'.
     Geeft { opslag, basis } terug; basis is waarmee vergeleken wordt (null als er nog niets eerders is). */
  function bijwerken(opslag, datum, nu) {
    var o = opslag && typeof opslag === 'object' ? opslag : {};
    var laatst = o.laatst && o.laatst.datum && o.laatst.oordelen ? o.laatst : null;
    var basis = o.basis && o.basis.datum && o.basis.oordelen ? o.basis : null;
    if (!datum) return { opslag: o, basis: basis };
    if (!laatst || laatst.datum !== datum) {
      if (laatst && laatst.datum < datum) basis = laatst;
      laatst = { datum: datum, oordelen: nu };
    } else {
      laatst = { datum: datum, oordelen: nu };        // zelfde update: alleen bijwerken (bijv. na een nieuwe instelling)
    }
    return { opslag: { basis: basis, laatst: laatst }, basis: basis };
  }

  /* Wat er veranderde: [{ticker, van, naar}] voor tickers met een ander NAIC-oordeel dan in de basis (ook: nieuw een oordeel).
     Volgorde: naar Kopen eerst, dan naar Vermijden, dan de rest; daarbinnen op ticker. */
  function veranderingen(basis, nu) {
    if (!basis || !basis.oordelen) return [];
    var v = basis.oordelen, uit = [];
    Object.keys(nu || {}).forEach(function (t) { if (v[t] !== nu[t]) uit.push({ ticker: t, van: v[t] || null, naar: nu[t] }); });
    Object.keys(v).forEach(function (t) { if (!(t in (nu || {}))) uit.push({ ticker: t, van: v[t], naar: null }); });
    var rang = { kopen: 0, vermijden: 1, neutraal: 2 };
    return uit.sort(function (a, b) { return ((a.naar in rang ? rang[a.naar] : 3) - (b.naar in rang ? rang[b.naar] : 3)) || (a.ticker < b.ticker ? -1 : a.ticker > b.ticker ? 1 : 0); });
  }

  var api = { naicSignaal: naicSignaal, oordelen: oordelen, bijwerken: bijwerken, veranderingen: veranderingen, OORDEEL: OORDEEL };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Signalen = api;
})(typeof self !== 'undefined' ? self : this);
