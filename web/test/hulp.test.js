const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../js/hulp.js');

test('elke pagina heeft eigen hulp met titel, uitleg en punten', () => {
  for (const s of H.SLEUTELS) { const x = H.voor(s); assert.ok(x.titel && x.intro && x.punten.length >= 2, s); }
});
test('de hulp volgt de pagina', () => {
  assert.equal(H.sleutelVoorHash('#/'), 'start');
  assert.equal(H.sleutelVoorHash(''), 'start');
  assert.equal(H.sleutelVoorHash('#/zoek'), 'markt');
  assert.equal(H.sleutelVoorHash('#/fondsen'), 'markt');
  assert.equal(H.sleutelVoorHash('#/markt'), 'markt');
  assert.equal(H.sleutelVoorHash('#/achtergrond'), 'achtergrond');
  assert.equal(H.sleutelVoorHash('#/signalen'), 'signalen');
  assert.equal(H.sleutelVoorHash('#/volglijst'), 'volglijst');
  assert.equal(H.sleutelVoorHash('#/portefeuille'), 'portefeuille');
  assert.equal(H.sleutelVoorHash('#/instellingen'), 'instellingen');
  assert.equal(H.sleutelVoorHash('#/vergelijk/AAPL/MSFT'), 'vergelijk');
  assert.equal(H.sleutelVoorHash('#/a/ASML.AS'), 'oordeel');
  for (const t of ['oordeel', 'naic', 'gezond', 'koers', 'cijfers']) assert.equal(H.sleutelVoorHash('#/a/ASML.AS/' + t), t);
  const oud = { samenvatting: 'oordeel', waarde: 'naic', check: 'gezond', gezondheid: 'cijfers', bronnen: 'cijfers' };   // oude adressen
  for (const t in oud) assert.equal(H.sleutelVoorHash('#/a/ASML.AS/' + t), oud[t]);
  assert.equal(H.sleutelVoorHash('#/a/ASML.AS/onzin'), 'oordeel');
  assert.equal(H.sleutelVoorHash('#/bestaat-niet'), 'start');
});
test('onbekende sleutel valt terug op Start', () => assert.equal(H.voor('xx').sleutel, 'start'));
