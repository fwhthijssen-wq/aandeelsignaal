const test = require('node:test');
const assert = require('node:assert');
global.self = global;
const Gate = require('../js/gate.js');
const Naic = require('../js/naic.js');
const Signaal = require('../js/signaal.js');
const Afdruk = require('../js/afdruk.js');

const VANDAAG = '2026-10-27';
function rec(opties) {
  opties = opties || {};
  const eps = [2, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 4.0, 4.4, 4.8];
  const jaren = eps.map((e, i) => ({
    year: 2016 + i, end: (2016 + i) + '-12-31', currency: 'EUR', comparable_eps: e, reported_eps: e,
    koers_hoog: e * 20, koers_laag: e * 13, dividend_ps: e * 0.3,
    sales: 1e9 * (10 + i), pretax_income: 2e8 * (10 + i), net_income: 1.5e8 * (10 + i), equity: 1e9 * (6 + i * 0.6),
    operating_cash_flow: 2e8 * (10 + i), capex: 5e7 * (10 + i), total_assets: 2e10, total_liabilities: 1e10, long_term_debt: 1e9,
    shares_diluted: 7.5e7, dividends_paid: 4e7 * (10 + i), depreciation: 4e7 * (10 + i)
  }));
  return {
    ticker: 'TST.AS', naam: opties.naam || 'Test & Co', land: 'Nederland', valuta: 'EUR', beurs: 'Amsterdam', indices: ['AEX'],
    bedrijf: { sector: ['test'], beschrijving: 'Een testbedrijf.', hoofdkantoor: 'Utrecht', opgericht: 1990 },
    koers: opties.geenKoers ? null : { datum: '2026-10-26', slot: 70, sma50: 72, sma200: 68, hoog52: 90, laag52: 55, rsi14: 45 },
    gegevens: { eps_status: 'independently_verified', eps_verified_years: 10, currencies: ['EUR'], rejected_sources: 0, jaren: jaren,
      waarschuwingen: ['Een kanttekening.'], gecontroleerd_op: '2026-10-25' },
    analisten: { advies: 'buy', gemiddeld: 2.1, aantal: 12, koersdoel: 80, valuta: 'EUR', datum: '2026-10-26' }
  };
}
function maak(r, o) {
  const b = Signaal.beoordeel(r, { vandaag: VANDAAG, gate: Gate, naic: Naic, gevoeligheid: true });
  return { b, html: Afdruk.pagina(r, b, Object.assign({ Naic, Gate, vandaag: VANDAAG, gemaakt: '2026-10-26T22:00:01+00:00', uitleg: [{ naam: 'Koopzone', tekst: 'Het onderste derde.' }] }, o || {})) };
}

test('Afdruk: complete pagina met oordeel, stappen, berekening, jaarcijfers, begrippen en voorbehoud', function () {
  const { b, html } = maak(rec());
  assert.match(html, /^<!doctype html>/);
  assert.ok(b.naic && b.naic.oordeel, 'testfonds heeft een NAIC-oordeel');
  assert.ok(html.includes({ kopen: 'Kopen', neutraal: 'Neutraal', vermijden: 'Vermijden' }[b.naic.oordeel]));
  ['Groeibedrijf', 'Goed bedrijf', 'Koopzone', '3 : 1', '15% per jaar'].forEach(s => assert.ok(html.includes(s), s));
  assert.match(html, /De berekening/);
  assert.match(html, /Verwachte hoge koers/);
  assert.match(html, /<th>2016<\/th>[\s\S]*<th>2025<\/th>/);
  assert.match(html, /Gezondheidscheck: zes metingen/);
  assert.match(html, /Wat betekenen de begrippen\?/);
  assert.match(html, /Het onderste derde\./);
  assert.match(html, /geen beleggingsadvies/);
  assert.match(html, /Een kanttekening\./);
  assert.match(html, /class="zones"/);
});

test('Afdruk: tekst wordt veilig weergegeven', function () {
  const { html } = maak(rec({ naam: '<b>Kwaad</b>' }));
  assert.ok(!html.includes('<b>Kwaad</b>'));
  assert.ok(html.includes('&lt;b&gt;Kwaad&lt;/b&gt;'));
});

