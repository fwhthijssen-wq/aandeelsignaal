const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/store.js');
const P = require('../js/portefeuille.js');
const G = require('../js/gate.js');

function geheugen(stuk) {
  const m = {};
  return { m, getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { if (stuk) throw new Error('vol'); m[k] = v; } };
}
const klok = () => { let t = Date.parse('2026-10-20T10:00:00Z'); return () => new Date(t += 1000).toISOString(); };
const pos = (o = {}) => Object.assign({ ticker: 'AAPL', aantal: 10, koers: 150, valuta: 'USD', datum: '2026-01-05' }, o);

test('positie: geldige invoer, komma als decimaalteken, ongeldige invoer wordt geweigerd', () => {
  const st = S.maak(geheugen(), klok());
  assert.equal(st.voegPositieToe(pos({ aantal: '2,5', koers: '99,95' })).ok, true);
  assert.equal(st.portefeuille()[0].aantal, 2.5);
  assert.equal(st.portefeuille()[0].koers, 99.95);
  for (const slecht of [{ aantal: 0 }, { aantal: -1 }, { aantal: 'abc' }, { aantal: '' }, { aantal: NaN }, { aantal: Infinity }, { aantal: true },
    { koers: 0 }, { koers: -5 }, { koers: null }, { valuta: 'EURO' }, { valuta: '' }, { ticker: '<x>' }, { ticker: '' }]) {
    assert.equal(st.voegPositieToe(pos(slecht)).ok, false, JSON.stringify(slecht));
  }
  assert.equal(st.portefeuille().length, 1);
});

test('positie: meerdere aankopen van hetzelfde aandeel, verwijderen en ongedaan maken', () => {
  const st = S.maak(geheugen(), klok());
  const a = st.voegPositieToe(pos()), b = st.voegPositieToe(pos({ aantal: 5 }));
  assert.notEqual(a.id, b.id);
  const weg = st.portefeuille().find(p => p.id === a.id);
  assert.equal(st.verwijderPositie(a.id), true);
  assert.equal(st.verwijderPositie(a.id), false);
  assert.equal(st.portefeuille().length, 1);
  assert.equal(st.herstelPositie(weg), true);
  assert.equal(st.portefeuille().length, 2);
  assert.equal(st.herstelPositie(weg), false);
});

test('portefeuille is begrensd', () => {
  const st = S.maak(geheugen(), klok());
  for (let i = 0; i < S.MAX_POSITIES; i++) assert.equal(st.voegPositieToe(pos()).ok, true);
  assert.equal(st.voegPositieToe(pos()).ok, false);
});

test('positie blijft bewaard na herladen en wordt opgeslagen', () => {
  const g = geheugen();
  S.maak(g, klok()).voegPositieToe(pos());
  const nieuw = S.maak(g, klok());
  assert.equal(nieuw.portefeuille().length, 1);
  assert.equal(nieuw.portefeuille()[0].ticker, 'AAPL');
});

test('beschadigde posities in opslag worden weggelaten, de rest blijft', () => {
  const g = geheugen();
  g.setItem(S.SLEUTEL, JSON.stringify({ volglijst: [], portefeuille: [pos({ id: 'a' }), { ticker: 'X', aantal: -3, koers: 1, valuta: 'EUR' }, 'rommel', null, pos({ id: 'b', aantal: 'x' })] }));
  assert.equal(S.maak(g, klok()).portefeuille().length, 1);
});

test('back-up bevat de portefeuille; samenvoegen dubbelt niets; vervangen vervangt', () => {
  const a = S.maak(geheugen(), klok());
  a.voegPositieToe(pos()); a.voegPositieToe(pos({ ticker: 'ASML', valuta: 'EUR', koers: 700, aantal: 3 }));
  const tekst = a.maakBackup();
  assert.equal(JSON.parse(tekst).portefeuille.length, 2);
  const b = S.maak(geheugen(), klok());
  const u = b.zetTerug(tekst, 'samenvoegen');
  assert.equal(u.ok, true); assert.equal(b.portefeuille().length, 2);
  b.zetTerug(tekst, 'samenvoegen');
  assert.equal(b.portefeuille().length, 2, 'tweede keer terugzetten mag niets dubbel zetten');
  const c = S.maak(geheugen(), klok());
  c.voegPositieToe(pos({ ticker: 'MSFT', koers: 300 }));
  c.zetTerug(tekst, 'samenvoegen');
  assert.equal(c.portefeuille().length, 3, 'samenvoegen behoudt eigen aankopen');
  c.zetTerug(tekst, 'vervang');
  assert.equal(c.portefeuille().length, 2);
  const ids = c.portefeuille().map(p => p.id); assert.equal(new Set(ids).size, ids.length);
});

