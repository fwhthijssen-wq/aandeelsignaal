"""Hulpmiddel (ontwikkeling): Franse (fr/) en Britse (uk/) jaarverslagen die als tekst op de tak jaarverslagen staan,
automatisch uitlezen met pdf_uitlezen en klaarzetten voor pdf_naar_register.py (bron fr of uk).
Gebruik: python hulp/tekst_uitlezen.py <map fr of uk> resultaten.json [TICKER ...]   (zonder tickers: alle mappen)"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdf_uitlezen import uitlezen


def main():
    map_, uit, tickers = sys.argv[1], sys.argv[2], sys.argv[3:]
    tickers = tickers or sorted(d for d in os.listdir(map_) if os.path.isdir(os.path.join(map_, d)))
    res, log = {}, []
    for t in tickers:
        idx = os.path.join(map_, t, 'index.json')
        if not os.path.exists(idx):
            log.append(f'{t}: geen verslagen'); continue
        for d in json.load(open(idx)):
            pad = os.path.join(map_, t, d.get('tekst') or '')
            if not d.get('tekst') or not os.path.exists(pad):
                continue
            tekst = open(pad, errors='ignore').read()
            try:
                r, reden = uitlezen(tekst, int(d['boekjaar']))
            except Exception as exc:
                log.append(f'{t} {d["boekjaar"]}: fout {type(exc).__name__}'); continue
            if not r:
                log.append(f'{t} {d["boekjaar"]}: niet uitgelezen ({reden})'); continue
            doc = {k: d.get(k) for k in ('bestand_bron', 'boekjaar', 'titel', 'download', 'registerdatum')}
            doc['bestand_bron'] = doc['bestand_bron'] or (d.get('download') or '').rstrip('/').split('/')[-1]   # VK: geen apart bestandsveld
            res.setdefault(t, []).append({'doc': doc, 'res': r})
            log.append(f'{t} {d["boekjaar"]}: ' + ', '.join(f'{x[0]}: {x[1]}' for x in r))
    json.dump(res, open(uit, 'w'), ensure_ascii=False, indent=1)
    print('\n'.join(log))


if __name__ == '__main__':
    main()
