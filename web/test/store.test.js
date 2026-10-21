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
  assert.equal(v.ok, true); assert.equal(v.volglijst, 2); assert.deepEqual(v.nieuw, { volglijst: 1, portefeuille: 0, beoordelingen: 0 });
  assert.equal(b.inhoud().volglijst, 1);                      // alleen bekeken, niets gewijzigd
  assert.equal(b.bekijkBackup('geen json').ok, false);
  assert.equal(b.bekijkBackup('{"app":"Anders"}').ok, false);
});
