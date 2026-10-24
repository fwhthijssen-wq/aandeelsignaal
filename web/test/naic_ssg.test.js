const test = require('node:test');
const assert = require('node:assert');
const N = require('../js/naic.js');

function jaren(eps, hoog, laag) { return eps.map((e, i) => ({ year: 2020 + i, comparable_eps: e, koers_hoog: hoog[i], koers_laag: laag[i] })); }

test('SSG: koopzone met minstens 3 : 1 is Kopen', function () {
  const jr = jaren([2, 2.2, 2.4, 2.7, 3.0, 3.3], [40, 44, 48, 54, 60, 66], [26, 29, 31, 35, 39, 43]);
  const n = N.ssg(jr, 45);
  assert.strictEqual(n.groeiHistorisch, 10.5);
  assert.strictEqual(n.kw.jaren, 5);
  assert.ok(n.zones.hoog > n.zones.laag);
  assert.strictEqual(n.zones.zone, 'koop');
  assert.ok(n.zones.verhouding >= 3);
  assert.strictEqual(n.oordeel, 'kopen');
});

test('SSG: verkoopzone is Vermijden, houdzone Neutraal', function () {
  const jr = jaren([2, 2.2, 2.4, 2.7, 3.0, 3.3], [40, 44, 48, 54, 60, 66], [26, 29, 31, 35, 39, 43]);
  const z = N.ssg(jr, 45).zones;
  assert.strictEqual(N.ssg(jr, z.verkoop[0] + 1).oordeel, 'vermijden');
  assert.strictEqual(N.ssg(jr, (z.houd[0] + z.houd[1]) / 2).oordeel, 'neutraal');
});

test('SSG: groei wordt begrensd, te weinig groei is geen NAIC-groeibedrijf', function () {
  const snel = N.ssg(jaren([1, 1.4, 2, 2.8, 3.9, 5.5], [20, 28, 40, 56, 78, 110], [12, 17, 24, 34, 47, 66]), 80);
  assert.ok(snel.groeiHistorisch > 30); assert.strictEqual(snel.groei, N.GROEI_MAX);
  const traag = N.ssg(jaren([2, 2.02, 2.05, 2.07, 2.1, 2.12], [30, 30, 31, 31, 32, 32], [20, 20, 21, 21, 22, 22]), 25);
  assert.strictEqual(traag.oordeel, 'vermijden'); assert.match(traag.reden, /minder dan de 5%/);
});

test('SSG: ongewoon jaar (eenmalige last) doet niet mee voor K/W en laagste winst', function () {
  const jr = jaren([5.1, 5.7, 0.14, 6.7, 7.3, 7.9], [90, 112, 118, 133, 107, 120], [69, 74, 100, 96, 73, 85]);
  const n = N.ssg(jr, 100);
  assert.deepStrictEqual(n.weggelaten, [2022]);
  assert.ok(n.kw.hoog < 30);
  assert.ok(n.epsLaag > 1);
});

test('SSG: zonder verse koers geen oordeel maar wel zones; te weinig jaren geen berekening', function () {
  const jr = jaren([2, 2.2, 2.4, 2.7, 3.0, 3.3], [40, 44, 48, 54, 60, 66], [26, 29, 31, 35, 39, 43]);
  const n = N.ssg(jr, null);
  assert.strictEqual(n.oordeel, null); assert.ok(n.zones);
  assert.match(N.ssg(jr.slice(0, 3), 45).reden, /Minder dan 4 jaar/);
});
