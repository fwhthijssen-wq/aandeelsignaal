"""Hulpmiddel (ontwikkeling): welke jaarfeiten heeft de SEC voor een bedrijf, per begrip en eenheid?
Gebruik: python hulp/sec_feiten.py contact@adres TICKER [...]"""
import json, sys, time
from datetime import date
from urllib.request import Request, urlopen

BEGRIPPEN = ['Revenue', 'ProfitLossAttributableToOwnersOfParent', 'ProfitLoss', 'DilutedEarningsLossPerShare', 'BasicEarningsLossPerShare',
             'AdjustedWeightedAverageShares', 'WeightedAverageShares', 'Revenues', 'NetIncomeLoss', 'EarningsPerShareDiluted']


def haal(url, email):
    with urlopen(Request(url, headers={'User-Agent': f'AandeelSignaal Research {email}'}), timeout=60) as r:
        return json.load(r)


email = sys.argv[1]
lijst = haal('https://www.sec.gov/files/company_tickers.json', email)
for t in sys.argv[2:]:
    cik = next(int(v['cik_str']) for v in lijst.values() if v['ticker'] == t)
    f = haal(f'https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json', email)
    print('==', t, cik, sorted(f.get('facts', {}).keys()))
    for ns, tags in f.get('facts', {}).items():
        for tag in BEGRIPPEN:
            for unit, rijen in (tags.get(tag) or {}).get('units', {}).items():
                jaar = sorted({(r['end'], r.get('form'), r.get('filed')) for r in rijen if r.get('start') and 330 <= (date.fromisoformat(r['end']) - date.fromisoformat(r['start'])).days <= 390})
                einden = sorted({e for e, _, _ in jaar})
                print(f'  {ns}:{tag} [{unit}] jaren {einden[0][:4] if einden else "-"}–{einden[-1][:4] if einden else "-"} ({len(einden)}); vormen {sorted({v for _, v, _ in jaar})}; laatst ingediend {max((d for _, _, d in jaar), default="-")}')
    time.sleep(0.5)
