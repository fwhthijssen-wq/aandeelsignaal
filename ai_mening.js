/* Nachtelijke stap: een AI-tweede mening bij elk fonds met NAIC Kopen (na bouw_webdata.py en de kwaliteitsbewaker).
   Gebruik: node ai_mening.js web/data/aandelen.json ai/staat.json web/data [--alleen-schrijven]
   - rekent per fonds het NAIC-oordeel uit, precies zoals de app (web/js/signaal.js);
   - vraagt voor een fonds met Kopen een korte, kritische tweede mening aan een taalmodel. Standaard Groq (gratis, zonder
     creditcard, 1.000 vragen per dag per model, gegevens niet gebruikt voor training); de sleutel staat als geheim
     AI_SLEUTEL in GitHub. Elke dienst met dezelfde vraagvorm (OpenAI-compatibel) kan via de variabelen AI_URL, AI_MODEL
     en AI_DIENST, bijvoorbeeld Mistral. (GitHub Models is op 30 juli 2026 gestopt.)
   - het model krijgt alleen de gecontroleerde cijfers uit de app, geen nieuws; het moet ook zeggen wat tegen kopen pleit;
   - een mening blijft staan zolang het oordeel, de koerszone en het laatste boekjaar gelijk zijn en ze jonger is dan
     14 dagen; zo blijft het ruim binnen de daglimiet (hoogstens MAX_PER_RUN nieuwe vragen per run);
   - schrijft web/data/ai.js (window.AANDEEL_AI) met de meningen van de fondsen die nu Kopen zijn.
   Zonder AI_SLEUTEL, of met --alleen-schrijven, worden alleen de bewaarde meningen opnieuw geschreven. */
'use strict';
const fs = require('fs'), path = require('path');
const W = path.join(__dirname, 'web', 'js');
const S = require(path.join(W, 'signaal.js')), G = require(path.join(W, 'gate.js')), N = require(path.join(W, 'naic.js'));
const V = require(path.join(W, 'vergelijk.js')), F = require(path.join(W, 'fisher.js'));

const MODEL = process.env.AI_MODEL || 'openai/gpt-oss-120b';
const URL_ = process.env.AI_URL || 'https://api.groq.com/openai/v1/chat/completions';
const DIENST = process.env.AI_DIENST || 'Groq';
const MAX_PER_RUN = 40, GELDIG_DAGEN = 14, PAUZE_MS = 2500;     // ruim binnen de limieten van een gratis abonnement

function r(x, d) { return typeof x === 'number' && isFinite(x) ? Math.round(x * Math.pow(10, d)) / Math.pow(10, d) : null; }
function dagen(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }

/* Wat het model te zien krijgt: alleen cijfers die de app zelf toont. */
function feiten(rec, b, vandaag, alle) {
  const n = b.naic || {}, k = rec.koers || {}, g = rec.gegevens || {}, z = V.kant(rec, vandaag, G);
  const jr = (g.jaren || []).filter((j) => typeof j.year === 'number').slice(-10).map((j) => ({
    jaar: j.year, omzet: r(j.sales, 0), nettowinst: r(j.net_income, 0), winst_per_aandeel: r(j.comparable_eps, 4),
    marge_voor_belasting_pct: j.sales > 0 && typeof j.pretax_income === 'number' ? r(j.pretax_income / j.sales * 100, 1) : null,
    eigen_vermogen: r(j.equity, 0), langlopende_schuld: r(j.long_term_debt, 0), dividend_per_aandeel: r(j.dividend_ps, 4) }));
  const fisher = {};
  Object.entries(F.gegevens(rec, alle)).forEach(([p, regels]) => { fisher['punt_' + p] = regels.map((x) => x.label + ': ' + x.waarde); });
  return {
    bedrijf: rec.naam, ticker: rec.ticker, land: rec.land, sector: rec.sector_yahoo || ((rec.bedrijf || {}).sector || [])[0] || null,
    beschrijving: ((rec.bedrijf || {}).beschrijving || '').slice(0, 400) || null,
    valuta_koers: rec.valuta, koers: k.slot, koers_datum: k.datum,
    naic: { oordeel: n.oordeel, koopprijs: r(n.koopprijs, 2), zone: (n.zones || {}).zone || null, koers_winst: r(n.kw, 1),
      verwachte_groei_winst_pct: r(n.groei, 1), historische_groei_winst_pct: r(n.groeiHistorisch, 1), verwacht_rendement_pct_per_jaar: r(n.totaal, 1),
      horizon_jaren: n.horizon, kwaliteitstoetsen: (n.kwaliteit || []).map((q) => ({ toets: q.id, ok: q.ok, toelichting: q.tekst || null })) },
    zekerheid_cijfers: z.bevestigd ? 'bevestigd (10 jaar onafhankelijk nagerekend)' : z.niveau || 'onbekend',
    jaarcijfers: jr, valuta_cijfers: (g.currencies || [])[0] || rec.valuta,
    analisten: rec.analisten ? { advies: rec.analisten.advies, aantal: rec.analisten.aantal } : null,
    verwachting: (rec.verwachting || {}).groei || null,
    fisher_gegevens: fisher,
  };
}

