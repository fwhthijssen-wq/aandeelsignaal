/* Opslag op het toestel: volglijst, instellingen en back-up. Niets verlaat het toestel.
   `opslag` is localStorage of een nagebootste (voor tests). Elke lees- en schrijfactie is veilig tegen uitval. */
(function (root) {
  'use strict';
  var SLEUTEL = 'aandeelsignaal.v1';
  var MAX_VOLGLIJST = 50;
  var TICKER = /^[A-Z0-9][A-Z0-9.\-]{0,14}$/;

  function leeg() { return { versie: 1, volglijst: [], instellingen: { thema: 'auto' }, laatsteBackup: null, gewijzigd: null }; }

  function normTicker(t) {
    if (typeof t !== 'string') return null;
    t = t.trim().toUpperCase();
    return TICKER.test(t) ? t : null;
  }

  function schoon(data) {
    var uit = leeg();
    if (!data || typeof data !== 'object') return uit;
    var gezien = {};
    (Array.isArray(data.volglijst) ? data.volglijst : []).forEach(function (it) {
      var t = normTicker(it && it.ticker);
      if (t && !gezien[t] && uit.volglijst.length < MAX_VOLGLIJST) {
        gezien[t] = true;
        uit.volglijst.push({ ticker: t, toegevoegd: typeof it.toegevoegd === 'string' ? it.toegevoegd.slice(0, 10) : null });
      }
    });
    var th = data.instellingen && data.instellingen.thema;
    uit.instellingen.thema = (th === 'licht' || th === 'donker' || th === 'auto') ? th : 'auto';
    uit.laatsteBackup = typeof data.laatsteBackup === 'string' ? data.laatsteBackup : null;
    uit.gewijzigd = typeof data.gewijzigd === 'string' ? data.gewijzigd : null;
    return uit;
  }

  function maak(opslag, nu) {
    nu = nu || function () { return new Date().toISOString(); };
    var staat = leeg();
    var fout = null;
    try {
      var tekst = opslag && opslag.getItem(SLEUTEL);
      if (tekst) staat = schoon(JSON.parse(tekst));
    } catch (e) { fout = 'Opgeslagen gegevens konden niet worden gelezen; de app begint leeg tot u een back-up terugzet.'; }

    function bewaar(wijziging) {
      if (wijziging) staat.gewijzigd = nu();
      try { opslag.setItem(SLEUTEL, JSON.stringify(staat)); return true; }
      catch (e) { fout = 'Opslaan op dit toestel is niet gelukt. Maak een back-up zodat niets verloren gaat.'; return false; }
    }

    return {
      staat: function () { return staat; },
      fout: function () { return fout; },
      volglijst: function () { return staat.volglijst.slice(); },
      zit: function (t) { t = normTicker(t); return staat.volglijst.some(function (x) { return x.ticker === t; }); },
      voegToe: function (t) {
        t = normTicker(t);
        if (!t) return { ok: false, reden: 'ongeldige beurscode' };
        if (this.zit(t)) return { ok: true, status: 'bestond' };
        if (staat.volglijst.length >= MAX_VOLGLIJST) return { ok: false, reden: 'volglijst vol (maximaal ' + MAX_VOLGLIJST + ')' };
        staat.volglijst.push({ ticker: t, toegevoegd: nu().slice(0, 10) });
        return { ok: bewaar(true), status: 'toegevoegd' };
      },
      verwijder: function (t) {
        t = normTicker(t);
        var voor = staat.volglijst.length;
        staat.volglijst = staat.volglijst.filter(function (x) { return x.ticker !== t; });
        if (staat.volglijst.length !== voor) bewaar(true);
        return voor !== staat.volglijst.length;
      },
      zetThema: function (th) { staat.instellingen.thema = (th === 'licht' || th === 'donker') ? th : 'auto'; bewaar(false); },
      /* Back-up als tekst (JSON). Markeert het moment van back-up. */
      maakBackup: function () {
        var b = { app: 'Aandeel Signaal', soort: 'back-up', versie: 1, gemaakt: nu(),
          volglijst: staat.volglijst, instellingen: staat.instellingen };
        staat.laatsteBackup = b.gemaakt; bewaar(false);
        return JSON.stringify(b, null, 1);
      },
      /* Terugzetten voegt toe en vervangt nooit stilzwijgend: standaard samenvoegen. */
      zetTerug: function (tekst, modus) {
        var data;
        try { data = JSON.parse(tekst); } catch (e) { return { ok: false, reden: 'Dit bestand is geen geldige back-up.' }; }
        if (!data || data.app !== 'Aandeel Signaal' || data.soort !== 'back-up') return { ok: false, reden: 'Dit is geen back-up van Aandeel Signaal.' };
        var s = schoon(data), nieuw = 0;
        if (modus === 'vervang') { staat.volglijst = s.volglijst; nieuw = s.volglijst.length; }
        else {
          s.volglijst.forEach(function (it) {
            if (!staat.volglijst.some(function (x) { return x.ticker === it.ticker; }) && staat.volglijst.length < MAX_VOLGLIJST) {
              staat.volglijst.push(it); nieuw++;
            }
          });
        }
        if (s.instellingen.thema !== 'auto' && modus === 'vervang') staat.instellingen.thema = s.instellingen.thema;
        return { ok: bewaar(true), toegevoegd: nieuw, totaal: staat.volglijst.length };
      },
      /* Herinnering: ruim 14 dagen geen back-up, of wijziging na de laatste back-up. */
      backupNodig: function (vandaag) {
        if (!staat.volglijst.length) return false;
        if (!staat.laatsteBackup) return true;
        if (staat.gewijzigd && staat.gewijzigd > staat.laatsteBackup) return true;
        var d = (Date.parse(vandaag) - Date.parse(staat.laatsteBackup)) / 86400000;
        return isNaN(d) || d >= 14;
      }
    };
  }

  var api = { SLEUTEL: SLEUTEL, MAX_VOLGLIJST: MAX_VOLGLIJST, normTicker: normTicker, schoon: schoon, maak: maak };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Store = api;
})(typeof self !== 'undefined' ? self : this);
