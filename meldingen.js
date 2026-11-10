/* Pushmeldingen voor de eigen portefeuilles (nachtelijke update, alleen met goede gegevens).
   Gebruik: MELDINGEN='<tekst uit de app>' node meldingen.js web/data/aandelen.json meldingen/staat.json [--test]
   - MELDINGEN (geheim in GitHub) bevat per toestel: een eigen VAPID-sleutelpaar (door de app op het toestel gemaakt), het
     push-abonnement en de beurscodes uit de eigen portefeuilles. Niets daarvan komt in de repository of in de logboeken.
   - Per beurscode wordt vergeleken met de vorige nacht: in de koopzone (NAIC Kopen), in de verkoopzone, of een omslag van de
     middellange termijn naar positief of negatief. Eén bericht per toestel per nacht.
   - De vorige stand staat in meldingen/staat.json (Actions-cache, niet openbaar). Bij een nieuw toestel eerst één bevestiging.
   - Met --test: alleen een testbericht naar elk toestel. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const W = path.join(__dirname, 'web', 'js');
const G = require(path.join(W, 'gate.js')), K = require(path.join(W, 'kortetermijn.js')), T = require(path.join(W, 'termijn.js'));
const { fondsVoorModel } = require(path.join(__dirname, 'modelportefeuille.js'));

function leesInstelling(tekst) {
  const d = JSON.parse(tekst);
  const lijst = Array.isArray(d) ? d : Array.isArray(d.toestellen) ? d.toestellen : [d];
  return lijst.filter((x) => x && x.vapid && x.vapid.publiek && x.vapid.prive && x.abonnement && x.abonnement.endpoint)
    .map((x) => ({ vapid: x.vapid, abonnement: x.abonnement, tickers: (x.tickers || []).filter((t) => typeof t === 'string' && /^[A-Z0-9.\-^]{1,16}$/.test(t)) }));
}

/* Stand per fonds zoals de app die toont: NAIC-oordeel en -zone, middellange termijn. */
function standVan(rec, vandaag) {
  const f = fondsVoorModel(rec, vandaag);
  if (!f) return null;
  const trend = K.kortetermijn(rec.koers, G.priceFreshness(rec.koers.datum, vandaag).fresh);
  const ml = T.middellang(rec, trend, vandaag);
  return { oordeel: f.oordeel, zone: f.zone, ml: ml ? ml.status : null };
}

/* Wat is er veranderd sinds de vorige stand? */
function gebeurtenissen(naam, oud, nieuw) {
  if (!oud || !nieuw) return [];
  const uit = [];
  const verkoop = (z) => z === 'verkoop' || z === 'boven';
  if (nieuw.oordeel === 'kopen' && oud.oordeel !== 'kopen') uit.push(naam + ': in de koopzone (NAIC Kopen)');
  if (verkoop(nieuw.zone) && !verkoop(oud.zone)) uit.push(naam + ': in de verkoopzone');
  if ((nieuw.ml === 'positief' || nieuw.ml === 'negatief') && nieuw.ml !== oud.ml) uit.push(naam + ': middellange termijn nu ' + nieuw.ml);
  return uit;
}

function sleutel(abonnement) { return crypto.createHash('sha256').update(abonnement.endpoint).digest('hex').slice(0, 16); }

async function versturen(toestel, bericht) {
  const webpush = require('web-push');
  await webpush.sendNotification(toestel.abonnement, JSON.stringify(bericht), {
    vapidDetails: { subject: 'https://fwhthijssen-wq.github.io/aandeelsignaal/', publicKey: toestel.vapid.publiek, privateKey: toestel.vapid.prive }, TTL: 36 * 3600 });
}

async function main() {
  const args = process.argv.slice(2), test = args.includes('--test');
  const [dataPad, staatPad] = args.filter((a) => !a.startsWith('--'));
  if (!process.env.MELDINGEN) { console.log('Geen meldingen ingesteld.'); return; }
  let toestellen;
  try { toestellen = leesInstelling(process.env.MELDINGEN); } catch (e) { console.log('::warning title=Meldingen::de tekst in het geheim MELDINGEN is geen geldige instelling'); return; }
  if (test) {
    for (const t of toestellen) {
      const kenmerk = sleutel(t.abonnement).slice(0, 8);
      try { await versturen(t, { titel: 'Aandeel Signaal', tekst: 'Testmelding: meldingen werken op dit toestel.', url: '#/portefeuille' }); console.log(`::notice title=Meldingen::testmelding verstuurd naar toestel ${kenmerk} (${t.tickers.length} aandelen); vergelijk met het kenmerk in de app bij Instellingen › Meldingen`); }
      catch (e) { console.log(`::warning title=Meldingen::testmelding naar toestel ${kenmerk} mislukt (` + (e.statusCode || e.message) + ')' + (e.statusCode === 404 || e.statusCode === 410 ? ': dit toestel is niet meer aangemeld; zet meldingen in de app opnieuw aan en werk het geheim bij' : '')); }
    }
    return;
  }
  const data = JSON.parse(fs.readFileSync(dataPad, 'utf8')), vandaag = new Date().toISOString().slice(0, 10);
  const per = {}; for (const r of data.aandelen || []) per[r.ticker] = r;
  const staat = fs.existsSync(staatPad) ? JSON.parse(fs.readFileSync(staatPad, 'utf8')) : { fondsen: {}, toestellen: {} };
  const nieuweStand = {}, alle = new Set(toestellen.flatMap((t) => t.tickers));
  for (const t of alle) { const r = per[t]; const s = r ? standVan(r, vandaag) : null; if (s) nieuweStand[t] = s; }
  let verstuurd = 0, mislukt = 0;
  for (const t of toestellen) {
    const k = sleutel(t.abonnement), regels = [];
    for (const tk of t.tickers) regels.push(...gebeurtenissen(per[tk] ? per[tk].naam : tk, staat.fondsen[tk], nieuweStand[tk]));
    let bericht = null;
    if (!staat.toestellen[k]) bericht = { titel: 'Aandeel Signaal', tekst: 'Meldingen staan aan voor ' + t.tickers.length + ' aandelen uit uw portefeuilles.', url: '#/portefeuille' };
    else if (regels.length) bericht = { titel: regels.length === 1 ? 'Signaal in uw portefeuille' : regels.length + ' signalen in uw portefeuille', tekst: regels.slice(0, 6).join('\n') + (regels.length > 6 ? '\n…' : ''), url: '#/signalen' };
    if (bericht) {
      try { await versturen(t, bericht); verstuurd++; }
      catch (e) { mislukt++; console.log('::warning title=Meldingen::bericht niet afgeleverd (' + (e.statusCode || e.message) + '); zet meldingen in de app opnieuw aan als dit blijft'); }
    }
    staat.toestellen[k] = vandaag;
  }
  Object.assign(staat.fondsen, nieuweStand);
  fs.mkdirSync(path.dirname(staatPad), { recursive: true });
  fs.writeFileSync(staatPad, JSON.stringify(staat));
  console.log(`::notice title=Meldingen::${toestellen.length} toestel(len), ${alle.size} aandelen; ${verstuurd} bericht(en) verstuurd${mislukt ? ', ' + mislukt + ' mislukt' : ''}`);
}

if (require.main === module) main().catch((e) => { console.error('meldingen:', e.message); process.exit(0); });
module.exports = { leesInstelling, gebeurtenissen, standVan };