const SYSTEEM = [
  'Je bent een kritische, nuchtere aandelenanalist die een tweede mening geeft voor een Nederlandse particuliere belegger',
  'die de NAIC-methode (Better Investing) gebruikt. De app zegt dat dit aandeel volgens NAIC koopwaardig is. Jouw taak is',
  'dat oordeel te toetsen, niet te herhalen.',
  'Regels:',
  '- Gebruik voor cijfers uitsluitend de gegeven gegevens. Verzin geen cijfers, koersdoelen of nieuws.',
  '- Algemene, bekende kenmerken van het bedrijf (bedrijfsmodel, concurrentie, cycliciteit, regelgeving) mag je noemen;',
  '  geen actuele gebeurtenissen.',
  '- Benoem altijd wat tegen kopen pleit, ook als de cijfers sterk zijn (cycliciteit, eenmalige winst, schuld, waardering,',
  '  afhankelijkheid van één markt, onzekere cijfers).',
  '- Geef geen koop- of verkoopadvies; eindig met een korte afweging in je eigen woorden.',
  '- Schrijf in eenvoudig Nederlands, korte zinnen, zonder jargon. Totaal hoogstens 180 woorden.',
  'Antwoord als JSON: {"voor": [2 of 3 korte punten], "tegen": [2 of 3 korte punten], "nagaan": [2 punten: wat de belegger',
  'zelf nog moet uitzoeken], "afweging": "één of twee zinnen"}.',
].join('\n');

async function vraag(f, token, zonderJsonModus) {
  const body = { model: MODEL, temperature: 0.3, max_tokens: 1500,
    messages: [{ role: 'system', content: SYSTEEM }, { role: 'user', content: 'Gegevens (JSON):\n' + JSON.stringify(f) }] };
  if (!zonderJsonModus) body.response_format = { type: 'json_object' };
  const res = await fetch(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(90000) });
  if (res.status === 400 && !zonderJsonModus) return vraag(f, token, true);       // model zonder JSON-modus: nog eens, gewoon
  if (res.status === 429) { const e = new Error('limiet bereikt of te snel (429)'); e.limiet = true; throw e; }
  const tekst = await res.text();
  if (!res.ok) { const e = new Error(DIENST + ' ' + res.status + ': ' + tekst.slice(0, 200)); e.limiet = res.status === 401 || res.status === 403; throw e; }
  let j;
  try { j = JSON.parse(tekst); } catch (e) { const f = new Error('geen JSON van ' + DIENST + ': ' + tekst.slice(0, 120)); f.limiet = true; throw f; }
  let inhoud = ((((j.choices || [])[0] || {}).message) || {}).content || '';
  inhoud = inhoud.replace(/^```(json)?\s*|\s*```$/g, '');
  return schoon(JSON.parse(inhoud));
}

