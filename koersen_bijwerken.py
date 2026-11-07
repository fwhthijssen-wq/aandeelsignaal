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


def koersvelden():
    """De velden die koers_uit_reeks maakt (slot, datum, sma50, reeks, technische maatstaven, weekreeks)."""
    from datetime import date, timedelta
    d0 = date(2020, 1, 1)
    return set(bw.koers_uit_reeks([((d0 + timedelta(days=i)).isoformat(), 100 + i % 7) for i in range(1500)]) or {})


def nieuwere_uit(bestand, vorige):
    """'s Nachts geeft Yahoo voor Europa soms nog de slotkoers van eergisteren, terwijl de koersupdate van de vorige
    middag die van gisteren al had. Neem dan de koersvelden van de vorige middag over; de rest blijft van de nacht."""
    oud = {a['ticker']: a.get('koers') or {} for a in vorige.get('aandelen') or []}
    velden, n = koersvelden(), 0
    for rec in bestand.get('aandelen') or []:
        k, v = rec.get('koers'), oud.get(rec['ticker'])
        if k and v and v.get('datum') and k.get('datum') and v['datum'] > k['datum'] and v.get('slot'):
            rec['koers'] = {**k, **{x: v[x] for x in velden if x in v}}
            n += 1
    return n


def koersdata(bestand):
    """Per beurs (achtervoegsel van de beurscode, VS zonder) de nieuwste en de oudste koersdatum: 'AS 2026-11-05/2026-11-04'."""
    per = {}
    for a in bestand.get('aandelen') or []:
        d = (a.get('koers') or {}).get('datum')
        if d:
            per.setdefault(a['ticker'].rsplit('.', 1)[1] if '.' in a['ticker'] else 'VS', []).append(d)
    return ' '.join(f'{k} {max(v)}' + (f'/{min(v)}' if min(v) != max(v) else '') for k, v in sorted(per.items()))


def main():
    args = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith('--') and sys.argv[i - 1] != '--vorige']
    nacht = '--nacht' in sys.argv
    titel = 'Koersen nalopen' if nacht else 'Koersen overdag'
    map_ = Path(args[0] if args else 'web/data')
    bestand = json.loads((map_ / 'aandelen.json').read_text(encoding='utf-8'))
    tickers = [a['ticker'] for a in bestand.get('aandelen') or []]
    voor = koersdata(bestand)
    bijgewerkt = bestand.get('koersen_bijgewerkt')
    n = bijwerken(bestand, koersen_ophalen(tickers))
    van_middag = 0
    if nacht and '--vorige' in sys.argv:
        pad = Path(sys.argv[sys.argv.index('--vorige') + 1])
        if pad.exists():
            try:
                van_middag = nieuwere_uit(bestand, json.loads(pad.read_text(encoding='utf-8')))
            except (ValueError, OSError):
                pass
    if nacht:                      # 's nachts hoort er geen tijdstip 'koersen bijgewerkt' bij: dat is de update zelf
        if bijgewerkt is None:
            bestand.pop('koersen_bijgewerkt', None)
        else:
            bestand['koersen_bijgewerkt'] = bijgewerkt
    if n < len(tickers) / 2:
        print(f'::warning title={titel}::maar {n} van {len(tickers)} koersen vernieuwd; niets gewijzigd (koersdata {voor})')
        sys.exit(0 if nacht else 1)
    bw.schrijf(bestand, map_)
    print(f'::notice title={titel}::{n} van {len(tickers)} koersen vernieuwd{f', {van_middag} van de koersupdate van gisteren' if van_middag else ''}; koersdata voor {voor} | na {koersdata(bestand)}')


if __name__ == '__main__':
    main()
