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
    operating_cash_flow: 25e9, capex: -5e9, equity: 80e9, long_term_debt: 10e9, dividend_ps: 0.8, koers_hoog: 30, koers_laag: 10,
    total_assets: 200e9 * Math.pow(1.1, i), current_assets: 90e9, current_liabilities: 60e9, total_liabilities: 90e9, retained_earnings: 70e9, cash: 15e9, gross_profit: 40e9 * Math.pow(1.1, i) + i * 1e9, operating_income: 26e9 * Math.pow(1.1, i), shares_diluted: 10e9 - i * 1e7, reported_eps: 2 * Math.pow(1.12, i), eps_check: 'onderbouwd' }, o));
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
  assert.equal(vol.kwaliteit.eigen, Math.round(15 / S.METHODEN.reduce((a, m) => a + m.gewicht, 0) * 100));
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

test('eigen beoordeling (1-5) telt mee als eigen invoer; 3 is neutraal, 5 gunstig, 1 ongunstig', () => {
  const basis = S.beoordeel(rec(), O());
  const hoog = S.beoordeel(rec(), O({ verdieping: { scores: { management: 5, moat: 5 } } }));
  assert.ok(hoog.dekking > basis.dekking);
  assert.equal(hoog.methoden.find((m) => m.id === 'management').score, 1);
  assert.equal(hoog.methoden.find((m) => m.id === 'management').kwaliteit, 'eigen');
  assert.equal(S.beoordeel(rec(), O({ verdieping: { scores: { management: 3 } } })).methoden.find((m) => m.id === 'management').score, 0);
  assert.equal(S.beoordeel(rec(), O({ verdieping: { scores: { management: 1 } } })).methoden.find((m) => m.id === 'management').score, -1);
  for (const slecht of [0, 6, 2.5, '4', null]) assert.equal(S.beoordeel(rec(), O({ verdieping: { scores: { management: slecht } } })).methoden.find((m) => m.id === 'management').aanwezig, false, String(slecht));
});

test('eigen cijfer vult alleen aan wat ontbreekt en overschrijft nooit een bestaand cijfer', () => {
  const zonder = alleen(rec());
  const a = S.beoordeel(zonder, O());
  assert.equal(a.methoden.find((m) => m.id === 'roe').aanwezig, false);
  const b = S.beoordeel(zonder, O({ verdieping: { cijfers: { roe: 18, omzetgroei: 9, nettomarge: 2, epsgroei: -3 } } }));
  const roe = b.methoden.find((m) => m.id === 'roe');
  assert.equal(roe.aanwezig, true); assert.equal(roe.kwaliteit, 'eigen'); assert.equal(roe.score, 1);
  assert.match(roe.tekst, /^Uw eigen cijfer/);
  assert.equal(b.methoden.find((m) => m.id === 'nettomarge').score, -0.5);
  assert.equal(b.methoden.find((m) => m.id === 'epsgroei').score, -1);
  assert.ok(b.dekking > a.dekking && b.kwaliteit.eigen > 0);
  // met gecontroleerde cijfers wint het cijfer uit het jaarverslag, niet uw invoer
  const c = S.beoordeel(rec(), O({ verdieping: { cijfers: { roe: -50 } } }));
  assert.equal(c.methoden.find((m) => m.id === 'roe').kwaliteit, 'gecontroleerd');
  assert.ok(c.methoden.find((m) => m.id === 'roe').score > -1);
  // rommel wordt genegeerd
  const d = S.beoordeel(zonder, O({ verdieping: { cijfers: { roe: 'abc', kw: NaN, dividend: Infinity } } }));
  for (const id of ['roe', 'kw', 'dividend']) assert.equal(d.methoden.find((m) => m.id === id).aanwezig, false, id);
});

