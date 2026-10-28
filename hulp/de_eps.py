"""Hulpmiddel (ontwikkeling): gerapporteerde verwaterde winst per aandeel uit de tekst van Duitse jaarverslagen, met controle
over de jaren heen. Gebruik: python hulp/de_eps.py tekstmap(de/) uit.json

Per verslag (boekjaar J) zoeken we de regel met de verwaterde winst per aandeel voor J en het jaar ervoor:
  - 'Diluted earnings per share' / 'Verwässertes Ergebnis je Aktie' met twee getallen op de regel, of als kop met
    daaronder (binnen 4 regels) 'Net income' / 'Konzernergebnis' met twee getallen;
  - niet: 'core', 'adjusted', 'continuing', 'bereinigt', 'fortgeführt' (alleen het totaal);
  - de kolomvolgorde volgt de jaartallenkop erboven.
Alle kandidaten in één verslag moeten hetzelfde zeggen, anders niets. Daarna de keten: het vorige jaar uit verslag J moet
gelijk zijn (op een cent) aan jaar J uit verslag J-1; tot 6% verschil is een herziening (nieuwste telt); meer: de reeks
stopt (bijv. een splitsing die niet te controleren is). Gerapporteerd, niet nagerekend: niveau 'uit jaarverslag'."""
import json, re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pdf_uitlezen import NUM, getallen, kolommen, regels_met

LABEL = re.compile(r'diluted earnings per (ordinary )?share|earnings per share\W{0,3}\s*diluted|verw[äa]e?ssertes ergebnis je aktie|ergebnis je aktie\W{0,3}\s*verw[äa]e?ssert', re.I)
NIET = re.compile(r'core|\bpre\b|adjusted|underlying|continuing|discontinued|before|excluding|bereinigt|fortgef|aufgegeben|operativ|pro forma', re.I)
# Tweede ronde als er geen verwaterde winst per aandeel staat: gewone winst per aandeel (bij veel Duitse bedrijven gelijk,
# 'unverwässert = verwässert'). 'Uit voortgezette en beëindigde activiteiten' is het totaal en telt dus wel.
LABEL2 = re.compile(r'\b(basic )?earnings per (ordinary )?share\b|\b(unverw[äa]e?ssertes )?ergebnis je aktie\b', re.I)
TOTAAL_ACT = re.compile(r'(from |aus )?(continuing and discontinued operations|fortgef[üu]hrten und nicht fortgef[üu]hrten [a-zäöü]+)', re.I)
TOTAAL = re.compile(r'^\s*(net income|net profit|profit (for the year|after tax)|income after taxes|konzernergebnis|ergebnis nach steuern|jahres(überschuss|fehlbetrag))\b', re.I)


def kolomkop(regels, i):
    """Jaartallenkop boven regel i als (links, rechts). Ook als de kop over twee regels loopt (bijv. '2024' boven
    '2025  restated'): dan bepaalt de positie op de regel wat links en rechts staat."""
    k = kolommen(regels, i)
    if k:
        return k
    for j in range(i, max(1, i - 60), -1):
        a = [(int(m.group()), m.start()) for m in re.finditer(r'(?<!\d)(20[0-3]\d)(?!\d)', regels[j][1])]
        b = [(int(m.group()), m.start()) for m in re.finditer(r'(?<!\d)(20[0-3]\d)(?!\d)', regels[j - 1][1])]
        for x, y in ((a, b), (b, a)):
            if len(x) == 1:
                buren = [v for v in y if abs(v[0] - x[0][0]) == 1 and abs(v[1] - x[0][1]) > 8]
                if buren:
                    buur = min(buren, key=lambda v: abs(v[1] - x[0][1]))       # dichtstbijzijnde kolom
                    links, rechts = sorted([x[0], buur], key=lambda v: v[1])
                    return (links[0], rechts[0])
    return None


