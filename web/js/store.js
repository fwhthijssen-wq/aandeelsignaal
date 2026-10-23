/* Opslag op het toestel: volglijst, instellingen en back-up. Niets verlaat het toestel.
   `opslag` is localStorage of een nagebootste (voor tests). Elke lees- en schrijfactie is veilig tegen uitval. */
(function (root) {
  'use strict';
  var SLEUTEL = 'aandeelsignaal.v1';
  var MAX_VOLGLIJST = 50;
  var MAX_POSITIES = 200;
  var TICKER = /^[A-Z0-9][A-Z0-9.\-]{0,14}$/;

  function leeg() { return { versie: 1, volglijst: [], portefeuille: [], checklist: {}, zones: {}, verdieping: {}, instellingen: { thema: 'auto' }, introGezien: false, laatsteBackup: null, gewijzigd: null }; }

  function normTicker(t) {
    if (typeof t !== 'string') return null;
    t = t.trim().toUpperCase();
    return TICKER.test(t) ? t : null;
  }

  function getalOk(x, min, max, strikt) {
    if (typeof x === 'string') x = x.trim().replace(',', '.');
    if (x === '' || x === null || x === undefined || typeof x === 'boolean') return null;
    var n = Number(x);
    if (!isFinite(n) || n > max || (strikt ? n <= min : n < min)) return null;
    return n;
  }
  /* Momentopname van het oordeel van de app (bij toevoegen aan de volglijst of bij een aankoop), om later te kunnen zien of het klopte. */
  var OORDELEN = ['positief', 'neutraal', 'vermijden'], ZEKERHEDEN = ['zwak', 'beperkt', 'redelijk', 'goed', 'zeer voorlopig', 'voorlopig', 'stevig'];   // laatste drie: oude namen in bewaarde volglijsten
  function schoonSignaal(x) {
    if (!x || typeof x !== 'object') return null;
    var oordeel = OORDELEN.indexOf(x.oordeel) > -1 ? x.oordeel : null;
    var dekking = getalOk(x.dekking, 0, 100, false), score = typeof x.score === 'number' && isFinite(x.score) && Math.abs(x.score) <= 1 ? x.score : null;
    var datum = typeof x.datum === 'string' && /^\d{4}-\d{2}-\d{2}/.test(x.datum) ? x.datum.slice(0, 10) : null;
    if (dekking === null || !datum) return null;
    var koers = getalOk(x.koers, 0, 1e9, true), valuta = typeof x.valuta === 'string' && /^[A-Za-z]{3}$/.test(x.valuta.trim()) ? x.valuta.trim().toUpperCase() : null;
    var uit = { oordeel: oordeel, dekking: Math.round(dekking), zekerheid: ZEKERHEDEN.indexOf(x.zekerheid) > -1 ? x.zekerheid : null, score: score === null ? null : Math.round(score * 100) / 100,
             datum: datum, koers: koers !== null && valuta ? koers : null, valuta: koers !== null && valuta ? valuta : null };
    // Vijf vragen (vanaf beta.64): de antwoorden als vijf letters en de gekozen regel. Oudere momentopnames hebben ze niet.
    if (typeof x.profiel === 'string' && /^[gnol]{5}$/.test(x.profiel)) uit.profiel = x.profiel;
    if (typeof x.regel === 'string' && /^[a-z]{2,20}$/.test(x.regel)) uit.regel = x.regel;
    if (typeof x.voldoet === 'boolean') uit.voldoet = x.voldoet;
    return uit;
  }
  /* Eigen aanvullende informatie per aandeel: beoordelingen 1-5 en eigen cijfers voor wat de jaarverslagen niet geven. */
  var VERDIEP_SCORES = ['management', 'moat', 'sector', 'risico'];
  var VERDIEP_CIJFERS = { omzetgroei: [-100, 1000], epsgroei: [-100, 1000], nettomarge: [-1000, 1000], roe: [-1000, 1000], kw: [-1000, 1000], dividend: [0, 100] };
  function schoonVerdiepingBlok(b) {
    if (!b || typeof b !== 'object') return null;
    var uit = { scores: {}, cijfers: {}, notities: {}, bijgewerkt: null }, any = false;
    VERDIEP_SCORES.forEach(function (k) { var v = b.scores && b.scores[k]; if (Number.isInteger(v) && v >= 1 && v <= 5) { uit.scores[k] = v; any = true; } });
    Object.keys(VERDIEP_CIJFERS).forEach(function (k) {
      var v = b.cijfers && b.cijfers[k], r = VERDIEP_CIJFERS[k];
      if (typeof v === 'number' && isFinite(v) && v >= r[0] && v <= r[1]) { uit.cijfers[k] = v; any = true; }
    });
    var ids = VERDIEP_SCORES.concat(Object.keys(VERDIEP_CIJFERS));
    ids.forEach(function (k) { var t = b.notities && typeof b.notities[k] === 'string' ? b.notities[k].slice(0, 500) : ''; if (t.trim()) { uit.notities[k] = t; any = true; } });
    uit.bijgewerkt = typeof b.bijgewerkt === 'string' ? b.bijgewerkt.slice(0, 10) : null;
    return any ? uit : null;
  }
  function schoonVerdieping(data) {
    var uit = {}, n = 0;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return uit;
    Object.keys(data).forEach(function (k) { var t = normTicker(k), b = schoonVerdiepingBlok(data[k]); if (t && b && !uit[t] && n < MAX_CHECKLIST) { uit[t] = b; n++; } });
    return uit;
  }
  /* Eén aankoop. Ongeldige invoer geeft null; er wordt nooit iets geraden of afgerond naar een andere waarde. */
  function schoonPositie(p) {
    if (!p || typeof p !== 'object') return null;
    var t = normTicker(p.ticker), aantal = getalOk(p.aantal, 0, 1e9, true), koers = getalOk(p.koers, 0, 1e9, true);
    var valuta = typeof p.valuta === 'string' && /^[A-Za-z]{3}$/.test(p.valuta.trim()) ? p.valuta.trim().toUpperCase() : null;
    if (!t || aantal === null || koers === null || !valuta) return null;
    var datum = typeof p.datum === 'string' && /^\d{4}-\d{2}-\d{2}/.test(p.datum) ? p.datum.slice(0, 10) : null;
    var id = typeof p.id === 'string' && /^[A-Za-z0-9_\-]{1,40}$/.test(p.id) ? p.id : null;
    var signaal = schoonSignaal(p.signaal);
    var uit = { id: id, ticker: t, aantal: aantal, koers: koers, valuta: valuta, datum: datum };
    if (signaal) { uit.signaal = signaal; uit.opSignaal = p.opSignaal === true; }
    return uit;
  }
  var PUNTEN_AANTAL = 15, MAX_CHECKLIST = 200, MAX_NOTITIE = 500, ANTWOORDEN = ['ja', 'nee', 'onzeker'];
  /* Checklist per aandeel: alleen bekende punten (1 t/m 15), alleen ja/nee/onzeker, notitie als platte tekst met een maximum. */
  function schoonChecklist(data) {
    var uit = {}, n = 0;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return uit;
    Object.keys(data).forEach(function (k) {
      var t = normTicker(k), blok = data[k];
      if (!t || uit[t] || n >= MAX_CHECKLIST || !blok || typeof blok !== 'object') return;
      var punten = {}, any = false;
      Object.keys(blok.punten && typeof blok.punten === 'object' ? blok.punten : {}).forEach(function (id) {
        var nr = /^\d{1,2}$/.test(id) ? Number(id) : 0, p = blok.punten[id];
        if (nr < 1 || nr > PUNTEN_AANTAL || !p || typeof p !== 'object') return;
        var a = ANTWOORDEN.indexOf(p.a) > -1 ? p.a : null, nt = typeof p.n === 'string' ? p.n.slice(0, MAX_NOTITIE) : '';
        if (a || nt.trim()) { punten[nr] = { a: a, n: nt }; any = true; }
      });
      if (any) { uit[t] = { punten: punten, bijgewerkt: typeof blok.bijgewerkt === 'string' ? blok.bijgewerkt.slice(0, 10) : null }; n++; }
    });
    return uit;
  }
  /* Eigen koerszone-aannames per aandeel. Alleen eindige getallen binnen redelijke grenzen; de app rekent er pas mee na Naic.koerszones. */
  var ZONE_VELDEN = { eps: [0, 1e6, true], epsLaag: [0, 1e6, true], groeiPct: [-99, 100, false], jaren: [1, 10, false], kwHoog: [0, 1000, true], kwLaag: [0, 1000, true] };
  function schoonZone(z) {
    if (!z || typeof z !== 'object') return null;
    var uit = {};
    for (var k in ZONE_VELDEN) {
      if (!Object.prototype.hasOwnProperty.call(ZONE_VELDEN, k)) continue;
      var d = ZONE_VELDEN[k], v = getalOk(z[k], d[0], d[1], d[2]);
      if (v === null) return null;
      uit[k] = v;
    }
    if (!Number.isInteger(uit.jaren) || uit.kwLaag >= uit.kwHoog) return null;
    uit.bijgewerkt = typeof z.bijgewerkt === 'string' ? z.bijgewerkt.slice(0, 10) : null;
    return uit;
  }
  function schoonZones(data) {
    var uit = {}, n = 0;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return uit;
    Object.keys(data).forEach(function (k) { var t = normTicker(k), z = schoonZone(data[k]); if (t && z && !uit[t] && n < MAX_CHECKLIST) { uit[t] = z; n++; } });
    return uit;
  }
  function zelfde(a, b) { return a.ticker === b.ticker && a.aantal === b.aantal && a.koers === b.koers && a.valuta === b.valuta && a.datum === b.datum; }

  function schoon(data) {
    var uit = leeg();
    if (!data || typeof data !== 'object') return uit;
    var gezien = {};
    (Array.isArray(data.volglijst) ? data.volglijst : []).forEach(function (it) {
      var t = normTicker(it && it.ticker);
      if (t && !gezien[t] && uit.volglijst.length < MAX_VOLGLIJST) {
        gezien[t] = true;
        var item = { ticker: t, toegevoegd: typeof it.toegevoegd === 'string' ? it.toegevoegd.slice(0, 10) : null }, sinds = schoonSignaal(it.sinds);
        if (sinds) item.sinds = sinds;
        uit.volglijst.push(item);
      }
    });
    (Array.isArray(data.portefeuille) ? data.portefeuille : []).forEach(function (p) {
      var x = schoonPositie(p);
      if (x && uit.portefeuille.length < MAX_POSITIES && !uit.portefeuille.some(function (y) { return y.id && y.id === x.id; })) uit.portefeuille.push(x);
    });
    uit.portefeuille.forEach(function (p, i) { if (!p.id) p.id = 'p' + (i + 1) + '-' + Date.now().toString(36); });
    uit.checklist = schoonChecklist(data.checklist);
    uit.zones = schoonZones(data.zones);
    uit.verdieping = schoonVerdieping(data.verdieping);
    var th = data.instellingen && data.instellingen.thema;
    uit.instellingen.thema = (th === 'licht' || th === 'donker' || th === 'auto') ? th : 'auto';
    uit.introGezien = data.introGezien === true;
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
      voegToe: function (t, momentopname) {
        t = normTicker(t);
        if (!t) return { ok: false, reden: 'ongeldige beurscode' };
        if (this.zit(t)) return { ok: true, status: 'bestond' };
        if (staat.volglijst.length >= MAX_VOLGLIJST) return { ok: false, reden: 'volglijst vol (maximaal ' + MAX_VOLGLIJST + ')' };
        var nieuwItem = { ticker: t, toegevoegd: nu().slice(0, 10) }, sinds = schoonSignaal(momentopname);
        if (sinds) nieuwItem.sinds = sinds;
        staat.volglijst.push(nieuwItem);
        return { ok: bewaar(true), status: 'toegevoegd' };
      },
      verwijder: function (t) {
        t = normTicker(t);
        var voor = staat.volglijst.length;
        staat.volglijst = staat.volglijst.filter(function (x) { return x.ticker !== t; });
        if (staat.volglijst.length !== voor) bewaar(true);
        return voor !== staat.volglijst.length;
      },
      portefeuille: function () { return staat.portefeuille.slice(); },
      voegPositieToe: function (p) {
        var x = schoonPositie(p);
        if (!x) return { ok: false, reden: 'Controleer aantal, aankoopkoers en valuta: alleen getallen groter dan nul.' };
        if (staat.portefeuille.length >= MAX_POSITIES) return { ok: false, reden: 'portefeuille vol (maximaal ' + MAX_POSITIES + ' aankopen)' };
        x.id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        staat.portefeuille.push(x);
        return { ok: bewaar(true), id: x.id };
      },
      verwijderPositie: function (id) {
        var voor = staat.portefeuille.length;
        staat.portefeuille = staat.portefeuille.filter(function (x) { return x.id !== id; });
        if (staat.portefeuille.length !== voor) bewaar(true);
        return voor !== staat.portefeuille.length;
      },
      herstelPositie: function (p) { var x = schoonPositie(p); if (!x || staat.portefeuille.some(function (y) { return y.id === x.id; })) return false; staat.portefeuille.push(x); return bewaar(true); },
      checklist: function (t) { t = normTicker(t); var b = t && staat.checklist[t]; return b ? JSON.parse(JSON.stringify(b.punten)) : {}; },
      zetPunt: function (t, id, antwoord, notitie) {
        t = normTicker(t); id = Number(id);
        if (!t || !(id >= 1 && id <= PUNTEN_AANTAL) || Math.floor(id) !== id) return { ok: false, reden: 'ongeldig punt' };
        var blok = staat.checklist[t];
        if (!blok) { if (Object.keys(staat.checklist).length >= MAX_CHECKLIST) return { ok: false, reden: 'te veel aandelen met een checklist' }; blok = staat.checklist[t] = { punten: {}, bijgewerkt: null }; }
        var oud = blok.punten[id] || { a: null, n: '' };
        var a = antwoord === undefined ? oud.a : (ANTWOORDEN.indexOf(antwoord) > -1 ? antwoord : null);
        var nt = notitie === undefined ? oud.n : String(notitie == null ? '' : notitie).slice(0, MAX_NOTITIE);
        if (a || nt.trim()) blok.punten[id] = { a: a, n: nt }; else delete blok.punten[id];
        if (!Object.keys(blok.punten).length) delete staat.checklist[t]; else blok.bijgewerkt = nu().slice(0, 10);
        return { ok: bewaar(true) };
      },
      zones: function (t) { t = normTicker(t); return t && staat.zones[t] ? JSON.parse(JSON.stringify(staat.zones[t])) : null; },
      alleZones: function () { return JSON.parse(JSON.stringify(staat.zones)); },
      zetZones: function (t, z) {
        t = normTicker(t); var x = schoonZone(z);
        if (!t || !x) return { ok: false, reden: 'Controleer de getallen: alles groter dan nul, hoge K/W boven lage K/W, horizon in hele jaren (1 tot 10).' };
        if (!staat.zones[t] && Object.keys(staat.zones).length >= MAX_CHECKLIST) return { ok: false, reden: 'te veel aandelen met koerszones' };
        x.bijgewerkt = nu().slice(0, 10); staat.zones[t] = x; return { ok: bewaar(true) };
      },
      wisZones: function (t) { t = normTicker(t); if (!t || !staat.zones[t]) return false; delete staat.zones[t]; bewaar(true); return true; },
      verdieping: function (t) { t = normTicker(t); return t && staat.verdieping[t] ? JSON.parse(JSON.stringify(staat.verdieping[t])) : { scores: {}, cijfers: {}, notities: {}, bijgewerkt: null }; },
      /* soort: 'scores' (geheel getal 1-5), 'cijfers' (getal binnen de grenzen) of 'notities' (tekst). Leeg of null wist de waarde. */
      zetVerdieping: function (t, soort, id, waarde) {
        t = normTicker(t);
        if (!t || ['scores', 'cijfers', 'notities'].indexOf(soort) < 0) return { ok: false, reden: 'ongeldige invoer' };
        var geldig = soort === 'scores' ? VERDIEP_SCORES.indexOf(id) > -1 : soort === 'cijfers' ? Object.prototype.hasOwnProperty.call(VERDIEP_CIJFERS, id) : (VERDIEP_SCORES.indexOf(id) > -1 || Object.prototype.hasOwnProperty.call(VERDIEP_CIJFERS, id));
        if (!geldig) return { ok: false, reden: 'onbekend onderdeel' };
        var blok = staat.verdieping[t] || { scores: {}, cijfers: {}, notities: {}, bijgewerkt: null };
        var leegWaarde = waarde === null || waarde === undefined || (typeof waarde === 'string' && !waarde.trim());
        if (leegWaarde) delete blok[soort][id];
        else if (soort === 'scores') { var n = Number(waarde); if (!Number.isInteger(n) || n < 1 || n > 5) return { ok: false, reden: 'Kies een getal van 1 tot 5.' }; blok.scores[id] = n; }
        else if (soort === 'cijfers') {
          var c = typeof waarde === 'number' ? waarde : Number(String(waarde).replace(',', '.')), r = VERDIEP_CIJFERS[id];
          if (!isFinite(c) || c < r[0] || c > r[1]) return { ok: false, reden: 'Dit getal valt buiten het toegestane bereik (' + r[0] + ' tot ' + r[1] + ').' };
          blok.cijfers[id] = c;
        } else blok.notities[id] = String(waarde).slice(0, 500);
        if (!staat.verdieping[t] && Object.keys(staat.verdieping).length >= MAX_CHECKLIST) return { ok: false, reden: 'te veel aandelen met eigen informatie' };
        var schoonBlok = schoonVerdiepingBlok(blok);
        if (!schoonBlok) { delete staat.verdieping[t]; return { ok: bewaar(true) }; }
        schoonBlok.bijgewerkt = nu().slice(0, 10); staat.verdieping[t] = schoonBlok;
        return { ok: bewaar(true) };
      },
      introGezien: function () { return staat.introGezien === true; },
      zetIntroGezien: function (gezien) { staat.introGezien = gezien !== false; return bewaar(false); },
      zetThema: function (th) { staat.instellingen.thema = (th === 'licht' || th === 'donker') ? th : 'auto'; bewaar(false); },
      /* Back-up als tekst (JSON). Markeert het moment van back-up. */
      maakBackup: function (zonderMarkering) {
        var b = { app: 'Aandeel Signaal', soort: 'back-up', versie: 1, gemaakt: nu(),
          volglijst: staat.volglijst, portefeuille: staat.portefeuille, checklist: staat.checklist, zones: staat.zones, verdieping: staat.verdieping, instellingen: staat.instellingen };
        if (!zonderMarkering) { staat.laatsteBackup = b.gemaakt; bewaar(false); }
        return JSON.stringify(b, null, 1);
      },
      /* Zonder te bewaren: wat zit er nu op dit toestel? */
      inhoud: function () { return { volglijst: staat.volglijst.length, portefeuille: staat.portefeuille.length, beoordelingen: Object.keys(staat.verdieping).length, checklists: Object.keys(staat.checklist).length, laatsteBackup: staat.laatsteBackup, gewijzigd: staat.gewijzigd || null }; },
      /* Zet het moment van back-up pas nadat het bestand echt bewaard of gedeeld is. */
      markeerBackup: function (moment) { staat.laatsteBackup = moment || nu(); bewaar(false); },
      /* Kijkt in een back-upbestand zonder iets te wijzigen: wat staat erin en wat is daarvan nieuw? */
      bekijkBackup: function (tekst) {
        var data;
        try { data = JSON.parse(tekst); } catch (e) { return { ok: false, reden: 'Dit bestand is geen geldige back-up.' }; }
        if (!data || data.app !== 'Aandeel Signaal' || data.soort !== 'back-up') return { ok: false, reden: 'Dit is geen back-up van Aandeel Signaal.' };
        var sc = schoon(data);
        var nieuwV = sc.volglijst.filter(function (it) { return !staat.volglijst.some(function (x) { return x.ticker === it.ticker; }); }).length;
        var nieuwP = sc.portefeuille.filter(function (p) { return !staat.portefeuille.some(function (y) { return zelfde(y, p); }); }).length;
        var nieuwB = Object.keys(sc.verdieping).filter(function (t) { return !staat.verdieping[t]; }).length;
        return { ok: true, gemaakt: typeof data.gemaakt === 'string' ? data.gemaakt : null,
          volglijst: sc.volglijst.length, portefeuille: sc.portefeuille.length, beoordelingen: Object.keys(sc.verdieping).length, checklists: Object.keys(sc.checklist).length,
          nieuw: { volglijst: nieuwV, portefeuille: nieuwP, beoordelingen: nieuwB } };
      },
      /* Terugzetten voegt toe en vervangt nooit stilzwijgend: standaard samenvoegen. */
      zetTerug: function (tekst, modus) {
        var data;
        try { data = JSON.parse(tekst); } catch (e) { return { ok: false, reden: 'Dit bestand is geen geldige back-up.' }; }
        if (!data || data.app !== 'Aandeel Signaal' || data.soort !== 'back-up') return { ok: false, reden: 'Dit is geen back-up van Aandeel Signaal.' };
        var s = schoon(data), nieuw = 0;
        if (modus === 'vervang') { staat.volglijst = s.volglijst; staat.portefeuille = s.portefeuille; staat.checklist = s.checklist; staat.zones = s.zones; staat.verdieping = s.verdieping; nieuw = s.volglijst.length + s.portefeuille.length; }
        else {
          s.volglijst.forEach(function (it) {
            if (!staat.volglijst.some(function (x) { return x.ticker === it.ticker; }) && staat.volglijst.length < MAX_VOLGLIJST) {
              staat.volglijst.push(it); nieuw++;
            }
          });
        }
        if (modus !== 'vervang') s.portefeuille.forEach(function (p) {
          if (!staat.portefeuille.some(function (y) { return zelfde(y, p); }) && staat.portefeuille.length < MAX_POSITIES) {
            if (staat.portefeuille.some(function (y) { return y.id === p.id; })) p.id = p.id + 'b' + Math.random().toString(36).slice(2, 5);
            staat.portefeuille.push(p); nieuw++;
          }
        });
        if (modus !== 'vervang') Object.keys(s.checklist).forEach(function (t) {
          var doel = staat.checklist[t] || (Object.keys(staat.checklist).length < MAX_CHECKLIST ? (staat.checklist[t] = { punten: {}, bijgewerkt: s.checklist[t].bijgewerkt }) : null);
          if (!doel) return;
          Object.keys(s.checklist[t].punten).forEach(function (id) { if (!doel.punten[id]) { doel.punten[id] = s.checklist[t].punten[id]; nieuw++; } });   // bestaand antwoord wordt nooit overschreven
        });
        if (modus !== 'vervang') Object.keys(s.zones).forEach(function (t) { if (!staat.zones[t] && Object.keys(staat.zones).length < MAX_CHECKLIST) { staat.zones[t] = s.zones[t]; nieuw++; } });   // bestaande zones blijven
        if (modus !== 'vervang') Object.keys(s.verdieping).forEach(function (t) {
          var doel = staat.verdieping[t];
          if (!doel) { if (Object.keys(staat.verdieping).length < MAX_CHECKLIST) { staat.verdieping[t] = s.verdieping[t]; nieuw++; } return; }
          ['scores', 'cijfers', 'notities'].forEach(function (soort) { Object.keys(s.verdieping[t][soort]).forEach(function (k) { if (!(k in doel[soort])) { doel[soort][k] = s.verdieping[t][soort][k]; nieuw++; } }); });   // eigen invoer wordt nooit overschreven
        });
        if (s.instellingen.thema !== 'auto' && modus === 'vervang') staat.instellingen.thema = s.instellingen.thema;
        return { ok: bewaar(true), toegevoegd: nieuw, totaal: staat.volglijst.length, totaalPortefeuille: staat.portefeuille.length };
      },
      /* Herinnering: ruim 14 dagen geen back-up, of wijziging na de laatste back-up. */
      backupNodig: function (vandaag) {
        if (!staat.volglijst.length && !staat.portefeuille.length && !Object.keys(staat.checklist).length && !Object.keys(staat.zones).length && !Object.keys(staat.verdieping).length) return false;
        if (!staat.laatsteBackup) return true;
        if (staat.gewijzigd && staat.gewijzigd > staat.laatsteBackup) return true;
        var d = (Date.parse(vandaag) - Date.parse(staat.laatsteBackup)) / 86400000;
        return isNaN(d) || d >= 14;
      }
    };
  }

  var api = { SLEUTEL: SLEUTEL, MAX_VOLGLIJST: MAX_VOLGLIJST, MAX_POSITIES: MAX_POSITIES, PUNTEN_AANTAL: PUNTEN_AANTAL, MAX_NOTITIE: MAX_NOTITIE, schoonChecklist: schoonChecklist, schoonZones: schoonZones, schoonVerdieping: schoonVerdieping, schoonSignaal: schoonSignaal, schoonPositie: schoonPositie, normTicker: normTicker, schoon: schoon, maak: maak };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Store = api;
})(typeof self !== 'undefined' ? self : this);
