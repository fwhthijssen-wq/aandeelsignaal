"""Indicatieve jaarcijfers uit Yahoo Finance, alleen voor bedrijven waarvoor geen officiële bron beschikbaar is.

Deze cijfers zijn niet onafhankelijk nagerekend. Ze krijgen daarom nooit het label-slot, hebben een eigen niveau
('indicatief') met een lager gewicht in het totaalbeeld, en elk twijfelgeval wordt weggelaten in plaats van geschat.
"""
from datetime import date

from boekjaar import boekjaar

# Yahoo-rijnaam -> veld in het jaarblok van de app. Teken: de app gebruikt positieve bedragen voor uitgaven.
VELDEN = {
    'sales': ('TotalRevenue', 1), 'net_income': ('NetIncomeCommonStockholders', 1), 'reported_eps': ('DilutedEPS', 1),
    'operating_cash_flow': ('OperatingCashFlow', 1), 'capex': ('CapitalExpenditure', 1), 'equity': ('StockholdersEquity', 1),
    'pretax_income': ('PretaxIncome', 1), 'depreciation': ('DepreciationAndAmortization', 1), 'dividends_paid': ('CashDividendsPaid', -1),
    'long_term_debt': ('LongTermDebt', 1), 'total_assets': ('TotalAssets', 1), 'current_assets': ('CurrentAssets', 1),
    'current_liabilities': ('CurrentLiabilities', 1), 'total_liabilities': ('TotalLiabilitiesNetMinorityInterest', 1),
    'retained_earnings': ('RetainedEarnings', 1), 'cash': ('CashAndCashEquivalents', 1), 'gross_profit': ('GrossProfit', 1),
    'operating_income': ('OperatingIncome', 1), 'interest_expense': ('InterestExpense', 1), 'shares_diluted': ('DilutedAverageShares', 1),
}
MIN_JAREN = 4


def _getal(x):
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return v if v == v and abs(v) != float('inf') else None


def _iso(k):
    try:
        return k.date().isoformat() if hasattr(k, 'date') else date.fromisoformat(str(k)[:10]).isoformat()
    except (TypeError, ValueError):
        return None


def frame_naar_dict(frame):
    """pandas-DataFrame (rijen = posten, kolommen = boekjaareinden) naar {post: {iso_einddatum: waarde}}."""
    uit = {}
    try:
        for post in frame.index:
            rij = {}
            for kolom in frame.columns:
                d, v = _iso(kolom), _getal(frame.loc[post, kolom])
                if d and v is not None:
                    rij[d] = v
            uit[str(post)] = rij
    except Exception:
        return {}
    return uit


def haal_yahoo(ticker):
    """Haalt de ruwe jaargegevens op (netwerk). Geeft {'posten': {...}, 'valuta': str|None, 'bank': bool, 'splits': [(datum, ratio)]} of None."""
    import yfinance as yf
    t = yf.Ticker(ticker)
    posten = {}
    for naam in ('get_income_stmt', 'get_balance_sheet', 'get_cashflow'):
        try:
            posten.update(frame_naar_dict(getattr(t, naam)(freq='yearly')))
        except Exception:
            continue
    if not posten:
        return None
    info = {}
    try:
        info = t.get_info() or {}
    except Exception:
        info = {}
    splits = []
    try:
        for idx, v in t.splits.items():
            if _getal(v) and _iso(idx):
                splits.append((_iso(idx), float(v)))
    except Exception:
        pass
    bank = 'bank' in str(info.get('industry') or '').lower()
    return {'posten': posten, 'valuta': info.get('financialCurrency'), 'bank': bank, 'splits': splits}


