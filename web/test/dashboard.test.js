const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/dashboard.js');

const A = [{ ticker: 'A', land: 'Nederland' }, { ticker: 'B', land: 'Verenigde Staten' }, { ticker: 'C', land: 'Verenigde Staten' }, { ticker: 'E', land: 'Duitsland' }];
const reg = (t, v, w, status = 'ok') => ({ status, waarde: w, positie: { ticker: t, valuta: v } });

test('spreiding per valuta en land, nooit over valuta heen', () => {
  const s = D.spreiding([reg('A', 'EUR', 300), reg('E', 'EUR', 100), reg('B', 'USD', 600), reg('C', 'USD', 200)], A);
  assert.equal(s.length, 2);
  const eur = s.find(x => x.valuta === 'EUR'), usd = s.find(x => x.valuta === 'USD');
  assert.equal(eur.totaal, 400); assert.deepEqual(eur.delen.map(d => [d.land, d.pct]), [['Nederland', 75], ['Duitsland', 25]]);
  assert.equal(usd.totaal, 800); assert.deepEqual(usd.delen, [{ land: 'Verenigde Staten', waarde: 800, pct: 100 }]);
});

test('spreiding negeert aankopen zonder waarde of met slechte data', () => {
  const s = D.spreiding([reg('A', 'EUR', 100, 'verouderd'), reg('B', 'USD', null), reg('C', 'USD', 0), reg('C', 'USD', -5), null, reg('B', 'USD', 50)], A);
  assert.equal(s.length, 1); assert.equal(s[0].totaal, 50);
  assert.deepEqual(D.spreiding([], A), []);
  assert.deepEqual(D.spreiding(undefined, undefined), []);
});

test('onbekend aandeel krijgt land Onbekend', () => {
  const s = D.spreiding([reg('Z', 'USD', 10)], A);
  assert.equal(s[0].delen[0].land, 'Onbekend');
});

test('aandacht telt bevestigd, verouderde koersen op volglijst en posities zonder waarde', () => {
  const rijen = [{ ticker: 'A', bevestigd: true, koersActueel: true }, { ticker: 'B', bevestigd: false, koersActueel: false }, { ticker: 'C', bevestigd: true, koersActueel: false }];
  const a = D.aandacht(rijen, ['B', 'C', 'X'], [reg('A', 'EUR', 1), reg('B', 'USD', null, 'geen_koers')]);
  assert.deepEqual(a, { bevestigd: 2, totaal: 3, verouderdVolglijst: 2, volglijst: 2, positiesZonderWaarde: 1 });
});

const K = [
  { naam: 'Beta', bevestigd: true, afstandPct: 5.5, omzetgroei: 3.1, epsgroei: null, nettomarge: 12.3 },
  { naam: 'alfa', bevestigd: false, afstandPct: -2.1, omzetgroei: null, epsgroei: null, nettomarge: null },
  { naam: 'Gamma', bevestigd: true, afstandPct: null, omzetgroei: 9.4, epsgroei: 7.7, nettomarge: 25.1 }
];

test('tabel: standaard op naam, hoofdletterongevoelig', () => {
  assert.deepEqual(D.tabel(K).map(k => k.naam), ['alfa', 'Beta', 'Gamma']);
});
test('tabel: filter alleen bevestigd', () => {
  assert.deepEqual(D.tabel(K, { alleenBevestigd: true }).map(k => k.naam), ['Beta', 'Gamma']);
});
test('tabel: sorteren op getal, onbekend altijd onderaan (op en af)', () => {
  assert.deepEqual(D.tabel(K, { sorteer: 'omzetgroei', richting: 'af' }).map(k => k.naam), ['Gamma', 'Beta', 'alfa']);
  assert.deepEqual(D.tabel(K, { sorteer: 'omzetgroei', richting: 'op' }).map(k => k.naam), ['Beta', 'Gamma', 'alfa']);
  assert.deepEqual(D.tabel(K, { sorteer: 'afstandPct', richting: 'af' }).map(k => k.naam), ['Beta', 'alfa', 'Gamma']);
});
test('tabel: onbekende sorteersleutel valt terug op naam; invoer blijft ongewijzigd', () => {
  const kopie = JSON.stringify(K);
  assert.deepEqual(D.tabel(K, { sorteer: 'bevestigd; drop' }).map(k => k.naam), ['alfa', 'Beta', 'Gamma']);
  assert.equal(JSON.stringify(K), kopie);
  assert.deepEqual(D.tabel(undefined), []);
});