test('Afdruk: knoppen Afdrukken en Sluiten alleen op verzoek, en nooit op papier', function () {
  assert.ok(!maak(rec()).html.includes('class="werkbalk"'));
  const met = maak(rec(), { werkbalk: true }).html;
  assert.match(met, /class="werkbalk"[\s\S]*window\.print\(\)/);
  assert.match(met, /@media print \{ \.werkbalk \{ display: none/);
});

test('Afdruk: zonder koers geen fout; de koersband staat er wel, de koers van nu niet', function () {
  const { html } = maak(rec({ geenKoers: true }));
  assert.match(html, /Geen actuele koers/);
  assert.match(html, /class="zones"/);
  assert.ok(!html.includes('koers nu '));
});

test('Afdruk: verandert de beoordeling niet', function () {
  const r = rec(), b = Signaal.beoordeel(r, { vandaag: VANDAAG, gate: Gate, naic: Naic });
  const voor = JSON.stringify(b);
  Afdruk.pagina(r, b, { Naic, Gate, vandaag: VANDAAG });
  assert.strictEqual(JSON.stringify(b), voor);
});

test('Afdruk: fonds zonder gegevens geeft toch een pagina', function () {
  const r = { ticker: 'LEEG', naam: 'Leeg', valuta: 'EUR' };
  const { html } = maak(r);
  assert.match(html, /Leeg/);
  assert.match(html, /geen beleggingsadvies/);
});

const Kortetermijn = require('../js/kortetermijn.js');
const Management = require('../js/management.js');
function maakMet(r) { return maak(r, { Kortetermijn, Management }); }

test('Afdruk: kortetermijnsignaal met vijf checks en uitkomst, los van het NAIC-oordeel', function () {
  const r = rec();
  Object.assign(r.koers, { mom6: 8.2, macd: 1.1, macd_signaal: 0.7, kruis_dagen: 34 });
  const { html } = maakMet(r);
  assert.match(html, /data-kortetermijn="gunstig"/);
  assert.match(html, /Gunstig moment/);
  ['Koers boven gemiddelde van 200 dagen', 'sinds 34 handelsdagen', 'MACD boven de signaallijn', 'RSI niet overkocht', '5 van 5 checks'].forEach(t => assert.ok(html.includes(t), t));
});

test('Afdruk: kortetermijnsignaal "Onvoldoende gegevens" als een check ontbreekt, en niet getoond bij een oude koers', function () {
  const { html } = maakMet(rec());   // geen MACD en geen 6-maandsrendement
  assert.match(html, /Onvoldoende gegevens/);
  assert.match(html, /2 niet te berekenen/);
  const oud = rec(); oud.koers.datum = '2026-10-01';
  const h2 = maakMet(oud).html;
  assert.match(h2, /data-kortetermijn="geen"/);
  assert.ok(!h2.includes('Gunstig moment') && !h2.includes('checks</b>'));
});

test('Afdruk: management-feiten met bron, "onbekend" waar iets ontbreekt', function () {
  const r = rec();
  r.management = { datum: '2026-10-28', ceo: { naam: 'A. Jansen', geboren: 1965 }, bezit_insiders_pct: 0.4,
    insiders: { aankopen: 3, verkopen: 1, personen_gekocht: 2, personen_verkocht: 1, bron: 'Yahoo Finance', van: '2025-10-28', tot: '2026-10-28' },
    bestuurders: [{ naam: 'B. de Vries', functie: 'CFO' }] };
  const { html } = maakMet(r);
  assert.match(html, /Management: feiten/);
  ['A. Jansen (geboren 1965)', '0,40%', '3 aankopen (2 personen)', 'B. de Vries', 'Yahoo Finance, 2026-10-28', 'Rendement op eigen vermogen 2021–2025'].forEach(t => assert.ok(html.includes(t), t));
  assert.match(html, /data-feit="governance"><th scope="row">[^<]+<\/th><td><span class="zacht">onbekend/);
  assert.ok(html.indexOf('Management: feiten') < html.indexOf('<h2>Ter informatie'), 'feiten staan boven uw eigen beoordeling');
});
