const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../js/gate.js');

const goed = { epsStatus: 'independently_verified', epsVerifiedYears: 10, priceDate: '2026-10-19', today: '2026-10-20',
  currencies: ['USD'], rejectedSources: 0 };

test('alles bevestigd en verse koers geeft een oordeel', () => {
  assert.deepEqual(G.labelGate(goed), { allowed: true, reasons: [] });
});

test('elke ontbrekende of slechte eigenschap blokkeert', () => {
  const slecht = [
    { epsVerifiedYears: 9 }, { epsStatus: 'partially_independently_verified' }, { epsStatus: 'iets_nieuws' },
    { epsStatus: null }, { priceDate: '2026-10-12' }, { priceDate: '2026-10-21' }, { priceDate: null },
    { priceDate: '2026-02-30' }, { currencies: ['USD', 'EUR'] }, { currencies: [] }, { currencies: null },
    { rejectedSources: 1 }, { rejectedSources: null }, { rejectedSources: -1 }, { epsVerifiedYears: 10.5 }];
  for (const wijziging of slecht) {
    const r = G.labelGate({ ...goed, ...wijziging });
    assert.equal(r.allowed, false, JSON.stringify(wijziging));
    assert.ok(r.reasons.length >= 1);
  }
});

test('koers van precies 7 dagen is nog vers, 8 dagen niet', () => {
  assert.equal(G.priceFreshness('2026-10-13', '2026-10-20').fresh, true);
  assert.equal(G.priceFreshness('2026-10-12', '2026-10-20').fresh, false);
});

test('zonder gegevens nooit een oordeel, met reden', () => {
  const rij = G.maakRij({ ticker: 'X', naam: 'X', koers: null, gegevens: null }, '2026-10-20');
  assert.equal(rij.bevestigd, false);
  assert.match(rij.redenen[0], /Nog niet gecontroleerd/);
  const fout = G.maakRij({ ticker: 'X', naam: 'X', koers: null, gegevens: { fout: 'Geen verbinding' } }, '2026-10-20');
  assert.deepEqual(fout.redenen, ['Geen verbinding']);
});

test('Apple met bevestigde gegevens maar zonder koers: geen oordeel', () => {
  const rec = { ticker: 'AAPL', naam: 'Apple', koers: null, gegevens: { fout: null, eps_status: 'independently_verified',
    eps_verified_years: 10, currencies: ['USD'], rejected_sources: 0 } };
  const rij = G.maakRij(rec, '2026-10-20');
  assert.equal(rij.bevestigd, false);
  assert.ok(rij.redenen.some(r => /Koersdatum onbekend/.test(r)));
});

test('Apple met verse koers: oordeel mogelijk en trend zichtbaar; oude koers verbergt trend', () => {
  const g = { fout: null, eps_status: 'independently_verified', eps_verified_years: 10, currencies: ['USD'], rejected_sources: 0 };
  const vers = G.maakRij({ ticker: 'AAPL', naam: 'Apple', koers: { datum: '2026-10-19', slot: 110, sma50: 100 }, gegevens: g }, '2026-10-20');
  assert.equal(vers.bevestigd, true);
  assert.deepEqual([vers.richting, vers.afstandPct], ['boven', 10]);
  const oud = G.maakRij({ ticker: 'AAPL', naam: 'Apple', koers: { datum: '2026-09-01', slot: 110, sma50: 100 }, gegevens: g }, '2026-10-20');
  assert.equal(oud.bevestigd, false);
  assert.equal(oud.richting, null);
});

test('sorteren: bevestigd eerst, dan op naam', () => {
  const r = (naam, b) => ({ naam, bevestigd: b });
  assert.deepEqual(G.sorteer([r('Zeta', false), r('Appel', true), r('Beta', false)]).map(x => x.naam), ['Appel', 'Beta', 'Zeta']);
});

test('rekenvoorbeeld klopt en weigert ongeldige invoer', () => {
  const r = G.scenario(7.46, 5, 15, 5, 10, 25);
  assert.ok(Math.abs(r.toekomstigeEps - 9.5212) < 0.001);
  assert.ok(Math.abs(r.naMarge - 66.5) < 0.1);
  for (const args of [[0, 5, 15, 5, 10, 25], [7, 5, 15, 11, 10, 25], [7, 200, 15, 5, 10, 25], [7, 5, 15, 5, 10, 100], [NaN, 5, 15, 5, 10, 25]]) {
    assert.throws(() => G.scenario(...args));
  }
});