AANTAL = re.compile(r'number of shares|weighted average|anzahl|aktien\s*\(|shares outstanding|in thousands', re.I)


def jaarrij(regels, i, n):
    """Kop met precies n opeenvolgende jaartallen boven regel i (meerjarenoverzicht, bijv. 2017 2018 2019 2020 2021), of None."""
    for j in range(i, max(-1, i - 60), -1):
        jr = [int(m.group()) for m in re.finditer(r'(?<![\d.,])(20[0-3]\d)(?![\d.,])', regels[j][1])]
        if len(jr) == n and n >= 3 and all(abs(b - a) == 1 for a, b in zip(jr, jr[1:])) and len(set(jr)) == n:
            return jr
    return None


def twee(g, heel=False):
    """De twee jaarwaarden uit de getallen van een regel: zonder toelichtingsnummer vooraan en zonder verschilkolom achteraan.
    heel: het eerste getal staat zonder decimalen in de tekst terwijl de volgende er wel hebben (toelichting '11 16.60 26.60')."""
    if len(g) >= 3 and abs((g[0] - g[1]) - g[2]) <= 0.011:                 # derde getal = verschil
        return g[0], g[1]
    if len(g) >= 3 and heel and abs(g[0]) < 60 and float(g[0]).is_integer():
        return g[1], g[2]
    if len(g) >= 3 and abs(g[0]) < 60 and round(g[0], 1) == g[0] and any(round(x, 1) != x for x in g[1:3]):
        return g[1], g[2]                                                  # eerste getal = toelichtingsnummer (6 of 8.5)
    return g[0], g[1]


VOORKEUR = {'VOW3.DE', 'HEN3.DE', 'PAH3.DE'}     # genoteerd zijn de preferente aandelen (Vorzugsaktien)
NIET_PREF = re.compile(NIET.pattern + r'|preferred|preference|vorzug', re.I)
NIET_GEWOON = re.compile(NIET.pattern + r'|common stock|ordinary share|stammaktie', re.I)


def lees(tekst, jaar=None, ticker=None):
    """Bij bedrijven met gewone én preferente aandelen (BMW, VW, Henkel, Porsche) staan twee winsten per aandeel: we nemen die
    van het genoteerde aandeel (preferent bij VOW3/HEN3/PAH3, anders gewoon)."""
    niet = NIET if ticker in VOORKEUR else NIET_PREF          # preferente aandelen: zoals voorheen (beide soorten, keten kiest)
    uit = _lees(tekst, jaar, LABEL, niet=niet)
    if uit[0] is None:
        uit = _lees(tekst, jaar, LABEL2, niet=niet)
    return uit


SCHAAL = ((re.compile(r'\b(billions?|bn|mrd\.?|milliarden)\b', re.I), 1e9), (re.compile(r'\b(millions?|mio\.?|mn|€\s?m|eur\s?m|m€|€m)\b', re.I), 1e6),
          (re.compile(r'\b(thousands?|tsd\.?|t€|€\s?(000|thousand)|eur\s?k)\b', re.I), 1e3))


def schaal_boven(regels, i, terug=80):
    """Eenheid van een bedragentabel: de eerste aanduiding (miljoen, miljard, duizend) op of boven regel i, of None."""
    for j in range(i, max(-1, i - terug), -1):
        for rx, f in SCHAAL:
            if rx.search(regels[j][1]):
                return f
    return None


