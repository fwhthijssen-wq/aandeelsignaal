/* Nachtelijke stap van de modelportefeuille (na bouw_webdata.py en de kwaliteitsbewaker).
   Gebruik: node modelportefeuille.js web/data/aandelen.json model/staat.json web/data [--terug model/terug.json] [--stap]
   - rekent per fonds het NAIC-oordeel, de zone, het koopmoment en de zekerheid uit, precies zoals de app;
   - haalt de dagkoers van de ECB (USD en GBP);
   - verwerkt de dag in de modelportefeuille (web/js/model.js) en bewaart de staat (alleen aanvullen, nooit herschrijven);
   - schrijft web/data/model.js voor de app (met de teruggerekende versie als die er is).
   Alleen met --stap wordt de dag verwerkt (de nachtelijke run, niet een publicatie overdag met koersen van een lopende
   handelsdag); zonder --stap wordt alleen web/data/model.js opnieuw geschreven. */
'use strict';
const fs = require('fs'), path = require('path');
const W = path.join(__dirname, 'web', 'js');
const S = require(path.join(W, 'signaal.js')), G = require(path.join(W, 'gate.js')), N = require(path.join(W, 'naic.js'));
const K = require(path.join(W, 'kortetermijn.js')), V = require(path.join(W, 'vergelijk.js')), M = require(path.join(W, 'model.js'));

const INDEX_CODES = ['AEX', 'AMX', 'BEL20', 'CAC40', 'DAX', 'FTSE', 'IBEX', 'MIB', 'VS'];
function indexVan(rec) {                     // zoals bouw_webdata.index_voor
  const ix = (rec.indices || []).filter((i) => INDEX_CODES.includes(i));
  return ix.length ? ix[0] : (rec.ticker.includes('.') ? null : 'VS');
}
function zekerheid(rec, vandaag) {
  const k = V.kant(rec, vandaag, G);
  return k.bevestigd ? 'bevestigd' : k.niveau === 'jaarverslag' ? 'jaarverslag' : k.niveau === 'indicatief' ? (k.tweeBronnen ? 'tweebronnen' : 'indicatief') : 'geen';
}

/* Kwaliteit volgens NAIC: 'zwak' als het geen groeibedrijf meer is (Vermijden zonder koerszones), het laatste jaar verlies
   gaf, of een kwaliteitstoets (omzet, marge vóór belasting, rendement op eigen vermogen) afvalt; 'goed' anders; null als
   NAIC te weinig gegevens heeft. */
function kwaliteitVan(n) {
  if (!n) return null;
  if ((n.kwaliteit || []).some((q) => q.ok === false)) return 'zwak';
  if (n.oordeel === 'vermijden' && !n.zones) return 'zwak';
  if (!n.oordeel && /niet positief/.test(n.reden || '')) return 'zwak';
  return n.oordeel ? 'goed' : null;
}

/* Eén fonds zoals de modelportefeuille het nodig heeft. */
function fondsVoorModel(rec, vandaag) {
  const k = rec.koers;
  if (!k || !(k.slot > 0) || !k.datum) return null;
  const b = S.beoordeel(rec, { vandaag, gate: G, naic: N }), n = b.naic || {};
  const t = K.kortetermijn(k, G.priceFreshness(k.datum, vandaag).fresh);
  return { naam: rec.naam, valuta: rec.valuta, koers: k.slot, koersDatum: k.datum, index: indexVan(rec),
    oordeel: n.oordeel || null, zone: (n.zones && n.zones.zone) || null, moment: t ? t.status : null, zekerheid: zekerheid(rec, vandaag), kwaliteit: kwaliteitVan(n),
    dividenden: k.dividenden || [], splitsingen: k.splitsingen || [] };
}

