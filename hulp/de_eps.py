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
NIET = re.compile(r'core|adjusted|underlying|continuing|discontinued|before|excluding|bereinigt|fortgef|aufgegeben|operativ|pro forma', re.I)
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


def lees(tekst, jaar=None):
    """Uitkomst voor het verslag. Het boekjaar komt uit de jaartallenkop boven de regel (niet uit de bestandsnaam: bij een
    gebroken boekjaar of een archief dat op publicatiejaar sorteert kan dat verschillen)."""
    regels = list(regels_met(tekst))
    komma = len(re.findall(r'\d,\d{2}\b', tekst)) > len(re.findall(r'\d\.\d{2}\b', tekst)) * 1.5
    vond = []
    for i, (p, r) in enumerate(regels):
        if not LABEL.search(r) or NIET.search(r) or AANTAL.search(r):
            continue
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
            x0, x1 = twee(g, heel if k == i else False)
            if any(abs(x) >= 1000 for x in (x0, x1)) or (x0 == 0 and x1 == 0):
                continue
            kop = kolomkop(regels, k)
            if not kop:
                continue
            nieuwjaar = max(kop)
            if jaar is not None and nieuwjaar not in (jaar, jaar + 1):
                continue
            nieuw, oud = (x0, x1) if kop[0] == nieuwjaar else (x1, x0)
            vond.append((nieuwjaar, nieuw, oud, min(kop), p, ' '.join(regels[k][1].split())[:140]))
    if not vond:
        return None, 'geen regel gevonden'
    # het boekjaar van het verslag = het meest voorkomende nieuwste jaar; alle kandidaten voor dat jaar moeten gelijk zijn
    from collections import Counter
    jr = Counter(v[0] for v in vond).most_common(1)[0][0]
    waarden = {(round(v[1], 4), round(v[2], 4), v[3]) for v in vond if v[0] == jr}
    if len(waarden) != 1:
        # meerdere lezingen (bijv. een tabel met omgekeerde kolommen): de keten kiest de lezing die aansluit op het latere verslag
        eerste = [v for v in vond if v[0] == jr][0]
        return {'jaar': jr, 'eps': None, 'alternatieven': sorted(waarden), 'pagina': eerste[4], 'bewijs': eerste[5], 'kandidaten': len(vond)}, None
    a, b, c = next(iter(waarden))
    eerste = [v for v in vond if v[0] == jr][0]
    return {'jaar': jr, 'eps': a, 'vorig_jaar': c, 'eps_vorig': b, 'pagina': eerste[4], 'bewijs': eerste[5], 'kandidaten': len(vond)}, None


def keten(per_jaar):
    """per_jaar: {jaar: lees-uitkomst}. {jaar: eps} van nieuw naar oud, zolang de overlap klopt."""
    uit, log = {}, []
    jaren = sorted(per_jaar, reverse=True)
    for j in jaren:
        r = per_jaar[j]
        if r.get('eps') is None:
            passend = [a for a in r.get('alternatieven') or [] if j in uit and abs(a[0] - uit[j]) <= 0.011]
            if len(passend) != 1:
                log.append(f'{j}: meerdere lezingen en geen die aansluit; reeks stopt'); break
            r = dict(r, eps=passend[0][0], eps_vorig=passend[0][1], vorig_jaar=passend[0][2])
            log.append(f'{j}: lezing gekozen die aansluit op het latere verslag')
            per_jaar[j] = r
        if not uit:
            uit[j] = r['eps']; uit[r['vorig_jaar']] = r['eps_vorig']; continue
        if j not in uit:
            log.append(f'{j}: sluit niet aan (gat); reeks stopt'); break
        if abs(uit[j] - r['eps']) <= 0.011:
            pass
        elif uit[j] * r['eps'] > 0 and abs(uit[j] / r['eps'] - 1) <= 0.06:
            log.append(f'{j}: kleine herziening ({r["eps"]} → {uit[j]}); nieuwste telt')
        else:
            log.append(f'{j}: verschil ({r["eps"]} in eigen verslag, {uit[j]} in later verslag); reeks stopt'); break
        uit.setdefault(r['vorig_jaar'], r['eps_vorig'])
    return dict(sorted(uit.items())), log


def main():
    map_, uitpad = Path(sys.argv[1]), sys.argv[2]
    index = json.load(open(map_ / 'index.json'))
    resultaat = {}
    for t, docs in sorted(index.items()):
        per_jaar, fouten = {}, {}
        for j, meta in docs.items():
            r, reden = lees((map_ / t / f'{j}.txt').read_text(encoding='utf-8'))
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