def _lees(tekst, jaar, label, niet=None, maxabs=1000, aantal=True):
    """Uitkomst voor het verslag. Het boekjaar komt uit de jaartallenkop boven de regel (niet uit de bestandsnaam: bij een
    gebroken boekjaar of een archief dat op publicatiejaar sorteert kan dat verschillen)."""
    regels = list(regels_met(tekst))
    komma = len(re.findall(r'\d,\d{2}\b', tekst)) > len(re.findall(r'\d\.\d{2}\b', tekst)) * 1.5
    vond = []
    for i, (p, r) in enumerate(regels):
        if not label.search(r) or (niet or NIET).search(TOTAAL_ACT.sub(' ', r)) or (aantal and AANTAL.search(r)):
            continue
        mlab = label.search(r)
        if NUM.findall(r[:mlab.start()]):
            continue                                     # getallen vóór het label: tekst uit een andere kolom (bijv. 'audits 36 34 … earnings per share')
        kandidaat = []
        g = getallen(re.sub(r'\[\d+\]', ' ', r), komma)
        if len(g) >= 2:
            kandidaat.append((i, g))
            toks = NUM.findall(r)[-len(g):]
            heel = len(toks) >= 3 and not re.search(r'[.,]\d', toks[0]) and all(re.search(r'[.,]\d', t) for t in toks[1:3])
        else:                                            # kop; totaal op een van de volgende regels
            for j in range(i + 1, min(i + 5, len(regels))):
                rr = regels[j][1]
                if TOTAAL.search(rr):
                    gg = getallen(re.sub(r'\[\d+\]', ' ', rr), komma)
                    if len(gg) >= 2:
                        kandidaat.append((j, gg))
                    break
        for k, g in kandidaat:
            rij = jaarrij(regels, k, len(g)) if len(g) >= 3 else None
            if not rij and len(g) >= 4 and jaarrij(regels, k, len(g) - 1):
                rij = jaarrij(regels, k, len(g) - 1)          # meerjarenoverzicht met een verschilkolom achteraan
                g = g[:len(rij)]
            if rij:                                      # meerjarenoverzicht: elk getal hoort bij een jaar
                n = rij.index(max(rij)); v = n - 1 if rij[0] < rij[-1] else n + 1
                if maxabs and any(abs(x) >= maxabs for x in (g[n], g[v])):
                    continue
                if not maxabs:
                    if all(float(x).is_integer() and 1990 <= x <= 2035 for x in (g[n], g[v])):
                        continue
                    f = schaal_boven(regels, k)
                    if not f:
                        continue
                    g = [x * f for x in g]
                vond.append((rij[n], g[n], g[v], rij[v], p, ' '.join(regels[k][1].split())[:140], dict(zip(rij, g))))
                continue
            x0, x1 = twee(g, heel if k == i else False)
            if (maxabs and any(abs(x) >= maxabs for x in (x0, x1))) or (x0 == 0 and x1 == 0):
                continue
            if not maxabs:
                if all(float(x).is_integer() and 1990 <= x <= 2035 for x in (x0, x1)):
                    continue                                    # jaartallen, geen bedragen
                f = schaal_boven(regels, k)
                if not f:
                    continue
                x0, x1 = x0 * f, x1 * f
            kop = kolomkop(regels, k)
            if not kop:
                continue
            nieuwjaar = max(kop)
            if jaar is not None and nieuwjaar not in (jaar, jaar + 1):
                continue
            nieuw, oud = (x0, x1) if kop[0] == nieuwjaar else (x1, x0)
            vond.append((nieuwjaar, nieuw, oud, min(kop), p, ' '.join(regels[k][1].split())[:140], None))
    if not vond:
        return None, 'geen regel gevonden'
    # het boekjaar van het verslag = het meest voorkomende nieuwste jaar; alle kandidaten voor dat jaar moeten gelijk zijn
    from collections import Counter
    jr = Counter(v[0] for v in vond).most_common(1)[0][0]
    if maxabs:
        # tabelregels (label vooraan) gaan voor op lopende tekst ('… earnings per share were €760 million and €0.20')
        tabel = [v for v in vond if v[0] == jr and (lambda m: m is not None and m.start() <= 2)(label.search(v[5]))]
        if tabel and len({(round(v[1], 4), round(v[2], 4), v[3]) for v in tabel}) < len({(round(v[1], 4), round(v[2], 4), v[3]) for v in vond if v[0] == jr}):
            vond = tabel + [v for v in vond if v[0] != jr]
    waarden = {(round(v[1], 4), round(v[2], 4), v[3]) for v in vond if v[0] == jr}
    if not maxabs and len(waarden) > 1:
        # bedragen: dezelfde lezing in een andere afronding (59.7 mld in het overzicht, 59,705 mln in de tabel) telt als één
        nauwkeurig = sorted(waarden, key=lambda w: -len(str(w[0]).rstrip('0')))
        basis = nauwkeurig[0]
        if all(w[2] == basis[2] and abs(w[0] - basis[0]) <= 0.006 * abs(basis[0]) + 1 and abs(w[1] - basis[1]) <= 0.006 * abs(basis[1]) + 1 for w in waarden):
            waarden = {basis}
        else:
            # bedragen staan op veel plaatsen (kerncijfers, jaarrekening, segmenten): de lezing die het vaakst voorkomt, als die
            # minstens twee keer voorkomt en vaker dan elke andere (een andere afronding telt mee als dezelfde)
            def zelfde(w, x):
                return w[2] == x[2] and abs(w[0] - x[0]) <= 0.006 * abs(x[0]) + 1 and abs(w[1] - x[1]) <= 0.006 * abs(x[1]) + 1
            lezingen = [(round(v[1], 4), round(v[2], 4), v[3]) for v in vond if v[0] == jr]
            telling = sorted(((sum(1 for y in lezingen if zelfde(y, x)), -len(str(x[0]).rstrip('0')), x) for x in set(lezingen)), reverse=True)
            if telling[0][0] >= 2 and (len(telling) == 1 or telling[0][0] > max(t[0] for t in telling if not zelfde(t[2], telling[0][2]) ) if any(not zelfde(t[2], telling[0][2]) for t in telling) else True):
                waarden = {telling[0][2]}
                vond = [v for v in vond if v[0] != jr or zelfde((round(v[1], 4), round(v[2], 4), v[3]), telling[0][2])]
    if len(waarden) != 1:
        # meerdere lezingen (bijv. een tabel met omgekeerde kolommen): de keten kiest de lezing die aansluit op het latere verslag
        eerste = [v for v in vond if v[0] == jr][0]
        return {'jaar': jr, 'eps': None, 'alternatieven': sorted(waarden), 'pagina': eerste[4], 'bewijs': eerste[5], 'kandidaten': len(vond)}, None
    a, b, c = next(iter(waarden))
    eerste = [v for v in vond if v[0] == jr][0]
    uit = {'jaar': jr, 'eps': a, 'vorig_jaar': c, 'eps_vorig': b, 'pagina': eerste[4], 'bewijs': eerste[5], 'kandidaten': len(vond)}
    # meerjarenoverzicht in hetzelfde verslag dat met deze lezing overeenkomt: de oudere jaren zoals het bedrijf ze nu toont
    tol = 0.011 if maxabs else 0.006 * max(abs(a), abs(b)) + 1
    mj = [v[6] for v in vond if v[0] == jr and v[6] and abs(v[6].get(jr, 1e18) - a) <= tol and abs(v[6].get(c, 1e18) - b) <= tol]
    if mj and all(m == mj[0] for m in mj):
        uit['meerjaren'] = {y: x for y, x in mj[0].items() if y < c}
    return uit, None