test('eigen K/W en dividend tellen ook zonder koers', () => {
  const r = rec({ koers: null, gegevens: null });
  const b = S.beoordeel(r, O({ verdieping: { cijfers: { kw: 10, dividend: 4 } } }));
  assert.equal(b.methoden.find((m) => m.id === 'kw').score, 1);
  assert.equal(b.methoden.find((m) => m.id === 'dividend').score, 1);
});

test('meer eigen informatie geeft meer dekking en dus meer zekerheid', () => {
  const r = alleen(rec());
  const n = (v) => S.beoordeel(r, O({ verdieping: v })).dekking;
  const d0 = n(null), d1 = n({ scores: { management: 4 } }), d2 = n({ scores: { management: 4, moat: 4, sector: 3, risico: 4 }, cijfers: { roe: 12, kw: 15 } });
  assert.ok(d0 < d1 && d1 < d2);
});

const J = (jaar, o) => Object.assign({ year: jaar, end: jaar + '-12-31', sales: 900, net_income: 80, comparable_eps: 0.8, operating_cash_flow: 100, capex: -10, equity: 500, long_term_debt: 200, total_assets: 1000, current_assets: 400, current_liabilities: 300,
  total_liabilities: 600, retained_earnings: 200, cash: 100, gross_profit: 300, operating_income: 120, shares_diluted: 100 }, o);
const J25 = (o) => J(2025, Object.assign({ sales: 1000, net_income: 99, comparable_eps: 1, operating_cash_flow: 130, total_assets: 1100, current_assets: 450, retained_earnings: 220, gross_profit: 360, operating_income: 150, long_term_debt: 190, shares_diluted: 99 }, o));
const gegev = (o) => Object.assign({}, rec().gegevens, o);
const metJaren = (jr, koers) => rec({ koers: koers || { slot: 10, datum: '2026-10-19', sma50: 9, reeks: reeks(8, 10) }, gegevens: gegev({ jaren: [J(jr[0].year - 3), J(jr[0].year - 2), J(jr[0].year - 1)].concat(jr), eps_status: 'independently_verified', eps_verified_years: 10 }) });
const gegev2 = (rest) => Object.assign({}, rec().gegevens, rest);
const meth = (b, id) => b.methoden.find((m) => m.id === id);

test('Piotroski: 9 van 9 bij een sterk bedrijf; verwatering en ontbrekende punten tellen correct', () => {
  const ok = S.beoordeel(metJaren([J(2024), J25()]), O());
  assert.match(meth(ok, 'piotroski').tekst, /F-score 9 van 9/); assert.equal(meth(ok, 'piotroski').score, 1);
  const verwaterd = S.beoordeel(metJaren([J(2024), J25({ shares_diluted: 110 })]), O());
  assert.match(meth(verwaterd, 'piotroski').tekst, /F-score 8 van 9/);
  const zonderGP = S.beoordeel(metJaren([J(2024, { gross_profit: undefined }), J25({ gross_profit: undefined })]), O());
  assert.match(meth(zonderGP, 'piotroski').tekst, /van 8 toetsbare/);
  const zwak = S.beoordeel(metJaren([J(2024), J25({ net_income: -5, operating_cash_flow: -2, long_term_debt: 400, current_assets: 300, shares_diluted: 150, gross_profit: 200, sales: 800 })]), O());
  assert.equal(meth(zwak, 'piotroski').score, -1);
});

test('Piotroski: te weinig toetsbare punten of geen opeenvolgende jaren geven geen score', () => {
  const kaal = (j) => ({ year: j, end: j + '-12-31', sales: 100, net_income: 5, comparable_eps: 1 });
  assert.equal(meth(S.beoordeel(metJaren([kaal(2024), kaal(2025)]), O()), 'piotroski').aanwezig, false);
  assert.equal(meth(S.beoordeel(metJaren([J(2022), J25()]), O()), 'piotroski').aanwezig, false);        // 2022 -> 2025 is geen vergelijkbaar jaarpaar
});

