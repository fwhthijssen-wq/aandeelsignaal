const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../js/kortetermijn.js');

const vol = { slot: 110, sma50: 105, sma200: 100, mom6: 11.04, macd: 1.2, macd_signaal: 0.8, rsi14: 71.3, kruis_dagen: 9, kruis_minstens: false };

test('kortetermijn: niet vers of geen koers geeft null', () => {
  assert.equal(K.kortetermijn(vol, false), null);
  assert.equal(K.kortetermijn(null, true), null);
  assert.equal(K.kortetermijn({ slot: 10 }, true), null);
});
test('kortetermijn: vier van vijf is gunstig', () => {
  const t = K.kortetermijn(vol, true);
  assert.equal(t.status, 'gunstig');
  assert.equal(t.ja, 4);
  assert.equal(t.checks.find(c => c.id === 'rsi').ok, false);
  assert.equal(t.checks.find(c => c.id === 'rsi').waarde, 71.3);
  assert.equal(t.checks.find(c => c.id === 'trend200').waarde, 10);
  assert.equal(t.checks.find(c => c.id === 'kruis').dagen, 9);
  assert.equal(t.checks.find(c => c.id === 'mom6').waarde, 11);
});
test('kortetermijn: neutraal en afwachten', () => {
  assert.equal(K.kortetermijn({ ...vol, slot: 95, mom6: -2, rsi14: 50 }, true).status, 'neutraal');
  const neer = { slot: 80, sma50: 90, sma200: 100, mom6: -15, macd: -1, macd_signaal: -0.5, rsi14: 25 };
  const t = K.kortetermijn(neer, true);
  assert.equal(t.ja, 1);
  assert.equal(t.status, 'afwachten');
});
test('kortetermijn: ontbrekende check geeft onvoldoende, nooit een gok', () => {
  const t = K.kortetermijn({ ...vol, macd: null }, true);
  assert.equal(t.status, 'onvoldoende');
  assert.equal(t.bekend, 4);
  assert.equal(t.checks.find(c => c.id === 'macd').ok, null);
  assert.equal(K.kortetermijn({ ...vol, rsi14: 140 }, true).status, 'onvoldoende');
});
