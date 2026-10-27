/* Aandeel Signaal - schermen. Alle labels komen uit Gate.labelGate met de datum van VANDAAG op dit toestel. */
(function () {
  'use strict';
  var APP_VERSIE = '2026.10.27-beta.93';

  // Splitverhouding als '4-voor-1', of bij een samenvoeging (verhouding onder 1, zoals Unilever 8/9) '8-voor-9 (samenvoeging)'.
  function splitTekst(r) {
    r = Number(r);
    if (!(r > 0)) return String(r);
    for (var q = 1; q <= 10; q++) {
      var p = Math.round(r * q);
      if (p > 0 && Math.abs(p / q - r) < 1e-6) return p + '-voor-' + q + (r < 1 ? ' (samenvoeging)' : '');
    }
    return String(Math.round(r * 1000) / 1000) + '-voor-1';
  }
  var DATA = window.AANDEEL_DATA || { aandelen: [] };
  var UITLEG = window.AANDEEL_UITLEG || { termen: [] };
  var opslag = null;
  try { opslag = window.localStorage; opslag.getItem('x'); } catch (e) { opslag = null; }
  var geheugen = {};
  var vals = opslag || { getItem: function (k) { return k in geheugen ? geheugen[k] : null; }, setItem: function (k, v) { geheugen[k] = String(v); } };
  var winkel = Store.maak(vals);
  var $inhoud = document.getElementById('inhoud'), $menu = document.getElementById('menu'), $meld = document.getElementById('melding'), $laag = document.getElementById('laag');

  function h(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function vandaag() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  /* Oordeel in de woorden van NAIC. 'positief' komt alleen nog voor in momentopnames van vóór beta.65. */
  var OORDEEL = { kopen: 'Kopen', neutraal: 'Neutraal', vermijden: 'Vermijden', positief: 'Positief (oude berekening)' };
  /* Per kernmeting een stip in een kleurschaal: donkergroen ✓ gunstig, lichtgroen ✓ licht gunstig, half groen/half rood = neutraal,
     lichtrood ✗ licht ongunstig, rood ✗ ongunstig. Lege ring = ontbreekt, streepje = niet van toepassing.
     Met een score kiest de tint de sterkte (vanaf ±0,75 donker); zonder score is gunstig donkergroen en ongunstig rood. */
  var STIP = { gunstig: { t: '✓', c: 'g' }, neutraal: { t: '=', c: 'n' }, ongunstig: { t: '✗', c: 'o' } };
  var TINT = { g: 'gunstig', h: 'licht gunstig', n: 'neutraal', p: 'licht ongunstig', o: 'ongunstig' };
  function tint(o, score) {
    var s = STIP[o]; if (!s) return null;
    if (typeof score !== 'number' || !isFinite(score)) return s.c;
    return o === 'gunstig' ? (score >= 0.75 ? 'g' : 'h') : o === 'ongunstig' ? (score <= -0.75 ? 'o' : 'p') : 'n';
  }
  function stipWoord(m) { return m.nvt ? 'niet van toepassing' : m.aanwezig ? m.oordeel : 'ontbreekt'; }
  function stip(o, label, nvt, score) { var s = STIP[o], c = nvt ? 'x' : tint(o, score) || 'l'; return '<span class="stip ' + c + '" role="img" aria-label="' + h(label + ': ' + (nvt ? 'niet van toepassing' : s ? TINT[c] : 'ontbreekt')) + '">' + (nvt ? '–' : s ? s.t : '') + '</span>'; }
  function stippen(b, klein) {
    return '<span class="stippen' + (klein ? ' klein detail' : '') + '" data-profiel="' + Signaal.profiel(b) + '">' + b.metingen.map(function (m) {
      return '<span class="stip-kol">' + stip(m.oordeel, m.kort, m.nvt, m.score) + '<span class="stip-naam" aria-hidden="true">' + h(m.kort) + '</span></span>';
    }).join('') + '</span>';
  }
  function oordeelChip(b) {
    return b.oordeel ? '<span class="chip oordeel" data-oordeel="' + b.oordeel + '">' + OORDEEL[b.oordeel] + '</span>' : '<span class="chip wacht" data-oordeel="geen">Geen oordeel</span>';
  }
  function telTekst(b) { return b.aantal + ' van ' + b.mogelijk + ' metingen'; }
  function minMetingen() { try { var v = parseInt(localStorage.getItem('as_minmeting'), 10); return v >= 2 && v <= 6 ? v : Signaal.MIN_METINGEN; } catch (e) { return Signaal.MIN_METINGEN; } }
  function zetMinMetingen(v) { try { localStorage.setItem('as_minmeting', String(v)); } catch (e) { /* standaard blijft */ } }
  function uitlegOordeel() {
    return '<details class="uitleg" data-uitleg-oordeel><summary>Hoe komt het oordeel tot stand?</summary>' +
      '<p>Het oordeel volgt de regels van de <b>NAIC Stock Selection Guide</b>:</p><ul class="punten">' +
      '<li><b>Groeibedrijf?</b> De winst per aandeel groeit minstens ' + Naic.GROEI_MIN + '% per jaar (trendlijn over hoogstens 10 jaar). In de berekening rekent de app voorzichtig met hoogstens ' + Naic.GROEI_MAX + '%.</li>' +
      '<li><b>Goed bedrijf? (stap 1 en 2)</b> Omzet en winst groeien gelijk op, en de marge vóór belasting en het rendement op eigen vermogen dalen niet.</li>' +
      '<li><b>Prijs (stap 3 tot 5)</b> Uit de gemiddelde hoge en lage K/W van 5 jaar volgt een verwachte hoge en lage koers over 5 jaar, verdeeld in drie zones: kopen, houden, verkopen. Kopen vraagt minstens 3 : 1 opwaarts tegen neerwaarts.</li>' +
      '<li><b>Rendement (stap 6)</b> Koersstijging tot de hoge koers plus dividend: minstens ' + Naic.TOTAAL_MIN + '% per jaar (geld verdubbelen in 5 jaar).</li></ul>' +
      '<p><b>Kopen</b>: koers in de koopzone, minstens 3 : 1, minstens ' + Naic.TOTAAL_MIN + '% per jaar en geen kwaliteitstoets afgevallen. <b>Vermijden</b>: verkoopzone, of geen groeibedrijf. Anders <b>Neutraal</b>.</p>' +
      '<p>Daaronder staan, <b>aanvullend</b>, zes metingen die NAIC niet gebruikt (kasstroom, schuld, groei, K/W, koerstrend en koersrust) met een eigen Kopen/Neutraal/Vermijden. Dat telt niet mee in het NAIC-oordeel; bij Kansrijk kunt u er wel op selecteren (App of Beide). ' +
      'Andere kentallen, uw eigen oordeel en het advies van analisten staan er ter informatie bij. Selectiehulp, geen beleggingsadvies.</p></details>';
  }
  function signaalVoor(rec, gevoeligheid) {
    var ck = Checklist.voortgang(winkel.checklist(rec.ticker));
    return Signaal.beoordeel(rec, { vandaag: vandaag(), gate: Gate, naic: Naic, check: ck, minMetingen: minMetingen(), verdieping: winkel.verdieping(rec.ticker), gevoeligheid: !!gevoeligheid });
  }
  /* Wat de app nu vindt, om later terug te kunnen kijken: oordeel, de zes metingen, en (bij een verse koers) de koers. */
  function momentopname(rec) {
    var b = signaalVoor(rec), k = rec.koers, vers = k && Gate.priceFreshness(k.datum, vandaag()).fresh && typeof k.slot === 'number' && k.slot > 0;
    return { oordeel: b.oordeel, dekking: b.dekking, score: b.score, profiel: Signaal.profiel(b), aantal: b.aantal, mogelijk: b.mogelijk, naic: b.naic ? b.naic.oordeel : null,
      datum: vandaag(), koers: vers ? k.slot : null, valuta: vers ? rec.valuta : null };
  }
  /* Een bewaard of huidig oordeel als korte tekst. */
  function oordeelTekst(x) {
    if (!x) return 'geen oordeel';
    var tel = typeof x.aantal === 'number' && typeof x.mogelijk === 'number' ? ' (' + x.aantal + ' van ' + x.mogelijk + ' metingen)' : (x.oordeel === 'positief' || !x.oordeel ? '' : '');
    var nc = x.naic && typeof x.naic === 'object' ? x.naic.oordeel : x.naic;
    return 'NAIC ' + (nc && OORDEEL[nc] ? OORDEEL[nc] : '–') + ' · zes metingen ' + (x.oordeel ? OORDEEL[x.oordeel] : 'geen oordeel') + tel;
  }
  function bronTekst(m, b) {
    var q = m.kwaliteit, K = Signaal.KWALITEIT;
    if (!q) return '';
    if (q === 'koers') return 'koersdata' + (b.datum ? ' van ' + datumNl(b.datum) : '');
    if (q === 'eigen') return 'uw eigen invoer';
    return K[q].naam + (b.jaar ? ', boekjaar ' + b.jaar : '');
  }
  function methKnop(id, naam) { return '<button type="button" class="meth-knop" data-methode="' + id + '" aria-haspopup="dialog">' + h(naam) + ' <span aria-hidden="true">ⓘ</span></button>'; }
  /* Eén kernmeting: wat ze zegt en waar het cijfer vandaan komt, of waarom ze ontbreekt. */
  function metingRegel(m, b) {
    if (m.nvt) return '<li data-meting="' + m.id + '" data-nvt>' + stip(null, m.kort, true) + '<div><b>' + h(m.kort) + '</b> · ' + h(m.naam || '') + '<br><span class="zacht">Niet van toepassing op banken en verzekeraars; telt niet mee.</span></div></li>';
    if (!m.aanwezig) return '<li data-meting="' + m.id + '" data-ontbreekt>' + stip(null, m.kort) + '<div><b>' + h(m.kort) + '</b> · ' + methKnop(m.methode, m.naam) + '<br><span class="ontbreekt-tekst">Ontbreekt: ' + h(m.reden) + '</span></div></li>';
    return '<li data-meting="' + m.id + '">' + stip(m.oordeel, m.kort, false, m.score) + '<div><b>' + h(m.kort) + '</b> · ' + methKnop(m.methode, m.naam) + '<br><span>' + h(m.tekst) + '</span><br><span class="zacht bron" data-bron="' + h(m.kwaliteit) + '">Bron: ' + h(bronTekst(m, b)) + '</span></div></li>';
  }
  function infoRegel(m, b) {
    return '<li>' + (m.aanwezig ? stip(m.score >= 0.25 ? 'gunstig' : m.score <= -0.25 ? 'ongunstig' : 'neutraal', m.naam, false, m.score) : stip(null, m.naam, m.nvt)) + '<div>' + methKnop(m.id, m.naam) + '<br><span' + (m.aanwezig ? '' : ' class="zacht"') + '>' +
      h(m.aanwezig ? m.tekst : m.nvt ? 'Niet van toepassing op banken en verzekeraars.' : 'Gegevens ontbreken.') + '</span>' + (m.aanwezig ? '<br><span class="zacht bron">Bron: ' + h(bronTekst(m, b)) + '</span>' : '') + '</div></li>';
  }
  /* Analisten (Yahoo Finance): ter informatie, telt niet mee. */
  var ADVIES = { strong_buy: 'sterk kopen', buy: 'kopen', hold: 'houden', underperform: 'onder het gemiddelde', sell: 'verkopen', strong_sell: 'sterk verkopen', none: 'geen' };
  function analistenBlok(rec) {
    var a = rec.analisten;
    if (!a || !(a.aantal > 0)) return '<div class="kaart-plat info" data-analisten><h3>Analisten</h3><p class="zacht">Geen analistenadvies bekend bij Yahoo Finance.</p></div>';
    var doel = typeof a.koersdoel === 'number' ? getal(a.koersdoel, 2) + ' ' + h(a.valuta || rec.valuta || '') : null;
    return '<div class="kaart-plat info" data-analisten><h3>Analisten</h3><p>Gemiddeld advies van ' + a.aantal + ' analisten: <b>' + h(ADVIES[a.advies] || a.advies || 'onbekend') + '</b>' +
      (typeof a.gemiddeld === 'number' ? ' (' + getal(a.gemiddeld, 1) + ' op een schaal van 1 = sterk kopen tot 5 = verkopen)' : '') + '.' + (doel ? ' Gemiddeld koersdoel: ' + doel + '.' : '') + '</p>' +
      '<p class="zacht">Bron: Yahoo Finance' + (a.datum ? ', ' + h(datumNl(a.datum)) : '') + '. Een mening, telt niet mee in het oordeel. Analisten zijn gemiddeld optimistisch: “verkopen” komt weinig voor.</p></div>';
  }
  var laatsteBeoordeling = null;
  function signaalKaart(rec) {
    var b = laatsteBeoordeling = signaalVoor(rec, true);
    var kop = b.oordeel ? '<b class="groot-oordeel" data-app data-oordeel="' + b.oordeel + '">' + OORDEEL[b.oordeel] + '</b>' : '<b class="groot-oordeel" data-app data-oordeel="geen">Geen oordeel</b>';
    var waarom = b.oordeel ? 'Gemiddelde van ' + telTekst(b) + ': ' + String(b.score).replace('.', ',') + ' (Kopen vanaf +0,5; Vermijden vanaf −0,25).' : 'Er zijn ' + telTekst(b) + ' beschikbaar; voor een oordeel zijn er minstens ' + Math.min(b.minMetingen, b.mogelijk) + ' nodig.';
    var s = '<div data-signaal>' + naicKaart(rec, b) + '<div class="kaart-plat aanvullend detail" data-app-kaart><div class="rij-kop"><h2>Aanvullend: zes metingen</h2><span class="zacht" data-dekking="' + b.dekking + '">' + telTekst(b) + '</span></div><p class="zacht">Geen NAIC-regels; telt niet mee in het NAIC-oordeel.</p>' + kop + stippen(b) +
      '<p class="zacht">' + h(waarom) + '</p><ul class="methoden" data-metingen>' + b.metingen.map(function (m) { return metingRegel(m, b); }).join('') + '</ul>';
    b.verouderd.forEach(function (t) { s += '<p class="zacht" data-verouderd>⚠ ' + h(t) + '</p>'; });
    s += '</div><div class="detail"><h3 class="tussenkop">Ter informatie <span class="zacht">(telt niet mee)</span></h3>';
    s += b.vragen.map(function (v) {
      if (!v.info.length) return '';
      var aan = v.info.filter(function (m) { return m.aanwezig; }).length;
      return '<details class="kaart-plat info" data-info="' + v.id + '"><summary><b>' + h(v.kort) + '</b> <span class="zacht">' + h(v.vraag) + ' · ' + aan + ' van ' + v.info.length + ' bekend</span></summary><ul class="methoden">' +
        v.info.map(function (m) { return infoRegel(m, b); }).join('') + '</ul>' + (v.id === 'eigen' ? '<div class="knoppen"><a class="knop rand klein" href="#/a/' + encodeURIComponent(b.ticker) + '/check">Zelf beoordelen bij Verdiepen</a></div>' : '') + '</details>';
    }).join('');
    s += analistenBlok(rec) + '</div>' + (weergave() === 'eenvoudig' ? '<div class="knoppen"><button type="button" class="knop rand klein" data-weergave-knop="uitgebreid">Alle details tonen</button></div>' : '');
    return s + '</div>' + uitlegOordeel();
  }
  /* ---- NAIC als tweede, losstaand oordeel naast dat van de app ---- */
  function naicChip(b) {
    var n = b.naic;
    return n && n.oordeel ? '<span class="chip oordeel naic" data-naic="' + n.oordeel + '" data-oordeel="' + n.oordeel + '"><span class="chip-pre">NAIC</span> ' + OORDEEL[n.oordeel] + '</span>'
      : '<span class="chip naic leeg" data-naic="geen"><span class="chip-pre">NAIC</span> –</span>';
  }
  function appChip(b) {
    return '<span class="chip oordeel app detail' + (b.oordeel ? '' : ' leeg') + '" data-oordeel="' + (b.oordeel || 'geen') + '"><span class="chip-pre">App</span> ' + (b.oordeel ? OORDEEL[b.oordeel] : '–') + '</span>';
  }
  function koopKort(b) {
    var kp = b.naic && b.naic.koopprijs;
    if (!kp || !kp.prijs || kp.afstand == null) return '';
    var a = kp.afstand;
    var nu = b.naic.zones && b.naic.zones.koers != null ? getal(b.naic.zones.koers, 2) : null;
    return '<span class="koop-kort" data-koop="' + (a <= 0 ? 'onder' : 'boven') + '" title="Koopprijs ' + getal(kp.prijs, 2) + '">' + (nu ? 'Koers ' + nu + ' · ' : '') + (a <= 0 ? 'onder koopprijs ' + getal(kp.prijs, 2) : pct(a) + ' boven koopprijs ' + getal(kp.prijs, 2)) + '</span>';
  }
  function oordeelRij(b) { return '<span class="oordeel-rij">' + naicChip(b) + appChip(b) + koopKort(b) + stippen(b, true) + '</span>'; }
  /* De vijf NAIC-stappen als rij vinkjes, de koopprijs en hoe stevig het oordeel is. */
  /* Hoe vers zijn de cijfers? Laatste boekjaar en datum van de koers, met een waarschuwing als het laatste jaarverslag uitblijft. */
  function versHtml(rec, b) {
    var g = rec.gegevens || {}, jr = (g.jaren || []).filter(function (j) { return j && j.end; }).sort(function (x, y) { return x.end < y.end ? -1 : 1; });
    var l = jr[jr.length - 1], k = rec.koers, delen = [], oud = false;
    var niveau = b.niveau && Signaal.KWALITEIT[b.niveau] ? Signaal.KWALITEIT[b.niveau].naam : null;
    if (l) {
      delen.push('cijfers' + (niveau ? ' (' + niveau + ')' : '') + ' t/m boekjaar ' + l.year + ' (tot ' + datumNl(l.end) + ')');
      var dagen = (Date.parse(vandaag()) - Date.parse(l.end)) / 86400000;
      oud = dagen > 480;
    } else delen.push('geen jaarcijfers');
    var vers = k && k.datum ? Gate.priceFreshness(k.datum, vandaag()).fresh : false;
    delen.push(k && k.datum ? 'koers van ' + datumNl(k.datum) + (vers ? '' : ' (verouderd)') : 'geen koers');
    return '<p class="vers zacht" data-vers' + (oud || !vers ? ' data-let-op' : '') + '>' + h(delen.join(' · ').replace(/^./, function (c) { return c.toUpperCase(); })) +
      (oud ? '<br>⚠ Het jaarverslag over het laatste boekjaar ontbreekt nog; het oordeel rust op oudere cijfers.' : '') + '</p>';
  }
  function ladderHtml(n) {
    var l = Naic.ladder(n);
    if (!l) return '';
    return '<div class="ladder" data-ladder role="list" aria-label="NAIC-stappen">' + l.map(function (x) {
      return '<span class="ladder-stap" role="listitem">' + stip(x.ok === true ? 'gunstig' : x.ok === false ? 'ongunstig' : null, x.naam) + '<span>' + h(x.naam) + '</span></span>';
    }).join('') + '</div>';
  }
  function koopprijsHtml(n, valuta) {
    var kp = n.koopprijs;
    if (!kp) return n.groeiHistorisch !== null && n.oordeel === 'vermijden' ? '<p class="koopprijs" data-koopprijs="geen"><b>Koopprijs:</b> geen; het is volgens NAIC (nu) geen groeibedrijf.</p>' : '';
    if (!kp.prijs) return '<p class="koopprijs" data-koopprijs="geen"><b>Koopprijs:</b> geen. ' + h(kp.reden || '') + '</p>';
    var waarom = { zone: 'de bovengrens van de koopzone', verhouding: 'precies 3 : 1 opwaarts tegen neerwaarts', rendement: 'precies ' + Naic.TOTAAL_MIN + '% verwacht rendement per jaar' }[kp.bindend];
    return '<p class="koopprijs" data-koopprijs="' + kp.prijs + '"><b>Kopen onder ' + getal(kp.prijs, 2) + ' ' + h(valuta) + '</b>' +
      (kp.afstand != null ? '<br>Koers nu <b>' + getal(n.zones && n.zones.koers != null ? n.zones.koers : kp.prijs * (1 + kp.afstand / 100), 2) + ' ' + h(valuta) + '</b>: ' + (kp.afstand <= 0 ? '<b>' + pct(-kp.afstand).replace('+', '') + ' onder de koopprijs</b>' : '<b>' + pct(kp.afstand).replace('+', '') + ' boven de koopprijs</b>') : '') +
      '<span class="detail"><br><span class="zacht">Bij deze koers kloppen alle NAIC-prijsregels; de grens komt uit ' + waarom + '. Verandert de winst of de koersgeschiedenis, dan verandert de koopprijs mee.</span></span></p>';
  }
  function gevoeligHtml(n) {
    var gv = n.gevoeligheid;
    if (!gv) return '';
    var o = n.oordeel, st = String(gv.stap).replace('.', ',');
    var delen = [];
    if (gv.lager !== o) delen.push('met ' + st + ' procentpunt minder groei wordt het ' + (OORDEEL[gv.lager] || 'geen oordeel'));
    if (gv.hoger !== o) delen.push('met ' + st + ' procentpunt meer groei wordt het ' + (OORDEEL[gv.hoger] || 'geen oordeel'));
    var tekst = delen.length ? 'Op het randje: ' + delen.join(', ') + '.' : 'Stevig: blijft ' + OORDEEL[o] + ' als de groei ' + st + ' procentpunt lager of hoger uitvalt.';
    return '<p class="gevoelig" data-gevoelig="' + (gv.lager === o && gv.hoger === o ? 'stevig' : 'rand') + '">' + h(tekst) + '</p>';
  }
  function geld(x) { return typeof x === 'number' && isFinite(x) ? getal(x, x >= 100 ? 0 : 2) : '–'; }
  /* Uitkomst van het terugrekenen (hulp/terugrekenen.py + .js, 25 okt 2026, regels van beta.76): rendement incl. dividend
     ten opzichte van het gewone gemiddelde van alle fondsen op dezelfde peildatum (30 april 2018-2025). */
  var TERUG = { periode: '2018–2025', datum: '25 oktober 2026', rijen: {
    kopen: { j1: 4.5, j3: 21.9, n: 75, mediaan1: -2.4, beter1: 47 },
    neutraal: { j1: 1.6, j3: 0.8, n: 284, mediaan1: -4.0, beter1: 44 },
    vermijden: { j1: -2.4, j3: -8.5, n: 241, mediaan1: -4.2, beter1: 44 } } };
  function terugBlok(oordeel) {
    var T = TERUG.rijen, tk = function (x) { return (x > 0 ? '+' : '') + String(x).replace('.', ',') + '%'; };
    var rij = function (o) { var x = T[o]; return '<tr' + (o === oordeel ? ' data-huidig' : '') + '><th scope="row">' + OORDEEL[o] + '</th><td>' + tk(x.j1) + '</td><td>' + tk(x.j3) + '</td><td>' + x.n + '</td></tr>'; };
    return '<details class="terug" data-terug><summary>Hoe deed dit oordeel het in het verleden?</summary>' +
      '<p class="zacht">Teruggerekend over ' + TERUG.periode + ': elk jaar op 30 april het NAIC-oordeel zoals de app het toen had gegeven, en het rendement daarna (inclusief dividend), vergeleken met het gemiddelde van alle fondsen.</p>' +
      '<div class="schuif"><table class="vgl"><thead><tr><th>Oordeel</th><th>1 jaar</th><th>3 jaar</th><th>Aantal</th></tr></thead><tbody>' + rij('kopen') + rij('neutraal') + rij('vermijden') + '</tbody></table></div>' +
      '<p class="zacht">Kopen deed het gemiddeld beter en Vermijden slechter, maar dat komt vooral van een paar grote uitschieters: de helft van de Kopen-aandelen deed het na 1 jaar slechter dan gemiddeld (mediaan ' + tk(T.kopen.mediaan1) + '). Het verschil is te klein en de periode te kort om toeval uit te sluiten. Alleen fondsen van nu, jaarcijfers zoals nu bekend, geen kosten. Geen voorspelling.</p></details>';
  }
  function naicKaart(rec, b) {
    var n = b.naic;
    if (!n) return '';
    var kop = n.oordeel ? '<b class="groot-oordeel" data-oordeel="' + n.oordeel + '">' + OORDEEL[n.oordeel] + '</b>' : '<b class="groot-oordeel" data-oordeel="geen">Geen NAIC-oordeel</b>';
    var s = '<div class="kaart-plat" data-naic-kaart><div class="rij-kop"><h2>Oordeel</h2><span class="zacht">NAIC Stock Selection Guide</span></div>' + kop + '<p>' + h(n.reden || '') + '</p>';
    s += ladderHtml(n) + koopprijsHtml(n, rec.valuta) + gevoeligHtml(n) + versHtml(rec, b);
    if (n.oordeel) s += terugBlok(n.oordeel);
    var rij = function (a, v) { return '<tr><th scope="row">' + a + '</th><td>' + v + '</td></tr>'; };
    var t = '';
    if (n.groeiHistorisch !== null) t += rij('Groei winst per aandeel', pct(n.groeiHistorisch) + ' per jaar (trend ' + n.van + '–' + n.tot + ')' + (n.groeiEigen != null ? '; gerekend met <b>uw verwachting ' + pct(n.groeiEigen) + '</b>' + (n.groeiEigen > Naic.GROEI_MAX ? ' (hoger dan de ' + Naic.GROEI_MAX + '% die NAIC voorzichtig vindt)' : '') : n.groei !== null && n.groei < n.groeiHistorisch ? '; gerekend met ' + pct(n.groei) + ' (NAIC: voorzichtig, hoogstens ' + Naic.GROEI_MAX + '%)' : ''));
    if (n.kw) t += rij('Gemiddelde K/W', 'hoog ' + getal(n.kw.hoog, 1) + ' · laag ' + getal(n.kw.laag, 1) + ' (' + n.kw.jaren + ' jaar, ' + n.kw.van + '–' + n.kw.tot + ')' + (n.weggelaten && n.weggelaten.length ? '; ongewone jaren weggelaten: ' + n.weggelaten.join(', ') : ''));
    if (n.eps) t += rij('Winst per aandeel', 'laatste jaar ' + getal(n.eps, 2) + (n.epsLaag && n.epsLaag !== n.eps ? ' · laagste van 5 jaar ' + getal(n.epsLaag, 2) : ''));
    var z = n.zones;
    if (z) {
      t += rij('Verwacht over ' + n.horizon + ' jaar', 'hoog ' + geld(z.hoog) + ' · laag ' + geld(z.laag) + ' ' + h(rec.valuta));
      t += rij('Zones', 'kopen ' + geld(z.koop[0]) + '–' + geld(z.koop[1]) + ' · houden tot ' + geld(z.houd[1]) + ' · verkopen tot ' + geld(z.verkoop[1]));
      if (n.totaal) t += rij('Totaalrendement', pct(n.totaal.totaal) + ' per jaar (koers ' + pct(n.totaal.koers) + ' + dividend ' + (n.totaal.dividend !== null ? pct(n.totaal.dividend) : 'onbekend, 0%') + '); NAIC vraagt minstens ' + n.totaal.min + '%' + (n.totaal.ok ? ' ✓' : ' ✗'));
      if (n.relatief) t += rij('Relatieve waarde', 'K/W nu ' + getal(n.relatief.kwNu, 1) + ' tegen gemiddeld ' + getal(n.relatief.kwGem, 1) + ': <b>' + n.relatief.pct + '%</b> (' + { duur: 'duur ten opzichte van de eigen geschiedenis', laag: 'laag: ga na waarom', normaal: 'normaal' }[n.relatief.oordeel] + '; NAIC ziet het liefst ' + Naic.RV_LAAG + '–' + Naic.RV_HOOG + '%, telt niet mee)');
      if (n.par) t += rij('Verwacht gemiddeld rendement', pct(n.par.pct) + ' per jaar, als de K/W over 5 jaar op het gemiddelde (' + getal(n.relatief ? n.relatief.kwGem : 0, 1) + ') staat; koers dan ' + geld(n.par.koersDoel) + ' ' + h(rec.valuta) + ' (telt niet mee)');
      if (z.koers) t += rij('Koers nu', geld(z.koers) + ' ' + h(rec.valuta) + (z.verhouding !== null ? ' · opwaarts tegen neerwaarts ' + getal(z.verhouding, 1) + ' : 1' : '') + (z.rendementPerJaar !== null ? ' · tot de hoge koers ' + pct(z.rendementPerJaar) + ' per jaar' : ''));
    }
    s += '<div class="detail">';
    if (n.kwaliteit && n.kwaliteit.length) s += '<h3>Is het een goed bedrijf? <span class="zacht">(NAIC stap 1 en 2)</span></h3><ul class="methoden" data-naic-kwaliteit>' + n.kwaliteit.map(function (q) {
      return '<li data-toets="' + q.id + '">' + stip(q.ok === true ? 'gunstig' : q.ok === false ? 'ongunstig' : null, { omzet: 'Omzet en winst', marge: 'Marge vóór belasting', roe: 'Rendement op eigen vermogen' }[q.id]) +
        '<div><b>' + h({ omzet: 'Groeien omzet en winst gelijk op?', marge: 'Marge vóór belasting op peil?', roe: 'Rendement op eigen vermogen op peil?' }[q.id]) + '</b><br><span' + (q.ok === null ? ' class="zacht"' : '') + '>' + h(q.tekst) + '</span></div></li>';
    }).join('') + '</ul>';
    if (t) s += '<h3>Prijs <span class="zacht">(NAIC stap 3 tot 6)</span></h3><div class="schuif"><table class="vgl naic-tabel"><tbody>' + t + '</tbody></table></div>';
    if (n.groeiHistorisch !== null) s += '<div class="naic-groei" data-naic-groei><label for="ng-in">Uw groeiverwachting voor de winst per aandeel (% per jaar)</label><div class="knoppen" style="align-items:center">' +
      '<input id="ng-in" type="number" inputmode="decimal" step="0.5" min="-50" max="50" style="max-width:7em" value="' + (n.groeiEigen != null ? h(n.groeiEigen) : '') + '" placeholder="' + h(String(n.groei != null ? n.groei : '').replace('.', ',')) + '">' +
      '<button type="button" class="knop klein" id="ng-bewaar">Reken hiermee</button>' + (n.groeiEigen != null ? '<button type="button" class="knop rand klein" id="ng-wis">Terug naar de trend</button>' : '') + '</div>' +
      '<p class="zacht">In de echte NAIC-gids kiest u zelf een voorzichtige groei voor de komende 5 jaar; NAIC raadt aan niet hoger te gaan dan de groei uit het verleden en zelden boven 15%. Leeg = de app neemt de trend. Alleen op dit toestel.</p></div>';
    s += '</div><p class="zacht detail">NAIC kijkt eerst of het een goed groeibedrijf is (omzet en winst groeien gelijk op, marge en rendement houden stand) en dan naar de prijs ten opzichte van de eigen K/W-geschiedenis. Kopen = koers in de koopzone met minstens 3 : 1 opwaarts tegen neerwaarts, minstens ' + Naic.TOTAAL_MIN + '% totaalrendement per jaar, en geen kwaliteitstoets afgevallen. Automatisch berekend met voorzichtige aannames uit de jaarcijfers' + (b.niveau ? ' (' + h(Signaal.KWALITEIT[b.niveau] ? Signaal.KWALITEIT[b.niveau].naam : b.niveau) + ')' : '') + '. Eigen aannames kunt u invullen bij het tabblad NAIC.</p>' +
      '<div class="knoppen"><a class="knop rand klein" href="#/a/' + encodeURIComponent(rec.ticker) + '/waarde">Naar het tabblad NAIC</a></div></div>';
    return s;
  }
  function kansMethode() { try { var v = localStorage.getItem('as_kansrijk'); return v === 'app' || v === 'beide' ? v : 'naic'; } catch (e) { return 'naic'; } }
  function zetKansMethode(v) { try { localStorage.setItem('as_kansrijk', v); } catch (e) { /* standaard blijft */ } }
  function naicRang(b) { var n = b.naic; if (!n || !n.oordeel) return null; var k = { kopen: 3, neutraal: 2, vermijden: 1 }[n.oordeel], z = n.zones; return k + (z && z.verhouding !== null ? Math.min(z.verhouding, 50) / 100 : z && z.zone === 'onder' ? 0.5 : 0); }
  function kandidatenVolgens(lijst, m, max) {
    if (m === 'app') return Signaal.kandidaten(lijst, max);
    return lijst.filter(function (b) { return b.naic && b.naic.oordeel === 'kopen' && (m === 'naic' || b.oordeel === 'kopen'); })
      .sort(function (a, b) { return (naicRang(b) - naicRang(a)) || ((b.score || 0) - (a.score || 0)); }).slice(0, max || 8);
  }
  var KANS_NAAM = { app: 'App', naic: 'NAIC', beide: 'Beide' };
  function kansrijkHtml() {
    var lijst = DATA.aandelen.map(function (rec) { return signaalVoor(rec); }), m = kansMethode(), top = kandidatenVolgens(lijst, m, 5);
    var meer = kandidatenVolgens(lijst, m, 9999).length;
    var keuze = '<div class="regels" role="group" aria-label="Kansrijk volgens" data-kans-keuze>' + ['naic', 'app', 'beide'].map(function (k) {
      return '<button type="button" class="chip-knop" data-kans="' + k + '" aria-pressed="' + (k === m) + '">' + KANS_NAAM[k] + '</button>'; }).join('') + '</div>';
    var wat = { app: 'Kopen volgens de aanvullende zes metingen (geen NAIC).', naic: 'Oordeel Kopen volgens NAIC (koopzone, minstens 3 : 1 en ' + Naic.TOTAAL_MIN + '% per jaar).', beide: 'Kopen volgens de app én volgens NAIC.' }[m];
    var naarFondsen = '<div class="knoppen"><a class="knop rand klein" href="#/fondsen" data-naar-fondsen>Alle fondsen per index, op kansrijkheid</a></div>';
    var kop = '<div class="rij-kop"><h2>Beste kansen</h2><a class="link" href="#/fondsen">Alle fondsen</a></div>' + keuze + '<p class="zacht">' + wat + '</p>';
    if (!top.length) return kop + '<div class="kaart-plat" data-kansrijk><p>Nu voldoet geen aandeel hieraan.</p></div>' + naarFondsen;
    return kop + '<div class="lijst" data-kansrijk>' + top.map(function (b) {
      var rec = zoek(b.ticker);
      return '<a href="#/a/' + encodeURIComponent(b.ticker) + '"><div class="tekstkolom"><b>' + h(rec.naam) + '</b><span class="zacht">' + h([rec.ticker, sectorVan(rec), telTekst(b)].filter(Boolean).join(' · ')) + '</span>' + oordeelRij(b) + '</div>' + I.pijl.replace('class="pijl"', 'width="18" height="18"') + '</a>';
    }).join('') + '</div><p class="zacht">' + (meer > top.length ? 'De ' + top.length + ' sterkste van ' + meer + '. ' : '') + (m === 'app' ? 'Volgorde: hoogste gemiddelde van de zes metingen.' : 'Volgorde: meeste opwaarts tegen neerwaarts volgens NAIC.') + '</p>' + naarFondsen;
  }
  function kansKoppel() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-kans]'), function (bt) {
      bt.addEventListener('click', function () { zetKansMethode(bt.getAttribute('data-kans')); route(); });
    });
  }
  /* Overzicht over alle fondsen: per meting hoeveel fondsen het gegeven hebben, en waarom het ontbreekt. */
  function datasetOverzicht(items) {
    var K = Signaal.KERN, per = K.map(function () { return { aan: 0, kan: 0, red: {} }; }), oo = { kopen: 0, neutraal: 0, vermijden: 0, geen: 0 };
    items.forEach(function (a) {
      oo[a.b.oordeel || 'geen']++;
      a.b.metingen.forEach(function (m, i) { if (m.nvt) return; per[i].kan++; if (m.aanwezig) per[i].aan++; else { var r = String(m.reden).replace(/ in \d{4} /, ' in een jaar '); per[i].red[r] = (per[i].red[r] || 0) + 1; } });
    });
    return '<details class="uitleg" data-dataset><summary>Welke gegevens zijn er, en wat ontbreekt?</summary>' +
      '<p>Van de ' + items.length + ' fondsen hebben er ' + (items.length - oo.geen) + ' een oordeel: ' + oo.kopen + '× Kopen, ' + oo.neutraal + '× Neutraal, ' + oo.vermijden + '× Vermijden. Bij ' + oo.geen + ' zijn er te weinig metingen.</p>' +
      (function () {
        var nk = { kopen: 0, neutraal: 0, vermijden: 0 }, red = {}, geen = 0;
        items.forEach(function (a) { var n = a.b.naic; if (n && n.oordeel) nk[n.oordeel]++; else { geen++; var r = String(n && n.reden || 'Geen gegevens.').replace(/\d{4}/g, 'een jaar'); red[r] = (red[r] || 0) + 1; } });
        var top = Object.keys(red).sort(function (x, y) { return red[y] - red[x]; })[0];
        return '<p data-dataset-naic>NAIC: ' + (items.length - geen) + ' fondsen met een oordeel (' + nk.kopen + '× Kopen, ' + nk.neutraal + '× Neutraal, ' + nk.vermijden + '× Vermijden). Zonder NAIC-oordeel: ' + geen + (top ? ', vooral omdat: ' + h(top.charAt(0).toLowerCase() + top.slice(1).replace(/\.$/, '')) + ' (' + red[top] + '×)' : '') + '.</p>';
      })() +
      '<ul class="dataset">' + K.map(function (k, i) {
        var p = per[i], top = Object.keys(p.red).sort(function (x, y) { return p.red[y] - p.red[x]; })[0], pc = p.kan ? Math.round(p.aan / p.kan * 100) : 0;
        return '<li data-dataset-meting="' + k.id + '"><div class="ds-kop"><b>' + h(k.kort) + (k.bankKort ? ' <span class="zacht">(banken en verzekeraars: ' + h(k.bankKort.toLowerCase()) + ')</span>' : '') + '</b><span><b>' + p.aan + '</b> van ' + p.kan + '</span></div>' +
          '<span class="balk" aria-hidden="true"><i style="width:' + pc + '%"></i></span>' + (top ? '<span class="zacht">Ontbreekt vooral omdat: ' + h(top.charAt(0).toLowerCase() + top.slice(1)) + ' (' + p.red[top] + '×)</span>' : '') + '</li>';
      }).join('') + '</ul></details>';
  }
  /* Korte sector voor lijsten: de kortste omschrijving uit Wikidata, met hoofdletter. */
  function sectorVan(rec) {
    var x = rec && rec.bedrijf, l = x && Array.isArray(x.sector) ? x.sector.filter(function (s) { return typeof s === 'string' && s; }) : [];
    if (!l.length) return '';
    var straf = function (x) { return x.length + (/^(vervaardiging|groothandel|overige|holding)/i.test(x) ? 100 : 0); };
    var s = l.slice().sort(function (a, b) { return straf(a) - straf(b); })[0];
    if (s.length > 40) s = s.slice(0, 38).replace(/[\s,]+\S*$/, '') + '…';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  /* Over het bedrijf: korte beschrijving uit Wikipedia (CC BY-SA) en vaste gegevens uit Wikidata (CC0), met bronvermelding. */
  function bedrijfBlok(rec) {
    var x = rec.bedrijf;
    if (!x || !(x.beschrijving || x.sector)) return '';
    var feiten = [['Sector', (x.sector || []).join(', ')], ['Hoofdkantoor', x.hoofdkantoor], ['Opgericht', x.opgericht], ['Beurs', (rec.indices || []).map(function (i) { return INDEX_NAAM[i] || i; }).join(', ')]].filter(function (f) { return f[1]; });
    var web = x.website && /^https?:\/\//.test(x.website) ? '<a href="' + h(x.website) + '" target="_blank" rel="noopener">' + h(x.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')) + '</a>' : '';
    return '<div class="kaart-plat" data-bedrijf><h2>Over het bedrijf</h2>' + (x.beschrijving ? '<p' + (x.taal && x.taal !== 'nl' ? ' lang="' + h(x.taal) + '"' : '') + '>' + h(x.beschrijving) + '</p>' : '') +
      (feiten.length ? '<dl class="feiten">' + feiten.map(function (f) { return '<dt>' + h(f[0]) + '</dt><dd>' + h(f[1]) + '</dd>'; }).join('') + '</dl>' : '') + (web ? '<p>' + web + '</p>' : '') +
      '<p class="zacht">Bron: ' + (x.wikipedia ? '<a href="' + h(x.wikipedia) + '" target="_blank" rel="noopener">Wikipedia</a> (CC BY-SA)' : 'Wikipedia') + (x.taal === 'en' ? ', Engelstalig artikel' : '') + ' en Wikidata. Algemene informatie, niet gecontroleerd door de app.</p></div>';
  }
  function getal(n, dec) { return typeof n === 'number' && isFinite(n) ? n.toLocaleString('nl-NL', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec == null ? 0 : dec }) : '–'; }
  function mld(n) { return typeof n === 'number' ? getal(n / 1e9, 1) + ' mld' : '–'; }
  function datumNl(s) { var t = Gate.parseDay(s); return t !== null ? new Date(t).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : (s || 'onbekend'); }
  function pct(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + getal(Math.abs(n), 1) + '%'; }
  function zoek(t) { for (var i = 0; i < DATA.aandelen.length; i++) if (DATA.aandelen[i].ticker === t) return DATA.aandelen[i]; return null; }

  var I = {
    pijl: '<svg class="pijl" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    vink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    wacht: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    print: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>',
    ster: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z"/></svg>',
    terug: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>'
  };
  var PADEN = {
    start: 'M4 11l8-7 8 7v9H5z', zoek: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M20 20l-4-4',
    portefeuille: 'M4 8h16v11H4z M9 8V5h6v3 M4 13h16',
    volglijst: 'M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z',
    hulp: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7 M12 17h.01',
    samenvatting: 'M5 4h14v16H5z M9 9h6 M9 13h6', koers: 'M4 17l5-5 4 4 7-8',
    waarde: 'M12 3v18 M16 7.5c0-1.4-1.8-2.5-4-2.5s-4 1.1-4 2.5 1.8 2.5 4 2.5 4 1.1 4 2.5-1.8 2.5-4 2.5-4-1.1-4-2.5',
    check: 'M5 5h14v14H5z M8.5 12.5l2.5 2.5 4.5-5',
    gezondheid: 'M3 12h4l3-7 4 14 3-7h4', bronnen: 'M5 5h10a4 4 0 0 1 4 4v10H9a4 4 0 0 1-4-4z M9 9h6'
  };
  function menuHtml(items, actief) {
    return items.map(function (m) {
      return '<a href="' + m[0] + '"' + (m[0] === actief ? ' aria-current="page"' : '') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + PADEN[m[2]] + '"/></svg>' + h(m[1]) + '</a>';
    }).join('');
  }

  function rijen() { var t = vandaag(); return DATA.aandelen.map(function (r) { return Gate.maakRij(r, t); }); }
  function chip(ok, niveau) { return ok ? '<span class="chip ok">✓ Bevestigd</span>' : (niveau === 'jaarverslag' ? '<span class="chip" data-niveau="jaarverslag">Uit jaarverslag</span>' : niveau === 'indicatief' ? '<span class="chip" data-niveau="indicatief">Indicatief</span>' : '<span class="chip wacht">… Nog niet bevestigd</span>'); }
  function trendTekst(r) {
    if (!r.koersActueel) return r.koersReden ? 'Koers ontbreekt of is verouderd' : '';
    return (r.richting === 'boven' ? 'Boven' : 'Onder') + ' gemiddelde, ' + pct(r.afstandPct);
  }
  function regel2(rec, r) { return h(rec.land + ' · ' + (r.koersActueel ? 'koers actueel' : 'geen actuele koers') + (r.richting ? ' · ' + (r.richting === 'boven' ? 'boven' : 'onder') + ' gemiddelde' : '')); }
  function rijLink(rec, r) {
    return '<a href="#/a/' + encodeURIComponent(rec.ticker) + '"><div class="tekstkolom"><b>' + h(rec.naam) + '</b><span class="zacht">' + regel2(rec, r) + '</span></div>' + chip(r.bevestigd, r.niveau) + I.pijl.replace('class="pijl"', 'width="18" height="18"') + '</a>';
  }
  function kaartLink(rec, r) {
    return '<a class="kaart" href="#/a/' + encodeURIComponent(rec.ticker) + '"><b>' + h(rec.ticker) + '</b><span class="zacht">' + h(rec.naam) + '</span>' + chip(r.bevestigd, r.niveau) + '<span>' + h(trendTekst(r)) + '</span>' + I.pijl + '</a>';
  }

  /* ---- Signalen volgens NAIC (bij uw eigen aandelen, en wat er veranderde sinds de vorige update) ---- */
  var SIGNAAL_NAAM = { koop: 'Koopzone', verkoop: 'Verkoopzone', kwaliteit: 'Kwaliteit daalt', groei: 'Te weinig groei' };
  function signaalRegel(b) {
    var sg = Signalen.naicSignaal(b);
    return sg ? '<span class="signaal" data-signaal-soort="' + sg.soort + '"><b>' + SIGNAAL_NAAM[sg.soort] + ':</b> ' + h(sg.tekst) + '</span>' : '';
  }
  function eigenTickers() {
    var o = {};
    winkel.portefeuille().forEach(function (p) { o[p.ticker] = 'portefeuille'; });
    winkel.volglijst().forEach(function (v) { if (!o[v.ticker]) o[v.ticker] = 'volglijst'; });
    return o;
  }
  function naicVorig(nieuw) {
    try {
      if (nieuw !== undefined) { localStorage.setItem('as_naic_vorig', JSON.stringify(nieuw)); return nieuw; }
      return JSON.parse(localStorage.getItem('as_naic_vorig') || 'null');
    } catch (e) { return null; }
  }
  function signalenHtml() {
    var items = fondsItems(), per = {}; items.forEach(function (a) { per[a.ticker] = a; });
    var eigen = eigenTickers(), datum = String(DATA.gemaakt || '').slice(0, 10);
    var eigenSig = Object.keys(eigen).map(function (t) { var a = per[t]; return a ? { a: a, sg: Signalen.naicSignaal(a.b), waar: eigen[t] } : null; })
      .filter(function (x) { return x && x.sg; });
    var volg = { verkoop: 0, kwaliteit: 1, koop: 2, groei: 3 };
    eigenSig.sort(function (x, y) { return volg[x.sg.soort] - volg[y.sg.soort] || x.a.naam.localeCompare(y.a.naam); });
    var r = Signalen.bijwerken(naicVorig(), datum, Signalen.oordelen(items.map(function (a) { return a.b; })));
    naicVorig(r.opslag);
    var ver = Signalen.veranderingen(r.basis, r.opslag.laatst ? r.opslag.laatst.oordelen : {}).filter(function (v) { return v.naar === 'kopen' || v.naar === 'vermijden' || eigen[v.ticker]; });
    var regel = function (a, tekst, extra) {
      return '<a href="#/a/' + encodeURIComponent(a.ticker) + '"><div class="tekstkolom"><b>' + h(a.naam) + '</b><span class="zacht">' + h(a.ticker + (extra ? ' · ' + extra : '')) + '</span>' + tekst + '</div>' + I.pijl.replace('class="pijl"', 'width="18" height="18"') + '</a>';
    };
    var s = '<section id="signalen" data-signalen><div class="rij-kop"><h2>Signalen</h2><span class="zacht">volgens NAIC</span></div>';
    var aantalEigen = Object.keys(eigen).length;
    s += '<h3 class="tussenkop">Uw aandelen</h3>';
    if (!aantalEigen) s += '<div class="kaart-plat"><p class="zacht">Zet aandelen op uw volglijst of in uw portefeuille; dan ziet u hier wanneer ze in de koop- of verkoopzone komen.</p></div>';
    else if (!eigenSig.length) s += '<div class="kaart-plat" data-geen-signaal><p>Geen signalen bij uw ' + aantalEigen + ' aandelen: ze staan in de houdzone of hebben (nog) geen NAIC-oordeel.</p></div>';
    else s += '<div class="lijst" data-eigen-signalen>' + eigenSig.map(function (x) { return regel(x.a, signaalRegel(x.a.b), x.waar === 'portefeuille' ? 'in portefeuille' : 'op volglijst'); }).join('') + '</div>';
    s += '<h3 class="tussenkop">Nieuw sinds de vorige update' + (r.basis ? ' <span class="zacht">(' + h(datumNl(r.basis.datum)) + ')</span>' : '') + '</h3>';
    if (!r.basis) s += '<div><p class="zacht">Vanaf de volgende gegevensupdate ziet u hier welke fondsen naar NAIC Kopen of Vermijden gingen. Dit wordt alleen op dit toestel bijgehouden.</p></div>';
    else if (!ver.length) s += '<div class="kaart-plat" data-geen-verandering><p>Geen fondsen van oordeel veranderd naar Kopen of Vermijden.</p></div>';
    else {
      var kort = ver.slice(0, 10);
      s += '<div class="lijst" data-veranderingen>' + kort.map(function (v) {
        var a = per[v.ticker] || { ticker: v.ticker, naam: (zoek(v.ticker) || {}).naam || v.ticker };
        var tekst = '<span class="signaal" data-naar="' + (v.naar || 'geen') + '">NAIC ' + (v.van ? h(Signalen.OORDEEL[v.van]) : 'geen oordeel') + ' → <b>' + (v.naar ? h(Signalen.OORDEEL[v.naar]) : 'geen oordeel') + '</b></span>';
        return regel(a, tekst, eigen[v.ticker] ? (eigen[v.ticker] === 'portefeuille' ? 'in portefeuille' : 'op volglijst') : '');
      }).join('') + '</div>' + (ver.length > kort.length ? '<p class="zacht">En nog ' + (ver.length - kort.length) + ' andere. Zie Fondsen voor alles.</p>' : '');
    }
    return s + '<details class="uitleg"><summary>Wat betekenen de signalen?</summary><p>Koopzone: koers in het onderste derde van het verwachte bereik met minstens 3 : 1. Verkoopzone: bovenste derde. NAIC verkoopt ook als de kwaliteit terugloopt. Selectiehulp, geen beleggingsadvies.</p></details></section>';
  }

  var HOOFD = [['#/', 'Start', 'start'], ['#/fondsen', 'Fondsen', 'zoek'], ['#/volglijst', 'Volglijst', 'volglijst'], ['#/portefeuille', 'Portefeuille', 'portefeuille']];

  /* ---- Start als cockpit: eerst het geheel (portefeuille, actie, kansen, markt), van daaruit inzoomen ---- */
  function eigenSignalen() {
    var per = {}; fondsItems().forEach(function (a) { per[a.ticker] = a; });
    var eigen = eigenTickers();
    return Object.keys(eigen).map(function (t) { var a = per[t]; return a ? { a: a, sg: Signalen.naicSignaal(a.b), waar: eigen[t] } : null; }).filter(function (x) { return x && x.sg; });
  }
  function tegelsHtml() {
    var pos = winkel.portefeuille(), res = Portefeuille.waardeer(pos, DATA.aandelen, vandaag(), Gate);
    var items = fondsItems(), nk = { kopen: 0, neutraal: 0, vermijden: 0 }, onderKp = 0;
    items.forEach(function (a) { var n = a.b.naic; if (n && n.oordeel) nk[n.oordeel]++; if (n && n.oordeel === 'kopen' && a.koopAfstand != null && a.koopAfstand <= 0) onderKp++; });
    var sig = eigenSignalen(), telS = { koop: 0, verkoop: 0, kwaliteit: 0, groei: 0 }; sig.forEach(function (x) { telS[x.sg.soort]++; });
    var pf = res.totalen.filter(function (t) { return t.meegeteld; })[0];
    var t1 = '<a class="tegel" href="#/portefeuille" data-tegel="portefeuille"><small>Portefeuille</small>' + (pf
      ? '<b>' + getal(pf.waarde, 0) + ' <span class="munt">' + h(pf.valuta) + '</span></b><span class="rend" data-teken="' + (pf.winst > 0 ? 'plus' : pf.winst < 0 ? 'min' : 'nul') + '">' + (pf.pct != null ? pct(pf.pct) + ' · ' : '') + (pf.winst >= 0 ? '+' : '−') + getal(Math.abs(pf.winst), 0) + ' ' + h(pf.valuta) + '</span>' + (res.totalen.length > 1 ? '<span class="zacht">+ ' + (res.totalen.length - 1) + ' andere valuta</span>' : '')
      : '<b>–</b><span class="zacht">' + (pos.length ? 'Nog geen actuele waarde' : 'Nog geen aankopen') + '</span>') + '</a>';
    var urgent = telS.verkoop + telS.kwaliteit;
    var t2 = '<a class="tegel" href="#/" data-spring="signalen" data-tegel="actie" data-niveau="' + (urgent ? 'let-op' : telS.koop ? 'kans' : 'rustig') + '"><small>Actie bij uw aandelen</small><b>' + sig.filter(function (x) { return x.sg.soort !== 'groei'; }).length + '</b><span>' +
      (urgent || telS.koop ? [telS.verkoop ? telS.verkoop + '× verkoopzone' : '', telS.kwaliteit ? telS.kwaliteit + '× kwaliteit daalt' : '', telS.koop ? telS.koop + '× koopzone' : ''].filter(Boolean).join(' · ') : 'Alles rustig') + '</span></a>';
    var t3 = '<a class="tegel" href="#/" data-spring="kansen" data-tegel="kansen"><small>Kansen (NAIC Kopen)</small><b>' + nk.kopen + '</b><span>' + (onderKp ? onderKp + ' onder hun koopprijs' : 'van ' + (nk.kopen + nk.neutraal + nk.vermijden) + ' met oordeel') + '</span></a>';
    return '<div class="tegels" data-tegels>' + t1 + t2 + t3 + '</div>';
  }
  function marktbeeldHtml() {
    var per = {}, alles = { kopen: 0, neutraal: 0, vermijden: 0, geen: 0, n: 0 };
    fondsItems().forEach(function (a) {
      var o = a.b.naic && a.b.naic.oordeel || 'geen';
      Dashboard.indexGroepen(a).forEach(function (g) { var p = per[g] || (per[g] = { kopen: 0, neutraal: 0, vermijden: 0, geen: 0, n: 0 }); p[o]++; p.n++; });
      alles[o]++; alles.n++;
    });
    var VOLG = ['AEX', 'AMX', 'BEL20', 'CAC40', 'DAX', 'FTSE', 'IBEX', 'MIB', 'VS', 'OVERIG'];
    var namen = Object.keys(per).sort(function (x, y) { var i = VOLG.indexOf(x), j = VOLG.indexOf(y); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });
    function balk(naam, p, ix) {
      var d = ['kopen', 'neutraal', 'vermijden', 'geen'].map(function (o) { return p[o] ? '<i data-o="' + o + '" style="flex:' + p[o] + '"></i>' : ''; }).join('');
      var titel = p.kopen + ' Kopen, ' + p.neutraal + ' Neutraal, ' + p.vermijden + ' Vermijden, ' + p.geen + ' zonder oordeel';
      return '<a class="markt-rij" href="#/fondsen" data-naar-index="' + h(ix) + '" aria-label="' + h(naam + ': ' + titel) + '"><span class="markt-naam">' + h(naam) + '</span><span class="markt-balk" title="' + h(titel) + '">' + d + '</span><span class="markt-tal"><b>' + p.kopen + '</b>/' + p.n + '</span></a>';
    }
    return '<section data-marktbeeld><div class="rij-kop"><h2>Marktbeeld</h2><span class="zacht">NAIC-oordeel per index</span></div><div class="kaart-plat markt">' +
      balk('Alle fondsen', alles, '') + namen.map(function (g) { return balk((INDEX_NAAM[g] || g).replace(/ \(.*\)$/, ''), per[g], g); }).join('') +
      '<div class="markt-legenda" aria-hidden="true"><span><i data-o="kopen"></i>Kopen</span><span><i data-o="neutraal"></i>Neutraal</span><span><i data-o="vermijden"></i>Vermijden</span><span><i data-o="geen"></i>Geen oordeel</span></div></div>' +
      '<p class="zacht">Het getal is het aantal fondsen met NAIC Kopen. Tik op een index om de fondsen te zien.</p></section>';
  }
  function marktKoppel() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-spring]'), function (a) {
      a.addEventListener('click', function (e) { var d = document.getElementById(a.getAttribute('data-spring')); if (d) { e.preventDefault(); d.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-naar-index]'), function (a) {
      a.addEventListener('click', function () { fondsKeuze.index = a.getAttribute('data-naar-index'); fondsKeuze.sorteer = 'naicRang'; });
    });
  }
  function statusRegel() {
    var R = rijen(), ok = R.filter(function (r) { return r.bevestigd; }).length;
    return '<p class="status-regel" data-status-regel>Gegevens van ' + h(datumNl(String(DATA.gemaakt || '').slice(0, 10))) + ' · ' + ok + ' van ' + R.length + ' aandelen volledig bevestigd · <a href="#/hulp">Hoe werkt het?</a></p>';
  }
  function schermStart() {
    var R = rijen(), by = {}; R.forEach(function (r) { by[r.ticker] = r; });
    var vol = winkel.volglijst().map(function (v) { return zoek(v.ticker); }).filter(Boolean);
    var s = '<section class="cockpit"><div class="rij-kop"><h1>Overzicht</h1><span class="zacht">' + h(datumNl(String(DATA.gemaakt || '').slice(0, 10))) + '</span></div>' + tegelsHtml() + '</section>';
    s += signalenHtml();
    s += '<section id="kansen" data-kansen>' + kansrijkHtml() + '</section>';
    s += marktbeeldHtml();
    s += dashboardHtml(R);
    s += '<section><div class="rij-kop"><h2>Mijn volglijst</h2><a class="link" href="#/volglijst">Alles zien</a></div>';
    s += vol.length ? '<div class="kaarten">' + vol.slice(0, 6).map(function (rec) { return kaartLink(rec, by[rec.ticker]); }).join('') + '</div>' + (vol.length > 6 ? '<p class="zacht">En nog ' + (vol.length - 6) + '. Zie Volglijst.</p>' : '')
      : '<div class="kaart-plat"><p>Uw volglijst is nog leeg. Open een aandeel en kies “Op mijn volglijst”.</p><div class="knoppen"><a class="knop" href="#/fondsen">Fondsen bekijken</a></div></div>';
    s += '</section>' + statusRegel();
    return s + backupBalk();
  }

  var tabelKeuze = { alleenBevestigd: false, trend200: '', index: '', sorteer: 'naam', richting: 'op' };
  var TABEL_KOP = { naam: 'Aandeel', afstandPct: 'Afstand tot gemiddelde', omzetgroei: 'Omzetgroei p.j.', epsgroei: 'Winstgroei p.j.', nettomarge: 'Nettomarge', positiePct: 'Plek in koersbereik (laag naar hoog)', verhouding: 'Opwaarts tegen neerwaarts' };
  function dashboardHtml(R) {
    var pos = winkel.portefeuille(), res = Portefeuille.waardeer(pos, DATA.aandelen, vandaag(), Gate), sp = Dashboard.spreiding(res.regels, DATA.aandelen);
    var volT = winkel.volglijst().map(function (v) { return v.ticker; }), a = Dashboard.aandacht(R, volT, res.regels);
    var s = '<section id="dash"><h2>Dashboard <span class="zacht">portefeuille en volglijst</span></h2><div class="kpis">';
    s += '<div class="kpi"><b>' + (a.volglijst ? a.verouderdVolglijst + ' / ' + a.volglijst : '–') + '</b><span>Volglijst zonder actuele koers</span></div>';
    var ck = Dashboard.checklistStand(volT, function (t) { return winkel.checklist(t); }, Checklist.voortgang);
    if (ck.volglijst) s += '<a class="kpi" data-checklist-stand href="#/volglijst" style="text-decoration:none;color:inherit"><b>' + ck.klaar + ' / ' + ck.volglijst + '</b><span>Volglijst met volledig ingevulde checklist' + (ck.bezig ? ' (' + ck.bezig + ' bezig)' : '') + '</span></a>';
    if (a.positiesZonderWaarde) s += '<a class="kpi" href="#/portefeuille" style="text-decoration:none;color:inherit"><b>' + a.positiesZonderWaarde + '</b><span>Aankopen zonder waarde: zie portefeuille</span></a>';
    s += '</div>';
    if (sp.length) {
      s += '<h3>Spreiding per land</h3>' + sp.map(function (v) {
        return '<div class="kaart-plat" data-spreiding="' + h(v.valuta) + '"><b>' + h(v.valuta) + '</b>' + v.delen.map(function (d) {
          return '<div class="balk-rij"><span>' + h(d.land) + '</span><span class="balk" aria-hidden="true"><i style="width:' + Math.max(2, d.pct) + '%"></i></span><b>' + getal(d.pct, 0) + '%</b></div>';
        }).join('') + '</div>';
      }).join('') + (sp.length > 1 ? '<p class="zacht">Per valuta apart; de app rekent niet om.</p>' : '');
    }
    var zo = Dashboard.zoneOverzicht(winkel.alleZones(), DATA.aandelen, vandaag(), Gate, Naic);
    if (zo.length) {
      var ZT = { koop: 'in uw positieve zone', houd: 'in uw neutrale zone', verkoop: 'in uw zone om te vermijden', onder: 'onder uw lage koers', boven: 'boven uw hoge koers' };
      s += '<h3>Mijn koerszones</h3><div class="lijst" data-zones>' + zo.map(function (z) {
        return '<a href="#/a/' + encodeURIComponent(z.ticker) + '/waarde"><div class="tekstkolom"><b>' + h(z.naam) + '</b><span class="zacht">' + (z.zone ? h(ZT[z.zone] || z.zone) + (z.verhouding ? ' · opwaarts/neerwaarts ' + getal(z.verhouding, 1) + ' : 1' : '') : h(z.reden)) + '</span></div>' + I.pijl.replace('class="pijl"', 'width="18" height="18"') + '</a>';
      }).join('') + '</div><p class="zacht">Uw eigen aannames, geen koersdoel of advies. Zonder bevestigde gegevens en actuele koers staat er geen zone.</p>';
    }
    var vol = winkel.volglijst().map(function (v) { return zoek(v.ticker); }).filter(Boolean);
    if (!vol.length) return s + '</section>';      // alle fondsen staan onder Fondsen; hier alleen de eigen volglijst
    var bron = vol, vandaagD = vandaag();
    var kanten = bron.map(function (rec) { return Vergelijk.kant(rec, vandaagD, Gate); });
    var rijenT = Dashboard.tabel(kanten, tabelKeuze), totaalT = rijenT.length, beperktT = !vol.length && totaalT > 60 && !tabelKeuze.index && !tabelKeuze.trend200 && !tabelKeuze.alleenBevestigd;
    if (beperktT) rijenT = rijenT.slice(0, 60);
    function c(v, nul) { return v == null ? '<span class="zacht" title="Onbekend of niet bevestigd">–</span>' : nul(v); }
    s += '<h3>' + (vol.length ? 'Mijn volglijst in cijfers' : 'Alle aandelen in cijfers') + '</h3><div class="knoppen" style="align-items:center">' +
      '<label class="vink"><input type="checkbox" id="d-bev"' + (tabelKeuze.alleenBevestigd ? ' checked' : '') + '> Alleen bevestigd</label>' +
      '<label for="d-index" class="zacht">Index</label><select id="d-index"><option value="">Alle</option>' + indexLijst().map(function (i) { return '<option value="' + h(i) + '"' + (tabelKeuze.index === i ? ' selected' : '') + '>' + h(INDEX_NAAM[i] || i) + '</option>'; }).join('') + '</select>' +
      '<label for="d-trend" class="zacht">Trend 200 dagen</label><select id="d-trend"><option value=""' + (!tabelKeuze.trend200 ? ' selected' : '') + '>Alle</option><option value="onder"' + (tabelKeuze.trend200 === 'onder' ? ' selected' : '') + '>Koers eronder</option><option value="boven"' + (tabelKeuze.trend200 === 'boven' ? ' selected' : '') + '>Koers erboven</option></select>' +
      '<label for="d-sort" class="zacht">Sorteer op</label><select id="d-sort">' + Dashboard.KOLOMMEN.map(function (k) { return '<option value="' + k + '"' + (k === tabelKeuze.sorteer ? ' selected' : '') + '>' + h(TABEL_KOP[k]) + '</option>'; }).join('') + '</select>' +
      '<button class="knop rand klein" id="d-rtg" aria-label="Sorteervolgorde omdraaien">' + (tabelKeuze.richting === 'op' ? '↑ Oplopend' : '↓ Aflopend') + '</button></div>';
    s += rijenT.length ? '<div class="schuif"><table class="vgl dash"><thead><tr><th>Aandeel</th><th>Koers vs gem.</th><th>Omzet p.j.</th><th>Winst p.j.</th><th>Marge</th></tr></thead><tbody>' + rijenT.map(function (k) {
      return '<tr><th scope="row"><a href="#/a/' + encodeURIComponent(k.ticker) + '">' + h(k.naam) + '</a><br>' + chipKort(k.bevestigd, k.niveau) + ' ' + stippen(signaalVoor(zoek(k.ticker)), true) + (k.positiePct != null ? '<br><span class="zacht" data-plek>Plek in bereik ' + getal(k.positiePct, 0) + '%' + (k.verhouding != null ? ' · ' + getal(k.verhouding, 1) + ' : 1' : '') + '</span>' : '') + '</th><td>' + c(k.afstandPct, pct) + '</td><td>' + c(k.omzetgroei, pct) + '</td><td>' + c(k.epsgroei, pct) + '</td><td>' + c(k.nettomarge, function (v) { return getal(v, 1) + '%'; }) + '</td></tr>';
    }).join('') + '</tbody></table></div><p class="zacht">Groei en marge staan er bij bevestigde aandelen en bij aandelen "uit jaarverslag" (cijfers uit het officiële jaarverslag, niet nagerekend). Een streepje betekent onbekend. Dit is geen rangorde of advies.</p>' + (beperktT ? '<p class="zacht" data-beperkt>De eerste 60 van ' + totaalT + ' aandelen. Kies een index of een filter om de rest te zien.</p>' : '')
      : '<div class="kaart-plat"><p>Geen aandelen die aan dit filter voldoen.</p></div>';
    return s + '</section>';
  }
  function dashboardKoppel() {
    var b = document.getElementById('d-bev'), so = document.getElementById('d-sort'), r = document.getElementById('d-rtg');
    kansKoppel(); marktKoppel();
    if (!b) return;
    b.addEventListener('change', function () { tabelKeuze.alleenBevestigd = b.checked; route(); });
    so.addEventListener('change', function () { tabelKeuze.sorteer = so.value; route(); });
    document.getElementById('d-index').addEventListener('change', function (e) { tabelKeuze.index = e.target.value; route(); });
    document.getElementById('d-trend').addEventListener('change', function (e) { tabelKeuze.trend200 = e.target.value; route(); });
    r.addEventListener('click', function () { tabelKeuze.richting = tabelKeuze.richting === 'op' ? 'af' : 'op'; route(); });
  }
  function backupBalk() {
    if (!winkel.backupNodig(vandaag())) return '';
    return '<div class="melding"><b>Maak een back-up van uw gegevens</b><span>Uw gegevens staan alleen op dit toestel. Met een back-up raakt u niets kwijt.</span><a class="knop klein" href="#/instellingen">Back-up maken</a></div>';
  }
  function volgRegel(item, rec) {
    var f = Portefeuille.volg(item, rec, vandaag(), Gate), s = item && item.sinds, nu = signaalVoor(rec);
    var tekst = f.status === 'ok' ? 'Sinds ' + h(datumNl(s.datum)) + ' (' + f.dagen + ' dagen): <b style="color:' + kleur(f.pct) + '">' + pct(f.pct) + '</b>' : (f.status === 'geen' ? 'Geen startpunt vastgelegd' : 'Sinds het volgen: onbekend (' + h(f.reden) + ')');
    var toen = s ? 'Oordeel toen: ' + h(oordeelTekst(s)) + ' · nu: ' + h(oordeelTekst(nu)) : 'Oordeel nu: ' + h(oordeelTekst(nu));
    return '<div class="volg-info" data-volg="' + h(rec.ticker) + '" ><span class="oordeel-rij">' + naicChip(nu) + '</span>' + signaalRegel(nu) + '<span class="zacht">' + tekst + '<br>' + toen + '</span></div>';
  }
  function volgSortering() { try { return localStorage.getItem('as_volgsort') === 'koop' ? 'koop' : 'toegevoegd'; } catch (e) { return 'toegevoegd'; } }
  function volgKoppel() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-volgsort]'), function (bt) {
      bt.addEventListener('click', function () { try { localStorage.setItem('as_volgsort', bt.getAttribute('data-volgsort')); } catch (e) { /* standaard */ } route(); });
    });
  }
  function schermVolglijst() {
    var R = {}; rijen().forEach(function (r) { R[r.ticker] = r; });
    var v = winkel.volglijst().map(function (x) { return zoek(x.ticker); }).filter(Boolean);
    var items = {}; winkel.volglijst().forEach(function (x) { items[x.ticker] = x; });
    var opKoop = volgSortering() === 'koop';
    if (opKoop) {
      var afst = {}; v.forEach(function (rec) { var n = signaalVoor(rec).naic; afst[rec.ticker] = n && n.koopprijs && n.koopprijs.afstand != null ? n.koopprijs.afstand : null; });
      v = v.slice().sort(function (a, b) { var x = afst[a.ticker], y = afst[b.ticker]; return x === y ? 0 : x === null ? 1 : y === null ? -1 : x - y; });
    }
    var keuze = v.length > 1 ? '<div class="regels" role="group" aria-label="Volgorde" data-volg-sort>' + [['toegevoegd', 'Zoals toegevoegd'], ['koop', 'Dichtst bij koopprijs']].map(function (x) {
      return '<button type="button" class="chip-knop" data-volgsort="' + x[0] + '" aria-pressed="' + ((x[0] === 'koop') === opKoop) + '">' + x[1] + '</button>'; }).join('') + '</div>' : '';
    return '<section><h1>Mijn volglijst</h1>' + keuze + (v.length ? '<div class="lijst">' + v.map(function (rec) { return rijLink(rec, R[rec.ticker]) + volgRegel(items[rec.ticker], rec); }).join('') + '</div><p class="zacht">Onder elk aandeel staat wat de koers deed sinds u het ging volgen, en wat het oordeel van de app toen was. Zo ziet u of een kandidaat potentie laat zien.</p>' :
      '<div class="kaart-plat"><p>Nog niets op uw volglijst.</p><div class="knoppen"><a class="knop" href="#/fondsen">Fondsen bekijken</a></div></div>') + '</section>' + backupBalk();
  }
  var fondsKeuze = { zoek: '', index: '', weergave: 'index', sorteer: 'naicRang', alleenBevestigd: false };
  var FONDS_SORT_NAAM = { naicRang: 'NAIC-oordeel (Kopen eerst)', koopAfstand: 'Afstand tot koopprijs (dichtst eerst)', kansrijk: 'Zes metingen (Kopen eerst)', naam: 'Naam (A–Z)', positiePct: 'Plek in koersbereik (laag eerst)', afstandPct: 'Afstand tot gemiddelde (laag eerst)',
    epsgroei: 'Winstgroei p.j. (hoog eerst)', omzetgroei: 'Omzetgroei p.j. (hoog eerst)', nettomarge: 'Nettomarge (hoog eerst)', verhouding: 'Opwaarts tegen neerwaarts (hoog eerst)' };
  function schermFondsen() {
    var k = fondsKeuze;
    function opt(waarde, tekst, gekozen) { return '<option value="' + h(waarde) + '"' + (waarde === gekozen ? ' selected' : '') + '>' + h(tekst) + '</option>'; }
    var groepen = indexLijst().concat(DATA.aandelen.some(function (a) { return Dashboard.indexGroepen(a)[0] === 'VS'; }) ? ['VS'] : []);
    return '<section><h1>Fondsen</h1><div class="filterbalk">' +
      '<label for="q" class="vh">Naam of beurscode</label><input id="q" type="search" autocomplete="off" placeholder="Zoek op naam of beurscode" value="' + h(k.zoek) + '">' +
      '<div class="filterkeuzes"><label for="zi" class="vh">Index</label><select id="zi">' + opt('', 'Alle indices', k.index) + groepen.map(function (i) { return opt(i, INDEX_NAAM[i] || i, k.index); }).join('') + '</select>' +
      '<label for="f-weergave" class="vh">Weergave</label><select id="f-weergave">' + opt('index', 'Per index', k.weergave) + opt('lijst', 'Eén lijst', k.weergave) + '</select>' +
      '<label for="f-sort" class="vh">Sorteer op</label><select id="f-sort">' + Object.keys(FONDS_SORT_NAAM).map(function (x) { return opt(x, 'Sorteer: ' + FONDS_SORT_NAAM[x], k.sorteer); }).join('') + '</select></div>' +
      '<label class="vink klein"><input type="checkbox" id="f-bev"' + (k.alleenBevestigd ? ' checked' : '') + '> Alleen bevestigde cijfers</label></div>' +
      '<div id="res"></div>' + datasetOverzicht(fondsItems()) + uitlegOordeel() + '<p class="zacht">U ziet de ' + DATA.aandelen.length + ' aandelen die de nachtelijke update bijhoudt. Standaardvolgorde: NAIC Kopen eerst, dan Neutraal, dan Vermijden; binnen elke groep de meeste ruimte opwaarts tegen neerwaarts bovenaan. Selectiehulp, geen beleggingsadvies.</p></section>';
  }
  function fondsRegel(a) {
    var plek = a.positiePct != null ? 'plek in bereik ' + getal(a.positiePct, 0) + '%' : '';
    var sub = [a.ticker, a.sector, telTekst(a.b), plek].filter(Boolean).join(' · ');
    return '<a href="#/a/' + encodeURIComponent(a.ticker) + '" data-fonds="' + h(a.ticker) + '"><div class="tekstkolom"><b>' + h(a.naam) + '</b><span class="zacht">' + h(sub) + '</span>' +
      oordeelRij(a.b) + '</div>' + I.pijl.replace('class="pijl"', 'width="18" height="18"') + '</a>';
  }
  var fondsItemsCache = null;
  function fondsItems() {
    var t = vandaag();
    var sl = String(minMetingen());
    if (fondsItemsCache && fondsItemsCache.dag === t && fondsItemsCache.sl === sl) return fondsItemsCache.items;
    var items = DATA.aandelen.map(function (rec) {
      var b = signaalVoor(rec), k = Vergelijk.kant(rec, t, Gate);
      return { ticker: rec.ticker, naam: rec.naam, indices: rec.indices || [], bevestigd: k.bevestigd, oordeel: b.oordeel, rang: b.score, naicRang: naicRang(b), dekking: b.dekking, sector: sectorVan(rec),
        positiePct: k.positiePct, afstandPct: k.afstandPct, epsgroei: k.epsgroei, omzetgroei: k.omzetgroei, nettomarge: k.nettomarge, verhouding: k.verhouding, koopAfstand: b.naic && b.naic.koopprijs ? b.naic.koopprijs.afstand : null, b: b };
    });
    fondsItemsCache = { dag: t, sl: sl, items: items };
    return items;
  }
  function fondsenKoppel() {
    var q = document.getElementById('q'), res = document.getElementById('res'); if (!q) return;
    fondsItemsCache = null;      // checklist of instellingen kunnen veranderd zijn
    var ZICHTBAAR = 5;
    function toon() {
      var k = fondsKeuze, lijst = Dashboard.fondsen(fondsItems(), k), alles = !!(k.zoek || k.index);
      if (!lijst.length) { res.innerHTML = '<div class="kaart-plat"><p>Niets gevonden. Probeer een andere naam, beurscode of index.</p></div>'; return; }
      if (k.weergave === 'lijst') {
        var kort = alles ? lijst : lijst.slice(0, 50), rest = alles ? [] : lijst.slice(50);
        res.innerHTML = '<p class="zacht">' + lijst.length + ' fondsen</p><div class="lijst">' + kort.map(fondsRegel).join('') + '</div>' +
          (rest.length ? '<details class="meer"><summary>De overige ' + rest.length + ' tonen</summary><div class="lijst">' + rest.map(fondsRegel).join('') + '</div></details>' : '');
        return;
      }
      res.innerHTML = Dashboard.perIndex(lijst).filter(function (g) { return !k.index || g.index === k.index; }).map(function (g) {
        var kort = alles ? g.items : g.items.slice(0, ZICHTBAAR), rest = alles ? [] : g.items.slice(ZICHTBAAR);
        return '<section class="groep" data-groep="' + h(g.index) + '"><div class="rij-kop"><h2>' + h(INDEX_NAAM[g.index] || g.index) + '</h2><span class="zacht">' + g.items.length + ' fondsen · NAIC ' + g.items.filter(function (x) { return x.b.naic && x.b.naic.oordeel === 'kopen'; }).length + '× Kopen · zes metingen ' + g.positief + '×</span></div>' +
          '<div class="lijst">' + kort.map(fondsRegel).join('') + '</div>' +
          (rest.length ? '<details class="meer"><summary>Alle ' + g.items.length + ' tonen</summary><div class="lijst">' + rest.map(fondsRegel).join('') + '</div></details>' : '') + '</section>';
      }).join('');
    }
    q.addEventListener('input', function () { fondsKeuze.zoek = q.value; toon(); });
    document.getElementById('zi').addEventListener('change', function (e) { fondsKeuze.index = e.target.value; toon(); });
    document.getElementById('f-weergave').addEventListener('change', function (e) { fondsKeuze.weergave = e.target.value; toon(); });
    document.getElementById('f-sort').addEventListener('change', function (e) { fondsKeuze.sorteer = e.target.value; toon(); });
    document.getElementById('f-bev').addEventListener('change', function (e) { fondsKeuze.alleenBevestigd = e.target.checked; toon(); });
    toon();
  }
  var INDEX_NAAM = { VS: 'Verenigde Staten', OVERIG: 'Overige', AEX: 'AEX (Amsterdam)', AMX: 'AMX (Amsterdam midcap)', BEL20: 'BEL 20 (Brussel)', CAC40: 'CAC 40 (Parijs)', DAX: 'DAX (Frankfurt)', FTSE: 'FTSE 100 (Londen)', MIB: 'FTSE MIB (Milaan)', IBEX: 'IBEX 35 (Madrid)' };
  function indexLijst() { var o = {}; DATA.aandelen.forEach(function (a) { (a.indices || []).forEach(function (i) { o[i] = true; }); }); return Object.keys(o).sort(); }
  /* ---- Portefeuille ---- */
  function euro(n, valuta) { return getal(n, 2) + ' ' + h(valuta); }
  function kleur(n) { return n > 0 ? 'var(--ok-ink)' : n < 0 ? 'var(--bad-ink)' : 'var(--ink)'; }
  function teken(n, valuta) { return (n > 0 ? '+' : n < 0 ? '−' : '') + getal(Math.abs(n), 2) + ' ' + h(valuta); }
  function schermPortefeuille() {
    var res = Portefeuille.waardeer(winkel.portefeuille(), DATA.aandelen, vandaag(), Gate), s = '<section><h1>Mijn portefeuille</h1>';
    if (!res.regels.length) {
      s += '<div class="kaart-plat"><p>U heeft nog geen aankopen ingevoerd. Vul hieronder in wat u heeft gekocht; de app rekent uit wat het nu waard is.</p><p class="zacht">Alles blijft op dit toestel. Geen rekening, geen koppeling met uw bank.</p></div>';
    } else {
      s += '<div class="kpis">' + res.totalen.map(function (t) {
        return '<div class="kpi"><b>' + (t.meegeteld ? getal(t.waarde, 2) + ' ' + h(t.valuta) : '–') + '</b><span>Waarde nu (' + h(t.valuta) + ')</span>' +
          (t.meegeteld ? '<span style="color:' + kleur(t.winst) + ';font-weight:700">' + teken(t.winst, t.valuta) + (t.pct == null ? '' : ' (' + pct(t.pct) + ')') + '</span>' : '') +
          (t.buiten ? '<span>' + t.buiten + ' van ' + (t.meegeteld + t.buiten) + ' aankopen telt niet mee: zie hieronder</span>' : '') + '</div>';
      }).join('') + '</div>';
      if (res.totalen.length > 1) s += '<p class="zacht">Totalen staan per valuta. De app rekent nooit om tussen valuta’s.</p>';
      var hk = Portefeuille.herkomst(res.regels).filter(function (x) { return x.signaal.n > 0; });
      if (hk.length) s += '<div class="kaart-plat" data-herkomst><h2>Op signaal gekocht</h2><p class="zacht">Aankopen die u deed op basis van het oordeel van de app, apart gehouden om te zien of het signaal in de praktijk werkt.</p>' + hk.map(function (x) {
        return '<p><b>' + h(x.valuta) + ':</b> ' + x.signaal.n + ' aankoop' + (x.signaal.n === 1 ? '' : 'en') + ' op signaal: <b style="color:' + kleur(x.signaal.winst) + '">' + (x.signaal.pct == null ? '–' : pct(x.signaal.pct)) + '</b>' + (x.overig.n ? ' · overige ' + x.overig.n + ': ' + (x.overig.pct == null ? '–' : pct(x.overig.pct)) : '') + '</p>';
      }).join('') + '<p class="zacht">Een kleine steekproef zegt weinig; het is een hulpmiddel, geen bewijs.</p></div>';
      s += '<div class="lijst">' + res.regels.map(function (r) {
        var p = r.positie;
        return '<div class="regel" style="flex-wrap:wrap"><div class="tekstkolom" style="flex:1 1 200px"><b>' + h(r.naam) + '</b><span class="zacht">' + getal(p.aantal, 4).replace(/,?0+$/, '') + ' stuks · gekocht voor ' + euro(p.koers, p.valuta) + (p.datum ? ' op ' + h(datumNl(p.datum)) : '') + '</span>' +
          (p.opSignaal && p.signaal ? '<span class="zacht" data-op-signaal>Op signaal gekocht: ' + h(oordeelTekst(p.signaal)) + ' op ' + h(datumNl(p.signaal.datum)) + (zoek(p.ticker) ? ' · nu: ' + h(oordeelTekst(signaalVoor(zoek(p.ticker)))) : '') + '</span>' : '') +
          (zoek(p.ticker) ? (function (nb) { return '<span class="oordeel-rij">' + naicChip(nb) + '</span>' + signaalRegel(nb); })(signaalVoor(zoek(p.ticker))) : '') +
          (r.status === 'ok' ? '<span style="color:' + kleur(r.winst) + ';font-weight:700">Nu ' + euro(r.waarde, p.valuta) + ' · ' + teken(r.winst, p.valuta) + (r.pct == null ? '' : ' (' + pct(r.pct) + ')') + '</span>'
            : '<span class="zacht" style="color:var(--wait-ink)">Geen waarde: ' + h(r.reden) + '</span>') + '</div>' +
          '<button class="knop rand klein" data-weg="' + h(p.id) + '" aria-label="Verwijder aankoop ' + h(r.naam) + '">Verwijder</button></div>';
      }).join('') + '</div>';
    }
    var opties = DATA.aandelen.slice().sort(function (x, y) { return x.naam.localeCompare(y.naam); }).map(function (a) { return '<option value="' + h(a.ticker) + '" data-valuta="' + h(a.valuta) + '">' + h(a.naam + ' (' + a.ticker + ')') + '</option>'; }).join('');
    s += '<div class="kaart-plat"><h2>Aankoop toevoegen</h2><form id="pf" novalidate><div class="velden">' +
      '<div><label for="pf-t">Aandeel</label><select id="pf-t">' + opties + '</select></div>' +
      '<div><label for="pf-n">Aantal stuks</label><input id="pf-n" type="number" inputmode="decimal" step="any" min="0"></div>' +
      '<div><label for="pf-k">Aankoopkoers per stuk</label><input id="pf-k" type="number" inputmode="decimal" step="any" min="0"></div>' +
      '<div><label for="pf-v">Valuta</label><input id="pf-v" type="text" maxlength="3" autocapitalize="characters" autocomplete="off"></div>' +
      '<div><label for="pf-d">Datum (mag leeg)</label><input id="pf-d" type="date"></div></div><p id="pf-hint" class="zacht"></p>' +
      '<label class="vink"><input type="checkbox" id="pf-sig"> Gekocht op basis van het signaal van de app</label><p class="zacht">De app legt dan het oordeel en de dekking van nu vast, zodat u later kunt terugkijken of het signaal klopte.</p>' +
      '<p id="pf-fout" class="zacht" role="alert" style="color:var(--bad-ink)"></p><div class="knoppen"><button class="knop" type="submit">Toevoegen</button></div></form></div>' +
      '<p class="zacht">Alleen een overzicht van wat u zelf invoert, geen beleggingsadvies. Kosten en belasting zijn niet meegerekend. De waarde gebruikt de laatste slotkoers en alleen als die maximaal ' + Gate.MAX_PRICE_AGE_DAYS + ' dagen oud is.</p></section>' + backupBalk();
    return s;
  }
  function portefeuilleKoppel() {
    var sel = document.getElementById('pf-t'), val = document.getElementById('pf-v'); if (!sel) return;
    function vul() {
      var o = sel.options[sel.selectedIndex]; val.value = o ? o.getAttribute('data-valuta') || '' : '';
      var hint = document.getElementById('pf-hint');
      if (hint) hint.textContent = /\.L$/.test(sel.value) ? 'Londen: de app rekent in ponden (GBP). Geeft uw bank de koers in pence (bijv. 4500), vul dan GBX in als valuta.' : '';
    }
    sel.addEventListener('change', vul); vul();
    document.getElementById('pf').addEventListener('submit', function (e) {
      e.preventDefault();
      var rec = zoek(sel.value), op = document.getElementById('pf-sig').checked && rec;
      var u = winkel.voegPositieToe({ ticker: sel.value, aantal: document.getElementById('pf-n').value, koers: document.getElementById('pf-k').value, valuta: val.value, datum: document.getElementById('pf-d').value || null,
        signaal: op ? momentopname(rec) : undefined, opSignaal: op ? true : undefined });
      if (!u.ok) { document.getElementById('pf-fout').textContent = u.reden; return; }
      toast('Aankoop toegevoegd'); route();
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-weg]'), function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-weg'), oud = winkel.portefeuille().filter(function (x) { return x.id === id; })[0];
        if (winkel.verwijderPositie(id)) { toast('Aankoop verwijderd', function () { winkel.herstelPositie(oud); route(); }); route(); }
      });
    });
  }

  /* ---- Vergelijken ---- */
  function chipKort(ok, niveau) { return ok ? '<span class="chip ok">✓ Bevestigd</span>' : (niveau === 'jaarverslag' ? '<span class="chip" data-niveau="jaarverslag">Uit jaarverslag</span>' : niveau === 'indicatief' ? '<span class="chip" data-niveau="indicatief">Indicatief</span>' : '<span class="chip wacht">… Onbevestigd</span>'); }
  function schermVergelijk(ta, tb) {
    var lijst = DATA.aandelen.slice().sort(function (x, y) { return x.naam.localeCompare(y.naam); });
    var ra = zoek(ta) || lijst[0], rb = zoek(tb) || lijst[1] || lijst[0];
    function sel(id, gekozen, tekst) {
      return '<div><label for="' + id + '">' + tekst + '</label><select id="' + id + '">' + lijst.map(function (r) { return '<option value="' + h(r.ticker) + '"' + (r.ticker === gekozen.ticker ? ' selected' : '') + '>' + h(r.naam + ' (' + r.ticker + ')') + '</option>'; }).join('') + '</select></div>';
    }
    var v = Vergelijk.vergelijk(ra, rb, vandaag(), Gate), A = v.a, B = v.b;
    function cel(w, soort, k) {
      if (w == null) return '<td class="leeg" aria-label="geen waarde">–</td>';
      return '<td>' + (soort === 'pct' ? pct(w) : soort === 'koers' ? getal(w, 2) + ' ' + h(k.valuta) : soort === 'kw' ? getal(w, 1) : getal(w, 1) + '%') + '</td>';
    }
    var rijenDef = [['Koers (laatste slot)', 'koers', 'koers'], ['Afstand tot gemiddelde 50 dagen', 'afstandPct', 'pct'], ['Omzetgroei per jaar', 'omzetgroei', 'pct'], ['Groei winst per aandeel per jaar', 'epsgroei', 'pct'], ['Nettomarge laatste jaar', 'nettomarge', 'plain'], ['Koers-winstverhouding (K/W)', 'kw', 'kw']];
    var tb2 = '<div class="schuif"><table class="vgl"><thead><tr><th></th><th>' + h(A.naam) + '</th><th>' + h(B.naam) + '</th></tr></thead><tbody>' +
      '<tr><th scope="row">Gegevens</th><td>' + chipKort(A.bevestigd, A.niveau) + '</td><td>' + chipKort(B.bevestigd, B.niveau) + '</td></tr>' +
      rijenDef.map(function (d) { return '<tr><th scope="row">' + h(d[0]) + '</th>' + cel(A[d[1]], d[2], A) + cel(B[d[1]], d[2], B) + '</tr>'; }).join('') + '</tbody></table></div>';
    var uitleg = [A, B].filter(function (x) { return !x.bevestigd; }).map(function (x) { return '<li><b>' + h(x.naam) + ':</b> ' + h(x.reden) + '</li>'; }).join('');
    return '<section><div class="stelregel"><a class="link" href="#/" id="terug">' + I.terug + 'Terug</a></div><h1>Vergelijken</h1><div class="velden">' + sel('vg-a', ra, 'Eerste aandeel') + sel('vg-b', rb, 'Tweede aandeel') + '</div>' +
      (ra.ticker === rb.ticker ? '<p class="zacht">Kies twee verschillende aandelen om te vergelijken.</p>' : '') + tb2 +
      (uitleg ? '<div class="melding"><b>Waarom ontbreken er cijfers?</b><ul class="punten">' + uitleg + '</ul><span>Alleen volledig bevestigde aandelen krijgen cijfers uit de jaarverslagen.</span></div>' : '') +
      '<p class="zacht">Alleen percentages en verhoudingen, zodat verschillende valuta’s geen probleem zijn. De app wijst geen winnaar aan: selectiehulp, geen beleggingsadvies.</p></section>';
  }
  function vergelijkKoppel() {
    var a = document.getElementById('vg-a'), b = document.getElementById('vg-b'); if (!a) return;
    function ga() { location.hash = '#/vergelijk/' + encodeURIComponent(a.value) + '/' + encodeURIComponent(b.value); }
    a.addEventListener('change', ga); b.addEventListener('change', ga);
  }

  /* ---- Uitleg bij eerste gebruik ---- */
  var INTRO = [
    ['Welkom bij Aandeel Signaal', 'Vergelijk en volg grote Europese en Amerikaanse bedrijven. U heeft geen account nodig en het kost niets. De app is een hulpmiddel om te kiezen, geen beleggingsadvies.'],
    ['Het oordeel volgt de NAIC-methode', 'Bij elk aandeel staat Kopen, Neutraal of Vermijden volgens de Stock Selection Guide van de NAIC: is het een groeibedrijf, is het een goed bedrijf, en is de prijs nu gunstig (koopzone, minstens 3 : 1 opwaarts tegen neerwaarts, minstens 15% verwacht rendement per jaar)? Zes extra metingen staan er aanvullend bij.'],
    ['Waar komen de cijfers vandaan?', '“Bevestigd” betekent: de winst per aandeel van 10 jaar is onafhankelijk nagerekend. “Uit jaarverslag”: officiële cijfers, niet nagerekend. “Indicatief”: (een deel van) de winst per aandeel komt niet uit een officiële bron, maar van Yahoo Finance of uit cijfers die u aanleverde. Ontbreekt iets, dan zegt de app liever niets dan iets onzekers; hij schat nooit.'],
    ['Volgen en signalen', 'Zet aandelen op uw volglijst (ster) of voer uw aankopen in bij Portefeuille. Op Start ziet u dan wanneer ze in de koop- of verkoopzone komen, en welke fondsen sinds de vorige update van oordeel veranderden.'],
    ['Uw gegevens blijven van u', 'Uw volglijst en portefeuille staan alleen op dit toestel. Maak daarom af en toe een back-up via Instellingen en bewaar die in uw eigen cloud of mail. Handig: zet de app op uw beginscherm via het menu van uw browser.']
  ];
  var introOpen = false;
  function toonIntro(stap) {
    stap = stap || 0; introOpen = true;
    var laatste = stap === INTRO.length - 1, vorige = document.activeElement;
    var stippen = INTRO.map(function (x, i) { return '<i' + (i === stap ? ' class="aan"' : '') + '></i>'; }).join('');
    $laag.innerHTML = '<div class="intro-achter"><div class="intro" role="dialog" aria-modal="true" aria-labelledby="intro-t"><div class="intro-stippen" aria-label="Stap ' + (stap + 1) + ' van ' + INTRO.length + '">' + stippen + '</div>' +
      '<h2 id="intro-t">' + h(INTRO[stap][0]) + '</h2><p>' + h(INTRO[stap][1]) + '</p><div class="knoppen">' +
      '<button class="knop" id="intro-vk">' + (laatste ? 'Begrepen, aan de slag' : 'Volgende') + '</button>' + (laatste ? '' : '<button class="knop rand" id="intro-sl">Overslaan</button>') + '</div></div></div>';
    function sluit() { introOpen = false; winkel.zetIntroGezien(true); $laag.innerHTML = ''; document.removeEventListener('keydown', toets); if (vorige && vorige.focus) { try { vorige.focus(); } catch (e) { /* geen focus */ } } }
    function toets(e) { if (e.key === 'Escape') sluit(); }
    document.addEventListener('keydown', toets);
    document.getElementById('intro-vk').addEventListener('click', function () { document.removeEventListener('keydown', toets); if (laatste) sluit(); else toonIntro(stap + 1); });
    var sl = document.getElementById('intro-sl'); if (sl) sl.addEventListener('click', sluit);
    document.getElementById('intro-vk').focus();
  }

  /* ---- Aandeelpagina ---- */
  var TABS = [['samenvatting', 'Overzicht'], ['koers', 'Koers'], ['waarde', 'NAIC'], ['check', 'Verdiepen'], ['gezondheid', 'Cijfers'], ['bronnen', 'Bronnen']];
  function groei(a, b, jaren) { return a > 0 && b > 0 && jaren > 0 ? (Math.pow(b / a, 1 / jaren) - 1) * 100 : null; }
  function jaarLijst(g) { return (g && g.jaren ? g.jaren : []).slice().sort(function (x, y) { return x.year - y.year; }); }
  function sparkSvg(reeks, sma) {
    var W = 320, Ht = 90, p = reeks.map(function (x) { return x[1]; }), lo = Math.min.apply(null, p), hi = Math.max.apply(null, p);
    if (typeof sma === 'number') { lo = Math.min(lo, sma); hi = Math.max(hi, sma); }
    var sp = hi - lo || 1, X = function (i) { return reeks.length > 1 ? i / (reeks.length - 1) * W : W; }, Y = function (v) { return 8 + (1 - (v - lo) / sp) * (Ht - 16); };
    var d = reeks.map(function (x, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(x[1]).toFixed(1); }).join(' ');
    var gem = typeof sma === 'number' ? '<path class="gem" d="M0 ' + Y(sma).toFixed(1) + ' L' + W + ' ' + Y(sma).toFixed(1) + '"/>' : '';
    return '<svg class="grafiek" viewBox="0 0 ' + W + ' ' + Ht + '" role="img" aria-label="Koers van de laatste maanden"><path class="lijn" d="' + d + '"/>' + gem + '<circle cx="' + W + '" cy="' + Y(p[p.length - 1]).toFixed(1) + '" r="4" fill="var(--chart-a)"/></svg>';
  }
  function epsBalken(jr) {
    var v = jr.filter(function (j) { return typeof j.comparable_eps === 'number'; });
    if (!v.length) return '';
    var W = 320, Ht = 150, max = Math.max.apply(null, v.map(function (j) { return Math.max(j.comparable_eps, 0); })) || 1, bw = W / v.length, s = '';
    v.forEach(function (j, i) {
      var hh = Math.max(j.comparable_eps, 0) / max * (Ht - 40), x = i * bw + bw * .18, w = bw * .64;
      s += '<rect class="stapel-b" rx="3" x="' + x.toFixed(1) + '" y="' + (Ht - 22 - hh).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + hh.toFixed(1) + '"/>' +
        '<text class="waarde" text-anchor="middle" x="' + (x + w / 2).toFixed(1) + '" y="' + (Ht - 26 - hh).toFixed(1) + '">' + getal(j.comparable_eps, 2) + '</text>' +
        '<text text-anchor="middle" x="' + (x + w / 2).toFixed(1) + '" y="' + (Ht - 6) + '">' + String(j.year).slice(2) + '</text>';
    });
    return '<svg class="grafiek" viewBox="0 0 ' + W + ' ' + Ht + '" role="img" aria-label="Winst per aandeel per jaar, vergelijkbaar gemaakt">' + s + '</svg>';
  }
  function checks(rec, g, gate, fr) {
    var jr = g ? g.jaren.length : 0, lst = [];
    function r(ok, t) { lst.push('<li style="color:' + (ok ? 'var(--ok-ink)' : 'var(--wait-ink)') + '">' + (ok ? I.vink : I.wacht) + '<span style="color:var(--ink)">' + h(t) + '</span></li>'); }
    var ev = g && g.eps_status === 'independently_verified';
    r(ev && g.eps_verified_years >= Gate.REQUIRED_EPS_YEARS, ev ? 'Winst per aandeel van ' + g.eps_verified_years + ' jaar onderbouwd' + (g.splits && g.splits.some(function (s) { return s.status === 'candidate'; }) ? ', ook na aandelensplitsing' : '') : 'Winst per aandeel is nog niet onderbouwd');
    var cur = g && g.currencies ? g.currencies : [];
    r(cur.length === 1, cur.length === 1 ? 'Cijfers en koers in één valuta (' + cur[0] + ')' : (cur.length ? 'Cijfers en koers staan in verschillende valuta (' + cur.join(', ') + ')' : 'Valuta onbekend'));
    r(fr.fresh, fr.fresh ? 'Koers van maximaal ' + Gate.MAX_PRICE_AGE_DAYS + ' dagen oud' : fr.reason);
    r(g && g.rejected_sources === 0, g && g.rejected_sources === 0 ? 'Geen bronnen afgewezen' : 'Er zijn bronnen afgewezen of onbekend');
    return '<ul class="vinkjes">' + lst.join('') + '</ul>';
  }
  function indicatiefUitleg(g) {
    return '<div class="melding" data-indicatief><b>Indicatieve cijfers van Yahoo Finance</b><span>Voor dit bedrijf is geen officieel jaarverslag beschikbaar in een bron die de app kan lezen. De ' + (g.jaren ? g.jaren.length : '') + ' jaren hieronder komen van Yahoo Finance en zijn niet nagerekend. Ze tellen daarom minder zwaar mee in het totaalbeeld, er is geen NAIC-label en geen koersdoel. Twijfelachtige cijfers (zoals winst per aandeel rond een aandelensplitsing) zijn weggelaten.</span></div>';
  }
  function jaarverslagUitleg(g) {
    return '<div class="melding" data-jaarverslag><b>Cijfers uit het officiële jaarverslag</b><span>De ' + (g.jaren ? g.jaren.length : '') + ' jaren hieronder komen uit de ESEF-jaarverslagen van het bedrijf zelf. De winst per aandeel is niet zelf nagerekend (dat lukt niet altijd, bijvoorbeeld als het aantal aandelen niet machineleesbaar in het verslag staat). Wel geven de opeenvolgende verslagen voor de overlappende jaren dezelfde winst per aandeel, dus de jaren zijn onderling vergelijkbaar. Daarom geen label en geen koersdoel; de NAIC-gids vraagt 10 onderbouwde jaren.</span></div>';
  }
  function schermAandeel(t, tab) {
    var rec = zoek(t); if (!rec) return '<section><h1>Niet gevonden</h1><p>Dit aandeel zit niet in de lijst.</p><a class="knop" href="#/fondsen">Zoeken</a></section>';
    var g = rec.gegevens && !rec.gegevens.fout ? rec.gegevens : null, k = rec.koers;
    var fr = k ? Gate.priceFreshness(k.datum, vandaag()) : { fresh: false, reason: 'Geen koersgegevens.' };
    var r = Gate.maakRij(rec, vandaag());
    var ob = winkel.zit(rec.ticker);
    var kop = '<div class="stelregel"><a class="link" href="#/" id="terug">' + I.terug + 'Terug</a><span class="stel-knoppen"><button type="button" class="volg" id="afdruk">' + I.print + 'Afdrukken / PDF</button><button class="volg" id="volg" aria-pressed="' + ob + '">' + I.ster + (ob ? 'Op mijn volglijst' : 'Zet op mijn volglijst') + '</button></span></div>' +
      '<div><span class="zacht" style="font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:.8rem">' + h([rec.ticker, rec.beurs, sectorVan(rec)].filter(Boolean).join(' · ')) + '</span><h1>' + h(rec.naam) + '</h1>' + (rec.indices && rec.indices.length ? '<div data-indices>' + rec.indices.map(function (i) { return '<span class="chip">' + h(INDEX_NAAM[i] || i) + '</span>'; }).join(' ') + '</div>' : '') + '</div>';
    var s = kop, jr = jaarLijst(g);
    if (tab === 'samenvatting') {
      s += bedrijfBlok(rec) + signaalKaart(rec);
      s += '<div class="kaart-plat">' + (fr.fresh ? '<div class="rij-kop"><b style="font:700 2rem ui-rounded,system-ui">' + getal(k.slot, 2) + ' ' + h(rec.valuta) + '</b><span class="zacht">Slotkoers ' + h(datumNl(k.datum)) + '</span></div>' + sparkSvg(k.reeks, k.sma50) + '<p>' + (r.richting ? 'De koers staat ' + (r.richting === 'boven' ? 'boven' : 'onder') + ' het gemiddelde van de laatste 50 handelsdagen (' + pct(r.afstandPct) + ').' : '') + '</p>' :
        '<b>Geen actuele koers</b><p class="zacht">' + h(fr.reason) + ' Daarom tonen we geen oordeel en geen trend.</p>') + '</div>';
      s += '<div class="kaart-plat"><div class="rij-kop"><h2>' + (r.bevestigd ? 'Gegevens bevestigd' : (g && g.eps_status === 'independently_verified' && !fr.fresh ? 'Jaarcijfers bevestigd, koers ontbreekt' : 'Gegevens nog niet bevestigd')) + '</h2>' + chip(r.bevestigd, r.niveau) + '</div>' + (r.niveau === 'jaarverslag' ? jaarverslagUitleg(g) : '') + checks(rec, g, null, fr) +
        (r.bevestigd ? '' : '<p class="zacht">' + h(r.redenen.join(' ')) + '</p>') + '</div>';
    } else if (tab === 'koers') {
      s += fr.fresh ? '<div class="kaart-plat">' + sparkSvg(k.reeks, k.sma50) + '<div class="legenda"><span><i style="background:var(--chart-a)"></i>Slotkoers</span><span><i style="background:var(--chart-b)"></i>Gemiddelde 50 dagen</span></div></div>' +
        '<div class="kpis"><div class="kpi"><b>' + getal(k.slot, 2) + '</b><span>Slotkoers (' + h(rec.valuta) + ')</span></div><div class="kpi"><b>' + getal(k.sma50, 2) + '</b><span>Gemiddelde 50 dagen</span></div><div class="kpi"><b>' + (r.afstandPct == null ? '–' : pct(r.afstandPct)) + '</b><span>Afstand tot gemiddelde</span></div></div>'
        : '<div class="melding"><b>Geen actuele koers beschikbaar</b><span>' + h(fr.reason) + '</span></div>';
      s += timingHtml(rec, fr);
      if (fr.fresh && rec.koers) s += bereikKaart(Naic.bereikUitKoers(rec.koers.bereik, rec.koers.slot), r.bevestigd, 'div');
    } else if (tab === 'waarde') {
      s += waardeHtml(rec, g, jr, r);
    } else if (tab === 'check') {
      s += verdiepHtml(rec) + checkHtml(rec);
    } else if (tab === 'gezondheid') {
      s += (r.niveau === 'jaarverslag' ? jaarverslagUitleg(g) : r.niveau === 'indicatief' ? indicatiefUitleg(g) : '') + gezondHtml(g, jr);
    } else {
      s += bronHtml(rec, g);
    }
    return s + '<p class="zacht">Selectiehulp, geen beleggingsadvies.</p>';
  }
  function staven(reeks, aria, fmt) {
    var v = reeks.filter(function (x) { return x.waarde !== null; });
    if (!v.length) return '<p class="zacht">Geen cijfers beschikbaar.</p>';
    var W = 320, Ht = 140, max = Math.max.apply(null, v.map(function (x) { return Math.max(x.waarde, 0); })) || 1, bw = W / reeks.length, s = '';
    reeks.forEach(function (x, i) {
      var xx = i * bw + bw * .12, w = bw * .76;
      if (x.waarde === null) { s += '<text text-anchor="middle" x="' + (xx + w / 2).toFixed(1) + '" y="' + (Ht - 40) + '">–</text>'; }
      else {
        var hh = Math.max(x.waarde, 0) / max * (Ht - 44);
        s += '<rect class="stapel-b" rx="3" x="' + xx.toFixed(1) + '" y="' + (Ht - 22 - hh).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + hh.toFixed(1) + '"/><text class="waarde" text-anchor="middle" x="' + (xx + w / 2).toFixed(1) + '" y="' + (Ht - 26 - hh).toFixed(1) + '">' + fmt(x.waarde) + '</text>';
      }
      s += '<text text-anchor="middle" x="' + (xx + w / 2).toFixed(1) + '" y="' + (Ht - 6) + '">' + String(x.year).slice(2) + '</text>';
    });
    return '<svg class="grafiek" viewBox="0 0 ' + W + ' ' + Ht + '" role="img" aria-label="' + h(aria) + '">' + s + '</svg>';
  }
  function naicExtraHtml(jr, bank) {
    function heeft(r) { return r.some(function (x) { return x.waarde !== null; }); }
    function blok(titel, reeks, aria, fmt, uitleg) {
      return '<section><h2>' + h(titel) + '</h2>' + (heeft(reeks) ? staven(reeks, aria, fmt) + '<p class="zacht">' + uitleg + ' Een ontbrekende staaf betekent: het cijfer is in de bron niet eenduidig te vinden.</p>'
        : '<p class="zacht">Onbekend: dit cijfer is in de jaarverslagen niet eenduidig te vinden, dus er wordt niets getoond.</p>') + '</section>';
    }
    var nm = Naic.nettomarges(jr), ur = Naic.uitkeringsratio(jr), sr = Naic.schuldratio(jr), ir = Naic.investeringsratio(jr);
    var s = '<div id="naic-extra"><h2 style="margin-top:20px">Aanvullend: meer over het management</h2><p class="zacht">Geen onderdeel van de zes NAIC-stappen. Cijfers die iets zeggen over hoe het bedrijf met geld omgaat; aanwijzingen, geen oordeel.</p></div>';
    if (bank) return s + '<div class="melding"><b>Bank</b><span>Voor banken zeggen winstmarge vóór belasting, schuld en investeringen weinig. Daarom worden ze hier niet getoond.</span></div>' + blok('Uitgekeerd deel van de winst', ur, 'Uitgekeerd dividend als percentage van de nettowinst per jaar', function (v) { return getal(v, 0); }, 'Uitgekeerd dividend gedeeld door de nettowinst, in procenten.');
    return s + blok('Nettowinstmarge', nm, 'Nettowinst als percentage van de omzet per jaar', function (v) { return getal(v, 0); }, 'Nettowinst als percentage van de omzet (na belasting). NAIC kijkt naar de marge vóór belasting (stap 2); deze staat er ter vergelijking.') +
      blok('Uitgekeerd deel van de winst', ur, 'Uitgekeerd dividend als percentage van de nettowinst per jaar', function (v) { return getal(v, 0); }, 'Uitgekeerd dividend gedeeld door de nettowinst, in procenten. Boven 100% betekent meer uitkeren dan er verdiend is.') +
      blok('Investeringen t.o.v. afschrijvingen', ir, 'Investeringen in vaste activa gedeeld door afschrijvingen per jaar', function (v) { return getal(v, 1); }, 'Boven 1,0 investeert het bedrijf meer dan er aan bezittingen slijt.');
  }
  /* Koers/winst in het verleden: hoogste en laagste koers van elk boekjaar gedeeld door de winst per aandeel. */
  function kwHistorieHtml(jr, bank) {
    var kw = Naic.historischKW(jr), gem = Naic.kwGemiddelden(kw, 5), dr = Naic.dividendRendement(jr);
    var heeftKW = kw.some(function (x) { return x.hoog !== null || x.laag !== null; });
    var s = '<div data-kw-historie><h3>Koers/winst in het verleden</h3>';
    if (!heeftKW) return s + '<p class="zacht">Onbekend: voor deze jaren is er geen volledige koershistorie in dezelfde valuta als de jaarcijfers, dus er wordt niets getoond.</p></div>';
    s += staven(kw.map(function (x) { return { year: x.year, waarde: x.hoog }; }), 'Hoogste koers/winst per jaar', function (v) { return getal(v, 0); }) + '<p class="zacht">Hoogste koers van het jaar gedeeld door de winst per aandeel.</p>';
    s += staven(kw.map(function (x) { return { year: x.year, waarde: x.laag }; }), 'Laagste koers/winst per jaar', function (v) { return getal(v, 0); }) + '<p class="zacht">Laagste koers van het jaar gedeeld door de winst per aandeel.</p>';
    if (gem) s += '<p data-kw-gem><b>Gemiddeld over ' + gem.jaren + ' jaar (' + gem.van + '–' + gem.tot + '): hoog ' + getal(gem.hoog, 1) + ', laag ' + getal(gem.laag, 1) + '.</b> Dit is hoe duur of goedkoop de markt het bedrijf in het verleden vond. Het zegt niets over de toekomst.</p>' +
      '<button class="knop rand klein" id="kw-over" data-kwh="' + gem.hoog + '" data-kwl="' + gem.laag + '">Neem deze K/W over in mijn koerszones</button>';
    if (!bank && dr.some(function (x) { return x.waarde !== null; })) s += staven(dr, 'Dividendrendement per jaar in procenten', function (v) { return getal(v, 1); }) + '<p class="zacht">Dividend per aandeel gedeeld door de gemiddelde koers van het jaar, in procenten.</p>';
    return s + '</div>';
  }
  /* Waar staat de koers nu in het bereik van de afgelopen jaren? Alleen beschrijving, geen koop- of verkoopadvies. */
  function bereikHtml(jr, koers, bevestigd) { return bereikKaart(Naic.bereik(jr, koers, 10, 8), bevestigd, 'section'); }
  function bereikKaart(b, bevestigd, tag) {
    var s = '<' + tag + ' data-bereik' + (tag === 'div' ? ' class="kaart-plat"' : '') + '><h2>Plek in het koersbereik van de afgelopen jaren</h2>';
    if (!b) return s + '<p class="zacht">Onbekend: hiervoor is een actuele koers en minstens 8 jaar koershistorie in dezelfde valuta nodig.</p></' + tag + '>';
    var LABEL = { positief: 'Onderin, ruim opwaarts', neutraal: 'Midden', vermijden: 'Bovenin' }, LABEL_UITLEG = { positief: 'De koers staat in het onderste derde van het bereik en er is minstens drie keer zoveel opwaarts als neerwaarts.', neutraal: 'Geen van beide uitersten.', vermijden: 'De koers staat in het bovenste derde van het bereik.' };
    var T = { onder: 'het onderste derde', midden: 'het middelste derde', boven: 'het bovenste derde' };
    return s + '<div class="kpis"><div class="kpi"><b>' + getal(b.laag, 2) + '</b><span>Laagste slotkoers (' + b.van + '–' + b.tot + ')</span></div><div class="kpi"><b>' + getal(b.hoog, 2) + '</b><span>Hoogste slotkoers</span></div>' +
      '<div class="kpi"><b>' + getal(b.positiePct, 0) + '%</b><span>Plek in het bereik (0 = laagste, 100 = hoogste)</span></div><div class="kpi"><b>' + (b.verhouding == null ? '–' : getal(b.verhouding, 1) + ' : 1') + '</b><span>Opwaarts tegen neerwaarts</span></div></div>' +
      (bevestigd ? '<p data-label="' + b.label + '"><span class="chip">' + LABEL[b.label] + '</span> ' + LABEL_UITLEG[b.label] + '</p>' : '') +
      '<p>De koers staat in <b>' + T[b.derde] + '</b> van dit bereik.</p><p class="zacht">De NAIC deelt het bereik in drie gelijke stukken en kijkt of er minstens drie keer zoveel opwaarts als neerwaarts is. Dit is een beschrijving van het verleden over ' + b.jaren + ' boekjaren, geen koopadvies en geen voorspelling. Het label verschijnt alleen als de gegevens van het bedrijf bevestigd zijn. Staat de koers op of onder het laagste punt, dan is de verhouding niet te berekenen.</p></' + tag + '>';
  }
  /* De NAIC-gids in de vijf delen van de Stock Selection Guide, in dezelfde volgorde als het formulier van NAIC/BetterInvesting. */
  function deelKop(nr, titel, vraag) { return '<h2 class="deel-kop"><span class="deel-nr">' + nr + '</span>' + h(titel) + '</h2><p class="deel-vraag">' + h(vraag) + '</p>'; }
  function toetsRegels(n, ids) {
    var q = (n && n.kwaliteit || []).filter(function (x) { return ids.indexOf(x.id) > -1; });
    return q.length ? '<ul class="methoden">' + q.map(function (x) { return '<li>' + stip(x.ok === true ? 'gunstig' : x.ok === false ? 'ongunstig' : null, x.id) + '<div><span' + (x.ok === null ? ' class="zacht"' : '') + '>' + h(x.tekst) + '</span></div></li>'; }).join('') + '</ul>' : '';
  }
  function naicHtml(jr, bank, koers, bevestigd, n, zonesBlok) {
    var gc = Naic.groeiCijfers(jr), roe = Naic.rendementEigenVermogen(jr), pm = Naic.margeVoorBelasting(jr);
    function kp(w, t) { return '<div class="kpi"><b>' + (w == null ? '–' : pct(w)) + '</b><span>' + h(t) + '</span></div>'; }
    function kpv(w, t) { return '<div class="kpi"><b>' + w + '</b><span>' + h(t) + '</span></div>'; }
    n = n || {};
    var s = '<div class="kaart-plat"><h2>NAIC-gids</h2><p class="zacht">De Stock Selection Guide van de NAIC (nu BetterInvesting), een Amerikaanse beleggersvereniging, in zes stappen. Het oordeel op het tabblad Samenvatting volgt dezelfde stappen. Geen koersdoel en geen advies.</p></div>';
    // Deel 1
    s += '<section data-deel="1">' + deelKop(1, 'Visuele analyse van de groei', 'Groeien omzet en winst per aandeel gelijkmatig, en minstens 5% per jaar?') + '<div class="kpis">' +
      kp(gc.omzet10, 'Omzet (' + (gc.van || '?') + '–' + (gc.tot || '?') + ')') + kp(gc.omzet5, 'Omzet, laatste 5 jaar') + kp(gc.eps10, 'Winst per aandeel (' + (gc.van || '?') + '–' + (gc.tot || '?') + ')') + kp(gc.eps5, 'Winst per aandeel, laatste 5 jaar') + '</div>' +
      (n.groeiHistorisch != null ? '<p>Trend van de winst per aandeel: <b>' + pct(n.groeiHistorisch) + ' per jaar</b>. De gids rekent verder met ' + (n.groeiEigen != null ? 'uw eigen groeiverwachting van ' + pct(n.groei) : pct(n.groei) + (n.groeiHistorisch > Naic.GROEI_MAX ? ' (NAIC rekent met hoogstens ' + Naic.GROEI_MAX + '%)' : '')) + '.</p>' : '') +
      toetsRegels(n, ['omzet']) + '<p class="zacht">Een streepje betekent dat er te weinig of geen positieve cijfers zijn.</p></section>';
    // Deel 2
    s += '<section data-deel="2">' + deelKop(2, 'Evaluatie van het management', 'Houdt het management de winstmarge vóór belasting en het rendement op eigen vermogen op peil, en hoeveel schuld heeft het bedrijf?') +
      (bank ? '<p class="zacht">Bij een bank of verzekeraar zegt de winstmarge vóór belasting weinig; die wordt niet getoond.</p>' : '<h3>Winstmarge vóór belasting</h3>' + staven(pm, 'Winstmarge vóór belasting per jaar in procenten', function (v) { return getal(v, 0); }) + '<p class="zacht">Winst vóór belasting als percentage van de omzet. Dit is de marge die de NAIC bedoelt.</p>') +
      '<h3>Rendement op eigen vermogen</h3>' + staven(roe.reeks, 'Rendement op eigen vermogen per jaar in procenten', function (v) { return getal(v, 0); }) +
      '<p class="zacht">Nettowinst gedeeld door het eigen vermogen aan het eind van het jaar.' + (roe.gemiddelde == null ? '' : ' Gemiddeld ' + getal(roe.gemiddelde, 1) + '% over ' + roe.jarenMetWaarde + ' jaar.') + ' Bij negatief of nul eigen vermogen blijft het leeg.</p>' +
      toetsRegels(n, ['marge', 'roe']) +
      (bank ? '' : (function () { var sr = Naic.schuldratio(jr); return sr.some(function (x) { return x.waarde !== null; }) ? '<h3>Schuld t.o.v. totaal kapitaal</h3>' + staven(sr, 'Langlopende schuld als percentage van schuld plus eigen vermogen per jaar', function (v) { return getal(v, 0); }) + '<p class="zacht">Langlopende schuld gedeeld door schuld plus eigen vermogen. Lager is veiliger; wat gebruikelijk is verschilt per sector. Ter informatie; telt niet mee in het oordeel.</p>' : '<h3>Schuld t.o.v. totaal kapitaal</h3><p class="zacht">Onbekend: niet eenduidig te vinden in de jaarverslagen.</p>'; })()) + '</section>';
    // Deel 3
    s += '<section data-deel="3">' + deelKop(3, 'Koers/winst-geschiedenis', 'Hoeveel keer de winst betaalde de markt de afgelopen vijf jaar, op het hoogste en laagste punt? Is het aandeel nu historisch goedkoop of duur?') + kwHistorieHtml(jr, bank) +
      (n.relatief ? '<p data-relatief>Relatieve waarde: de K/W nu (' + getal(n.relatief.kwNu, 1) + ') is <b>' + n.relatief.pct + '%</b> van de gemiddelde K/W (' + getal(n.relatief.kwGem, 1) + '). NAIC ziet het liefst ' + Naic.RV_LAAG + '–' + Naic.RV_HOOG + '%. Ter informatie; telt niet mee in het oordeel.</p>' : '') + '</section>';
    // Stap 4 en 5
    var z = n.zones;
    s += '<section data-deel="4">' + deelKop(4, 'Verwachte hoge en lage koers', 'Wat kan de koers over ' + (n.horizon || 5) + ' jaar op zijn hoogst en op zijn laagst zijn, bij de verwachte groei?') +
      (z ? '<div class="kpis">' + kpv(pct(n.groei), 'Verwachte groei winst per aandeel per jaar') + kpv(getal(z.epsToekomst, 2), 'Winst per aandeel over ' + (n.horizon || 5) + ' jaar') + kpv(getal(z.hoog, 2), 'Verwachte hoge koers') + kpv(getal(z.laag, 2), 'Verwachte lage koers') + '</div>' +
        '<p class="zacht">Hoge koers = winst per aandeel over ' + (n.horizon || 5) + ' jaar × gemiddelde hoge K/W (' + getal(n.kw.hoog, 1) + '). Lage koers = laagste winst per aandeel van de laatste 5 jaar (' + getal(n.epsLaag, 2) + ') × gemiddelde lage K/W (' + getal(n.kw.laag, 1) + ').</p>' : '<p class="zacht">' + h(n.reden || 'Niet te berekenen.') + '</p>') +
      (zonesBlok || '') + '</section>';
    s += '<section data-deel="5">' + deelKop(5, 'Risico en rendement', 'In welke zone staat de koers, en is er minstens 3 keer zoveel opwaarts als neerwaarts?') +
      (z && z.koers != null ? '<div class="kpis">' + kpv(getal(z.koers, 2), 'Koers nu') + kpv({ koop: 'Koopzone', houd: 'Houdzone', verkoop: 'Verkoopzone', onder: 'Onder de lage koers', boven: 'Boven de hoge koers' }[z.zone] || '–', 'Zone (het bereik in drie gelijke stukken)') + kpv(z.verhouding == null ? '–' : getal(z.verhouding, 1) + ' : 1', 'Opwaarts tegen neerwaarts (NAIC: 3 : 1 of meer)') + '</div>' +
        '<p class="zacht">Opwaarts = hoge koers min koers nu; neerwaarts = koers nu min lage koers. Bij 3 : 1 is de mogelijke winst drie keer zo groot als het mogelijke verlies: dat is de veiligheidsmarge.</p>' : '<p class="zacht">Niet te berekenen zonder verwachte koersen en een verse koers in dezelfde valuta als de winst.</p>') +
      bereikHtml(jr, koers, bevestigd) + '</section>';
    // Deel 5
    var t = n.totaal, kp5 = n.koopprijs;
    s += '<section data-deel="6">' + deelKop(6, 'Verwacht totaalrendement', 'Levert het aandeel bij de huidige koers minstens ' + Naic.TOTAAL_MIN + '% per jaar op, koersstijging plus dividend?') +
      (t ? '<div class="kpis">' + kpv(pct(t.koers), 'Koersstijging per jaar tot de hoge koers') + kpv(t.dividend == null ? '–' : pct(t.dividend), 'Gemiddeld dividendrendement') + kpv('<span style="color:' + (t.ok ? 'var(--ok-ink)' : 'var(--bad-ink)') + '">' + pct(t.totaal) + '</span>', 'Totaalrendement per jaar (NAIC: minstens ' + t.min + '%)') + '</div>' : '<p class="zacht">Niet te berekenen zonder verse koers in dezelfde valuta als de winst.</p>') +
      (n.par ? '<p data-par>Verwacht gemiddeld rendement (PAR): <b>' + pct(n.par.pct) + ' per jaar</b>, als de koers over ' + (n.horizon || 5) + ' jaar uitkomt op de gemiddelde K/W (' + getal(n.par.koersDoel, 2) + '). Ter informatie.</p>' : '') +
      (kp5 && kp5.prijs ? '<p data-koopprijs-gids>Koopprijs: alle prijsregels uit stap 4 tot 6 kloppen onder <b>' + getal(kp5.prijs, 2) + '</b>.</p>' : '') + '</section>';
    return s + naicExtraHtml(jr, bank);
  }
  function zonesHtml(start, opgeslagen, koersVgl) {
    if (opgeslagen) start = { eps: opgeslagen.eps, groei: opgeslagen.groeiPct, epsl: opgeslagen.epsLaag, jaren: opgeslagen.jaren, kwh: opgeslagen.kwHoog, kwl: opgeslagen.kwLaag };
    else start = { eps: start.eps, groei: start.groei, epsl: start.eps, jaren: 5, kwh: 20, kwl: 10 };
    return '<div class="kaart-plat"><h3>Zelf rekenen: uw eigen koerszones</h3><p class="zacht">Wilt u met andere aannames rekenen dan de gids? Pas de getallen aan. Dit verandert het NAIC-oordeel niet.</p><div class="velden">' +
      veld('z-eps', 'Winst per aandeel nu', start.eps, '0.01') + veld('z-groei', 'Groei per jaar (%)', start.groei, '1') + veld('z-jaren', 'Jaren vooruit', start.jaren, '1') +
      veld('z-kwh', 'Hoge K/W', start.kwh, '1') + veld('z-kwl', 'Lage K/W', start.kwl, '1') + veld('z-epsl', 'Winst per aandeel in een slecht jaar', start.epsl, '0.01') +
      '</div><div id="zones" aria-live="polite"' + (koersVgl ? ' data-vergelijk="1"' : '') + '></div><div class="knoppen"><button class="knop klein" id="z-bewaar">Bewaar mijn zones</button><button class="knop rand klein" id="z-wis" hidden>Wis bewaarde zones</button></div><p class="zacht" id="z-status" aria-live="polite">Bewaard op dit toestel, zodat Start laat zien waar de koers in uw zones staat. Het is uw eigen aanname, geen koersdoel.</p></div>';
  }
  function zonesKoppel(rec, r) {
    var uit = document.getElementById('zones'); if (!uit) return;
    function lees(id) { return parseFloat(String(document.getElementById('v-' + id).value).replace(',', '.')); }
    var ZN = { koop: 'in het onderste derde van het bereik (positieve zone)', houd: 'in het middelste derde van het bereik (neutrale zone)', verkoop: 'in het bovenste derde van het bereik (zone om te vermijden)', onder: 'onder de lage koers uit uw aannames', boven: 'boven de hoge koers uit uw aannames' };
    function reken() {
      try {
        var koers = (r.bevestigd || uit.getAttribute('data-vergelijk')) && rec.koers && r.koersActueel ? rec.koers.slot : null;
        var z = Naic.koerszones({ eps: lees('z-eps'), epsLaag: lees('z-epsl'), groeiPct: lees('z-groei'), jaren: lees('z-jaren'), kwHoog: lees('z-kwh'), kwLaag: lees('z-kwl'), koers: koers });
        var W = 320, p = function (v) { return Math.max(0, Math.min(1, (v - z.laag) / (z.hoog - z.laag))) * W; };
        var balk = '<svg class="grafiek" viewBox="0 0 320 54" role="img" aria-label="Koerszones van laag naar hoog"><rect x="0" y="14" width="' + (W / 3) + '" height="16" fill="var(--ok-bg)" stroke="var(--ok-ink)"/><rect x="' + (W / 3) + '" y="14" width="' + (W / 3) + '" height="16" fill="var(--wait-bg)" stroke="var(--wait-ink)"/><rect x="' + (2 * W / 3) + '" y="14" width="' + (W / 3) + '" height="16" fill="var(--bad-bg, var(--line))" stroke="var(--bad-ink)"/>' +
          (koers != null ? '<path d="M' + p(koers).toFixed(1) + ' 8 v28" stroke="var(--ink)" stroke-width="3"/><text text-anchor="middle" x="' + Math.max(24, Math.min(296, p(koers))).toFixed(1) + '" y="52">nu ' + getal(koers, 2) + '</text>' : '') + '<text x="0" y="10">' + getal(z.laag, 2) + '</text><text text-anchor="end" x="320" y="10">' + getal(z.hoog, 2) + '</text></svg>';
        var rest = koers == null
          ? '<div class="melding"><b>Geen vergelijking met de koers</b><span>De gegevens zijn nog niet volledig bevestigd of de koers ontbreekt. De zones hierboven zijn alleen uw eigen aannames.</span></div>'
          : '<div class="kpis"><div class="kpi"><b>' + (z.verhouding == null ? '–' : getal(z.verhouding, 1) + ' : 1') + '</b><span>Opwaarts tegen neerwaarts (NAIC-richtlijn: 3 : 1 of hoger)</span></div><div class="kpi"><b>' + pct(z.rendementPerJaar) + '</b><span>Mogelijk rendement per jaar tot de hoge koers, zonder dividend</span></div></div><p>De koers van ' + getal(koers, 2) + ' ' + h(rec.valuta) + ' ligt ' + ZN[z.zone] + '.</p>';
        uit.innerHTML = '<div class="kpis"><div class="kpi"><b>' + getal(z.hoog, 2) + '</b><span>Hoge koers over ' + lees('z-jaren') + ' jaar</span></div><div class="kpi"><b>' + getal(z.laag, 2) + '</b><span>Lage koers</span></div></div>' + balk + rest;
      } catch (e) { uit.innerHTML = '<div class="melding"><b>Controleer de getallen</b><span>' + h(e.message) + '</span></div>'; }
    }
    ['z-eps', 'z-groei', 'z-jaren', 'z-kwh', 'z-kwl', 'z-epsl'].forEach(function (i) { document.getElementById('v-' + i).addEventListener('input', reken); });
    var ov = document.getElementById('kw-over');
    if (ov) ov.addEventListener('click', function () {
      document.getElementById('v-z-kwh').value = ov.getAttribute('data-kwh'); document.getElementById('v-z-kwl').value = ov.getAttribute('data-kwl');
      reken(); toast('K/W overgenomen. Vergeet niet te bewaren als u ze wilt houden.');
    });
    var wis = document.getElementById('z-wis'), st = document.getElementById('z-status');
    wis.hidden = !winkel.zones(rec.ticker);
    document.getElementById('z-bewaar').addEventListener('click', function () {
      var u = winkel.zetZones(rec.ticker, { eps: lees('z-eps'), epsLaag: lees('z-epsl'), groeiPct: lees('z-groei'), jaren: lees('z-jaren'), kwHoog: lees('z-kwh'), kwLaag: lees('z-kwl') });
      if (u.ok) { st.textContent = 'Bewaard. Op Start ziet u nu waar de koers in uw zones staat.'; wis.hidden = false; toast('Koerszones bewaard'); }
      else toast(u.reden || 'Opslaan is niet gelukt. Maak een back-up.');
    });
    wis.addEventListener('click', function () { var oud = winkel.zones(rec.ticker); winkel.wisZones(rec.ticker); wis.hidden = true; st.textContent = 'Bewaarde zones gewist.'; toast('Zones gewist', function () { winkel.zetZones(rec.ticker, oud); route(); }); });
    reken();
  }
  function waardeHtml(rec, g, jr, r) {
    var ev = g && g.eps_status === 'independently_verified' && g.eps_verified_years >= Gate.REQUIRED_EPS_YEARS;
    // Zelfde drempel als het NAIC-oordeel: minstens 4 jaar winst per aandeel op een bekend niveau (bevestigd, uit jaarverslag of
    // indicatief). Zo staat er nooit een NAIC-oordeel op Overzicht terwijl dit tabblad leeg blijft.
    var b = signaalVoor(rec), n = b.naic;
    if (!ev && !(b.niveau && n && n.groeiHistorisch !== null)) return '<div class="melding"><b>Nog geen NAIC-gids</b><span>' + h(n && n.reden ? n.reden : 'Er zijn te weinig jaarcijfers.') + ' De NAIC-gids vraagt minstens 4 jaar winst per aandeel.</span></div>';
    var koersVgl = !!(r.bevestigd || (n && n.zones && n.zones.koers != null));
    var noot = ev ? '' : '<div class="melding" data-naic-niveau="' + h(b.niveau) + '"><b>Gegevens: ' + h(Signaal.KWALITEIT[b.niveau] ? Signaal.KWALITEIT[b.niveau].naam : b.niveau) + '</b><span>' +
      (b.niveau === 'indicatief' ? 'Deze cijfers komen (deels) van Yahoo Finance of uit door u aangeleverde cijfers, en zijn niet nagerekend.' : 'Deze cijfers komen uit de officiële jaarverslagen maar de winst per aandeel is niet onafhankelijk nagerekend.') +
      ' De gids rekent er wel mee, net als het NAIC-oordeel op Overzicht; alleen het label bij de plek in het koersbereik verschijnt pas bij bevestigde gegevens.</span></div>';
    var epsJr = jr.filter(function (j) { return typeof j.comparable_eps === 'number' && j.comparable_eps > 0; });
    var laatste = epsJr[epsJr.length - 1], eerste = epsJr[0];
    var gr = laatste && eerste && laatste.year > eerste.year ? groei(eerste.comparable_eps, laatste.comparable_eps, laatste.year - eerste.year) : null;
    var start = { eps: laatste ? Math.round(laatste.comparable_eps * 100) / 100 : 1, groei: gr == null ? 5 : Math.max(0, Math.min(15, Math.round(gr))), kw: 15, jaren: 5, rend: 10, marge: 25 };
    return noot + naicHtml(jr, b.bank || (g.waarschuwingen || []).some(function (w) { return /^Bank:/.test(w); }), r.koersActueel && rec.koers ? rec.koers.slot : null, r.bevestigd, n, zonesHtml(start, winkel.zones(rec.ticker), koersVgl));
  }
  function veld(id, tekst, v, stap) { return '<div><label for="v-' + id + '">' + h(tekst) + '</label><input id="v-' + id + '" type="number" inputmode="decimal" step="' + stap + '" value="' + h(v) + '"></div>'; }
  function gezondHtml(g, jr) {
    if (!g || !jr.length) return '<div class="melding"><b>Nog geen jaarcijfers</b><span>Deze gegevens worden door de nachtelijke update opgehaald zodra dit aandeel is gecontroleerd.</span></div>';
    var f = jr[0], l = jr[jr.length - 1], n = l.year - f.year;
    var gs = groei(f.sales, l.sales, n), gw = groei(f.comparable_eps, l.comparable_eps, n);
    var fcf = typeof l.operating_cash_flow === 'number' && typeof l.capex === 'number' ? l.operating_cash_flow - Math.abs(l.capex) : null;
    var kp = '<div class="kpis"><div class="kpi"><b>' + (gs == null ? '–' : pct(gs)) + '</b><span>Omzetgroei per jaar (' + f.year + '–' + l.year + ')</span></div><div class="kpi"><b>' + (gw == null ? '–' : pct(gw)) + '</b><span>Groei winst per aandeel per jaar</span></div><div class="kpi"><b>' + mld(fcf) + '</b><span>Vrije kasstroom ' + l.year + ' (' + h(l.currency) + ')</span></div></div>';
    var rows = [['Omzet', function (j) { return mld(j.sales); }], ['Nettowinst', function (j) { return mld(j.net_income); }], ['EPS gemeld', function (j) { return getal(j.reported_eps, 2); }], ['EPS vergelijkbaar', function (j) { return getal(j.comparable_eps, 2); }], ['Kasstroom bedrijf', function (j) { return mld(j.operating_cash_flow); }], ['Investeringen', function (j) { return mld(j.capex); }], ['Eigen vermogen', function (j) { return mld(j.equity); }], ['EPS-controle', function (j) { return j.eps_check || '–'; }]];
    var tb = '<div class="schuif"><table><thead><tr><th></th>' + jr.map(function (j) { return '<th>' + j.year + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (rw) { return '<tr><th scope="row">' + h(rw[0]) + '</th>' + jr.map(function (j) { return '<td' + (rw[0] === 'EPS vergelijkbaar' ? ' class="omg"' : '') + '>' + h(rw[1](j)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    return kp + '<div class="kaart-plat"><h2>Winst per aandeel</h2><p class="zacht">Omgerekend voor aandelensplitsingen, zodat alle jaren vergelijkbaar zijn.</p>' + epsBalken(jr) + '</div><section><h2>Jaarcijfers (in miljarden, ' + h(l.currency) + ')</h2>' + tb + '</section>';
  }
  var SPLIT = { candidate: 'Splitsing herkend en gecontroleerd met herziene jaarcijfers', niet_van_toepassing: 'Geen invloed: ligt vóór het eerste jaar in het dossier', dubbel: 'Dezelfde splitsing onder een andere datum (de aankondiging); telt niet mee', rejected: 'Niet bevestigd door de herziene jaarcijfers; daarom niet gebruikt', bevestigd: 'Bevestigd' };
  function bronHtml(rec, g) {
    if (!g) return '<div class="melding"><b>Nog geen bronnen</b><span>Nog niet gecontroleerd.</span></div>';
    var s = '<div class="kaart-plat"><h2>Waar komen de cijfers vandaan?</h2><p>Jaarcijfers: SEC (Amerikaanse toezichthouder) en, voor Europese bedrijven, jaarverslagen in ESEF-formaat. Waar die er niet zijn (bijvoorbeeld bij veel Duitse bedrijven) gebruikt de app indicatieve cijfers van Yahoo Finance; die zijn niet nagerekend en tellen minder zwaar mee. Koersen: Yahoo Finance. Gecontroleerd op ' + h(datumNl(g.gecontroleerd_op)) + '.</p></div>';
    if (g.splits && g.splits.length) s += '<section><h2>Aandelensplitsingen</h2>' + g.splits.map(function (sp) {
      return '<details><summary>' + h(datumNl(sp.datum)) + ' · ' + h(splitTekst(sp.ratio)) + '</summary><p>' + h(SPLIT[sp.status] || sp.status) + '.</p>' + (sp.redenen || []).map(function (x) { return '<p class="zacht">' + h(x) + '</p>'; }).join('') +
        (sp.bewijs && sp.bewijs.length ? '<ul class="punten">' + sp.bewijs.map(function (b) { return '<li>Boekjaar ' + h(b.periode) + ': winst per aandeel ' + h(b.voor.join('/')) + ' werd later ' + h(b.na.join('/')) + ' (factor ' + h(b.verhouding.join('/')) + ')</li>'; }).join('') + '</ul>' : '') + '</details>';
    }).join('') + '</section>';
    if (g.eps_jaarverslag && Array.isArray(g.eps_jaarverslag.documenten)) {
      var ej = g.eps_jaarverslag;
      s += '<section data-eps-jaarverslag><h2>Winst per aandeel uit de jaarverslagen</h2><p>' + h(ej.uitleg || '') + ' ' + ej.jaren + ' jaar (' + ej.van + '–' + ej.tot + ').' + (ej.controle && ej.controle.vergeleken ? ' Tweede bron: in ' + ej.controle.overeen + ' van de ' + ej.controle.vergeleken + ' jaren die Yahoo Finance ook heeft, klopt het cijfer (binnen 5%)' + (ej.controle.afwijkend && ej.controle.afwijkend.length ? '; afwijkend: ' + ej.controle.afwijkend.join(', ') + ' (bijv. andere aandelensoort of herziening)' : '') + '.' : '') + ' Omzet, kasstroom en balans blijven indicatief (Yahoo Finance).</p><ul class="punten">' +
        ej.documenten.filter(function (d) { return d && /^https?:\/\//.test(d.url || ''); }).map(function (d) { return '<li>Jaarverslag ' + h(d.boekjaar) + (d.pagina ? ', pagina ' + h(d.pagina) : '') + ': <a href="' + h(d.url) + '" target="_blank" rel="noopener">document</a></li>'; }).join('') + '</ul></section>';
    }
    if (g.jaarcijfers_pdf) {
      var VN = { sales: 'omzet', pretax_income: 'winst vóór belasting', net_income: 'nettowinst', equity: 'eigen vermogen' };
      var gebruikt = Object.keys(g.jaarcijfers_pdf).filter(function (k) { return g.jaarcijfers_pdf[k].gebruikt && g.jaarcijfers_pdf[k].aangevuld; });
      if (gebruikt.length) s += '<section data-jaarcijfers-pdf><h2>Oudere jaarcijfers uit de jaarverslagen</h2><p>Aangevuld uit de pdf-jaarverslagen: ' + gebruikt.map(function (k) { var x = g.jaarcijfers_pdf[k]; return h(VN[k] || k) + ' (' + x.aangevuld + ' jaar extra)'; }).join(', ') +
        '. Alleen gebruikt waar de reeks in de gedeelde jaren klopt met Yahoo Finance (binnen 5%); een cijfer van Yahoo wordt nooit vervangen.</p></section>';
    }
    if (g.aangeleverd) {
      var AV = g.aangeleverd, VN2 = { comparable_eps: 'winst per aandeel', reported_eps: 'gerapporteerde winst per aandeel', sales: 'omzet', pretax_income: 'winst vóór belasting', net_income: 'nettowinst', equity: 'eigen vermogen', shares_diluted: 'aantal aandelen', operating_cash_flow: 'kasstroom', capex: 'investeringen', total_assets: 'bezittingen', total_liabilities: 'verplichtingen' };
      var gew = Object.keys(AV.geweigerd || {}).reduce(function (a, k) { return a + AV.geweigerd[k]; }, 0);
      s += '<section data-aangeleverd><h2>Door u aangeleverde cijfers</h2><p>' + h(AV.uitleg || '') + '</p><p>Aangevuld: ' + Object.keys(AV.velden || {}).map(function (k) { return h(VN2[k] || k) + ' (' + AV.velden[k] + ' jaar)'; }).join(', ') + '.' +
        (AV.eps_jaren ? ' Omdat de winst per aandeel deels aangeleverd is, heet het fonds “Indicatief”.' : '') + (gew || AV.valuta ? ' Niet gebruikt: ' + [gew ? gew + ' cijfers die meer dan een factor 10 afweken van het jaar ernaast' : '', AV.valuta ? AV.valuta + ' jaren in een andere valuta dan de jaarcijfers' : ''].filter(Boolean).join(' en ') + '.' : '') + '</p></section>';
    }
    if (g.eps_yahoo) s += '<section data-eps-yahoo><h2>Winst per aandeel van Yahoo Finance</h2><p>' + h(g.eps_yahoo.uitleg || '') + ' ' + g.eps_yahoo.jaren + ' jaar.</p></section>';
    if (g.eps_toelichting) s += '<section><h2>Toelichting bij de controle</h2><p>' + h(g.eps_toelichting) + '</p></section>';
    var open = jaarLijst(g).filter(function (j) { return j.eps_check !== 'onderbouwd'; });
    if (open.length) s += '<section><h2>Jaren zonder onderbouwde winst per aandeel</h2><ul class="punten">' + open.map(function (j) {
      return '<li><b>' + j.year + '</b>: ' + h(j.eps_reden || 'nog geen onafhankelijke bevestiging beschikbaar') + '</li>'; }).join('') + '</ul></section>';
    if (g.waarschuwingen && g.waarschuwingen.length) s += '<section><h2>Let op</h2><ul class="punten">' + g.waarschuwingen.map(function (w) { return '<li>' + h(w) + '</li>'; }).join('') + '</ul></section>';
    return s;
  }
  var ANTW_TEKST = { ja: 'Ja', nee: 'Nee', onzeker: 'Weet ik niet' };
  /* Timing-informatie: los van het signaal; verandert het oordeel nooit. */
  function timingHtml(rec, fr) {
    var t = Timing.timing(rec.koers, fr.fresh);
    if (!t) return fr.fresh ? '<div class="kaart-plat" data-timing><h2>Timing (informatie)</h2><p class="zacht">Te weinig koersgeschiedenis voor trendcijfers; de app toont dan liever niets dan een schatting.</p></div>' : '';
    var regels = [];
    if (t.trend50) regels.push('Korte trend: de koers staat <b>' + t.trend50 + '</b> het gemiddelde van 50 dagen.');
    if (t.trend200) regels.push('Lange trend: de koers staat <b>' + t.trend200 + '</b> het gemiddelde van 200 dagen (' + pct(t.afstand200Pct) + ').');
    if (t.rangePct != null) regels.push('Jaarbereik: ' + getal(t.rangePct, 0) + '% tussen laagste en hoogste koers van het afgelopen jaar, ' + t.rangeTekst + '.');
    if (t.rsi != null) regels.push('RSI (14 dagen) is ' + getal(t.rsi, 0) + ': ' + t.rsiTekst + '.');
    return '<div class="kaart-plat" data-timing><h2>Timing (informatie)</h2><ul>' + regels.map(function (x) { return '<li>' + x + '</li>'; }).join('') +
      '</ul><p class="zacht">Dit zegt iets over het koersverloop in het verleden, niet over de waarde van het bedrijf en niet over wat de koers gaat doen. Het heeft geen invloed op het signaal.</p></div>';
  }

  function voortgangTekst(v) { return v.beantwoord + ' van ' + v.totaal + ' beantwoord' + (v.beantwoord ? ' (' + v.ja + ' ja, ' + v.nee + ' nee, ' + v.onzeker + ' weet ik niet)' : ''); }
  function verdiepHtml(rec) {
    var b = signaalVoor(rec), v = winkel.verdieping(rec.ticker);
    var s = '<div class="kaart-plat" data-verdiepen><h2>Verdiepen</h2><p class="zacht">Leg hier vast wat u zelf over dit aandeel weet. Uw beoordeling staat bij het aandeel ter informatie en telt niet mee in het oordeel. Een ontbrekend cijfer dat u invult (uit het jaarverslag) vult wel de bijbehorende meting aan, en vervangt nooit een cijfer uit het jaarverslag. Alles blijft op dit toestel en zit in uw back-up.</p><div id="vd-meter">' + verdiepMeterHtml(b) + '</div></div>';
    var bo = b.methoden.filter(function (m) { return m.beoordeling; });
    s += '<div class="kaart-plat"><h2>Uw eigen beoordeling</h2><p class="zacht">Geef een cijfer van 1 (slecht) tot 5 (uitstekend); 3 is neutraal. Klik nogmaals op uw cijfer om het weg te halen.</p>' + bo.map(function (m) {
      var cur = v.scores[m.id];
      return '<div class="vd" data-vd-score="' + m.id + '"><b>' + h(m.beoordeling.label) + '</b><p class="zacht">' + h(m.beoordeling.waar) + '</p><div class="knoppen" role="group" aria-label="' + h(m.beoordeling.label) + '">' + [1, 2, 3, 4, 5].map(function (n) {
        return '<button class="knop rand klein" type="button" data-cijfer="' + n + '" aria-pressed="' + (cur === n) + '">' + n + '</button>';
      }).join('') + '</div><label for="vd-n-' + m.id + '" class="zacht">Notitie (mag leeg)</label><textarea id="vd-n-' + m.id + '" rows="2" maxlength="500" style="width:100%;border-radius:12px;border:1px solid var(--line);background:var(--surface);color:var(--ink);padding:10px">' + h(v.notities[m.id] || '') + '</textarea></div>';
    }).join('') + '</div>';
    var ci = b.methoden.filter(function (m) { return m.invoer && (!m.aanwezig || m.kwaliteit === 'eigen'); });
    if (ci.length) s += '<div class="kaart-plat"><h2>Cijfers die ontbreken</h2><p class="zacht">Deze cijfers staan niet in de gegevens van de app. Weet u ze uit het jaarverslag of een andere bron, vul ze dan in. Laat leeg als u het niet weet.</p>' + ci.map(function (m) {
      var cur = v.cijfers[m.id];
      return '<div class="vd" data-vd-cijfer="' + m.id + '"><label for="vd-c-' + m.id + '"><b>' + h(m.invoer.label) + '</b></label><p class="zacht">' + h(m.invoer.waar) + '</p><input id="vd-c-' + m.id + '" type="text" inputmode="decimal" autocomplete="off" value="' + (typeof cur === 'number' ? h(String(cur).replace('.', ',')) : '') + '"><span class="zacht" data-vd-fout role="alert" style="color:var(--bad-ink)"></span></div>';
    }).join('') + '</div>';
    return s;
  }
  function verdiepMeterHtml(b) {
    return '<p>' + oordeelChip(b) + ' <span class="zacht" data-dekking="' + b.dekking + '">' + telTekst(b) + '</span></p>' + stippen(b) +
      '<p class="zacht">Uw eigen beoordeling staat bij het aandeel ter informatie en telt niet mee in het oordeel. Een cijfer dat u invult (een feit uit het jaarverslag) vult wel een ontbrekende meting aan.</p>' +
      (b.ontbreekt.length ? '<p class="zacht">Ontbrekende metingen: ' + b.ontbreekt.map(h).join(', ') + '.</p>' : '<p class="zacht">Alle metingen zijn beschikbaar.</p>');
  }
  function verdiepKoppel(rec) {
    function ververs() { var el = document.getElementById('vd-meter'); if (el) el.innerHTML = verdiepMeterHtml(signaalVoor(rec)); }
    Array.prototype.forEach.call(document.querySelectorAll('[data-vd-score]'), function (k) {
      var id = k.getAttribute('data-vd-score'), ta = k.querySelector('textarea');
      Array.prototype.forEach.call(k.querySelectorAll('[data-cijfer]'), function (bt) {
        bt.addEventListener('click', function () {
          var nu = bt.getAttribute('aria-pressed') === 'true' ? null : Number(bt.getAttribute('data-cijfer'));
          var u = winkel.zetVerdieping(rec.ticker, 'scores', id, nu);
          if (!u.ok) { toast(u.reden || 'Opslaan is niet gelukt. Maak een back-up.'); return; }
          Array.prototype.forEach.call(k.querySelectorAll('[data-cijfer]'), function (x) { x.setAttribute('aria-pressed', String(nu !== null && Number(x.getAttribute('data-cijfer')) === nu)); });
          ververs();
        });
      });
      ta.addEventListener('change', function () { var u = winkel.zetVerdieping(rec.ticker, 'notities', id, ta.value); if (!u.ok) toast(u.reden || 'Opslaan is niet gelukt. Maak een back-up.'); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-vd-cijfer]'), function (k) {
      var id = k.getAttribute('data-vd-cijfer'), inp = k.querySelector('input'), fout = k.querySelector('[data-vd-fout]');
      inp.addEventListener('change', function () {
        var u = winkel.zetVerdieping(rec.ticker, 'cijfers', id, inp.value);
        fout.textContent = u.ok ? '' : (u.reden || 'Opslaan is niet gelukt.');
        if (u.ok) ververs();
      });
    });
  }
  function checkHtml(rec) {
    var ant = winkel.checklist(rec.ticker), s = '<div class="kaart-plat"><h2>Kwaliteitscheck</h2><p class="zacht">De 15 punten van Philip Fisher over concurrentiepositie en management, ook gebruikt door NAIC-beleggers. U vult zelf in wat u weet. De app beoordeelt niets en geeft geen score; ze telt alleen hoeveel punten u beantwoord heeft. Wat u hier schrijft blijft op dit toestel en zit in uw back-up.</p><p id="ck-voortgang" aria-live="polite"><b>' + h(voortgangTekst(Checklist.voortgang(ant))) + '</b></p></div>';
    ['Concurrentiepositie', 'Management', 'Financieel'].forEach(function (gn) { s += '<h3>' + h(gn) + '</h3>'; Checklist.PUNTEN.filter(function (p) { return p.groep === gn; }).forEach(function (p) {
      var a = ant[p.id] || { a: null, n: '' };
      s += '<div class="kaart-plat ck" data-punt="' + p.id + '"><p><b>' + p.id + '. ' + h(p.tekst) + '</b></p><div class="keuze" role="group" aria-label="Antwoord op punt ' + p.id + '">' +
        Checklist.ANTWOORDEN.map(function (k) { return '<button type="button" data-ant="' + k + '" aria-pressed="' + (a.a === k) + '">' + h(ANTW_TEKST[k]) + '</button>'; }).join('') + '</div>' +
        '<details><summary>Waar vind ik dit?</summary><p class="zacht">' + h(p.waar) + '</p></details>' +
        '<label for="ck-n' + p.id + '" class="zacht">Eigen notitie</label><textarea id="ck-n' + p.id + '" rows="2" maxlength="' + Store.MAX_NOTITIE + '">' + h(a.n) + '</textarea></div>';
    }); });
    return s;
  }
  function checkKoppel(rec) {
    function werk() { var el = document.getElementById('ck-voortgang'); if (el) el.innerHTML = '<b>' + h(voortgangTekst(Checklist.voortgang(winkel.checklist(rec.ticker)))) + '</b>'; var vm = document.getElementById('vd-meter'); if (vm) vm.innerHTML = verdiepMeterHtml(signaalVoor(rec)); }
    Array.prototype.forEach.call(document.querySelectorAll('.ck'), function (k) {
      var id = Number(k.getAttribute('data-punt')), ta = k.querySelector('textarea');
      Array.prototype.forEach.call(k.querySelectorAll('[data-ant]'), function (b) {
        b.addEventListener('click', function () {
          var nu = b.getAttribute('aria-pressed') === 'true' ? null : b.getAttribute('data-ant');   // nogmaals klikken haalt het antwoord weg
          var u = winkel.zetPunt(rec.ticker, id, nu, undefined);
          if (!u.ok) { toast('Opslaan is niet gelukt. Maak een back-up.'); return; }
          Array.prototype.forEach.call(k.querySelectorAll('[data-ant]'), function (x) { x.setAttribute('aria-pressed', String(x === b && nu !== null)); });
          werk();
        });
      });
      ta.addEventListener('change', function () { var u = winkel.zetPunt(rec.ticker, id, undefined, ta.value); if (!u.ok) toast('Opslaan is niet gelukt. Maak een back-up.'); werk(); });
    });
  }
  function aandeelKoppel(t) {
    var ngb = document.getElementById('ng-bewaar'), ngw = document.getElementById('ng-wis');
    if (ngb) ngb.addEventListener('click', function () {
      var v = String(document.getElementById('ng-in').value).replace(',', '.').trim();
      var u = winkel.zetVerdieping(t, 'cijfers', 'naicgroei', v === '' ? null : v);
      if (!u.ok) { toast(u.reden || 'Controleer het getal'); return; }
      fondsItemsCache = null; toast(v === '' ? 'De app rekent weer met de trend' : 'NAIC rekent nu met uw groeiverwachting'); route();
    });
    if (ngw) ngw.addEventListener('click', function () { winkel.zetVerdieping(t, 'cijfers', 'naicgroei', null); fondsItemsCache = null; toast('De app rekent weer met de trend'); route(); });
    var tg = document.getElementById('terug');
    if (tg) tg.addEventListener('click', function (e) { if (history.length > 1) { e.preventDefault(); history.back(); } });
    var ad = document.getElementById('afdruk');
    if (ad) ad.addEventListener('click', function () { var rec = zoek(t); if (rec) afdrukken(rec); });
    var b = document.getElementById('volg'); if (!b) return;
    b.addEventListener('click', function () {
      var rec = zoek(t), oud = winkel.volglijst().filter(function (x) { return x.ticker === t; })[0];
      if (winkel.zit(t)) { winkel.verwijder(t); toast('Van uw volglijst gehaald', function () { winkel.voegToe(t, oud && oud.sinds); route(); }); }
      else { var u = winkel.voegToe(t, rec ? momentopname(rec) : null); toast(u.ok ? 'Op uw volglijst gezet' : (u.reden || 'Opslaan niet gelukt')); }
      route();
    });
  }

  /* Eén fonds op papier of als PDF: alle gegevens, de berekening en de uitleg, in een nieuw venster met een afdrukknop.
     Lukt een nieuw venster niet (pop-ups geblokkeerd), dan direct afdrukken via een onzichtbaar frame. */
  function afdrukken(rec) {
    var html;
    try { html = Afdruk.pagina(rec, signaalVoor(rec, true), { Naic: Naic, Gate: Gate, vandaag: vandaag(), gemaakt: DATA.gemaakt, uitleg: UITLEG.termen, werkbalk: true }); }
    catch (e) { toast('Afdrukken lukt niet voor dit aandeel'); return; }
    var w = null;
    try { w = window.open('', '_blank'); } catch (e2) { w = null; }
    if (w && w.document) { w.document.open(); w.document.write(html); w.document.close(); try { w.focus(); } catch (e3) { /* niet nodig */ } return; }
    var f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(f);
    var d = f.contentWindow.document; d.open(); d.write(html.replace('<div class="werkbalk">', '<div class="werkbalk" hidden>')); d.close();
    setTimeout(function () {
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e4) { toast('Afdrukken lukt niet in deze browser'); }
      setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 60000);
    }, 300);
  }

  function toonMethode(id) {
    var m = laatsteBeoordeling && laatsteBeoordeling.methoden.filter(function (x) { return x.id === id; })[0];
    if (!m) return;
    var vorige = document.activeElement, K = Signaal.KWALITEIT;
    var oordeel = !m.aanwezig ? 'Ontbreekt: telt niet mee' : m.score >= 0.25 ? 'Gunstig' : m.score <= -0.25 ? 'Ongunstig' : 'Neutraal';
    var delen = ['<h2 id="mt-t">' + h(m.naam) + '</h2>', '<p><b>' + h(oordeel) + '</b>' + (m.aanwezig ? ' · score ' + getal(m.score, 2) + ' (van −1 tot +1)' : '') + '</p>'];
    if (m.tekst) delen.push('<p>' + h(m.tekst) + '</p>');
    if (m.wat) delen.push('<h3>Wat meet dit?</h3><p>' + h(m.wat) + '</p>');
    if (m.detail && m.detail.length) delen.push('<h3>Dit zijn de cijfers voor dit aandeel</h3><ul class="punten">' + m.detail.map(function (x) { return '<li>' + h(x) + '</li>'; }).join('') + '</ul>');
    if (m.schaal) delen.push('<h3>Hoe wordt het beoordeeld?</h3><p>' + h(m.schaal) + '</p>');
    if (!m.aanwezig && m.nodig) delen.push('<h3>Wat is er nodig?</h3><p>' + h(m.nodig) + '</p>');
    delen.push('<h3>Gewicht en betrouwbaarheid</h3><p>Gewicht ' + m.gewicht + ' van de ' + Signaal.METHODEN.reduce(function (a, x) { return a + x.gewicht; }, 0) + '.' + (m.aanwezig ? ' Bron: ' + h(K[m.kwaliteit].naam) + ' (telt voor ' + Math.round(K[m.kwaliteit].factor * 100) + '%).' : '') + '</p>');
    delen.push('<p class="zacht">Eén methode zegt weinig; het oordeel komt uit alle methoden samen.</p>');
    $laag.innerHTML = '<div class="intro-achter" id="mt-achter"><div class="intro hulp-blad" role="dialog" aria-modal="true" aria-labelledby="mt-t">' + delen.join('') + '<div class="knoppen"><button class="knop" id="mt-sluit">Sluiten</button></div></div></div>';
    function sluit() { $laag.innerHTML = ''; document.removeEventListener('keydown', toets); if (vorige && vorige.focus) { try { vorige.focus(); } catch (e) { /* geen focus */ } } }
    function toets(e) { if (e.key === 'Escape') sluit(); }
    document.addEventListener('keydown', toets);
    document.getElementById('mt-sluit').addEventListener('click', sluit);
    document.getElementById('mt-achter').addEventListener('click', function (e) { if (e.target.id === 'mt-achter') sluit(); });
    document.getElementById('mt-sluit').focus();
  }
  document.addEventListener('click', function (e) { var k = e.target.closest ? e.target.closest('[data-methode]') : null; if (k) toonMethode(k.getAttribute('data-methode')); });

  function toonPaginaHulp() {
    var x = Hulp.voor(Hulp.sleutelVoorHash(location.hash)), vorige = document.activeElement;
    $laag.innerHTML = '<div class="intro-achter" id="ph-achter"><div class="intro hulp-blad" role="dialog" aria-modal="true" aria-labelledby="ph-t"><h2 id="ph-t">' + h(x.titel) + '</h2><p>' + h(x.intro) + '</p>' +
      '<ul class="punten">' + x.punten.map(function (p) { return '<li>' + h(p) + '</li>'; }).join('') + '</ul>' + (x.tip ? '<p class="zacht">' + h(x.tip) + '</p>' : '') +
      '<div class="knoppen"><button class="knop" id="ph-sluit">Sluiten</button><a class="knop rand" id="ph-alles" href="#/hulp">Alle uitleg en begrippen</a></div></div></div>';
    function sluit() { $laag.innerHTML = ''; document.removeEventListener('keydown', toets); if (vorige && vorige.focus) { try { vorige.focus(); } catch (e) { /* geen focus */ } } }
    function toets(e) { if (e.key === 'Escape') sluit(); }
    document.addEventListener('keydown', toets);
    document.getElementById('ph-sluit').addEventListener('click', sluit);
    document.getElementById('ph-alles').addEventListener('click', function () { $laag.innerHTML = ''; document.removeEventListener('keydown', toets); });
    document.getElementById('ph-achter').addEventListener('click', function (e) { if (e.target.id === 'ph-achter') sluit(); });
    document.getElementById('ph-sluit').focus();
  }
  var hk = document.getElementById('hulp-knop'); if (hk) hk.addEventListener('click', toonPaginaHulp);

  function schermHulp() {
    return '<section><h1>Hulp</h1><div class="kaart-plat"><h2>Zo gebruikt u de app</h2><ul class="punten">' +
      '<li><b>Start</b>: signalen bij uw eigen aandelen, wat er sinds de vorige update veranderde, en de kansrijke aandelen volgens NAIC.</li>' +
      '<li><b>Fondsen</b>: alle aandelen per index, standaard met NAIC Kopen bovenaan. Zoek op naam of beurscode.</li>' +
      '<li>Tik op een aandeel voor details. Onderin kiest u <b>Overzicht</b> (oordeel en bedrijf), <b>Koers</b>, <b>NAIC</b> (de gids in stappen), <b>Verdiepen</b> (uw eigen beoordeling), <b>Cijfers</b> en <b>Bronnen</b>.</li>' +
      '<li>Met de ster zet u een aandeel op uw <b>volglijst</b>; bij <b>Portefeuille</b> voert u aankopen in.</li>' +
      '<li>Het vraagteken rechtsboven legt uit wat u op de pagina ziet. Het tandwiel opent Instellingen, waar u een back-up maakt.</li></ul></div>' +
      '<div class="kaart-plat"><h2>Hoe komt het oordeel tot stand?</h2><p>Het oordeel (Kopen, Neutraal of Vermijden) volgt de <b>Stock Selection Guide</b> van de NAIC:</p><ul class="punten">' +
      '<li><b>Groeibedrijf?</b> De winst per aandeel groeit minstens ' + Naic.GROEI_MIN + '% per jaar. U kunt bij het aandeel ook uw eigen groeiverwachting invullen.</li>' +
      '<li><b>Goed bedrijf?</b> Omzet en winst groeien gelijk op, en marge en rendement op eigen vermogen dalen niet.</li>' +
      '<li><b>Gunstige prijs?</b> Uit de gemiddelde K/W van 5 jaar volgen een verwachte hoge en lage koers over 5 jaar, in drie zones. Kopen vraagt de koopzone, minstens 3 : 1 opwaarts tegen neerwaarts en minstens ' + Naic.TOTAAL_MIN + '% verwacht rendement per jaar.</li></ul>' +
      '<p>Zes extra metingen (kasstroom, schuld, groei, K/W, koerstrend en koersrust) staan er <b>aanvullend</b> bij en tellen niet mee. Andere kentallen, uw eigen beoordeling en het advies van analisten staan erbij ter informatie. Wat ontbreekt wordt nooit geschat; bij het aandeel staat waarom het ontbreekt.</p>' +
      '<p class="zacht">Teruggerekend over 2018–2025 deden aandelen met NAIC Kopen het gemiddeld beter dan het gemiddelde van alle fondsen en Vermijden slechter, maar dat kwam vooral van een paar uitschieters en is geen bewijs voor de toekomst.</p></div>' +
      '<div class="kaart-plat"><h2>Rondleiding</h2><p class="zacht">Nog eens kijken hoe de app werkt?</p><div class="knoppen"><button class="knop rand" id="intro-opnieuw">Rondleiding bekijken</button></div></div>' +
      '<h2>Wat betekent dit?</h2>' + UITLEG.termen.map(function (x) { return '<details><summary>' + h(x.naam) + '</summary><p>' + h(x.tekst) + '</p></details>'; }).join('') + '<p class="zacht">Aandeel Signaal is een selectiehulp en geen beleggingsadvies.</p></section>';
  }
  function dagenGeleden(iso) { var d = Math.floor((Date.parse(vandaag()) - Date.parse(String(iso).slice(0, 10))) / 86400000); return isNaN(d) ? null : d; }
  function backupKaart() {
    var inh = winkel.inhoud(), lb = inh.laatsteBackup, nodig = winkel.backupNodig(vandaag()), leeg = !inh.volglijst && !inh.portefeuille && !inh.beoordelingen && !inh.checklists;
    var dg = lb ? dagenGeleden(lb) : null, wijz = !!(inh.gewijzigd && lb && inh.gewijzigd > lb);
    var toestand = leeg ? ['ok', 'Er is nog niets om te bewaren.', 'Zodra u een aandeel volgt, een aankoop invoert of een beoordeling geeft, staat het hier.']
      : !lb ? ['let-op', 'U heeft nog geen back-up.', 'Maak er nu een: dan raakt u niets kwijt als dit toestel stuk gaat of de browser wordt leeggemaakt.']
      : wijz ? ['let-op', 'Er is iets veranderd na uw laatste back-up.', 'Laatste back-up: ' + datumNl(lb.slice(0, 10)) + (dg != null ? ' (' + (dg === 0 ? 'vandaag' : dg === 1 ? 'gisteren' : dg + ' dagen geleden') + ')' : '') + '. Maak een nieuwe.']
      : nodig ? ['let-op', 'Uw laatste back-up is al ' + dg + ' dagen oud.', 'Laatste back-up: ' + datumNl(lb.slice(0, 10)) + '. Maak een nieuwe.']
      : ['ok', 'Uw gegevens zijn veilig bewaard.', 'Laatste back-up: ' + datumNl(lb.slice(0, 10)) + (dg != null ? ' (' + (dg === 0 ? 'vandaag' : dg === 1 ? 'gisteren' : dg + ' dagen geleden') + ')' : '') + ', en daarna is er niets veranderd.'];
    var inhoud = leeg ? '' : '<p class="zacht">Nu op dit toestel: ' + [inh.volglijst + ' ' + (inh.volglijst === 1 ? 'aandeel' : 'aandelen') + ' op de volglijst', inh.portefeuille + ' ' + (inh.portefeuille === 1 ? 'aankoop' : 'aankopen'), inh.beoordelingen + ' eigen ' + (inh.beoordelingen === 1 ? 'beoordeling' : 'beoordelingen')].join(' · ') + '.</p>';
    return '<div class="kaart-plat" data-backup><h2>Back-up van uw gegevens</h2><p class="zacht">Uw volglijst, portefeuille en eigen beoordelingen staan alleen op dit toestel, niet op een server. Een back-up is een klein bestand waarmee u alles kunt terugzetten, ook op een ander toestel.</p>' +
      '<div class="bk-status" data-status="' + toestand[0] + '"><b>' + h(toestand[1]) + '</b><span>' + h(toestand[2]) + '</span></div>' + inhoud +
      '<h3>1. Back-up bewaren</h3><p class="zacht">Op een telefoon of tablet opent een menu: kies daar waar het bestand heen moet, bijvoorbeeld <b>Bestanden</b>, <b>Google Drive</b>, <b>OneDrive</b> of een e-mail aan uzelf. Op een computer komt het bestand in de map Downloads; zet het daarna zelf in uw cloudmap.</p>' +
      '<div class="knoppen"><button class="knop" id="bk">Back-up bewaren</button></div><div id="bk-uitslag" aria-live="polite"></div>' +
      '<h3>2. Back-up terugzetten</h3><p class="zacht">Kies het bestand dat u eerder bewaarde (de naam begint met <i>aandeel-signaal-backup</i>). Op een telefoon opent uw Bestanden-app: kies de map of cloud waar u het bewaarde en bekijk eventueel <b>Bladeren</b> in plaats van <b>Recent</b>. U ziet eerst wat erin zit en beslist dan.</p>' +
      '<div class="knoppen"><label class="knop rand" for="her" style="margin:0">Bestand kiezen…</label><input id="her" type="file" accept=".json,application/json,text/plain,*/*" class="sr"></div><div id="her-uitslag" aria-live="polite"></div>' +
      '<details><summary>Lukt het niet met een bestand?</summary><p class="zacht">Dan kan het ook als tekst: kopieer de tekst en bewaar die in een notitie of e-mail. Terugzetten: plak de tekst weer in het vak.</p><label for="bktekst">Tekst van de back-up</label><textarea id="bktekst" rows="5" style="width:100%;border-radius:12px;border:1px solid var(--line);background:var(--surface);color:var(--ink);padding:10px;font:13px ui-monospace,monospace"></textarea><div class="knoppen"><button class="knop rand klein" id="kopie">Tekst kopiëren</button><button class="knop rand klein" id="plak">Terugzetten uit deze tekst</button></div></details></div>';
  }
  function terugzetVenster(tekst, bron) {
    var v = winkel.bekijkBackup(tekst), vorige = document.activeElement, uit = document.getElementById('her-uitslag');
    if (!v.ok) { if (uit) uit.innerHTML = '<div class="bk-status" data-status="let-op"><b>Dit lukt niet</b><span>' + h(v.reden) + ' Kies het bestand dat begint met <i>aandeel-signaal-backup</i>.</span></div>'; return; }
    var inh = winkel.inhoud(), nw = v.nieuw, niets = !nw.volglijst && !nw.portefeuille && !nw.beoordelingen;
    var regel = function (n, enk, mv) { return n + ' ' + (n === 1 ? enk : mv); };
    $laag.innerHTML = '<div class="intro-achter" id="tz-achter"><div class="intro hulp-blad" role="dialog" aria-modal="true" aria-labelledby="tz-t"><h2 id="tz-t">Back-up terugzetten?</h2>' +
      '<p>Gelezen uit ' + h(bron) + (v.gemaakt ? ', gemaakt op ' + h(datumNl(v.gemaakt.slice(0, 10))) : '') + '.</p><h3>Wat zit erin</h3><ul class="punten"><li>' + regel(v.volglijst, 'aandeel op de volglijst', 'aandelen op de volglijst') + '</li><li>' + regel(v.portefeuille, 'aankoop', 'aankopen') + '</li><li>' + regel(v.beoordelingen, 'aandeel met eigen beoordeling', 'aandelen met eigen beoordeling') + '</li></ul>' +
      '<h3>Wat is er nu op dit toestel</h3><ul class="punten"><li>' + regel(inh.volglijst, 'aandeel op de volglijst', 'aandelen op de volglijst') + '</li><li>' + regel(inh.portefeuille, 'aankoop', 'aankopen') + '</li><li>' + regel(inh.beoordelingen, 'aandeel met eigen beoordeling', 'aandelen met eigen beoordeling') + '</li></ul>' +
      '<p><b>' + (niets ? 'Er is niets nieuws: alles uit dit bestand staat al op dit toestel.' : 'Nieuw uit dit bestand: ' + [nw.volglijst ? regel(nw.volglijst, 'volglijst-aandeel', 'volglijst-aandelen') : '', nw.portefeuille ? regel(nw.portefeuille, 'aankoop', 'aankopen') : '', nw.beoordelingen ? regel(nw.beoordelingen, 'beoordeling', 'beoordelingen') : ''].filter(Boolean).join(', ') + '.') + '</b></p>' +
      '<div class="knoppen" style="flex-direction:column;align-items:stretch"><button class="knop" id="tz-voeg"' + (niets ? ' disabled' : '') + '>Toevoegen aan wat er al staat (aanbevolen)</button><button class="knop rand" id="tz-vervang">Alles vervangen door deze back-up</button><button class="knop rand" id="tz-stop">Annuleren</button></div>' +
      '<p class="zacht">Toevoegen wist niets. Vervangen haalt uw huidige volglijst, aankopen en beoordelingen weg en zet die van de back-up terug.</p></div></div>';
    function sluit() { $laag.innerHTML = ''; document.removeEventListener('keydown', toets); if (vorige && vorige.focus) { try { vorige.focus(); } catch (e) { /* geen focus */ } } }
    function toets(e) { if (e.key === 'Escape') sluit(); }
    document.addEventListener('keydown', toets);
    function klaar(u, wat) { sluit(); route(); var o = document.getElementById('her-uitslag'); if (o) o.innerHTML = u.ok ? '<div class="bk-status" data-status="ok"><b>Teruggezet</b><span>' + h(wat) + ' Nu: ' + u.totaal + ' op de volglijst en ' + u.totaalPortefeuille + ' aankopen.</span></div>' : '<div class="bk-status" data-status="let-op"><b>Niet gelukt</b><span>' + h(u.reden || 'Probeer het opnieuw.') + '</span></div>'; }
    document.getElementById('tz-stop').addEventListener('click', sluit);
    document.getElementById('tz-voeg').addEventListener('click', function () { klaar(winkel.zetTerug(tekst, 'samenvoegen'), 'Toegevoegd uit de back-up; wat er al stond is gebleven.'); });
    var vb = document.getElementById('tz-vervang'), zeker = false;
    vb.addEventListener('click', function () {
      if (!zeker) { zeker = true; vb.textContent = 'Zeker weten? Tik nogmaals om te vervangen'; return; }
      klaar(winkel.zetTerug(tekst, 'vervang'), 'Alles is vervangen door de back-up.');
    });
    document.getElementById('tz-stop').focus();
  }
  function schermInstellingen() {
    var st = winkel.staat(), th = st.instellingen.thema, lb = st.laatsteBackup;
    return '<section><h1>Instellingen</h1>' + (winkel.fout() ? '<div class="melding"><b>Let op</b><span>' + h(winkel.fout()) + '</span></div>' : '') +
      '<div class="kaart-plat"><h2>Uiterlijk</h2><div class="keuze" role="group" aria-label="Licht of donker">' + [['auto', 'Automatisch'], ['licht', 'Licht'], ['donker', 'Donker']].map(function (o) { return '<button data-th="' + o[0] + '" aria-pressed="' + (th === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="kaart-plat" data-weergave-kaart><h2>Weergave</h2><div class="keuze" role="group" aria-label="Weergave">' + [['eenvoudig', 'Eenvoudig'], ['uitgebreid', 'Uitgebreid']].map(function (o) { return '<button data-weergave-knop="' + o[0] + '" aria-pressed="' + (weergave() === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
      '<p class="zacht">Eenvoudig: per aandeel het NAIC-oordeel, de vijf stappen, de koopprijs en één zin uitleg. Uitgebreid: ook de onderbouwing, de zes aanvullende metingen en alle kentallen. Tip: met <code>?weergave=eenvoudig</code> achter de link opent iemand anders de app meteen eenvoudig.</p></div>' +
      '<div class="kaart-plat detail"><h2>Oordeel</h2><p class="zacht">Een aandeel krijgt pas een oordeel (Kopen, Neutraal of Vermijden) als genoeg van de zes metingen beschikbaar zijn. Kies hier hoeveel dat minimaal moet zijn.</p><label for="mind">Minimum aantal metingen voor een oordeel</label><select id="mind">' + [3, 4, 5, 6].map(function (v) { return '<option value="' + v + '"' + (minMetingen() === v ? ' selected' : '') + '>' + v + ' van 6' + (v === Signaal.MIN_METINGEN ? ' (standaard)' : v === 6 ? ' (alleen als alles bekend is)' : '') + '</option>'; }).join('') + '</select></div>' +
      backupKaart() +
      '<div class="kaart-plat"><h2>Bewaren op dit toestel</h2><p id="pers" class="zacht">Even controleren…</p><div class="knoppen"><button class="knop rand" id="persknop">Vraag het toestel om gegevens te bewaren</button></div></div>' +
      '<p class="zacht">Versie ' + h(APP_VERSIE) + ' · gegevens van ' + h(datumNl(String(DATA.gemaakt || '').slice(0, 10))) + ' · ' + h(DATA.bron || '') + '</p></section>';
  }
  function instKoppel() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-th]'), function (b) { b.addEventListener('click', function () { winkel.zetThema(b.getAttribute('data-th')); pasThema(); route(); }); });
    var bk = document.getElementById('bk');
    if (bk) bk.addEventListener('click', function () {
      var tekst = winkel.maakBackup(true), naam = 'aandeel-signaal-backup-' + vandaag() + '.json', uit = document.getElementById('bk-uitslag');
      var ta = document.getElementById('bktekst'); if (ta) ta.value = tekst;
      function klaar(waar) { winkel.markeerBackup(); route(); var t2 = document.getElementById('bktekst'); if (t2) t2.value = tekst; var u = document.getElementById('bk-uitslag'); if (u) u.innerHTML = '<div class="bk-status" data-status="ok"><b>Back-up bewaard</b><span>' + h(waar) + ' Bestandsnaam: ' + h(naam) + '. Zet het bestand ook op een tweede plek, bijvoorbeeld in uw cloud, als u het nog niet deed.</span></div>'; }
      var bestand = null; try { bestand = new File([tekst], naam, { type: 'application/json' }); } catch (e) { /* oudere browser */ }
      if (bestand && navigator.canShare && navigator.canShare({ files: [bestand] })) {
        navigator.share({ files: [bestand], title: 'Back-up Aandeel Signaal' }).then(function () { klaar('U koos een plek in het menu.'); }, function (err) {
          if (err && err.name === 'AbortError') { if (uit) uit.innerHTML = '<div class="bk-status" data-status="let-op"><b>Niet bewaard</b><span>U sloot het menu zonder een plek te kiezen. Er is niets opgeslagen; probeer het opnieuw.</span></div>'; }
          else { download(tekst, naam); klaar('Het bestand staat in de map Downloads van dit toestel.'); }
        });
      } else { download(tekst, naam); klaar('Het bestand staat in de map Downloads van dit toestel.'); }
    });
    var mind = document.getElementById('mind');
    if (mind) mind.addEventListener('change', function () { zetMinMetingen(parseInt(mind.value, 10)); fondsItemsCache = null; toast('Minimum aantal metingen: ' + mind.value + ' van 6'); });
    var kopie = document.getElementById('kopie'), plak = document.getElementById('plak'), tx = document.getElementById('bktekst');
    if (kopie) kopie.addEventListener('click', function () {
      if (!tx.value) tx.value = winkel.maakBackup();
      tx.select();
      (navigator.clipboard ? navigator.clipboard.writeText(tx.value) : Promise.reject()).then(function () { toast('Gekopieerd'); }, function () { toast('Selecteer de tekst en kopieer die zelf'); });
    });
    if (plak) plak.addEventListener('click', function () {
      terugzetVenster(tx.value, 'de geplakte tekst');
    });
    var her = document.getElementById('her');
    if (her) her.addEventListener('change', function () {
      var f = her.files && her.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { terugzetVenster(String(rd.result), f.name); her.value = ''; };
      rd.onerror = function () { var u = document.getElementById('her-uitslag'); if (u) u.innerHTML = '<div class="bk-status" data-status="let-op"><b>Lezen mislukt</b><span>Dit bestand kon niet worden gelezen. Kies het opnieuw.</span></div>'; };
      rd.readAsText(f);
    });
    var p = document.getElementById('pers'), pk = document.getElementById('persknop');
    if (navigator.storage && navigator.storage.persisted) {
      navigator.storage.persisted().then(function (x) { p.textContent = x ? 'Dit toestel bewaart uw gegevens vast.' : 'Het toestel mag opgeslagen gegevens in uitzonderlijke gevallen wissen. Vraag hieronder om vast bewaren en maak een back-up.'; if (x) pk.hidden = true; });
      pk.addEventListener('click', function () { navigator.storage.persist().then(function (x) { toast(x ? 'Gegevens worden vast bewaard' : 'Het toestel wilde dit niet; maak een back-up'); route(); }); });
    } else { p.textContent = 'Dit toestel meldt niet of gegevens vast bewaard worden. Maak daarom regelmatig een back-up.'; pk.hidden = true; }
  }
  function download(tekst, naam) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([tekst], { type: 'application/json' })); a.download = naam;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  var tmr = null;
  function toast(t, ongedaan) {
    clearTimeout(tmr);
    $meld.innerHTML = '<div class="toast"><span>' + h(t) + '</span>' + (ongedaan ? '<button id="ong">Ongedaan maken</button>' : '') + '</div>';
    if (ongedaan) document.getElementById('ong').addEventListener('click', function () { ongedaan(); $meld.innerHTML = ''; });
    tmr = setTimeout(function () { $meld.innerHTML = ''; }, 6000);
  }
  /* Weergave: 'uitgebreid' (alles) of 'eenvoudig' (oordeel, stappen, koopprijs en één zin uitleg). Per toestel bewaard;
     ook mee te geven in de link: ?weergave=eenvoudig of ?weergave=uitgebreid. */
  function weergave() { try { return localStorage.getItem('as_weergave') === 'eenvoudig' ? 'eenvoudig' : 'uitgebreid'; } catch (e) { return 'uitgebreid'; } }
  function zetWeergave(w) { try { localStorage.setItem('as_weergave', w === 'eenvoudig' ? 'eenvoudig' : 'uitgebreid'); } catch (e) { /* standaard */ } pasWeergave(); }
  function pasWeergave() { document.documentElement.classList.toggle('eenvoudig', weergave() === 'eenvoudig'); }
  (function () {
    var m = /[?&]weergave=(eenvoudig|uitgebreid)\b/.exec(location.search || '');
    if (m) zetWeergave(m[1]);
  })();
  document.addEventListener('click', function (e) {
    var k = e.target && e.target.closest ? e.target.closest('[data-weergave-knop]') : null;
    if (k) { zetWeergave(k.getAttribute('data-weergave-knop')); route(); }
  });
  function pasThema() {
    var t = winkel.staat().instellingen.thema, el = document.documentElement;
    if (t === 'licht' || t === 'donker') el.setAttribute('data-theme', t === 'donker' ? 'dark' : 'light'); else el.removeAttribute('data-theme');
  }

  function route() {
    var hash = location.hash || '#/', m = hash.match(/^#\/a\/([^\/]+)(?:\/(\w+))?$/), html, actief, titel = 'Aandeel Signaal', na = null, m2;
    if (m) {
      var t = decodeURIComponent(m[1]).toUpperCase(), tab = TABS.some(function (x) { return x[0] === m[2]; }) ? m[2] : 'samenvatting';
      html = schermAandeel(t, tab);
      $menu.innerHTML = menuHtml(TABS.map(function (x) { return ['#/a/' + encodeURIComponent(t) + '/' + x[0], x[1], x[0]]; }), '#/a/' + encodeURIComponent(t) + '/' + tab);
      var rec = zoek(t); if (rec) titel = rec.naam + ' · Aandeel Signaal';
      na = function () { aandeelKoppel(t); if (tab === 'check' && rec) { checkKoppel(rec); verdiepKoppel(rec); } if (tab === 'waarde' && rec) { zonesKoppel(rec, Gate.maakRij(rec, vandaag())); } };
    } else if ((m2 = hash.match(/^#\/vergelijk(?:\/([^\/]+)\/([^\/]+))?$/))) {
      html = schermVergelijk(m2[1] ? decodeURIComponent(m2[1]).toUpperCase() : null, m2[2] ? decodeURIComponent(m2[2]).toUpperCase() : null);
      $menu.innerHTML = menuHtml(HOOFD, '#/'); na = vergelijkKoppel; titel = 'Vergelijken · Aandeel Signaal';
    } else {
      if (hash === '#/zoek' || hash === '#/overzicht') hash = '#/fondsen';     // oude adressen
      var kaart = { '#/': schermStart, '#/fondsen': schermFondsen, '#/volglijst': schermVolglijst, '#/portefeuille': schermPortefeuille, '#/hulp': schermHulp, '#/instellingen': schermInstellingen };
      var fn = kaart[hash] || schermStart; html = fn(); actief = kaart[hash] ? hash : '#/';
      $menu.innerHTML = menuHtml(HOOFD, actief);
      if (hash === '#/hulp') na = function () { var b = document.getElementById('intro-opnieuw'); if (b) b.addEventListener('click', function () { toonIntro(0); }); };
      if (hash === '#/portefeuille') na = portefeuilleKoppel; if (hash === '#/volglijst') na = volgKoppel; if (hash === '#/fondsen') na = fondsenKoppel; if (kaart[hash] === schermStart || !kaart[hash]) na = dashboardKoppel; if (hash === '#/instellingen') na = instKoppel;
    }
    $inhoud.innerHTML = html; document.title = titel;
    if (na) na();
  }
  var vorigeHash = null;
  window.addEventListener('hashchange', function () { route(); if (vorigeHash !== location.hash) window.scrollTo(0, 0); vorigeHash = location.hash; });
  pasThema(); pasWeergave(); route(); vorigeHash = location.hash;
  if (!winkel.introGezien()) toonIntro(0);
  if (window.matchMedia) { try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', pasThema); } catch (e) { /* oud */ } }
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) { try { navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) { /* geen offline-modus */ } }
})();
