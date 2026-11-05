"""Lichte koersupdate overdag (na het sluiten van de Europese beurzen): alleen de koersblokken in web/data/aandelen.json
vernieuwen; jaarcijfers, oordeelgegevens en de rest blijven zoals de nachtelijke update ze maakte.
Gebruik: python koersen_bijwerken.py web/data
- per fonds de dagkoersen van 2 jaar (Yahoo, in groepen van 50), Londen van pence naar ponden;
- koers_uit_reeks zoals de nachtelijke update; velden die meer historie vragen (koersbereik, relatieve sterkte, risico,
  dividend, splitsingen) blijven van de nacht;
- alleen een nieuwere koers vervangt de oude; lukt het bij minder dan de helft van de fondsen, dan blijft alles staan."""
import json, sys
from datetime import datetime, timezone
from pathlib import Path
import bouw_webdata as bw

GROEP = 50


def koersen_ophalen(tickers):
    import yfinance as yf
    uit = {}
    for i in range(0, len(tickers), GROEP):
        deel = tickers[i:i + GROEP]
        try:
            d = yf.download(deel, period='2y', interval='1d', auto_adjust=True, progress=False, threads=True, group_by='ticker', timeout=30)
        except Exception as exc:
            print('groep mislukt', i, exc, flush=True); continue
        for t in deel:
            try:
                kol = d[t]['Close'] if len(deel) > 1 else d['Close']
                uit[t] = [(idx.date().isoformat(), float(v)) for idx, v in kol.dropna().items()]
            except Exception:
                pass
    return uit


def bijwerken(bestand, reeksen, nu=None):
    pence = {m[0] for m in bw.CATALOGUS if m[3] == 'GBX'}
    n = 0
    for rec in bestand.get('aandelen') or []:
        t, oud = rec['ticker'], rec.get('koers') or {}
        reeks = reeksen.get(t)
        if not reeks:
            continue
        nieuw = bw.koers_uit_reeks(bw.pence_naar_pond(reeks) if t in pence else reeks)
        if not nieuw or (oud.get('datum') and nieuw['datum'] < oud['datum']):
            continue
        rec['koers'] = {**oud, **nieuw}
        n += 1
    bestand['koersen_bijgewerkt'] = (nu or datetime.now(timezone.utc)).isoformat(timespec='minutes')
    return n


def main():
    map_ = Path(sys.argv[1] if len(sys.argv) > 1 else 'web/data')
    bestand = json.loads((map_ / 'aandelen.json').read_text(encoding='utf-8'))
    tickers = [a['ticker'] for a in bestand.get('aandelen') or []]
    n = bijwerken(bestand, koersen_ophalen(tickers))
    if n < len(tickers) / 2:
        print(f'::warning title=Koersen overdag::maar {n} van {len(tickers)} koersen vernieuwd; niets gewijzigd')
        sys.exit(1)
    bw.schrijf(bestand, map_)
    print(f'::notice title=Koersen overdag::{n} van {len(tickers)} koersen vernieuwd ({bestand["koersen_bijgewerkt"]})')


if __name__ == '__main__':
    main()
