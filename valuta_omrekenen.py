"""Jaarcijfers omrekenen naar de valuta van de notering (ECB-jaargemiddelden).

Sommige bedrijven rapporteren in een andere valuta dan waarin hun aandeel op de beurs noteert: HSBC, Rio Tinto, IHG en
Prudential in dollars met een notering in ponden; ArcelorMittal en STMicroelectronics in dollars met een notering in euro.
Zonder omrekening kan de app geen K/W en geen NAIC-koerszones berekenen. De controle van de cijfers (narekening, label)
gebeurt altijd in de oorspronkelijke valuta; pas daarna wordt per boekjaar omgerekend met het ECB-jaargemiddelde van het
kalenderjaar waarin het boekjaar eindigt. Elk omgerekend jaar houdt de koers en de oorspronkelijke valuta bij, en de
omrekening is terug te draaien (voor hergebruik in de volgende run)."""
import csv, io, json, time, urllib.request
from datetime import date
from pathlib import Path

HIER = Path(__file__).resolve().parent
BESTAND = HIER / 'ecb_jaargemiddelden.json'
MUNTEN = ('USD', 'GBP', 'CAD', 'JPY', 'CHF', 'DKK', 'SEK', 'NOK', 'AUD', 'HKD', 'SGD', 'KRW', 'INR', 'BRL', 'MXN', 'ZAR', 'ILS')
YAHOO_MUNTEN = ('TWD', 'PEN', 'COP', 'CLP')      # niet bij de ECB: jaargemiddelde van de dagkoersen bij Yahoo (EURxxx=X)
PER_AANDEEL = ('comparable_eps', 'reported_eps', 'eps_gewoon', 'dividend_ps')
BEDRAGEN = ('sales', 'net_income', 'operating_cash_flow', 'capex', 'equity', 'pretax_income', 'depreciation', 'dividends_paid',
            'long_term_debt', 'total_assets', 'current_assets', 'current_liabilities', 'total_liabilities', 'retained_earnings',
            'cash', 'gross_profit', 'operating_income', 'interest_expense', 'rd_expense', 'selling_expense', 'sga_expense')