def keten(per_jaar, relatief=False):
    """per_jaar: {jaar: lees-uitkomst}. {jaar: eps} van nieuw naar oud, zolang de overlap klopt."""
    uit, log = {}, []
    def gelijk(x, y):
        return abs(x - y) <= 0.011 or (relatief and abs(x - y) <= 0.006 * max(abs(x), abs(y)))
    jaren = sorted(per_jaar, reverse=True)
    for j in jaren:
        r = per_jaar[j]
        if r.get('eps') is None:
            alts = r.get('alternatieven') or []
            passend = [a for a in alts if j in uit and gelijk(a[0], uit[j])]
            hoe = 'het latere verslag'
            if not passend and j not in uit:
                # nieuwste verslag (of na een gat): kies de lezing waarvan het vorige jaar aansluit op het oudere verslag
                ouder = per_jaar.get(j - 1) or {}
                kandidaten = [ouder['eps']] if ouder.get('eps') is not None else [a[0] for a in ouder.get('alternatieven') or []]
                passend = [a for a in alts if a[2] == j - 1 and any(gelijk(a[1], k) for k in kandidaten)]
                hoe = 'het oudere verslag'
            if len(passend) != 1:
                log.append(f'{j}: meerdere lezingen en geen die aansluit; reeks stopt'); break
            r = dict(r, eps=passend[0][0], eps_vorig=passend[0][1], vorig_jaar=passend[0][2])
            log.append(f'{j}: lezing gekozen die aansluit op {hoe}')
            per_jaar[j] = r
        if not uit:
            uit[j] = r['eps']; uit[r['vorig_jaar']] = r['eps_vorig']; _meerjaren(uit, r, log); continue
        if j not in uit:
            log.append(f'{j}: sluit niet aan (gat); reeks stopt'); break
        if gelijk(uit[j], r['eps']):
            pass
        elif uit[j] * r['eps'] > 0 and abs(uit[j] / r['eps'] - 1) <= 0.06:
            log.append(f'{j}: kleine herziening ({r["eps"]} → {uit[j]}); nieuwste telt')
        else:
            log.append(f'{j}: verschil ({r["eps"]} in eigen verslag, {uit[j]} in later verslag); reeks stopt'); break
        uit.setdefault(r['vorig_jaar'], r['eps_vorig'])
        _meerjaren(uit, r, log)
    return dict(sorted(uit.items())), log


