const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/store.js');

function geheugen(stuk) {
  const m = {};
  return { m, getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { if (stuk) throw new Error('vol'); m[k] = v; } };
}
function klok(start) { let t = Date.parse(start); return () => new Date(t += 1000).toISOString(); }

test('volglijst: toevoegen, dubbel, ongeldig, verwijderen', () => {
  const st = S.maak(geheugen(), klok('2026-10-20T10:00:00Z'));
  assert.equal(st.voegToe('aapl').status, 'toegevoegd');
  assert.equal(st.voegToe(' AAPL ').status, 'bestond');
  assert.equal(st.voegToe('<script>').ok, false);
  assert.equal(st.voegToe('').ok, false);
  assert.equal(st.volglijst().length, 1);
  assert.equal(st.verwijder('aapl'), true);
  assert.equal(st.verwijder('aapl'), false);
});

test('volglijst is begrensd', () => {
  const st = S.maak(geheugen(), klok('2026-10-20T10:00:00Z'));
  for (let i = 0; i < S.MAX_VOLGLIJST; i++) assert.equal(st.voegToe('T' + i).ok, true);
  assert.equal(st.voegToe('EXTRA').ok, false);
});

test('blijft bewaard bij opnieuw openen en overleeft kapotte opslag', () => {
  const g = geheugen();
  S.maak(g, klok('2026-10-20T10:00:00Z')).voegToe('MSFT');
  assert.equal(S.maak(g).zit('msft'), true);
  g.m[S.SLEUTEL] = '{kapot';
  const st = S.maak(g);
  assert.equal(st.volglijst().length, 0);
  assert.match(st.fout(), /niet worden gelezen/);
});

test('vol opslagvak meldt een fout en laat de app werken', () => {
  const st = S.maak(geheugen(true), klok('2026-10-20T10:00:00Z'));
  const r = st.voegToe('AAPL');
  assert.equal(r.ok, false);
  assert.match(st.fout(), /Opslaan/);
});

test('back-up en terugzetten: samenvoegen vervangt niets', () => {
  const a = S.maak(geheugen(), klok('2026-10-20T10:00:00Z'));
  a.voegToe('AAPL'); a.voegToe('MSFT');
  const bestand = a.maakBackup();
  const b = S.maak(geheugen(), klok('2026-10-21T10:00:00Z'));
  b.voegToe('NVDA');
  const r = b.zetTerug(bestand);
  assert.deepEqual([r.ok, r.toegevoegd, r.totaal], [true, 2, 3]);
  assert.equal(b.zetTerug(bestand).toegevoegd, 0);
  const c = S.maak(geheugen(), klok('2026-10-22T10:00:00Z'));
  c.voegToe('NVDA');
  c.zetTerug(bestand, 'vervang');
  assert.deepEqual(c.volglijst().map(x => x.ticker), ['AAPL', 'MSFT']);
});

test('terugzetten weigert vreemde of kapotte bestanden zonder iets te wijzigen', () => {
  const st = S.maak(geheugen(), klok('2026-10-20T10:00:00Z'));
  st.voegToe('AAPL');
  for (const slecht of ['geen json', '{}', '{"app":"Iets anders","soort":"back-up"}', 'null', '[]']) {
    assert.equal(st.zetTerug(slecht).ok, false, slecht);
  }
  assert.equal(st.volglijst().length, 1);
});

test('back-upbestand bevat alleen volglijst en instellingen en ontsmet ongeldige codes', () => {
  const st = S.maak(geheugen(), klok('2026-10-20T10:00:00Z'));
  const vies = JSON.stringify({ app: 'Aandeel Signaal', soort: 'back-up', volglijst: [
    { ticker: 'aapl' }, { ticker: '<img src=x>' }, { ticker: 'AAPL' }, { ticker: 42 }, null], instellingen: { thema: 'rood' } });
  const r = st.zetTerug(vies);
  assert.equal(r.totaal, 1);
  assert.equal(st.staat().instellingen.thema, 'auto');
});

test('herinnering voor back-up', () => {
  const st = S.maak(geheugen(), klok('2026-10-20T10:00:00Z'));
  assert.equal(st.backupNodig('2026-10-20'), false);          // niets te bewaren
  st.voegToe('AAPL');
  assert.equal(st.backupNodig('2026-10-20'), true);           // nog nooit een back-up
  st.maakBackup();
  assert.equal(st.backupNodig('2026-10-20'), false);
  st.zetThema('donker');
  assert.equal(st.backupNodig('2026-10-20'), false);          // thema telt niet als wijziging
  assert.equal(st.backupNodig('2026-11-10'), true);           // ruim 14 dagen
  st.voegToe('MSFT');
  assert.equal(st.backupNodig('2026-10-20'), true);           // wijziging na back-up
});

test('thema wordt opgeslagen en onbekende waarde wordt auto', () => {
  const g = geheugen();
  const st = S.maak(g, klok('2026-10-20T10:00:00Z'));
  st.zetThema('donker');
  assert.equal(S.maak(g).staat().instellingen.thema, 'donker');
  st.zetThema('paars');
  assert.equal(st.staat().instellingen.thema, 'auto');
});

test('rondleiding: standaard niet gezien, blijft bewaard, beschadigde waarde telt niet als gezien', () => {
  const g = geheugen();
  const st = S.maak(g, klok('2026-10-20T10:00:00Z'));
  assert.equal(st.introGezien(), false);
  st.zetIntroGezien(true);
  assert.equal(S.maak(g, klok('2026-10-20T10:00:00Z')).introGezien(), true);
  const k = geheugen(); k.setItem(S.SLEUTEL, JSON.stringify({ introGezien: 'ja' }));
  assert.equal(S.maak(k, klok('2026-10-20T10:00:00Z')).introGezien(), false);
});

