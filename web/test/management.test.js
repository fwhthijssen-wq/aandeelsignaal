const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/management.js');

const jr = [2019, 2020, 2021, 2022, 2023, 2024].map((y, i) => ({ year: y, shares_diluted: 1000 - i * 14, net_income: 100 + i * 10, equity: 700 }));
const rec = { management: {
  ceo: { naam: 'Ms. Jane Doe', functie: 'CEO', geboren: 1968 },
  bestuurders: [{ naam: 'Ms. Jane Doe', functie: 'CEO' }, { naam: 'Mr. John Roe', functie: 'CFO' }],
  bezit_insiders_pct: 2.41, bezit_instellingen_pct: 61.25,
  governance: { audit: 2, bestuur: 3, beloning: 7, aandeelhoudersrechten: 1, totaal: 3, datum: '2025-10-01' },
  insiders: { aankopen: 3, verkopen: 0, personen_gekocht: 2, personen_verkocht: 0, van: '2025-10-29', tot: '2026-10-29', bron: 'Yahoo Finance (insidertransacties)' },
  datum: '2026-10-29', bron: 'Yahoo Finance' } };

const regel = (f, id) => f.regels.find(r => r.id === id);

test('management: alle feiten', () => {
  const f = M.feiten(rec, jr);
  assert.equal(f.bekend, 6);
  assert.equal(regel(f, 'ceo').waarde, 'Ms. Jane Doe (geboren 1968)');
  assert.equal(regel(f, 'bezit').waarde, '2,4%');
  assert.equal(regel(f, 'insiders').waarde, '3 aankopen (2 personen), 0 verkopen');
  assert.equal(regel(f, 'insiders').richting, 'aan');
  assert.equal(regel(f, 'aandelen').label, 'Aantal aandelen 2019–2024');
  assert.equal(regel(f, 'aandelen').waarde, '−7,0% (inkoop eigen aandelen)');
  assert.equal(regel(f, 'roe').waarde, '15,7% → 21,4%');
  assert.match(regel(f, 'governance').waarde, /^3 \/ 10 \(audit 2, bestuur 3, beloning 7/);
  assert.equal(f.bestuurders.length, 2);
});
test('management: zonder gegevens alles onbekend, niets verzonnen', () => {
  const f = M.feiten({}, []);
  assert.equal(f.bekend, 0);
  assert.ok(f.regels.every(r => r.waarde === null));
  assert.deepEqual(f.bestuurders, []);
});
test('management: aandelen en rendement vragen minstens 4 jaar', () => {
  assert.equal(M.aandelenVerloop(jr.slice(-3)), null);
  assert.equal(M.roeVerloop(jr.slice(-3)), null);
  assert.deepEqual(M.aandelenVerloop(jr.slice(-5)), { van: 2020, tot: 2024, pct: -5.7 });
  const uitgifte = [{ year: 2020, shares_diluted: 100 }, { year: 2025, shares_diluted: 120 }];
  assert.equal(regel(M.feiten({}, uitgifte), 'aandelen').waarde, '+20,0% (nieuwe aandelen uitgegeven)');
  const hoog = [2020, 2021, 2022, 2023].map(y => ({ year: y, net_income: 90, equity: 60 }));
  assert.match(regel(M.feiten({}, hoog), 'roe').waarde, /^150,0% → 150,0% \(weinig zeggend/);
  const een = { management: { insiders: { aankopen: 1, verkopen: 1, personen_gekocht: 1, personen_verkocht: 1, van: 'a', tot: 'b', bron: 'Y' } } };
  assert.equal(regel(M.feiten(een, []), 'insiders').waarde, '1 aankoop (1 persoon), 1 verkoop (1 persoon)');
  assert.equal(regel(M.feiten(een, []), 'insiders').toelichting, null);
  assert.match(regel(M.feiten({ ...een, ticker: 'BP.L' }, []), 'insiders').toelichting, /personeelsregelingen/);
  assert.equal(M.roeVerloop([2020, 2021, 2022, 2023].map(y => ({ year: y, net_income: 5, equity: -10 }))), null);   // negatief eigen vermogen telt niet
});
