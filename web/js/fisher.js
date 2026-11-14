/* Kwaliteitscheck: ondersteunende gegevens bij de 15 punten van Philip Fisher. Alleen feiten uit de jaarcijfers en van
   Yahoo Finance, met bron; de app vult geen antwoord in en geeft geen score. Punten waarvoor geen betrouwbare gegevens
   bestaan (2, 7, 8, 9, 14) krijgen niets. Per punt: [{ label, waarde, bron }]; ontbreekt een feit, dan geen regel. */
(function (root) {
  'use strict';
  function num(x) { return typeof x === 'number' && isFinite(x); }
  function pos(x) { return num(x) && x > 0; }
  function nl(x, d) { return x.toLocaleString('nl-NL', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function pct(x, d) { return nl(x, d == null ? 1 : d) + '%'; }
  function pctTeken(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + nl(Math.abs(x), 1) + '%'; }
  function jaren(jr) { return (jr || []).filter(function (j) { return j && num(j.year); }).slice().sort(function (a, b) { return a.year - b.year; }); }
  function cagr(a, b, n) { return pos(a) && pos(b) && n > 0 ? (Math.pow(b / a, 1 / n) - 1) * 100 : null; }
  function deel(t, n) { return num(t) && pos(n) ? t / n * 100 : null; }
  function mediaan(xs) { xs = xs.filter(num).sort(function (a, b) { return a - b; }); var n = xs.length; return n ? (n % 2 ? xs[(n - 1) / 2] : (xs[n / 2 - 1] + xs[n / 2]) / 2) : null; }

  /* Reeks van een verhouding per jaar (alleen jaren met waarde). */
  function reeks(jr, f) { return jaren(jr).map(function (j) { return { year: j.year, v: f(j) }; }).filter(function (r) { return num(r.v); }); }
  function margeVb(j) { return deel(j.pretax_income, j.sales); }
  function margeNetto(j) { return deel(j.net_income, j.sales); }

  /* Groei per jaar van de omzet over de hele reeks en over de laatste 3 jaar. */
  function omzetGroei(jr) {
    var v = jaren(jr).filter(function (j) { return pos(j.sales); }), uit = {};
    if (v.length >= 2) { var f = v[0], l = v[v.length - 1]; uit.lang = { van: f.year, tot: l.year, pct: cagr(f.sales, l.sales, l.year - f.year) }; }
    if (v.length >= 4) { var b = v[v.length - 4], e = v[v.length - 1]; uit.kort = { van: b.year, tot: e.year, pct: cagr(b.sales, e.sales, e.year - b.year) }; }
    return uit;
  }

  /* Laatste waarde van een verhouding, en die van ongeveer 5 jaar eerder. */
  function nuEnToen(r) {
    if (!r.length) return null;
    var l = r[r.length - 1], t = r.filter(function (x) { return x.year <= l.year - 4; }).slice(-1)[0];
    return { nu: l, toen: t || null };
  }

  /* Midden van de sector: mediaan van de laatste marge vóór belasting van fondsen met dezelfde sector (minstens 5). */
  function sectorMidden(rec, alle) {
    var s = rec && rec.sector_yahoo;
    if (!s || !Array.isArray(alle)) return null;
    var w = alle.filter(function (a) { return a && a.sector_yahoo === s && a.ticker !== rec.ticker; }).map(function (a) {
      var r = reeks(((a.gegevens || {}).jaren) || [], margeVb); return r.length ? r[r.length - 1].v : null;
    }).filter(num);
    return w.length >= 5 ? { sector: s, n: w.length, marge: mediaan(w) } : null;
  }

  function aandelenVerloop(jr) {
    var v = jaren(jr).filter(function (j) { return pos(j.shares_diluted); });
    if (v.length < 2) return null;
    var f = v[0], l = v[v.length - 1];
    return l.year - f.year >= 3 ? { van: f.year, tot: l.year, pct: (l.shares_diluted / f.shares_diluted - 1) * 100, perJaar: cagr(f.shares_diluted, l.shares_diluted, l.year - f.year) } : null;
  }

  function gegevens(rec, alle) {
    rec = rec || {};
    var g = rec.gegevens || {}, jr = jaren(g.jaren), JV = 'jaarcijfers', uit = {};
    var verw = rec.verwachting || {}, gr = verw.groei || {}, Yv = 'Yahoo Finance (analisten)' + (verw.datum ? ', ' + verw.datum : '');
    var man = rec.management || {}, gov = man.governance || {}, Yg = 'Yahoo Finance (ISS)' + (gov.datum ? ', ' + gov.datum : '');
    function regel(p, label, waarde, bron) { if (waarde) (uit[p] = uit[p] || []).push({ label: label, waarde: waarde, bron: bron }); }

    // 1. Groeiruimte
    var og = omzetGroei(jr);
    if (og.lang && num(og.lang.pct)) regel(1, 'Omzetgroei per jaar', pctTeken(og.lang.pct) + ' (' + og.lang.van + '–' + og.lang.tot + ')' + (og.kort && num(og.kort.pct) ? ', laatste 3 jaar ' + pctTeken(og.kort.pct) : ''), JV);
    var om = gr.omzet || {};
    if (num(om.dit_jaar) || num(om.volgend_jaar)) regel(1, 'Verwachte omzetgroei', [num(om.dit_jaar) ? 'dit boekjaar ' + pctTeken(om.dit_jaar) : '', num(om.volgend_jaar) ? 'volgend boekjaar ' + pctTeken(om.volgend_jaar) : ''].filter(Boolean).join(', '), Yv);

    // 3. Onderzoek en ontwikkeling
    var rd = nuEnToen(reeks(jr, function (j) { return deel(j.rd_expense, j.sales); }));
    if (rd) regel(3, 'Onderzoek en ontwikkeling', pct(rd.nu.v) + ' van de omzet in ' + rd.nu.year + (rd.toen ? ' (' + pct(rd.toen.v) + ' in ' + rd.toen.year + ')' : ''), JV);

    // 4. Verkooporganisatie
    var vk = nuEnToen(reeks(jr, function (j) { return deel(j.selling_expense, j.sales); }));
    var sga = vk ? null : nuEnToen(reeks(jr, function (j) { return deel(j.sga_expense, j.sales); }));
    if (vk) regel(4, 'Verkoopkosten', pct(vk.nu.v) + ' van de omzet in ' + vk.nu.year + (vk.toen ? ' (' + pct(vk.toen.v) + ' in ' + vk.toen.year + ')' : ''), JV);
    else if (sga) regel(4, 'Verkoop- en algemene kosten samen', pct(sga.nu.v) + ' van de omzet in ' + sga.nu.year + (sga.toen ? ' (' + pct(sga.toen.v) + ' in ' + sga.toen.year + ')' : ''), JV);

    // 5. Winstmarge
    var mv = reeks(jr, margeVb), mn = reeks(jr, margeNetto), sm = sectorMidden(rec, alle);
    if (mv.length) regel(5, 'Marge vóór belasting', pct(mv[mv.length - 1].v) + ' in ' + mv[mv.length - 1].year + (sm ? ' (midden van de sector ' + sm.sector + ': ' + pct(sm.marge) + ', ' + sm.n + ' fondsen)' : ''), JV);
    if (mn.length) regel(5, 'Nettomarge', pct(mn[mn.length - 1].v) + ' in ' + mn[mn.length - 1].year, JV);

    // 6. Marge behouden of verbeteren
    if (mv.length >= 5) {
      var helft = Math.floor(mv.length / 2), oud = mv.slice(0, helft), nieuw = mv.slice(-helft);
      var gem = function (a) { return a.reduce(function (s, x) { return s + x.v; }, 0) / a.length; };
      regel(6, 'Marge vóór belasting gemiddeld', pct(gem(oud)) + ' in ' + oud[0].year + '–' + oud[oud.length - 1].year + ', ' + pct(gem(nieuw)) + ' in ' + nieuw[0].year + '–' + nieuw[nieuw.length - 1].year, JV);
    }

    // 10. Boekhouding en controle
    var arch = g.archief || {}, herw = (arch.meldingen || []).filter(function (m) { return m && m.soort === 'herwerking'; }).length;
    if (arch.verslagen) regel(10, 'Oude cijfers achteraf herzien', herw ? herw + ' keer gevonden in ' + arch.verslagen + ' jaarverslagen' : 'niet gevonden in ' + arch.verslagen + ' jaarverslagen', 'jaarverslagarchief van de app');
    if (num(gov.audit)) regel(10, 'Risicoscore controle jaarrekening', gov.audit + ' (1 = laag risico, 10 = hoog)', Yg);

    // 11. Voorsprong
    var roe = reeks(jr, function (j) { return pos(j.equity) ? deel(j.net_income, j.equity) : null; });
    if (roe.length >= 4) regel(11, 'Rendement op eigen vermogen', 'gemiddeld ' + pct(roe.reduce(function (s, x) { return s + x.v; }, 0) / roe.length) + ' over ' + roe[0].year + '–' + roe[roe.length - 1].year + ', laatste jaar ' + pct(roe[roe.length - 1].v), JV);
    if (mv.length >= 5) regel(11, 'Marge vóór belasting, laagste en hoogste jaar', pct(Math.min.apply(null, mv.map(function (x) { return x.v; }))) + ' en ' + pct(Math.max.apply(null, mv.map(function (x) { return x.v; }))), JV);

    // 12. Winstvooruitzicht
    var wg = gr.winst || {};
    if (num(wg.dit_jaar) || num(wg.volgend_jaar) || num(wg.vijf_jaar)) regel(12, 'Verwachte winstgroei per aandeel', [num(wg.dit_jaar) ? 'dit boekjaar ' + pctTeken(wg.dit_jaar) : '', num(wg.volgend_jaar) ? 'volgend boekjaar ' + pctTeken(wg.volgend_jaar) : '', num(wg.vijf_jaar) ? 'per jaar over 5 jaar ' + pctTeken(wg.vijf_jaar) : ''].filter(Boolean).join(', '), Yv);
    var an = rec.analisten;
    if (an && an.advies) regel(12, 'Advies van analisten', ({ strong_buy: 'sterk kopen', buy: 'kopen', hold: 'houden', underperform: 'onder het gemiddelde', sell: 'verkopen', strong_sell: 'sterk verkopen' })[an.advies] + (an.aantal ? ' (' + an.aantal + ' analisten)' : ''), 'Yahoo Finance' + (an.datum ? ', ' + an.datum : ''));
    var bs = (verw.bijstelling || {}).dit_jaar;
    if (bs && num(bs.d90)) regel(12, 'Verwachte winst dit jaar bijgesteld', pctTeken(bs.d90) + ' in 90 dagen', Yv);

    // 13. Verwatering
    var av = aandelenVerloop(jr);
    if (av) regel(13, 'Aantal aandelen', pctTeken(av.pct) + ' van ' + av.van + ' tot ' + av.tot + ' (' + pctTeken(av.perJaar) + ' per jaar)', JV);
    var sch = reeks(jr, function (j) { return num(j.long_term_debt) && j.long_term_debt >= 0 && pos(j.equity) ? j.long_term_debt / (j.long_term_debt + j.equity) * 100 : null; });
    if (sch.length) regel(13, 'Langlopende schuld', pct(sch[sch.length - 1].v) + ' van schuld plus eigen vermogen in ' + sch[sch.length - 1].year, JV);

    // 15. Integriteit
    var gs = [['bestuur', 'bestuur'], ['beloning', 'beloning'], ['aandeelhoudersrechten', 'rechten aandeelhouders'], ['totaal', 'totaal']]
      .filter(function (x) { return num(gov[x[0]]); }).map(function (x) { return x[1] + ' ' + gov[x[0]]; });
    if (gs.length) regel(15, 'Risicoscores bestuur (1 = laag, 10 = hoog)', gs.join(', '), Yg);
    return uit;
  }

  var api = { gegevens: gegevens, sectorMidden: sectorMidden, omzetGroei: omzetGroei };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Fisher = api;
})(typeof self !== 'undefined' ? self : this);
