/* Terugrekenen, stap 2: oordelen van de app en van NAIC op elke peildatum, en het rendement daarna ten opzichte van het
   gewone gemiddelde van alle fondsen op die peildatum (overrendement). Gebruik: node hulp/terugrekenen.js uitmap */
const fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..', 'web', 'js');
const S = require(path.join(W, 'signaal.js')), G = require(path.join(W, 'gate.js')), N = require(path.join(W, 'naic.js'));
const map = process.argv[2];
const inv = JSON.parse(fs.readFileSync(path.join(map, 'puntintijd.json'), 'utf8'));

const rijen = inv.rijen.map((r) => {
  const b = S.beoordeel(r.rec, { vandaag: r.peildatum, gate: G, naic: N });
  return { peildatum: r.peildatum, ticker: r.ticker, app: b.oordeel || 'geen', naic: (b.naic && b.naic.oordeel) || 'geen',
    metingen: Object.fromEntries(b.metingen.map((m) => [m.id, m.nvt ? 'nvt' : m.oordeel || 'onbekend'])), aantal: b.aantal, r1: r.r1, r3: r.r3 };
});
// overrendement per peildatum
for (const T of inv.peildata) {
  for (const k of ['r1', 'r3']) {
    const v = rijen.filter((x) => x.peildatum === T && typeof x[k] === 'number');
    const gem = v.reduce((a, x) => a + x[k], 0) / (v.length || 1);
    v.forEach((x) => { x['o' + k.slice(1)] = x[k] - gem; });
  }
}
function stat(lijst, k) {
  const v = lijst.map((x) => x[k]).filter((x) => typeof x === 'number').sort((a, b) => a - b);
  if (!v.length) return { n: 0 };
  const gem = v.reduce((a, x) => a + x, 0) / v.length;
  return { n: v.length, gemiddeld: +(gem * 100).toFixed(2), mediaan: +(v[Math.floor(v.length / 2)] * 100).toFixed(2), beter: +(v.filter((x) => x > 0).length / v.length * 100).toFixed(0) };
}
function groep(sleutel, waarden) {
  const uit = {};
  for (const w of waarden) {
    const l = rijen.filter((x) => sleutel(x) === w);
    uit[w] = { overrendement_1j: stat(l, 'o1'), overrendement_3j: stat(l, 'o3') };
  }
  return uit;
}
const O = ['kopen', 'neutraal', 'vermijden', 'geen'];
const per_jaar = {};
for (const T of inv.peildata) {
  const l = rijen.filter((x) => x.peildatum === T);
  per_jaar[T] = {};
  for (const m of ['app', 'naic']) per_jaar[T][m] = Object.fromEntries(O.map((o) => [o, stat(l.filter((x) => x[m] === o), 'o1')]));
}
const res = {
  gemaakt: new Date().toISOString(), rijen: rijen.length, peildata: inv.peildata, zonder_koersen: Object.keys(inv.fouten || {}).length,
  app: groep((x) => x.app, O), naic: groep((x) => x.naic, O),
  beide: groep((x) => (x.app === 'kopen' && x.naic === 'kopen' ? 'beide kopen' : x.app === 'kopen' ? 'alleen app' : x.naic === 'kopen' ? 'alleen NAIC' : 'geen van beide'), ['beide kopen', 'alleen app', 'alleen NAIC', 'geen van beide']),
  metingen: Object.fromEntries(S.KERN.map((k) => [k.id, groep((x) => x.metingen[k.id], ['gunstig', 'neutraal', 'ongunstig', 'onbekend'])])),
  per_jaar,
};
fs.writeFileSync(path.join(map, 'terugrekenen.json'), JSON.stringify(res, null, 1));
fs.writeFileSync(path.join(map, 'terugrekenen_rijen.json'), JSON.stringify(rijen));
const r = (s) => s.n ? `${s.gemiddeld > 0 ? '+' : ''}${s.gemiddeld}% gem · ${s.mediaan > 0 ? '+' : ''}${s.mediaan}% med · ${s.beter}% beter · n=${s.n}` : 'n=0';
let md = `# Terugrekenen\n\n${rijen.length} fonds-peildata (${inv.peildata[0]} t/m ${inv.peildata[inv.peildata.length - 1]}). Overrendement = rendement incl. dividend min het gewone gemiddelde van alle fondsen op die peildatum; 3 jaar = totaal over 3 jaar (niet per jaar).\n\n`;
for (const [naam, blok] of [['App', res.app], ['NAIC', res.naic], ['App en NAIC', res.beide]]) {
  md += `## ${naam}\n\n| Oordeel | 1 jaar | 3 jaar |\n|---|---|---|\n`;
  for (const [o, s] of Object.entries(blok)) md += `| ${o} | ${r(s.overrendement_1j)} | ${r(s.overrendement_3j)} |\n`;
  md += '\n';
}
md += '## Per meting (1 jaar)\n\n';
for (const [id, blok] of Object.entries(res.metingen)) md += `- **${id}**: ` + Object.entries(blok).map(([o, s]) => `${o} ${r(s.overrendement_1j)}`).join(' | ') + '\n';
md += '\n## Per peildatum (1 jaar, Kopen min Vermijden)\n\n';
for (const [T, b] of Object.entries(per_jaar)) md += `- ${T}: app ${b.app.kopen.n ? (b.app.kopen.gemiddeld - (b.app.vermijden.gemiddeld || 0)).toFixed(1) : '–'} · NAIC ${b.naic.kopen.n ? (b.naic.kopen.gemiddeld - (b.naic.vermijden.gemiddeld || 0)).toFixed(1) : '–'} procentpunt\n`;
fs.writeFileSync(path.join(map, 'terugrekenen.md'), md);
console.log(md);
