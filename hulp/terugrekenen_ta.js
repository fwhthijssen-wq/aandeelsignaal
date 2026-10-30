/* Terugrekenen van het kortetermijnsignaal, stap 2: het signaal met de code van de app (web/js/kortetermijn.js) op elke
   maandelijkse peildatum, en het rendement daarna ten opzichte van het gewone gemiddelde van alle fondsen in dezelfde maand.
   Gebruik: node hulp/terugrekenen_ta.js uitmap   (leest uitmap/ta_punten.json, schrijft terugrekenen_ta.json en .md)

   Twee manieren van tellen:
   - alle waarnemingen samen (gemiddelde, mediaan, % beter dan gemiddeld, n). De t-waarde hiervan is te optimistisch: de
     waarnemingen van één maand hangen samen en bij 3-12 maanden overlappen de perioden;
   - per maand het verschil Gunstig min Afwachten, en daarover het gemiddelde met een t-waarde die rekening houdt met de
     overlap (Newey-West, vertraging = horizon - 1 maanden). Dat is de eerlijke toets. */
'use strict';
const fs = require('fs'), path = require('path');
global.self = global;
const K = require(path.join(__dirname, '..', 'web', 'js', 'kortetermijn.js'));

const map = process.argv[2];
const { rijen } = JSON.parse(fs.readFileSync(path.join(map, 'ta_punten.json'), 'utf8'));
const H = ['m1', 'm3', 'm6', 'm12'], HN = { m1: 1, m3: 3, m6: 6, m12: 12 }, HTEKST = { m1: '1 maand', m3: '3 maanden', m6: '6 maanden', m12: '12 maanden' };
const STATUS = ['gunstig', 'neutraal', 'afwachten', 'onvoldoende'];

// signaal per rij, met de code van de app
for (const r of rijen) {
  const t = K.kortetermijn(r.koers, true);
  r.status = t ? t.status : 'geen';
  r.ja = t ? t.ja : null;
  r.checks = t ? Object.fromEntries(t.checks.map((c) => [c.id, c.ok])) : {};
  r.maand = r.peil.slice(0, 7);
}
// overrendement: min het gewone gemiddelde van alle fondsen in dezelfde maand
const perMaand = {};
for (const r of rijen) (perMaand[r.maand] = perMaand[r.maand] || []).push(r);
for (const lijst of Object.values(perMaand)) for (const h of H) {
  const v = lijst.filter((r) => typeof r[h] === 'number');
  const gem = v.reduce((s, r) => s + r[h], 0) / (v.length || 1);
  for (const r of v) r['o' + h] = r[h] - gem;
}

const r2 = (x) => Math.round(x * 100) / 100;
function stat(lijst, veld) {
  const v = lijst.map((r) => r[veld]).filter((x) => typeof x === 'number').sort((a, b) => a - b);
  const n = v.length; if (!n) return { n: 0 };
  const gem = v.reduce((s, x) => s + x, 0) / n, sd = Math.sqrt(v.reduce((s, x) => s + (x - gem) ** 2, 0) / Math.max(1, n - 1));
  return { n, gemiddeld: r2(gem), mediaan: r2(v[Math.floor(n / 2)]), beter: Math.round(v.filter((x) => x > 0).length / n * 100), t: r2(gem / (sd / Math.sqrt(n) || 1)) };
}
// Newey-West t-waarde van een gemiddelde over een tijdreeks
function nw(reeks, lag) {
  const n = reeks.length; if (n < 6) return { n, gemiddeld: null, t: null };
  const gem = reeks.reduce((s, x) => s + x, 0) / n, e = reeks.map((x) => x - gem);
  let s = e.reduce((a, x) => a + x * x, 0) / n;
  for (let l = 1; l <= Math.min(lag, n - 1); l++) {
    let c = 0; for (let i = l; i < n; i++) c += e[i] * e[i - l];
    s += 2 * (1 - l / (lag + 1)) * c / n;
  }
  return { n, gemiddeld: r2(gem), t: r2(gem / Math.sqrt(Math.max(s, 1e-12) / n)), positief: Math.round(reeks.filter((x) => x > 0).length / n * 100) };
}
// per maand: gemiddeld overrendement van groep A min groep B
function spreiding(isA, isB, h) {
  const reeks = [];
  for (const m of Object.keys(perMaand).sort()) {
    const a = perMaand[m].filter((r) => isA(r) && typeof r['o' + h] === 'number'), b = perMaand[m].filter((r) => isB(r) && typeof r['o' + h] === 'number');
    if (a.length >= 3 && b.length >= 3) reeks.push(a.reduce((s, r) => s + r['o' + h], 0) / a.length - b.reduce((s, r) => s + r['o' + h], 0) / b.length);
  }
  return nw(reeks, HN[h] - 1);
}