test('back-up zonder portefeuille (oude versie) werkt nog', () => {
  const st = S.maak(geheugen(), klok());
  const u = st.zetTerug(JSON.stringify({ app: 'Aandeel Signaal', soort: 'back-up', volglijst: [{ ticker: 'AAPL' }] }), 'samenvoegen');
  assert.equal(u.ok, true); assert.equal(st.volglijst().length, 1); assert.equal(st.portefeuille().length, 0);
});

test('back-upherinnering geldt ook voor alleen een portefeuille', () => {
  const st = S.maak(geheugen(), klok());
  assert.equal(st.backupNodig('2026-10-20'), false);
  st.voegPositieToe(pos());
  assert.equal(st.backupNodig('2026-10-20'), true);
  st.maakBackup();
  assert.equal(st.backupNodig('2026-10-20'), false);
});

const aandelen = [
  { ticker: 'AAPL', naam: 'Apple', valuta: 'USD', koers: { slot: 200, datum: '2026-10-19' } },
  { ticker: 'OLD', naam: 'Oud', valuta: 'USD', koers: { slot: 50, datum: '2026-09-01' } },
  { ticker: 'SHEL', naam: 'Shell', valuta: 'EUR', koers: { slot: 30, datum: '2026-10-19' } },
  { ticker: 'LEEG', naam: 'Leeg', valuta: 'USD', koers: null },
  { ticker: 'NUL', naam: 'Nul', valuta: 'USD', koers: { slot: 0, datum: '2026-10-19' } },
];
const waardeer = ps => P.waardeer(ps, aandelen, '2026-10-20', G);

test('waardering: winst, verlies en percentage kloppen', () => {
  const r = waardeer([pos({ aantal: 10, koers: 150 })]);
  assert.equal(r.regels[0].status, 'ok');
  assert.equal(r.regels[0].waarde, 2000); assert.equal(r.regels[0].kosten, 1500);
  assert.equal(r.regels[0].winst, 500); assert.equal(r.regels[0].pct, 33.3);
  assert.equal(waardeer([pos({ koers: 250 })]).regels[0].winst, -500);
});

test('waardering: verouderde, ontbrekende of nulkoers geeft geen waarde', () => {
  for (const t of ['OLD', 'LEEG', 'NUL', 'ONBEKEND']) {
    const r = waardeer([pos({ ticker: t })]).regels[0];
    assert.notEqual(r.status, 'ok', t); assert.equal(r.waarde, null, t); assert.equal(r.winst, null, t); assert.ok(r.reden, t);
  }
  assert.equal(waardeer([pos({ ticker: 'OLD' })]).regels[0].status, 'verouderd');
});

test('waardering: andere valuta dan de aankoop wordt niet omgerekend', () => {
  const r = waardeer([pos({ ticker: 'SHEL', valuta: 'USD' })]).regels[0];
  assert.equal(r.status, 'valuta'); assert.equal(r.waarde, null);
  assert.equal(waardeer([pos({ ticker: 'SHEL', valuta: 'EUR', koers: 25 })]).regels[0].status, 'ok');
});

test('totalen: per valuta, nooit gemengd, en niet-waardeerbare aankopen tellen niet mee', () => {
  const r = waardeer([pos(), pos({ ticker: 'SHEL', valuta: 'EUR', koers: 25, aantal: 4 }), pos({ ticker: 'OLD', koers: 40, aantal: 1 })]);
  assert.deepEqual(r.totalen.map(t => t.valuta), ['EUR', 'USD']);
  const usd = r.totalen.find(t => t.valuta === 'USD'), eur = r.totalen.find(t => t.valuta === 'EUR');
  assert.equal(usd.waarde, 2000); assert.equal(usd.kosten, 1500); assert.equal(usd.meegeteld, 1); assert.equal(usd.buiten, 1);
  assert.equal(usd.kostenAlles, 1540);
  assert.equal(eur.waarde, 120); assert.equal(eur.winst, 20);
});

