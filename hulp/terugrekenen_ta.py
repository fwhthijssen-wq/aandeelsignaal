"""Hulpmiddel (ontwikkeling): terugrekenen van het kortetermijnsignaal (tabblad Koers). Werkte "Gunstig moment" vroeger?

Gebruik: python hulp/terugrekenen_ta.py aandelen.json uitmap [koersen.json.gz]
  - haalt per fonds ~12 jaar dagkoersen op (Yahoo Finance, gecorrigeerd voor splitsingen en dividend, zoals de nachtelijke
    update), of leest ze uit een eerder bewaard bestand;
  - neemt elke maand (laatste handelsdag, 2016-01 t/m nu) per fonds de laatste 2 jaar koersen tot en met die dag (precies wat
    de app ziet: de nachtelijke update haalt 2 jaar op) en rekent met dezelfde code de kentallen uit (bouw_webdata.koers_uit_reeks);
  - legt het rendement daarna vast over 1, 3, 6 en 12 maanden (inclusief dividend, eigen valuta);
  - schrijft uitmap/ta_punten.json. Stap 2: node hulp/terugrekenen_ta.js uitmap (signaal met de code van de app, samenvatting).
Beperkingen: de fondsen van nu (wie uit de index viel ontbreekt), valuta's door elkaar, geen kosten of belasting."""
import gzip, json, sys, time
from datetime import date
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from bouw_webdata import koers_uit_reeks, relatieve_sterkte, risico, index_voor, INDEX_YAHOO

VENSTER = 504                       # 2 jaar handelsdagen, zoals de nachtelijke update (period='2y')
HORIZON = {'m1': 1, 'm3': 3, 'm6': 6, 'm12': 12}
EERSTE = (2016, 1)


def koersen(ticker):
    import yfinance as yf
    t = yf.Ticker(ticker)
    h = t.history(period='12y', interval='1d', auto_adjust=True, actions=False)
    if h is None or h.empty:
        return []
    munt = None
    try:
        munt = t.fast_info.get('currency')
    except Exception:
        pass
    deel = 100.0 if munt in ('GBp', 'GBX') else 1.0
    return [(i.date().isoformat(), round(float(c) / deel, 6)) for i, c in h['Close'].items() if c == c and c and c > 0]


def maand_plus(d, n):
    j, m = d.year + (d.month - 1 + n) // 12, (d.month - 1 + n) % 12 + 1
    return j, m


def maandeinden(punten):
    """Index van de laatste handelsdag van elke maand."""
    uit = {}
    for i, (d, _) in enumerate(punten):
        uit[d[:7]] = i
    return uit


def main():
    data = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    uit_map = Path(sys.argv[2]); uit_map.mkdir(parents=True, exist_ok=True)
    cache = {}
    if len(sys.argv) > 3 and Path(sys.argv[3]).exists():
        cache = json.loads(gzip.decompress(Path(sys.argv[3]).read_bytes()))
    alle, fouten, rijen = {}, {}, []
    indexen = {c: [tuple(p) for p in v] for c, v in (cache.get('__index__') or {}).items()}

    def index_reeks(code):
        if code not in indexen:
            try:
                indexen[code] = koersen(INDEX_YAHOO[code])
            except Exception as exc:
                fouten['index ' + code] = str(exc)[:100]; indexen[code] = []
        return indexen[code]
    for nr, rec in enumerate(data['aandelen']):
        t = rec['ticker']
        if t == '__index__':
            continue
        punten = [tuple(p) for p in cache.get(t) or []]
        if not punten:
            try:
                punten = koersen(t)
            except Exception as exc:
                fouten[t] = f'{type(exc).__name__}: {exc}'[:150]
            time.sleep(0.3)
        alle[t] = punten
        if len(punten) < VENSTER:
            continue
        einde = maandeinden(punten)
        for maand, i in sorted(einde.items()):
            j, m = int(maand[:4]), int(maand[5:])
            if (j, m) < EERSTE or i + 1 < VENSTER:
                continue
            k = koers_uit_reeks([list(p) for p in punten[i + 1 - VENSTER:i + 1]])
            if not k:
                continue
            k.pop('reeks', None)
            rij = {'ticker': t, 'peil': punten[i][0], 'regio': 'VS' if '.' not in t else 'EU', 'koers': k}
            code = index_voor(t)
            ix = [p for p in index_reeks(code) if p[0] <= punten[i][0]] if code else []
            rel = relatieve_sterkte(punten[max(0, i - 300):i + 1], ix[-300:], code) if ix else None
            if rel:
                rij.update({'rel_' + h: rel[h] for h in ('m3', 'm6', 'm12') if h in rel})
            rs = risico(punten[max(0, i - 1300):i + 1], ix[-600:] or None)
            if rs:
                rij.update({k2: rs[k2] for k2 in ('onder_top', 'beweeglijk', 'max_daling', 'beta') if k2 in rs})
            for naam, n in HORIZON.items():
                jj, mm = maand_plus(date(j, m, 1), n)
                ie = einde.get(f'{jj:04d}-{mm:02d}')
                if ie is not None and ie > i:
                    rij[naam] = round((punten[ie][1] / punten[i][1] - 1) * 100, 3)
            rijen.append(rij)
        if nr % 25 == 0:
            print(nr, t, len(rijen), file=sys.stderr, flush=True)
    (uit_map / 'ta_punten.json').write_text(json.dumps({'rijen': rijen, 'fouten': fouten}, separators=(',', ':')), encoding='utf-8')
    alle['__index__'] = indexen
    (uit_map / 'ta_koersen.json.gz').write_bytes(gzip.compress(json.dumps(alle, separators=(',', ':')).encode()))
    print('rijen', len(rijen), 'fondsen', sum(1 for v in alle.values() if v), 'fouten', len(fouten), file=sys.stderr)


if __name__ == '__main__':
    main()
