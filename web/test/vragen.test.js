const test = require('node:test');
const assert = require('node:assert');
const S = require('../js/signaal.js');
const G = require('../js/gate.js');

const DAG = '2026-10-23';
function reeks(n, start, stap) { const r = []; let p = start; for (let i = 0; i < n; i++) { p *= 1 + stap * (i % 2 ? -1 : 1.2); r.push(['2026-0' + (1 + Math.floor(i / 40)) + '-' + String(1 + i % 28).padStart(2, '0'), p]); } return r; }
function rec(over) {
  const jaren = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025].map((y, i) => ({ year: y, end: y + '-12-31', currency: 'EUR', sales: 1000 * (1.08 ** i), net_income: 150 * (1.1 ** i),
    comparable_eps: 1.5 * (1.1 ** i), reported_eps: 1.5 * (1.1 ** i), operating_cash_flow: 200 * (1.1 ** i), capex: -50, equity: 900, total_assets: 2000, total_liabilities: 700, eps_check: 'onderbouwd' }));
  const r = { ticker: 'TST.AS', naam: 'Test', valuta: 'EUR', koers: { slot: 30, datum: DAG, sma50: 29, sma200: 27, reeks: reeks(130, 25, 0.004) },
    gegevens: { eps_status: 'independently_verified', eps_verified_years: 10, rejected_sources: 0, currencies: ['EUR'], waarschuwingen: [], jaren } };
  return Object.assign(r, over || {});
}

test('zes kernmetingen, elk even zwaar; oordeel uit het gewone gemiddelde', function () {
  const b = S.beoordeel(rec(), { vandaag: DAG, gate: G });
  assert.deepStrictEqual(b.metingen.map(m => m.id), ['kasstroom', 'schuldgraad', 'groei', 'prijs', 'trend', 'rust']);
  assert.strictEqual(b.mogelijk, 6);
  assert.strictEqual(b.aantal, 6);
  const gem = b.metingen.reduce((a, m) => a + m.score, 0) / 6;
  assert.strictEqual(b.score, Math.round(gem * 100) / 100);
  assert.strictEqual(b.oordeel, gem >= S.DREMPEL_KOPEN ? 'kopen' : gem <= -S.DREMPEL ? 'vermijden' : 'neutraal');
  assert.strictEqual(S.profiel(b).length, 6);
});

test('uw eigen oordeel en andere methoden tellen niet mee', function () {
  const zonder = S.beoordeel(rec(), { vandaag: DAG, gate: G });
  const met = S.beoordeel(rec(), { vandaag: DAG, gate: G, check: { totaal: 15, ja: 0, nee: 15, onzeker: 0 }, verdieping: { scores: { management: 1, moat: 1, sector: 1, risico: 1 }, cijfers: {}, notities: {} } });
  assert.strictEqual(met.score, zonder.score);
  assert.strictEqual(met.oordeel, zonder.oordeel);
  const eigen = met.vragen.find(v => v.id === 'eigen');
  assert.strictEqual(eigen.kern.length, 0);
  assert.ok(eigen.info.some(m => m.id === 'management' && m.aanwezig));
});

test('ontbrekende meting heeft een reden; onder het minimum geen oordeel', function () {
  const r = rec(); r.gegevens.jaren.forEach(j => { delete j.capex; delete j.total_liabilities; });
  r.koers = null;
  const b = S.beoordeel(r, { vandaag: DAG, gate: G });
  const k = b.metingen.find(m => m.id === 'kasstroom'), s = b.metingen.find(m => m.id === 'schuldgraad'), t = b.metingen.find(m => m.id === 'trend');
  assert.ok(!k.aanwezig && /investeringen/.test(k.reden));
  assert.ok(!s.aanwezig && /verplichtingen/.test(s.reden));
  assert.ok(!t.aanwezig && /geen koers/i.test(t.reden));
  assert.strictEqual(b.aantal, 1);
  assert.strictEqual(b.oordeel, null);
  assert.strictEqual(S.beoordeel(r, { vandaag: DAG, gate: G, minMetingen: 1 }).oordeel !== null, true);
});