test('totalen: afronding zonder drijvendekommafouten', () => {
  const r = waardeer([pos({ aantal: 3, koers: 0.1 }), pos({ aantal: 3, koers: 0.2 })]);
  assert.equal(r.totalen[0].kosten, 0.9);
});

test('herkomst: aankopen op signaal apart van de overige, per valuta, alleen wat meetelt', () => {
  const G = require('../js/gate.js');
  const aand = [{ ticker: 'A', naam: 'A', valuta: 'EUR', koers: { slot: 120.5, datum: '2026-10-20' } }, { ticker: 'B', naam: 'B', valuta: 'EUR', koers: { slot: 80, datum: '2026-10-20' } }, { ticker: 'C', naam: 'C', valuta: 'USD', koers: { slot: 10, datum: '2026-10-20' } }, { ticker: 'D', naam: 'D', valuta: 'EUR', koers: { slot: 50, datum: '2026-08-01' } }];
  const pos = [{ id: '1', ticker: 'A', aantal: 10, koers: 100, valuta: 'EUR', opSignaal: true }, { id: '2', ticker: 'B', aantal: 10, koers: 100, valuta: 'EUR' }, { id: '3', ticker: 'C', aantal: 1, koers: 8, valuta: 'USD', opSignaal: true }, { id: '4', ticker: 'D', aantal: 1, koers: 5, valuta: 'EUR', opSignaal: true }];
  const res = P.waardeer(pos, aand, '2026-10-21', G);
  const h = P.herkomst(res.regels);
  assert.deepEqual(h.map((x) => x.valuta), ['EUR', 'USD']);
  const eur = h[0];
  assert.deepEqual(eur.signaal, { n: 1, kosten: 1000, winst: 205, pct: 20.5 });
  assert.deepEqual(eur.overig, { n: 1, kosten: 1000, winst: -200, pct: -20 });     // D (verouderde koers) telt niet mee
  assert.equal(h[1].signaal.n, 1); assert.equal(h[1].overig.n, 0); assert.equal(h[1].overig.pct, null);
});

test('volg: verandering sinds het volgen, met reden als het niet kan', () => {
  const G = require('../js/gate.js');
  const it = { ticker: 'A', sinds: { oordeel: 'positief', dekking: 50, datum: '2026-10-01', koers: 80, valuta: 'EUR' } };
  const rec = (o) => Object.assign({ ticker: 'A', valuta: 'EUR', koers: { slot: 92, datum: '2026-10-20' } }, o);
  const v = P.volg(it, rec(), '2026-10-21', G);
  assert.deepEqual([v.status, v.pct, v.dagen], ['ok', 15, 20]);
  assert.equal(P.volg(it, rec({ valuta: 'USD' }), '2026-10-21', G).status, 'valuta');
  assert.equal(P.volg(it, rec({ koers: { slot: 92, datum: '2026-09-01' } }), '2026-10-21', G).status, 'verouderd');
  assert.equal(P.volg(it, rec({ koers: null }), '2026-10-21', G).status, 'geen_koers');
  assert.equal(P.volg({ ticker: 'A' }, rec(), '2026-10-21', G).status, 'geen');
  assert.equal(P.volg(it, null, '2026-10-21', G).status, 'geen_koers');
  assert.equal(P.volg(it, rec({ koers: { slot: 60, datum: '2026-10-20' } }), '2026-10-21', G).pct, -25);
});

test('Londen: koers in ponden, aankoop in pence telt mee (vaste eenheid, geen wisselkoers)', () => {
  const P = require('../js/portefeuille.js');
  const gate = { priceFreshness: () => ({ fresh: true }) };
  const rec = { ticker: 'ULVR.L', naam: 'Unilever', valuta: 'GBP', koers: { slot: 45.0, datum: '2026-10-21' } };
  const res = P.waardeer([{ ticker: 'ULVR.L', aantal: 10, koers: 4000, valuta: 'GBX' }, { ticker: 'ULVR.L', aantal: 10, koers: 40, valuta: 'GBP' }], [rec], '2026-10-21', gate);
  assert.equal(res.regels[0].status, 'ok'); assert.equal(res.regels[0].waarde, 45000);
  assert.equal(res.regels[1].status, 'ok'); assert.equal(res.regels[1].waarde, 450);
  assert.equal(P.koersIn({ valuta: 'GBP', koers: { slot: 45 } }, 'EUR'), null);
  assert.equal(P.koersIn({ valuta: 'GBX', koers: { slot: 4500 } }, 'GBP'), null);
});