def _meerjaren(uit, r, log):
    """Oudere jaren uit het meerjarenoverzicht van een geaccepteerd verslag: vullen een gat (ontbrekend verslag), zodat
    het oudere verslag daar weer op kan aansluiten. Een bestaand cijfer wordt nooit vervangen."""
    nieuw = [y for y in sorted((r.get('meerjaren') or {}), reverse=True) if y not in uit]
    for y in nieuw:
        uit[y] = r['meerjaren'][y]
    if nieuw:
        log.append(f"{r['jaar']}: meerjarenoverzicht vult {', '.join(map(str, sorted(nieuw)))}")


def main():
    map_, uitpad = Path(sys.argv[1]), sys.argv[2]
    index = json.load(open(map_ / 'index.json'))
    resultaat = {}
    for t, docs in sorted(index.items()):
        per_jaar, fouten = {}, {}
        for j, meta in docs.items():
            r, reden = lees((map_ / t / f'{j}.txt').read_text(encoding='utf-8'), ticker=t)
            if r and r['jaar'] in per_jaar and per_jaar[r['jaar']].get('eps') is not None and (per_jaar[r['jaar']]['eps'], per_jaar[r['jaar']]['eps_vorig']) != (r.get('eps'), r.get('eps_vorig')):
                fouten[j] = f'zelfde boekjaar {r["jaar"]} als een ander bestand, met andere cijfers'; continue
            if r:
                r['url'] = meta['url']; r['sha256'] = meta.get('sha256'); r['bestand'] = j
                per_jaar[r['jaar']] = r
            else:
                fouten[j] = reden
        reeks, log = keten(per_jaar)
        resultaat[t] = {'reeks': {str(k): v for k, v in reeks.items()}, 'verslagen': {str(k): v for k, v in per_jaar.items()}, 'niet_gelezen': fouten, 'log': log}
        print(t, len(reeks), 'jaren', {k: v for k, v in reeks.items()}, '| niet:', fouten, '|', log, flush=True)
    json.dump(resultaat, open(uitpad, 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
