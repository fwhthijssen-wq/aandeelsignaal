const test = require('node:test');
const assert = require('node:assert');
const N = require('../js/naic.js');

function jaren(eps) { return eps.map((e, i) => ({ year: 2016 + i, comparable_eps: e, koers_hoog: e * 20, koers_laag: e * 12 })); }

test('trend: eenmalige uitschieter valt weg (GSK-achtig), gewone schommelingen niet', function () {
  const d = N.trendDetail(jaren([1.0, 1.06, 1.12, 1.19, 1.26, 1.34, 3.66, 1.5, 1.59, 1.69]), 'comparable_eps');
  assert.deepStrictEqual(d.weggelaten, [2022]);
  assert.ok(d.groei > 5 && d.groei < 7, String(d.groei));
  const gewoon = N.trendDetail(jaren([1.0, 1.1, 1.05, 1.2, 1.3, 1.25, 1.4, 1.5]), 'comparable_eps');
  assert.deepStrictEqual(gewoon.weggelaten, []);
  const kort = N.trendDetail(jaren([1, 1.1, 5, 1.3, 1.4]), 'comparable_eps');   // te weinig jaren om weg te laten
  assert.deepStrictEqual(kort.weggelaten, []);
});

test('ssg: winst van de laatste 4 kwartalen als die geloofwaardig is', function () {
  const jr = jaren([2, 2.2, 2.4, 2.7, 3.0, 3.3]);
  const zonder = N.ssg(jr, 50), met = N.ssg(jr, 50, false, { ttm: { eps: 3.6, tot: '2026-09-30' } });
  assert.strictEqual(met.ttm.eps, 3.6); assert.strictEqual(met.eps, 3.6); assert.strictEqual(met.ttm.jaarEps, 3.3);
  assert.ok(met.zones.hoog > zonder.zones.hoog);
  assert.ok(met.relatief.kwNu < zonder.relatief.kwNu);
  const raar = N.ssg(jr, 50, false, { ttm: { eps: 330 } });                          // pence of fout: genegeerd
  assert.strictEqual(raar.ttm, undefined); assert.strictEqual(raar.eps, 3.3);
  const g = N.gevoeligheid(jr, 50, false, met);
  assert.ok(g && g.lager);
});
