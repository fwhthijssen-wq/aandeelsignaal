const test = require('node:test');
const assert = require('node:assert');
const N = require('../js/naic.js');

function jaren(eps, hoog, laag) { return eps.map((e, i) => ({ year: 2020 + i, comparable_eps: e, koers_hoog: hoog[i], koers_laag: laag[i] })); }

test('SSG: koopzone met minstens 3 : 1 is Kopen', function () {
  const jr = jaren([2, 2.2, 2.4, 2.7, 3.0, 3.3], [40, 44, 48, 54, 60, 66], [26, 29, 31, 35, 39, 43]);
  const n = N.ssg(jr, 45);
  assert.ok(n.groeiHistorisch > 9 && n.groeiHistorisch < 12, String(n.groeiHistorisch));   // trendgroei
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

test('SSG deel 1 en 2: omzet draagt de winstgroei, marge en rendement niet dalend; anders geen Kopen', function () {
  const goed = jaren([2, 2.2, 2.4, 2.7, 3.0, 3.3], [40, 44, 48, 54, 60, 66], [26, 29, 31, 35, 39, 43])
    .map((j, i) => Object.assign(j, { sales: 100 * Math.pow(1.09, i), pretax_income: 15 * Math.pow(1.09, i), net_income: 11 * Math.pow(1.1, i), equity: 70 * Math.pow(1.09, i) }));
  const n = N.ssg(goed, 45);
  assert.deepStrictEqual(n.kwaliteit.map(q => q.ok), [true, true, true]);
  assert.strictEqual(n.oordeel, 'kopen');
  const krimp = goed.map((j, i) => Object.assign({}, j, { sales: 100 * Math.pow(0.97, i) }));
  const k = N.ssg(krimp, 45);
  assert.strictEqual(k.kwaliteit[0].ok, false); assert.strictEqual(k.oordeel, 'neutraal'); assert.match(k.reden, /Toch geen Kopen/);
  const marge = goed.map((j, i) => Object.assign({}, j, { pretax_income: j.sales * (0.2 - 0.02 * i) }));
  assert.strictEqual(N.ssg(marge, 45).kwaliteit[1].ok, false);
  const bank = N.ssg(goed, 45, true);
  assert.strictEqual(bank.kwaliteit[0].ok, null); assert.strictEqual(bank.kwaliteit[1].ok, null);
});

test('trendgroei: één ingezakt jaar weegt weinig', function () {
  const v = [1, 1.1, 1.21, 0.2, 1.46, 1.61, 1.77].map((e, i) => ({ year: 2019 + i, comparable_eps: e }));
  const t = N.trendGroei(v, 'comparable_eps');
  assert.ok(t > 0 && t < 40, String(t));
});

test('SSG deel 5: koopzone met 3 : 1 maar totaalrendement onder 15% is hoogstens Neutraal; dividend telt mee', function () {
  const eps = [2, 2.12, 2.25, 2.38, 2.52, 2.68];
  const jr = eps.map((e, i) => ({ year: 2020 + i, comparable_eps: e, koers_hoog: e * 13, koers_laag: e * 11 }));
  const z = N.ssg(jr, 30).zones, p = z.laag + (z.hoog - z.laag) / 4.2;
  const n = N.ssg(jr, p);
  assert.strictEqual(n.zones.zone, 'koop'); assert.ok(n.zones.verhouding >= 3);
  assert.strictEqual(n.totaal.ok, false); assert.strictEqual(n.totaal.dividend, null);
  assert.strictEqual(n.oordeel, 'neutraal'); assert.match(n.reden, /totaalrendement/);
  const metDiv = jr.map((j) => Object.assign({ dividend_ps: j.comparable_eps * 0.7 }, j));    // ongeveer 5,8% dividendrendement
  const d = N.ssg(metDiv, p);
  assert.ok(d.totaal.dividend > 5); assert.ok(d.totaal.totaal >= N.TOTAAL_MIN);
  assert.strictEqual(d.oordeel, 'kopen');
});

test('SSG ter informatie: relatieve waarde (K/W nu ÷ gemiddelde K/W) en verwacht gemiddeld rendement (PAR)', function () {
  const eps = [2, 2.2, 2.4, 2.7, 3.0, 3.3];
  const jr = eps.map((e, i) => ({ year: 2020 + i, comparable_eps: e, koers_hoog: e * 20, koers_laag: e * 14 }));
  const n = N.ssg(jr, 3.3 * 17);
  assert.strictEqual(n.relatief.kwGem, 17); assert.strictEqual(n.relatief.pct, 100); assert.strictEqual(n.relatief.oordeel, 'normaal');
  assert.strictEqual(N.ssg(jr, 3.3 * 20).relatief.oordeel, 'duur');
  assert.strictEqual(N.ssg(jr, 3.3 * 13).relatief.oordeel, 'laag');
  // PAR: zelfde K/W over 5 jaar → koersstijging = winstgroei (begrensd op 15%)
  assert.ok(Math.abs(n.par.pct - n.groei) < 0.2, n.par.pct + ' vs ' + n.groei);
});

test('SSG met eigen groeiverwachting: rekent daarmee (ook boven de grens), te laag = geen groeibedrijf', function () {
  const jr = [2, 2.2, 2.4, 2.7, 3.0, 3.3].map((e, i) => ({ year: 2020 + i, comparable_eps: e, koers_hoog: e * 20, koers_laag: e * 14 }));
  const hist = N.ssg(jr, 50), eigen = N.ssg(jr, 50, false, { groei: 18 });
  assert.strictEqual(eigen.groeiEigen, 18); assert.strictEqual(eigen.groei, 18);
  assert.ok(eigen.zones.hoog > hist.zones.hoog);
  assert.strictEqual(eigen.groeiHistorisch, hist.groeiHistorisch);
  const laag = N.ssg(jr, 50, false, { groei: 3 });
  assert.strictEqual(laag.oordeel, 'vermijden'); assert.match(laag.reden, /Uw groeiverwachting/);
  assert.strictEqual(N.ssg(jr, 50, false, { groei: null }).groei, hist.groei);
});

test('koopprijs: precies op de koopprijs Kopen, net erboven niet; ladder en gevoeligheid', function () {
  const jr = [2, 2.2, 2.4, 2.7, 3.0, 3.3].map((e, i) => ({ year: 2020 + i, comparable_eps: e, koers_hoog: e * 20, koers_laag: e * 14, dividend_ps: e * 0.3 }));
  const n = N.ssg(jr, 60);
  assert.ok(n.koopprijs.prijs > 0, JSON.stringify(n.koopprijs));
  const p = n.koopprijs.prijs;
  assert.strictEqual(N.ssg(jr, p * 0.999).oordeel, 'kopen');
  assert.notStrictEqual(N.ssg(jr, p * 1.01).oordeel, 'kopen');
  assert.ok(Math.abs(n.koopprijs.afstand - (60 / p - 1) * 100) < 0.1);
  const l = N.ladder(N.ssg(jr, p * 0.999));
  assert.deepStrictEqual(l.map((x) => x.ok), [true, null, true, true, true]);      // kwaliteit onbekend (geen omzet in de test)
  const k = N.ssg(jr, p * 0.999); const gv = N.gevoeligheid(jr, p * 0.999, false, k);
  assert.strictEqual(gv.hoger, 'kopen'); assert.ok(['kopen', 'neutraal'].includes(gv.lager));
  // kwaliteit valt af: geen koopprijs
  const slecht = jr.map((j, i) => Object.assign({ sales: 100 - i * 5 }, j));
  assert.strictEqual(N.ssg(slecht, 60).koopprijs.prijs, null);
});
