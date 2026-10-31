const test = require('node:test');
const assert = require('node:assert');
global.self = global;
const Gate = require('../js/gate.js');
const Naic = require('../js/naic.js');
const Signaal = require('../js/signaal.js');
const Afdruk = require('../js/afdruk.js');
const Management = require('../js/management.js');
const Kortetermijn = require('../js/kortetermijn.js');
const Termijn = require('../js/termijn.js');

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
  assert.match(html, /De NAIC-gids in zes stappen/);
  assert.strictEqual((html.match(/data-stap="/g) || []).length, 6);
  assert.match(html, /Evaluatie van het management/);
  assert.match(html, /Schuld t\.o\.v\. totaal kapitaal[^<]*% in 2025/);
  assert.match(html, /data-aandacht="\d+"/);
  assert.ok(!/bèta/.test(html));
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

test('Afdruk: uitkomst van het terugrekenen als het is meegegeven', function () {
  const terug = { periode: '2018–2025', datum: '28 oktober 2026', rijen: { kopen: { j1: -6.3, j3: 1.7, n: 113 } } };
  assert.match(maak(rec(), { terug }).html, /Teruggerekend over 2018–2025[^<]*−6,3%[^<]*113 gevallen/);
  assert.ok(!/Teruggerekend/.test(maak(rec()).html));
});

test('Afdruk: managementfeiten bij stap 2, kortetermijnsignaal bij Koers en de maker in de voet', function () {
  const r = rec();
  r.management = { ceo: { naam: 'Jane <b>Doe</b>', geboren: 1968 }, bezit_insiders_pct: 2.4, bestuurders: [{ naam: 'Jane Doe', functie: 'CEO' }],
    governance: { totaal: 3, audit: 2, bestuur: 3, beloning: 7, aandeelhoudersrechten: 1, datum: '2025-10-01' }, datum: '2026-10-29' };
  r.koers = Object.assign({}, r.koers, { macd: 1, macd_signaal: 0.5, mom6: 8 });
  const mg = Management.feiten(r, r.gegevens.jaren);
  const kt = Kortetermijn.kortetermijn(r.koers, true);
  const html = maak(r, { management: mg, kortetermijn: kt, maker: 'Made by Frans Thijssen' }).html;
  const stap2 = html.slice(html.indexOf('data-stap="2"'), html.indexOf('data-stap="3"'));
  assert.match(stap2, /Managementfeiten[^<]*<br>– Topman of -vrouw \(CEO\): Jane &lt;b&gt;Doe&lt;\/b&gt; \(geboren 1968\)/);
  assert.match(stap2, /Governance-risico[^<]*3 \/ 10/);
  assert.match(stap2, /Topbestuurders: Jane Doe \(CEO\)/);
  assert.match(html, /data-kortetermijn-afdruk>Trendsignaal: /);
  assert.match(html, /class="voet">Aandeel Signaal · Made by Frans Thijssen/);
  assert.ok(!/Managementfeiten/.test(maak(rec()).html));        // zonder feiten geen lege regel
});

test('Afdruk: koopmoment bij NAIC Kopen en relatieve sterkte bij Koers', function () {
  const r = rec();
  r.koers = Object.assign({}, r.koers, { macd: 1, macd_signaal: 0.5, mom6: 8, relatief: { index: 'AEX', naam: 'AEX', m3: 2.1, m6: -1.4, m12: 6 }, risico: { onder_top: -5, max_daling: -28.4, jaren: 5, beweeglijk: 24, beta: 0.9 } });
  const b = Signaal.beoordeel(r, { vandaag: VANDAAG, gate: Gate, naic: Naic, gevoeligheid: true });
  const kt = Kortetermijn.kortetermijn(r.koers, true);
  const html = maak(r, { kortetermijn: kt }).html;
  if (b.naic && b.naic.oordeel === 'kopen') assert.match(html, new RegExp('data-koopmoment-afdruk="' + kt.status + '"'));
  else assert.ok(!/data-koopmoment-afdruk/.test(html));
  assert.match(html, /data-risico-afdruk><th>Risico<\/th><td>−5,0% onder de top van 1 jaar · grootste daling 5 jaar −28,4%/);
  assert.match(html, /T\.o\.v\. AEX<\/th><td>3 mnd \+2,1% · 6 mnd −1,4% · 12 mnd \+6,0%/);
});

test('Afdruk: middellange en korte termijn bij Koers', function () {
  const r = rec();
  r.koers = Object.assign({}, r.koers, { macd: 1, macd_signaal: 0.5, mom6: 8, relatief: { naam: 'AEX', m12: 9 }, risico: { beweeglijk: 24 } });
  r.verwachting = { datum: VANDAAG, bijstelling: { dit_jaar: { d90: 4 } }, verrassingen: [{ datum: '2026-10-01', pct: 6 }], volgende_cijfers: '2027-01-27' };
  const ml = Termijn.middellang(r, Kortetermijn.kortetermijn(r.koers, true), VANDAAG), kt = Termijn.kort(r, VANDAAG, true);
  const html = maak(r, { middellang: ml, kort: kt }).html;
  assert.match(html, /data-middellang-afdruk>Middellange termijn \(3–12 maanden\): /);
  assert.match(html, /Winstverwachting analisten:<\/b> Verwachte winst per aandeel verhoogd/);
  assert.match(html, /data-kort-afdruk>Korte termijn<\/h3><ul class="punt"><li>Volgende kwartaalcijfers: 27 januari 2027/);
});
