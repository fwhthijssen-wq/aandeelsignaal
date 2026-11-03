"""Hulpmiddel (ontwikkeling): de modelportefeuille terugrekenen vanaf 2018 met precies dezelfde regels als de echte.

Stap 1 (dit script, netwerk): python hulp/model_terug.py aandelen.json uitmap
  - per fonds de dagkoersen sinds 2016 (Yahoo), met dividend en splitsingen; koersen en dividend worden teruggezet naar
    de werkelijke bedragen van toen (Yahoo past oude koersen aan voor latere splitsingen);
  - de indexen en de ECB-koersen (USD, GBP) over dezelfde periode;
  - elke week (laatste handelsdag) een fonds zoals de app het toen zag: alleen jaarcijfers met een boekjaareinde van
    minstens 75 dagen eerder, geen kwartaalwinst of analisten van nu; daarop het NAIC-oordeel, de zone, het koopmoment
    (node hulp/model_signalen.js).
  Schrijft uitmap/model_invoer.json. Stap 2: node hulp/model_terug.js uitmap (speelt de modelportefeuille af).
Beperkingen: de fondsen van nu (wie uit de index viel ontbreekt), jaarcijfers zoals nu bekend (herzieningen achteraf),
signalen één keer per week in plaats van elke dag."""
import bisect, csv, io, json, subprocess, sys, tempfile, time, urllib.request
from datetime import date, timedelta
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from bouw_webdata import koers_uit_reeks, INDEX_YAHOO

START_KOERS = '2016-06-01'
START_SIGNAAL = '2018-04-27'
PUBLICATIE_DAGEN = 75
HIER = Path(__file__).resolve().parent


def geschiedenis(ticker):
    """(datum, slot zoals Yahoo: splitsingscorrect), dividend (splitsingscorrect), splitsingen; Londen in ponden."""
    import yfinance as yf
    t = yf.Ticker(ticker)
    h = t.history(start=START_KOERS, interval='1d', auto_adjust=False, actions=True)
    if h is None or h.empty:
        return [], [], []
    munt = None
    try:
        munt = t.fast_info.get('currency')
    except Exception:
        pass
    deel = 100.0 if munt in ('GBp', 'GBX') else 1.0
    slot = [(i.date().isoformat(), float(v) / deel) for i, v in h['Close'].dropna().items() if v > 0]
    div = [(i.date().isoformat(), float(v) / deel) for i, v in h['Dividends'].items() if v and v > 0] if 'Dividends' in h else []
    spl = [(i.date().isoformat(), float(v)) for i, v in h['Stock Splits'].items() if v and v > 0 and abs(v - 1) > 1e-9] if 'Stock Splits' in h else []
    return slot, div, spl


def werkelijk(reeks, splitsingen):
    """Yahoo-bedragen (aangepast voor latere splitsingen) terug naar wat het toen werkelijk was."""
    uit = []
    for d, v in reeks:
        f = 1.0
        for sd, r in splitsingen:
            if sd > d:
                f *= r
        uit.append((d, round(v * f, 6)))
    return uit


def ecb_reeks():
    url = f'https://data-api.ecb.europa.eu/service/data/EXR/D.USD+GBP.EUR.SP00.A?startPeriod={START_KOERS}&format=csvdata'
    with urllib.request.urlopen(urllib.request.Request(url, headers={'Accept': 'text/csv'}), timeout=120) as r:
        rijen = list(csv.DictReader(io.StringIO(r.read().decode('utf-8'))))
    uit = {}
    for x in rijen:
        if x.get('OBS_VALUE'):
            uit.setdefault(x['TIME_PERIOD'], {})[x['CURRENCY']] = round(1 / float(x['OBS_VALUE']), 6)
    return {d: v for d, v in sorted(uit.items()) if 'USD' in v and 'GBP' in v}


def index_reeks(code):
    import yfinance as yf
    h = yf.Ticker(INDEX_YAHOO[code]).history(start=START_KOERS, interval='1d', auto_adjust=False)
    return [(i.date().isoformat(), round(float(v), 4)) for i, v in h['Close'].dropna().items() if v > 0]


def peildata(laatste):
    d = date.fromisoformat(START_SIGNAAL)
    while d.isoformat() <= laatste:
        yield d.isoformat()
        d += timedelta(days=7)


def main():
    data = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    uit_map = Path(sys.argv[2]); uit_map.mkdir(parents=True, exist_ok=True)
    fondsen, fouten, aangepast = {}, {}, {}
    for nr, rec in enumerate(data['aandelen']):
        t = rec['ticker']
        try:
            slot, div, spl = geschiedenis(t)
        except Exception as exc:
            fouten[t] = f'{type(exc).__name__}: {exc}'[:150]; continue
        time.sleep(0.3)
        if not slot:
            fouten[t] = 'geen koersen'; continue
        aangepast[t] = slot
        fondsen[t] = {'naam': rec['naam'], 'valuta': rec['valuta'], 'indices': rec.get('indices') or [], 'koersen': werkelijk(slot, spl),
                      'dividenden': werkelijk(div, spl), 'splitsingen': spl}
        print(nr, t, len(slot), len(div), len(spl), flush=True)
    indexen = {}
    for code in INDEX_YAHOO:
        try:
            indexen[code] = index_reeks(code)
        except Exception as exc:
            fouten['index ' + code] = str(exc)[:100]
    fx = ecb_reeks()
    laatste = max(p[-1][0] for p in aangepast.values())
    datums = {t: [p[0] for p in r] for t, r in aangepast.items()}
    signalen = {}
    for T in peildata(laatste):
        grens = (date.fromisoformat(T) - timedelta(days=PUBLICATIE_DAGEN)).isoformat()
        rijen = []
        for rec in data['aandelen']:
            t = rec['ticker']
            n = bisect.bisect_right(datums.get(t, []), T)
            tot = aangepast.get(t, [])[max(0, n - 320):n]
            if n < 210 or (date.fromisoformat(T) - date.fromisoformat(tot[-1][0])).days > 6:
                continue
            koers = koers_uit_reeks(tot)
            g = dict(rec.get('gegevens') or {})
            g.pop('ttm', None)
            g['jaren'] = [j for j in g.get('jaren') or [] if str(j.get('end') or '9') <= grens]
            rijen.append({'ticker': t, 'rec': dict(rec, koers=koers, gegevens=g, analisten=None, verwachting=None)})
        with tempfile.TemporaryDirectory() as tmp:
            i, o = Path(tmp) / 'in.json', Path(tmp) / 'uit.json'
            i.write_text(json.dumps({'peildatum': T, 'rijen': rijen}), encoding='utf-8')
            subprocess.run(['node', str(HIER / 'model_signalen.js'), str(i), str(o)], check=True)
            s = json.loads(o.read_text(encoding='utf-8'))
        # de koersdatum van het signaal: de laatste handelsdag op of vóór T
        for t, v in s.items():
            v['koersDatum'] = datums[t][bisect.bisect_right(datums[t], T) - 1]
        signalen[T] = s
        print(T, len(rijen), 'fondsen,', sum(1 for v in s.values() if v['oordeel'] == 'kopen'), 'Kopen', flush=True)
    (uit_map / 'model_invoer.json').write_text(json.dumps({'fondsen': fondsen, 'indexen': indexen, 'fx': fx, 'signalen': signalen, 'fouten': fouten}), encoding='utf-8')
    print('klaar', len(fondsen), 'fondsen;', len(signalen), 'peildata;', len(fouten), 'fouten')


if __name__ == '__main__':
    main()
