const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/store.js');
const C = require('../js/checklist.js');

function geheugen(start) { const m = Object.assign({}, start); return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; }
const nu = () => '2026-10-20T10:00:00Z';

test('15 punten, unieke id 1..15, elk met vraag en bron', () => {
  assert.equal(C.PUNTEN.length, 15); assert.equal(S.PUNTEN_AANTAL, 15);
  assert.deepEqual(C.PUNTEN.map(p => p.id), Array.from({ length: 15 }, (_, i) => i + 1));
  for (const p of C.PUNTEN) { assert.ok(p.tekst.endsWith('?') && p.waar && p.groep, String(p.id)); }
});

test('voortgang telt alleen; onbeantwoord is nooit ja of nee', () => {
  const v = C.voortgang({ 1: { a: 'ja', n: '' }, 2: { a: 'nee', n: '' }, 3: { a: 'onzeker', n: '' }, 4: { a: null, n: 'alleen notitie' }, 5: { a: 'kapot', n: '' }, 99: { a: 'ja', n: '' } });
  assert.deepEqual(v, { totaal: 15, beantwoord: 3, ja: 1, nee: 1, onzeker: 1, open: 12 });
  assert.deepEqual(C.voortgang(undefined), { totaal: 15, beantwoord: 0, ja: 0, nee: 0, onzeker: 0, open: 15 });
  assert.equal(Object.keys(v).some(k => /score|punten$|oordeel/.test(k)), false);
});

test('zetPunt bewaart, behoudt notitie bij alleen antwoord, wist leeg punt, en overleeft herladen', () => {
  const g = geheugen(); const s = S.maak(g, nu);
  assert.equal(s.zetPunt('aapl', 5, 'ja', 'sterke marge').ok, true);
  assert.equal(s.zetPunt('AAPL', 5, 'nee').ok, true);
  assert.deepEqual(s.checklist('AAPL'), { 5: { a: 'nee', n: 'sterke marge' } });
  const s2 = S.maak(g, nu);
  assert.deepEqual(s2.checklist('AAPL'), { 5: { a: 'nee', n: 'sterke marge' } });
  s2.zetPunt('AAPL', 5, null, '   ');
  assert.deepEqual(s2.checklist('AAPL'), {}); assert.deepEqual(s2.staat().checklist, {});
});

test('ongeldige invoer wordt geweigerd of schoongemaakt', () => {
  const s = S.maak(geheugen(), nu);
  for (const id of [0, 16, 1.5, -1, 'x', NaN, null]) assert.equal(s.zetPunt('AAPL', id, 'ja').ok, false, String(id));
  assert.equal(s.zetPunt('<script>', 1, 'ja').ok, false);
  s.zetPunt('AAPL', 2, 'misschien', ''); assert.deepEqual(s.checklist('AAPL'), {});
  s.zetPunt('AAPL', 2, 'ja', 'x'.repeat(5000)); assert.equal(s.checklist('AAPL')[2].n.length, S.MAX_NOTITIE);
  const schoon = S.schoonChecklist({ AAPL: { punten: { 1: { a: 'ja', n: 5 }, 16: { a: 'ja' }, abc: { a: 'ja' }, 3: { a: 'weird', n: '' } } }, '!!': { punten: { 1: { a: 'ja' } } }, MSFT: 'kapot', __proto__: { x: 1 } });
  assert.deepEqual(schoon, { AAPL: { punten: { 1: { a: 'ja', n: '' } }, bijgewerkt: null } });
  assert.deepEqual(S.schoonChecklist(null), {}); assert.deepEqual(S.schoonChecklist([1, 2]), {});
});

test('back-up bevat de checklist; samenvoegen overschrijft nooit een bestaand antwoord; vervangen wel', () => {
  const a = S.maak(geheugen(), nu); a.zetPunt('AAPL', 1, 'ja', 'oud'); a.zetPunt('AAPL', 2, 'nee', '');
  const tekst = a.maakBackup(); assert.ok(JSON.parse(tekst).checklist.AAPL);
  const b = S.maak(geheugen(), nu); b.zetPunt('AAPL', 1, 'nee', 'nieuw'); b.zetPunt('MSFT', 4, 'ja', '');
  const u = b.zetTerug(tekst, 'samenvoegen');
  assert.equal(u.ok, true);
  assert.deepEqual(b.checklist('AAPL'), { 1: { a: 'nee', n: 'nieuw' }, 2: { a: 'nee', n: '' } });
  assert.deepEqual(b.checklist('MSFT'), { 4: { a: 'ja', n: '' } });
  b.zetTerug(tekst, 'vervang');
  assert.deepEqual(b.checklist('MSFT'), {}); assert.deepEqual(b.checklist('AAPL'), { 1: { a: 'ja', n: 'oud' }, 2: { a: 'nee', n: '' } });
});

test('oude opslag zonder checklist werkt en een back-up-herinnering telt de checklist als gegevens', () => {
  const g = geheugen({ [S.SLEUTEL]: JSON.stringify({ volglijst: [], portefeuille: [] }) });
  const s = S.maak(g, nu); assert.deepEqual(s.checklist('AAPL'), {});
  assert.equal(s.backupNodig('2026-10-20'), false);
  s.zetPunt('AAPL', 1, 'ja', ''); assert.equal(s.backupNodig('2026-10-20'), true);
});
