/* Timing-informatie: trend, plek in de 52-wekenrange en RSI. Alleen uitleg; nooit invloed op het signaal.
   Bij een niet-verse koers of ontbrekende kentallen geven we niets terug (null). */
(function (root) {
  'use strict';
  function num(x) { return typeof x === 'number' && isFinite(x) && x > 0 ? x : null; }
  function r1(x) { return Math.round(x * 10) / 10; }

  function timing(k, vers) {
    if (!vers || !k || num(k.slot) == null) return null;
    var slot = k.slot, uit = { trend50: null, trend200: null, afstand200Pct: null, rangePct: null, rangeTekst: null, rsi: null, rsiTekst: null };
    if (num(k.sma50)) uit.trend50 = slot > k.sma50 ? 'boven' : 'onder';
    if (num(k.sma200)) { uit.trend200 = slot > k.sma200 ? 'boven' : 'onder'; uit.afstand200Pct = r1((slot / k.sma200 - 1) * 100); }
    if (num(k.hoog52) && num(k.laag52) && k.hoog52 > k.laag52) {
      var p = (slot - k.laag52) / (k.hoog52 - k.laag52) * 100;
      uit.rangePct = r1(Math.min(100, Math.max(0, p)));
      uit.rangeTekst = uit.rangePct >= 80 ? 'dicht bij de hoogste koers van het jaar' : uit.rangePct <= 20 ? 'dicht bij de laagste koers van het jaar' : 'ergens in het midden van het jaarbereik';
    }
    if (typeof k.rsi14 === 'number' && isFinite(k.rsi14) && k.rsi14 >= 0 && k.rsi14 <= 100) {
      uit.rsi = r1(k.rsi14);
      uit.rsiTekst = k.rsi14 >= 70 ? 'de koers is de laatste weken hard gestegen' : k.rsi14 <= 30 ? 'de koers is de laatste weken hard gedaald' : 'geen opvallende snelle beweging';
    }
    if (uit.trend50 == null && uit.trend200 == null && uit.rangePct == null && uit.rsi == null) return null;
    return uit;
  }

  var api = { timing: timing };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Timing = api;
})(typeof self !== 'undefined' ? self : this);
