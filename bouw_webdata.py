"""Maakt de gegevensbestanden voor de webapp (web/data/aandelen.json en aandelen.js).

Twee manieren:
  python bouw_webdata.py --demo SEC_ESEF_praktijkresultaat.json   (alleen eerder gecontroleerde Apple-gegevens)
  python bouw_webdata.py --live --email uw@adres.nl                (SEC + koersen voor de hele lijst; draait 's nachts)

Regels: er worden nooit gegevens verzonnen. Ontbreekt iets, dan staat er null en een reden; de webapp
laat dan geen oordeel zien. Het label-slot zelf draait in de webapp, met de datum van het moment van kijken.
"""
import argparse
import json
from datetime import date, datetime, timezone
from pathlib import Path

SCHEMA = 1
HERE = Path(__file__).resolve().parent
UITVOER = HERE / 'web' / 'data'

# (ticker, naam, land, valuta, beurs)
CATALOGUS = (
    ('ASML.AS', 'ASML Holding', 'Nederland', 'EUR', 'Amsterdam'),
    ('SHELL.AS', 'Shell plc', 'Nederland', 'EUR', 'Amsterdam'),
    ('AAPL', 'Apple Inc.', 'Verenigde Staten', 'USD', 'Nasdaq'),
    ('MSFT', 'Microsoft Corp.', 'Verenigde Staten', 'USD', 'Nasdaq'),
    ('GOOGL', 'Alphabet (Google)', 'Verenigde Staten', 'USD', 'Nasdaq'),
    ('AMZN', 'Amazon.com', 'Verenigde Staten', 'USD', 'Nasdaq'),
    ('NVDA', 'NVIDIA', 'Verenigde Staten', 'USD', 'Nasdaq'),
    ('SAP.DE', 'SAP SE', 'Duitsland', 'EUR', 'Xetra'),
    ('INGA.AS', 'ING Groep', 'Nederland', 'EUR', 'Amsterdam'),
    ('UNA.AS', 'Unilever', 'Nederland', 'EUR', 'Amsterdam'),
)

JAAR_VELDEN = ('year', 'end', 'currency', 'sales', 'net_income', 'reported_eps', 'comparable_eps',
               'operating_cash_flow', 'capex', 'equity', 'eps_check', 'eps_reden')


def _getal(x):
    return x if isinstance(x, (int, float)) and not isinstance(x, bool) and x == x and abs(x) != float('inf') else None


def gegevens_uit_sec(sec, gecontroleerd_op):
    """Zet de SEC-samenvatting (summarize_sec) om naar het gegevensblok voor de webapp.

    Geeft een blok met `fout` als er geen bruikbaar dossier is. Het bewijs voor het label-slot komt uit
    dezelfde functie als in de Streamlit-app (eps_verification.gate_evidence).
    """
    from eps_verification import gate_evidence
    if not isinstance(sec, dict) or sec.get('status') != 'facts_found' or not isinstance(sec.get('dossier'), dict):
        reden = (sec or {}).get('reason') or (sec or {}).get('message') or 'Geen volledige jaarcijfers beschikbaar.'
        return {'gecontroleerd_op': gecontroleerd_op, 'fout': str(reden)[:300], 'eps_status': None,
                'eps_verified_years': None, 'currencies': None, 'rejected_sources': None,
                'jaren': [], 'splits': [], 'waarschuwingen': []}
    dossier = sec['dossier']
    bewijs = gate_evidence(sec)
    jaren = [{k: r.get(k) for k in JAAR_VELDEN} for r in dossier.get('year_table') or []]
    splits, gezien = [], set()
    for s in dossier.get('split_event_audit') or []:
        if not isinstance(s, dict):
            continue
        sleutel = (s.get('date'), s.get('ratio'), s.get('status'))
        if sleutel in gezien:
            continue
        gezien.add(sleutel)
        splits.append({'datum': s.get('date'), 'ratio': s.get('ratio'), 'status': s.get('status'),
                       'redenen': s.get('reasons') or [],
                       'bewijs': [{'periode': e.get('periode'), 'voor': e.get('eps_voor'), 'na': e.get('eps_na'),
                                   'verhouding': e.get('verhouding_waargenomen')}
                                  for e in s.get('verification_evidence') or []]})
    return {'gecontroleerd_op': gecontroleerd_op, 'fout': None,
            'eps_status': bewijs.get('eps_status'), 'eps_verified_years': bewijs.get('eps_verified_years'),
            'currencies': bewijs.get('currencies'), 'rejected_sources': bewijs.get('rejected_sources'),
            'jaren': jaren, 'splits': splits, 'waarschuwingen': list(dossier.get('warnings') or []),
            'eps_toelichting': dossier.get('eps_verification_note')}


