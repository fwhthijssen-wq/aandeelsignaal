"""Hulpmiddel voor ontwikkeling: haalt de SEC-companyfacts-bestanden van alle SEC-aandelen in de catalogus op en bewaart ze
gecomprimeerd in sec_bestanden/, zodat controles buiten GitHub opnieuw gedraaid kunnen worden. Raakt de app niet."""
import gzip, json, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import bouw_webdata as bw
from naic_fetch import sec_ticker_for_listing
from source_engine import CIK_MAP_URL, FACTS_URL, cik_for_ticker, fetch_json

email = sys.argv[1]
uit = Path('sec_bestanden'); uit.mkdir(exist_ok=True)
lijst = fetch_json(CIK_MAP_URL, email)
(uit / 'company_tickers.json').write_text(json.dumps(lijst))
for meta in bw.CATALOGUS:
    t = meta[0]
    if not bw.heeft_sec(t):
        continue
    st = sec_ticker_for_listing(t)
    cik, _ = cik_for_ticker(st, lijst)
    if cik is None:
        print('geen CIK', t); continue
    for poging in (1, 2):
        try:
            p = fetch_json(FACTS_URL.format(cik=cik), email)
            with gzip.open(uit / f'{st}.json.gz', 'wt', encoding='utf-8') as f:
                json.dump(p, f)
            print('ok', t, st, cik); break
        except Exception as exc:
            print('fout', t, exc); time.sleep(3)
    time.sleep(0.3)