test('back-up: inhoud, voorbeeld zonder te wijzigen, en markeren pas na bewaren', () => {
  const a = S.maak(geheugen(), klok('2026-10-20T10:00:00Z')), b = S.maak(geheugen(), klok('2026-10-20T11:00:00Z'));
  a.voegToe('AAPL'); a.voegToe('MSFT');
  const tekst = a.maakBackup(true);                           // zonder markering
  assert.equal(a.inhoud().laatsteBackup, null);
  assert.equal(a.backupNodig('2026-10-20'), true);
  a.markeerBackup('2026-10-20T10:00:00Z');
  assert.equal(a.inhoud().laatsteBackup, '2026-10-20T10:00:00Z');
  assert.equal(a.inhoud().volglijst, 2);
  b.voegToe('AAPL');
  const v = b.bekijkBackup(tekst);
  assert.equal(v.ok, true); assert.equal(v.volglijst, 2); assert.deepEqual(v.nieuw, { volglijst: 1, portefeuille: 0, beoordelingen: 0, portefeuilles: [] });
  assert.equal(b.inhoud().volglijst, 1);                      // alleen bekeken, niets gewijzigd
  assert.equal(b.bekijkBackup('geen json').ok, false);
  assert.equal(b.bekijkBackup('{"app":"Anders"}').ok, false);
});

test('eigen NAIC-groeiverwachting: bewaren, grenzen, wissen, in de back-up', () => {
  const st = S.maak(geheugen(), klok('2026-10-25T10:00:00Z'));
  assert.equal(st.zetVerdieping('SAP.DE', 'cijfers', 'naicgroei', '8,5').ok, true);
  assert.equal(st.verdieping('SAP.DE').cijfers.naicgroei, 8.5);
  assert.equal(st.zetVerdieping('SAP.DE', 'cijfers', 'naicgroei', 80).ok, false);
  assert.match(st.maakBackup(true), /naicgroei/);
  assert.equal(st.zetVerdieping('SAP.DE', 'cijfers', 'naicgroei', null).ok, true);
  assert.equal(st.verdieping('SAP.DE').cijfers.naicgroei, undefined);
});

test('meerdere portefeuilles: aanmaken, kiezen, aankopen per portefeuille, verwijderen', () => {
  const w = S.maak(geheugen());
  assert.deepEqual(w.actief(), { id: 'eigen', naam: 'Mijn portefeuille' });
  assert.equal(w.voegPositieToe({ ticker: 'ASML.AS', aantal: 1, koers: 600, valuta: 'EUR' }).ok, true);
  const n = w.nieuwePortefeuille('BC De Gouden Greep');
  assert.equal(n.ok, true); assert.equal(n.id, 'bc-de-gouden-greep'); assert.equal(w.actief().id, n.id);
  assert.equal(w.nieuwePortefeuille('bc de gouden greep').ok, false);         // zelfde naam
  w.voegPositieToe({ ticker: 'INGA.AS', aantal: 184, koers: 11.77, valuta: 'EUR' });
  assert.equal(w.portefeuille().length, 2);
  assert.equal(w.portefeuille('eigen').length, 1); assert.equal(w.portefeuille(n.id)[0].ticker, 'INGA.AS');
  assert.deepEqual(w.portefeuilles().map(p => p.aantal), [1, 1]);
  assert.equal(w.hernoemPortefeuille(n.id, 'Club').ok, true); assert.equal(w.actief().naam, 'Club');
  assert.equal(w.kiesPortefeuille('eigen'), true); assert.equal(w.kiesPortefeuille('bestaat-niet'), false);
  assert.equal(w.verwijderPortefeuille(n.id), true);
  assert.equal(w.portefeuille().length, 1); assert.equal(w.verwijderPortefeuille('eigen'), false);   // laatste blijft
});

test('oude gegevens zonder portefeuilles: alle aankopen in de eerste', () => {
  const g = geheugen(); g.setItem(S.SLEUTEL, JSON.stringify({ versie: 1, volglijst: [], portefeuille: [{ id: 'a1', ticker: 'ASML.AS', aantal: 1, koers: 600, valuta: 'EUR' }] }));
  const w = S.maak(g);
  assert.equal(w.portefeuille('eigen').length, 1); assert.equal(w.portefeuilles().length, 1);
});

test('back-up met een andere portefeuille samenvoegen: portefeuille en aankopen komen erbij, eigen blijft', () => {
  const w = S.maak(geheugen());
  w.voegPositieToe({ ticker: 'ASML.AS', aantal: 1, koers: 600, valuta: 'EUR' });
  const b = JSON.stringify({ app: 'Aandeel Signaal', soort: 'back-up', versie: 1, portefeuilles: [{ id: 'gouden-greep', naam: 'BC De Gouden Greep' }],
    portefeuille: [{ id: 'gg1', pf: 'gouden-greep', ticker: 'INGA.AS', aantal: 184, koers: 11.77602, valuta: 'EUR' }, { id: 'gg2', pf: 'gouden-greep', ticker: 'ASML.AS', aantal: 1, koers: 600, valuta: 'EUR' }] });
  const v = w.bekijkBackup(b);
  assert.deepEqual(v.nieuw.portefeuilles, ['BC De Gouden Greep']); assert.equal(v.nieuw.portefeuille, 2);   // zelfde aankoop in andere portefeuille is nieuw
  const u = w.zetTerug(b, 'samenvoegen');
  assert.equal(u.ok, true);
  assert.deepEqual(w.portefeuilles().map(p => [p.id, p.aantal]), [['eigen', 1], ['gouden-greep', 2]]);
  assert.equal(w.zetTerug(b, 'samenvoegen').toegevoegd, 0);       // nog een keer: niets dubbel
});
