const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../../ai_mening.js');

test('antwoord van het model: alleen de verwachte vorm, met voor- en tegenpunten', () => {
  const m = A.schoon({ voor: ['Sterke groei', '', 3], tegen: ['Cyclisch', 'Hoge waardering', 'Schuld', 'vierde'], nagaan: ['a', 'b', 'c'], afweging: ' Afwegen. ', extra: 'x' });
  assert.deepEqual(m, { voor: ['Sterke groei'], tegen: ['Cyclisch', 'Hoge waardering', 'Schuld'], nagaan: ['a', 'b'], afweging: 'Afwegen.' });
  assert.throws(() => A.schoon({ voor: ['x'], tegen: [] }));
});

test('een mening hoort bij oordeel, zone en laatste boekjaar', () => {
  const rec = { gegevens: { jaren: [{ year: 2024, comparable_eps: 1 }, { year: 2025, comparable_eps: 2 }, { year: 2026 }] } };
  assert.equal(A.sleutel(rec, { naic: { oordeel: 'kopen', zones: { zone: 'koop' } } }), 'kopen|koop|2025');
  assert.match(A.SYSTEEM, /wat tegen kopen pleit/);
});
