"""Generieke SEC XBRL-verificatie met consistente verslagperioden.

De gegevens zijn diagnostisch: geen effect op de bestaande score.
"""
import json
from collections import defaultdict
from datetime import date
from urllib.request import Request, urlopen
from source_validation import status, visible_quarters, report_quality

CIK_MAP_URL = 'https://www.sec.gov/files/company_tickers.json'
FACTS_URL = 'https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json'
from concept_registry import CONCEPT_TAGS as TAGS, MONETARY_UNITS



def fetch_json(url, email, opener=urlopen):
    if not email or '@' not in email or '\n' in email or '\r' in email:
        raise ValueError('Vul een geldig contact-e-mailadres in voor SEC-toegang.')
    req = Request(url, headers={'User-Agent': f'AandeelSignaal Research {email}',
                                'Accept': 'application/json', 'Accept-Encoding': 'identity'})
    with opener(req, timeout=15) as resp:
        return json.load(resp)


# Na een holdingreorganisatie wijst de SEC-tickerlijst naar de nieuwe holding (met alleen kwartaalcijfers), terwijl de
# jaarverslagen bij de oorspronkelijke registrant blijven staan. XOM: ExxonMobil Holdings Corp (CIK 2115436) heeft sinds
# 2026 alleen 10-Q's; de 10-K's tot en met boekjaar 2025 staan bij Exxon Mobil Corp (CIK 34088).
CIK_VOORGANGER = {'XOM': (34088, 'Exxon Mobil Corp')}


def cik_for_ticker(ticker, directory):
    base = ticker.upper().split('.')[0]
    if base in CIK_VOORGANGER:
        return CIK_VOORGANGER[base]
    for item in directory.values():
        if str(item.get('ticker', '')).upper() == base:
            return int(item['cik_str']), item.get('title', base)
    return None, None


def duration_days(row):
    try:
        return (date.fromisoformat(row['end']) - date.fromisoformat(row['start'])).days + 1
    except (ValueError, TypeError, KeyError):
        return None


def classify_period(row):
    days = duration_days(row)
    if days is None:
        return 'momentopname'
    if 65 <= days <= 115:
        return 'kwartaal'
    if 150 <= days <= 210:
        return 'halfjaar cumulatief'
    if 240 <= days <= 310:
        return 'negen maanden cumulatief'
    if 330 <= days <= 390:
        return 'boekjaar'
    return f'onbekende periode ({days} dagen)'


def candidates_for(payload, tags, asof):
    """Alle toegestane duration-feiten, inclusief oudere alternatieve tags."""
    candidates = []
    for namespace in ('us-gaap', 'ifrs-full'):
        catalog = payload.get('facts', {}).get(namespace, {})
        for tag_rank, tag in enumerate(tags):
            unitsets = catalog.get(tag, {}).get('units', {})
            for unit in MONETARY_UNITS:
                for row in unitsets.get(unit, []):
                    if (row.get('filed', '9999-99-99') <= asof
                            and row.get('end', '9999-99-99') <= asof
                            and row.get('form') in ('10-Q', '10-K', '20-F', '40-F')
                            and isinstance(row.get('val'), (int, float))
                            and duration_days(row) is not None):
                        candidates.append(dict(row, tag=tag, namespace=namespace, unit=unit,
                                               period_type=classify_period(row), tag_rank=tag_rank))
    return candidates


def choose_fact(payload, tags, asof):
    """Compatibele functie voor afzonderlijke veldcontrole."""
    rows = candidates_for(payload, tags, asof)
    if not rows:
        # Legacy diagnostische selector: accepteer feiten zonder startdatum,
        # maar aligned_facts zal deze nooit in een gezamenlijke periode opnemen.
        for tag in tags:
            for row in payload.get('facts', {}).get('us-gaap', {}).get(tag, {}).get('units', {}).get('USD', []):
                if (row.get('start') is None and row.get('end', '9999-99-99') <= asof
                        and row.get('filed', '9999-99-99') <= asof
                        and row.get('form') in ('10-Q', '10-K')
                        and isinstance(row.get('val'), (int, float))):
                    rows.append(row)
    return max(rows, key=lambda r: (r['end'], r['filed'], -r.get('tag_rank', 0))) if rows else None


