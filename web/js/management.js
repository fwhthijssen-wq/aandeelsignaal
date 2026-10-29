/* Management: feiten. Zet de feiten uit de nachtelijke update (Yahoo) en uit de eigen jaarcijfers op een rij. Geen oordeel,
   geen score: het blok verandert het NAIC-oordeel, de gezondheidscheck en uw eigen beoordeling niet.
   Elke regel: { id, label, waarde (tekst), bron }; ontbreekt een feit, dan waarde null ("onbekend"). */
(function (root) {
  'use strict';
  function num(x) { return typeof x === 'number' && isFinite(x); }
  function pos(x) { return num(x) && x > 0; }
  function nl(x, d) { return x.toLocaleString('nl-NL', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function pct(x, d) { return (x > 0 ? '+' : x < 0 ? '−' : '') + nl(Math.abs(x), d == null ? 1 : d) + '%'; }
  function aantal(n, een, meer, personen) {
    return n + ' ' + (n === 1 ? een : meer) + (n > 0 && num(personen) && personen > 0 ? ' (' + personen + (personen === 1 ? ' persoon' : ' personen') + ')' : '');
  }
  function jaren(jr) { return (jr || []).filter(function (j) { return j && num(j.year); }).slice().sort(function (a, b) { return a.year - b.year; }); }

  /* Verandering van het aantal aandelen (verwaterd, gecorrigeerd voor splitsingen) over ongeveer 5 jaar.
     Minder aandelen = inkoop van eigen aandelen; meer = uitgifte (verwatering). Minstens 4 jaar tussen begin en eind. */
  function aandelenVerloop(jr) {
    var v = jaren(jr).filter(function (j) { return pos(j.shares_diluted); });
    if (v.length < 2) return null;
    var eind = v[v.length - 1], doel = eind.year - 5;
    var begin = v.filter(function (j) { return j.year >= doel && j.year <= eind.year - 4; })[0];
    if (!begin) return null;
    return { van: begin.year, tot: eind.year, pct: Math.round((eind.shares_diluted / begin.shares_diluted - 1) * 1000) / 10 };
  }

  /* Rendement op eigen vermogen: eerste en laatste van de laatste 5 jaar met een waarde (minstens 4). */
  function roeVerloop(jr) {
    var v = jaren(jr).filter(function (j) { return num(j.net_income) && pos(j.equity); }).slice(-5);
    if (v.length < 4) return null;
    var r = function (j) { return Math.round(j.net_income / j.equity * 1000) / 10; };
    return { van: v[0].year, tot: v[v.length - 1].year, begin: r(v[0]), eind: r(v[v.length - 1]) };
  }

  function feiten(rec, jr) {
    var m = (rec && rec.management) || {}, Y = 'Yahoo Finance' + (m.datum ? ', ' + m.datum : ''), uit = [];
    uit.push({ id: 'ceo', label: 'Topman of -vrouw (CEO)', bron: Y,
      waarde: m.ceo ? m.ceo.naam + (m.ceo.geboren ? ' (geboren ' + m.ceo.geboren + ')' : '') : null });
    var ib = m.bezit_insiders_pct;
    uit.push({ id: 'bezit', label: 'Aandelen in handen van bestuur en insiders', bron: Y,
      waarde: num(ib) ? nl(ib, ib < 1 ? 2 : 1) + '%' : null });
    var ins = m.insiders;
    uit.push({ id: 'insiders', label: 'Aan- en verkopen door insiders, 12 maanden', bron: ins ? ins.bron + ', ' + ins.van + ' t/m ' + ins.tot : 'Yahoo Finance (insidertransacties)',
      waarde: ins ? aantal(ins.aankopen, 'aankoop', 'aankopen', ins.personen_gekocht) + ', ' + aantal(ins.verkopen, 'verkoop', 'verkopen', ins.personen_verkocht) : null,
      richting: ins ? (ins.aankopen > ins.verkopen ? 'aan' : ins.verkopen > ins.aankopen ? 'ver' : null) : null,
      toelichting: ins && /\.L$/.test((rec && rec.ticker) || '') ? 'Bij Britse fondsen tellen ook de kleine maandelijkse aankopen via personeelsregelingen mee; het aantal personen zegt dan meer.' : null });
    var a = aandelenVerloop(jr);
    uit.push({ id: 'aandelen', label: 'Aantal aandelen' + (a ? ' ' + a.van + '–' + a.tot : ', 5 jaar'), bron: 'Jaarcijfers (verwaterd, na splitsingen)',
      waarde: a ? pct(a.pct) + (a.pct <= -1 ? ' (inkoop eigen aandelen)' : a.pct >= 1 ? ' (nieuwe aandelen uitgegeven)' : ' (vrijwel gelijk)') : null });
    var r = roeVerloop(jr);
    uit.push({ id: 'roe', label: 'Rendement op eigen vermogen' + (r ? ' ' + r.van + '–' + r.tot : ', 5 jaar'), bron: 'Jaarcijfers',
      waarde: r ? nl(r.begin, 1) + '% → ' + nl(r.eind, 1) + '%' + (Math.abs(r.begin) > 60 || Math.abs(r.eind) > 60 ? ' (weinig zeggend: het eigen vermogen is erg klein, bijv. door inkoop van eigen aandelen)' : '') : null });
    var g = m.governance;
    uit.push({ id: 'governance', label: 'Governance-risico (1 laag, 10 hoog)', bron: 'ISS via Yahoo Finance' + (g && g.datum ? ', ' + g.datum : ''),
      waarde: g && num(g.totaal) ? g.totaal + ' / 10' + (['audit', 'bestuur', 'beloning', 'aandeelhoudersrechten'].some(function (k) { return num(g[k]); }) ?
        ' (audit ' + (num(g.audit) ? g.audit : '–') + ', bestuur ' + (num(g.bestuur) ? g.bestuur : '–') + ', beloning ' + (num(g.beloning) ? g.beloning : '–') +
        ', rechten aandeelhouders ' + (num(g.aandeelhoudersrechten) ? g.aandeelhoudersrechten : '–') + ')' : '') : null });
    return { regels: uit, bestuurders: (m.bestuurders || []).filter(function (b) { return b && b.naam && b.functie; }),
      bekend: uit.filter(function (x) { return x.waarde !== null; }).length };
  }

  var api = { feiten: feiten, aandelenVerloop: aandelenVerloop, roeVerloop: roeVerloop };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Management = api;
})(typeof self !== 'undefined' ? self : this);
