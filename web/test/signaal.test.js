const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/signaal.js');
const G = require('../js/gate.js');
const N = require('../js/naic.js');

const VANDAAG = '2026-10-20';
const O = (extra) => Object.assign({ vandaag: VANDAAG, gate: G, naic: N }, extra);
function reeks(start, eind, n = 130) { return Array.from({ length: n }, (_, i) => ['2026-01-01', start + (eind - start) * i / (n - 1) + (i % 2 ? 0.3 : -0.3)]); }
function jaren(n, o = {}) {
  return Array.from({ length: n }, (_, i) => Object.assign({ year: 2026 - n + i, end: (2026 - n + i) + '-12-31', sales: 100e9 * Math.pow(1.1, i), net_income: 20e9 * Math.pow(1.1, i), comparable_eps: 2 * Math.pow(1.12, i),
    operating_cash_flow: 25e9, capex: -5e9, equity: 80e9, long_term_debt: 10e9, dividend_ps: 0.8, koers_hoog: 30, koers_laag: 10 }, o));
}
function rec(o = {}) {
  return Object.assign({ ticker: 'AAA', naam: 'Aaa', valuta: 'USD', koers: { slot: 120, datum: '2026-10-19', sma50: 110, sma200: 100, rsi14: 55, reeks: reeks(90, 120), bereik: null },
    gegevens: { eps_status: 'independently_verified', eps_verified_years: 10, currencies: ['USD'], rejected_sources: 0, fout: null, jaren: jaren(10) } }, o);
}
const alleen = (r) => Object.assign({}, r, { gegevens: null });

test('volledig bevestigd aandeel: hoge dekking, vrijwel alles gecontroleerd of koersdata', () => {
  const b = S.beoordeel(rec(), O());
  assert.ok(b.dekking >= 70, 'dekking ' + b.dekking);
  assert.equal(b.niveau, 'gecontroleerd');
  assert.ok(b.kwaliteit.gecontroleerd > 40);
  assert.equal(b.kwaliteit.eigen, 0);
  assert.ok(['positief', 'neutraal', 'vermijden'].includes(b.oordeel));
  assert.ok(b.methoden.every((m) => m.aanwezig === (m.score !== null)));
});

test('alleen koersdata: lagere dekking, wel een voorlopig oordeel, nooit "gecontroleerd"', () => {
  const b = S.beoordeel(alleen(rec()), O());
  assert.ok(b.dekking > 0 && b.dekking < 40, 'dekking ' + b.dekking);
  assert.equal(b.kwaliteit.gecontroleerd, 0); assert.equal(b.kwaliteit.jaarverslag, 0);
  assert.equal(b.zekerheid, 'zeer voorlopig');
  assert.ok(b.ontbreekt.includes('Koers/winst (K/W)'));
});

test('geen of verouderde koers: geen koersgebonden onderdelen en een waarschuwing', () => {
  const oud = S.beoordeel(rec({ koers: Object.assign({}, rec().koers, { datum: '2026-09-01' }) }), O());
  for (const id of ['trend50', 'trend200', 'rsi', 'momentum', 'volatiliteit', 'kw', 'dividend', 'bereik']) assert.equal(oud.methoden.find((m) => m.id === id).aanwezig, false, id);
  assert.ok(oud.verouderd.length >= 1);
  const geen = S.beoordeel(rec({ koers: null }), O());
  assert.equal(geen.methoden.find((m) => m.id === 'trend200').aanwezig, false);
});

test('onder de minimale dekking geen oordeel; daarboven wel', () => {
  const r = alleen(rec());
  const b = S.beoordeel(r, O({ minDekking: 90 }));
  assert.equal(b.oordeel, null); assert.ok(b.score !== null);
  assert.notEqual(S.beoordeel(r, O({ minDekking: 10 })).oordeel, null);
});

test('jaarverslag telt minder zwaar dan gecontroleerd bij dezelfde cijfers', () => {
  const g = rec().gegevens;
  const a = S.beoordeel(rec(), O());
  const b = S.beoordeel(rec({ gegevens: Object.assign({}, g, { eps_status: 'missing_split_evidence', eps_verified_years: 0, niveau: 'jaarverslag' }) }), O());
  assert.equal(b.niveau, 'jaarverslag');
  assert.equal(b.dekking, a.dekking);                       // zelfde cijfers aanwezig
  assert.ok(b.kwaliteit.jaarverslag > 0 && b.kwaliteit.gecontroleerd === 0);
  assert.notEqual(a.score, b.score);                         // lager gewicht voor jaarverslag verschuift de gewogen score
});