/* ECB-referentiekoersen (valuta per euro) → euro per eenheid valuta. */
async function ecb() {
  const url = 'https://data-api.ecb.europa.eu/service/data/EXR/D.USD+GBP.EUR.SP00.A?lastNObservations=5&format=csvdata';
  const r = await fetch(url, { headers: { Accept: 'text/csv' }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error('ECB ' + r.status);
  return ecbUitCsv(await r.text());
}
function ecbUitCsv(tekst) {
  const regels = tekst.trim().split(/\r?\n/), kop = regels.shift().split(',');
  const iV = kop.indexOf('CURRENCY'), iD = kop.indexOf('TIME_PERIOD'), iW = kop.indexOf('OBS_VALUE');
  const laatst = {};
  for (const r of regels) {
    const c = r.split(','), v = c[iV], d = c[iD], w = Number(c[iW]);
    if ((v === 'USD' || v === 'GBP') && w > 0 && (!laatst[v] || d > laatst[v].d)) laatst[v] = { d, w };
  }
  if (!laatst.USD || !laatst.GBP) return null;
  return { datum: laatst.USD.d > laatst.GBP.d ? laatst.USD.d : laatst.GBP.d, USD: Math.round(1e6 / laatst.USD.w) / 1e6, GBP: Math.round(1e6 / laatst.GBP.w) / 1e6 };
}

function dagVoorModel(data, vandaag, fx) {
  const fondsen = {};
  for (const rec of data.aandelen || []) { const f = fondsVoorModel(rec, vandaag); if (f) fondsen[rec.ticker] = f; }
  return { datum: vandaag, fx, fondsen, indexen: data.indexen || {} };
}

function schrijfApp(uitMap, staat, terug) {
  const inhoud = { gemaakt: new Date().toISOString(), live: staat ? M.voorApp(staat) : null, terug: terug ? Object.assign(M.voorApp(terug.staat), { periode: terug.periode, opmerking: terug.opmerking }) : null };
  fs.writeFileSync(path.join(uitMap, 'model.js'), 'window.MODEL_DATA = ' + JSON.stringify(inhoud) + ';\n');
  return inhoud;
}

async function main() {
  const args = process.argv.slice(2), vlag = (n) => { const i = args.indexOf(n); if (i < 0) return null; const w = args[i + 1]; args.splice(i, 2); return w; };
  const terugPad = vlag('--terug'), doeStap = args.includes('--stap');
  const [dataPad, staatPad, uitMap] = args.filter((a) => !a.startsWith('--'));
  const terug = terugPad && fs.existsSync(terugPad) ? JSON.parse(fs.readFileSync(terugPad, 'utf8')) : null;
  let staat = fs.existsSync(staatPad) ? JSON.parse(fs.readFileSync(staatPad, 'utf8')) : null;
  if (doeStap) {
    const data = JSON.parse(fs.readFileSync(dataPad, 'utf8')), vandaag = new Date().toISOString().slice(0, 10);
    let fx = null;
    try { fx = await ecb(); } catch (e) { console.log('::warning title=Modelportefeuille::ECB-koersen niet opgehaald (' + e.message + '); de laatst bekende worden gebruikt'); }
    if (!staat) staat = M.nieuw(vandaag);
    const dag = dagVoorModel(data, vandaag, fx);
    const uit = M.stap(staat, dag);
    fs.mkdirSync(path.dirname(staatPad), { recursive: true });
    fs.writeFileSync(staatPad, JSON.stringify(staat));
    const s = staat.varianten.map((v) => { const x = M.samenvatting(v); return `${v.id}: ${x.open} open, ${x.gesloten} verkocht, ${x.wacht} orders, ${x.pct == null ? '-' : x.pct + '%'} (index ${x.idxPct == null ? '-' : x.idxPct + '%'})`; }).join(' | ');
    console.log(`::notice title=Modelportefeuille::${vandaag}: ${Object.keys(dag.fondsen).length} fondsen; gekocht ${uit.gekocht.map((p) => p.ticker).join(' ') || '-'}; verkocht ${uit.verkocht.map((p) => p.ticker).join(' ') || '-'} | ${s}`);
  }
  schrijfApp(uitMap, staat, terug);
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { kwaliteitVan, fondsVoorModel, ecbUitCsv, dagVoorModel, schrijfApp, indexVan };
