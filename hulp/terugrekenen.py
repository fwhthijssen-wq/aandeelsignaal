"""Hulpmiddel (ontwikkeling): terugrekenen. Wat zeiden de app en NAIC op vroegere peildata, en wat deed de koers daarna?

Stap 1 (dit script, netwerk): python hulp/terugrekenen.py aandelen.json uitmap
  - haalt per fonds de dagkoersen van ~12 jaar op (Yahoo Finance: slotkoers, gecorrigeerd voor splitsingen, en de koers
    inclusief herbelegd dividend voor het rendement);
  - bouwt per peildatum (eind april 2018..2025) een fonds zoals de app het toen gezien zou hebben: alleen jaarcijfers met een
    boekjaareinde van minstens 75 dagen vóór de peildatum (dan was het jaarverslag gepubliceerd), en de koers van die dag;
  - legt het rendement daarna vast over 1 en 3 jaar (inclusief dividend, in de eigen valuta).
  Schrijft uitmap/puntintijd.json. Stap 2: node hulp/terugrekenen.js uitmap (rekent de oordelen uit en vat samen).
Beperkingen: de fondsen van nu (wie uit de index viel ontbreekt), jaarcijfers zoals nu bekend (herzieningen achteraf),
geen kosten of belasting."""
import json, sys, time
from datetime import date, timedelta
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from bouw_webdata import koers_uit_reeks
from koershistorie import koersbereik

PEILDATA = [f'{j}-04-30' for j in range(2018, 2026)]
PUBLICATIE_DAGEN = 75


def koersen(ticker):
    import yfinance as yf
    t = yf.Ticker(ticker)
    h = t.history(period='12y', interval='1d', auto_adjust=False, actions=False)
    if h is None or h.empty:
        return []
    munt = None
    try:
        munt = t.fast_info.get('currency')
    except Exception:
        pass
    deel = 100.0 if munt in ('GBp', 'GBX') else 1.0          # Londen in pence: de app rekent in ponden
    uit = []
    for idx, rij in h.iterrows():
        c, a = rij.get('Close'), rij.get('Adj Close')
        if c == c and c and c > 0:
            uit.append((idx.date().isoformat(), round(float(c) / deel, 4), round(float(a) / deel, 6) if a == a and a else None))
    return uit


def op_of_na(punten, dag, max_dagen=10):
    for d, c, a in punten:
        if d >= dag:
            return (d, c, a) if (date.fromisoformat(d) - date.fromisoformat(dag)).days <= max_dagen else None
    return None


def main():
    data = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    uit_map = Path(sys.argv[2]); uit_map.mkdir(parents=True, exist_ok=True)
    rijen, fouten = [], {}
    for nr, rec in enumerate(data['aandelen']):
        t = rec['ticker']
        try:
            punten = koersen(t)
        except Exception as exc:
            fouten[t] = f'{type(exc).__name__}: {exc}'[:150]; punten = []
        time.sleep(0.4)
        if not punten:
            fouten.setdefault(t, 'geen koersen'); continue
        g = rec.get('gegevens') or {}
        for T in PEILDATA:
            tot = [(d, c) for d, c, a in punten if d <= T]
            if not tot or (date.fromisoformat(T) - date.fromisoformat(tot[-1][0])).days > 7:
                continue
            koers = koers_uit_reeks(tot[-320:])
            if koers:
                koers['bereik'] = koersbereik(tot)
            grens = (date.fromisoformat(T) - timedelta(days=PUBLICATIE_DAGEN)).isoformat()
            g_t = dict(g)
            g_t.pop('ttm', None)               # kwartaalwinst van nu: op een vroegere peildatum niet bekend (geen vooruitkijken)
            g_t['jaren'] = [j for j in g.get('jaren') or [] if str(j.get('end') or '9') <= grens]
            r_t = dict(rec, koers=koers, gegevens=g_t, analisten=None)
            begin = [p for p in punten if p[0] <= T][-1]
            rend = {}
            for naam, dagen in (('r1', 365), ('r3', 1095)):
                eind = op_of_na(punten, (date.fromisoformat(T) + timedelta(days=dagen)).isoformat())
                if eind and begin[2] and eind[2]:
                    rend[naam] = round(eind[2] / begin[2] - 1, 5)
            rijen.append({'peildatum': T, 'ticker': t, 'rec': r_t, **rend})
        print(nr, t, len(punten), flush=True)
    (uit_map / 'puntintijd.json').write_text(json.dumps({'peildata': PEILDATA, 'rijen': rijen, 'fouten': fouten}), encoding='utf-8')
    print('klaar', len(rijen), 'rijen;', len(fouten), 'zonder koersen')


if __name__ == '__main__':
    main()
