const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/timing.js');

const k = { slot: 123.45, sma50: 118.2, sma200: 131.9, hoog52: 150.3, laag52: 101.7, rsi14: 62.34 };

test('timing: niet vers of leeg geeft null', () => {
  assert.equal(T.timing(k, false), null);
  assert.equal(T.timing(null, true), null);
  assert.equal(T.timing({ slot: 10 }, true), null);
});
test('timing: trend, afstand, range en rsi', () => {
  const t = T.timing(k, true);
  assert.equal(t.trend50, 'boven');
  assert.equal(t.trend200, 'onder');
  assert.equal(t.afstand200Pct, -6.4);
  assert.equal(t.rangePct, 44.8);
  assert.match(t.rangeTekst, /midden/);
  assert.equal(t.rsi, 62.3);
  assert.match(t.rsiTekst, /geen opvallende/);
});
test('timing: uitersten en ontbrekende delen blijven null', () => {
  const hoog = T.timing({ slot: 150, hoog52: 150, laag52: 100, rsi14: 83.1 }, true);
  assert.equal(hoog.rangePct, 100); assert.match(hoog.rangeTekst, /hoogste/); assert.match(hoog.rsiTekst, /gestegen/);
  assert.equal(hoog.trend200, null);
  const laag = T.timing({ slot: 99, hoog52: 150, laag52: 100, rsi14: 12 }, true);
  assert.equal(laag.rangePct, 0); assert.match(laag.rsiTekst, /gedaald/);
  assert.equal(T.timing({ slot: 5, rsi14: 140, sma50: 'x' }, true), null);
});