def _getal(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and x == x and abs(x) != float('inf')


def ophalen(pogingen=3):
    """{munt: {jaar: euro per eenheid}} van de ECB: jaargemiddelden vanaf 2005, en voor het lopende jaar het gemiddelde
    van de dagkoersen tot nu. None als de ECB niet bereikbaar is."""
    lijst = '+'.join(MUNTEN)
    for i in range(pogingen):
        try:
            uit = {}
            for freq, start in (('A', '2005'), ('D', f'{date.today().year}-01-01')):
                url = f'https://data-api.ecb.europa.eu/service/data/EXR/{freq}.{lijst}.EUR.SP00.A?startPeriod={start}&format=csvdata'
                with urllib.request.urlopen(urllib.request.Request(url, headers={'Accept': 'text/csv'}), timeout=60) as r:
                    rijen = list(csv.DictReader(io.StringIO(r.read().decode('utf-8'))))
                som = {}
                for x in rijen:
                    m, p, w = x.get('CURRENCY'), x.get('TIME_PERIOD') or '', x.get('OBS_VALUE')
                    if m in MUNTEN and w:
                        if freq == 'A':
                            uit.setdefault(m, {})[p[:4]] = round(1 / float(w), 8)
                        else:
                            som.setdefault(m, []).append(float(w))
                for m, ws in som.items():
                    jaar = str(date.today().year)
                    if jaar not in uit.get(m, {}) and ws:
                        uit.setdefault(m, {})[jaar] = round(1 / (sum(ws) / len(ws)), 8)
            if all(m in uit for m in ('USD', 'GBP')):
                uit.update(yahoo_jaren())
                return uit
        except Exception:
            time.sleep(10 * (i + 1))
    return None


def yahoo_jaren():
    """{munt: {jaar: euro per eenheid}} voor munten die de ECB niet publiceert; leeg als Yahoo niet bereikbaar is."""
    uit = {}
    try:
        import yfinance as yf
    except ImportError:
        return uit
    for m in YAHOO_MUNTEN:
        try:
            h = yf.Ticker(f'EUR{m}=X').history(start='2005-01-01', interval='1d', auto_adjust=False)
            per = {}
            for i, v in h['Close'].dropna().items():
                if v > 0:
                    per.setdefault(str(i.year), []).append(float(v))
            jaren = {j: round(1 / (sum(w) / len(w)), 8) for j, w in per.items() if len(w) >= 20}
            if jaren:
                uit[m] = jaren
        except Exception:
            continue
    return uit


def laad():
    try:
        return json.loads(BESTAND.read_text(encoding='utf-8')).get('eur_per') or {}
    except (OSError, ValueError):
        return {}


def _koers(koersen, van, naar, jaar):
    """Eenheden `naar` per eenheid `van` in dit jaar (via de euro). Ontbreekt het jaar, dan het dichtstbijzijnde jaar."""
    def eur(m):
        if m == 'EUR':
            return 1.0
        reeks = koersen.get(m) or {}
        if not reeks:
            return None
        if str(jaar) in reeks:
            return reeks[str(jaar)]
        dichtst = min(reeks, key=lambda j: abs(int(j) - int(jaar)))
        return reeks[dichtst] if abs(int(dichtst) - int(jaar)) <= 1 else None
    a, b = eur(van), eur(naar)
    return a / b if a and b else None


def terug(g):
    """Draait een eerdere omrekening terug, zodat controles weer in de oorspronkelijke valuta rekenen."""
    if not isinstance(g, dict) or not g.get('omrekening'):
        return g
    for j in g.get('jaren') or []:
        o = j.pop('omgerekend', None)
        if not o or not o.get('koers'):
            continue
        for v in PER_AANDEEL + BEDRAGEN:
            if _getal(j.get(v)):
                j[v] = round(j[v] / o['koers'], 6 if v in PER_AANDEEL else 0)
        j['currency'] = o['van']
    g['currencies'] = g['omrekening'].get('currencies_was') or g.get('currencies')
    g.pop('omrekening', None)
    return g


def omrekenen(g, naar, koersen=None):
    """Rekent alle jaren in één andere valuta om naar `naar` (de valuta van de notering). Niets als de jaarcijfers al in die
    valuta staan, in meer dan één valuta, of als de koersen ontbreken."""
    if not isinstance(g, dict) or not g.get('jaren') or not naar or g.get('omrekening'):
        return g
    jaren = g['jaren']
    munten = {j.get('currency') for j in jaren if j.get('currency')}
    if len(munten) != 1:
        return g
    van = munten.pop()
    if van == naar:
        return g
    koersen = koersen if koersen is not None else laad()
    per_jaar = {}
    for j in jaren:
        jaar = str(j.get('end') or '')[:4] or str(j.get('year'))
        k = _koers(koersen, van, naar, jaar)
        if not k:
            return g                                  # niet voor alle jaren een koers: liever niet omrekenen dan half
        per_jaar[id(j)] = (jaar, k)
    for j in jaren:
        jaar, k = per_jaar[id(j)]
        for v in PER_AANDEEL + BEDRAGEN:
            if _getal(j.get(v)):
                j[v] = round(j[v] * k, 6 if v in PER_AANDEEL else 0)
        j['currency'] = naar
        j['omgerekend'] = {'van': van, 'koers': round(k, 10), 'jaar': jaar}
    g['omrekening'] = {'van': van, 'naar': naar, 'currencies_was': g.get('currencies'),
                       'uitleg': f'Het bedrijf rapporteert in {van}; de aandelen noteren in {naar}. De jaarcijfers zijn per boekjaar '
                                 f'omgerekend met het ECB-jaargemiddelde. De controle van de cijfers gebeurde in {van}.'}
    g['currencies'] = [naar]
    return g


if __name__ == '__main__':
    k = ophalen()
    if not k:
        raise SystemExit('ECB niet bereikbaar')
    BESTAND.write_text(json.dumps({'bron': 'ECB-referentiekoersen, jaargemiddelden (euro per eenheid)', 'gemaakt': date.today().isoformat(), 'eur_per': k}, indent=1, sort_keys=True), encoding='utf-8')
    print('geschreven:', {m: len(v) for m, v in k.items()})
