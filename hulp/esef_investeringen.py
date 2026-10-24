"""Hulpmiddel (ontwikkeling): investeringen in vaste activa uit ESEF-rapporten van bedrijven die daarvoor een EIGEN begrip
gebruiken (bijv. wolt:CapitalExpenditure, airliquide:AcquisitionDimmobilisationsCorporellesEtIncorporelles...).

Stap 1 (kandidaten):  python hulp/esef_investeringen.py kandidaten TICKER... > kandidaten.json
  Per bedrijf de begrippen zonder dimensies, met een jaarperiode en een naam die op investeringen in (im)materiële vaste
  activa lijkt, met hun waarden per jaar en indiening. Niets wordt hier al vastgelegd.
Stap 2 (vastleggen): python hulp/esef_investeringen.py vastleggen begrippen.json esef_investeringen.json
  begrippen.json = {ticker: [begrip, ...]} met de NAGEKEKEN begrippen per bedrijf (meerdere = optellen: delen van één
  totaal, zoals KPN: software + overige materiële vaste activa + overige immateriële activa). Het resultaat bevat per
  boekjaar het bedrag, de begrippen en de indiening (fxo_id), zodat elk cijfer terug te vinden is.
"""
import json, re, sys, time, urllib.request
from datetime import date
sys.path.insert(0, __file__.rsplit('/hulp/', 1)[0])
import esef_bron

UA = {'User-Agent': 'AandeelSignaal/1.0 (research; github.com/fwhthijssen-wq/aandeelsignaal)'}
DOEN = re.compile(r'purchas|payment|acqui|invest|capex|capitalexpend|addition|aankoop|verwerv|erwerb|auszahl|adquisic|pago|inversi|acquist|investiment|achat|decaiss', re.I)
WAT = re.compile(r'propertyplant|tangible|fixedasset|intangible|capex|capitalexpend|software|equipment|immobilis|corporel|materi|vasteactiva|sachanlag|immateriell|inmoviliz|immobilizz|activosfijos|propiedad|plantandequip', re.I)
NIET = re.compile(r'proceed|disposal|sale|cession|verkoop|payable|subsidiar|business|financial|depreciat|amorti|impair|lease|rightofuse|associate|jointventure|explanatory|textblock|policy|filiale|controle|equitymethod|commitment|grant|subsid|ventes|vente', re.I)


def get(url, pogingen=4):
    for i in range(pogingen):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
                return json.loads(r.read())
        except Exception:
            if i == pogingen - 1:
                raise
            time.sleep(4 * (i + 1))


def jaarfeiten(doc, filing, filter_begrip=None):
    """{begrip: {einde: waarde}} voor numerieke feiten zonder dimensies met een periode van ongeveer een jaar."""
    uit = {}
    for f in (doc.get('facts') or {}).values():
        d = f.get('dimensions') or {}
        if any(k not in esef_bron.NEGEER_DIM for k in d):
            continue
        c, per = d.get('concept') or '', d.get('period') or ''
        if '/' not in per:
            continue
        naam = c.partition(':')[2]
        if filter_begrip is not None:
            if c not in filter_begrip:
                continue
        elif not (DOEN.search(naam) and WAT.search(naam) and not NIET.search(naam)):
            continue
        try:
            a, b = per.split('/')
            begin, eind = date.fromisoformat(a[:10]), date.fromisoformat(b[:10])
            waarde = float(f['value'])
        except (ValueError, KeyError, TypeError):
            continue
        if not 330 <= (eind - begin).days <= 390:
            continue
        einde = date.fromordinal(eind.toordinal() - 1).isoformat()
        uit.setdefault(c, {})[einde] = {'val': waarde, 'begin': begin.isoformat(), 'unit': (d.get('unit') or '').replace('iso4217:', ''), 'fxo_id': filing['fxo_id']}
    return uit


