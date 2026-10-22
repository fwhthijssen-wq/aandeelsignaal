const test = require('node:test');
const assert = require('node:assert');
const D = require('../js/dashboard.js');

const items = [
  { ticker: 'ASML.AS', naam: 'ASML', indices: ['AEX'], bevestigd: true, oordeel: 'neutraal', rang: 0.1, dekking: 70, positiePct: 60 },
  { ticker: 'MT.AS', naam: 'ArcelorMittal', indices: ['AEX', 'CAC40'], bevestigd: false, oordeel: 'positief', rang: 0.3, dekking: 40, positiePct: 10 },
  { ticker: 'AD.AS', naam: 'Ahold Delhaize', indices: ['AEX'], bevestigd: true, oordeel: 'positief', rang: 0.5, dekking: 80, positiePct: null },
  { ticker: 'AAPL', naam: 'Apple', indices: [], bevestigd: true, oordeel: 'vermijden', rang: -0.4, dekking: 90, positiePct: 95 },
  { ticker: 'X.PA', naam: 'Xyz', indices: ['CAC40'], bevestigd: false, oordeel: null, rang: 0.9, dekking: 10, positiePct: 30 },
];

test('kansrijkheid: positief eerst, hoogste rang bovenaan, zonder oordeel onderaan', () => {
  assert.deepEqual(D.fondsen(items, { sorteer: 'kansrijk' }).map(a => a.ticker), ['AD.AS', 'MT.AS', 'ASML.AS', 'AAPL', 'X.PA']);
});

test('per index gegroepeerd in vaste volgorde; een aandeel in twee indices staat in beide; VS apart', () => {
  const g = D.perIndex(D.fondsen(items, {}));
  assert.deepEqual(g.map(x => x.index), ['AEX', 'CAC40', 'VS']);
  assert.deepEqual(g[0].items.map(a => a.ticker), ['AD.AS', 'MT.AS', 'ASML.AS']);
  assert.equal(g[0].positief, 2);
  assert.deepEqual(g[1].items.map(a => a.ticker), ['MT.AS', 'X.PA']);
});

test('filters en sortering op plek in bereik (onbekend onderaan)', () => {
  assert.deepEqual(D.fondsen(items, { sorteer: 'positiePct' }).map(a => a.ticker), ['MT.AS', 'X.PA', 'ASML.AS', 'AAPL', 'AD.AS']);
  assert.deepEqual(D.fondsen(items, { index: 'CAC40' }).map(a => a.ticker), ['MT.AS', 'X.PA']);
  assert.deepEqual(D.fondsen(items, { index: 'VS' }).map(a => a.ticker), ['AAPL']);
  assert.deepEqual(D.fondsen(items, { zoek: 'ahold', alleenBevestigd: true }).map(a => a.ticker), ['AD.AS']);
  assert.deepEqual(D.fondsen(items, { sorteer: 'naam' }).map(a => a.naam), ['Ahold Delhaize', 'Apple', 'ArcelorMittal', 'ASML', 'Xyz']);
});