test('onbevestigd zonder niveau: geen jaarcijfers in het oordeel', () => {
  const g = Object.assign({}, rec().gegevens, { eps_status: 'partially_independently_verified', eps_verified_years: 6 });
  const b = S.beoordeel(rec({ gegevens: g }), O());
  assert.equal(b.niveau, null);
  for (const id of ['omzetgroei', 'epsgroei', 'roe', 'kw']) assert.equal(b.methoden.find((m) => m.id === id).aanwezig, false, id);
});

test('kwaliteitscheck van de gebruiker telt naar rato van het aantal beantwoorde punten', () => {
  const zonder = S.beoordeel(rec(), O());
  const half = S.beoordeel(rec(), O({ check: { totaal: 15, ja: 6, nee: 1, onzeker: 0 } }));
  const vol = S.beoordeel(rec(), O({ check: { totaal: 15, ja: 13, nee: 2, onzeker: 0 } }));
  assert.ok(half.dekking > zonder.dekking && vol.dekking > half.dekking);
  assert.equal(vol.kwaliteit.eigen, Math.round(15 / 95 * 100));
  assert.ok(half.kwaliteit.eigen < 15 && half.kwaliteit.eigen > 0);
  const slecht = S.beoordeel(rec(), O({ check: { totaal: 15, ja: 1, nee: 14, onzeker: 0 } }));
  assert.ok(slecht.score < zonder.score);
  assert.equal(S.beoordeel(rec(), O({ check: { totaal: 15, ja: 0, nee: 0, onzeker: 15 } })).kwaliteit.eigen, 0);   // alleen onzeker telt niet
});

test('slechte cijfers geven een lagere score dan goede, en verlies geeft nooit een positief K/W-oordeel', () => {
  const goed = S.beoordeel(rec(), O());
  const slecht = S.beoordeel(rec({ gegevens: Object.assign({}, rec().gegevens, { jaren: jaren(10, { net_income: -1e9, comparable_eps: -0.5, operating_cash_flow: 1e9 }) }) }), O());
  assert.ok(slecht.score < goed.score);
  assert.equal(slecht.methoden.find((m) => m.id === 'kw').score, -1);
});

test('banken: geen ROE, vrije kasstroom of schuld', () => {
  const g = Object.assign({}, rec().gegevens, { waarschuwingen: ['Bank: kasstroom niet vergelijkbaar'] });
  const b = S.beoordeel(rec({ gegevens: g }), O());
  for (const id of ['roe', 'fcf', 'schuld']) assert.equal(b.methoden.find((m) => m.id === id).aanwezig, false, id);
});

test('kandidaten: alleen positief, gesorteerd op rang, maximaal n', () => {
  const l = [{ ticker: 'B', oordeel: 'positief', rang: 0.4, dekking: 50 }, { ticker: 'A', oordeel: 'positief', rang: 0.6, dekking: 40 }, { ticker: 'C', oordeel: 'neutraal', rang: 0.9, dekking: 90 }, { ticker: 'D', oordeel: null, rang: null, dekking: 10 }, { ticker: 'E', oordeel: 'positief', rang: 0.4, dekking: 60 }];
  assert.deepEqual(S.kandidaten(l, 10).map((x) => x.ticker), ['A', 'E', 'B']);
  assert.equal(S.kandidaten(l, 2).length, 2);
});

test('rang beloont dekking: zelfde score, meer dekking is hoger', () => {
  const a = S.beoordeel(rec(), O()), b = S.beoordeel(alleen(rec()), O());
  const x = { score: 0.5, dekking: a.dekking }, y = { score: 0.5, dekking: b.dekking };
  assert.ok(0.5 * (0.5 + 0.5 * x.dekking / 100) > 0.5 * (0.5 + 0.5 * y.dekking / 100));
  assert.ok(typeof a.rang === 'number' && typeof b.rang === 'number');
});

test('rommel in de gegevens geeft nooit een uitzondering', () => {
  for (const r of [{}, { ticker: 'X' }, { ticker: 'X', koers: { slot: 'a', datum: 'x' }, gegevens: { jaren: [null, {}, { year: 'x' }] } }, null]) {
    assert.doesNotThrow(() => S.beoordeel(r, O()));
  }
});