def koers_uit_reeks(reeks):
    """reeks: lijst (datum 'YYYY-MM-DD', slotkoers). Geeft het koersblok of None."""
    punten = []
    for datum, slot in reeks or []:
        slot = _getal(slot)
        try:
            date.fromisoformat(datum)
        except (TypeError, ValueError):
            continue
        if slot is not None and slot > 0:
            punten.append((datum, round(float(slot), 4)))
    if not punten:
        return None
    punten.sort()
    laatste = punten[-1]
    sma = None
    if len(punten) >= 50:
        sma = round(sum(p[1] for p in punten[-50:]) / 50, 4)
    return {'datum': laatste[0], 'slot': laatste[1], 'sma50': sma, 'reeks': [list(p) for p in punten[-130:]]}


def maak_record(meta, *, koers=None, gegevens=None):
    ticker, naam, land, valuta, beurs = meta
    if gegevens and isinstance(gegevens.get('currencies'), list):
        # Koers en cijfers moeten in dezelfde valuta staan: zonder omrekening is vergelijken niet zinvol.
        # De notering telt dus mee; bij een verschil (Shell: cijfers in USD, koers in EUR) is de valuta niet eenduidig.
        gegevens = {**gegevens, 'currencies': sorted(set(gegevens['currencies']) | {valuta})}
    return {'ticker': ticker, 'naam': naam, 'land': land, 'valuta': valuta, 'beurs': beurs,
            'koers': koers, 'gegevens': gegevens}


def maak_bestand(records, gemaakt=None, bron=''):
    gemaakt = gemaakt or datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    return {'schema': SCHEMA, 'gemaakt': gemaakt, 'bron': bron, 'aandelen': records}


def maak_status(bestand):
    """Klein overzicht (zonder koersreeksen) om snel te zien wat er per aandeel is vastgesteld en waarom niet."""
    uit = []
    for rec in bestand.get('aandelen', []):
        g = rec.get('gegevens') or {}
        open_jaren = [{'jaar': j.get('year'), 'status': j.get('eps_check'), 'reden': str(j.get('eps_reden') or '')[:300]}
                      for j in g.get('jaren') or [] if j.get('eps_check') != 'onderbouwd']
        koers = rec.get('koers') or {}
        uit.append({'ticker': rec.get('ticker'), 'koers_datum': koers.get('datum'), 'fout': g.get('fout'),
                    'eps_status': g.get('eps_status'), 'jaren_bevestigd': g.get('eps_verified_years'),
                    'jaren_in_dossier': len(g.get('jaren') or []), 'valuta': g.get('currencies'),
                    'afgewezen_bronnen': g.get('rejected_sources'),
                    'splits': [{'datum': x.get('datum'), 'ratio': x.get('ratio'), 'status': x.get('status'),
                                'redenen': x.get('redenen')} for x in g.get('splits') or []],
                    'open_jaren': open_jaren, 'toelichting': g.get('eps_toelichting'),
                    'waarschuwingen': g.get('waarschuwingen')})
    return {'gemaakt': bestand.get('gemaakt'), 'aandelen': uit}


