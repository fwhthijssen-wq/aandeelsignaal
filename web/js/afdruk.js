/* Afdruk: één fonds op papier (of als PDF), met alle gegevens, de berekening en wat het betekent.
   Puur: krijgt een record uit aandelen.json en de uitkomst van Signaal.beoordeel en geeft een complete HTML-pagina terug.
   Geen DOM, geen netwerk; werkt in de browser (Afdruk.pagina) en in Node (tests, voorbeeld-PDF). */
(function (root) {
  'use strict';
  var OORDEEL = { kopen: 'Kopen', neutraal: 'Neutraal', vermijden: 'Vermijden' };
  var GEZOND = { kopen: 'Gezond', neutraal: 'Gemengd', vermijden: 'Zwak', positief: 'Gezond' };   // gezondheidscheck (zes metingen)
  var STAP_UITLEG = {
    groei: 'Groeit de winst per aandeel minstens 5% per jaar? NAIC zoekt groeibedrijven.',
    kwaliteit: 'Groeien omzet en winst gelijk op, en houden marge en rendement op eigen vermogen stand?',
    zone: 'Staat de koers in het onderste derde van de verwachte koersband over 5 jaar?',
    verhouding: 'Kan de koers minstens 3 keer zoveel stijgen als dalen?',
    rendement: 'Levert het naar verwachting minstens 15% per jaar op, koers plus dividend?'
  };

  function ok(x) { return typeof x === 'number' && isFinite(x); }
  function h(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function getal(n, dec) { return ok(n) ? n.toLocaleString('nl-NL', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec == null ? 0 : dec }) : '–'; }
  function geld(n) { return ok(n) ? getal(n, Math.abs(n) >= 100 ? 0 : 2) : '–'; }
  function pct(n, dec) { return ok(n) ? (n > 0 ? '+' : n < 0 ? '−' : '') + getal(Math.abs(n), dec == null ? 1 : dec) + '%' : '–'; }
  function pctKaal(n, dec) { return ok(n) ? getal(n, dec == null ? 1 : dec) + '%' : '–'; }
  function mld(n) { return ok(n) ? (Math.abs(n) >= 1e9 ? getal(n / 1e9, 1) : getal(n / 1e9, 2)) : '–'; }
  function datumNl(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(s)) return s || 'onbekend';
    var p = s.slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2])).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  function merk(okWaarde) { return okWaarde === true ? '<span class="mk ja">✓</span>' : okWaarde === false ? '<span class="mk nee">✗</span>' : '<span class="mk onb">?</span>'; }
  function scoreKlasse(s) { return !ok(s) ? 'onb' : s >= 0.25 ? 'ja' : s <= -0.25 ? 'nee' : 'mid'; }
  function scoreWoord(s) { return !ok(s) ? 'ontbreekt' : s >= 0.25 ? 'gunstig' : s <= -0.25 ? 'ongunstig' : 'neutraal'; }

  /* ---- Grafiek 1: de NAIC-koersband over 5 jaar met de koers van nu ---- */
  function zonesSvg(z, valuta) {
    if (!z) return '';
    var lo = Math.min(z.laag, z.koers || z.laag), hi = Math.max(z.hoog, z.koers || z.hoog), W = 640, x0 = 20, x1 = W - 20;
    var x = function (v) { return x0 + (v - lo) / (hi - lo) * (x1 - x0); };
    var seg = function (a, b, cls, label) {
      return '<rect class="' + cls + '" x="' + x(a).toFixed(1) + '" y="30" width="' + (x(b) - x(a)).toFixed(1) + '" height="22"/>' +
        '<text class="seg-t" x="' + ((x(a) + x(b)) / 2).toFixed(1) + '" y="45">' + label + '</text>';
    };
    var tick = function (v, txt, onder) { return '<line class="tk" x1="' + x(v).toFixed(1) + '" x2="' + x(v).toFixed(1) + '" y1="52" y2="58"/><text class="tk-t" x="' + x(v).toFixed(1) + '" y="' + (onder ? 70 : 70) + '">' + txt + '</text>'; };
    var s = '<svg class="zones" viewBox="0 0 ' + W + ' 84" role="img" aria-label="Koersband over 5 jaar: koopzone, houdzone en verkoopzone, met de koers van nu">';
    s += seg(z.koop[0], z.koop[1], 'z-koop', 'koopzone') + seg(z.houd[0], z.houd[1], 'z-houd', 'houdzone') + seg(z.verkoop[0], z.verkoop[1], 'z-verkoop', 'verkoopzone');
    s += tick(z.koop[0], geld(z.koop[0])) + tick(z.koop[1], geld(z.koop[1])) + tick(z.houd[1], geld(z.houd[1])) + tick(z.verkoop[1], geld(z.verkoop[1]));
    if (ok(z.koers)) {
      var k = x(z.koers);
      s += '<line class="nu" x1="' + k.toFixed(1) + '" x2="' + k.toFixed(1) + '" y1="18" y2="56"/><path class="nu-p" d="M' + (k - 5).toFixed(1) + ' 12 L' + (k + 5).toFixed(1) + ' 12 L' + k.toFixed(1) + ' 19 Z"/>' +
        '<text class="nu-t" x="' + k.toFixed(1) + '" y="9">koers nu ' + geld(z.koers) + ' ' + h(valuta) + '</text>';
    }
    return s + '</svg>';
  }

  /* ---- Grafiek 2: NAIC-groeigrafiek (logaritmisch, eerste jaar = 100) ---- */
  function groeiSvg(jr) {
    var reeksen = [
      { k: 'sales', n: 'Omzet', c: 'l1' },
      { k: 'pretax_income', n: 'Winst vóór belasting', c: 'l2' },
      { k: 'comparable_eps', n: 'Winst per aandeel', c: 'l3' }
    ].map(function (r) {
      var basis = null;
      var pts = jr.map(function (j) { var v = j[r.k]; if (ok(v) && v > 0 && basis === null) basis = v; return { year: j.year, v: ok(v) && v > 0 && basis ? v / basis * 100 : null }; });
      return { n: r.n, c: r.c, pts: pts };
    });
    var alle = []; reeksen.forEach(function (r) { r.pts.forEach(function (p) { if (p.v) alle.push(p.v); }); });
    if (alle.length < 4) return '';
    var W = 640, H = 200, L = 44, R = 132, T = 10, B = 26;
    var lmin = Math.log(Math.min.apply(null, alle.concat([100]))), lmax = Math.log(Math.max.apply(null, alle));
    var y0 = jr[0].year, y1 = jr[jr.length - 1].year;
    var X = function (y) { return L + (y - y0) / Math.max(1, y1 - y0) * (W - L - R); };
    var Y = function (v) { return T + (1 - (Math.log(v) - lmin) / (lmax - lmin || 1)) * (H - T - B); };
    var s = '<svg class="groei" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Groei van omzet, winst vóór belasting en winst per aandeel, eerste jaar = 100, logaritmische schaal">';
    [100, 200, 400, 800, 1600, 3200].forEach(function (g) {
      if (Math.log(g) < lmin - 0.01 || Math.log(g) > lmax + 0.2) return;
      s += '<line class="gl" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(g).toFixed(1) + '" y2="' + Y(g).toFixed(1) + '"/><text class="as" x="' + (L - 6) + '" y="' + (Y(g) + 3).toFixed(1) + '" text-anchor="end">' + g + '</text>';
    });
    jr.forEach(function (j) { s += '<text class="as" x="' + X(j.year).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + String(j.year).slice(2) + '</text>'; });
    var eind = [];
    reeksen.forEach(function (r) {
      var d = '', laatst = null;
      r.pts.forEach(function (p) { if (!p.v) return; d += (d ? ' L' : 'M') + X(p.year).toFixed(1) + ' ' + Y(p.v).toFixed(1); laatst = p; });
      if (!d) return;
      s += '<path class="ln ' + r.c + '" d="' + d + '"/>';
      eind.push({ y: Y(laatst.v), t: r.n + ' ' + getal(laatst.v, 0), c: r.c });
    });
    eind.sort(function (a, b) { return a.y - b.y; });
    for (var i = 1; i < eind.length; i++) if (eind[i].y - eind[i - 1].y < 13) eind[i].y = eind[i - 1].y + 13;
    eind.forEach(function (e) { s += '<text class="eind ' + e.c + '" x="' + (W - R + 8) + '" y="' + (e.y + 3).toFixed(1) + '">' + h(e.t) + '</text>'; });
    return s + '</svg>';
  }

  /* ---- Jaarcijfers: kolommen = jaren, regels = posten ---- */
  function jaartabel(jr, N) {
    var kw = N.historischKW(jr), roe = N.rendementEigenVermogen(jr).reeks, pm = N.margeVoorBelasting(jr), nm = N.nettomarges(jr),
      ur = N.uitkeringsratio(jr), dr = N.dividendRendement(jr);
    var per = function (reeks) { var o = {}; (reeks || []).forEach(function (x) { o[x.year] = x; }); return o; };
    var KW = per(kw), ROE = per(roe), PM = per(pm), NM = per(nm), UR = per(ur), DR = per(dr);
    var groepen = [
      ['Resultaten (mld)', [
        ['Omzet', function (j) { return mld(j.sales); }],
        ['Winst vóór belasting', function (j) { return mld(j.pretax_income); }],
        ['Nettowinst', function (j) { return mld(j.net_income); }]]],
      ['Per aandeel en koers', [
        ['Winst per aandeel', function (j) { return geld(j.comparable_eps); }],
        ['Dividend per aandeel', function (j) { return geld(j.dividend_ps); }],
        ['Hoogste koers', function (j) { return geld(j.koers_hoog); }],
        ['Laagste koers', function (j) { return geld(j.koers_laag); }],
        ['K/W hoog', function (j) { return KW[j.year] ? getal(KW[j.year].hoog, 1) : '–'; }],
        ['K/W laag', function (j) { return KW[j.year] ? getal(KW[j.year].laag, 1) : '–'; }],
        ['Dividendrendement', function (j) { return DR[j.year] ? pctKaal(DR[j.year].waarde) : '–'; }]]],
      ['Kwaliteit', [
        ['Marge vóór belasting', function (j) { return PM[j.year] ? pctKaal(PM[j.year].waarde) : '–'; }],
        ['Nettomarge', function (j) { return NM[j.year] ? pctKaal(NM[j.year].waarde) : '–'; }],
        ['Rendement eigen vermogen', function (j) { return ROE[j.year] ? pctKaal(ROE[j.year].waarde) : '–'; }],
        ['Uitkeringsratio', function (j) { return UR[j.year] ? pctKaal(UR[j.year].waarde, 0) : '–'; }]]],
      ['Kasstroom en balans (mld)', [
        ['Kasstroom uit bedrijf', function (j) { return mld(j.operating_cash_flow); }],
        ['Investeringen', function (j) { return mld(j.capex); }],
        ['Vrije kasstroom', function (j) { return ok(j.operating_cash_flow) && ok(j.capex) ? mld(j.operating_cash_flow - j.capex) : '–'; }],
        ['Eigen vermogen', function (j) { return mld(j.equity); }],
        ['Langlopende schuld', function (j) { return mld(j.long_term_debt); }],
        ['Totale bezittingen', function (j) { return mld(j.total_assets); }],
        ['Aandelen (mln, verwaterd)', function (j) { return ok(j.shares_diluted) ? getal(j.shares_diluted / 1e6, 0) : '–'; }]]]
    ];
    var s = '<table class="jaren"><thead><tr><th></th>' + jr.map(function (j) { return '<th>' + j.year + '</th>'; }).join('') + '</tr></thead>';
    groepen.forEach(function (g) {
      s += '<tbody><tr class="groep"><th colspan="' + (jr.length + 1) + '">' + h(g[0]) + '</th></tr>';
      g[1].forEach(function (r) { s += '<tr><th scope="row">' + h(r[0]) + '</th>' + jr.map(function (j) { return '<td>' + r[1](j) + '</td>'; }).join('') + '</tr>'; });
      s += '</tbody>';
    });
    return s + '</table>';
  }

  /* ---- De vijf stappen als leesbare redenering ---- */
  function stappen(n, valuta) {
    var l = n ? (n.ladder || []) : [];
    var z = n && n.zones, q = n && n.kwaliteit || [];
    var uitleg = {
      groei: n && n.groeiHistorisch !== null ? 'Winst per aandeel ' + pct(n.groeiHistorisch) + ' per jaar (trend ' + n.van + '–' + n.tot + '); NAIC vraagt minstens 5%.' : 'Te weinig jaren om de groei te bepalen.',
      kwaliteit: q.length ? q.map(function (x) { return (x.ok === false ? 'Valt af: ' : '') + x.tekst; }).join(' ') : 'Niet te toetsen.',
      zone: z && ok(z.koers) ? 'Koers ' + geld(z.koers) + ' ' + valuta + '; koopzone ' + geld(z.koop[0]) + '–' + geld(z.koop[1]) + ', houdzone tot ' + geld(z.houd[1]) + '. Nu: ' + { koop: 'koopzone', houd: 'houdzone', verkoop: 'verkoopzone', onder: 'onder de verwachte lage koers', boven: 'boven de verwachte hoge koers' }[z.zone] + '.' : 'Geen koerszones.',
      verhouding: z && z.verhouding !== null && ok(z.verhouding) ? 'Opwaarts ' + geld(z.opwaarts) + ' tot de hoge koers, neerwaarts ' + geld(z.neerwaarts) + ' tot de lage koers: ' + getal(z.verhouding, 1) + ' : 1.' : 'Niet te berekenen.',
      rendement: n && n.totaal ? 'Koers ' + pct(n.totaal.koers) + ' + dividend ' + (n.totaal.dividend !== null ? pct(n.totaal.dividend) : '0%') + ' = ' + pct(n.totaal.totaal) + ' per jaar.' : 'Niet te berekenen.'
    };
    return '<ol class="stappen">' + l.map(function (x) {
      return '<li class="' + (x.ok === true ? 'ja' : x.ok === false ? 'nee' : 'onb') + '">' + merk(x.ok) + '<div><b>' + h(x.naam) + '</b> <span class="zacht">' + h(STAP_UITLEG[x.id] || '') + '</span><br>' + h(uitleg[x.id] || '') + '</div></li>';
    }).join('') + '</ol>';
  }

  function samenvattingTekst(n) {
    if (!n || !n.oordeel) return n && n.reden ? n.reden : 'Geen NAIC-oordeel mogelijk met deze gegevens.';
    var l = n.ladder || [], d = [];
    var groei = l.filter(function (x) { return x.id === 'groei'; })[0], kwal = l.filter(function (x) { return x.id === 'kwaliteit'; })[0];
    if (groei && groei.ok === false) return 'Volgens NAIC geen groeibedrijf: de winst per aandeel groeit te langzaam. Dan rekent NAIC niet verder; oordeel Vermijden.';
    if (groei && groei.ok) d.push('een groeibedrijf (winst per aandeel ' + pct(n.groeiHistorisch) + ' per jaar)');
    if (kwal && kwal.ok === false) {
      var af = (n.kwaliteit || []).filter(function (q) { return q.ok === false; }).map(function (q) { return { omzet: 'de omzet draagt de winstgroei niet', marge: 'de marge vóór belasting daalt', roe: 'het rendement op eigen vermogen daalt' }[q.id]; });
      d.push('maar ' + af.join(' en ') + ', en dan wordt het bij geen enkele koers Kopen');
    } else if (kwal && kwal.ok) d.push('dat de kwaliteitstoetsen doorstaat');
    var s = 'Volgens NAIC ' + d.join(', ') + '. ' + (n.reden || '');
    if (n.relatief) s += ' De K/W van nu (' + getal(n.relatief.kwNu, 1) + ') is ' + n.relatief.pct + '% van het eigen gemiddelde van 5 jaar (' + getal(n.relatief.kwGem, 1) + ')' + (n.relatief.oordeel === 'duur' ? ': duur ten opzichte van de eigen geschiedenis.' : n.relatief.oordeel === 'laag' ? ': laag, ga na waarom.' : ': normaal.');
    return s;
  }

  var CSS = [
    '@page { size: A4; margin: 14mm 14mm 16mm; @bottom-right { content: "pagina " counter(page) " van " counter(pages); font: 7pt Inter, system-ui, sans-serif; color: #4F6070; } }',
    ':root { --ink:#12202C; --mut:#4F6070; --line:#D5DDE4; --soft:#EEF2F5; --acc:#0B6E78; --hero:#0D3B47; --ok:#0F5F3A; --okbg:#DDF1E5; --wait:#6E4700; --waitbg:#FBEFD2; --bad:#8C2F2F; --badbg:#F7DEDE; color-scheme: light; }',
    '* { box-sizing: border-box; } html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
    'body { margin: 0; background: #fff; color: var(--ink); font: 9.4pt/1.42 Inter, system-ui, "Segoe UI", Roboto, sans-serif; font-variant-numeric: tabular-nums; }',
    '.blad { max-width: 182mm; margin: 0 auto; padding: 0 0 8mm; }',
    'h1 { font-size: 21pt; margin: 0; letter-spacing: -.01em; line-height: 1.1; } h2 { font-size: 12.5pt; margin: 0 0 2.5mm; color: var(--hero); } h3 { font-size: 10pt; margin: 3mm 0 1.5mm; }',
    'p { margin: 0 0 1.6mm; } .zacht { color: var(--mut); } .klein { font-size: 8pt; }',
    '.kop { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid var(--hero); padding-bottom: 1.5mm; margin-bottom: 4mm; font-size: 8pt; color: var(--mut); letter-spacing: .04em; text-transform: uppercase; }',
    '.kop b { color: var(--hero); }',
    '.titel { display: flex; justify-content: space-between; gap: 6mm; align-items: flex-end; margin-bottom: 4mm; }',
    '.titel .sub { color: var(--mut); margin-top: 1mm; } .titel .koers { text-align: right; } .titel .koers b { font-size: 16pt; display: block; line-height: 1.1; }',
    '.tegels { display: grid; grid-template-columns: 1.35fr 1fr 1fr; gap: 3mm; margin-bottom: 4mm; }',
    '.tegel { border: 1px solid var(--line); border-radius: 3mm; padding: 3mm 3.5mm; break-inside: avoid; }',
    '.tegel .lbl { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .05em; color: var(--mut); }',
    '.tegel .groot { font-size: 17pt; font-weight: 700; line-height: 1.15; margin: .5mm 0 1mm; }',
    '.tegel.hoofd { background: var(--hero); color: #fff; border-color: var(--hero); } .tegel.hoofd .lbl, .tegel.hoofd .zacht { color: #B7DADF; }',
    '.o-kopen { color: var(--ok); } .o-vermijden { color: var(--bad); } .o-neutraal { color: var(--wait); } .tegel.hoofd .o-kopen { color: #8EE0B4; } .tegel.hoofd .o-vermijden { color: #F0A3A3; } .tegel.hoofd .o-neutraal { color: #F4D58A; }',
    'section { margin: 0 0 5mm; } section.breek { break-before: page; } .blok { break-inside: avoid; }',
    '.uitleg { background: var(--soft); border-radius: 3mm; padding: 3mm 3.5mm; margin: 0 0 3mm; }',
    '.mk { display: inline-flex; width: 4.6mm; height: 4.6mm; border-radius: 50%; align-items: center; justify-content: center; font-size: 8pt; font-weight: 700; flex: none; }',
    '.mk.ja { background: var(--okbg); color: var(--ok); } .mk.nee { background: var(--badbg); color: var(--bad); } .mk.onb { background: var(--soft); color: var(--mut); } .mk.mid { background: var(--waitbg); color: var(--wait); }',
    '.ladder { display: flex; gap: 1.5mm; flex-wrap: wrap; margin: 1.5mm 0 0; } .ladder span.st { display: inline-flex; gap: 1.2mm; align-items: center; font-size: 8.3pt; }',
    'ol.stappen { list-style: none; padding: 0; margin: 0; } ol.stappen li { display: flex; gap: 2.5mm; padding: 2mm 0; border-bottom: 1px solid var(--line); break-inside: avoid; } ol.stappen li:last-child { border-bottom: 0; }',
    'ol.stappen .mk { margin-top: .6mm; }',
    'table { border-collapse: collapse; width: 100%; } th, td { text-align: left; vertical-align: top; }',
    'table.kv th { width: 36%; font-weight: 600; padding: 1.3mm 3mm 1.3mm 0; border-bottom: 1px solid var(--line); } table.kv td { padding: 1.3mm 0; border-bottom: 1px solid var(--line); }',
    'table.jaren { font-size: 7.6pt; } table.jaren th, table.jaren td { padding: .9mm 1.1mm; border-bottom: 1px solid #E4EAEF; } table.jaren td { text-align: right; white-space: nowrap; }',
    'table.jaren thead th { text-align: right; border-bottom: 1.5px solid var(--hero); color: var(--hero); } table.jaren tbody th { font-weight: 500; white-space: nowrap; }',
    'table.jaren tr.groep th { font-weight: 700; color: var(--hero); padding-top: 2.2mm; border-bottom: 1px solid var(--line); }',
    'ul.met { list-style: none; padding: 0; margin: 0; } ul.met li { display: flex; gap: 2.5mm; padding: 1.7mm 0; border-bottom: 1px solid var(--line); break-inside: avoid; } ul.met li:last-child { border-bottom: 0; }',
    'ul.met .rek { font-size: 8pt; color: var(--mut); }',
    '.twee { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }',
    'svg { display: block; width: 100%; height: auto; } svg text { font-family: inherit; }',
    '.zones .z-koop { fill: #CDEBD9; } .zones .z-houd { fill: #F7E6BC; } .zones .z-verkoop { fill: #F2CFCF; } .zones .seg-t { font-size: 10px; text-anchor: middle; fill: #12202C; }',
    '.zones .tk { stroke: #4F6070; } .zones .tk-t { font-size: 9.5px; text-anchor: middle; fill: #4F6070; } .zones .nu { stroke: #12202C; stroke-width: 2; } .zones .nu-p { fill: #12202C; } .zones .nu-t { font-size: 10px; font-weight: 700; text-anchor: middle; fill: #12202C; }',
    '.groei .gl { stroke: #E4EAEF; } .groei .as { font-size: 9px; fill: #4F6070; } .groei path.ln { fill: none !important; stroke-width: 2; } .groei .eind { font-size: 9px; }',
    '.groei .l1 { stroke: #0B6E78; fill: #0B6E78; } .groei .l2 { stroke: #9AA9B6; fill: #6F8190; } .groei .l3 { stroke: #C26A1E; fill: #A4561A; } .groei text.eind { stroke: none; }',
    'dl.begrip { margin: 0; columns: 2; column-gap: 6mm; } dl.begrip div { break-inside: avoid; margin: 0 0 2.2mm; } dl.begrip dt { font-weight: 700; } dl.begrip dd { margin: 0; color: var(--ink); }',
    'ul.punt { margin: 0 0 2mm; padding-left: 4.5mm; } ul.punt li { margin: 0 0 .8mm; }',
    '.voet { border-top: 1px solid var(--line); padding-top: 2mm; margin-top: 5mm; font-size: 7.8pt; color: var(--mut); }',
    '.werkbalk { position: sticky; top: 0; z-index: 2; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; padding: 10px 16px; background: #0D3B47; }',
    '.werkbalk button { font: 600 15px/1 Inter, system-ui, sans-serif; min-height: 44px; padding: 0 18px; border-radius: 12px; border: 1px solid #B7DADF; background: #fff; color: #0D3B47; cursor: pointer; } .werkbalk button.rand { background: transparent; color: #fff; }',
    '@media print { .werkbalk { display: none !important; } }',
    '@media screen { body { background: #EEF2F5; } .blad { background: #fff; padding: 12mm 14mm; margin: 6mm auto; max-width: 210mm; box-shadow: 0 1px 8px rgba(0,0,0,.08); } }',
    '@media screen and (max-width: 640px) { .blad { padding: 16px; margin: 0; } .tegels, .twee { grid-template-columns: 1fr; } .titel { flex-direction: column; align-items: flex-start; } .titel .koers { text-align: left; } .schuif { overflow-x: auto; } dl.begrip { columns: 1; } }'
  ].join('\n');

  /* rec: record uit aandelen.json; b: Signaal.beoordeel(rec, { ..., gevoeligheid: true });
     o: { Naic, Gate, vandaag: 'YYYY-MM-DD', gemaakt: datum van de gegevens, uitleg: AANDEEL_UITLEG.termen, werkbalk: true = knoppen Afdrukken en Sluiten bovenaan (alleen op het scherm) } */
  function pagina(rec, b, o) {
    o = o || {};
    var N = o.Naic, G = o.Gate, n = b.naic, g = rec.gegevens || {}, k = rec.koers || {}, val = rec.valuta || '';
    if (n) { var kopie = {}; for (var sl in n) if (Object.prototype.hasOwnProperty.call(n, sl)) kopie[sl] = n[sl]; kopie.ladder = N.ladder(n); n = kopie; }
    var jr = (g.jaren || []).filter(function (j) { return j && ok(j.year); }).sort(function (a, c) { return a.year - c.year; });
    var bed = rec.bedrijf || {};
    var gate = G.labelGate({ epsStatus: g.eps_status, epsVerifiedYears: g.eps_verified_years, priceDate: k.datum, today: o.vandaag, currencies: g.currencies, rejectedSources: g.rejected_sources });
    var vers = G.priceFreshness(k.datum, o.vandaag).fresh;
    var s = '<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + h(rec.naam) + ' – fondsrapport ' + h(o.vandaag || '') + '</title><style>' + CSS + '</style></head><body>' +
      (o.werkbalk ? '<div class="werkbalk"><button type="button" onclick="window.print()">Afdrukken of bewaren als PDF</button><button type="button" class="rand" onclick="window.close()">Sluiten</button></div>' : '') + '<main class="blad">';

    // Kop en titel
    s += '<div class="kop"><span><b>Aandeel Signaal</b> · fondsrapport</span><span>Afgedrukt ' + h(datumNl(o.vandaag)) + '</span></div>';
    s += '<div class="titel"><div><h1>' + h(rec.naam) + '</h1><div class="sub">' + h([rec.ticker, rec.beurs, rec.land, val, (bed.sector || []).join(', '), (rec.indices || []).join(', ')].filter(Boolean).join(' · ')) + '</div></div>' +
      (ok(k.slot) ? '<div class="koers"><span class="zacht">Koers ' + h(datumNl(k.datum)) + (vers ? '' : ' (verouderd)') + '</span><b>' + geld(k.slot) + ' ' + h(val) + '</b></div>' : '<div class="koers"><span class="zacht">Geen actuele koers</span></div>') + '</div>';

    // Drie tegels
    var kp = n && n.koopprijs;
    s += '<div class="tegels">';
    s += '<div class="tegel hoofd"><div class="lbl">NAIC-oordeel</div><div class="groot o-' + (n && n.oordeel || 'geen') + '">' + (n && n.oordeel ? OORDEEL[n.oordeel] : 'Geen oordeel') + '</div><div>' + h(n ? n.reden : '') + '</div>' +
      (n && n.ladder ? '<div class="ladder">' + n.ladder.map(function (x) { return '<span class="st">' + merk(x.ok) + h(x.naam) + '</span>'; }).join('') + '</div>' : '') + '</div>';
    s += '<div class="tegel"><div class="lbl">Koopprijs (NAIC)</div><div class="groot">' + (kp && kp.prijs ? geld(kp.prijs) + ' <span class="klein">' + h(val) + '</span>' : 'Geen') + '</div><div class="zacht">' +
      h(kp && kp.prijs ? (kp.afstand != null ? 'Koers nu ' + (kp.afstand <= 0 ? getal(-kp.afstand, 1) + '% eronder.' : getal(kp.afstand, 1) + '% erboven.') : '') : kp ? kp.reden : '') + '</div>' +
      (n && n.gevoeligheid ? '<div class="zacht klein" style="margin-top:1.5mm">' + h(n.gevoeligheid.lager === n.oordeel && n.gevoeligheid.hoger === n.oordeel ? 'Stevig: blijft ' + OORDEEL[n.oordeel] + ' bij 2 procentpunt meer of minder groei.' : 'Op het randje: bij 2 procentpunt minder groei ' + (OORDEEL[n.gevoeligheid.lager] || 'geen oordeel') + ', bij meer groei ' + (OORDEEL[n.gevoeligheid.hoger] || 'geen oordeel') + '.') + '</div>' : '') + '</div>';
    s += '<div class="tegel"><div class="lbl">Gezondheidscheck (zes metingen)</div><div class="groot o-' + (b.oordeel || 'geen') + '">' + (b.oordeel ? GEZOND[b.oordeel] : 'Te weinig metingen') + '</div><div class="zacht">' +
      h(b.oordeel ? 'Gemiddelde ' + getal(b.score, 2) + ' over ' + b.aantal + ' van ' + b.mogelijk + ' metingen. Geen koopadvies; telt niet mee in het NAIC-oordeel.' : b.aantal + ' van ' + b.mogelijk + ' metingen beschikbaar.') + '</div>' +
      '<div class="zacht klein" style="margin-top:1.5mm">Gegevens: ' + (gate.allowed ? '✓ bevestigd' : 'niet bevestigd') + '</div></div>';
    s += '</div>';

    // Wat betekent dit
    s += '<section class="blok"><h2>Wat betekent dit?</h2><div class="uitleg">' + h(samenvattingTekst(n)) + '</div>';
    if (n && n.zones) s += '<h3>Verwachte koersband over ' + n.horizon + ' jaar</h3>' + zonesSvg(n.zones, val) +
      '<p class="zacht klein">De band loopt van de verwachte lage koers (' + geld(n.zones.laag) + ') tot de verwachte hoge koers (' + geld(n.zones.hoog) + ' ' + h(val) + '), in drie gelijke delen. NAIC koopt in het onderste derde.</p>';
    s += '</section>';

    // De vijf stappen
    s += '<section class="blok"><h2>Zo komt het NAIC-oordeel tot stand</h2>' + (n && n.ladder ? stappen(n, val) : '<p>' + h(n ? n.reden : 'Geen NAIC-uitkomst.') + '</p>') +
      '<p class="zacht klein" style="margin-top:2mm">Kopen = alle vijf stappen ✓. Valt stap 1 af, dan Vermijden. Valt stap 2 af, dan hoogstens Neutraal. Anders beslist de plek van de koers: koopzone of eronder met 3 : 1 is Kopen; verkoopzone of erboven is Vermijden; daartussen Neutraal.</p></section>';

    // Berekening
    if (n && n.groeiHistorisch !== null) {
      var z = n.zones, rij = function (a, v, u) { return '<tr><th scope="row">' + a + '</th><td>' + v + (u ? '<div class="zacht klein">' + u + '</div>' : '') + '</td></tr>'; };
      var t = '';
      t += rij('Groei winst per aandeel', pct(n.groeiHistorisch) + ' per jaar (trend ' + n.van + '–' + n.tot + ')' + (n.groeiEigen != null ? '; gerekend met uw verwachting ' + pct(n.groeiEigen) : n.groei < n.groeiHistorisch ? '; gerekend met ' + pct(n.groei) : ''), 'Trendlijn door de jaren met positieve winst. NAIC rekent voorzichtig: hoogstens ' + N.GROEI_MAX + '% per jaar.');
      if (n.kw) t += rij('Gemiddelde K/W', 'hoog ' + getal(n.kw.hoog, 1) + ' · laag ' + getal(n.kw.laag, 1) + ' (' + n.kw.van + '–' + n.kw.tot + ')' + (n.weggelaten && n.weggelaten.length ? '; ongewone jaren weggelaten: ' + n.weggelaten.join(', ') : ''), 'Gemiddelde van de hoogste en laagste K/W per jaar over de laatste ' + n.kw.jaren + ' jaar.');
      if (n.eps) t += rij('Winst per aandeel', 'laatste jaar ' + geld(n.eps) + (n.epsLaag && n.epsLaag !== n.eps ? ' · laagste van 5 jaar ' + geld(n.epsLaag) : ''));
      if (z) {
        t += rij('Winst per aandeel over ' + n.horizon + ' jaar', geld(z.epsToekomst), geld(n.eps) + ' × (1 + ' + getal(n.groei, 1) + '%)<sup>' + n.horizon + '</sup>');
        t += rij('Verwachte hoge koers', geld(z.hoog) + ' ' + h(val), geld(z.epsToekomst) + ' × K/W hoog ' + getal(n.kw.hoog, 1));
        t += rij('Verwachte lage koers', geld(z.laag) + ' ' + h(val), 'laagste winst per aandeel van 5 jaar ' + geld(n.epsLaag) + ' × K/W laag ' + getal(n.kw.laag, 1));
        t += rij('Zones', 'kopen ' + geld(z.koop[0]) + '–' + geld(z.koop[1]) + ' · houden tot ' + geld(z.houd[1]) + ' · verkopen tot ' + geld(z.verkoop[1]));
        if (ok(z.koers)) t += rij('Opwaarts tegen neerwaarts', (z.verhouding !== null ? getal(z.verhouding, 1) + ' : 1' : '–') + (z.verhouding !== null ? (z.verhouding >= 3 ? ' ✓' : ' ✗ (NAIC vraagt 3 : 1)') : ''), '(' + geld(z.hoog) + ' − ' + geld(z.koers) + ') ÷ (' + geld(z.koers) + ' − ' + geld(z.laag) + ')');
        if (n.totaal) t += rij('Totaalrendement', pct(n.totaal.totaal) + ' per jaar' + (n.totaal.ok ? ' ✓' : ' ✗ (NAIC vraagt ' + n.totaal.min + '%)'), 'koers naar de hoge koers ' + pct(n.totaal.koers) + ' per jaar + gemiddeld dividendrendement ' + (n.totaal.dividend !== null ? pct(n.totaal.dividend) : '0%'));
        if (n.relatief) t += rij('Relatieve waarde', n.relatief.pct + '% (' + { duur: 'duur', laag: 'laag', normaal: 'normaal' }[n.relatief.oordeel] + ')', 'K/W nu ' + getal(n.relatief.kwNu, 1) + ' ÷ gemiddelde K/W ' + getal(n.relatief.kwGem, 1) + '. NAIC ziet liefst ' + N.RV_LAAG + '–' + N.RV_HOOG + '%. Ter informatie.');
        if (n.par) t += rij('Verwacht gemiddeld rendement', pct(n.par.pct) + ' per jaar', 'Als de K/W over 5 jaar op het gemiddelde staat: koers dan ' + geld(n.par.koersDoel) + ' ' + h(val) + '. Ter informatie.');
      }
      if (kp && kp.prijs && kp.grenzen) t += rij('Koopprijs', geld(kp.prijs) + ' ' + h(val), 'laagste van: bovengrens koopzone ' + geld(kp.grenzen.zone) + ', 3 : 1-grens ' + geld(kp.grenzen.verhouding) + ', 15%-grens ' + geld(kp.grenzen.rendement));
      s += '<section class="blok"><h2>De berekening</h2><table class="kv"><tbody>' + t + '</tbody></table></section>';
    }

    // Groeigrafiek en jaarcijfers
    if (jr.length) {
      s += '<section class="blok"><h2>Groei in beeld</h2><p class="zacht klein">Zoals de NAIC-groeigrafiek: logaritmische schaal, eerste jaar = 100. Evenwijdige, stijgende lijnen betekenen gezonde, gelijkmatige groei.</p>' + groeiSvg(jr) + '</section>';
      s += '<section><h2>Jaarcijfers ' + jr[0].year + '–' + jr[jr.length - 1].year + ' <span class="zacht klein">(' + h(val) + ')</span></h2><div class="schuif">' + jaartabel(jr, N) + '</div>' +
        '<p class="zacht klein" style="margin-top:1.5mm">K/W hoog = hoogste koers ÷ winst per aandeel van dat jaar; K/W laag idem met de laagste koers. Vrije kasstroom = kasstroom uit bedrijf − investeringen.</p></section>';
    }

    // Zes metingen
    s += '<section><h2>Gezondheidscheck: zes metingen <span class="zacht klein">(geen koopadvies, geen NAIC-regels)</span></h2><ul class="met">' + b.metingen.map(function (m) {
      if (m.nvt) return '<li><span class="mk onb">–</span><div><b>' + h(m.kort) + '</b> · ' + h(m.naam || '') + '<br><span class="zacht">Niet van toepassing.</span></div></li>';
      if (!m.aanwezig) return '<li><span class="mk onb">?</span><div><b>' + h(m.kort) + '</b> · ' + h(m.naam || '') + '<br><span class="zacht">Ontbreekt: ' + h(m.reden) + '</span></div></li>';
      return '<li><span class="mk ' + scoreKlasse(m.score) + '">' + (m.score >= 0.25 ? '+' : m.score <= -0.25 ? '−' : '•') + '</span><div><b>' + h(m.kort) + '</b> · ' + h(m.naam) + ' — <i>' + scoreWoord(m.score) + '</i><br>' + h(m.tekst) +
        (m.detail && m.detail.length ? '<div class="rek">' + h(m.detail.join(' · ')) + '</div>' : '') + '</div></li>';
    }).join('') + '</ul><p class="zacht klein" style="margin-top:1.5mm">Elke meting telt even zwaar (+1 gunstig, 0 neutraal, −1 ongunstig). Kopen vanaf gemiddeld +0,5; Vermijden vanaf −0,25.</p></section>';

    // Management: feiten (nachtelijke update en jaarcijfers). Geen oordeel; uw eigen beoordeling staat hieronder bij Ter informatie.
    var MG = o.Management || root.Management, mf = MG ? MG.feiten(rec, jr) : null;
    if (mf) {
      s += '<section class="blok" data-management><h2>Management: feiten <span class="zacht klein">(geen oordeel, telt niet mee)</span></h2><table class="kv"><tbody>' +
        mf.regels.map(function (r) {
          return '<tr data-feit="' + r.id + '"><th scope="row">' + h(r.label) + '</th><td>' + (r.waarde === null ? '<span class="zacht">onbekend</span>' : '<b>' + h(r.waarde) + '</b>') +
            (r.toelichting ? '<div class="klein">' + h(r.toelichting) + '</div>' : '') + '<div class="zacht klein">' + h(r.bron) + '</div></td></tr>';
        }).join('') +
        (mf.bestuurders.length ? '<tr><th scope="row">Topbestuurders</th><td>' + mf.bestuurders.map(function (x) { return h(x.naam) + ' <span class="zacht">(' + h(x.functie) + ')</span>'; }).join('; ') + '</td></tr>' : '') +
        '</tbody></table><p class="zacht klein" style="margin-top:1.5mm">Feiten om uw eigen beoordeling van het management op te baseren. Insidertransacties zijn vooral voor Amerikaanse en Britse fondsen beschikbaar. Een governance-score van ISS is een risicoschatting van dat bureau, geen feit over de prestaties.</p></section>';
    }

    // Ter informatie
    s += '<section><h2>Ter informatie <span class="zacht klein">(telt niet mee)</span></h2><div class="twee">';
    b.vragen.forEach(function (v) {
      if (!v.info.length) return;
      s += '<div class="blok"><h3>' + h(v.kort) + ' <span class="zacht">— ' + h(v.vraag) + '</span></h3><ul class="met">' + v.info.map(function (m) {
        return '<li><span class="mk ' + (m.aanwezig ? scoreKlasse(m.score) : 'onb') + '">' + (m.aanwezig ? (m.score >= 0.25 ? '+' : m.score <= -0.25 ? '−' : '•') : '–') + '</span><div><b>' + h(m.naam) + '</b><br>' +
          (m.aanwezig ? h(m.tekst) : '<span class="zacht">' + (v.id === 'eigen' ? 'Niet ingevuld.' : 'Gegevens ontbreken.') + '</span>') + '</div></li>';
      }).join('') + '</ul></div>';
    });
    s += '</div></section>';

    // Koers en analisten
    var ana = rec.analisten, ADV = { strong_buy: 'sterk kopen', buy: 'kopen', hold: 'houden', underperform: 'onder het gemiddelde', sell: 'verkopen', strong_sell: 'sterk verkopen' };
    s += '<section class="twee blok"><div><h2>Koers</h2><table class="kv"><tbody>' +
      '<tr><th>Slotkoers</th><td>' + geld(k.slot) + ' ' + h(val) + ' (' + h(datumNl(k.datum)) + ')</td></tr>' +
      '<tr><th>Gemiddelde 50 dagen</th><td>' + geld(k.sma50) + '</td></tr><tr><th>Gemiddelde 200 dagen</th><td>' + geld(k.sma200) + '</td></tr>' +
      '<tr><th>52 weken</th><td>laag ' + geld(k.laag52) + ' · hoog ' + geld(k.hoog52) + '</td></tr><tr><th>RSI (14 dagen)</th><td>' + getal(k.rsi14, 1) + '</td></tr>' +
      (k.bereik ? '<tr><th>' + (k.bereik.jaren || 10) + ' jaar</th><td>laag ' + geld(k.bereik.laag) + ' · hoog ' + geld(k.bereik.hoog) + '</td></tr>' : '') + '</tbody></table></div>';
    s += '<div><h2>Analisten</h2>' + (ana && ana.aantal > 0 ? '<p>Gemiddeld advies van ' + ana.aantal + ' analisten: <b>' + h(ADV[ana.advies] || ana.advies) + '</b>' + (ok(ana.gemiddeld) ? ' (' + getal(ana.gemiddeld, 2) + ' op een schaal van 1 = sterk kopen tot 5 = verkopen)' : '') + '.' +
      (ok(ana.koersdoel) ? ' Gemiddeld koersdoel ' + geld(ana.koersdoel) + ' ' + h(ana.valuta || val) + '.' : '') + '</p>' : '<p class="zacht">Geen analistenadvies bekend.</p>') +
      '<p class="zacht klein">Bron: Yahoo Finance' + (ana && ana.datum ? ', ' + h(datumNl(ana.datum)) : '') + '. Een mening; telt niet mee. Analisten zijn gemiddeld optimistisch.</p></div></section>';

    // Kortetermijnsignaal: zelfde regels als het tabblad Koers (alleen bij een verse koers); los van NAIC-oordeel en gezondheidscheck
    var KT = o.Kortetermijn || root.Kortetermijn, kt = KT ? KT.kortetermijn(rec.koers, vers) : null;
    if (kt) {
      var ktDetail = function (c) {
        if (c.ok === null) return 'onbekend';
        if (c.id === 'trend200' || c.id === 'mom6') return pct(c.waarde);
        if (c.id === 'kruis') return c.dagen == null ? (c.ok ? 'ja' : 'nee') : (c.minstens ? 'al minstens ' : 'sinds ') + c.dagen + (c.dagen === 1 ? ' handelsdag' : ' handelsdagen');
        if (c.id === 'rsi') return getal(c.waarde, 0) + (c.ok ? '' : ' (hoog)');
        return c.ok ? 'ja' : 'nee';
      };
      s += '<section class="blok" data-kortetermijn="' + kt.status + '"><h2>Kortetermijnsignaal: <span class="o-' + ({ gunstig: 'kopen', neutraal: 'neutraal', afwachten: 'vermijden', onvoldoende: 'geen' }[kt.status]) + '">' + h(kt.label) + '</span> <span class="zacht klein">(los van het NAIC-oordeel)</span></h2><ul class="met">' +
        kt.checks.map(function (c) { return '<li>' + merk(c.ok) + '<div>' + h(c.label) + ': <b>' + h(ktDetail(c)) + '</b></div></li>'; }).join('') + '</ul>' +
        '<p><b>' + kt.ja + ' van ' + kt.totaal + ' checks</b>' + (kt.status === 'onvoldoende' ? ' (' + (kt.totaal - kt.bekend) + ' niet te berekenen, dus geen uitkomst)' : '') + '. Gunstig moment bij 4 of 5, neutraal bij 2 of 3, afwachten bij 0 of 1.</p>' +
        '<p class="zacht klein">Alleen over het koersverloop van de afgelopen maanden, voor wie het moment van kopen wil kiezen. Verandert het NAIC-oordeel en de gezondheidscheck niet. Geen garantie voor wat de koers gaat doen.</p></section>';
    } else if (ok(k.slot) && !vers) {
      s += '<section class="blok" data-kortetermijn="geen"><h2>Kortetermijnsignaal</h2><p class="zacht">Niet getoond: de koers is ouder dan ' + G.MAX_PRICE_AGE_DAYS + ' dagen.</p></section>';
    }

    // Gegevens en bronnen
    var arch = g.archief || {}, lv = arch.laatste_verslag || {}, herw = (arch.meldingen || []).filter(function (m) { return m.soort === 'herwerking'; }).length;
    s += '<section class="blok"><h2>Gegevens en bronnen</h2><table class="kv"><tbody>' +
      '<tr><th>Status</th><td>' + (gate.allowed ? '✓ Bevestigd: winst per aandeel onafhankelijk nagerekend over ' + g.eps_verified_years + ' jaar, één valuta (' + h((g.currencies || []).join(', ')) + '), geen bronregels afgewezen, koers niet ouder dan ' + G.MAX_PRICE_AGE_DAYS + ' dagen.' : 'Niet bevestigd: ' + h(gate.reasons.join(' '))) + '</td></tr>' +
      (g.gecontroleerd_op ? '<tr><th>Gecontroleerd op</th><td>' + h(datumNl(g.gecontroleerd_op)) + '</td></tr>' : '') +
      (lv.form ? '<tr><th>Bron jaarcijfers</th><td>SEC-indieningen (' + h(lv.form) + '), ' + (arch.verslagen || '?') + ' verslagen; laatste ingediend ' + h(datumNl(lv.ingediend)) + ' over het boekjaar tot ' + h(datumNl(lv.boekjaar_einde)) + '.' + (herw ? ' ' + herw + ' latere herwerkingen van oude cijfers gevonden en verwerkt.' : '') + '</td></tr>' : '') +
      (g.eps_toelichting ? '<tr><th>Aantal aandelen</th><td>' + h(g.eps_toelichting.replace(/^./, function (c) { return c.toUpperCase(); })) + '.</td></tr>' : '') +
      '<tr><th>Gegevens van</th><td>' + h(datumNl(o.gemaakt)) + ' (nachtelijke update)</td></tr></tbody></table>' +
      ((g.waarschuwingen || []).length ? '<h3>Kanttekeningen bij de gegevens</h3><ul class="punt">' + g.waarschuwingen.map(function (w) { return '<li>' + h(w) + '</li>'; }).join('') + '</ul>' : '') + '</section>';

    // Bedrijf
    if (bed.beschrijving) s += '<section class="blok"><h2>Het bedrijf</h2><p>' + h(bed.beschrijving) + '</p><p class="zacht klein">' + h([bed.hoofdkantoor ? 'Hoofdkantoor ' + bed.hoofdkantoor : '', bed.opgericht ? 'opgericht ' + bed.opgericht : '', bed.website || ''].filter(Boolean).join(' · ')) + '</p></section>';

    // Begrippen
    if (o.uitleg && o.uitleg.length) s += '<section><h2>Wat betekenen de begrippen?</h2><dl class="begrip">' + o.uitleg.map(function (t) { return '<div><dt>' + h(t.naam) + '</dt><dd>' + h(t.tekst) + '</dd></div>'; }).join('') + '</dl></section>';

    s += '<div class="voet">Aandeel Signaal (bèta) · automatisch berekend uit de jaarcijfers en de koers op de genoemde datums · geen beleggingsadvies. Controleer belangrijke cijfers zelf in het jaarverslag.</div>';
    return s + '</main></body></html>';
  }

  var api = { pagina: pagina, zonesSvg: zonesSvg, groeiSvg: groeiSvg };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Afdruk = api;
})(typeof self !== 'undefined' ? self : this);
