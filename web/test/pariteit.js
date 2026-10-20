/* Leest testgevallen (JSON) van stdin, geeft de uitkomst van gate.js terug. Gebruikt door test_web_pariteit.py */
const G = require('../js/gate.js');
let tekst = '';
process.stdin.on('data', d => tekst += d).on('end', () => {
  const gevallen = JSON.parse(tekst);
  const uit = gevallen.map(c => {
    if (c.soort === 'gate') return G.labelGate(c.invoer);
    if (c.soort === 'trend') return G.trend(c.prijs, c.sma);
    if (c.soort === 'scenario') { try { return { ok: G.scenario(...c.args) }; } catch (e) { return { fout: true }; } }
    throw new Error('onbekend');
  });
  process.stdout.write(JSON.stringify(uit));
});
