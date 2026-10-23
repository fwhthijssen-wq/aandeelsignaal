const test = require('node:test');
const assert = require('node:assert');
const S = require('../js/signaal.js');

function b(profiel, scores) {
  const ids = ['bedrijf', 'groei', 'prijs', 'koers', 'eigen'], map = { g: 'gunstig', n: 'neutraal', o: 'ongunstig', l: null };
  return { ticker: profiel, vragen: ids.map((id, i) => ({ id, oordeel: map[profiel[i]], dekking: profiel[i] === 'l' ? 0 : 80, score: scores ? scores[i] : (profiel[i] === 'g' ? 0.6 : profiel[i] === 'o' ? -0.6 : profiel[i] === 'n' ? 0 : null) })) };
}

test('vijf vragen, elk met eigen methoden; samen alle methoden precies één keer', () => {
  const alle = S.VRAGEN.flatMap(v => v.methoden).sort();
  assert.deepEqual(alle, S.METHODEN.map(m => m.id).sort());
});

test('regels: NAIC eist bedrijf, groei en prijs gunstig', () => {
  assert.equal(S.voldoet(b('gggol'), 'naic'), true);
  assert.equal(S.voldoet(b('ggogl'), 'naic'), false);
  assert.equal(S.voldoet(b('gnngl'), 'kwaliteit'), true);
  assert.equal(S.voldoet(b('glngl'), 'kwaliteit'), false);      // groei onbekend telt niet als voldoende
  assert.equal(S.voldoet(b('nlogl'), 'trend'), true);
  assert.equal(S.profiel(b('gglnl')), 'gglnl');
});

test('rangorde binnen een regel: meer gunstig eerst, daarna de scores', () => {
  const lijst = [b('gggol', [0.3, 0.3, 0.3, -1, null]), b('ggggl', [0.4, 0.4, 0.4, 0.5, null]), b('gggnl', [0.9, 0.9, 0.9, 0, null])];
  assert.deepEqual(S.kandidatenRegel(lijst, 'naic', 5).map(x => x.ticker), ['gggnl', 'ggggl', 'gggol']);
  assert.deepEqual(S.kandidatenRegel(lijst, 'alles', 5).map(x => x.ticker), ['ggggl', 'gggnl', 'gggol']);
});

test('bank: methoden die niet passen tellen niet mee in de noemer', () => {
  const rec = { ticker: 'BANK', valuta: 'EUR', koers: null, gegevens: { waarschuwingen: ['Bank: test'], eps_status: 'independently_verified', eps_verified_years: 10, rejected_sources: 0, currencies: ['EUR'],
    jaren: [2019, 2020, 2021, 2022, 2023].map(y => ({ year: y, sales: 100 + y - 2019, net_income: 20, comparable_eps: 1 + (y - 2019) / 10, equity: 100 })) } };
  const r = S.beoordeel(rec, { vandaag: '2026-10-22', gate: { priceFreshness: () => ({ fresh: false }), REQUIRED_EPS_YEARS: 10 }, naic: null });
  const bedrijf = r.vragen.find(v => v.id === 'bedrijf');
  assert.ok(r.methoden.find(m => m.id === 'roe').nvt);
  assert.equal(bedrijf.dekking, 38);       // alleen nettomarge (5) en Piotroski (8) tellen; nettomarge aanwezig: 5/13
});

test('momentopname met vijf vragen blijft bewaard, onzin niet', function () {
  var Store = require('../js/store.js');
  var mem = {}, w = Store.maak({ getItem: function (k) { return k in mem ? mem[k] : null; }, setItem: function (k, v) { mem[k] = String(v); } });
  w.voegToe('ASML.AS', { oordeel: null, dekking: 70, datum: '2026-10-23', profiel: 'ggogl', regel: 'naic', voldoet: false });
  w.voegToe('INGA.AS', { oordeel: null, dekking: 70, datum: '2026-10-23', profiel: 'xx<b>', regel: 'NAIC!', voldoet: 'ja' });
  var v = w.volglijst();
  assert.strictEqual(v[0].sinds.profiel, 'ggogl'); assert.strictEqual(v[0].sinds.regel, 'naic'); assert.strictEqual(v[0].sinds.voldoet, false);
  assert.ok(!('profiel' in v[1].sinds) && !('regel' in v[1].sinds) && !('voldoet' in v[1].sinds));
});

test('Fondsen op kansrijkheid: eerst wie aan de regel voldoet, dan rang', function () {
  var D = require('../js/dashboard.js');
  var items = [{ ticker: 'A', naam: 'A', voldoet: false, rang: 3 }, { ticker: 'B', naam: 'B', voldoet: true, rang: 1 }, { ticker: 'C', naam: 'C', voldoet: true, rang: 2 }, { ticker: 'D', naam: 'D', voldoet: false, rang: null }];
  assert.deepStrictEqual(D.fondsen(items, { sorteer: 'kansrijk' }).map(function (x) { return x.ticker; }), ['C', 'B', 'A', 'D']);
  assert.strictEqual(D.perIndex(D.fondsen(items, {}))[0].positief, 2);
});
