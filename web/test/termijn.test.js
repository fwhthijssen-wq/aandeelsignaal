const test = require('node:test');
const assert = require('node:assert');
global.self = global;
const T = require('../js/termijn.js');

const V = '2026-10-31';
function rec(o) {
  return Object.assign({ koers: { slot: 100, rsi14: 72, relatief: { naam: 'AEX', m12: 12 }, risico: { beweeglijk: 24, onder_top: -3 } },
    verwachting: { datum: '2026-10-30', bijstelling: { dit_jaar: { d30: 1, d90: 4, omhoog: 5, omlaag: 1 }, volgend_jaar: { d90: 3 } },
      verrassingen: [{ datum: '2026-10-14', pct: 9.9 }, { datum: '2026-07-13', pct: 9.1 }], volgende_cijfers: '2027-01-27' } }, o || {});
}

test('middellang: vier onderdelen, positief vanaf +2', () => {
  const m = T.middellang(rec(), { status: 'gunstig', ja: 5 }, V);
  assert.deepEqual(m.delen.map((d) => d.punt), [1, 1, 1, 1]);
  assert.equal(m.status, 'positief'); assert.equal(m.score, 4); assert.equal(m.bekend, 4);
  assert.match(m.delen[2].tekst, /verhoogd: \+3,5% in 90 dagen\. Laatste 30 dagen: 5 analisten omhoog, 1 omlaag\./);
});

test('middellang: negatief, neutraal en te weinig gegevens', () => {
  const neg = rec({ koers: { relatief: { naam: 'DAX', m12: -20 } }, verwachting: { datum: V, bijstelling: { dit_jaar: { d90: -6 } }, verrassingen: [{ datum: '2026-10-01', pct: -8 }] } });
  assert.equal(T.middellang(neg, { status: 'afwachten', ja: 1 }, V).status, 'negatief');
  const gemengd = rec({ koers: { relatief: { naam: 'DAX', m12: 2 } } });
  assert.equal(T.middellang(gemengd, { status: 'afwachten', ja: 1 }, V).status, 'neutraal');      // -1 0 +1 +1 = 1
  const leeg = { koers: {} };
  assert.equal(T.middellang(leeg, null, V).status, 'onbekend');
  const oud = rec({ verwachting: Object.assign({}, rec().verwachting, { datum: '2026-09-01' }) });  // verouderd: niet gebruikt
  assert.equal(T.middellang(oud, { status: 'gunstig', ja: 4 }, V).bekend, 2);
});

test('kort: cijferdatum, bandbreedte, RSI en afstand tot de top, alleen met verse koers', () => {
  const k = T.kort(rec(), V, true);
  assert.deepEqual(k.cijfers, { datum: '2027-01-27', dagen: 88 });
  assert.equal(k.band.pct, 6.9);                             // 24% per jaar / wortel 12
  assert.ok(Math.abs(k.band.laag - 93.07) < 0.01 && Math.abs(k.band.hoog - 106.93) < 0.01);
  assert.equal(k.rsi, 72); assert.equal(k.onderTop, -3);
  const zonder = T.kort(rec(), V, false);
  assert.deepEqual(Object.keys(zonder), ['cijfers']);         // de datum van de cijfers is geen koersgegeven
});
