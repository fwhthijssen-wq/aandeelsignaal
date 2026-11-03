const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/model.js');

function fonds(x) { return Object.assign({ naam: 'Test', valuta: 'EUR', index: 'AEX', dividenden: [], splitsingen: [] }, x); }
function dag(datum, fondsen, extra) { return Object.assign({ datum, fx: { USD: 0.9, GBP: 1.2 }, fondsen, indexen: { AEX: { datum, stand: 900 }, VS: { datum, stand: 5000 } } }, extra || {}); }

test('kopen pas op de volgende koers, voor ongeveer 1000 euro, met kosten', () => {
  const s = M.nieuw('2026-11-04');
  M.stap(s, dag('2026-11-04', { 'A.AS': fonds({ koers: 33, koersDatum: '2026-11-03', oordeel: 'kopen', zone: 'koop', moment: 'neutraal', zekerheid: 'bevestigd' }) }));
  assert.equal(s.varianten[0].posities.length, 0); assert.equal(s.varianten[0].wacht.length, 1);
  assert.equal(s.varianten[1].wacht.length, 0);                 // moment niet gunstig: variant 2 koopt niet
  M.stap(s, dag('2026-11-04', { 'A.AS': fonds({ koers: 33, koersDatum: '2026-11-03', oordeel: 'kopen' }) }));   // zelfde dag nog eens: niets
  assert.equal(s.varianten[0].posities.length, 0); assert.equal(s.varianten[0].wacht.length, 1);
  M.stap(s, dag('2026-11-05', { 'A.AS': fonds({ koers: 34, koersDatum: '2026-11-04', oordeel: 'kopen' }) }));
  const p = s.varianten[0].posities[0];
  assert.equal(p.aantal, 29); assert.equal(p.koop.koers, 34); assert.equal(p.koop.bedrag, 986); assert.equal(p.koop.kosten, 3);
  assert.equal(p.koop.signaal.zekerheid, 'bevestigd'); assert.equal(p.koop.signaal.koers, 33);
  assert.equal(s.varianten[0].wacht.length, 0);
  M.stap(s, dag('2026-11-05', { 'A.AS': fonds({ koers: 34, koersDatum: '2026-11-04', oordeel: 'kopen' }) }));
  assert.equal(s.varianten[0].posities.length, 1, 'een open positie wordt niet bijgekocht');
});

test('duurder dan 1000 euro: 1 aandeel; dollars met de ECB-koers', () => {
  const s = M.nieuw('2026-11-04');
  M.stap(s, dag('2026-11-04', { BIG: fonds({ valuta: 'USD', index: 'VS', koers: 1500, koersDatum: '2026-11-03', oordeel: 'kopen' }) }));
  M.stap(s, dag('2026-11-05', { BIG: fonds({ valuta: 'USD', index: 'VS', koers: 1600, koersDatum: '2026-11-04', oordeel: 'kopen' }) }));
  const p = s.varianten[0].posities[0];
  assert.equal(p.aantal, 1); assert.equal(p.koop.bedrag, 1440); assert.equal(p.koop.fx, 0.9);
});

