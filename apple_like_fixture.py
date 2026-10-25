"""Testgegevens: een Apple-achtig SEC-dossier (echte companyfacts van Apple, beperkt tot de boekjaren 2016-2021, ingediend
tot eind 2022), met de 4:1-splitsing van 2020. Gebruikt door test_bouw_webdata en test_boekjaar_en_miljoenen.
payload() geeft telkens een verse kopie; snapshot_fetcher(data) is de fetcher voor praktijkcontrole_sec_esef.summarize_sec."""
import copy, gzip, json
from pathlib import Path

_BESTAND = Path(__file__).resolve().parent / 'test_data_apple_like.json.gz'
_CACHE = {}


def payload():
    if 'p' not in _CACHE:
        with gzip.open(_BESTAND, 'rt', encoding='utf-8') as f:
            _CACHE['p'] = json.load(f)
    return copy.deepcopy(_CACHE['p'])


def snapshot_fetcher(data):
    import source_engine

    def url(u, email):
        if u == source_engine.CIK_MAP_URL:
            return {'0': {'ticker': 'AAPL', 'cik_str': int(data.get('cik', 320193)), 'title': data.get('entityName', 'Apple Inc.')}}
        if u == source_engine.FACTS_URL.format(cik=int(data.get('cik', 320193))):
            return data
        raise ValueError(f'onverwachte url {u}')
    return lambda ticker, asof, email: source_engine.sec_snapshot(ticker, asof, email, fetcher=url)
