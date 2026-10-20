const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../js/naic.js');

const jr = (n = 10, o = {}) => Array.from({ length: n }, (_, i) => Object.assign({ year: 2016 + i, sales: 100 * Math.pow(1.1, i), comparable_eps: 2 * Math.pow(1.2, i), net_income: 20 * Math.pow(1.1, i), equity: 100 * Math.pow(1.05, i) }, o));

test('groei: tien jaar en laatste vijf', () => {
  const g = N.groeiCijfers(jr());
  assert.equal(g.omzet10, 10); assert.equal(g.eps10, 20); assert.equal(g.omzet5, 10); assert.equal(g.eps5, 20);
  assert.equal(g.van, 2016); assert.equal(g.tot, 2025);
});
test('groei: te weinig jaren of verlies geeft null, geen verzonnen getal', () => {
  assert.equal(N.groeiCijfers(jr(1)).omzet10, null);
  assert.equal(N.groeiCijfers(jr(5)).omzet5, null, 'vijfjaarsgroei vraagt zes jaarcijfers');
  const x = jr(); x[9].comparable_eps = -1;
  assert.equal(N.groeiCijfers(x).eps10, null); assert.equal(N.groeiCijfers(x).eps5, null);
  const y = jr(); y[0].comparable_eps = -2; y[9].comparable_eps = -1;
  assert.equal(N.groeiCijfers(y).eps10, null, 'twee verliesjaren geven geen groeipercentage');
  assert.deepEqual(N.groeiCijfers(null).omzet10, null);
});
test('rendement op eigen vermogen: per jaar, gemiddelde, en vermogen <= 0 telt niet', () => {
  const x = jr(3); x[1].equity = -50; x[2].equity = 0;
  const r = N.rendementEigenVermogen(x);
  assert.equal(r.reeks[0].waarde, 20); assert.equal(r.reeks[1].waarde, null); assert.equal(r.reeks[2].waarde, null);
  assert.equal(r.gemiddelde, 20); assert.equal(r.jarenMetWaarde, 1);
  assert.equal(N.rendementEigenVermogen([]).gemiddelde, null);
});
test('nettomarge per jaar; omzet 0 geeft null', () => {
  const x = jr(2); x[1].sales = 0;
  const m = N.nettomarges(x);
  assert.equal(m[0].waarde, 20); assert.equal(m[1].waarde, null);
});

const inv = (o = {}) => Object.assign({ eps: 5, epsLaag: 4, groeiPct: 10, jaren: 5, kwHoog: 20, kwLaag: 10, koers: 80 }, o);
test('koerszones: hoog, laag en driedeling kloppen', () => {
  const z = N.koerszones(inv());
  assert.ok(Math.abs(z.hoog - 5 * Math.pow(1.1, 5) * 20) < 1e-9);
  assert.equal(z.laag, 40);
  const stap = (z.hoog - z.laag) / 3;
  assert.ok(Math.abs(z.koop[1] - (40 + stap)) < 1e-9); assert.equal(z.koop[0], 40); assert.equal(z.verkoop[1], z.hoog);
  assert.ok(Math.abs(z.houd[0] - z.koop[1]) < 1e-9 && Math.abs(z.verkoop[0] - z.houd[1]) < 1e-9);
});
test('koerszones: zone, verhouding en rendement per jaar', () => {
  const z = N.koerszones(inv({ koers: 60 }));
  assert.equal(z.zone, 'koop');
  assert.ok(Math.abs(z.opwaarts - (z.hoog - 60)) < 1e-9 && Math.abs(z.neerwaarts - 20) < 1e-9);
  assert.ok(Math.abs(z.verhouding - z.opwaarts / 20) < 1e-9);
  assert.ok(Math.abs(z.rendementPerJaar - (Math.pow(z.hoog / 60, 0.2) - 1) * 100) < 1e-9);
  assert.equal(N.koerszones(inv({ koers: 100 })).zone, 'houd');
  assert.equal(N.koerszones(inv({ koers: 150 })).zone, 'verkoop');
  assert.equal(N.koerszones(inv({ koers: 30 })).zone, 'onder');
  assert.equal(N.koerszones(inv({ koers: 30 })).verhouding, null, 'geen neerwaarts risico in dit scenario: geen verhouding');
  assert.equal(N.koerszones(inv({ koers: 500 })).zone, 'boven');
});
test('koerszones zonder koers: wel zones, geen zone of verhouding', () => {
  for (const koers of [null, undefined, 0, -1, NaN]) {
    const z = N.koerszones(inv({ koers }));
    assert.equal(z.zone, null); assert.equal(z.verhouding, null); assert.equal(z.rendementPerJaar, null); assert.ok(z.hoog > z.laag);
  }
});
test('koerszones: ongeldige aannames worden geweigerd', () => {
  for (const slecht of [{ eps: 0 }, { eps: -1 }, { epsLaag: 0 }, { kwHoog: 0 }, { kwLaag: 0 }, { jaren: 0 }, { jaren: 11 }, { jaren: 2.5 }, { groeiPct: -100 }, { groeiPct: 101 },
    { eps: NaN }, { groeiPct: 'x' }, { kwLaag: 20 }, { kwLaag: 25 }, { epsLaag: 1, kwLaag: 1, kwHoog: 2, eps: 1, groeiPct: -50 }]) {
    assert.throws(() => N.koerszones(inv(slecht)), undefined, JSON.stringify(slecht));
  }
});

test('winstmarge voor belasting: alleen met winst en positieve omzet', () => {
  const r = N.margeVoorBelasting([{ year: 2024, sales: 200, pretax_income: 50 }, { year: 2025, sales: 0, pretax_income: 5 }, { year: 2026, sales: 100 }, { year: 2023, sales: 100, pretax_income: -10 }, { year: 2022, sales: 100, pretax_income: null }]);
  assert.deepEqual(r.map(x => [x.year, x.waarde]), [[2022, null], [2023, -10], [2024, 25], [2025, null], [2026, null]]);
});
test('uitkeringsratio: onbekend dividend is nooit nul; verlies of negatief dividend geeft niets', () => {
  const r = N.uitkeringsratio([{ year: 1, net_income: 100, dividends_paid: 40 }, { year: 2, net_income: 100 }, { year: 3, net_income: -5, dividends_paid: 4 }, { year: 4, net_income: 100, dividends_paid: -1 }, { year: 5, net_income: 100, dividends_paid: 0 }, { year: 6, net_income: 100, dividends_paid: 130 }]);
  assert.deepEqual(r.map(x => x.waarde), [40, null, null, null, 0, 130]);
});
test('schuldratio: schuld/(schuld+eigen vermogen); geen cijfer bij onbekende schuld of vermogen <= 0', () => {
  const r = N.schuldratio([{ year: 1, long_term_debt: 30, equity: 70 }, { year: 2, equity: 70 }, { year: 3, long_term_debt: 30, equity: 0 }, { year: 4, long_term_debt: 30, equity: -5 }, { year: 5, long_term_debt: -1, equity: 5 }, { year: 6, long_term_debt: 0, equity: 10 }]);
  assert.deepEqual(r.map(x => x.waarde), [30, null, null, null, null, 0]);
});
test('investeringsratio: capex/afschrijving, beide positief', () => {
  const r = N.investeringsratio([{ year: 1, capex: 150, depreciation: 100 }, { year: 2, capex: 150 }, { year: 3, capex: 0, depreciation: 10 }, { year: 4, capex: 5, depreciation: 0 }]);
  assert.deepEqual(r.map(x => x.waarde), [1.5, null, null, null]);
  assert.deepEqual(N.investeringsratio(undefined), []);
});