const res = { peildata: Object.keys(perMaand).length, waarnemingen: rijen.length, van: Object.keys(perMaand).sort()[0], tot: Object.keys(perMaand).sort().slice(-1)[0], status: {}, aantalJa: {}, spreiding: {}, checks: {}, regio: {}, jaar: {} };
for (const s of STATUS) res.status[s] = Object.fromEntries(H.map((h) => [h, stat(rijen.filter((r) => r.status === s), 'o' + h)]));
for (let j = 0; j <= 5; j++) res.aantalJa[j] = Object.fromEntries(H.map((h) => [h, stat(rijen.filter((r) => r.status !== 'onvoldoende' && r.ja === j), 'o' + h)]));
const G = (r) => r.status === 'gunstig', A = (r) => r.status === 'afwachten';
for (const h of H) res.spreiding[h] = spreiding(G, A, h);
for (const c of ['trend200', 'kruis', 'mom6', 'macd', 'rsi']) res.checks[c] = Object.fromEntries(H.map((h) => [h, spreiding((r) => r.checks[c] === true, (r) => r.checks[c] === false, h)]));
for (const g of ['EU', 'VS']) res.regio[g] = Object.fromEntries(H.map((h) => [h, spreiding((r) => G(r) && r.regio === g, (r) => A(r) && r.regio === g, h)]));
const jaren = [...new Set(Object.keys(perMaand).map((m) => m.slice(0, 4)))].sort();
for (const j of jaren) {
  const sub = rijen.filter((r) => r.maand.startsWith(j));
  const g = stat(sub.filter(G), 'om3'), a = stat(sub.filter(A), 'om3');
  res.jaar[j] = { gunstig: g, afwachten: a, verschil: g.n && a.n ? r2(g.gemiddeld - a.gemiddeld) : null };
}
fs.writeFileSync(path.join(map, 'terugrekenen_ta.json'), JSON.stringify(res, null, 1));

const fmt = (s) => !s || !s.n ? 'n=0' : `${s.gemiddeld > 0 ? '+' : ''}${s.gemiddeld}% gem · ${s.mediaan}% med · ${s.beter}% beter · n=${s.n}`;
const fsp = (s) => !s || s.gemiddeld == null ? '–' : `${s.gemiddeld > 0 ? '+' : ''}${s.gemiddeld} pp · t=${s.t} · ${s.positief}% van de maanden positief · ${s.n} maanden`;
let md = `# Terugrekenen kortetermijnsignaal\n\n${res.waarnemingen} waarnemingen, ${res.peildata} maandelijkse peildata (${res.van} t/m ${res.tot}). ` +
  'Overrendement = rendement inclusief dividend min het gewone gemiddelde van alle fondsen in dezelfde maand. Signaal met de code van de app, op 2 jaar dagkoersen tot de peildatum.\n\n';
md += '## Eerlijke toets: Gunstig min Afwachten, per maand (Newey-West)\n\n| Horizon | Verschil |\n|---|---|\n' + H.map((h) => `| ${HTEKST[h]} | ${fsp(res.spreiding[h])} |`).join('\n') + '\n\n';
md += '## Per uitkomst (alle waarnemingen samen; t niet gecorrigeerd)\n\n| Uitkomst | ' + H.map((h) => HTEKST[h]).join(' | ') + ' |\n|---|' + H.map(() => '---').join('|') + '|\n' +
  STATUS.map((s) => `| ${s} | ` + H.map((h) => fmt(res.status[s][h])).join(' | ') + ' |').join('\n') + '\n\n';
md += '## Per aantal checks ja (3 maanden)\n\n' + Object.entries(res.aantalJa).map(([j, v]) => `- ${j} van 5: ${fmt(v.m3)}`).join('\n') + '\n\n';
md += '## Per check: ja min nee, per maand (Newey-West)\n\n| Check | 1 maand | 3 maanden | 12 maanden |\n|---|---|---|---|\n' +
  Object.entries(res.checks).map(([c, v]) => `| ${c} | ${fsp(v.m1)} | ${fsp(v.m3)} | ${fsp(v.m12)} |`).join('\n') + '\n\n';
md += '## Per regio: Gunstig min Afwachten (3 en 12 maanden)\n\n' + Object.entries(res.regio).map(([g, v]) => `- ${g}: 3 mnd ${fsp(v.m3)} · 12 mnd ${fsp(v.m12)}`).join('\n') + '\n\n';
md += '## Per jaar (3 maanden, Gunstig min Afwachten)\n\n' + Object.entries(res.jaar).map(([j, v]) => `- ${j}: ${v.verschil == null ? '–' : (v.verschil > 0 ? '+' : '') + v.verschil + ' pp'} (gunstig n=${v.gunstig.n || 0}, afwachten n=${v.afwachten.n || 0})`).join('\n') + '\n';
fs.writeFileSync(path.join(map, 'terugrekenen_ta.md'), md);
console.log(md);
