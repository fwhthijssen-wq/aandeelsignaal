/* Terugrekenen modelportefeuille, hulpstap: oordeel, zone, koopmoment en zekerheid voor een reeks fondsen op één peildatum.
   Gebruik: node hulp/model_signalen.js invoer.json uitvoer.json  (invoer: {peildatum, rijen: [{ticker, rec}]}) */
'use strict';
const fs = require('fs'), path = require('path');
const { fondsVoorModel } = require(path.join(__dirname, '..', 'modelportefeuille.js'));
const inv = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), uit = {};
for (const r of inv.rijen) {
  const f = fondsVoorModel(r.rec, inv.peildatum);
  if (f) uit[r.ticker] = { oordeel: f.oordeel, zone: f.zone, moment: f.moment, zekerheid: f.zekerheid, kwaliteit: f.kwaliteit };
}
fs.writeFileSync(process.argv[3], JSON.stringify(uit));