test('verkopen alleen bij de verkoopzone, op de volgende koers; resultaat met dividend en index', () => {
  const s = M.nieuw('2026-11-04');
  const f = (koers, d, zone, extra) => ({ 'A.AS': fonds(Object.assign({ koers, koersDatum: d, oordeel: zone === 'koop' ? 'kopen' : 'neutraal', zone }, extra || {})) });
  M.stap(s, dag('2026-11-04', f(10, '2026-11-03', 'koop')));
  M.stap(s, dag('2026-11-05', f(10, '2026-11-04', 'koop')));                     // 100 stuks voor 1000
  M.stap(s, dag('2026-11-20', f(11, '2026-11-19', 'houd', { dividenden: [['2026-11-10', 0.5], ['2026-10-01', 9]] })), { indexen: {} });
  let p = s.varianten[0].posities[0];
  assert.equal(p.dividendEur, 50, 'alleen dividend na de aankoop');
  assert.equal(p.verkoop, null, 'houdzone: blijven zitten');
  M.stap(s, dag('2026-11-21', f(12, '2026-11-20', 'verkoop', { dividenden: [['2026-11-10', 0.5]] })));
  assert.equal(p.verkoop, null); assert.equal(s.varianten[0].wacht[0].soort, 'verkoop');
  M.stap(s, dag('2026-11-22', f(12.5, '2026-11-21', 'verkoop', { dividenden: [['2026-11-10', 0.5]] }), { indexen: { AEX: { datum: '2026-11-21', stand: 990 } } }));
  p = s.varianten[0].posities[0];
  assert.equal(p.verkoop.koers, 12.5); assert.equal(p.verkoop.reden, 'Verkoopzone'); assert.equal(p.dividendEur, 50);
  const u = M.uitkomst(p);
  assert.equal(u.inleg, 1003); assert.equal(u.waarde, 1247); assert.equal(u.resultaat, 294); assert.equal(u.pct, 29.3);
  assert.equal(u.idx.resultaat, 1000 * 990 / 900 - 3 - 1003);                   // index +10%, ook met kosten
  const sv = M.samenvatting(s.varianten[0]);
  assert.equal(sv.gesloten, 1); assert.equal(sv.gewonnen, 1); assert.equal(sv.resultaat, 294);
});

test('splitsing past het aantal aan; dividend daarna over het nieuwe aantal', () => {
  const s = M.nieuw('2026-11-04');
  M.stap(s, dag('2026-11-04', { X: fonds({ koers: 100, koersDatum: '2026-11-03', oordeel: 'kopen' }) }));
  M.stap(s, dag('2026-11-05', { X: fonds({ koers: 100, koersDatum: '2026-11-04', oordeel: 'kopen' }) }));
  M.stap(s, dag('2026-12-01', { X: fonds({ koers: 52, koersDatum: '2026-11-30', splitsingen: [['2026-11-20', 2]], dividenden: [['2026-11-25', 1]] }) }));
  const p = s.varianten[0].posities[0];
  assert.equal(p.aantal, 20); assert.equal(p.dividendEur, 20);
  assert.equal(M.uitkomst(p).waarde, 1040);
});

test('fonds uit de lijst: verkocht tegen de laatste koers', () => {
  const s = M.nieuw('2026-11-04');
  M.stap(s, dag('2026-11-04', { X: fonds({ koers: 50, koersDatum: '2026-11-03', oordeel: 'kopen' }) }));
  M.stap(s, dag('2026-11-05', { X: fonds({ koers: 50, koersDatum: '2026-11-04', oordeel: 'kopen' }) }));
  M.stap(s, dag('2026-11-06', {}));
  const p = s.varianten[0].posities[0];
  assert.equal(p.verkoop.reden, 'Niet meer in de lijst'); assert.equal(p.verkoop.koers, 50);
});

test('variant koopmoment koopt alleen bij een gunstig moment; oude koers geeft geen signaal', () => {
  const s = M.nieuw('2026-11-04');
  M.stap(s, dag('2026-11-04', { G: fonds({ koers: 10, koersDatum: '2026-11-03', oordeel: 'kopen', moment: 'gunstig' }), O: fonds({ koers: 10, koersDatum: '2026-10-20', oordeel: 'kopen', moment: 'gunstig' }) }));
  assert.deepEqual(s.varianten[1].wacht.map(o => o.ticker), ['G']);
  assert.deepEqual(s.varianten[0].wacht.map(o => o.ticker), ['G']);
});

test('voor de app: historie per week en samenvatting', () => {
  const s = M.nieuw('2026-01-01');
  for (let i = 0; i < 40; i++) {
    const d = new Date(Date.UTC(2026, 0, 2 + i)).toISOString().slice(0, 10), v = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
    M.stap(s, dag(d, { X: fonds({ koers: 10 + i / 10, koersDatum: v, oordeel: 'kopen' }) }));
  }
  const a = M.voorApp(s);
  assert.ok(a.varianten[0].historie.length <= 8);
  assert.equal(a.varianten[0].historie[a.varianten[0].historie.length - 1][0], s.bijgewerkt);
  assert.equal(a.varianten[0].samenvatting.open, 1);
  assert.ok(a.varianten[0].posities[0].uitkomst.resultaat > 0);
});
