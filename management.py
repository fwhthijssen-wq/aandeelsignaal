"""Feiten over het management voor het blok "Management: feiten" in de app. Alleen feiten, geen oordeel; telt nooit mee
in het NAIC-oordeel of de gezondheidscheck. Ontbreekt iets of is het onduidelijk, dan None (nooit een schatting).

Bron: Yahoo Finance. Uit de bedrijfsinfo (die de nachtelijke update al ophaalt voor het analistenadvies): de topbestuurders,
het aandelenbezit van insiders en instellingen en de governance-scores van ISS (1 = laag risico, 10 = hoog). Uit de
insidertransacties: aan- en verkopen door bestuurders in de afgelopen 12 maanden (vooral Amerikaanse fondsen).
"""
from datetime import date, datetime, timedelta, timezone

GOVERNANCE = (('auditRisk', 'audit'), ('boardRisk', 'bestuur'), ('compensationRisk', 'beloning'),
              ('shareHolderRightsRisk', 'aandeelhoudersrechten'), ('overallRisk', 'totaal'))
MAX_BESTUURDERS = 5
# Yahoo schrijft Amerikaanse transacties als 'Purchase/Sale at price …' en Britse als 'Bought/Sold at price …'.
KOOP, VERKOOP = ('purchase', 'bought', 'buy '), ('sale', 'sold', 'sell ')


def _tekst(x, n=120):
    return ' '.join(x.split())[:n] if isinstance(x, str) and x.strip() else None     # Yahoo zet soms dubbele spaties


def _pct(x):
    """Yahoo geeft bezit als fractie (0.024 = 2,4%). Alleen 0..1 is geldig."""
    if isinstance(x, (int, float)) and not isinstance(x, bool) and x == x and 0 <= x <= 1:
        return round(x * 100, 2)
    return None


def _is_ceo(titel):
    t = (titel or '').lower()
    return 'ceo' in t.replace('.', '') or 'chief executive' in t


def management_uit_info(info, vandaag):
    """Geeft {'ceo', 'bestuurders', 'bezit_insiders_pct', 'bezit_instellingen_pct', 'governance', 'datum', 'bron'} of None."""
    if not isinstance(info, dict):
        return None
    bestuurders = []
    for o in info.get('companyOfficers') or []:
        if not isinstance(o, dict):
            continue
        naam, titel = _tekst(o.get('name')), _tekst(o.get('title'))
        if naam and titel:
            b = {'naam': naam, 'functie': titel}
            jaar = o.get('yearBorn')
            if isinstance(jaar, int) and not isinstance(jaar, bool) and 1900 < jaar < 2010:
                b['geboren'] = jaar
            bestuurders.append(b)
    ceo = next((b for b in bestuurders if _is_ceo(b['functie'])), None)
    gov = {}
    for veld, naam in GOVERNANCE:
        v = info.get(veld)
        if isinstance(v, (int, float)) and not isinstance(v, bool) and 1 <= v <= 10:
            gov[naam] = int(v)
    gdatum = info.get('governanceEpochDate')
    if gov and isinstance(gdatum, (int, float)) and gdatum > 0:
        try:
            gov['datum'] = datetime.fromtimestamp(gdatum, tz=timezone.utc).date().isoformat()
        except (OverflowError, OSError, ValueError):
            pass
    uit = {'ceo': ceo, 'bestuurders': bestuurders[:MAX_BESTUURDERS],
           'bezit_insiders_pct': _pct(info.get('heldPercentInsiders')),
           'bezit_instellingen_pct': _pct(info.get('heldPercentInstitutions')),
           'governance': gov or None}
    if not any(uit[k] for k in uit):
        return None
    uit.update({'datum': vandaag, 'bron': 'Yahoo Finance'})
    return uit


def _dag(x):
    try:
        if hasattr(x, 'date'):
            return x.date() if callable(x.date) else x.date
        return date.fromisoformat(str(x)[:10])
    except (TypeError, ValueError):
        return None


def insiders_uit_transacties(rijen, vandaag, maanden=12):
    """rijen: [{'Text', 'Start Date', 'Shares', 'Insider'}, ...] uit Yahoo. Telt alleen echte aan- en verkopen op de beurs
    ('Purchase/Bought at price …', 'Sale/Sold at price …'); toekenningen, schenkingen en uitoefening van opties tellen niet.
    Geeft {'aankopen', 'verkopen', 'aandelen_gekocht', 'aandelen_verkocht', 'personen_gekocht', 'personen_verkocht',
    'van', 'tot', 'bron'} of None als er geen bruikbare gegevens zijn."""
    if not rijen:
        return None
    tot = _dag(vandaag)
    if tot is None:
        return None
    van = tot - timedelta(days=int(30.44 * maanden))
    uit = {'aankopen': 0, 'verkopen': 0, 'aandelen_gekocht': 0, 'aandelen_verkocht': 0}
    kopers, verkopers, bruikbaar = set(), set(), 0
    for r in rijen:
        if not isinstance(r, dict):
            continue
        d = _dag(r.get('Start Date'))
        tekst = str(r.get('Text') or '').strip().lower()
        if d is None or not tekst:
            continue
        bruikbaar += 1
        if not (van <= d <= tot):
            continue
        n = r.get('Shares')
        n = int(n) if isinstance(n, (int, float)) and not isinstance(n, bool) and n == n and n > 0 else 0
        wie = str(r.get('Insider') or '').strip()
        if tekst.startswith(KOOP):
            uit['aankopen'] += 1; uit['aandelen_gekocht'] += n; kopers.add(wie)
        elif tekst.startswith(VERKOOP):
            uit['verkopen'] += 1; uit['aandelen_verkocht'] += n; verkopers.add(wie)
    if not bruikbaar:
        return None          # Yahoo heeft voor dit fonds geen transacties: onbekend, niet "nul"
    uit.update({'personen_gekocht': len(kopers - {''}), 'personen_verkocht': len(verkopers - {''}),
                'van': van.isoformat(), 'tot': tot.isoformat(), 'bron': 'Yahoo Finance (insidertransacties)'})
    return uit


def yahoo_insiders(ticker):
    """Insidertransacties van Yahoo als lijst van dicts; leeg als er niets is."""
    import yfinance as yf
    df = yf.Ticker(ticker).insider_transactions
    if df is None or getattr(df, 'empty', True):
        return []
    return df.to_dict('records')
