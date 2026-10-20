const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../js/vergelijk.js');
const G = require('../js/gate.js');

const VANDAAG = '2026-10-20';
function jaren(start, n, sales0, eps0, groeiS, groeiE) {
  return Array.from({ length: n }, (_, i) => ({ year: start + i, sales: sales0 * Math.pow(1 + groeiS, i), comparable_eps: eps0 * Math.pow(1 + groeiE, i), net_income: sales0 * Math.pow(1 + groeiS, i) * 0.2 }));
}
function rec(o = {}) {
  return Object.assign({ ticker: 'AAA', naam: 'Aaa', valuta: 'USD', koers: { slot: 100, datum: '2026-10-19', sma50: 90 },
    gegevens: { eps_status: 'independently_verified', eps_verified_years: 10, currencies: ['USD'], rejected_sources: 0, fout: null, jaren: jaren(2016, 10, 100e9, 2, 0.1, 0.1) } }, o);
}
const gegev = (rest) => Object.assign({}, rec().gegevens, rest);

test('bevestigd aandeel: groei, marge en K/W kloppen', () => {
  const k = V.kant(rec(), VANDAAG, G);
  assert.equal(k.bevestigd, true);
  assert.equal(k.omzetgroei, 10); assert.equal(k.epsgroei, 10); assert.equal(k.nettomarge, 20);
  assert.equal(k.kw, Math.round(100 / (2 * Math.pow(1.1, 9)) * 10) / 10);
  assert.deepEqual(k.jarenBereik, [2016, 2025]);
});

test('onbevestigd aandeel: geen enkel cijfer uit de jaarverslagen, wel een reden', () => {
  for (const g of [gegev({ eps_status: 'partially_independently_verified', eps_verified_years: 6 }), gegev({ currencies: ['USD', 'EUR'] }), gegev({ rejected_sources: 1 }), gegev({ fout: 'kapot' }), null]) {
    const k = V.kant(rec({ gegevens: g }), VANDAAG, G);
    assert.equal(k.bevestigd, false);
    for (const s of ['omzetgroei', 'epsgroei', 'nettomarge', 'kw']) assert.equal(k[s], null, s);
    assert.ok(k.reden);
  }
});

test('verouderde of ontbrekende koers: geen koers, geen K/W en niet bevestigd', () => {
  for (const koers of [{ slot: 100, datum: '2026-09-01', sma50: 90 }, null]) {
    const k = V.kant(rec({ koers }), VANDAAG, G);
    assert.equal(k.koers, null); assert.equal(k.kw, null); assert.equal(k.afstandPct, null); assert.equal(k.bevestigd, false);
  }
});

test('verlies of nul winst geeft geen groei of K/W', () => {
  const jr = jaren(2016, 10, 100e9, 2, 0.1, 0.1); jr[9].comparable_eps = -1;
  const k = V.kant(rec({ gegevens: gegev({ jaren: jr }) }), VANDAAG, G);
  assert.equal(k.epsgroei, null); assert.equal(k.kw, null); assert.equal(k.omzetgroei, 10);
});

test('K/W alleen bij één valuta en een positieve winst per aandeel', () => {
  assert.equal(V.kant(rec({ gegevens: gegev({ currencies: [] }) }), VANDAAG, G).kw, null);
});

test('vergelijk geeft beide kanten en wijst geen winnaar aan', () => {
  const r = V.vergelijk(rec({ ticker: 'A' }), rec({ ticker: 'B', gegevens: gegev({ eps_verified_years: 3 }) }), VANDAAG, G);
  assert.equal(r.a.bevestigd, true); assert.equal(r.b.bevestigd, false);
  assert.equal(Object.keys(r).sort().join(), 'a,b');
});

test('twee keer hetzelfde aandeel geeft twee gelijke kanten', () => {
  const r = V.vergelijk(rec(), rec(), VANDAAG, G);
  assert.deepEqual(r.a, r.b);
});

test('kant: trend200 alleen bij verse koers en bekende sma200', () => {
  const Gate = require('../js/gate.js'), V = require('../js/vergelijk.js');
  const mk = (k) => ({ ticker: 'X', naam: 'X', valuta: 'USD', koers: k, gegevens: null });
  const vandaag = '2026-10-20';
  assert.equal(V.kant(mk({ slot: 90, datum: vandaag, sma50: 95, sma200: 100 }), vandaag, Gate).trend200, 'onder');
  assert.equal(V.kant(mk({ slot: 110, datum: vandaag, sma50: 95, sma200: 100 }), vandaag, Gate).trend200, 'boven');
  assert.equal(V.kant(mk({ slot: 110, datum: vandaag, sma50: 95 }), vandaag, Gate).trend200, null);
  assert.equal(V.kant(mk({ slot: 110, datum: '2020-01-01', sma200: 100 }), vandaag, Gate).trend200, null);
});

test('kant: plek in koersbereik alleen met verse koers en 8+ jaar; ook zonder bevestiging', () => {
  const mk = (k) => ({ ticker: 'X', naam: 'X', valuta: 'USD', koers: k, gegevens: null });
  const vandaag = '2026-10-20';
  const bereik = { hoog: 165.7, laag: 40, jaren: 10 };
  const a = V.kant(mk({ slot: 70.5, datum: vandaag, bereik }), vandaag, G);
  assert.equal(a.positiePct, 24); assert.equal(a.verhouding, 3.1); assert.equal(a.bevestigd, false);
  assert.equal(V.kant(mk({ slot: 70.5, datum: '2020-01-01', bereik }), vandaag, G).positiePct, null);
  assert.equal(V.kant(mk({ slot: 70.5, datum: vandaag, bereik: { ...bereik, jaren: 7 } }), vandaag, G).positiePct, null);
  assert.equal(V.kant(mk({ slot: 70.5, datum: vandaag }), vandaag, G).positiePct, null);
  const onder = V.kant(mk({ slot: 30, datum: vandaag, bereik }), vandaag, G);   // onder het dieptepunt
  assert.equal(onder.positiePct, 0); assert.equal(onder.verhouding, null);
});