def aligned_facts(payload, asof):
    """Selecteer één gedeelde start/einddatum en valuta, niet per veld een andere periode.

    De meest recente periode met de meeste beschikbare kernbegrippen wint.
    Ontbrekende begrippen blijven expliciet leeg; geen historische opvulling.
    """
    pool = {name: candidates_for(payload, tags, asof) for name, tags in TAGS.items()}
    grouped = defaultdict(dict)
    for name, rows in pool.items():
        for row in rows:
            key = (row['start'], row['end'], row['unit'])
            old = grouped[key].get(name)
            if old is None or (row['filed'], -row['tag_rank']) > (old['filed'], -old['tag_rank']):
                grouped[key][name] = row
    if not grouped:
        return {'period': None, 'facts': {name: None for name in TAGS},
                'warning': 'Geen vergelijkbare SEC-verslagperioden gevonden.'}
    # Geef voorrang aan recente perioden; kies binnen dezelfde einddatum de
    # periode met de meeste kernbegrippen, en dan de meest complete periode.
    key = max(grouped, key=lambda k: (k[1], sum(name in grouped[k] for name in TAGS),
                                      sum(name in grouped[k] for name in ('Omzet', 'Nettowinst', 'Operationele kasstroom')),
                                      k[0]))
    selected = grouped[key]
    return {'period': {'start': key[0], 'end': key[1], 'unit': key[2],
                       'type': classify_period({'start': key[0], 'end': key[1]})},
            'facts': {name: selected.get(name) for name in TAGS},
            'warning': ('Ontbrekende begrippen zijn bewust niet aangevuld met cijfers '
                        'uit andere verslagperioden.')}


def derived_periods(payload, asof, period):
    """Leid alleen bedragen af uit exact aansluitende perioden van dezelfde XBRL-tag.

    Een los kwartaal kan uit YTD minus eerder YTD volgen als beide dezelfde
    startdatum hebben en de oudere einddatum direct vóór het doelkwartaal ligt.
    Een TTM kan uit FY + huidig YTD - vorig YTD volgen met dezelfde tag/valuta,
    mits de jaargrenzen en YTD-lengtes aansluiten. Geen schatting of extrapolatie.
    """
    if not period:
        return {}
    from datetime import timedelta
    result = {}
    target_start = date.fromisoformat(period['start'])
    target_end = date.fromisoformat(period['end'])
    for name, tags in TAGS.items():
        rows = candidates_for(payload, tags, asof)
        # Identieke concepttag en valuta zijn essentieel: geen mix van definities.
        groups = defaultdict(list)
        for r in rows:
            if r['unit'] == period['unit']:
                groups[(r['namespace'], r['tag'])].append(r)
        derived = None
        for (namespace, tag), candidates in groups.items():
            for full in candidates:
                if date.fromisoformat(full['end']) != target_end:
                    continue
                if date.fromisoformat(full['start']) >= target_start:
                    continue
                for previous in candidates:
                    if previous['start'] != full['start']:
                        continue
                    prev_end = date.fromisoformat(previous['end'])
                    if prev_end + timedelta(days=1) != target_start:
                        continue
                    if not (65 <= (target_end-target_start).days+1 <= 115):
                        continue
                    derived = {'val': full['val']-previous['val'],
                               'unit': full['unit'], 'start': period['start'],
                               'end': period['end'], 'namespace': namespace, 'tag': tag,
                               'method': 'cumulatief minus voorgaand cumulatief',
                               'inputs': (full, previous)}
                    break
                if derived:
                    break
            if derived:
                break
        if derived:
            result[name] = derived
    return result