test('Altman Z: grenzen en vereisten', () => {
  const z = (slot) => S.beoordeel(metJaren([J(2024), J25()], { slot, datum: '2026-10-19', sma50: 9, reeks: reeks(8, slot) }), O());
  const veilig = meth(z(20), 'altman'), grijs = meth(z(10), 'altman'), nood = meth(S.beoordeel(metJaren([J(2024), J25({ operating_income: 10, retained_earnings: 0, sales: 600 })], { slot: 0.5, datum: '2026-10-19', sma50: 9, reeks: reeks(8, 0.5) }), O()), 'altman');
  assert.equal(veilig.score, 1); assert.match(veilig.tekst, /Z-score 3,8/);
  assert.equal(grijs.score, 0); assert.match(grijs.tekst, /Z-score 2,8/);
  assert.equal(nood.score, -1);
  assert.equal(meth(S.beoordeel(metJaren([J(2024), J25({ retained_earnings: undefined })]), O()), 'altman').aanwezig, false);
  const bank = rec({ gegevens: gegev2({ jaren: [J(2021), J(2022), J(2023), J(2024), J25()], waarschuwingen: ['Bank: iets'] }) });
  assert.equal(meth(S.beoordeel(bank, O()), 'altman').aanwezig, false);
  assert.equal(meth(S.beoordeel(rec({ koers: null, gegevens: gegev2({ jaren: [J(2021), J(2022), J(2023), J(2024), J25()] }) }), O()), 'altman').aanwezig, false);   // geen koers, geen beurswaarde
});

test('Magic Formula: winst/bedrijfswaarde en rendement op kapitaal', () => {
  const b = S.beoordeel(metJaren([J(2024), J25()]), O());
  assert.equal(meth(b, 'magic').score, 1); assert.match(meth(b, 'magic').tekst, /13,9%.*21,4%/);
  const duur = S.beoordeel(metJaren([J(2024), J25()], { slot: 200, datum: '2026-10-19', sma50: 9, reeks: reeks(8, 10) }), O());
  assert.ok(meth(duur, 'magic').score < 1);
  assert.equal(meth(S.beoordeel(metJaren([J(2024), J25({ cash: undefined })]), O()), 'magic').aanwezig, false);
});

test('aantal aandelen valt terug op winst/EPS alleen als het jaar onderbouwd is', () => {
  const zonder = (o) => metJaren([J(2024, { shares_diluted: undefined }), J25(Object.assign({ shares_diluted: undefined, reported_eps: 1, eps_check: 'onderbouwd' }, o))]);
  assert.equal(meth(S.beoordeel(zonder({}), O()), 'magic').aanwezig, true);
  assert.equal(meth(S.beoordeel(zonder({ eps_check: null }), O()), 'magic').aanwezig, false);
  assert.equal(meth(S.beoordeel(zonder({ reported_eps: 0 }), O()), 'magic').aanwezig, false);
});

test('uitklapinfo: uitleg, schaal en onderliggende cijfers per methode; Piotroski toont alle punten', () => {
  const b = S.beoordeel(metJaren([J(2024), J25()]), O());
  for (const m of b.methoden) { assert.ok(m.wat && m.schaal && m.nodig, m.id); }
  const p = meth(b, 'piotroski');
  assert.ok(p.detail.some((x) => /^✓ Winst is positief/.test(x)));
  assert.equal(p.detail.filter((x) => /^[✓✗?] /.test(x)).length, 9);
  const zonderGP = S.beoordeel(metJaren([J(2024, { gross_profit: undefined }), J25({ gross_profit: undefined })]), O());
  assert.ok(meth(zonderGP, 'piotroski').detail.some((x) => /^\? Brutomarge steeg \(gegevens ontbreken\)/.test(x)));
  assert.equal(meth(b, 'altman').detail.length, 5);
  assert.ok(meth(b, 'kw').detail[1].includes('2025'));
  assert.equal(S.beoordeel(alleen(rec()), O()).methoden.find((m) => m.id === 'piotroski').detail, null);   // ontbrekend: geen cijfers
});
