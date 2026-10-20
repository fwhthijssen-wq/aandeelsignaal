/* Label-slot, trend en overzicht. Spiegel van label_gate.py en overzicht.py (pariteit wordt getest).
   Fail-closed: alles wat niet aantoonbaar goed is, blokkeert een oordeel. Geen DOM, geen netwerk. */
(function (root) {
  'use strict';
  var REQUIRED_EPS_YEARS = 10;
  var MAX_PRICE_AGE_DAYS = 7;
  var EPS_STATUS_TEXT = {
    split_evidence_rejected: 'splitbewijs afgewezen',
    independent_evidence_conflict: 'tegenstrijdig onafhankelijk EPS-bewijs',
    partially_independently_verified: 'EPS slechts gedeeltelijk onafhankelijk bevestigd',
    provisional_not_independently_verified: 'EPS voorlopig, niet onafhankelijk bevestigd',
    missing_split_evidence: 'splitbewijs ontbreekt'
  };

  function parseDay(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    var p = s.split('-').map(Number);
    var t = Date.UTC(p[0], p[1] - 1, p[2]);
    var d = new Date(t);
    if (d.getUTCFullYear() !== p[0] || d.getUTCMonth() !== p[1] - 1 || d.getUTCDate() !== p[2]) return null;
    return t;
  }
  function isCount(v) { return typeof v === 'number' && Number.isInteger(v) && v >= 0; }

  function priceFreshness(priceDate, today) {
    var pd = parseDay(priceDate), td = parseDay(today);
    if (pd === null || td === null) return { fresh: false, reason: 'Koersdatum onbekend.' };
    var age = Math.round((td - pd) / 86400000);
    if (age < 0) return { fresh: false, reason: 'Koersdatum ligt in de toekomst; data onbetrouwbaar.' };
    if (age > MAX_PRICE_AGE_DAYS) {
      return { fresh: false, reason: 'Koers is ' + age + ' dagen oud (maximaal ' + MAX_PRICE_AGE_DAYS +
        '); laatste handelsdag ' + priceDate + '.' };
    }
    return { fresh: true, reason: '' };
  }

  function labelGate(o) {
    o = o || {};
    var required = o.requiredYears == null ? REQUIRED_EPS_YEARS : o.requiredYears;
    var reasons = [];
    var st = o.epsStatus, yrs = o.epsVerifiedYears;
    if (st == null || yrs == null) {
      reasons.push('Geen bevestigde EPS-bewijsketen (SEC) gekoppeld aan deze beoordeling.');
    } else {
      if (!isCount(yrs) || yrs < required) {
        reasons.push('EPS onafhankelijk bevestigd voor ' + yrs + ' van de vereiste ' + required + ' jaren.');
      }
      if (Object.prototype.hasOwnProperty.call(EPS_STATUS_TEXT, st)) {
        reasons.push('EPS-status: ' + EPS_STATUS_TEXT[st] + '.');
      } else if (st !== 'independently_verified') {
        reasons.push('EPS-status onbekend (' + st + ').');
      }
    }
    var f = priceFreshness(o.priceDate, o.today);
    if (!f.fresh) reasons.push(f.reason);
    var cur = o.currencies;
    var uniq = Array.isArray(cur) ? cur.filter(function (c, i) { return cur.indexOf(c) === i; }) : [];
    if (!Array.isArray(cur) || uniq.length !== 1) reasons.push('Geen eenduidige valuta vastgesteld.');
    if (o.rejectedSources == null) reasons.push('Onbekend of bronregels zijn afgewezen.');
    else if (!isCount(o.rejectedSources) || o.rejectedSources > 0) {
      reasons.push('Bronregels afgewezen of tegenstrijdig: handmatige beoordeling vereist.');
    }
    return { allowed: reasons.length === 0, reasons: reasons };
  }

  function trend(price, sma50) {
    if (typeof price !== 'number' || typeof sma50 !== 'number' || !isFinite(price) || !isFinite(sma50) ||
        sma50 <= 0 || price <= 0) return { richting: null, afstandPct: null };
    return { richting: price > sma50 ? 'boven' : 'onder', afstandPct: Math.round((price / sma50 - 1) * 1000) / 10 };
  }

  /* Eén regel van het overzicht uit een record van aandelen.json. */
  function maakRij(rec, today) {
    var k = rec.koers, g = rec.gegevens;
    var koersdatum = k ? k.datum : null;
    var fr = k ? priceFreshness(koersdatum, today) : { fresh: false, reason: 'Geen koersgegevens.' };
    var redenen, toegestaan = false;
    if (!g) {
      redenen = ['Nog niet gecontroleerd: de jaarcijfers van dit aandeel zijn nog niet opgehaald.'];
    } else if (g.fout) {
      redenen = [g.fout];
    } else {
      var gate = labelGate({ epsStatus: g.eps_status, epsVerifiedYears: g.eps_verified_years, priceDate: koersdatum,
        today: today, currencies: g.currencies, rejectedSources: g.rejected_sources });
      redenen = gate.reasons; toegestaan = gate.allowed;
    }
    var t = fr.fresh ? trend(k.slot, k.sma50) : { richting: null, afstandPct: null };
    return { ticker: rec.ticker, naam: rec.naam, bevestigd: toegestaan, koersActueel: fr.fresh,
      koersReden: fr.fresh ? null : fr.reason, richting: t.richting, afstandPct: t.afstandPct, redenen: redenen };
  }

  function sorteer(rijen) {
    return rijen.slice().sort(function (a, b) {
      if (a.bevestigd !== b.bevestigd) return a.bevestigd ? -1 : 1;
      var x = a.naam.toLowerCase(), y = b.naam.toLowerCase();
      return x < y ? -1 : x > y ? 1 : 0;
    });
  }

  /* Rekenvoorbeeld (spiegel van valuation_scenarios.scenario); gooit bij ongeldige invoer. */
  function scenario(eps, groeiPct, kwEind, jaren, rendementPct, margePct) {
    var vals = [eps, groeiPct, kwEind, rendementPct, margePct];
    for (var i = 0; i < vals.length; i++) {
      if (typeof vals[i] !== 'number' || !isFinite(vals[i])) throw new Error('Alle aannames moeten getallen zijn.');
    }
    if (eps <= 0 || kwEind <= 0 || !Number.isInteger(jaren) || jaren < 1 || jaren > 10) {
      throw new Error('EPS en toekomstige K/W moeten positief zijn; horizon 1-10 jaar.');
    }
    if (!(groeiPct > -100 && groeiPct <= 100 && rendementPct >= 0 && rendementPct <= 50 && margePct >= 0 && margePct < 100)) {
      throw new Error('Groei, rendement of veiligheidsmarge buiten toegestaan bereik.');
    }
    var toekomstEps = eps * Math.pow(1 + groeiPct / 100, jaren);
    var toekomstKoers = toekomstEps * kwEind;
    var contant = toekomstKoers / Math.pow(1 + rendementPct / 100, jaren);
    return { toekomstigeEps: toekomstEps, toekomstigeKoers: toekomstKoers, contanteWaarde: contant,
      naMarge: contant * (1 - margePct / 100) };
  }

  var api = { REQUIRED_EPS_YEARS: REQUIRED_EPS_YEARS, MAX_PRICE_AGE_DAYS: MAX_PRICE_AGE_DAYS, parseDay: parseDay,
    priceFreshness: priceFreshness, labelGate: labelGate, trend: trend, maakRij: maakRij, sorteer: sorteer,
    scenario: scenario };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Gate = api;
})(typeof self !== 'undefined' ? self : this);
