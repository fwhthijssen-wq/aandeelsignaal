/* Aandeel Signaal - schermen. Alle labels komen uit Gate.labelGate met de datum van VANDAAG op dit toestel. */
(function () {
  'use strict';
  var DATA = window.AANDEEL_DATA || { aandelen: [] };
  var UITLEG = window.AANDEEL_UITLEG || { termen: [] };
  var opslag = null;
  try { opslag = window.localStorage; opslag.getItem('x'); } catch (e) { opslag = null; }
  var geheugen = {};
  var vals = opslag || { getItem: function (k) { return k in geheugen ? geheugen[k] : null; }, setItem: function (k, v) { geheugen[k] = String(v); } };
  var winkel = Store.maak(vals);
  var $inhoud = document.getElementById('inhoud'), $menu = document.getElementById('menu'), $meld = document.getElementById('melding');

  function h(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function vandaag() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function getal(n, dec) { return typeof n === 'number' && isFinite(n) ? n.toLocaleString('nl-NL', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec == null ? 0 : dec }) : '–'; }
  function mld(n) { return typeof n === 'number' ? getal(n / 1e9, 1) + ' mld' : '–'; }
  function datumNl(s) { var t = Gate.parseDay(s); return t !== null ? new Date(t).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : (s || 'onbekend'); }
  function pct(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + getal(Math.abs(n), 1) + '%'; }
  function zoek(t) { for (var i = 0; i < DATA.aandelen.length; i++) if (DATA.aandelen[i].ticker === t) return DATA.aandelen[i]; return null; }

  var I = {
    pijl: '<svg class="pijl" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    vink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    wacht: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
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
    gezondheid: 'M3 12h4l3-7 4 14 3-7h4', bronnen: 'M5 5h10a4 4 0 0 1 4 4v10H9a4 4 0 0 1-4-4z M9 9h6'
  };
  function menuHtml(items, actief) {
    return items.map(function (m) {
      return '<a href="' + m[0] + '"' + (m[0] === actief ? ' aria-current="page"' : '') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + PADEN[m[2]] + '"/></svg>' + h(m[1]) + '</a>';
    }).join('');
  }

  function rijen() { var t = vandaag(); return DATA.aandelen.map(function (r) { return Gate.maakRij(r, t); }); }
  function chip(ok) { return ok ? '<span class="chip ok">✓ Bevestigd</span>' : '<span class="chip wacht">… Nog niet bevestigd</span>'; }
  function trendTekst(r) {
    if (!r.koersActueel) return r.koersReden ? 'Koers ontbreekt of is verouderd' : '';
    return (r.richting === 'boven' ? 'Boven' : 'Onder') + ' gemiddelde, ' + pct(r.afstandPct);
  }
  function regel2(rec, r) { return h(rec.land + ' · ' + (r.koersActueel ? 'koers actueel' : 'geen actuele koers') + (r.richting ? ' · ' + (r.richting === 'boven' ? 'boven' : 'onder') + ' gemiddelde' : '')); }
  function rijLink(rec, r) {
    return '<a href="#/a/' + encodeURIComponent(rec.ticker) + '"><div class="tekstkolom"><b>' + h(rec.naam) + '</b><span class="zacht">' + regel2(rec, r) + '</span></div>' + chip(r.bevestigd) + I.pijl.replace('class="pijl"', 'width="18" height="18"') + '</a>';
  }
  function kaartLink(rec, r) {
    return '<a class="kaart" href="#/a/' + encodeURIComponent(rec.ticker) + '"><b>' + h(rec.ticker) + '</b><span class="zacht">' + h(rec.naam) + '</span>' + chip(r.bevestigd) + '<span>' + h(trendTekst(r)) + '</span>' + I.pijl + '</a>';
  }

  var HOOFD = [['#/', 'Start', 'start'], ['#/zoek', 'Zoeken', 'zoek'], ['#/volglijst', 'Volglijst', 'volglijst'], ['#/portefeuille', 'Portefeuille', 'portefeuille'], ['#/hulp', 'Hulp', 'hulp']];

  function schermStart() {
    var R = rijen(), by = {}; R.forEach(function (r) { by[r.ticker] = r; });
    var ok = R.filter(function (r) { return r.bevestigd; }).length, n = R.length;
    var seg = ''; for (var i = 0; i < 10; i++) seg += '<i' + (n && i < Math.round(ok / n * 10) ? ' class="aan"' : '') + '></i>';
    var vol = winkel.volglijst().map(function (v) { return zoek(v.ticker); }).filter(Boolean);
    var top = Gate.sorteer(R).slice(0, 6);
    var s = '<div class="hero"><small>Op een rij</small><div class="tel"><span class="groot">' + ok + '</span><span class="tekst">van ' + n + ' aandelen met<br>bevestigde gegevens</span></div><div class="seg" aria-hidden="true">' + seg + '</div>' +
      '<p class="voet">Gegevens gecontroleerd door de nachtelijke update (' + h(datumNl(String(DATA.gemaakt || '').slice(0, 10))) + '). Een aandeel krijgt pas een oordeel als alle controles kloppen.</p></div>';
    s += '<section><div class="rij-kop"><h2>Mijn volglijst</h2><a class="link" href="#/volglijst">Alles zien</a></div>';
    s += vol.length ? '<div class="kaarten">' + vol.map(function (rec) { return kaartLink(rec, by[rec.ticker]); }).join('') + '</div>'
      : '<div class="kaart-plat"><p>Uw volglijst is nog leeg. Open een aandeel en kies “Op mijn volglijst”.</p><div class="knoppen"><a class="knop" href="#/zoek">Aandeel zoeken</a></div></div>';
    s += '</section><section><div class="rij-kop"><h2>Interessante aandelen</h2><a class="link" href="#/overzicht">Alles zien</a></div><div class="lijst">' +
      top.map(function (r) { return rijLink(zoek(r.ticker), r); }).join('') + '</div><p class="zacht">Aandelen zonder bevestigde gegevens krijgen geen oordeel.</p></section>';
    return s + backupBalk();
  }
  function backupBalk() {
    if (!winkel.backupNodig(vandaag())) return '';
    return '<div class="melding"><b>Maak een back-up van uw gegevens</b><span>Uw gegevens staan alleen op dit toestel. Met een back-up raakt u niets kwijt.</span><a class="knop klein" href="#/instellingen">Back-up maken</a></div>';
  }
  function schermOverzicht() {
    var R = Gate.sorteer(rijen());
    return '<section><h1>Overzicht</h1><div class="lijst">' + R.map(function (r) { return rijLink(zoek(r.ticker), r); }).join('') + '</div><p class="zacht">Selectiehulp, geen beleggingsadvies.</p></section>';
  }
  function schermVolglijst() {
    var R = {}; rijen().forEach(function (r) { R[r.ticker] = r; });
    var v = winkel.volglijst().map(function (x) { return zoek(x.ticker); }).filter(Boolean);
    return '<section><h1>Mijn volglijst</h1>' + (v.length ? '<div class="lijst">' + v.map(function (rec) { return rijLink(rec, R[rec.ticker]); }).join('') + '</div>' :
      '<div class="kaart-plat"><p>Nog niets op uw volglijst.</p><div class="knoppen"><a class="knop" href="#/zoek">Aandeel zoeken</a></div></div>') + '</section>' + backupBalk();
  }
  function schermZoek() {
    return '<section><h1>Zoeken</h1><div><label for="q">Naam of beurscode</label><input id="q" type="search" autocomplete="off" placeholder="Bijvoorbeeld Apple of ASML"></div><div class="lijst" id="res"></div><p class="zacht">U zoekt in de aandelen die de nachtelijke update bijhoudt (nu ' + DATA.aandelen.length + ').</p></section>';
  }
  function zoekKoppel() {
    var q = document.getElementById('q'), res = document.getElementById('res'); if (!q) return;
    function toon() {
      var t = q.value.trim().toLowerCase(), R = {}; rijen().forEach(function (r) { R[r.ticker] = r; });
      var lst = DATA.aandelen.filter(function (a) { return !t || a.naam.toLowerCase().indexOf(t) > -1 || a.ticker.toLowerCase().indexOf(t) > -1; });
      res.innerHTML = lst.length ? lst.map(function (a) { return rijLink(a, R[a.ticker]); }).join('') : '<div class="regel"><span class="zacht">Niets gevonden. Probeer een andere naam of beurscode.</span></div>';
    }
    q.addEventListener('input', toon); toon();
  }

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
      s += '<div class="lijst">' + res.regels.map(function (r) {
        var p = r.positie;
        return '<div class="regel" style="flex-wrap:wrap"><div class="tekstkolom" style="flex:1 1 200px"><b>' + h(r.naam) + '</b><span class="zacht">' + getal(p.aantal, 4).replace(/,?0+$/, '') + ' stuks · gekocht voor ' + euro(p.koers, p.valuta) + (p.datum ? ' op ' + h(datumNl(p.datum)) : '') + '</span>' +
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
      '<div><label for="pf-d">Datum (mag leeg)</label><input id="pf-d" type="date"></div></div>' +
      '<p id="pf-fout" class="zacht" role="alert" style="color:var(--bad-ink)"></p><div class="knoppen"><button class="knop" type="submit">Toevoegen</button></div></form></div>' +
      '<p class="zacht">Alleen een overzicht van wat u zelf invoert, geen beleggingsadvies. Kosten en belasting zijn niet meegerekend. De waarde gebruikt de laatste slotkoers en alleen als die maximaal ' + Gate.MAX_PRICE_AGE_DAYS + ' dagen oud is.</p></section>' + backupBalk();
    return s;
  }
  function portefeuilleKoppel() {
    var sel = document.getElementById('pf-t'), val = document.getElementById('pf-v'); if (!sel) return;
    function vul() { var o = sel.options[sel.selectedIndex]; val.value = o ? o.getAttribute('data-valuta') || '' : ''; }
    sel.addEventListener('change', vul); vul();
    document.getElementById('pf').addEventListener('submit', function (e) {
      e.preventDefault();
      var u = winkel.voegPositieToe({ ticker: sel.value, aantal: document.getElementById('pf-n').value, koers: document.getElementById('pf-k').value, valuta: val.value, datum: document.getElementById('pf-d').value || null });
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

  /* ---- Aandeelpagina ---- */
  var TABS = [['samenvatting', 'Samenvatting'], ['koers', 'Koers'], ['waarde', 'Waarde'], ['gezondheid', 'Gezondheid'], ['bronnen', 'Bronnen']];
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
  function schermAandeel(t, tab) {
    var rec = zoek(t); if (!rec) return '<section><h1>Niet gevonden</h1><p>Dit aandeel zit niet in de lijst.</p><a class="knop" href="#/zoek">Zoeken</a></section>';
    var g = rec.gegevens && !rec.gegevens.fout ? rec.gegevens : null, k = rec.koers;
    var fr = k ? Gate.priceFreshness(k.datum, vandaag()) : { fresh: false, reason: 'Geen koersgegevens.' };
    var r = Gate.maakRij(rec, vandaag());
    var ob = winkel.zit(rec.ticker);
    var kop = '<div class="stelregel"><a class="link" href="#/" id="terug">' + I.terug + 'Terug</a><button class="volg" id="volg" aria-pressed="' + ob + '">' + I.ster + (ob ? 'Op mijn volglijst' : 'Zet op mijn volglijst') + '</button></div>' +
      '<div><span class="zacht" style="font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:.8rem">' + h(rec.ticker + ' · ' + rec.beurs) + '</span><h1>' + h(rec.naam) + '</h1></div>';
    var s = kop, jr = jaarLijst(g);
    if (tab === 'samenvatting') {
      s += '<div class="kaart-plat">' + (fr.fresh ? '<div class="rij-kop"><b style="font:700 2rem ui-rounded,system-ui">' + getal(k.slot, 2) + ' ' + h(rec.valuta) + '</b><span class="zacht">Slotkoers ' + h(datumNl(k.datum)) + '</span></div>' + sparkSvg(k.reeks, k.sma50) + '<p>' + (r.richting ? 'De koers staat ' + (r.richting === 'boven' ? 'boven' : 'onder') + ' het gemiddelde van de laatste 50 handelsdagen (' + pct(r.afstandPct) + ').' : '') + '</p>' :
        '<b>Geen actuele koers</b><p class="zacht">' + h(fr.reason) + ' Daarom tonen we geen oordeel en geen trend.</p>') + '</div>';
      s += '<div class="kaart-plat"><div class="rij-kop"><h2>' + (r.bevestigd ? 'Gegevens bevestigd' : (g && g.eps_status === 'independently_verified' && !fr.fresh ? 'Jaarcijfers bevestigd, koers ontbreekt' : 'Gegevens nog niet bevestigd')) + '</h2>' + chip(r.bevestigd) + '</div>' + checks(rec, g, null, fr) +
        (r.bevestigd ? '' : '<p class="zacht">' + h(r.redenen.join(' ')) + '</p>') + '</div>';
    } else if (tab === 'koers') {
      s += fr.fresh ? '<div class="kaart-plat">' + sparkSvg(k.reeks, k.sma50) + '<div class="legenda"><span><i style="background:var(--chart-a)"></i>Slotkoers</span><span><i style="background:var(--chart-b)"></i>Gemiddelde 50 dagen</span></div></div>' +
        '<div class="kpis"><div class="kpi"><b>' + getal(k.slot, 2) + '</b><span>Slotkoers (' + h(rec.valuta) + ')</span></div><div class="kpi"><b>' + getal(k.sma50, 2) + '</b><span>Gemiddelde 50 dagen</span></div><div class="kpi"><b>' + (r.afstandPct == null ? '–' : pct(r.afstandPct)) + '</b><span>Afstand tot gemiddelde</span></div></div>'
        : '<div class="melding"><b>Geen actuele koers beschikbaar</b><span>' + h(fr.reason) + '</span></div>';
    } else if (tab === 'waarde') {
      s += waardeHtml(rec, g, jr, r);
    } else if (tab === 'gezondheid') {
      s += gezondHtml(g, jr);
    } else {
      s += bronHtml(rec, g);
    }
    return s + '<p class="zacht">Selectiehulp, geen beleggingsadvies.</p>';
  }
  function waardeHtml(rec, g, jr, r) {
    var ev = g && g.eps_status === 'independently_verified' && g.eps_verified_years >= Gate.REQUIRED_EPS_YEARS;
    if (!ev) return '<div class="melding"><b>Nog geen rekenvoorbeeld</b><span>Het rekenvoorbeeld start pas als de winst per aandeel van 10 jaar onderbouwd is.</span></div>';
    var epsJr = jr.filter(function (j) { return typeof j.comparable_eps === 'number' && j.comparable_eps > 0; });
    var laatste = epsJr[epsJr.length - 1], eerste = epsJr[0];
    var gr = laatste && eerste && laatste.year > eerste.year ? groei(eerste.comparable_eps, laatste.comparable_eps, laatste.year - eerste.year) : null;
    var start = { eps: laatste ? Math.round(laatste.comparable_eps * 100) / 100 : 1, groei: gr == null ? 5 : Math.max(0, Math.min(15, Math.round(gr))), kw: 15, jaren: 5, rend: 10, marge: 25 };
    return '<div class="kaart-plat"><h2>Rekenvoorbeeld</h2><p class="zacht">Dit is een som met uw eigen aannames, geen koersdoel en geen advies. Pas de getallen aan om te zien wat er uitkomt.</p><div class="velden">' +
      veld('eps', 'Winst per aandeel nu', start.eps, '0.01') + veld('groei', 'Groei per jaar (%)', start.groei, '1') + veld('kw', 'K/W over de horizon', start.kw, '1') + veld('jaren', 'Jaren vooruit', start.jaren, '1') + veld('rend', 'Gewenst rendement (%)', start.rend, '1') + veld('marge', 'Veiligheidsmarge (%)', start.marge, '1') +
      '</div><div id="uitkomst" class="kpis" aria-live="polite"></div></div>' +
      (r.bevestigd ? '' : '<p class="zacht">Er wordt geen vergelijking met de koers gemaakt: de gegevens zijn nog niet volledig bevestigd of de koers ontbreekt.</p>');
  }
  function veld(id, tekst, v, stap) { return '<div><label for="v-' + id + '">' + h(tekst) + '</label><input id="v-' + id + '" type="number" inputmode="decimal" step="' + stap + '" value="' + h(v) + '"></div>'; }
  function waardeKoppel(rec, r) {
    var uit = document.getElementById('uitkomst'); if (!uit) return;
    function lees(id) { return parseFloat(String(document.getElementById('v-' + id).value).replace(',', '.')); }
    function reken() {
      try {
        var x = Gate.scenario(lees('eps'), lees('groei'), lees('kw'), lees('jaren'), lees('rend'), lees('marge'));
        var k = rec.koers, vgl = '';
        if (r.bevestigd && k) vgl = '<div class="kpi"><b>' + getal(k.slot, 2) + '</b><span>Slotkoers nu</span></div>';
        uit.innerHTML = '<div class="kpi"><b>' + getal(x.toekomstigeKoers, 2) + '</b><span>Koers over de horizon</span></div><div class="kpi"><b>' + getal(x.contanteWaarde, 2) + '</b><span>Waarde nu bij uw rendement</span></div><div class="kpi"><b>' + getal(x.naMarge, 2) + '</b><span>Na veiligheidsmarge</span></div>' + vgl;
      } catch (e) { uit.innerHTML = '<div class="melding" style="grid-column:1/-1"><b>Controleer de getallen</b><span>' + h(e.message) + '</span></div>'; }
    }
    ['eps', 'groei', 'kw', 'jaren', 'rend', 'marge'].forEach(function (i) { document.getElementById('v-' + i).addEventListener('input', reken); });
    reken();
  }
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
    var s = '<div class="kaart-plat"><h2>Waar komen de cijfers vandaan?</h2><p>Jaarcijfers: SEC (Amerikaanse toezichthouder) en, voor Europese bedrijven, jaarverslagen in ESEF-formaat. Koersen: Yahoo Finance. Gecontroleerd op ' + h(datumNl(g.gecontroleerd_op)) + '.</p></div>';
    if (g.splits && g.splits.length) s += '<section><h2>Aandelensplitsingen</h2>' + g.splits.map(function (sp) {
      return '<details><summary>' + h(datumNl(sp.datum)) + ' · ' + h(sp.ratio) + '-voor-1</summary><p>' + h(SPLIT[sp.status] || sp.status) + '.</p>' + (sp.redenen || []).map(function (x) { return '<p class="zacht">' + h(x) + '</p>'; }).join('') +
        (sp.bewijs && sp.bewijs.length ? '<ul class="punten">' + sp.bewijs.map(function (b) { return '<li>Boekjaar ' + h(b.periode) + ': winst per aandeel ' + h(b.voor.join('/')) + ' werd later ' + h(b.na.join('/')) + ' (factor ' + h(b.verhouding.join('/')) + ')</li>'; }).join('') + '</ul>' : '') + '</details>';
    }).join('') + '</section>';
    if (g.eps_toelichting) s += '<section><h2>Toelichting bij de controle</h2><p>' + h(g.eps_toelichting) + '</p></section>';
    var open = jaarLijst(g).filter(function (j) { return j.eps_check !== 'onderbouwd'; });
    if (open.length) s += '<section><h2>Jaren zonder onderbouwde winst per aandeel</h2><ul class="punten">' + open.map(function (j) {
      return '<li><b>' + j.year + '</b>: ' + h(j.eps_reden || 'nog geen onafhankelijke bevestiging beschikbaar') + '</li>'; }).join('') + '</ul></section>';
    if (g.waarschuwingen && g.waarschuwingen.length) s += '<section><h2>Let op</h2><ul class="punten">' + g.waarschuwingen.map(function (w) { return '<li>' + h(w) + '</li>'; }).join('') + '</ul></section>';
    return s;
  }
  function aandeelKoppel(t) {
    var tg = document.getElementById('terug');
    if (tg) tg.addEventListener('click', function (e) { if (history.length > 1) { e.preventDefault(); history.back(); } });
    var b = document.getElementById('volg'); if (!b) return;
    b.addEventListener('click', function () {
      if (winkel.zit(t)) { winkel.verwijder(t); toast('Van uw volglijst gehaald', function () { winkel.voegToe(t); route(); }); }
      else { var u = winkel.voegToe(t); toast(u.ok ? 'Op uw volglijst gezet' : (u.reden || 'Opslaan niet gelukt')); }
      route();
    });
  }

  function schermHulp() {
    return '<section><h1>Hulp</h1><div class="kaart-plat"><h2>Zo gebruikt u de app</h2><ul class="punten"><li>Op Start ziet u in één oogopslag hoeveel aandelen volledig gecontroleerde gegevens hebben.</li><li>Tik op een aandeel voor details; onderin kiest u Samenvatting, Koers, Waarde, Gezondheid of Bronnen.</li><li>Met de ster zet u een aandeel op uw volglijst.</li><li>Maak af en toe een back-up (tandwiel rechtsboven), dan raakt u niets kwijt.</li></ul></div>' +
      '<div class="kaart-plat"><h2>Wanneer krijgt een aandeel een oordeel?</h2><p>Alleen als alle controles slagen: winst per aandeel van 10 jaar onderbouwd, één valuta, een koers van maximaal ' + Gate.MAX_PRICE_AGE_DAYS + ' dagen oud en geen afgewezen bronnen. Ontbreekt iets, dan zegt de app dat eerlijk en toont zij geen oordeel.</p></div>' +
      '<h2>Wat betekent dit?</h2>' + UITLEG.termen.map(function (x) { return '<details><summary>' + h(x.naam) + '</summary><p>' + h(x.tekst) + '</p></details>'; }).join('') + '<p class="zacht">Aandeel Signaal is een selectiehulp en geen beleggingsadvies.</p></section>';
  }
  function schermInstellingen() {
    var st = winkel.staat(), th = st.instellingen.thema, lb = st.laatsteBackup;
    return '<section><h1>Instellingen</h1>' + (winkel.fout() ? '<div class="melding"><b>Let op</b><span>' + h(winkel.fout()) + '</span></div>' : '') +
      '<div class="kaart-plat"><h2>Uiterlijk</h2><div class="keuze" role="group" aria-label="Licht of donker">' + [['auto', 'Automatisch'], ['licht', 'Licht'], ['donker', 'Donker']].map(function (o) { return '<button data-th="' + o[0] + '" aria-pressed="' + (th === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="kaart-plat"><h2>Back-up van uw gegevens</h2><p>Uw volglijst en portefeuille staan alleen op dit toestel, niet bij ons. ' + (lb ? 'Laatste back-up: ' + h(datumNl(lb.slice(0, 10))) + '.' : 'U heeft nog geen back-up gemaakt.') + '</p><div class="knoppen"><button class="knop" id="bk">Back-up maken</button><label class="knop rand" for="her" style="margin:0">Back-up terugzetten</label><input id="her" type="file" accept="application/json,.json" class="sr"></div><details><summary>Back-up als tekst (kopiëren of plakken)</summary><label for="bktekst">Tekst van de back-up</label><textarea id="bktekst" rows="5" style="width:100%;border-radius:12px;border:1px solid var(--line);background:var(--surface);color:var(--ink);padding:10px;font:13px ui-monospace,monospace"></textarea><div class="knoppen"><button class="knop rand klein" id="kopie">Kopieer</button><button class="knop rand klein" id="plak">Terugzetten uit deze tekst</button></div></details><p class="zacht">Bewaar het bestand in uw eigen cloud (bijvoorbeeld OneDrive of Google Drive). Terugzetten voegt toe aan wat er al staat.</p></div>' +
      '<div class="kaart-plat"><h2>Bewaren op dit toestel</h2><p id="pers" class="zacht">Even controleren…</p><div class="knoppen"><button class="knop rand" id="persknop">Vraag het toestel om gegevens te bewaren</button></div></div>' +
      '<p class="zacht">Versie ' + h(window.AANDEEL_VERSIE || 'web') + ' · gegevens van ' + h(datumNl(String(DATA.gemaakt || '').slice(0, 10))) + ' · ' + h(DATA.bron || '') + '</p></section>';
  }
  function instKoppel() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-th]'), function (b) { b.addEventListener('click', function () { winkel.zetThema(b.getAttribute('data-th')); pasThema(); route(); }); });
    var bk = document.getElementById('bk');
    if (bk) bk.addEventListener('click', function () {
      var tekst = winkel.maakBackup(), naam = 'aandeel-signaal-backup-' + vandaag() + '.json';
      var bestand = null; try { bestand = new File([tekst], naam, { type: 'application/json' }); } catch (e) { /* oudere browser */ }
      if (bestand && navigator.canShare && navigator.canShare({ files: [bestand] })) {
        navigator.share({ files: [bestand], title: 'Back-up Aandeel Signaal' }).catch(function () { download(tekst, naam); });
      } else download(tekst, naam);
      var ta = document.getElementById('bktekst'); if (ta) ta.value = tekst;
      var dt = ta && ta.closest('details'); if (dt) dt.open = true;
      toast('Back-up gemaakt');
    });
    var kopie = document.getElementById('kopie'), plak = document.getElementById('plak'), tx = document.getElementById('bktekst');
    if (kopie) kopie.addEventListener('click', function () {
      if (!tx.value) tx.value = winkel.maakBackup();
      tx.select();
      (navigator.clipboard ? navigator.clipboard.writeText(tx.value) : Promise.reject()).then(function () { toast('Gekopieerd'); }, function () { toast('Selecteer de tekst en kopieer die zelf'); });
    });
    if (plak) plak.addEventListener('click', function () {
      var u = winkel.zetTerug(tx.value, 'samenvoegen'); toast(u.ok ? u.toegevoegd + ' aandelen toegevoegd; totaal ' + u.totaal : u.reden); if (u.ok) route();
    });
    var her = document.getElementById('her');
    if (her) her.addEventListener('change', function () {
      var f = her.files && her.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { var u = winkel.zetTerug(String(rd.result), 'samenvoegen'); toast(u.ok ? u.toegevoegd + ' aandelen toegevoegd; totaal ' + u.totaal : u.reden); route(); };
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
  function pasThema() {
    var t = winkel.staat().instellingen.thema, el = document.documentElement;
    if (t === 'licht' || t === 'donker') el.setAttribute('data-theme', t); else el.removeAttribute('data-theme');
  }

  function route() {
    var hash = location.hash || '#/', m = hash.match(/^#\/a\/([^\/]+)(?:\/(\w+))?$/), html, actief, titel = 'Aandeel Signaal', na = null;
    if (m) {
      var t = decodeURIComponent(m[1]).toUpperCase(), tab = TABS.some(function (x) { return x[0] === m[2]; }) ? m[2] : 'samenvatting';
      html = schermAandeel(t, tab);
      $menu.innerHTML = menuHtml(TABS.map(function (x) { return ['#/a/' + encodeURIComponent(t) + '/' + x[0], x[1], x[0]]; }), '#/a/' + encodeURIComponent(t) + '/' + tab);
      var rec = zoek(t); if (rec) titel = rec.naam + ' · Aandeel Signaal';
      na = function () { aandeelKoppel(t); if (tab === 'waarde' && rec) waardeKoppel(rec, Gate.maakRij(rec, vandaag())); };
    } else {
      var kaart = { '#/': schermStart, '#/overzicht': schermOverzicht, '#/zoek': schermZoek, '#/volglijst': schermVolglijst, '#/portefeuille': schermPortefeuille, '#/hulp': schermHulp, '#/instellingen': schermInstellingen };
      var fn = kaart[hash] || schermStart; html = fn(); actief = kaart[hash] ? hash : '#/';
      if (hash === '#/overzicht') actief = '#/';
      $menu.innerHTML = menuHtml(HOOFD, actief);
      if (hash === '#/portefeuille') na = portefeuilleKoppel; if (hash === '#/zoek') na = zoekKoppel; if (hash === '#/instellingen') na = instKoppel;
    }
    $inhoud.innerHTML = html; document.title = titel;
    if (na) na();
  }
  var vorigeHash = null;
  window.addEventListener('hashchange', function () { route(); if (vorigeHash !== location.hash) window.scrollTo(0, 0); vorigeHash = location.hash; });
  pasThema(); route(); vorigeHash = location.hash;
  if (window.matchMedia) { try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', pasThema); } catch (e) { /* oud */ } }
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) { try { navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) { /* geen offline-modus */ } }
})();
