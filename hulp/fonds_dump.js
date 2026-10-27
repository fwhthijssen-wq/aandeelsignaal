// Tijdelijk: één fondsrecord uit de laatste nachtrun als gecomprimeerde meldingen (voor een afdrukvoorbeeld).
const fs = require('fs'), zlib = require('zlib');
const D = JSON.parse(fs.readFileSync('web/data/aandelen.json', 'utf8'));
const t = process.argv[2] || 'ASML.AS';
const r = D.aandelen.find(a => a.ticker === t);
if (!r) { console.log('::error::niet gevonden ' + t); process.exit(1); }
const s = zlib.gzipSync(JSON.stringify({ gemaakt: D.gemaakt, rec: r })).toString('base64');
const n = Math.ceil(s.length / 30000);
for (let i = 0; i < n; i++) console.log(`::notice title=deel ${i + 1}/${n}::${s.slice(i * 30000, (i + 1) * 30000)}`);