test('bank: rendement op eigen vermogen in plaats van kasstroom, schuldgraad vervalt', function () {
  const r = rec(); r.gegevens.waarschuwingen = ['Bank: geen vrije kasstroom'];
  const b = S.beoordeel(r, { vandaag: DAG, gate: G });
  const k = b.metingen[0], s = b.metingen[1];
  assert.strictEqual(k.methode, 'roe'); assert.strictEqual(k.kort, 'Rendement'); assert.ok(k.aanwezig);
  assert.ok(s.nvt);
  assert.strictEqual(b.mogelijk, 5);
  assert.strictEqual(S.profiel(b)[1], 'x');
});

test('balans en kasstroom tellen ook als de winst per aandeel nog niet bevestigd is', function () {
  const r = rec(); r.gegevens.eps_status = 'missing_split_evidence'; r.gegevens.eps_verified_years = 0;
  const b = S.beoordeel(r, { vandaag: DAG, gate: G });
  assert.ok(b.metingen.find(m => m.id === 'schuldgraad').aanwezig);
  assert.strictEqual(b.metingen.find(m => m.id === 'schuldgraad').kwaliteit, 'jaarverslag');
  const gr = b.metingen.find(m => m.id === 'groei');
  assert.ok(!gr.aanwezig && /niet bevestigd/.test(gr.reden));
});

test('kandidaten: alleen Kopen, hoogste score eerst', function () {
  const l = [{ ticker: 'A', oordeel: 'kopen', score: 0.6, aantal: 6 }, { ticker: 'B', oordeel: 'neutraal', score: 0.9, aantal: 6 }, { ticker: 'C', oordeel: 'kopen', score: 0.8, aantal: 5 }];
  assert.deepStrictEqual(S.kandidaten(l, 8).map(x => x.ticker), ['C', 'A']);
});

test('momentopname met oordeel Kopen en profiel blijft bewaard, onzin niet', function () {
  const Store = require('../js/store.js');
  const mem = {}, w = Store.maak({ getItem: k => k in mem ? mem[k] : null, setItem: (k, v) => { mem[k] = String(v); } });
  w.voegToe('ASML.AS', { oordeel: 'kopen', dekking: 83, datum: DAG, profiel: 'ggxgnl', aantal: 4, mogelijk: 5 });
  w.voegToe('INGA.AS', { oordeel: 'koop<b>', dekking: 70, datum: DAG, profiel: 'xx<b>', aantal: 9, mogelijk: 6 });
  const v = w.volglijst();
  assert.strictEqual(v[0].sinds.oordeel, 'kopen'); assert.strictEqual(v[0].sinds.profiel, 'ggxgnl'); assert.strictEqual(v[0].sinds.aantal, 4);
  assert.strictEqual(v[1].sinds.oordeel, null); assert.ok(!('profiel' in v[1].sinds)); assert.ok(!('aantal' in v[1].sinds));
});

test('Fondsen op kansrijkheid: Kopen, Neutraal, Vermijden, dan geen oordeel', function () {
  const D = require('../js/dashboard.js');
  const items = [{ ticker: 'A', naam: 'A', oordeel: 'neutraal', rang: 3 }, { ticker: 'B', naam: 'B', oordeel: 'kopen', rang: 0.6 }, { ticker: 'C', naam: 'C', oordeel: 'kopen', rang: 0.9 }, { ticker: 'D', naam: 'D', oordeel: null, rang: null }, { ticker: 'E', naam: 'E', oordeel: 'vermijden', rang: -0.5 }];
  assert.deepStrictEqual(D.fondsen(items, { sorteer: 'kansrijk' }).map(x => x.ticker), ['C', 'B', 'A', 'E', 'D']);
  assert.strictEqual(D.perIndex(D.fondsen(items, {}))[0].positief, 2);
});

test('bank of verzekeraar herkend aan de cijfers: geen omzet en verplichtingen ≥ 80% van de bezittingen', function () {
  const r = rec(); r.gegevens.jaren.forEach(j => { delete j.sales; j.total_assets = 1000; j.total_liabilities = 930; });
  const b = S.beoordeel(r, { vandaag: DAG, gate: G });
  assert.strictEqual(b.bank, true); assert.strictEqual(b.metingen[0].methode, 'roe'); assert.ok(b.metingen[1].nvt);
  const gewoon = rec(); gewoon.gegevens.jaren.forEach(j => { j.total_assets = 1000; j.total_liabilities = 930; });   // wel omzet: geen bank
  assert.strictEqual(S.beoordeel(gewoon, { vandaag: DAG, gate: G }).bank, false);
});
