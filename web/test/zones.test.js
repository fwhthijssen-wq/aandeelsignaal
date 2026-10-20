const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/store.js');
const D = require('../js/dashboard.js');
const G = require('../js/gate.js');
const N = require('../js/naic.js');

function geheugen() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; }
const nu = () => '2026-10-20T10:00:00Z';
const Z = { eps: 5.5, epsLaag: 4.5, groeiPct: 8, jaren: 5, kwHoog: 20, kwLaag: 10 };

test('zones bewaren, teruglezen, overschrijven en wissen', () => {
  const g = geheugen(), s = S.maak(g, nu);
  assert.equal(s.zetZones('aapl', Z).ok, true);
  assert.deepEqual(s.zones('AAPL'), Object.assign({}, Z, { bijgewerkt: '2026-10-20' }));
  assert.equal(S.maak(g, nu).zones('AAPL').eps, 5.5);
  assert.equal(s.zetZones('AAPL', Object.assign({}, Z, { eps: 6.5 })).ok, true); assert.equal(s.zones('AAPL').eps, 6.5);
  assert.equal(s.wisZones('AAPL'), true); assert.equal(s.zones('AAPL'), null); assert.equal(s.wisZones('AAPL'), false);
});
test('ongeldige zones worden geweigerd', () => {
  const s = S.maak(geheugen(), nu);
  for (const slecht of [{ eps: 0 }, Object.assign({}, Z, { kwLaag: 20 }), Object.assign({}, Z, { kwLaag: 25 }), Object.assign({}, Z, { jaren: 2.5 }), Object.assign({}, Z, { jaren: 11 }), Object.assign({}, Z, { groeiPct: 100.5 }), Object.assign({}, Z, { eps: 'x' }), Object.assign({}, Z, { eps: NaN }), Object.assign({}, Z, { epsLaag: -1 }), null, 'kapot'])
    assert.equal(s.zetZones('AAPL', slecht).ok, false, JSON.stringify(slecht));
  assert.equal(s.zetZones('<x>', Z).ok, false);
  assert.deepEqual(s.alleZones(), {});
  assert.deepEqual(S.schoonZones({ AAPL: Z, MSFT: { eps: 1 }, '!!': Z, __proto__: { x: Z } }), { AAPL: Object.assign({}, Z, { bijgewerkt: null }) });
});
test('zones zitten in de back-up; samenvoegen laat bestaande staan, vervangen niet', () => {
  const a = S.maak(geheugen(), nu); a.zetZones('AAPL', Z); a.zetZones('MSFT', Z);
  const tekst = a.maakBackup();
  const b = S.maak(geheugen(), nu); b.zetZones('AAPL', Object.assign({}, Z, { eps: 9 }));
  b.zetTerug(tekst, 'samenvoegen');
  assert.equal(b.zones('AAPL').eps, 9); assert.equal(b.zones('MSFT').eps, 5.5);
  b.zetTerug(tekst, 'vervang'); assert.equal(b.zones('AAPL').eps, 5.5);
});

const VANDAAG = '2026-10-20';
const jaren = Array.from({ length: 10 }, (_, i) => ({ year: 2016 + i }));
function rec(o = {}) {
  return Object.assign({ ticker: 'AAA', naam: 'Aaa', valuta: 'USD', koers: { slot: 40, datum: '2026-10-19', sma50: 38 },
    gegevens: { eps_status: 'independently_verified', eps_verified_years: 10, currencies: ['USD'], rejected_sources: 0, fout: null, jaren } }, o);
}
test('zoneOverzicht: zone alleen bij bevestigd aandeel met verse koers', () => {
  const zones = { AAA: Z };
  const ok = D.zoneOverzicht(zones, [rec()], VANDAAG, G, N)[0];
  assert.ok(['koop', 'houd', 'verkoop', 'onder', 'boven'].includes(ok.zone)); assert.equal(ok.koers, 40);
  const oud = D.zoneOverzicht(zones, [rec({ koers: { slot: 40, datum: '2026-09-01', sma50: 38 } })], VANDAAG, G, N)[0];
  assert.equal(oud.zone, null); assert.match(oud.reden, /koers/i);
  const onbev = D.zoneOverzicht(zones, [rec({ gegevens: Object.assign({}, rec().gegevens, { eps_verified_years: 6 }) })], VANDAAG, G, N)[0];
  assert.equal(onbev.zone, null); assert.match(onbev.reden, /bevestigd/);
  const geenKoers = D.zoneOverzicht(zones, [rec({ koers: null })], VANDAAG, G, N)[0];
  assert.equal(geenKoers.zone, null);
});
test('zoneOverzicht: onbekend aandeel verdwijnt; kapotte aannames geven reden, geen crash', () => {
  assert.deepEqual(D.zoneOverzicht({ ZZZ: Z }, [rec()], VANDAAG, G, N), []);
  const kapot = D.zoneOverzicht({ AAA: Object.assign({}, Z, { kwLaag: 30 }) }, [rec()], VANDAAG, G, N)[0];
  assert.equal(kapot.zone, null); assert.match(kapot.reden, /aannames/);
  assert.deepEqual(D.zoneOverzicht(undefined, undefined, VANDAAG, G, N), []);
});
test('zoneOverzicht: koopzone en onder-de-zone onderscheiden', () => {
  const laag = D.zoneOverzicht({ AAA: Z }, [rec({ koers: { slot: 1, datum: '2026-10-19', sma50: 1 } })], VANDAAG, G, N)[0];
  assert.equal(laag.zone, 'onder');
  const hoog = D.zoneOverzicht({ AAA: Z }, [rec({ koers: { slot: 9999, datum: '2026-10-19', sma50: 1 } })], VANDAAG, G, N)[0];
  assert.equal(hoog.zone, 'boven');
});
