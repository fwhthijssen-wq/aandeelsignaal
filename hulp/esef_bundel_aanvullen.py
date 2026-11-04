"""Hulpmiddel (ontwikkeling): ESEF-rapporten van fondsen toevoegen aan esef_bundel.json.gz (filings.xbrl.org).
Gebruik: python hulp/esef_bundel_aanvullen.py TICKER [TICKER ...] [--vernieuw]
Per ticker de LEI uit esef_lei.json; staat die al in de bundel, dan overgeslagen (tenzij --vernieuw)."""
import gzip, json, sys, time, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from esef_bron import companyfacts

HIER = Path(__file__).resolve().parent.parent
UA = {'User-Agent': 'AandeelSignaal/1.0 (+https://github.com/fwhthijssen-wq/aandeelsignaal)', 'Accept': 'application/json'}


def ophalen_json(url):
    for poging in range(6):                         # filings.xbrl.org begrenst het aantal verzoeken
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
                data = json.loads(r.read().decode('utf-8'))
            time.sleep(1.0)
            return data
        except Exception as exc:
            if poging == 5:
                raise
            time.sleep(10 * (poging + 1))


def main():
    args = sys.argv[1:]
    vernieuw = '--vernieuw' in args
    tickers = [a for a in args if not a.startswith('--')]
    leis = json.loads((HIER / 'esef_lei.json').read_text(encoding='utf-8'))
    pad = HIER / 'esef_bundel.json.gz'
    bundel = json.load(gzip.open(pad, 'rt', encoding='utf-8'))
    for t in tickers:
        x = leis.get(t)
        if not x:
            print(t, 'geen LEI'); continue
        if x['lei'] in bundel and not vernieuw:
            print(t, 'al in de bundel'); continue
        try:
            cf = companyfacts(x['lei'], x.get('naam') or t, ophalen_json)
        except Exception as exc:
            print(t, 'fout', str(exc)[:120]); continue
        if cf['rapporten']:
            bundel[x['lei']] = cf
        print(t, x['lei'], len(cf['rapporten']), 'rapporten', [r['period_end'] for r in cf['rapporten']], 'overgeslagen', len(cf['overgeslagen']), flush=True)
    with gzip.open(pad, 'wt', encoding='utf-8') as f:
        json.dump(bundel, f, separators=(',', ':'))
    print('bundel:', len(bundel), 'bedrijven')


if __name__ == '__main__':
    main()