def ttm_from_fiscal_year(payload, asof, period):
    """TTM = FY + YTD huidig - YTD vorig; alleen bij sluitende boekjaargrenzen.

    Geen TTM voor het hele bedrijf wanneer een kernbegrip ontbreekt.
    """
    if not period:
        return {}
    from datetime import timedelta
    end = date.fromisoformat(period['end'])
    start = date.fromisoformat(period['start'])
    elapsed = (end-start).days+1
    if not 65 <= elapsed <= 310:
        return {}
    result = {}
    for name, tags in TAGS.items():
        rows = candidates_for(payload, tags, asof)
        groups = defaultdict(list)
        for r in rows:
            if r['unit'] == period['unit']:
                groups[(r['namespace'], r['tag'])].append(r)
        for (namespace, tag), facts in groups.items():
            current = [r for r in facts if r['start']==period['start'] and r['end']==period['end']]
            for cur in current:
                for fy in facts:
                    fy_end = date.fromisoformat(fy['end'])
                    fy_start = date.fromisoformat(fy['start'])
                    if not (330 <= (fy_end-fy_start).days+1 <= 390):
                        continue
                    if fy_end + timedelta(days=1) != start:
                        continue
                    for old in facts:
                        old_start = date.fromisoformat(old['start'])
                        old_end = date.fromisoformat(old['end'])
                        if old_start != fy_start:
                            continue
                        if abs(((old_end-old_start).days+1)-elapsed) > 7:
                            continue
                        if abs(((end-old_end).days)-((start-fy_start).days)) > 7:
                            # both YTD windows must be approximately one fiscal year apart
                            continue
                        result[name] = {'val':fy['val']+cur['val']-old['val'],
                                        'unit':cur['unit'], 'start':(old_end+timedelta(days=1)).isoformat(),
                                        'end':period['end'], 'namespace':namespace, 'tag':tag,
                                        'method':'boekjaar + huidig YTD - vorig YTD',
                                        'inputs':(fy,cur,old)}
                        break
                    if name in result:
                        break
                if name in result:
                    break
            if name in result:
                break
    return result


def sec_snapshot(ticker, asof, email, fetcher=fetch_json):
    # Een lokale Europese notering is niet identiek aan een Amerikaanse SEC-notering.
    # Voorkom dat ticker-prefixen (zoals SAP.DE) stilzwijgend als US-ticker worden gebruikt.
    if '.' in ticker:
        return {'supported': False, 'reason': 'Dit is een beurs-specifieke notering. De SEC-tickerlijst bewijst geen dekking van de lokale Europese rapportage. Gebruik voor deze notering later de gecontroleerde IFRS/ESEF-bron.'}
    directory = fetcher(CIK_MAP_URL, email)
    cik, company = cik_for_ticker(ticker, directory)
    if cik is None:
        return {'supported': False, 'reason': 'Beurscode niet gevonden in de SEC-registerlijst. '
                'Dit kan een niet-Amerikaanse notering zijn.', 'ticker': ticker}
    payload = fetcher(FACTS_URL.format(cik=cik), email)
    aligned = aligned_facts(payload, asof)
    raw_quarter = derived_periods(payload, asof, aligned['period'])
    aligned['derived_quarter'] = visible_quarters(aligned['facts'], raw_quarter, asof, aligned['period'])
    aligned['derived_ttm'] = ttm_from_fiscal_year(payload, asof, aligned['period'])
    from history_engine import annual_history
    aligned['annual_history'] = annual_history(payload, asof)
    from sec_missing_fact_diagnostics import diagnose_missing_annual_facts
    aligned['missing_annual_fact_diagnostics'] = diagnose_missing_annual_facts(
        payload, aligned['annual_history'], asof)
    from sec_cashflow_forensics import inspect_cashflow_extensions
    aligned['missing_cashflow_extension_audit'] = inspect_cashflow_extensions(
        payload, aligned['annual_history'], asof)
    from sec_eps_evidence import sec_eps_filing_observations
    aligned['eps_filing_observations'] = sec_eps_filing_observations(payload, asof)
    from eps_verification import sec_eps_recompute_inputs
    aligned['eps_recompute_inputs'] = sec_eps_recompute_inputs(payload, asof)
    from history_checks import capex_comparison, split_events, eps_comparability
    aligned['capex_comparison'] = capex_comparison(payload, asof)
    aligned['split_events'] = split_events(payload, asof)
    try:        # splitsingen die alleen blijken uit de vergelijking van jaarverslagen (niet als splitsing getagd)
        from jaarverslag_archief import afgeleide_splitsingen
        aligned['split_events'] = aligned['split_events'] + afgeleide_splitsingen(payload, asof, aligned['split_events'])
    except Exception:
        pass
    aligned['eps_comparability'] = eps_comparability(aligned['annual_history'], aligned['split_events'])
    from history_engine import investment_tag_diagnostics
    aligned['investment_diagnostics'] = investment_tag_diagnostics(payload, asof)
    aligned['quality'] = report_quality(aligned['facts'], asof, aligned['period'])
    aligned['ttm_quality'] = {name: status(item, asof) for name, item in aligned['derived_ttm'].items()}
    aligned['quarter_quality'] = {name: status(item, asof, aligned['period']) for name, item in aligned['derived_quarter'].items()}
    return {'supported': True, 'ticker': ticker, 'company': company, 'cik': cik, **aligned}
