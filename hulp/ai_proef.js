/* Hulpmiddel (ontwikkeling): AI-tweede mening van twee modellen naast elkaar, voor enkele fondsen met NAIC Kopen.
   Gebruik: AI_SLEUTEL=... node hulp/ai_proef.js aandelen.json "model1,model2" [TICKER ...]
   Zonder tickers: de eerste drie fondsen met NAIC Kopen. Schrijft naar het logboek. */
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..'), W = path.join(R, 'web', 'js');
const A = require(path.join(R, 'ai_mening.js'));
const S = require(path.join(W, 'signaal.js')), G = require(path.join(W, 'gate.js')), N = require(path.join(W, 'naic.js'));
(async () => {
  const [pad, modellen, ...tick] = process.argv.slice(2);
  try {
    const u = (process.env.AI_URL || 'https://api.groq.com/openai/v1/chat/completions').replace(/chat\/completions$/, 'models');
    const lijst = await (await fetch(u, { headers: { Authorization: 'Bearer ' + process.env.AI_SLEUTEL } })).json();
    console.log('Beschikbare modellen:', (lijst.data || []).map((m) => m.id).sort().join(', '));
  } catch (e) { console.log('modellenlijst niet op te halen:', e.message); }
  const d = JSON.parse(fs.readFileSync(pad, 'utf8')), vandaag = new Date().toISOString().slice(0, 10);
  const kopen = d.aandelen.filter((r) => r.koers && r.koers.slot > 0).map((r) => ({ r, b: S.beoordeel(r, { vandaag, gate: G, naic: N }) }))
    .filter((x) => (x.b.naic || {}).oordeel === 'kopen');
  console.log('NAIC Kopen:', kopen.length, kopen.map((x) => x.r.ticker).join(' '));
  const keuze = tick.length ? kopen.filter((x) => tick.includes(x.r.ticker)) : kopen.slice(0, 3);
  for (const { r, b } of keuze) {
    const f = A.feiten(r, b, vandaag, d.aandelen);
    for (const m of modellen.split(',')) {
      try {
        const t0 = Date.now(), uit = await A.vraag(f, process.env.AI_SLEUTEL, false, m);
        console.log(`\n===== ${r.ticker} (${r.naam}) — ${m} — ${((Date.now() - t0) / 1000).toFixed(1)} s`);
        console.log('VOOR:\n- ' + uit.voor.join('\n- ') + '\nTEGEN:\n- ' + uit.tegen.join('\n- ') + '\nNAGAAN:\n- ' + uit.nagaan.join('\n- ') + '\nAFWEGING: ' + uit.afweging);
      } catch (e) { console.log(`\n===== ${r.ticker} — ${m} — FOUT: ${e.message}`); }
      await new Promise((ok) => setTimeout(ok, 2500));
    }
  }
})();
