/* Kortetermijnsignaal: vijf vaste technische checks op de dagkoersen. Staat volledig los van het NAIC-oordeel en de
   gezondheidscheck en verandert die nooit. Bij een niet-verse koers geven we niets terug (null).
   Uitkomst: 4-5 checks ja = 'gunstig', 2-3 = 'neutraal', 0-1 = 'afwachten'; ontbreekt een check, dan 'onvoldoende'. */
(function (root) {
  'use strict';
  function pos(x) { return typeof x === 'number' && isFinite(x) && x > 0; }
  function num(x) { return typeof x === 'number' && isFinite(x); }
  function r1(x) { return Math.round(x * 10) / 10; }

  var LABEL = { gunstig: 'Gunstig moment', neutraal: 'Neutraal', afwachten: 'Afwachten', onvoldoende: 'Onvoldoende gegevens' };

  function kortetermijn(k, vers) {
    if (!vers || !k || !pos(k.slot)) return null;
    var c = [];
    c.push({ id: 'trend200', label: 'Koers boven gemiddelde van 200 dagen',
      ok: pos(k.sma200) ? k.slot > k.sma200 : null,
      waarde: pos(k.sma200) ? r1((k.slot / k.sma200 - 1) * 100) : null });
    c.push({ id: 'kruis', label: 'Gemiddelde van 50 dagen boven dat van 200 dagen',
      ok: pos(k.sma50) && pos(k.sma200) ? k.sma50 > k.sma200 : null,
      dagen: num(k.kruis_dagen) && k.kruis_dagen >= 0 ? Math.round(k.kruis_dagen) : null, minstens: k.kruis_minstens === true });
    c.push({ id: 'mom6', label: 'Koers hoger dan 6 maanden geleden',
      ok: num(k.mom6) ? k.mom6 > 0 : null, waarde: num(k.mom6) ? r1(k.mom6) : null });
    c.push({ id: 'macd', label: 'MACD boven de signaallijn',
      ok: num(k.macd) && num(k.macd_signaal) ? k.macd > k.macd_signaal : null });
    c.push({ id: 'rsi', label: 'RSI niet overkocht (onder 70)',
      ok: num(k.rsi14) && k.rsi14 >= 0 && k.rsi14 <= 100 ? k.rsi14 < 70 : null,
      waarde: num(k.rsi14) && k.rsi14 >= 0 && k.rsi14 <= 100 ? r1(k.rsi14) : null });
    var bekend = c.filter(function (x) { return x.ok !== null; }).length;
    if (!bekend) return null;
    var ja = c.filter(function (x) { return x.ok === true; }).length;
    var status = bekend < c.length ? 'onvoldoende' : ja >= 4 ? 'gunstig' : ja >= 2 ? 'neutraal' : 'afwachten';
    return { status: status, label: LABEL[status], ja: ja, bekend: bekend, totaal: c.length, checks: c };
  }

  var api = { kortetermijn: kortetermijn, LABEL: LABEL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Kortetermijn = api;
})(typeof self !== 'undefined' ? self : this);