/* Alleen de verwachte vorm, korte teksten. */
function schoon(o) {
  const lijst = (x, max) => (Array.isArray(x) ? x : []).filter((s) => typeof s === 'string' && s.trim()).slice(0, max).map((s) => s.trim().slice(0, 300));
  const uit = { voor: lijst(o.voor, 3), tegen: lijst(o.tegen, 3), nagaan: lijst(o.nagaan, 2), afweging: typeof o.afweging === 'string' ? o.afweging.trim().slice(0, 400) : '' };
  if (!uit.voor.length || !uit.tegen.length) throw new Error('antwoord zonder voor- of tegenpunten');
  return uit;
}

function sleutel(rec, b) {
  const n = b.naic || {}, jr = ((rec.gegevens || {}).jaren || []).filter((j) => typeof j.comparable_eps === 'number');
  return [n.oordeel, (n.zones || {}).zone || '', jr.length ? jr[jr.length - 1].year : ''].join('|');
}

function schrijf(uitmap, staat, kopen, vandaag) {
  const fondsen = {};
  kopen.forEach((t) => { if (staat.fondsen[t]) fondsen[t] = staat.fondsen[t]; });
  const data = { gemaakt: vandaag, model: MODEL, bron: DIENST, fondsen };
  fs.writeFileSync(path.join(uitmap, 'ai.js'), 'window.AANDEEL_AI = ' + JSON.stringify(data) + ';\n');
  return Object.keys(fondsen).length;
}

async function main() {
  const [bestand, staatPad, uitmap] = process.argv.slice(2);
  const alleenSchrijven = process.argv.includes('--alleen-schrijven');
  const d = JSON.parse(fs.readFileSync(bestand, 'utf-8')), vandaag = new Date().toISOString().slice(0, 10);
  let staat = { fondsen: {} };
  try { staat = JSON.parse(fs.readFileSync(staatPad, 'utf-8')); } catch (e) { /* eerste keer */ }
  const kopen = [], beoordeeld = {};
  for (const rec of d.aandelen || []) {
    if (!rec.koers || !(rec.koers.slot > 0)) continue;
    const b = S.beoordeel(rec, { vandaag, gate: G, naic: N });
    if ((b.naic || {}).oordeel === 'kopen') { kopen.push(rec.ticker); beoordeeld[rec.ticker] = { rec, b }; }
  }
  const token = process.env.AI_SLEUTEL;
  let nieuw = 0, fout = 0;
  if (token && !alleenSchrijven) {
    const teDoen = kopen.filter((t) => { const o = staat.fondsen[t], s = sleutel(beoordeeld[t].rec, beoordeeld[t].b); return !o || o.sleutel !== s || dagen(o.datum, vandaag) >= GELDIG_DAGEN; })
      .sort((a, b) => ((staat.fondsen[a] || {}).datum || '').localeCompare((staat.fondsen[b] || {}).datum || ''));   // oudste eerst
    for (const t of teDoen.slice(0, MAX_PER_RUN)) {
      const { rec, b } = beoordeeld[t];
      try {
        const m = await vraag(feiten(rec, b, vandaag, d.aandelen), token);
        staat.fondsen[t] = Object.assign(m, { datum: vandaag, sleutel: sleutel(rec, b), model: MODEL, dienst: DIENST, oordeel: b.naic.oordeel, koers: rec.koers.slot });
        nieuw++;
      } catch (e) {
        fout++;
        console.log(`::warning title=AI-mening::${t}: ${e.message}`);
        if (e.limiet) break;                         // limiet, verkeerde sleutel of dienst onbereikbaar: niet doorgaan
      }
      await new Promise((ok) => setTimeout(ok, PAUZE_MS));
    }
  }
  fs.mkdirSync(path.dirname(staatPad), { recursive: true });
  fs.writeFileSync(staatPad, JSON.stringify(staat));
  const n = schrijf(uitmap, staat, kopen, vandaag);
  console.log(`::notice title=AI-mening::${kopen.length} fondsen met NAIC Kopen; ${nieuw} nieuwe meningen, ${fout} mislukt; ${n} in de app (${DIENST}, ${MODEL})${token ? '' : '; geen AI_SLEUTEL ingesteld'}`);
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { feiten, schoon, sleutel, SYSTEEM };
