const test = require('node:test');
const assert = require('node:assert');
const S = require('../js/signalen.js');

const b = (oordeel, zone, kwal) => ({ ticker: 'X', naic: { oordeel, zones: zone ? { zone } : null, kwaliteit: kwal || [], reden: 'r' } });

test('signaal: verkoopzone gaat voor alles, koopzone met Kopen, kwaliteit, groei, anders niets', function () {
  assert.strictEqual(S.naicSignaal(b('vermijden', 'verkoop')).soort, 'verkoop');
  assert.strictEqual(S.naicSignaal(b('vermijden', 'boven')).soort, 'verkoop');
  assert.strictEqual(S.naicSignaal(b('kopen', 'koop')).soort, 'koop');
  assert.strictEqual(S.naicSignaal(b('neutraal', 'koop', [{ id: 'marge', ok: false }])).soort, 'kwaliteit');
  assert.match(S.naicSignaal(b('neutraal', 'koop', [{ id: 'marge', ok: false }])).tekst, /marge/);
  assert.strictEqual(S.naicSignaal(b('vermijden', null)).soort, 'groei');
  assert.strictEqual(S.naicSignaal(b('neutraal', 'houd')), null);
  assert.strictEqual(S.naicSignaal({}), null);
});

test('bijwerken: eerste keer geen basis; nieuwe update schuift door; zelfde update verandert de basis niet', function () {
  let r = S.bijwerken(null, '2026-10-24', { A: 'neutraal' });
  assert.strictEqual(r.basis, null);
  r = S.bijwerken(r.opslag, '2026-10-24', { A: 'kopen' });
  assert.strictEqual(r.basis, null);
  r = S.bijwerken(r.opslag, '2026-10-25', { A: 'vermijden' });
  assert.deepStrictEqual(r.basis, { datum: '2026-10-24', oordelen: { A: 'kopen' } });
  const r2 = S.bijwerken(r.opslag, '2026-10-25', { A: 'neutraal' });
  assert.deepStrictEqual(r2.basis, r.basis);
  assert.strictEqual(S.bijwerken({ basis: 5, laatst: 'x' }, '2026-10-25', {}).basis, null);   // kapotte opslag
});

test('veranderingen: naar Kopen eerst, dan Vermijden; nieuw en verdwenen oordeel tellen mee', function () {
  const v = S.veranderingen({ datum: 'd', oordelen: { A: 'neutraal', B: 'kopen', C: 'neutraal', D: 'kopen' } }, { A: 'kopen', B: 'vermijden', C: 'neutraal', E: 'neutraal' });
  assert.deepStrictEqual(v.map((x) => x.ticker), ['A', 'B', 'E', 'D']);
  assert.deepStrictEqual(v[0], { ticker: 'A', van: 'neutraal', naar: 'kopen' });
  assert.strictEqual(v[3].naar, null);
  assert.deepStrictEqual(S.veranderingen(null, { A: 'kopen' }), []);
});

test('oordelen: alleen geldige NAIC-oordelen', function () {
  assert.deepStrictEqual(S.oordelen([{ ticker: 'A', naic: { oordeel: 'kopen' } }, { ticker: 'B', naic: { oordeel: null } }, { ticker: 'C' }]), { A: 'kopen' });
});