def rapporten_om_de_twee(lei):
    """Rapporten sinds 2016; nieuwste eerst. Elk rapport bevat ook het vorige jaar, maar we nemen alle rapporten zodat een
    begrip dat een bedrijf later invoerde of verliet toch per jaar gevonden wordt."""
    return [r for r in esef_bron.rapporten(lei, get) if r['period_end'] >= '2016-12-31']


def kandidaten(tickers):
    lei = json.load(open(__file__.rsplit('/hulp/', 1)[0] + '/esef_lei.json'))
    uit = {}
    for t in tickers:
        L = (lei.get(t) or {}).get('lei')
        if not L:
            continue
        per = {}
        try:
            for r in rapporten_om_de_twee(L):
                try:
                    for c, jaren in jaarfeiten(get(esef_bron.BASE + r['json_url']), r).items():
                        for e, v in jaren.items():
                            per.setdefault(c, {}).setdefault(e, v)          # nieuwste indiening eerst
                except Exception as exc:
                    per.setdefault('_fout', {})[r['fxo_id']] = str(exc)[:100]
                time.sleep(0.5)
        except Exception as exc:
            per['_fout'] = str(exc)[:150]
        uit[t] = per
        print(t, len(per), file=sys.stderr, flush=True)
    return uit


def vastleggen(begrippen, uitpad):
    """begrippen: {ticker: [[begrip, ...], [begrip, ...]]}: per bedrijf alternatieven in volgorde van voorkeur; binnen een
    alternatief worden de begrippen opgeteld (delen van één totaal). Per boekjaar telt het eerste alternatief waarvan ALLE
    delen in één en dezelfde indiening staan (de nieuwste), zodat delen nooit uit verschillende opstellingen komen."""
    lei = json.load(open(__file__.rsplit('/hulp/', 1)[0] + '/esef_lei.json'))
    try:
        uit = json.load(open(uitpad))
    except (OSError, ValueError):
        uit = {}
    for t, alternatieven in begrippen.items():
        L = lei[t]['lei']
        alle = {c for alt in alternatieven for c in alt}
        per_indiening = {}                                     # fxo_id -> {einde -> {begrip -> feit}}, nieuwste eerst
        volgorde = []
        for r in rapporten_om_de_twee(L):
            volgorde.append(r['fxo_id'])
            for c, jaren in jaarfeiten(get(esef_bron.BASE + r['json_url']), r, alle).items():
                for e, v in jaren.items():
                    per_indiening.setdefault(r['fxo_id'], {}).setdefault(e, {})[c] = v
            time.sleep(0.5)
        jaren = {}
        einden = sorted({e for f in per_indiening.values() for e in f})
        for e in einden:
            gekozen = None
            for alt in alternatieven:
                for fx in volgorde:                            # nieuwste indiening eerst
                    feiten = per_indiening.get(fx, {}).get(e, {})
                    if all(c in feiten for c in alt) and len({feiten[c]['unit'] for c in alt}) == 1:
                        gekozen = (alt, fx, feiten)
                        break
                if gekozen:
                    break
            if not gekozen:
                continue
            alt, fx, feiten = gekozen
            jaren[e] = {'val': sum(abs(feiten[c]['val']) for c in alt), 'begin': feiten[alt[0]]['begin'], 'unit': feiten[alt[0]]['unit'],
                        'fxo_id': fx, 'begrippen': list(alt)}
        uit[L] = {'ticker': t, 'begrippen': alternatieven, 'jaren': jaren}
        print(t, len(jaren), file=sys.stderr, flush=True)
    json.dump(uit, open(uitpad, 'w'), ensure_ascii=False, indent=1, sort_keys=True)


if __name__ == '__main__':
    if sys.argv[1] == 'kandidaten':
        json.dump(kandidaten(sys.argv[2:]), sys.stdout, ensure_ascii=False, indent=1)
    elif sys.argv[1] == 'vastleggen':
        vastleggen(json.load(open(sys.argv[2])), sys.argv[3])
