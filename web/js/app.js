/* Aandeel Signaal - schermen. Alle labels komen uit Gate.labelGate met de datum van VANDAAG op dit toestel. */
(function () {
  'use strict';
  var APP_VERSIE = '2026.10.20-beta.32';
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
    check: 'M5 5h14v14H5z M8.5 12.5l2.5 2.5 4.5-5',
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
    s += dashboardHtml(R);
    s += '<section><div class="rij-kop"><h2>Mijn volglijst</h2><a class="link" href="#/volglijst">Alles zien</a></div>';
    s += vol.length ? '<div class="kaarten">' + vol.map(function (rec) { return kaartLink(rec, by[rec.ticker]); }).join('') + '</div>'
      : '<div class="kaart-plat"><p>Uw volglijst is nog leeg. Open een aandeel en kies “Op mijn volglijst”.</p><div class="knoppen"><a class="knop" href="#/zoek">Aandeel zoeken</a></div></div>';
    s += '</section><section><div class="rij-kop"><h2>Interessante aandelen</h2><a class="link" href="#/overzicht">Alles zien</a></div><div class="knoppen"><a class="knop rand klein" href="#/vergelijk">Twee aandelen vergelijken</a></div><div class="lijst">' +
      top.map(function (r) { return rijLink(zoek(r.ticker), r); }).join('') + '</div><p class="zacht">Aandelen zonder bevestigde gegevens krijgen geen oordeel.</p></section>';
    return s + backupBalk();
  }

  var tabelKeuze = { alleenBevestigd: false, trend200: '', sorteer: 'naam', richting: 'op' };
  var TABEL_KOP = { naam: 'Aandeel', afstandPct: 'Afstand tot gemiddelde', omzetgroei: 'Omzetgroei p.j.', epsgroei: 'Winstgroei p.j.', nettomarge: 'Nettomarge' };
  function dashboardHtml(R) {
    var pos = winkel.portefeuille(), res = Portefeuille.waardeer(pos, DATA.aandelen, vandaag(), Gate), sp = Dashboard.spreiding(res.regels, DATA.aandelen);
    var volT = winkel.volglijst().map(function (v) { return v.ticker; }), a = Dashboard.aandacht(R, volT, res.regels);
    var s = '<section id="dash"><h2>Dashboard</h2><div class="kpis">';
    if (res.totalen.length) {
      s += res.totalen.map(function (t) { return '<a class="kpi" href="#/portefeuille" style="text-decoration:none;color:inherit"><b>' + (t.meegeteld ? getal(t.waarde, 0) + ' ' + h(t.valuta) : '–') + '</b><span>Portefeuille (' + h(t.valuta) + ')</span>' +
        (t.meegeteld && t.pct != null ? '<span style="color:' + kleur(t.winst) + ';font-weight:700">' + pct(t.pct) + '</span>' : '') + '</a>'; }).join('');
    } else s += '<a class="kpi" href="#/portefeuille" style="text-decoration:none;color:inherit"><b>–</b><span>Portefeuille: nog geen aankopen</span></a>';
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
      var ZT = { koop: 'in uw koopzone', houd: 'in uw afwacht-zone', verkoop: 'in uw verkoopzone', onder: 'onder uw lage koers', boven: 'boven uw hoge koers' };
      s += '<h3>Mijn koerszones</h3><div class="lijst" data-zones>' + zo.map(function (z) {
        return '<a href="#/a/' + encodeURIComponent(z.ticker) + '/waarde"><div class="tekstkolom"><b>' + h(z.naam) + '</b><span class="zacht">' + (z.zone ? h(ZT[z.zone] || z.zone) + (z.verhouding ? ' · opwaarts/neerwaarts ' + getal(z.verhouding, 1) + ' : 1' : '') : h(z.reden)) + '</span></div>' + I.pijl.replace('class="pijl"', 'width="18" height="18"') + '</a>';
      }).join('') + '</div><p class="zacht">Uw eigen aannames, geen koersdoel of advies. Zonder bevestigde gegevens en actuele koers staat er geen zone.</p>';
    }
    var vol = winkel.volglijst().map(function (v) { return zoek(v.ticker); }).filter(Boolean);
    var bron = vol.length ? vol : DATA.aandelen, vandaagD = vandaag();
    var kanten = bron.map(function (rec) { return Vergelijk.kant(rec, vandaagD, Gate); });
    var rijenT = Dashboard.tabel(kanten, tabelKeuze);
    function c(v, nul) { return v == null ? '<span class="zacht" title="Onbekend of niet bevestigd">–</span>' : nul(v); }
    s += '<h3>' + (vol.length ? 'Mijn volglijst in cijfers' : 'Alle aandelen in cijfers') + '</h3><div class="knoppen" style="align-items:center">' +
      '<label class="vink"><input type="checkbox" id="d-bev"' + (tabelKeuze.alleenBevestigd ? ' checked' : '') + '> Alleen bevestigd</label>' +
      '<label for="d-trend" class="zacht">Trend 200 dagen</label><select id="d-trend"><option value=""' + (!tabelKeuze.trend200 ? ' selected' : '') + '>Alle</option><option value="onder"' + (tabelKeuze.trend200 === 'onder' ? ' selected' : '') + '>Koers eronder</option><option value="boven"' + (tabelKeuze.trend200 === 'boven' ? ' selected' : '') + '>Koers erboven</option></select>' +
      '<label for="d-sort" class="zacht">Sorteer op</label><select id="d-sort">' + Dashboard.KOLOMMEN.map(function (k) { return '<option value="' + k + '"' + (k === tabelKeuze.sorteer ? ' selected' : '') + '>' + h(TABEL_KOP[k]) + '</option>'; }).join('') + '</select>' +
      '<button class="knop rand klein" id="d-rtg" aria-label="Sorteervolgorde omdraaien">' + (tabelKeuze.richting === 'op' ? '↑ Oplopend' : '↓ Aflopend') + '</button></div>';
    s += rijenT.length ? '<div class="schuif"><table class="vgl dash"><thead><tr><th>Aandeel</th><th>Koers vs gem.</th><th>Omzet p.j.</th><th>Winst p.j.</th><th>Marge</th></tr></thead><tbody>' + rijenT.map(function (k) {
      return '<tr><th scope="row"><a href="#/a/' + encodeURIComponent(k.ticker) + '">' + h(k.naam) + '</a><br>' + chipKort(k.bevestigd) + '</th><td>' + c(k.afstandPct, pct) + '</td><td>' + c(k.omzetgroei, pct) + '</td><td>' + c(k.epsgroei, pct) + '</td><td>' + c(k.nettomarge, function (v) { return getal(v, 1) + '%'; }) + '</td></tr>';
    }).join('') + '</tbody></table></div><p class="zacht">Groei en marge staan er alleen bij bevestigde aandelen. Een streepje betekent onbekend. Dit is geen rangorde of advies.</p>'
      : '<div class="kaart-plat"><p>Geen aandelen die aan dit filter voldoen.</p></div>';
    return s + '</section>';
  }
  function dashboardKoppel() {
    var b = document.getElementById('d-bev'), so = document.getElementById('d-sort'), r = document.getElementById('d-rtg');
    if (!b) return;
    b.addEventListener('change', function () { tabelKeuze.alleenBevestigd = b.checked; route(); });
    so.addEventListener('change', function () { tabelKeuze.sorteer = so.value; route(); });
    document.getElementById('d-trend').addEventListener('change', function (e) { tabelKeuze.trend200 = e.target.value; route(); });
    r.addEventListener('click', function () { tabelKeuze.richting = tabelKeuze.richting === 'op' ? 'af' : 'op'; route(); });
  }
  function backupBalk() {
    if (!winkel.backupNodig(vandaag())) return '';
    return '<div class="melding"><b>Maak een back-up van uw gegevens</b><span>Uw gegevens staan alleen op dit toestel. Met een back-up raakt u niets kwijt.</span><a class="knop klein" href="#/instellingen">Back-up maken</a></div>';
  }
  function schermOverzicht() {
    var R = Gate.sorteer(rijen());
    return '<section><div class="rij-kop"><h1>Overzicht</h1><a class="link" href="#/vergelijk">Aandelen vergelijken</a></div><div class="lijst">' + R.map(function (r) { return rijLink(zoek(r.ticker), r); }).join('') + '</div><p class="zacht">Selectiehulp, geen beleggingsadvies.</p></section>';
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

  /* ---- Vergelijken ---- */
  function chipKort(ok) { return ok ? '<span class="chip ok">✓ Bevestigd</span>' : '<span class="chip wacht">… Onbevestigd</span>'; }
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
      '<tr><th scope="row">Gegevens</th><td>' + chipKort(A.bevestigd) + '</td><td>' + chipKort(B.bevestigd) + '</td></tr>' +
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
    ['Wat betekent “Bevestigd”?', 'Een aandeel krijgt pas een oordeel als alle controles kloppen: de winst per aandeel van 10 jaar is onderbouwd, cijfers en koers staan in dezelfde valuta en de koers is niet ouder dan ' + Gate.MAX_PRICE_AGE_DAYS + ' dagen. Klopt er iets niet, dan zegt de app liever niets dan iets onzekers.'],
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
  var TABS = [['samenvatting', 'Overzicht'], ['koers', 'Koers'], ['waarde', 'NAIC'], ['check', 'Checklist'], ['gezondheid', 'Cijfers'], ['bronnen', 'Bronnen']];
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
      s += timingHtml(rec, fr);
    } else if (tab === 'waarde') {
      s += waardeHtml(rec, g, jr, r);
    } else if (tab === 'check') {
      s += checkHtml(rec);
    } else if (tab === 'gezondheid') {
      s += gezondHtml(g, jr);
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
    var pm = Naic.margeVoorBelasting(jr), ur = Naic.uitkeringsratio(jr), sr = Naic.schuldratio(jr), ir = Naic.investeringsratio(jr);
    var s = '<div id="naic-extra"><h2 style="margin-top:20px">Meer over het management</h2><p class="zacht">Cijfers die iets zeggen over hoe het bedrijf met geld omgaat. Het zijn aanwijzingen, geen oordeel.</p></div>';
    if (bank) return s + '<div class="melding"><b>Bank</b><span>Voor banken zeggen winstmarge vóór belasting, schuld en investeringen weinig. Daarom worden ze hier niet getoond.</span></div>' + blok('Uitgekeerd deel van de winst', ur, 'Uitgekeerd dividend als percentage van de nettowinst per jaar', function (v) { return getal(v, 0); }, 'Uitgekeerd dividend gedeeld door de nettowinst, in procenten.');
    return s + blok('Winstmarge vóór belasting', pm, 'Winstmarge vóór belasting per jaar in procenten', function (v) { return getal(v, 0); }, 'Winst vóór belasting als percentage van de omzet. Dit is de marge die de NAIC bedoelt; de definitie van “winst vóór belasting” kan per bedrijf iets verschillen.') +
      blok('Uitgekeerd deel van de winst', ur, 'Uitgekeerd dividend als percentage van de nettowinst per jaar', function (v) { return getal(v, 0); }, 'Uitgekeerd dividend gedeeld door de nettowinst, in procenten. Boven 100% betekent meer uitkeren dan er verdiend is.') +
      blok('Schuld t.o.v. totaal kapitaal', sr, 'Langlopende schuld als percentage van schuld plus eigen vermogen per jaar', function (v) { return getal(v, 0); }, 'Langlopende schuld gedeeld door schuld plus eigen vermogen, in procenten. Lager is veiliger; wat gebruikelijk is verschilt per sector.') +
      blok('Investeringen t.o.v. afschrijvingen', ir, 'Investeringen in vaste activa gedeeld door afschrijvingen per jaar', function (v) { return getal(v, 1); }, 'Boven 1,0 investeert het bedrijf meer dan er aan bezittingen slijt.');
  }
  /* Koers/winst in het verleden: hoogste en laagste koers van elk boekjaar gedeeld door de winst per aandeel. */
  function kwHistorieHtml(jr, bank) {
    var kw = Naic.historischKW(jr), gem = Naic.kwGemiddelden(kw, 5), dr = Naic.dividendRendement(jr);
    var heeftKW = kw.some(function (x) { return x.hoog !== null || x.laag !== null; });
    var s = '<section data-kw-historie><h2>Koers/winst in het verleden</h2>';
    if (!heeftKW) return s + '<p class="zacht">Onbekend: voor deze jaren is er geen volledige koershistorie in dezelfde valuta als de jaarcijfers, dus er wordt niets getoond.</p></section>';
    s += staven(kw.map(function (x) { return { year: x.year, waarde: x.hoog }; }), 'Hoogste koers/winst per jaar', function (v) { return getal(v, 0); }) + '<p class="zacht">Hoogste koers van het jaar gedeeld door de winst per aandeel.</p>';
    s += staven(kw.map(function (x) { return { year: x.year, waarde: x.laag }; }), 'Laagste koers/winst per jaar', function (v) { return getal(v, 0); }) + '<p class="zacht">Laagste koers van het jaar gedeeld door de winst per aandeel.</p>';
    if (gem) s += '<p data-kw-gem><b>Gemiddeld over ' + gem.jaren + ' jaar (' + gem.van + '–' + gem.tot + '): hoog ' + getal(gem.hoog, 1) + ', laag ' + getal(gem.laag, 1) + '.</b> Dit is hoe duur of goedkoop de markt het bedrijf in het verleden vond. Het zegt niets over de toekomst.</p>' +
      '<button class="knop rand klein" id="kw-over" data-kwh="' + gem.hoog + '" data-kwl="' + gem.laag + '">Neem deze K/W over in mijn koerszones</button>';
    if (!bank && dr.some(function (x) { return x.waarde !== null; })) s += staven(dr, 'Dividendrendement per jaar in procenten', function (v) { return getal(v, 1); }) + '<p class="zacht">Dividend per aandeel gedeeld door de gemiddelde koers van het jaar, in procenten.</p>';
    return s + '</section>';
  }
  function naicHtml(jr, bank) {
    var gc = Naic.groeiCijfers(jr), roe = Naic.rendementEigenVermogen(jr), mg = Naic.nettomarges(jr);
    function kp(w, t) { return '<div class="kpi"><b>' + (w == null ? '–' : pct(w)) + '</b><span>' + h(t) + '</span></div>'; }
    return '<div class="kaart-plat"><h2>NAIC-gids</h2><p class="zacht">De Stock Selection Guide van de NAIC, een Amerikaanse beleggersvereniging, in stappen. Het is een rekenhulp met uw eigen aannames, geen koersdoel en geen advies.</p></div>' +
      '<section><h2>Stap 1 · Groei per jaar</h2><div class="kpis">' + kp(gc.omzet10, 'Omzet (' + (gc.van || '?') + '–' + (gc.tot || '?') + ')') + kp(gc.omzet5, 'Omzet, laatste 5 jaar') + kp(gc.eps10, 'Winst per aandeel (' + (gc.van || '?') + '–' + (gc.tot || '?') + ')') + kp(gc.eps5, 'Winst per aandeel, laatste 5 jaar') + '</div>' +
      '<p class="zacht">Gelijkmatige groei van omzet én winst is volgens de NAIC een teken van een gezond bedrijf. Een streepje betekent dat er te weinig of geen positieve cijfers zijn.</p></section>' +
      '<section><h2>Stap 2 · Rendement op eigen vermogen</h2>' + staven(roe.reeks, 'Rendement op eigen vermogen per jaar in procenten', function (v) { return getal(v, 0); }) +
      '<p class="zacht">Nettowinst gedeeld door het eigen vermogen aan het eind van het jaar, in procenten.' + (roe.gemiddelde == null ? '' : ' Gemiddeld ' + getal(roe.gemiddelde, 1) + '% over ' + roe.jarenMetWaarde + ' jaar.') + ' Bij negatief of nul eigen vermogen (bijvoorbeeld door terugkoop van aandelen) is dit getal niet te berekenen en blijft het leeg.</p></section>' +
      '<section><h2>Stap 3 · Winstmarge</h2>' + staven(mg, 'Nettowinstmarge per jaar in procenten', function (v) { return getal(v, 0); }) +
      '<p class="zacht">Nettowinst als percentage van de omzet (na belasting).</p></section>' + kwHistorieHtml(jr, bank) + naicExtraHtml(jr, bank);
  }
  function zonesHtml(start, opgeslagen) {
    if (opgeslagen) start = { eps: opgeslagen.eps, groei: opgeslagen.groeiPct, epsl: opgeslagen.epsLaag, jaren: opgeslagen.jaren, kwh: opgeslagen.kwHoog, kwl: opgeslagen.kwLaag };
    else start = { eps: start.eps, groei: start.groei, epsl: start.eps, jaren: 5, kwh: 20, kwl: 10 };
    return '<div class="kaart-plat"><h2>Stap 4 · Koerszones</h2><p class="zacht">Wat zou de koers over een aantal jaar hoog en laag kunnen zijn bij uw aannames, en waar staat de koers nu in dat bereik? Pas de getallen aan.</p><div class="velden">' +
      veld('z-eps', 'Winst per aandeel nu', start.eps, '0.01') + veld('z-groei', 'Groei per jaar (%)', start.groei, '1') + veld('z-jaren', 'Jaren vooruit', start.jaren, '1') +
      veld('z-kwh', 'Hoge K/W', start.kwh, '1') + veld('z-kwl', 'Lage K/W', start.kwl, '1') + veld('z-epsl', 'Winst per aandeel in een slecht jaar', start.epsl, '0.01') +
      '</div><div id="zones" aria-live="polite"></div><div class="knoppen"><button class="knop klein" id="z-bewaar">Bewaar mijn zones</button><button class="knop rand klein" id="z-wis" hidden>Wis bewaarde zones</button></div><p class="zacht" id="z-status" aria-live="polite">Bewaard op dit toestel, zodat Start laat zien waar de koers in uw zones staat. Het is uw eigen aanname, geen koersdoel.</p></div>';
  }
  function zonesKoppel(rec, r) {
    var uit = document.getElementById('zones'); if (!uit) return;
    function lees(id) { return parseFloat(String(document.getElementById('v-' + id).value).replace(',', '.')); }
    var ZN = { koop: 'in de onderste derde van het bereik (koopzone)', houd: 'in het middelste derde van het bereik (afwachten)', verkoop: 'in de bovenste derde van het bereik (verkoopzone)', onder: 'onder de lage koers uit uw aannames', boven: 'boven de hoge koers uit uw aannames' };
    function reken() {
      try {
        var koers = r.bevestigd && rec.koers && r.koersActueel ? rec.koers.slot : null;
        var z = Naic.koerszones({ eps: lees('z-eps'), epsLaag: lees('z-epsl'), groeiPct: lees('z-groei'), jaren: lees('z-jaren'), kwHoog: lees('z-kwh'), kwLaag: lees('z-kwl'), koers: koers });
        var W = 320, p = function (v) { return Math.max(0, Math.min(1, (v - z.laag) / (z.hoog - z.laag))) * W; };
        var balk = '<svg class="grafiek" viewBox="0 0 320 54" role="img" aria-label="Koerszones van laag naar hoog"><rect x="0" y="14" width="' + (W / 3) + '" height="16" fill="var(--ok-bg)" stroke="var(--ok-ink)"/><rect x="' + (W / 3) + '" y="14" width="' + (W / 3) + '" height="16" fill="var(--wait-bg)" stroke="var(--wait-ink)"/><rect x="' + (2 * W / 3) + '" y="14" width="' + (W / 3) + '" height="16" fill="var(--bad-bg, var(--line))" stroke="var(--bad-ink)"/>' +
          (koers != null ? '<path d="M' + p(koers).toFixed(1) + ' 8 v28" stroke="var(--ink)" stroke-width="3"/><text text-anchor="middle" x="' + Math.max(24, Math.min(296, p(koers))).toFixed(1) + '" y="52">nu ' + getal(koers, 2) + '</text>' : '') + '<text x="0" y="10">' + getal(z.laag, 2) + '</text><text text-anchor="end" x="320" y="10">' + getal(z.hoog, 2) + '</text></svg>';
        var rest = koers == null
          ? '<div class="melding"><b>Geen vergelijking met de koers</b><span>De gegevens zijn nog niet volledig bevestigd of de koers ontbreekt. De zones hierboven zijn alleen uw eigen rekenvoorbeeld.</span></div>'
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
    if (!ev) return '<div class="melding"><b>Nog geen NAIC-gids</b><span>De NAIC-gids start pas als de winst per aandeel van 10 jaar onderbouwd is.</span></div>';
    var epsJr = jr.filter(function (j) { return typeof j.comparable_eps === 'number' && j.comparable_eps > 0; });
    var laatste = epsJr[epsJr.length - 1], eerste = epsJr[0];
    var gr = laatste && eerste && laatste.year > eerste.year ? groei(eerste.comparable_eps, laatste.comparable_eps, laatste.year - eerste.year) : null;
    var start = { eps: laatste ? Math.round(laatste.comparable_eps * 100) / 100 : 1, groei: gr == null ? 5 : Math.max(0, Math.min(15, Math.round(gr))), kw: 15, jaren: 5, rend: 10, marge: 25 };
    return naicHtml(jr, (g.waarschuwingen || []).some(function (w) { return /^Bank:/.test(w); })) + zonesHtml(start, winkel.zones(rec.ticker)) + '<div class="kaart-plat"><h2>Rekenvoorbeeld</h2><p class="zacht">Dit is een som met uw eigen aannames, geen koersdoel en geen advies. Pas de getallen aan om te zien wat er uitkomt.</p><div class="velden">' +
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
    function werk() { var el = document.getElementById('ck-voortgang'); if (el) el.innerHTML = '<b>' + h(voortgangTekst(Checklist.voortgang(winkel.checklist(rec.ticker)))) + '</b>'; }
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
    return '<section><h1>Hulp</h1><div class="kaart-plat"><h2>Zo gebruikt u de app</h2><ul class="punten"><li>Op Start ziet u in één oogopslag hoeveel aandelen volledig gecontroleerde gegevens hebben.</li><li>Tik op een aandeel voor details; onderin kiest u Overzicht, Koers, NAIC, Checklist (uw eigen aantekeningen over het management), Cijfers of Bronnen.</li><li>Met de ster zet u een aandeel op uw volglijst.</li><li>Maak af en toe een back-up (tandwiel rechtsboven), dan raakt u niets kwijt.</li></ul></div>' +
      '<div class="kaart-plat"><h2>Wanneer krijgt een aandeel een oordeel?</h2><p>Alleen als alle controles slagen: winst per aandeel van 10 jaar onderbouwd, één valuta, een koers van maximaal ' + Gate.MAX_PRICE_AGE_DAYS + ' dagen oud en geen afgewezen bronnen. Ontbreekt iets, dan zegt de app dat eerlijk en toont zij geen oordeel.</p></div>' +
      '<div class="kaart-plat"><h2>Rondleiding</h2><p class="zacht">Nog eens kijken hoe de app werkt?</p><div class="knoppen"><button class="knop rand" id="intro-opnieuw">Rondleiding bekijken</button></div></div>' +
      '<h2>Wat betekent dit?</h2>' + UITLEG.termen.map(function (x) { return '<details><summary>' + h(x.naam) + '</summary><p>' + h(x.tekst) + '</p></details>'; }).join('') + '<p class="zacht">Aandeel Signaal is een selectiehulp en geen beleggingsadvies.</p></section>';
  }
  function schermInstellingen() {
    var st = winkel.staat(), th = st.instellingen.thema, lb = st.laatsteBackup;
    return '<section><h1>Instellingen</h1>' + (winkel.fout() ? '<div class="melding"><b>Let op</b><span>' + h(winkel.fout()) + '</span></div>' : '') +
      '<div class="kaart-plat"><h2>Uiterlijk</h2><div class="keuze" role="group" aria-label="Licht of donker">' + [['auto', 'Automatisch'], ['licht', 'Licht'], ['donker', 'Donker']].map(function (o) { return '<button data-th="' + o[0] + '" aria-pressed="' + (th === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="kaart-plat"><h2>Back-up van uw gegevens</h2><p>Uw volglijst en portefeuille staan alleen op dit toestel, niet bij ons. ' + (lb ? 'Laatste back-up: ' + h(datumNl(lb.slice(0, 10))) + '.' : 'U heeft nog geen back-up gemaakt.') + '</p><div class="knoppen"><button class="knop" id="bk">Back-up maken</button><label class="knop rand" for="her" style="margin:0">Back-up terugzetten</label><input id="her" type="file" accept="application/json,.json" class="sr"></div><details><summary>Back-up als tekst (kopiëren of plakken)</summary><label for="bktekst">Tekst van de back-up</label><textarea id="bktekst" rows="5" style="width:100%;border-radius:12px;border:1px solid var(--line);background:var(--surface);color:var(--ink);padding:10px;font:13px ui-monospace,monospace"></textarea><div class="knoppen"><button class="knop rand klein" id="kopie">Kopieer</button><button class="knop rand klein" id="plak">Terugzetten uit deze tekst</button></div></details><p class="zacht">Bewaar het bestand in uw eigen cloud (bijvoorbeeld OneDrive of Google Drive). Terugzetten voegt toe aan wat er al staat.</p></div>' +
      '<div class="kaart-plat"><h2>Bewaren op dit toestel</h2><p id="pers" class="zacht">Even controleren…</p><div class="knoppen"><button class="knop rand" id="persknop">Vraag het toestel om gegevens te bewaren</button></div></div>' +
      '<p class="zacht">Versie ' + h(APP_VERSIE) + ' · gegevens van ' + h(datumNl(String(DATA.gemaakt || '').slice(0, 10))) + ' · ' + h(DATA.bron || '') + '</p></section>';
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
    if (t === 'licht' || t === 'donker') el.setAttribute('data-theme', t === 'donker' ? 'dark' : 'light'); else el.removeAttribute('data-theme');
  }

  function route() {
    var hash = location.hash || '#/', m = hash.match(/^#\/a\/([^\/]+)(?:\/(\w+))?$/), html, actief, titel = 'Aandeel Signaal', na = null, m2;
    if (m) {
      var t = decodeURIComponent(m[1]).toUpperCase(), tab = TABS.some(function (x) { return x[0] === m[2]; }) ? m[2] : 'samenvatting';
      html = schermAandeel(t, tab);
      $menu.innerHTML = menuHtml(TABS.map(function (x) { return ['#/a/' + encodeURIComponent(t) + '/' + x[0], x[1], x[0]]; }), '#/a/' + encodeURIComponent(t) + '/' + tab);
      var rec = zoek(t); if (rec) titel = rec.naam + ' · Aandeel Signaal';
      na = function () { aandeelKoppel(t); if (tab === 'check' && rec) checkKoppel(rec); if (tab === 'waarde' && rec) { var rr = Gate.maakRij(rec, vandaag()); waardeKoppel(rec, rr); zonesKoppel(rec, rr); } };
    } else if ((m2 = hash.match(/^#\/vergelijk(?:\/([^\/]+)\/([^\/]+))?$/))) {
      html = schermVergelijk(m2[1] ? decodeURIComponent(m2[1]).toUpperCase() : null, m2[2] ? decodeURIComponent(m2[2]).toUpperCase() : null);
      $menu.innerHTML = menuHtml(HOOFD, '#/'); na = vergelijkKoppel; titel = 'Vergelijken · Aandeel Signaal';
    } else {
      var kaart = { '#/': schermStart, '#/overzicht': schermOverzicht, '#/zoek': schermZoek, '#/volglijst': schermVolglijst, '#/portefeuille': schermPortefeuille, '#/hulp': schermHulp, '#/instellingen': schermInstellingen };
      var fn = kaart[hash] || schermStart; html = fn(); actief = kaart[hash] ? hash : '#/';
      if (hash === '#/overzicht') actief = '#/';
      $menu.innerHTML = menuHtml(HOOFD, actief);
      if (hash === '#/hulp') na = function () { var b = document.getElementById('intro-opnieuw'); if (b) b.addEventListener('click', function () { toonIntro(0); }); };
      if (hash === '#/portefeuille') na = portefeuilleKoppel; if (hash === '#/zoek') na = zoekKoppel; if (kaart[hash] === schermStart || !kaart[hash]) na = dashboardKoppel; if (hash === '#/instellingen') na = instKoppel;
    }
    $inhoud.innerHTML = html; document.title = titel;
    if (na) na();
  }
  var vorigeHash = null;
  window.addEventListener('hashchange', function () { route(); if (vorigeHash !== location.hash) window.scrollTo(0, 0); vorigeHash = location.hash; });
  pasThema(); route(); vorigeHash = location.hash;
  if (!winkel.introGezien()) toonIntro(0);
  if (window.matchMedia) { try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', pasThema); } catch (e) { /* oud */ } }
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) { try { navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) { /* geen offline-modus */ } }
})();
