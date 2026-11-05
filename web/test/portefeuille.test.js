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

test('Londen: aankoopkoers in pence ingevoerd als GBP wordt herkend', () => {
  const P = require('../js/portefeuille.js');
  const rec = { ticker: 'JD.L', valuta: 'GBP', koers: { slot: 0.956 } };
  assert.equal(P.penceVermoeden({ ticker: 'JD.L', valuta: 'GBP', koers: 94.98 }, rec), 95.6);
  assert.equal(P.penceVermoeden({ ticker: 'JD.L', valuta: 'GBP', koers: 0.9498 }, rec), null);     // al in ponden
  assert.equal(P.penceVermoeden({ ticker: 'JD.L', valuta: 'GBX', koers: 94.98 }, rec), null);     // al in pence
  assert.equal(P.penceVermoeden({ ticker: 'ASML.AS', valuta: 'EUR', koers: 600 }, { ticker: 'ASML.AS', valuta: 'EUR', koers: { slot: 6 } }), null);
});

test('overzicht in euro: kosten, dividend, splitsing, verkoop en index', () => {
  const vandaag = '2026-11-03';
  const rec = { ticker: 'AAPL', naam: 'Apple', valuta: 'USD', indices: [], koers: { slot: 110, datum: '2026-11-02', splitsingen: [['2025-06-01', 2]], dividenden: [['2025-03-01', 1], ['2025-09-01', 0.5], ['2024-01-01', 9]] } };
  const p = { id: 'a', ticker: 'AAPL', aantal: 10, koers: 200, valuta: 'USD', datum: '2025-01-02', kosten: 5, eur: 1800,
    verkopen: [{ id: 'v', datum: '2026-01-05', aantal: 4, koers: 105, kosten: 5, eur: 380 }] };
  const fx = { datum: '2026-11-02', USD: 0.9, GBP: 1.2 };
  const reeksen = { VS: [['2025-01-03', 5000], ['2026-01-02', 5500], ['2026-10-30', 6000]] };
  const o = P.overzicht([p], [rec], vandaag, G, { fx, indexreeksen: reeksen });
  const r = o.regels[0];
  assert.equal(r.status, 'ok');
  assert.equal(r.inleg, 1805);
  assert.equal(r.open, 16, '10 stuks, 2-voor-1 gesplitst = 20, waarvan 4 verkocht');
  assert.equal(r.waardeOpen, 16 * 110 * 0.9);
  assert.equal(r.opbrengst, 375);
  // dividend: maart 2025 1 × 20 (huidige basis) + september 2025 0,5 × 20, in euro tegen 0,9
  assert.equal(r.dividend, 27);
  assert.equal(r.resultaat, Math.round((1584 + 375 + 27 - 1805) * 100) / 100);
  assert.ok(r.idx && r.idx.pct > 0, 'index gestegen');
  assert.equal(o.totalen.open, 1); assert.equal(o.totalen.inleg, 1805);
});

test('overzicht: zonder eurobedrag of met een andere notering telt een aankoop niet mee', () => {
  const rec = { ticker: 'SHEL', naam: 'Shell', valuta: 'USD', koers: { slot: 70, datum: '2026-11-02' } };
  const o = P.overzicht([{ id: 'a', ticker: 'SHEL', aantal: 30, koers: 36.73, valuta: 'EUR', eur: 1101.9 }, { id: 'b', ticker: 'SHEL', aantal: 1, koers: 70, valuta: 'USD' }], [rec], '2026-11-03', G, { fx: { USD: 0.9, GBP: 1.2 } });
  assert.equal(o.regels[0].status, 'valuta'); assert.equal(o.regels[1].status, 'ok'); assert.match(o.regels[1].notities[0], /geschat/); assert.equal(o.totalen.buiten, 1);
  assert.equal(P.overzicht([{ id: 'b', ticker: 'SHEL', aantal: 1, koers: 70, valuta: 'USD' }], [rec], '2026-11-03', G, {}).regels[0].status, 'euro', 'zonder ECB-koers niet te schatten');
});

test('dividendkalender: ontvangen dit jaar en verwacht de komende 12 maanden', () => {
  const rec = { ticker: 'ASML.AS', naam: 'ASML', valuta: 'EUR', koers: { slot: 700, datum: '2026-11-04', dividenden: [['2025-11-04', 1.6], ['2026-02-10', 1.6], ['2026-04-28', 1.84], ['2026-07-29', 1.6], ['2026-10-28', 1.6]] } };
  const us = { ticker: 'AAPL', naam: 'Apple', valuta: 'USD', koers: { slot: 200, datum: '2026-11-04', dividenden: [['2026-02-09', 0.26], ['2026-05-11', 0.26], ['2026-08-10', 0.26]] } };
  const pos = [{ id: 'a', ticker: 'ASML.AS', aantal: 10, koers: 600, valuta: 'EUR', datum: '2026-03-01' }, { id: 'b', ticker: 'AAPL', aantal: 100, koers: 150, valuta: 'USD', datum: '2025-01-01', eur: 14000 }];
  const k = P.dividendKalender(pos, [rec, us], '2026-11-05', { fx: { USD: 0.9, GBP: 1.2 } });
  // ontvangen 2026: ASML (gekocht 1 maart) 1,84 + 1,6 + 1,6 per stuk × 10; Apple 3 × 0,26 × 100 × 0,9
  assert.equal(k.ontvangenEur, Math.round((50.4 + 70.2) * 100) / 100);
  // verwacht: alle dividenden van de afgelopen 12 maanden een jaar later (ASML 2025-11-04 valt net buiten het venster)
  assert.equal(k.verwacht.filter(x => x.ticker === 'ASML.AS').length, 4);
  assert.equal(k.verwacht[0].datum, '2027-02-09');
  assert.ok(k.perMaand.length >= 4);
  assert.equal(k.verwachtEur, Math.round((16 + 18.4 + 16 + 16 + 3 * 23.4) * 100) / 100);
});
