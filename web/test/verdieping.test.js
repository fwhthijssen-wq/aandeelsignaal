const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/store.js');

function geheugen() { const m = {}; return { m, getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; } }; }
function klok(start) { let t = Date.parse(start); return () => new Date(t += 1000).toISOString(); }
const nieuw = () => S.maak(geheugen(), klok('2026-10-21T10:00:00Z'));
const SNAP = { oordeel: 'positief', dekking: 52, zekerheid: 'voorlopig', score: 0.41, datum: '2026-10-21', koers: 123.45, valuta: 'eur' };

test('verdieping: beoordeling 1-5 en eigen cijfers opslaan, wissen en valideren', () => {
  const st = nieuw();
  assert.equal(st.zetVerdieping('asml.as', 'scores', 'management', 4).ok, true);
  assert.equal(st.zetVerdieping('ASML.AS', 'cijfers', 'roe', '17,5').ok, true);
  assert.equal(st.zetVerdieping('ASML.AS', 'notities', 'management', 'Topman al 10 jaar aan boord').ok, true);
  const v = st.verdieping('ASML.AS');
  assert.equal(v.scores.management, 4); assert.equal(v.cijfers.roe, 17.5); assert.match(v.notities.management, /10 jaar/);
  assert.equal(v.bijgewerkt, '2026-10-21');
  for (const [soort, id, w] of [['scores', 'management', 0], ['scores', 'management', 6], ['scores', 'management', 2.5], ['scores', 'management', 'x'], ['cijfers', 'roe', 'abc'], ['cijfers', 'roe', 5000], ['cijfers', 'onbekend', 1], ['scores', 'roe', 3], ['rommel', 'roe', 1]])
    assert.equal(st.zetVerdieping('ASML.AS', soort, id, w).ok, false, soort + id + w);
  assert.equal(st.verdieping('ASML.AS').scores.management, 4);                // ongeldige invoer verandert niets
  st.zetVerdieping('ASML.AS', 'scores', 'management', '');
  assert.equal('management' in st.verdieping('ASML.AS').scores, false);
  st.zetVerdieping('ASML.AS', 'cijfers', 'roe', null); st.zetVerdieping('ASML.AS', 'notities', 'management', '  ');
  assert.deepEqual(st.verdieping('ASML.AS').cijfers, {});
  assert.equal(st.staat().verdieping['ASML.AS'], undefined);                  // helemaal leeg: geen restant
});

test('verdieping blijft bewaard na herladen en komt in de back-up; samenvoegen overschrijft nooit', () => {
  const g = geheugen(), a = S.maak(g, klok('2026-10-21T10:00:00Z'));
  a.zetVerdieping('SAP.DE', 'scores', 'moat', 5); a.zetVerdieping('SAP.DE', 'cijfers', 'kw', 22);
  assert.equal(S.maak(g).verdieping('SAP.DE').scores.moat, 5);
  const back = a.maakBackup();
  assert.ok(JSON.parse(back).verdieping['SAP.DE']);
  const b = nieuw();
  b.zetVerdieping('SAP.DE', 'scores', 'moat', 2);
  const u = b.zetTerug(back, 'samenvoegen');
  assert.equal(u.ok, true);
  assert.equal(b.verdieping('SAP.DE').scores.moat, 2);                         // eigen waarde blijft
  assert.equal(b.verdieping('SAP.DE').cijfers.kw, 22);                          // ontbrekende waarde komt erbij
  const c = nieuw(); c.zetVerdieping('X', 'scores', 'moat', 1); c.zetTerug(back, 'vervang');
  assert.equal(c.verdieping('X').scores.moat, undefined); assert.equal(c.verdieping('SAP.DE').scores.moat, 5);
});

test('verdieping telt mee voor de back-upherinnering en ontsmet rommel uit een back-up', () => {
  const st = nieuw();
  assert.equal(st.backupNodig('2026-10-21'), false);
  st.zetVerdieping('AAPL', 'scores', 'sector', 4);
  assert.equal(st.backupNodig('2026-10-21'), true);
  const slecht = S.schoonVerdieping({ AAPL: { scores: { management: 9, moat: 3, onzin: 1 }, cijfers: { roe: 'x', kw: 12 }, notities: { moat: 'a'.repeat(900) } }, '<b>': { scores: { moat: 3 } }, LEEG: { scores: {} } });
  assert.deepEqual(Object.keys(slecht), ['AAPL']);
  assert.deepEqual(slecht.AAPL.scores, { moat: 3 }); assert.deepEqual(slecht.AAPL.cijfers, { kw: 12 });
  assert.equal(slecht.AAPL.notities.moat.length, 500);
});

test('volglijst bewaart het oordeel en de koers op het moment van volgen', () => {
  const g = geheugen(), st = S.maak(g, klok('2026-10-21T10:00:00Z'));
  assert.equal(st.voegToe('ASML.AS', SNAP).status, 'toegevoegd');
  const it = st.volglijst()[0];
  assert.deepEqual(it.sinds, { oordeel: 'positief', dekking: 52, zekerheid: 'voorlopig', score: 0.41, datum: '2026-10-21', koers: 123.45, valuta: 'EUR' });
  assert.deepEqual(S.maak(g).volglijst()[0].sinds, it.sinds);                 // blijft bewaard
  assert.equal(st.voegToe('SAP.DE', { oordeel: 'koop!', dekking: 'veel' }).status, 'toegevoegd');
  assert.equal(st.volglijst()[1].sinds, undefined);                           // rommel wordt niet bewaard
  assert.equal(st.voegToe('ASML.AS', { ...SNAP, oordeel: 'vermijden' }).status, 'bestond');
  assert.equal(st.volglijst()[0].sinds.oordeel, 'positief');                  // bestaand item wordt niet overschreven
});

test('aankoop op basis van het signaal: momentopname blijft bewaard en herkenbaar', () => {
  const g = geheugen(), st = S.maak(g, klok('2026-10-21T10:00:00Z'));
  const u = st.voegPositieToe({ ticker: 'ASML.AS', aantal: 3, koers: 700.5, valuta: 'eur', datum: '2026-10-21', signaal: SNAP, opSignaal: true });
  assert.equal(u.ok, true);
  const p = S.maak(g).portefeuille()[0];
  assert.equal(p.opSignaal, true); assert.equal(p.signaal.oordeel, 'positief'); assert.equal(p.signaal.dekking, 52);
  const z = st.voegPositieToe({ ticker: 'SAP.DE', aantal: 1, koers: 100, valuta: 'EUR' });
  assert.equal(z.ok, true);
  const q = st.portefeuille()[1];
  assert.equal(q.opSignaal, undefined); assert.equal(q.signaal, undefined);
  const r = st.voegPositieToe({ ticker: 'X', aantal: 1, koers: 1, valuta: 'EUR', signaal: { oordeel: 'positief' }, opSignaal: true });   // onvolledige momentopname
  assert.equal(r.ok, true);
  assert.equal(st.portefeuille()[2].opSignaal, undefined);                    // geen herkomst zonder geldige momentopname
  const b = st.maakBackup(); const n = nieuw(); n.zetTerug(b, 'samenvoegen');
  assert.equal(n.portefeuille()[0].opSignaal, true);
});
