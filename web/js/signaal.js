/* Totaalbeeld per aandeel uit meerdere analysemethoden: technisch, fundamenteel, kwantitatief (factoren) en kwalitatief (uw eigen
   kwaliteitscheck). Elke methode geeft een score van -1 (ongunstig) tot +1 (gunstig), of niets als de gegevens ontbreken: er wordt
   nooit iets geschat of aangevuld.

   Oordeel (positief / neutraal / vermijden) is altijd VOORLOPIG en komt met een dekking: welk deel van het mogelijke gewicht
   daadwerkelijk is ingevuld, en uit welke kwaliteit die gegevens komen. Gecontroleerde gegevens wegen zwaarder dan ongecontroleerde.
   Onder de minimale dekking is er geen oordeel. Geen koersdoel, geen advies: een selectiehulp. */
(function (root) {
  'use strict';

  /* Kwaliteit van de bron en hoe zwaar een score daardoor meetelt. */
  var KWALITEIT = {
    gecontroleerd: { naam: 'gecontroleerd', factor: 1 },   // jaarcijfers met onafhankelijk nagerekende winst per aandeel
    koers: { naam: 'koersdata', factor: 0.9 },             // dagkoersen van één bron
    jaarverslag: { naam: 'uit jaarverslag', factor: 0.7 },   // officieel jaarverslag, winst per aandeel niet nagerekend
    eigen: { naam: 'eigen invoer', factor: 0.6 }           // uw eigen antwoorden
  };
  var GROEPEN = { technisch: 'Technische analyse', fundamenteel: 'Fundamentele analyse', kwantitatief: 'Kwantitatief (factoren)', kwalitatief: 'Kwalitatief (uw check)' };
  var MIN_DEKKING = 20;                         // procent; instelbaar door de gebruiker
  var DREMPEL = 0.25;                           // score vanaf waar het oordeel positief of vermijden wordt
  var MAX_KOERS_DAGEN = 7;

  function pos(x) { return typeof x === 'number' && isFinite(x) && x > 0; }
  function num(x) { return typeof x === 'number' && isFinite(x); }
  function rond(x, d) { var f = Math.pow(10, d); return Math.round(x * f) / f; }
  function groei(a, b, n) { return pos(a) && pos(b) && n > 0 ? (Math.pow(b / a, 1 / n) - 1) * 100 : null; }
  /* Trap: waarden oplopend van drempel naar score. trap(x,[[8,1],[3,.5],[0,0]], -1) = >=8 -> 1, >=3 -> .5, >=0 -> 0, anders -1 */
  function trap(x, stappen, anders) { for (var i = 0; i < stappen.length; i++) if (x >= stappen[i][0]) return stappen[i][1]; return anders; }
  /* Omgekeerd: lager is beter. */
  function laag(x, stappen, anders) { for (var i = 0; i < stappen.length; i++) if (x < stappen[i][0]) return stappen[i][1]; return anders; }

  function pct(x, d) { return (x >= 0 ? '' : '−') + String(Math.abs(rond(x, d == null ? 1 : d))).replace('.', ',') + '%'; }
  function g1(x) { return String(rond(x, 1)).replace('.', ','); }

  function jarenVan(g) { return (g && Array.isArray(g.jaren) ? g.jaren : []).filter(function (j) { return j && num(j.year); }).slice().sort(function (a, b) { return a.year - b.year; }); }

  /* Scoremodellen. Elk gebruikt alleen wat het bedrijf zelf meldt; ontbreekt te veel, dan is het resultaat null. */
  function aandelen(l) {
    if (l && pos(l.shares_diluted)) return l.shares_diluted;
    // Afgeleid uit gecontroleerde winst en EPS: alleen als dat jaar onderbouwd is (de herberekening gebruikt dezelfde getallen).
    return l && l.eps_check === 'onderbouwd' && pos(l.net_income) && pos(l.reported_eps) ? l.net_income / l.reported_eps : null;
  }
  function piotroski(jr) {
    var l = jr[jr.length - 1], v = jr[jr.length - 2];
    if (!l || !v || l.year - v.year !== 1) return null;
    var lijst = [], niet = [], roa = function (j) { return pos(j.total_assets) && num(j.net_income) ? j.net_income / j.total_assets : null; };
    function toets(naam, a, b, ok) { if (a != null && b != null) lijst.push({ naam: naam, ok: ok(a, b) ? 1 : 0 }); else niet.push(naam); }
    toets('Winst is positief', roa(l), 0, function (x) { return x > 0; });
    toets('Operationele kasstroom is positief', num(l.operating_cash_flow) ? l.operating_cash_flow : null, 0, function (x) { return x > 0; });
    toets('Rendement op bezittingen steeg', roa(l), roa(v), function (x, y) { return x > y; });
    toets('Kasstroom hoger dan winst (kwaliteit van de winst)', num(l.operating_cash_flow) && num(l.net_income) ? l.operating_cash_flow : null, num(l.net_income) ? l.net_income : null, function (x, y) { return x > y; });
    var lev = function (j) { return pos(j.total_assets) && num(j.long_term_debt) ? j.long_term_debt / j.total_assets : null; };
    toets('Langlopende schuld daalde (ten opzichte van bezittingen)', lev(l), lev(v), function (x, y) { return x < y || (x === 0 && y === 0); });
    var cr = function (j) { return pos(j.current_liabilities) && pos(j.current_assets) ? j.current_assets / j.current_liabilities : null; };
    toets('Liquiditeit (vlottende activa / kortlopende schuld) steeg', cr(l), cr(v), function (x, y) { return x > y; });
    toets('Geen nieuwe aandelen uitgegeven', pos(l.shares_diluted) ? l.shares_diluted : null, pos(v.shares_diluted) ? v.shares_diluted : null, function (x, y) { return x <= y * 1.005; });
    var gm = function (j) { return pos(j.sales) && num(j.gross_profit) ? j.gross_profit / j.sales : null; };
    toets('Brutomarge steeg', gm(l), gm(v), function (x, y) { return x > y; });
    var om = function (j) { return pos(j.sales) && pos(j.total_assets) ? j.sales / j.total_assets : null; };
    toets('Omzet per euro bezittingen steeg', om(l), om(v), function (x, y) { return x > y; });
    if (lijst.length < 6) return null;                        // te weinig toetsbare punten: geen score
    return { score: lijst.reduce(function (a, b) { return a + b.ok; }, 0), getoetst: lijst.length, lijst: lijst, niet: niet, jaar: l.year, vorig: v.year };
  }
  function altman(c) {
    var l = c.laatste, a = l && l.total_assets, n = aandelen(l);
    if (c.bank || !l || !pos(a) || !num(l.current_assets) || !num(l.current_liabilities) || !num(l.retained_earnings) || !num(l.operating_income) || !pos(l.total_liabilities) || !pos(l.sales)) return null;
    if (!c.koersOk || !c.eenValuta || !pos(n)) return null;
    var mve = c.k.slot * n;
    return 1.2 * (l.current_assets - l.current_liabilities) / a + 1.4 * l.retained_earnings / a + 3.3 * l.operating_income / a + 0.6 * mve / l.total_liabilities + 1.0 * l.sales / a;
  }
  function magic(c) {
    var l = c.laatste, n = aandelen(l);
    if (c.bank || !l || !num(l.operating_income) || !pos(l.total_assets) || !num(l.current_liabilities) || !num(l.cash) || !num(l.long_term_debt)) return null;
    if (!c.koersOk || !c.eenValuta || !pos(n)) return null;
    var ev = c.k.slot * n + l.long_term_debt - l.cash, kapitaal = l.total_assets - l.current_liabilities - l.cash;
    if (!(ev > 0) || !(kapitaal > 0)) return null;
    return { ey: l.operating_income / ev * 100, roc: l.operating_income / kapitaal * 100 };
  }

  /* Methoden: elke functie krijgt context c en geeft null (ontbreekt) of { score, tekst }. */
  var METHODEN = [
    { id: 'trend50', groep: 'technisch', naam: 'Koers boven gemiddelde van 50 dagen', gewicht: 4, bron: 'koers',
      f: function (c) { if (!c.koersOk || !pos(c.k.sma50)) return null; var a = (c.k.slot / c.k.sma50 - 1) * 100;
        return { score: a >= 0 ? 0.5 : -0.5, tekst: 'Koers ' + pct(a) + ' ten opzichte van het gemiddelde van 50 dagen.' }; } },
    { id: 'trend200', groep: 'technisch', naam: 'Langetermijntrend (200 dagen)', gewicht: 6, bron: 'koers',
      f: function (c) { if (!c.koersOk || !pos(c.k.sma200)) return null; var a = (c.k.slot / c.k.sma200 - 1) * 100;
        var kruis = pos(c.k.sma50) ? (c.k.sma50 > c.k.sma200 ? ' Het gemiddelde van 50 dagen ligt boven dat van 200 dagen.' : ' Het gemiddelde van 50 dagen ligt onder dat van 200 dagen.') : '';
        return { score: a >= 0 ? 1 : -1, tekst: 'Koers ' + pct(a) + ' ten opzichte van het gemiddelde van 200 dagen.' + kruis }; } },
    { id: 'rsi', groep: 'technisch', naam: 'Momentum (RSI 14 dagen)', gewicht: 3, bron: 'koers',
      f: function (c) { if (!c.koersOk || !num(c.k.rsi14)) return null; var r = c.k.rsi14;
        return { score: r < 30 ? 0.5 : r > 70 ? -0.5 : 0, tekst: 'RSI ' + g1(r) + (r < 30 ? ': sterk teruggevallen (laag).' : r > 70 ? ': sterk opgelopen (hoog).' : ': neutraal gebied.') }; } },
    { id: 'bereik', groep: 'technisch', naam: 'Plek in koersbereik van 10 jaar (NAIC)', gewicht: 7, bron: 'koers',
      f: function (c) { var b = c.bereik; if (!b) return null;
        return { score: b.label === 'positief' ? 1 : b.label === 'vermijden' ? -1 : 0, tekst: 'Koers in de ' + (b.derde === 'onder' ? 'onderste' : b.derde === 'boven' ? 'bovenste' : 'middelste') + ' derde van het bereik (' + b.positiePct + '%)' + (b.verhouding != null ? ', opwaarts tegen neerwaarts ' + g1(b.verhouding) + ' : 1.' : '.') }; } },

    { id: 'omzetgroei', groep: 'fundamenteel', naam: 'Omzetgroei per jaar', gewicht: 6, bron: 'jaar',
      invoer: { label: 'Omzetgroei per jaar (%)', stap: 0.1, waar: 'Jaarverslag of beleggersrelaties: omzet van het eerste en laatste jaar.' },
      waarde: function (c) { return c.groeiOmzet; },
      uit: function (x, c) { return { score: trap(x, [[8, 1], [3, 0.5], [0, 0]], -1), tekst: pct(x) + ' per jaar' + (c && c.van ? ' (' + c.van + '–' + c.tot + ').' : '.') }; } },
    { id: 'epsgroei', groep: 'fundamenteel', naam: 'Groei winst per aandeel per jaar', gewicht: 8, bron: 'jaar',
      invoer: { label: 'Groei winst per aandeel per jaar (%)', stap: 0.1, waar: 'Jaarverslag: winst per aandeel (EPS) van het eerste en laatste jaar, gecorrigeerd voor splitsingen.' },
      waarde: function (c) { return c.groeiEps; },
      uit: function (x, c) { return { score: trap(x, [[10, 1], [4, 0.5], [0, 0]], -1), tekst: pct(x) + ' per jaar' + (c && c.van ? ' (' + c.van + '–' + c.tot + ').' : '.') }; } },
    { id: 'epsstabiel', groep: 'fundamenteel', naam: 'Regelmaat van de winstgroei', gewicht: 5, bron: 'jaar',
      f: function (c) { var v = c.jr.filter(function (j) { return num(j.comparable_eps); }); if (v.length < 4) return null; var op = 0;
        for (var i = 1; i < v.length; i++) if (v[i].comparable_eps > v[i - 1].comparable_eps) op++;
        var f = op / (v.length - 1); return { score: trap(f, [[0.8, 1], [0.6, 0.5], [0.4, 0]], -1), tekst: 'De winst per aandeel steeg in ' + op + ' van ' + (v.length - 1) + ' jaren.' }; } },
    { id: 'nettomarge', groep: 'fundamenteel', naam: 'Nettomarge', gewicht: 5, bron: 'jaar',
      invoer: { label: 'Nettomarge (% van de omzet)', stap: 0.1, waar: 'Jaarverslag: nettowinst gedeeld door omzet.' },
      waarde: function (c) { var l = c.laatste; return l && pos(l.sales) && num(l.net_income) ? l.net_income / l.sales * 100 : null; },
      uit: function (m, c) { return { score: m < 0 ? -1 : trap(m, [[15, 1], [8, 0.5], [3, 0]], -0.5), tekst: 'Nettowinst ' + pct(m) + ' van de omzet' + (c && c.laatste ? ' in ' + c.laatste.year : '') + '.' }; } },
    { id: 'roe', groep: 'fundamenteel', naam: 'Rendement op eigen vermogen (ROE)', gewicht: 6, bron: 'jaar',
      invoer: { label: 'Rendement op eigen vermogen (%)', stap: 0.1, waar: 'Jaarverslag: nettowinst gedeeld door eigen vermogen.' },
      waarde: function (c) { var l = c.laatste; return c.bank || !l || !pos(l.equity) || !num(l.net_income) ? null : l.net_income / l.equity * 100; },
      uit: function (r, c) { return { score: r < 0 ? -1 : trap(r, [[15, 1], [10, 0.5], [5, 0]], -0.5), tekst: 'Nettowinst is ' + pct(r) + ' van het eigen vermogen' + (c && c.laatste ? ' in ' + c.laatste.year : '') + '.' }; } },
    { id: 'fcf', groep: 'fundamenteel', naam: 'Vrije kasstroom (marge)', gewicht: 5, bron: 'jaar',
      f: function (c) { var l = c.laatste; if (c.bank || !l || !pos(l.sales) || !num(l.operating_cash_flow) || !num(l.capex)) return null;
        var m = (l.operating_cash_flow - Math.abs(l.capex)) / l.sales * 100; return { score: m < 0 ? -1 : trap(m, [[8, 1], [3, 0.5]], 0), tekst: 'Kasstroom min investeringen is ' + pct(m) + ' van de omzet in ' + l.year + '.' }; } },
    { id: 'schuld', groep: 'fundamenteel', naam: 'Schuld ten opzichte van vrije kasstroom', gewicht: 4, bron: 'jaar',
      f: function (c) { var l = c.laatste; if (c.bank || !l || !num(l.long_term_debt) || !num(l.operating_cash_flow) || !num(l.capex)) return null;
        var fcf = l.operating_cash_flow - Math.abs(l.capex);
        if (l.long_term_debt <= 0) return { score: 1, tekst: 'Geen langlopende schuld gemeld.' };
        if (fcf <= 0) return { score: -1, tekst: 'Er is schuld en de vrije kasstroom is niet positief.' };
        var x = l.long_term_debt / fcf; return { score: laag(x, [[2, 1], [4, 0.5], [7, 0]], -1), tekst: 'Langlopende schuld is ' + g1(x) + ' keer de vrije kasstroom van ' + l.year + '.' }; } },
    { id: 'kw', groep: 'fundamenteel', naam: 'Koers/winst (K/W)', gewicht: 8, bron: 'jaar',
      invoer: { label: 'Koers/winst (K/W)', stap: 0.1, waar: 'Koers gedeeld door winst per aandeel van het laatste jaar.' },
      f: function (c) { var l = c.laatste; if (!c.koersOk || !c.eenValuta || !l || !num(l.comparable_eps)) return null;
        if (l.comparable_eps <= 0) return { score: -1, tekst: 'De winst per aandeel is niet positief.' };
        var x = c.k.slot / l.comparable_eps; return { score: laag(x, [[12, 1], [18, 0.5], [25, 0], [40, -0.5]], -1), tekst: 'K/W ' + g1(x) + ' op de winst van ' + l.year + '.' }; },
      uit: function (x) { return x <= 0 ? { score: -1, tekst: 'K/W niet positief.' } : { score: laag(x, [[12, 1], [18, 0.5], [25, 0], [40, -0.5]], -1), tekst: 'K/W ' + g1(x) + '.' }; } },
    { id: 'piotroski', groep: 'fundamenteel', naam: 'Financiële kracht (Piotroski F-score)', gewicht: 8, bron: 'jaar',
      f: function (c) { var r = piotroski(c.jr); if (!r) return null;
        var q = r.score / r.getoetst; return { score: trap(q, [[0.78, 1], [0.56, 0.5], [0.33, 0]], -1), tekst: 'F-score ' + r.score + ' van ' + r.getoetst + ' toetsbare punten (hoger is sterker).' }; } },
    { id: 'altman', groep: 'fundamenteel', naam: 'Faillissementsrisico (Altman Z-score)', gewicht: 5, bron: 'jaar',
      f: function (c) { var z = altman(c); if (z == null) return null;
        return { score: z >= 2.99 ? 1 : z >= 1.81 ? 0 : -1, tekst: 'Z-score ' + g1(z) + (z >= 2.99 ? ': veilig gebied.' : z >= 1.81 ? ': grijs gebied.' : ': risicogebied.') + ' Bedoeld voor industriële bedrijven.' }; } },
    { id: 'magic', groep: 'fundamenteel', naam: 'Goedkoop en rendabel (Magic Formula)', gewicht: 6, bron: 'jaar',
      f: function (c) { var m = magic(c); if (!m) return null;
        var a = trap(m.ey, [[10, 1], [6, 0.5], [3, 0]], -0.5), b = trap(m.roc, [[20, 1], [12, 0.5], [6, 0]], -0.5);
        return { score: (a + b) / 2, tekst: 'Winst/bedrijfswaarde ' + pct(m.ey) + ' en rendement op kapitaal ' + pct(m.roc) + '.' }; } },
    { id: 'dividend', groep: 'fundamenteel', naam: 'Dividendrendement', gewicht: 3, bron: 'jaar',
      invoer: { label: 'Dividendrendement (%)', stap: 0.1, waar: 'Dividend per aandeel gedeeld door de koers.' },
      waarde: function (c) { var l = c.laatste; return !c.koersOk || !c.eenValuta || !l || !num(l.dividend_ps) ? null : l.dividend_ps / c.k.slot * 100; },
      uit: function (r, c) { return { score: r <= 0 ? 0 : trap(r, [[3, 1], [1.5, 0.5]], 0.2), tekst: 'Dividend ' + pct(r) + ' van de koers' + (c && c.laatste ? ' (over ' + c.laatste.year + ')' : '') + '.' }; } },

    { id: 'momentum', groep: 'kwantitatief', naam: 'Koersmomentum (circa 6 maanden)', gewicht: 6, bron: 'koers',
      f: function (c) { var r = c.reeks; if (!c.koersOk || r.length < 100) return null; var x = (r[r.length - 1] / r[0] - 1) * 100;
        return { score: trap(x, [[10, 1], [0, 0.5], [-10, -0.5]], -1), tekst: 'Koers ' + pct(x) + ' over de laatste ' + r.length + ' handelsdagen.' }; } },
    { id: 'volatiliteit', groep: 'kwantitatief', naam: 'Koersschommelingen (volatiliteit)', gewicht: 4, bron: 'koers',
      f: function (c) { var r = c.reeks; if (!c.koersOk || r.length < 100) return null; var d = [];
        for (var i = 1; i < r.length; i++) d.push(Math.log(r[i] / r[i - 1]));
        var m = d.reduce(function (a, b) { return a + b; }, 0) / d.length, v = d.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (d.length - 1), s = Math.sqrt(v) * Math.sqrt(252) * 100;
        return { score: laag(s, [[20, 1], [30, 0.5], [45, 0]], -1), tekst: 'Schommelt ' + pct(s, 0) + ' per jaar (hoe lager, hoe rustiger).' }; } },

    { id: 'fisher', groep: 'kwalitatief', naam: 'Uw kwaliteitscheck (15 punten van Fisher)', gewicht: 15, bron: 'eigen',
      f: function (c) { var v = c.check; if (!v || !(v.ja + v.nee > 0)) return null; var s = (v.ja - v.nee) / (v.ja + v.nee);
        return { score: s, deel: Math.min(1, (v.ja + v.nee) / v.totaal), tekst: v.ja + ' ja, ' + v.nee + ' nee' + (v.onzeker ? ', ' + v.onzeker + ' onzeker' : '') + ' van de ' + v.totaal + ' punten.' }; } },
    { id: 'management', groep: 'kwalitatief', naam: 'Management (uw beoordeling)', gewicht: 6, bron: 'eigen', beoordeling: { label: 'Kwaliteit van het management', waar: 'Jaarverslag, beleggerspresentaties, hoe lang de top er zit, open communicatie, integriteit.' }, f: function (c) { return beoordelingScore(c, 'management'); } },
    { id: 'moat', groep: 'kwalitatief', naam: 'Concurrentiepositie (uw beoordeling)', gewicht: 6, bron: 'eigen', beoordeling: { label: 'Concurrentiepositie en verdienmodel', waar: 'Merken, octrooien, schaalvoordeel, vaste klanten: is het moeilijk voor anderen om dit na te doen?' }, f: function (c) { return beoordelingScore(c, 'moat'); } },
    { id: 'sector', groep: 'kwalitatief', naam: 'Sectoruitzicht (uw beoordeling)', gewicht: 4, bron: 'eigen', beoordeling: { label: 'Uitzicht van de sector', waar: 'Groeit de markt, verandert de technologie, hoe is de regelgeving?' }, f: function (c) { return beoordelingScore(c, 'sector'); } },
    { id: 'risico', groep: 'kwalitatief', naam: 'Risico’s en ESG (uw beoordeling)', gewicht: 4, bron: 'eigen', beoordeling: { label: 'Risico’s (hoe gunstig: 5 = weinig risico)', waar: 'Rechtszaken, afhankelijkheid van één klant of land, milieu en sociale risico’s.' }, f: function (c) { return beoordelingScore(c, 'risico'); } }
  ];

  /* Uitleg per methode voor het uitklapvenster: wat het meet, hoe het scoort en welke cijfers erachter zitten. */
  function mld(x) { if (!num(x)) return '–'; var a = Math.abs(x), t = a >= 1e9 ? g1(a / 1e9) + ' mld' : a >= 1e6 ? g1(a / 1e6) + ' mln' : String(Math.round(a)); return (x < 0 ? '−' : '') + t; }
  var INFO = {
    trend50: ['Vergelijkt de koers met het gemiddelde van de laatste 50 handelsdagen. Een koers boven dat gemiddelde wijst op een stijgende korte trend.', 'Boven het gemiddelde: licht gunstig. Eronder: licht ongunstig.', 'Een verse koers en het 50-daags gemiddelde.'],
    trend200: ['Vergelijkt de koers met het gemiddelde van 200 handelsdagen: de trend op lange termijn.', 'Boven het gemiddelde: gunstig. Eronder: ongunstig.', 'Een verse koers en het 200-daags gemiddelde.'],
    rsi: ['De RSI meet hoe snel de koers de laatste 14 dagen is gestegen of gedaald (0 tot 100). Een zeer lage waarde kan duiden op overdreven verkoop, een zeer hoge op overdreven koop.', 'Onder 30: licht gunstig. Boven 70: licht ongunstig. Ertussen: neutraal.', 'Een verse koers met RSI.'],
    bereik: ['Waar de koers nu staat tussen de laagste en hoogste koersen van de afgelopen jaren, volgens de NAIC-methode. Onderin het bereik is er meer opwaarts dan neerwaarts potentieel.', 'Onderste derde: gunstig. Bovenste derde: ongunstig. Midden: neutraal.', 'Koershistorie van jaren en een verse koers.'],
    omzetgroei: ['Hoe snel de omzet gemiddeld per jaar groeide over de beschikbare jaren (samengestelde groei).', 'Vanaf 8% per jaar: gunstig. 3 tot 8%: licht gunstig. 0 tot 3%: neutraal. Krimp: ongunstig.', 'Minstens 4 jaar omzet.'],
    epsgroei: ['Hoe snel de winst per aandeel gemiddeld per jaar groeide, gecorrigeerd voor aandelensplitsingen. Dit is het hart van de NAIC-methode.', 'Vanaf 10% per jaar: gunstig. 4 tot 10%: licht gunstig. 0 tot 4%: neutraal. Daling: ongunstig.', 'Minstens 4 jaar winst per aandeel.'],
    epsstabiel: ['In hoeveel jaren de winst per aandeel hoger was dan het jaar ervoor. Regelmatige groei is betrouwbaarder dan één uitschieter.', 'In minstens 80% van de jaren gestegen: gunstig. 60 tot 80%: licht gunstig. 40 tot 60%: neutraal. Minder: ongunstig.', 'Minstens 4 jaar winst per aandeel.'],
    nettomarge: ['Welk deel van de omzet als nettowinst overblijft. Een hoge marge wijst op prijskracht of lage kosten.', 'Vanaf 15%: gunstig. 8 tot 15%: licht gunstig. 3 tot 8%: neutraal. 0 tot 3%: licht ongunstig. Verlies: ongunstig.', 'Omzet en nettowinst van het laatste jaar.'],
    roe: ['Hoeveel winst het bedrijf maakt op het geld van de aandeelhouders (eigen vermogen). Niet gebruikt voor banken.', 'Vanaf 15%: gunstig. 10 tot 15%: licht gunstig. 5 tot 10%: neutraal. 0 tot 5%: licht ongunstig. Verlies: ongunstig.', 'Nettowinst en eigen vermogen van het laatste jaar.'],
    fcf: ['Vrije kasstroom is wat overblijft na investeringen: kasstroom uit bedrijfsactiviteiten min investeringen in vaste activa, als percentage van de omzet. Niet gebruikt voor banken.', 'Vanaf 8% van de omzet: gunstig. 3 tot 8%: licht gunstig. 0 tot 3%: neutraal. Negatief: ongunstig.', 'Kasstroom, investeringen en omzet van het laatste jaar.'],
    schuld: ['Hoeveel jaren vrije kasstroom nodig zijn om de langlopende schuld af te lossen. Niet gebruikt voor banken.', 'Onder 2 jaar: gunstig. 2 tot 4: licht gunstig. 4 tot 7: neutraal. Daarboven of geen positieve kasstroom: ongunstig. Geen schuld: gunstig.', 'Langlopende schuld, kasstroom en investeringen.'],
    kw: ['Hoeveel u betaalt voor één euro winst: de koers gedeeld door de winst per aandeel. Lager is goedkoper, maar een laag getal kan ook een reden hebben.', 'Onder 12: gunstig. 12 tot 18: licht gunstig. 18 tot 25: neutraal. 25 tot 40: licht ongunstig. Boven 40 of geen winst: ongunstig.', 'Een verse koers in dezelfde valuta als de winst, en de winst per aandeel van het laatste jaar.'],
    piotroski: ['De Piotroski F-score toetst negen eenvoudige punten over winstgevendheid, schuld en efficiëntie, door dit jaar met het vorige te vergelijken. Elk punt dat klopt telt voor 1. Een hoge score wijst op een financieel gezond bedrijf.', 'Minstens 78% van de toetsbare punten: gunstig. 56 tot 78%: licht gunstig. 33 tot 56%: neutraal. Daaronder: ongunstig. Kunnen minder dan 6 punten getoetst worden, dan telt de methode niet mee.', 'Twee opeenvolgende jaren met winst, activa, schuld en kasstroom; minstens 6 punten moeten toetsbaar zijn.'],
    altman: ['De Altman Z-score combineert vijf kentallen tot één getal dat aangeeft hoe groot de kans op financiële problemen is. Bedoeld voor industriële bedrijven; niet gebruikt voor banken.', 'Z vanaf 2,99: veilig gebied (gunstig). 1,81 tot 2,99: grijs gebied (neutraal). Eronder: risicogebied (ongunstig).', 'Activa, schulden, ingehouden winst, bedrijfsresultaat en omzet, plus een verse koers en het aantal aandelen.'],
    magic: ['De Magic Formula van Joel Greenblatt zoekt bedrijven die tegelijk goedkoop zijn (winst ten opzichte van de bedrijfswaarde) en rendabel (rendement op het gebruikte kapitaal). Niet gebruikt voor banken.', 'Beide delen krijgen een score (winst/bedrijfswaarde: gunstig vanaf 10%; rendement op kapitaal: gunstig vanaf 20%); de score is het gemiddelde.', 'Bedrijfsresultaat, activa, schulden, kas, een verse koers en het aantal aandelen.'],
    dividend: ['Het jaarlijkse dividend als percentage van de koers.', 'Vanaf 3%: gunstig. 1,5 tot 3%: licht gunstig. Daaronder: licht neutraal. Geen dividend: neutraal.', 'Dividend per aandeel van het laatste jaar en een verse koers.'],
    momentum: ['Hoeveel de koers de afgelopen ongeveer 6 maanden is gestegen of gedaald. Wat recent steeg, stijgt vaak nog even door (momentumeffect).', 'Boven +10%: gunstig. 0 tot 10%: licht gunstig. 0 tot −10%: licht ongunstig. Lager: ongunstig.', 'Een koersreeks van minstens 100 handelsdagen.'],
    volatiliteit: ['Hoe sterk de koers schommelt (jaarlijkse standaardafwijking van de dagelijkse rendementen). Rustiger aandelen zijn voor de meeste beleggers prettiger.', 'Onder 20% per jaar: gunstig. 20 tot 30%: licht gunstig. 30 tot 45%: neutraal. Boven 45%: ongunstig.', 'Een koersreeks van minstens 100 handelsdagen.'],
    fisher: ['Uw antwoorden op de 15 vragen van Philip Fisher over de kwaliteit van een bedrijf (tabblad Verdiepen).', 'Ja telt positief, nee negatief, onzeker telt niet mee. Het gewicht groeit met het aantal beantwoorde vragen.', 'Uw antwoorden in de checklist.'],
    management: ['Uw eigen oordeel over het management.', 'Score 1 tot 5: 3 is neutraal, 5 uitstekend, 1 slecht.', 'Uw beoordeling onder Verdiepen.'],
    moat: ['Uw oordeel over de concurrentiepositie: hoe moeilijk is het voor anderen om dit bedrijf na te doen?', 'Score 1 tot 5: 3 is neutraal.', 'Uw beoordeling onder Verdiepen.'],
    sector: ['Uw oordeel over het uitzicht van de sector.', 'Score 1 tot 5: 3 is neutraal.', 'Uw beoordeling onder Verdiepen.'],
    risico: ['Uw oordeel over de risico’s (5 is weinig risico).', 'Score 1 tot 5: 3 is neutraal.', 'Uw beoordeling onder Verdiepen.']
  };
  function jaarRegel(c, veld) { return c.jr.filter(function (j) { return num(j[veld]); }); }
  var DETAIL = {
    trend50: function (c) { return c.koersOk && pos(c.k.sma50) ? ['Koers: ' + g1(c.k.slot), 'Gemiddelde 50 dagen: ' + g1(c.k.sma50)] : null; },
    trend200: function (c) { return c.koersOk && pos(c.k.sma200) ? ['Koers: ' + g1(c.k.slot), 'Gemiddelde 200 dagen: ' + g1(c.k.sma200)].concat(pos(c.k.sma50) ? ['Gemiddelde 50 dagen: ' + g1(c.k.sma50)] : []) : null; },
    rsi: function (c) { return c.koersOk && num(c.k.rsi14) ? ['RSI (14 dagen): ' + g1(c.k.rsi14), 'Onder 30 = sterk gedaald, boven 70 = sterk gestegen'] : null; },
    bereik: function (c) { var b = c.bereik; return b ? ['Plek in het bereik: ' + b.positiePct + '%', b.verhouding != null ? 'Opwaarts tegen neerwaarts: ' + g1(b.verhouding) + ' : 1' : null].filter(Boolean) : null; },
    omzetgroei: function (c) { var j = c.jr; return j.length ? ['Omzet ' + j[0].year + ': ' + mld(j[0].sales), 'Omzet ' + j[j.length - 1].year + ': ' + mld(j[j.length - 1].sales), 'Groei per jaar: ' + (c.groeiOmzet == null ? '–' : pct(c.groeiOmzet))] : null; },
    epsgroei: function (c) { var j = c.jr; return j.length ? ['Winst per aandeel ' + j[0].year + ': ' + g1(j[0].comparable_eps), 'Winst per aandeel ' + j[j.length - 1].year + ': ' + g1(j[j.length - 1].comparable_eps), 'Groei per jaar: ' + (c.groeiEps == null ? '–' : pct(c.groeiEps))] : null; },
    epsstabiel: function (c) { var v = jaarRegel(c, 'comparable_eps'); return v.length ? v.map(function (j, i) { return j.year + ': ' + g1(j.comparable_eps) + (i ? (j.comparable_eps > v[i - 1].comparable_eps ? ' ▲' : ' ▼') : ''); }) : null; },
    nettomarge: function (c) { var l = c.laatste; return l ? ['Jaar: ' + l.year, 'Omzet: ' + mld(l.sales), 'Nettowinst: ' + mld(l.net_income)] : null; },
    roe: function (c) { var l = c.laatste; return l ? ['Jaar: ' + l.year, 'Nettowinst: ' + mld(l.net_income), 'Eigen vermogen: ' + mld(l.equity)] : null; },
    fcf: function (c) { var l = c.laatste; return l ? ['Jaar: ' + l.year, 'Kasstroom uit bedrijf: ' + mld(l.operating_cash_flow), 'Investeringen: ' + mld(Math.abs(l.capex || 0)), 'Omzet: ' + mld(l.sales)] : null; },
    schuld: function (c) { var l = c.laatste; return l ? ['Jaar: ' + l.year, 'Langlopende schuld: ' + mld(l.long_term_debt), 'Vrije kasstroom: ' + mld((l.operating_cash_flow || 0) - Math.abs(l.capex || 0))] : null; },
    kw: function (c) { var l = c.laatste; return l && c.koersOk ? ['Koers: ' + g1(c.k.slot) + ' ' + (c.k.valuta || ''), 'Winst per aandeel ' + l.year + ': ' + g1(l.comparable_eps)] : null; },
    piotroski: function (c) { var r = piotroski(c.jr); if (!r) return null;
      return ['Vergelijking ' + r.jaar + ' met ' + r.vorig + ':'].concat(r.lijst.map(function (x) { return (x.ok ? '✓ ' : '✗ ') + x.naam; })).concat(r.niet.map(function (n) { return '? ' + n + ' (gegevens ontbreken)'; })); },
    altman: function (c) { var l = c.laatste, a = l && l.total_assets, n = aandelen(l); if (!l || !pos(a) || !pos(n) || !c.koersOk) return null;
      return ['Werkkapitaal / activa: ' + g1((l.current_assets - l.current_liabilities) / a), 'Ingehouden winst / activa: ' + g1(l.retained_earnings / a), 'Bedrijfsresultaat / activa: ' + g1(l.operating_income / a), 'Beurswaarde / totale schulden: ' + g1(c.k.slot * n / l.total_liabilities), 'Omzet / activa: ' + g1(l.sales / a)]; },
    magic: function (c) { var l = c.laatste, m = magic(c); if (!l || !m) return null; var n = aandelen(l);
      return ['Bedrijfsresultaat: ' + mld(l.operating_income), 'Bedrijfswaarde (beurswaarde + schuld − kas): ' + mld(c.k.slot * n + l.long_term_debt - l.cash), 'Gebruikt kapitaal (activa − kortlopende schuld − kas): ' + mld(l.total_assets - l.current_liabilities - l.cash)]; },
    dividend: function (c) { var l = c.laatste; return l && c.koersOk && num(l.dividend_ps) ? ['Dividend per aandeel ' + l.year + ': ' + g1(l.dividend_ps), 'Koers: ' + g1(c.k.slot)] : null; },
    momentum: function (c) { var r = c.reeks; return r.length >= 100 ? ['Koers aan het begin: ' + g1(r[0]), 'Koers nu: ' + g1(r[r.length - 1]), 'Aantal handelsdagen: ' + r.length] : null; },
    volatiliteit: function (c) { return c.reeks.length >= 100 ? ['Gebaseerd op ' + c.reeks.length + ' handelsdagen'] : null; },
    fisher: function (c) { var v = c.check; return v ? ['Ja: ' + v.ja, 'Nee: ' + v.nee, 'Onzeker: ' + (v.onzeker || 0), 'Totaal aantal vragen: ' + v.totaal] : null; }
  };
  /* Uw eigen beoordeling, 1 (slecht) tot 5 (uitstekend); 3 is neutraal. */
  function beoordelingScore(c, id) {
    var x = c.eigen && c.eigen.scores ? c.eigen.scores[id] : null;
    if (!(Number.isInteger(x) && x >= 1 && x <= 5)) return null;
    return { score: (x - 3) / 2, tekst: 'Uw beoordeling: ' + x + ' van 5.' };
  }

  function kwaliteitVan(m, c) {
    if (m.bron === 'koers') return 'koers';
    if (m.bron === 'eigen') return 'eigen';
    return c.niveau; // 'gecontroleerd' of 'jaarverslag'
  }

  /* rec: record uit aandelen.json; opties: { vandaag: 'YYYY-MM-DD', minDekking, check: {totaal, ja, nee, onzeker}, gate: Gate, naic: Naic } */
  function beoordeel(rec, opties) {
    opties = opties || {};
    var gate = opties.gate, naic = opties.naic, g = rec && rec.gegevens && !rec.gegevens.fout ? rec.gegevens : null, k = rec && rec.koers;
    var vers = k && gate ? gate.priceFreshness(k.datum, opties.vandaag).fresh : false;
    var jr = jarenVan(g);
    var bevestigd = !!(g && g.eps_status === 'independently_verified' && g.eps_verified_years >= (gate ? gate.REQUIRED_EPS_YEARS : 10) && g.rejected_sources === 0);
    var niveau = bevestigd ? 'gecontroleerd' : (g && g.niveau === 'jaarverslag' ? 'jaarverslag' : (g && g.eps_status === 'independently_verified' && jr.length >= 5 ? 'jaarverslag' : null));
    var jarenBruikbaar = !!(niveau && jr.length >= 4);
    var f = jr[0], l = jr[jr.length - 1], n = f && l ? l.year - f.year : 0;
    var bank = !!(g && (g.waarschuwingen || []).some(function (w) { return /^Bank:/.test(w); }));
    var reeks = vers && Array.isArray(k.reeks) ? k.reeks.map(function (x) { return x[1]; }).filter(pos) : [];
    var bereik = null;
    if (vers && naic) bereik = naic.bereik(jr, k.slot, 10, 8) || naic.bereikUitKoers(k.bereik, k.slot);
    var c = { k: k, koersOk: !!(vers && k && pos(k.slot)), reeks: reeks, bereik: bereik, jr: jarenBruikbaar ? jr : [], laatste: jarenBruikbaar ? l : null,
      niveau: niveau, bank: bank, check: opties.check || null, eigen: opties.verdieping || null, van: f ? f.year : null, tot: l ? l.year : null,
      eenValuta: !!(g && g.currencies && g.currencies.length === 1 && rec.valuta && g.currencies[0] === rec.valuta),
      groeiOmzet: jarenBruikbaar && n > 0 ? groei(f.sales, l.sales, n) : null,
      groeiEps: jarenBruikbaar && n > 0 ? groei(f.comparable_eps, l.comparable_eps, n) : null };
    var totaal = 0, aanwezig = 0, wegSom = 0, scoreSom = 0, perKwaliteit = {}, perGroep = {}, methoden = [];
    METHODEN.forEach(function (m) {
      var r = null, q = kwaliteitVan(m, c);
      try {
        if (m.waarde) { var w0 = m.waarde(c); r = num(w0) ? m.uit(w0, c) : null; } else r = m.f(c);
        // Ontbreekt dit onderdeel in de gegevens, dan telt uw eigen cijfer (lager gewicht); nooit naast een bestaand cijfer.
        if (!r && m.uit && c.eigen && c.eigen.cijfers && num(c.eigen.cijfers[m.id])) { r = m.uit(c.eigen.cijfers[m.id], null); if (r) { r.tekst = 'Uw eigen cijfer: ' + r.tekst; q = 'eigen'; } }
      } catch (e) { r = null; }
      totaal += m.gewicht;
      var groep = perGroep[m.groep] = perGroep[m.groep] || { naam: GROEPEN[m.groep], totaal: 0, aanwezig: 0, scoreSom: 0, wegSom: 0 };
      groep.totaal += m.gewicht;
      var inf = INFO[m.id] || [], item = { id: m.id, groep: m.groep, naam: m.naam, gewicht: m.gewicht, aanwezig: false, score: null, kwaliteit: null, tekst: null, invoer: m.invoer || null, beoordeling: m.beoordeling || null, wat: inf[0] || null, schaal: inf[1] || null, nodig: inf[2] || null, detail: null };
      if (r && num(r.score) && q && KWALITEIT[q]) {
        var w = m.gewicht * (r.deel == null ? 1 : r.deel), eff = w * KWALITEIT[q].factor;
        aanwezig += w; wegSom += eff; scoreSom += r.score * eff;
        groep.aanwezig += w; groep.wegSom += eff; groep.scoreSom += r.score * eff;
        perKwaliteit[q] = (perKwaliteit[q] || 0) + w;
        item.aanwezig = true; item.score = r.score; item.kwaliteit = q; item.tekst = r.tekst;
        try { item.detail = q === 'eigen' && m.bron !== 'eigen' ? null : (DETAIL[m.id] ? DETAIL[m.id](c) : null); } catch (e2) { item.detail = null; }
      }
      methoden.push(item);
    });
    var dekking = totaal ? rond(aanwezig / totaal * 100, 0) : 0;
    var score = wegSom > 0 ? scoreSom / wegSom : null;
    var min = typeof opties.minDekking === 'number' ? opties.minDekking : MIN_DEKKING;
    var oordeel = score == null || dekking < min ? null : score >= DREMPEL ? 'positief' : score <= -DREMPEL ? 'vermijden' : 'neutraal';
    var zekerheid = dekking >= 85 ? 'stevig' : dekking >= 65 ? 'redelijk' : dekking >= 40 ? 'voorlopig' : 'zeer voorlopig';
    var kwal = {}; Object.keys(KWALITEIT).forEach(function (q) { kwal[q] = totaal ? rond((perKwaliteit[q] || 0) / totaal * 100, 0) : 0; });
    var groepen = Object.keys(GROEPEN).map(function (id) { var x = perGroep[id] || { naam: GROEPEN[id], totaal: 0, aanwezig: 0, scoreSom: 0, wegSom: 0 };
      return { id: id, naam: x.naam, dekking: x.totaal ? rond(x.aanwezig / x.totaal * 100, 0) : 0, score: x.wegSom > 0 ? rond(x.scoreSom / x.wegSom, 2) : null }; });
    var oud = [];
    if (k && !vers) oud.push('De koers is te oud (meer dan ' + MAX_KOERS_DAGEN + ' dagen) of ontbreekt: technische en koersgebonden onderdelen tellen niet mee.');
    if (l && opties.vandaag) { var maanden = (new Date(opties.vandaag) - new Date(l.end || (l.year + '-12-31'))) / 86400000 / 30.4; if (maanden > 18) oud.push('Het laatste jaarverslag (' + l.year + ') is ouder dan 18 maanden.'); }
    return { ticker: rec ? rec.ticker : null, oordeel: oordeel, score: score == null ? null : rond(score, 2), dekking: dekking, minDekking: min, zekerheid: zekerheid, niveau: niveau,
      kwaliteit: kwal, groepen: groepen, methoden: methoden, ontbreekt: methoden.filter(function (x) { return !x.aanwezig; }).map(function (x) { return x.naam; }),
      verouderd: oud, rang: score == null ? null : rond(score * (0.5 + 0.5 * Math.min(1, dekking / 100)), 3), datum: k ? k.datum : null };
  }

  /* Rangschikking van kandidaten: eerst positieve oordelen, hoogste rang (score gewogen met dekking) bovenaan. */
  function kandidaten(lijst, max) {
    return (lijst || []).filter(function (x) { return x && x.oordeel === 'positief'; })
      .sort(function (a, b) { return b.rang - a.rang || b.dekking - a.dekking || (a.ticker < b.ticker ? -1 : 1); }).slice(0, max || 10);
  }

  var api = { beoordeel: beoordeel, kandidaten: kandidaten, METHODEN: METHODEN, KWALITEIT: KWALITEIT, GROEPEN: GROEPEN, MIN_DEKKING: MIN_DEKKING, DREMPEL: DREMPEL };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Signaal = api;
})(typeof self !== 'undefined' ? self : this);