def schrijf(bestand, map_=UITVOER):
    map_ = Path(map_)
    map_.mkdir(parents=True, exist_ok=True)
    tekst = json.dumps(bestand, ensure_ascii=False, separators=(',', ':'))
    (map_ / 'aandelen.json').write_text(tekst, encoding='utf-8')
    # Ook als script, zodat de pagina ook zonder webserver (en zonder fetch) de gegevens kan laden.
    (map_ / 'aandelen.js').write_text('window.AANDEEL_DATA = ' + tekst + ';\n', encoding='utf-8')
    (map_ / 'status.json').write_text(json.dumps(maak_status(bestand), ensure_ascii=False, indent=1), encoding='utf-8')
    import uitleg
    uit = {'termen': [{'naam': n, 'tekst': t} for n, t in uitleg.TERMS]}
    (map_ / 'uitleg.js').write_text('window.AANDEEL_UITLEG = ' + json.dumps(uit, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')


def demo(pad_resultaat):
    """Alleen wat in een eerdere praktijkcontrole echt is gecontroleerd; de rest blijft 'nog niet gecontroleerd'."""
    resultaat = json.loads(Path(pad_resultaat).read_text(encoding='utf-8'))
    sec = resultaat.get('sec') or {}
    gecontroleerd = (resultaat.get('checked_utc') or '')[:10] or None
    gedekt = {resultaat.get('sec_ticker')}
    records = []
    for meta in CATALOGUS:
        gegevens = gegevens_uit_sec(sec, gecontroleerd) if meta[0] in gedekt else None
        records.append(maak_record(meta, gegevens=gegevens))
    return maak_bestand(records, bron='Demo: eerder gecontroleerde praktijkrun; geen koersen')


def live(email, fetch_prijzen=None, sec_samenvatting=None):
    from naic_fetch import sec_ticker_for_listing
    if sec_samenvatting is None:
        from praktijkcontrole_sec_esef import summarize_sec as sec_samenvatting
    if fetch_prijzen is None:
        fetch_prijzen = _yahoo_reeks
    vandaag = date.today().isoformat()
    records = []
    for meta in CATALOGUS:
        ticker = meta[0]
        try:
            gegevens = gegevens_uit_sec(sec_samenvatting(sec_ticker_for_listing(ticker), email), vandaag)
        except Exception as exc:  # nooit stilzwijgend een gat: de reden gaat mee
            gegevens = gegevens_uit_sec({'status': 'error', 'message': f'{type(exc).__name__}: {exc}'}, vandaag)
        try:
            koers = koers_uit_reeks(fetch_prijzen(ticker))
        except Exception:
            koers = None
        records.append(maak_record(meta, koers=koers, gegevens=gegevens))
    return maak_bestand(records, bron='SEC companyfacts en Yahoo Finance (dagkoersen)')


def _yahoo_reeks(ticker):
    import yfinance as yf
    data = yf.download(ticker, period='1y', interval='1d', auto_adjust=True, progress=False, threads=False, timeout=20)
    if hasattr(data.columns, 'get_level_values'):
        data.columns = data.columns.get_level_values(0)
    return [(idx.date().isoformat(), float(v)) for idx, v in data['Close'].dropna().items()]


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    groep = p.add_mutually_exclusive_group(required=True)
    groep.add_argument('--demo', metavar='RESULTAAT.json')
    groep.add_argument('--live', action='store_true')
    p.add_argument('--email')
    p.add_argument('--uit', default=str(UITVOER))
    args = p.parse_args(argv)
    if args.live:
        if not args.email:
            p.error('--live vraagt --email (contactadres voor de SEC)')
        bestand = live(args.email)
    else:
        bestand = demo(args.demo)
    schrijf(bestand, args.uit)
    print('Geschreven:', args.uit, '-', len(bestand['aandelen']), 'aandelen')


if __name__ == '__main__':
    main()
