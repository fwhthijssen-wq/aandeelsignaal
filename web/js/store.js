/* Opslag op het toestel: volglijst, instellingen en back-up. Niets verlaat het toestel.
   `opslag` is localStorage of een nagebootste (voor tests). Elke lees- en schrijfactie is veilig tegen uitval. */
(function (root) {
  'use strict';
  var SLEUTEL = 'aandeelsignaal.v1';
  var MAX_VOLGLIJST = 50;
  var MAX_POSITIES = 200;
  var TICKER = /^[A-Z0-9][A-Z0-9.\-]{0,14}$/;
  var MAX_PORTEFEUILLES = 10, PF_ID = /^[a-z0-9][a-z0-9\-]{0,39}$/, EERSTE_PF = { id: 'eigen', naam: 'Mijn portefeuille' };

  function leeg() { return { versie: 1, volglijst: [], portefeuille: [], portefeuilles: [{ id: EERSTE_PF.id, naam: EERSTE_PF.naam }], actief: EERSTE_PF.id, checklist: {}, zones: {}, verdieping: {}, instellingen: { thema: 'auto' }, introGezien: false, laatsteBackup: null, gewijzigd: null }; }

  /* Meerdere portefeuilles (vanaf 1.8): elke aankoop hoort bij één portefeuille (pf). Oude aankopen zonder pf horen bij de eerste. */
  function schoonNaam(n) { return typeof n === 'string' ? n.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40) : ''; }
  function schoonPortefeuilles(lijst) {
    var uit = [];
    (Array.isArray(lijst) ? lijst : []).forEach(function (x) {
      var id = x && typeof x.id === 'string' && PF_ID.test(x.id) ? x.id : null, naam = schoonNaam(x && x.naam);
      if (id && naam && uit.length < MAX_PORTEFEUILLES && !uit.some(function (y) { return y.id === id; })) uit.push(x.dividend === 'aandelen' ? { id: id, naam: naam, dividend: 'aandelen' } : { id: id, naam: naam });
    });
    return uit;
  }
  function pfId(naam, bestaand) {
    var basis = schoonNaam(naam).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'portefeuille', id = basis, i = 2;
    while (bestaand.some(function (x) { return x.id === id; })) id = basis + '-' + (i++);
    return id;
  }

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
  var OORDELEN = ['kopen', 'neutraal', 'vermijden', 'positief'], ZEKERHEDEN = ['zwak', 'beperkt', 'redelijk', 'goed', 'zeer voorlopig', 'voorlopig', 'stevig'];   // laatste drie: oude namen in bewaarde volglijsten
  function schoonSignaal(x) {
    if (!x || typeof x !== 'object') return null;
    var oordeel = OORDELEN.indexOf(x.oordeel) > -1 ? x.oordeel : null;
    var dekking = getalOk(x.dekking, 0, 100, false), score = typeof x.score === 'number' && isFinite(x.score) && Math.abs(x.score) <= 1 ? x.score : null;
    var datum = typeof x.datum === 'string' && /^\d{4}-\d{2}-\d{2}/.test(x.datum) ? x.datum.slice(0, 10) : null;
    if (dekking === null || !datum) return null;
    var koers = getalOk(x.koers, 0, 1e9, true), valuta = typeof x.valuta === 'string' && /^[A-Za-z]{3}$/.test(x.valuta.trim()) ? x.valuta.trim().toUpperCase() : null;
    var uit = { oordeel: oordeel, dekking: Math.round(dekking), zekerheid: ZEKERHEDEN.indexOf(x.zekerheid) > -1 ? x.zekerheid : null, score: score === null ? null : Math.round(score * 100) / 100,
             datum: datum, koers: koers !== null && valuta ? koers : null, valuta: koers !== null && valuta ? valuta : null };
        // Zes kernmetingen (vanaf beta.65): profiel als letters en hoeveel metingen er waren. Oudere momentopnames hebben dat niet.
    if (typeof x.profiel === 'string' && /^[gnolx]{5,6}$/.test(x.profiel)) uit.profiel = x.profiel;
    if (x.naic === 'kopen' || x.naic === 'neutraal' || x.naic === 'vermijden') uit.naic = x.naic;      // NAIC-oordeel (vanaf beta.68)
    var aantal = getalOk(x.aantal, 0, 6, false), mogelijk = getalOk(x.mogelijk, 1, 6, false);
    if (aantal !== null && mogelijk !== null && aantal <= mogelijk) { uit.aantal = Math.round(aantal); uit.mogelijk = Math.round(mogelijk); }
    return uit;
  }
  /* Eigen aanvullende informatie per aandeel: beoordelingen 1-5 en eigen cijfers voor wat de jaarverslagen niet geven. */
  var VERDIEP_SCORES = ['management', 'moat', 'sector', 'risico'];
  var VERDIEP_CIJFERS = { omzetgroei: [-100, 1000], epsgroei: [-100, 1000], nettomarge: [-1000, 1000], roe: [-1000, 1000], kw: [-1000, 1000], dividend: [0, 100], naicgroei: [-50, 50] };
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
  /* Eén verkoop van (een deel van) een aankoop: datum, aantal, koers, kosten en de ontvangen euro's (zonder kosten). */
  function schoonVerkoop(v) {
    if (!v || typeof v !== 'object') return null;
    var datum = typeof v.datum === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v.datum) ? v.datum.slice(0, 10) : null;
    var aantal = getalOk(v.aantal, 0, 1e9, true), koers = getalOk(v.koers, 0, 1e9, true), kosten = getalOk(v.kosten, 0, 1e7, false), eur = getalOk(v.eur, 0, 1e10, true);
    if (!datum || aantal === null || koers === null) return null;
    var uit = { id: typeof v.id === 'string' && /^[A-Za-z0-9_\-]{1,40}$/.test(v.id) ? v.id : 'v' + Math.random().toString(36).slice(2, 9), datum: datum, aantal: aantal, koers: koers };
    if (kosten) uit.kosten = kosten;
    if (eur !== null) uit.eur = eur;
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
    // Vanaf 1.10: kosten van de aankoop en het betaalde bedrag in euro (zonder kosten), zoals op het afschrift van de bank.
    var kosten = getalOk(p.kosten, 0, 1e7, false), eur = getalOk(p.eur, 0, 1e10, true);
    if (kosten !== null && kosten > 0) uit.kosten = kosten;
    if (eur !== null) uit.eur = eur;
    else if (valuta === 'EUR') uit.eur = Math.round(aantal * koers * 100) / 100;
    // Verkopen: de app controleert het echte aantal (met splitsingen en dividend in aandelen); hier alleen een ruime grens.
    var verk = [], over = aantal * MAX_GROEI;
    (Array.isArray(p.verkopen) ? p.verkopen : []).forEach(function (v) { var x = schoonVerkoop(v); if (x && x.aantal <= over + 1e-9 && verk.length < 50) { verk.push(x); over -= x.aantal; } });
    // Vanaf 1.15: per dividenduitkering het aantal aandelen dat u werkelijk kreeg (0 = alles contant), als het afschrift afwijkt.
    var dk = {}, ndk = 0;
    if (p.divKeuze && typeof p.divKeuze === 'object' && !Array.isArray(p.divKeuze)) Object.keys(p.divKeuze).forEach(function (d) {
      var n = getalOk(p.divKeuze[d], 0, 1e9, false);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && n !== null && ndk < 200) { dk[d] = n; ndk++; }
    });
    if (ndk) uit.divKeuze = dk;
    if (verk.length) uit.verkopen = verk;
    if (typeof p.pf === 'string' && PF_ID.test(p.pf)) uit.pf = p.pf;
    var nm = schoonNaam(p.naam); if (nm) uit.naam = nm;                       // naam van een fonds dat de app niet volgt
    if (signaal) { uit.signaal = signaal; uit.opSignaal = p.opSignaal === true; }
    return uit;
  }
  var MAX_GROEI = 100;          // splitsingen en dividend in aandelen: hoogstens 100 keer het gekochte aantal
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
  function zelfde(a, b) { return (a.pf || '') === (b.pf || '') && a.ticker === b.ticker && a.aantal === b.aantal && a.koers === b.koers && a.valuta === b.valuta && a.datum === b.datum; }

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
    var pfs = schoonPortefeuilles(data.portefeuilles);
    if (pfs.length) uit.portefeuilles = pfs;
    uit.portefeuille.forEach(function (p) { if (!p.pf || !uit.portefeuilles.some(function (x) { return x.id === p.pf; })) p.pf = uit.portefeuilles[0].id; });
    uit.actief = uit.portefeuilles.some(function (x) { return x.id === data.actief; }) ? data.actief : uit.portefeuilles[0].id;
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
      /* Zonder argument: alle aankopen uit alle portefeuilles (voor signalen en het aandeelscherm); met een id alleen die portefeuille. */
      portefeuille: function (pf) { return pf ? staat.portefeuille.filter(function (x) { return x.pf === pf; }) : staat.portefeuille.slice(); },
      portefeuilles: function () { return staat.portefeuilles.map(function (x) { return { id: x.id, naam: x.naam, dividend: x.dividend === 'aandelen' ? 'aandelen' : 'contant', aantal: staat.portefeuille.filter(function (p) { return p.pf === x.id; }).length }; }); },
      /* Dividend van een portefeuille: 'contant' (standaard) of 'aandelen' (herbeleggen waar het kan, restant contant). */
      zetDividend: function (id, modus) {
        var pf = staat.portefeuilles.filter(function (x) { return x.id === id; })[0];
        if (!pf || (modus !== 'aandelen' && modus !== 'contant')) return false;
        if (modus === 'aandelen') pf.dividend = 'aandelen'; else delete pf.dividend;
        return bewaar(true);
      },
      /* Eén dividenduitkering van een aankoop: het aantal aandelen dat u kreeg (0 = contant), of null = zoals de app het rekent. */
      zetDivKeuze: function (id, datum, aantal) {
        var x = staat.portefeuille.filter(function (p) { return p.id === id; })[0];
        if (!x || !/^\d{4}-\d{2}-\d{2}$/.test(String(datum))) return false;
        if (aantal === null || aantal === undefined) { if (x.divKeuze) { delete x.divKeuze[datum]; if (!Object.keys(x.divKeuze).length) delete x.divKeuze; } return bewaar(true); }
        var n = getalOk(aantal, 0, 1e9, false); if (n === null) return false;
        (x.divKeuze = x.divKeuze || {})[datum] = n;
        return bewaar(true);
      },
      actief: function () { var a = staat.portefeuilles.filter(function (x) { return x.id === staat.actief; })[0] || staat.portefeuilles[0]; return { id: a.id, naam: a.naam, dividend: a.dividend === 'aandelen' ? 'aandelen' : 'contant' }; },
      kiesPortefeuille: function (id) { if (!staat.portefeuilles.some(function (x) { return x.id === id; })) return false; staat.actief = id; bewaar(false); return true; },
      nieuwePortefeuille: function (naam) {
        var n = schoonNaam(naam);
        if (!n) return { ok: false, reden: 'Geef de portefeuille een naam.' };
        if (staat.portefeuilles.length >= MAX_PORTEFEUILLES) return { ok: false, reden: 'Maximaal ' + MAX_PORTEFEUILLES + ' portefeuilles.' };
        if (staat.portefeuilles.some(function (x) { return x.naam.toLowerCase() === n.toLowerCase(); })) return { ok: false, reden: 'Er is al een portefeuille met deze naam.' };
        var id = pfId(n, staat.portefeuilles);
        staat.portefeuilles.push({ id: id, naam: n }); staat.actief = id;
        return { ok: bewaar(true), id: id };
      },
      hernoemPortefeuille: function (id, naam) {
        var n = schoonNaam(naam), pf = staat.portefeuilles.filter(function (x) { return x.id === id; })[0];
        if (!pf) return { ok: false, reden: 'Onbekende portefeuille.' };
        if (!n) return { ok: false, reden: 'Geef de portefeuille een naam.' };
        if (staat.portefeuilles.some(function (x) { return x.id !== id && x.naam.toLowerCase() === n.toLowerCase(); })) return { ok: false, reden: 'Er is al een portefeuille met deze naam.' };
        pf.naam = n; return { ok: bewaar(true) };
      },
      /* Verwijdert de portefeuille met al haar aankopen. De laatste portefeuille blijft altijd bestaan. */
      verwijderPortefeuille: function (id) {
        if (staat.portefeuilles.length <= 1 || !staat.portefeuilles.some(function (x) { return x.id === id; })) return false;
        staat.portefeuilles = staat.portefeuilles.filter(function (x) { return x.id !== id; });
        staat.portefeuille = staat.portefeuille.filter(function (p) { return p.pf !== id; });
        if (staat.actief === id) staat.actief = staat.portefeuilles[0].id;
        return bewaar(true);
      },
      voegPositieToe: function (p) {
        var x = schoonPositie(p);
        if (!x) return { ok: false, reden: 'Controleer aantal, aankoopkoers en valuta: alleen getallen groter dan nul.' };
        if (staat.portefeuille.length >= MAX_POSITIES) return { ok: false, reden: 'portefeuille vol (maximaal ' + MAX_POSITIES + ' aankopen)' };
        x.id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        if (!x.pf || !staat.portefeuilles.some(function (y) { return y.id === x.pf; })) x.pf = staat.actief;
        staat.portefeuille.push(x);
        return { ok: bewaar(true), id: x.id };
      },
      verwijderPositie: function (id) {
        var voor = staat.portefeuille.length;
        staat.portefeuille = staat.portefeuille.filter(function (x) { return x.id !== id; });
        if (staat.portefeuille.length !== voor) bewaar(true);
        return voor !== staat.portefeuille.length;
      },
      /* Alleen de valuta van een aankoop verbeteren (bijv. GBP → GBX als de koers in pence is ingevoerd). */
      zetValuta: function (id, valuta) {
        var v = typeof valuta === 'string' && /^[A-Za-z]{3}$/.test(valuta.trim()) ? valuta.trim().toUpperCase() : null, x = staat.portefeuille.filter(function (p) { return p.id === id; })[0];
        if (!v || !x) return false;
        x.valuta = v; return bewaar(true);
      },
      /* Een aankoop aanpassen (aanvullen met kosten, eurobedrag of datum, of een tikfout verbeteren). Verkopen blijven. */
      wijzigPositie: function (id, velden) {
        var i = staat.portefeuille.map(function (x) { return x.id; }).indexOf(id);
        if (i < 0) return { ok: false, reden: 'Onbekende aankoop.' };
        var oud = staat.portefeuille[i], samen = {}, k;
        for (k in oud) samen[k] = oud[k];
        for (k in velden) if (Object.prototype.hasOwnProperty.call(velden, k)) samen[k] = velden[k];
        if (velden.valuta && String(velden.valuta).toUpperCase() !== 'EUR' && !('eur' in velden)) delete samen.eur;
        var x = schoonPositie(samen);
        if (!x) return { ok: false, reden: 'Controleer aantal, aankoopkoers en valuta: alleen getallen groter dan nul.' };
        var verkocht = (x.verkopen || []).reduce(function (a, v) { return a + v.aantal; }, 0);
        var verkochtOud = (oud.verkopen || []).reduce(function (a, v) { return a + v.aantal; }, 0);
        if ((oud.verkopen || []).length !== (x.verkopen || []).length || (verkochtOud <= oud.aantal + 1e-9 && verkocht > x.aantal + 1e-9)) return { ok: false, reden: 'Het aantal is kleiner dan wat er al verkocht is.' };
        x.id = oud.id; x.pf = oud.pf;
        staat.portefeuille[i] = x;
        return { ok: bewaar(true), verkocht: verkocht };
      },
      /* (Een deel van) een aankoop verkopen. */
      /* max: het aantal dat u nog heeft volgens de app (met splitsingen en dividend in aandelen); zonder max het gekochte aantal. */
      verkoopPositie: function (id, v, max) {
        var x = staat.portefeuille.filter(function (p) { return p.id === id; })[0], vk = schoonVerkoop(v);
        if (!x) return { ok: false, reden: 'Onbekende aankoop.' };
        if (!vk) return { ok: false, reden: 'Vul de datum, het aantal en de verkoopkoers in (getallen groter dan nul).' };
        var open = typeof max === 'number' && isFinite(max) && max >= 0 ? max : x.aantal - (x.verkopen || []).reduce(function (a, y) { return a + y.aantal; }, 0);
        if (vk.aantal > open + 1e-9) return { ok: false, reden: 'U heeft nog ' + Math.round(open * 10000) / 10000 + ' stuks; meer verkopen kan niet.' };
        if (x.datum && vk.datum < x.datum) return { ok: false, reden: 'De verkoopdatum ligt vóór de aankoopdatum.' };
        if (x.valuta === 'EUR' && vk.eur == null) vk.eur = Math.round(vk.aantal * vk.koers * 100) / 100;
        (x.verkopen = x.verkopen || []).push(vk);
        return { ok: bewaar(true), id: vk.id };
      },
      verwijderVerkoop: function (id, vid) {
        var x = staat.portefeuille.filter(function (p) { return p.id === id; })[0];
        if (!x || !x.verkopen) return false;
        var voor = x.verkopen.length; x.verkopen = x.verkopen.filter(function (v) { return v.id !== vid; });
        if (!x.verkopen.length) delete x.verkopen;
        if ((x.verkopen || []).length !== voor) return bewaar(true);
        return false;
      },
      herstelPositie: function (p) { var x = schoonPositie(p); if (x && (!x.pf || !staat.portefeuilles.some(function (y) { return y.id === x.pf; }))) x.pf = staat.actief; if (!x || staat.portefeuille.some(function (y) { return y.id === x.id; })) return false; staat.portefeuille.push(x); return bewaar(true); },
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
          volglijst: staat.volglijst, portefeuille: staat.portefeuille, portefeuilles: staat.portefeuilles, actief: staat.actief, checklist: staat.checklist, zones: staat.zones, verdieping: staat.verdieping, instellingen: staat.instellingen };
        if (!zonderMarkering) { staat.laatsteBackup = b.gemaakt; bewaar(false); }
        return JSON.stringify(b, null, 1);
      },
      /* Zonder te bewaren: wat zit er nu op dit toestel? */
      inhoud: function () { return { volglijst: staat.volglijst.length, portefeuille: staat.portefeuille.length, portefeuilles: staat.portefeuilles.length, beoordelingen: Object.keys(staat.verdieping).length, checklists: Object.keys(staat.checklist).length, laatsteBackup: staat.laatsteBackup, gewijzigd: staat.gewijzigd || null }; },
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
        var pfNamen = sc.portefeuilles.filter(function (x) { return sc.portefeuille.some(function (p) { return p.pf === x.id; }); }).map(function (x) { return x.naam; });
        var nieuwPf = sc.portefeuilles.filter(function (x) { return !staat.portefeuilles.some(function (y) { return y.id === x.id; }); }).map(function (x) { return x.naam; });
        return { ok: true, gemaakt: typeof data.gemaakt === 'string' ? data.gemaakt : null,
          volglijst: sc.volglijst.length, portefeuille: sc.portefeuille.length, beoordelingen: Object.keys(sc.verdieping).length, checklists: Object.keys(sc.checklist).length,
          portefeuilles: pfNamen, nieuw: { volglijst: nieuwV, portefeuille: nieuwP, beoordelingen: nieuwB, portefeuilles: nieuwPf } };
      },
      /* Terugzetten voegt toe en vervangt nooit stilzwijgend: standaard samenvoegen. */
      zetTerug: function (tekst, modus) {
        var data;
        try { data = JSON.parse(tekst); } catch (e) { return { ok: false, reden: 'Dit bestand is geen geldige back-up.' }; }
        if (!data || data.app !== 'Aandeel Signaal' || data.soort !== 'back-up') return { ok: false, reden: 'Dit is geen back-up van Aandeel Signaal.' };
        var s = schoon(data), nieuw = 0;
        if (modus === 'vervang') { staat.volglijst = s.volglijst; staat.portefeuille = s.portefeuille; staat.portefeuilles = s.portefeuilles; staat.actief = s.actief; staat.checklist = s.checklist; staat.zones = s.zones; staat.verdieping = s.verdieping; nieuw = s.volglijst.length + s.portefeuille.length; }
        else {
          s.volglijst.forEach(function (it) {
            if (!staat.volglijst.some(function (x) { return x.ticker === it.ticker; }) && staat.volglijst.length < MAX_VOLGLIJST) {
              staat.volglijst.push(it); nieuw++;
            }
          });
        }
        if (modus !== 'vervang') s.portefeuilles.forEach(function (x) {     // portefeuilles uit de back-up erbij (zelfde id = dezelfde portefeuille)
          if (!staat.portefeuilles.some(function (y) { return y.id === x.id; }) && staat.portefeuilles.length < MAX_PORTEFEUILLES) staat.portefeuilles.push(x);
        });
        if (modus !== 'vervang') s.portefeuille.forEach(function (p) {
          if (!staat.portefeuilles.some(function (y) { return y.id === p.pf; })) p.pf = staat.portefeuilles[0].id;
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

  var api = { schoonVerkoop: schoonVerkoop, SLEUTEL: SLEUTEL, MAX_VOLGLIJST: MAX_VOLGLIJST, MAX_POSITIES: MAX_POSITIES, MAX_PORTEFEUILLES: MAX_PORTEFEUILLES, PUNTEN_AANTAL: PUNTEN_AANTAL, MAX_NOTITIE: MAX_NOTITIE, schoonChecklist: schoonChecklist, schoonZones: schoonZones, schoonVerdieping: schoonVerdieping, schoonSignaal: schoonSignaal, schoonPositie: schoonPositie, normTicker: normTicker, schoon: schoon, maak: maak };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Store = api;
})(typeof self !== 'undefined' ? self : this);
