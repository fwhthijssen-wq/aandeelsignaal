const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../../meldingen.js');

test('meldingen: instelling lezen (één of meer toestellen), ongeldige delen weg', () => {
  const t = { vapid: { publiek: 'p', prive: 'q' }, abonnement: { endpoint: 'https://push.example/1', keys: {} }, tickers: ['ASML.AS', 'kwaad;rm', 'AAPL'] };
  assert.equal(M.leesInstelling(JSON.stringify({ toestellen: [t, { foo: 1 }] })).length, 1);
  assert.deepEqual(M.leesInstelling(JSON.stringify(t))[0].tickers, ['ASML.AS', 'AAPL']);
});

test('meldingen: alleen bij een verandering naar koopzone, verkoopzone of omslag middellange termijn', () => {
  const oud = { oordeel: 'neutraal', zone: 'houd', ml: 'neutraal' };
  assert.deepEqual(M.gebeurtenissen('ASML', oud, { oordeel: 'kopen', zone: 'koop', ml: 'neutraal' }), ['ASML: in de koopzone (NAIC Kopen)']);
  assert.deepEqual(M.gebeurtenissen('ASML', oud, { oordeel: 'vermijden', zone: 'verkoop', ml: 'negatief' }), ['ASML: in de verkoopzone', 'ASML: middellange termijn nu negatief']);
  assert.deepEqual(M.gebeurtenissen('ASML', { oordeel: 'kopen', zone: 'koop', ml: 'positief' }, { oordeel: 'kopen', zone: 'koop', ml: 'positief' }), []);
  assert.deepEqual(M.gebeurtenissen('ASML', null, { oordeel: 'kopen' }), [], 'eerste keer: geen melding');
});
