const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../js/fisher.js');

function jr() {
  return [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025].map((y, i) => ({
    year: y, sales: 1000 * Math.pow(1.1, i), pretax_income: 150 + 10 * i, net_income: 110 + 8 * i, equity: 800 + 20 * i,
    rd_expense: 80 + 2 * i, sga_expense: 200, shares_diluted: 100 - i, long_term_debt: 300 }));
}

test('ondersteunende gegevens per punt, alleen feiten met bron', () => {
  const rec = { ticker: 'X', sector_yahoo: 'technologie', gegevens: { jaren: jr(), archief: { verslagen: 12, meldingen: [{ soort: 'herwerking' }, { soort: 'nieuw' }] } },
    verwachting: { datum: '2026-11-14', groei: { winst: { dit_jaar: 12.3, vijf_jaar: 9.5 }, omzet: { volgend_jaar: 6.1 } }, bijstelling: { dit_jaar: { d90: -2.4 } } },
    analisten: { advies: 'buy', aantal: 21 }, management: { governance: { audit: 3, bestuur: 6, totaal: 4, datum: '2026-10-01' } } };
  const alle = [rec].concat([1, 2, 3, 4, 5].map((i) => ({ ticker: 'P' + i, sector_yahoo: 'technologie', gegevens: { jaren: [{ year: 2025, sales: 100, pretax_income: 10 + i }] } })));
  const g = F.gegevens(rec, alle);
  assert.deepEqual(Object.keys(g).map(Number).sort((a, b) => a - b), [1, 3, 4, 5, 6, 10, 11, 12, 13, 15]);
  assert.match(g[1][0].waarde, /^\+10,0% \(2016–2025\), laatste 3 jaar \+10,0%$/);
  assert.equal(g[1][1].waarde, 'volgend boekjaar +6,1%');
  assert.match(g[3][0].waarde, /van de omzet in 2025/);
  assert.equal(g[4][0].label, 'Verkoop- en algemene kosten samen');       // geen aparte verkoopkosten: SG&A, zo benoemd
  assert.match(g[5][0].waarde, /midden van de sector technologie: 13,0%, 5 fondsen/);
  assert.equal(g[10][0].waarde, '1 keer gevonden in 12 jaarverslagen');
  assert.match(g[12].map((r) => r.waarde).join(' | '), /dit boekjaar \+12,3%.*per jaar over 5 jaar \+9,5% \| kopen \(21 analisten\) \| −2,4% in 90 dagen/);
  assert.match(g[13][0].waarde, /^−9,0% van 2016 tot 2025/);
  assert.equal(g[15][0].waarde, 'bestuur 6, totaal 4');
  [2, 7, 8, 9, 14].forEach((p) => assert.equal(g[p], undefined));
});

test('zonder gegevens niets, en sector-midden pas vanaf 5 fondsen', () => {
  assert.deepEqual(F.gegevens({}, []), {});
  const rec = { ticker: 'X', sector_yahoo: 'energie', gegevens: { jaren: jr() } };
  assert.equal(F.sectorMidden(rec, [rec, { ticker: 'Y', sector_yahoo: 'energie', gegevens: { jaren: jr() } }]), null);
});
