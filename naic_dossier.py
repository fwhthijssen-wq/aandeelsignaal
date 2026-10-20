"""Conservatief NAIC-onderzoeksdossier uit reeds opgehaalde SEC-jaarhistorie.

Geen nieuwe bronrequests, geen fictieve cijfers, geen automatische beleggingssignalen.
"""
from boekjaar import boekjaar
from datetime import date
from collections import Counter
from math import isfinite
from esef_import import is_currency_code


def _number(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and isfinite(v)


def _value(row, key):
    fact = row.get('facts', {}).get(key)
    v = fact.get('val') if isinstance(fact, dict) else None
    return v if _number(v) else None


def _growth(old, new, years):
    if old is None or new is None or old <= 0 or new <= 0 or years <= 0:
        return None
    return round(((new / old) ** (1 / years) - 1) * 100, 2)


def build_dossier(history, ticker, normalized=None, *, source="SEC", sector=None):
    normalized = normalized or {}
    rows = []
    # A dossier may receive rows from either source. Never choose an arbitrary
    # duplicate period: the upstream merger must resolve it first.
    valid_ends = []
    for h in history:
        try:
            valid_ends.append(date.fromisoformat(h['end']))
        except (KeyError, TypeError, ValueError):
            pass
    duplicate_ends = {end for end, count in Counter(valid_ends).items() if count > 1}
    rejected_duplicates = bool(duplicate_ends)
    for h in history:
        try:
            end = date.fromisoformat(h['end'])
        except (KeyError, TypeError, ValueError):
            continue
        if end in duplicate_ends:
            continue
        unit = h.get('unit')
        if not is_currency_code(unit):
            continue
        # Independently enforce the unit of each financial fact. The parser's
        # protection must also hold when a dossier is built from another source.
        checked = dict(h)
        checked['facts'] = {}
        for concept, fact in (h.get('facts') or {}).items():
            if not isinstance(fact, dict):
                continue
            expected = unit + ('/shares' if concept == 'Winst per aandeel (verwaterd)' else '')
            if fact.get('unit') is not None and fact['unit'] != expected:
                continue
            if fact.get('end') is not None and fact['end'] != h['end']:
                continue
            if concept == 'Eigen vermogen' and fact.get('start') is not None:
                continue
            checked['facts'][concept] = fact
        h = checked
        sales = _value(h, 'Omzet')
        profit = _value(h, 'Nettowinst')
        cash = _value(h, 'Operationele kasstroom')
        capex = _value(h, 'Investeringen in vaste activa')
        equity = _value(h, 'Eigen vermogen')
        # Raw reported EPS is useful for auditing, but is not split-adjusted EPS.
        reported_eps = _value(h, 'Winst per aandeel (verwaterd)')
        parent_profit = _value(h, 'Winst toerekenbaar aan aandeelhouders')
        eps_info = normalized.get(h['end'], {})
        eps = eps_info.get('EPS vergelijkbaar')
        rows.append({'year': boekjaar(end), 'end': end, 'currency': unit, 'sales': sales,
                     'profit': profit, 'parent_profit': parent_profit, 'reported_eps': reported_eps,
                     'cash': cash, 'capex': capex, 'equity': equity,
                     'eps': eps if _number(eps) else None,
                     'eps_status': eps_info.get('Status', 'Niet beoordeeld'),
                     'accounting_basis': h.get('accounting_basis')})
    rows.sort(key=lambda r: r['end'])
    if not rows:
        message = f'Geen volledige {source}-jaarhistorie beschikbaar.'
        if rejected_duplicates:
            message += ' Dubbele boekjaareindes zijn geweigerd.'
        return {'ticker': ticker, 'rows': [], 'metrics': [], 'warnings': [message], 'ready': False}
    current = rows[-1]
    warnings = [f'{source}-jaarfeiten zijn nog niet onafhankelijk gecontroleerd tegen de originele jaarverslagen.']
    if rejected_duplicates:
        warnings.append('Dubbele boekjaareindes geweigerd: controleer bronconflicten voordat groeicijfers worden gebruikt.')
    is_bank = sector == 'bank' if sector is not None else ticker.upper() in ('ING', 'INGA.AS', 'JPM', 'JPM.US')
    known_bases = {r['accounting_basis'] for r in rows if r.get('accounting_basis')}
    if len(known_bases) > 1:
        warnings.append('Meerdere verslaggevingsgrondslagen; historische groei niet zonder reconciliatie vergelijken.')
    elif known_bases and any(not r.get('accounting_basis') for r in rows):
        warnings.append('Verslaggevingsgrondslag niet voor alle jaren vastgesteld; groei over deze jaren geblokkeerd.')

    def same_verified_basis(a, b):
        # Unknown accounting bases never establish comparability, including
        # when both sides are unknown. This must match naic_growth.py.
        first, second = a.get('accounting_basis'), b.get('accounting_basis')
        return bool(first and second and first == second)
    if len({r['currency'] for r in rows}) > 1:
        warnings.append('Verschillende valuta gevonden; groeicijfers alleen binnen dezelfde valuta vergelijken.')
    if is_bank:
        warnings.append('Bank: kasstroom, investeringen en winstmarge vragen sectorspecifieke interpretatie.')
    metrics = []
    for name, key in [('Omzet', 'sales'), ('Nettowinst', 'profit')]:
        value = current[key]
        metrics.append({'Indicator': f'{name} laatste boekjaar (mld {current["currency"]})',
                        'Waarde': round(value / 1e9, 3) if value is not None else None,
                        'Toelichting': f'Boekjaar eindigend {current["end"]}; {source}-kandidaat'})
        previous = next((r for r in reversed(rows[:-1]) if r['year'] == current['year'] - 5
                         and r['currency'] == current['currency']
                         and same_verified_basis(r, current)
                         and abs((current['end'] - r['end']).days - 5 * 365.2425) <= 45), None)
        growth = _growth(previous[key], value, 5) if previous else None
        metrics.append({'Indicator': f'{name}groei over 5 jaar (% p.j.)', 'Waarde': growth,
                        'Toelichting': 'Alleen echte vijfjaarsafstand; geen schatting' if growth is not None else 'Onvoldoende vergelijkbare gegevens'})
    # Show unadjusted IFRS/US-GAAP diluted EPS separately from verified comparable EPS.
    metrics.append({'Indicator': f'Gerapporteerde verwaterde EPS ({current["currency"]} per aandeel)',
                    'Waarde': current['reported_eps'],
                    'Toelichting': 'Onbewerkte bronwaarde; niet gecorrigeerd voor aandelensplitsingen'})
    metrics.append({'Indicator': f'Winst toerekenbaar aan aandeelhouders (mld {current["currency"]})',
                    'Waarde': round(current['parent_profit'] / 1e9, 3) if current['parent_profit'] is not None else None,
                    'Toelichting': 'Afzonderlijk van geconsolideerde nettowinst; ontbrekend is onbekend'})
    # EPS blijft bron-afhankelijk: toon de kandidaat en de historische vijfjaarsgroei
    # uitsluitend als voorlopige berekening, nooit als goedgekeurd koerssignaal.
    metrics.append({'Indicator': f'EPS laatste boekjaar ({current["currency"]} per aandeel)',
                    'Waarde': current['eps'],
                    'Toelichting': current['eps_status'] + '; niet goedgekeurd voor automatisch beleggingsadvies'})
    previous_eps = next((r for r in reversed(rows[:-1]) if r['year'] == current['year'] - 5
                         and r['currency'] == current['currency']
                         and same_verified_basis(r, current)
                         and abs((current['end'] - r['end']).days - 5 * 365.2425) <= 45), None)
    eps_growth = _growth(previous_eps['eps'], current['eps'], 5) if previous_eps else None
    metrics.append({'Indicator': 'EPS-groei over 5 jaar (% p.j., voorlopig)',
                    'Waarde': eps_growth,
                    'Toelichting': ('Voorlopig: aandelenbasis nog verifiëren' if eps_growth is not None
                                    else 'Geen vergelijkbare EPS-reeks vastgesteld')})
    margin = (100 * current['profit'] / current['sales'] if current['profit'] is not None
              and current['sales'] is not None and current['sales'] > 0 else None)
    metrics.append({'Indicator': 'Nettowinstmarge laatste jaar (%)', 'Waarde': round(margin, 2) if margin is not None else None,
                    'Toelichting': 'Nettowinst / omzet; definitie controleren'})
    prior = next((r for r in reversed(rows[:-1]) if r['year'] == current['year'] - 1
                  and r['currency'] == current['currency']
                  and same_verified_basis(r, current)), None)
    roe = (200 * current['profit'] / (current['equity'] + prior['equity'])
           if prior and current['profit'] is not None and current['equity'] is not None
           and prior['equity'] is not None and current['equity'] + prior['equity'] > 0 else None)
    metrics.append({'Indicator': 'ROE laatste jaar (%)', 'Waarde': round(roe, 2) if roe is not None else None,
                    'Toelichting': 'Winst / gemiddeld eigen vermogen; geen balansbegin = geen ROE'})
    if not is_bank:
        fcf = current['cash'] - current['capex'] if current['cash'] is not None and current['capex'] is not None else None
        metrics.append({'Indicator': f'Indicatieve vrije kasstroom (mld {current["currency"]})',
                        'Waarde': round(fcf / 1e9, 3) if fcf is not None else None,
                        'Toelichting': 'Operationele kasstroom minus materiële investeringen; definities nog te verifiëren'})
    if current['parent_profit'] is None:
        warnings.append('Winst toerekenbaar aan aandeelhouders ontbreekt; geconsolideerde winst is geen vervanging.')
    if current['eps'] is None:
        warnings.append('EPS niet splitsingsvergelijkbaar vastgesteld: geen automatische EPS-groei of waardering.')
    else:
        warnings.append('EPS is voorlopig genormaliseerd; geen automatisch koersdoel zonder inhoudelijke verificatie.')
    if current['cash'] is None:
        warnings.append(f'Operationele kasstroom laatste boekjaar ontbreekt in deze {source}-reeks.')
    return {'ticker': ticker, 'year': current['year'], 'currency': current['currency'],
            'rows': rows, 'metrics': metrics, 'warnings': warnings, 'ready': False}