def jaren_uit_yahoo(ruw):
    """Zet de ruwe posten om naar jaarregels. Alleen boekjaren met omzet en nettowinst; twijfelachtige winst per aandeel vervalt."""
    posten = ruw.get('posten') or {}
    einden = sorted({d for p in ('TotalRevenue', 'NetIncomeCommonStockholders') for d in (posten.get(p) or {})
                     if d in (posten.get('TotalRevenue') or {}) and d in (posten.get('NetIncomeCommonStockholders') or {})})
    jaren = []
    for d in einden:
        rij = {'year': boekjaar(d), 'end': d, 'currency': ruw.get('valuta'),
               'eps_check': None, 'eps_reden': 'Yahoo Finance: niet nagerekend'}
        for veld, (post, teken) in VELDEN.items():
            v = (posten.get(post) or {}).get(d)
            rij[veld] = None if v is None else (abs(v) if veld in ('capex', 'dividends_paid', 'interest_expense') else v * teken)
        rij['comparable_eps'] = rij['reported_eps']
        jaren.append(rij)
    jaren = jaren[-10:]
    # Splitsingen: Yahoo meldt de winst per aandeel niet altijd op dezelfde basis. Vóór een splitsing is de EPS niet vergelijkbaar.
    for j in jaren:
        for sd, ratio in ruw.get('splits') or []:
            if sd > j['end'] and abs(ratio - 1) > 1e-9:
                j['comparable_eps'] = None
    # Sprongen in de EPS die niet bij de winst passen wijzen op een niet-gecorrigeerde splitsing of een ander aantal aandelen.
    for i in range(1, len(jaren)):
        a, b = jaren[i - 1], jaren[i]
        if None not in (a['comparable_eps'], b['comparable_eps'], a['net_income'], b['net_income']) and a['net_income'] > 0 and b['net_income'] > 0 and a['comparable_eps'] > 0 and b['comparable_eps'] > 0:
            verschil = (b['comparable_eps'] / a['comparable_eps']) / (b['net_income'] / a['net_income'])
            if not 0.6 <= verschil <= 1.6:
                for j in jaren[:i]:
                    j['comparable_eps'] = None
    return jaren


def gegevens_uit_yahoo(ruw, gecontroleerd_op):
    """Gegevensblok voor de app. Geeft een blok met `fout` als er te weinig bruikbare jaren zijn."""
    leeg = {'gecontroleerd_op': gecontroleerd_op, 'eps_status': None, 'eps_verified_years': None, 'currencies': None,
            'rejected_sources': None, 'jaren': [], 'splits': [], 'waarschuwingen': []}
    if not ruw:
        return dict(leeg, fout='Ook bij Yahoo Finance zijn geen jaarcijfers gevonden.')
    jaren = jaren_uit_yahoo(ruw)
    if len(jaren) < MIN_JAREN:
        return dict(leeg, fout=f'Yahoo Finance geeft maar {len(jaren)} bruikbare boekjaren (minimaal {MIN_JAREN}).')
    waarschuwingen = ['Jaarcijfers van Yahoo Finance: niet onafhankelijk nagerekend, daarom indicatief.']
    if ruw.get('bank'):
        waarschuwingen.append('Bank: kengetallen zoals schuld en kasstroom zeggen bij banken weinig.')
    return {'gecontroleerd_op': gecontroleerd_op, 'fout': None, 'niveau': 'indicatief', 'bron': 'Yahoo Finance',
            'eps_status': None, 'eps_verified_years': 0, 'currencies': [ruw['valuta']] if ruw.get('valuta') else None,
            'rejected_sources': 0, 'jaren': jaren, 'splits': [], 'waarschuwingen': waarschuwingen}


def vergelijk(yahoo_jaren, officiele_jaren):
    """Per veld: hoeveel jaren zijn vergeleken en hoeveel liggen binnen 1% en 5% van de officiële waarde (gelijke jaareinde, ±10 dagen)."""
    uit = {}
    for v in ('sales', 'net_income', 'reported_eps', 'operating_cash_flow', 'equity'):
        n = b1 = b5 = 0
        for y in yahoo_jaren:
            for o in officiele_jaren:
                try:
                    dichtbij = abs((date.fromisoformat(y['end']) - date.fromisoformat(o['end'])).days) <= 10
                except (TypeError, ValueError, KeyError):
                    continue
                if not dichtbij:
                    continue
                a, b = _getal(y.get(v)), _getal(o.get(v))
                if a is None or b is None or b == 0:
                    continue
                n += 1
                afw = abs(a - b) / abs(b)
                b1 += afw <= 0.01
                b5 += afw <= 0.05
                break
        uit[v] = {'vergeleken': n, 'binnen_1pct': b1, 'binnen_5pct': b5}
    return uit


def samenvoegen(totaal, deel):
    for v, x in deel.items():
        t = totaal.setdefault(v, {'vergeleken': 0, 'binnen_1pct': 0, 'binnen_5pct': 0})
        for k in t:
            t[k] += x[k]
    return totaal
