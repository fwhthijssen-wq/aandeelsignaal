"""Bevestiging van EPS-vergelijkbaarheid rond aandelensplitsingen.

Twee onafhankelijke bewijsroutes, beide uitsluitend uit SEC-indieningen, beide fail-closed:

1. SPLITBEVESTIGING. Een splitfeit uit de SEC-gegevens (ratio + datum) telt pas als effectieve
   splitsing als de EPS van dezelfde periode in indieningen van vóór en van na die datum de
   splitverhouding laat zien (bijvoorbeeld 11,89 -> 2,97 bij een 4:1-splitsing). Spreekt het
   bewijs de ratio tegen, of ontbreekt het, dan blijft de splitsing afgewezen.
2. HERBEREKENING. Een gerapporteerde EPS is onderbouwd als nettowinst gedeeld door het gewogen
   gemiddeld aantal verwaterde aandelen, uit DEZELFDE indiening, de EPS op een halve cent
   nauwkeurig oplevert. Dit dekt ook de oudste jaren, waarvoor geen latere indiening bestaat.

Beide routes zijn controleverslagen; geen van beide keurt een waardering goed.
"""
from datetime import date
from math import isfinite

from concept_registry import ANNUAL_FORMS, MONETARY_UNITS
from source_engine import duration_days

CENT_ROUNDING = 0.005          # EPS wordt op centen afgerond
RECOMPUTE_TOLERANCE = 0.0055   # halve cent plus rekenmarge
NET_INCOME_TAG = 'NetIncomeLoss'
SHARES_TAG = 'WeightedAverageNumberOfDilutedSharesOutstanding'
EPS_FACT = 'Winst per aandeel (verwaterd)'


def _day(value):
    if not isinstance(value, str):
        return None
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        return None
    return parsed if parsed.isoformat() == value else None


def _number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value):
        return None
    return float(value)


# ---------------------------------------------------------------- invoer voor herberekening
def sec_eps_recompute_inputs(payload, asof):
    """Nettowinst en gewogen verwaterde aandelen per indiening (zelfde start, einde en accn).

    Alleen us-gaap NetIncomeLoss (toerekenbaar aan het moederbedrijf). Dubbelzinnige of
    tegenstrijdige waarden binnen één indiening worden weggelaten, nooit gekozen.
    """
    cutoff = _day(asof)
    if cutoff is None:
        return []
    facts = (payload.get('facts') or {}).get('us-gaap', {})

    def annual(tag, accepted_unit):
        found = {}
        for unit, rows in ((facts.get(tag) or {}).get('units') or {}).items():
            if not accepted_unit(unit):
                continue
            for row in rows:
                try:
                    end, filed = _day(row['end']), _day(row['filed'])
                    value = _number(row['val'])
                    if (row.get('form') not in ANNUAL_FORMS or end is None or filed is None
                            or value is None or not row.get('accn') or not row.get('start')
                            or not 330 <= (duration_days(row) or 0) <= 390
                            or not end <= filed <= cutoff):
                        continue
                except (KeyError, TypeError):
                    continue
                found.setdefault((row['start'], row['end'], row['accn']), set()).add((unit, value, row['filed']))
        return found

    income = annual(NET_INCOME_TAG, lambda unit: unit in MONETARY_UNITS)
    shares = annual(SHARES_TAG, lambda unit: unit == 'shares')
    records = []
    for key in sorted(set(income) & set(shares)):
        if len(income[key]) != 1 or len(shares[key]) != 1:
            continue
        (currency, net_income, filed), = income[key]
        (_, diluted_shares, _), = shares[key]
        records.append({'start': key[0], 'end': key[1], 'accn': key[2], 'filed': filed,
                        'currency': currency, 'net_income': net_income,
                        'diluted_shares': diluted_shares,
                        'source': f'SEC us-gaap:{NET_INCOME_TAG} / {SHARES_TAG}'})
    return records


def recompute_eps_check(end, eps_fact, inputs):
    """Controleer één gerapporteerde EPS tegen nettowinst / gewogen aandelen uit dezelfde indiening."""
    if not isinstance(eps_fact, dict) or _number(eps_fact.get('val')) is None:
        return {'status': 'geen_eps', 'reden': 'Geen EPS-bedrag'}
    accn = eps_fact.get('accn')
    matches = [r for r in (inputs or []) if isinstance(r, dict) and r.get('end') == end and accn
               and r.get('accn') == accn]
    if not matches:
        return {'status': 'geen_gegevens',
                'reden': 'Nettowinst of gewogen aandelen ontbreekt in de indiening van deze EPS'}
    if len({(r.get('net_income'), r.get('diluted_shares'), r.get('currency')) for r in matches}) != 1:
        return {'status': 'tegenstrijdig', 'reden': 'Tegenstrijdige invoer voor herberekening'}
    row = matches[0]
    net_income, shares = _number(row.get('net_income')), _number(row.get('diluted_shares'))
    if net_income is None or shares is None or shares <= 0:
        return {'status': 'ongeldig', 'reden': 'Ongeldige nettowinst of aantal aandelen'}
    unit = eps_fact.get('unit')
    if isinstance(unit, str) and unit.split('/')[0] != row.get('currency'):
        return {'status': 'valutaverschil', 'reden': 'Valuta van EPS en nettowinst verschillen'}
    recomputed = net_income / shares
    reported = float(eps_fact['val'])
    result = {'herberekend': round(recomputed, 4), 'gerapporteerd': reported, 'accn': accn,
              'bron': row.get('source')}
    if abs(recomputed - reported) <= RECOMPUTE_TOLERANCE:
        return {**result, 'status': 'consistent',
                'reden': 'Nettowinst / gewogen verwaterde aandelen geeft de gerapporteerde EPS (zelfde indiening)'}
    return {**result, 'status': 'afwijking',
            'reden': 'Herberekende EPS wijkt af van de gerapporteerde EPS (mogelijk tweeklassenmethode of aangepaste teller)'}


# ---------------------------------------------------------------- splitbevestiging
def _ratio_interval(before_values, after_values):
    """Mogelijke verhouding oud/nieuw gegeven afronding op centen; None als niet te bepalen."""
    low_before, high_before = min(before_values), max(before_values)
    low_after, high_after = min(after_values), max(after_values)
    if low_before <= CENT_ROUNDING or low_after <= CENT_ROUNDING:
        return None
    return ((low_before - CENT_ROUNDING) / (high_after + CENT_ROUNDING),
            (high_before + CENT_ROUNDING) / (low_after - CENT_ROUNDING))


def verify_split_events(split_events, observations, history):
    """Geef de splitgebeurtenissen terug met bevestiging uit EPS-herberekeningen rond de splitsing.

    - Gevonden bevestiging: Datumtype wordt 'effectieve_splitdatum', met bewijs en venster.
    - Splitsing vóór het eerste boekjaar in het dossier: 'niet_van_toepassing' (kan geen enkele
      EPS in het dossier raken, want een boekjaar eindigt nooit vóór zijn eigen splitsing).
    - Anders blijft de gebeurtenis ongewijzigd afgewezen, met reden.
    """
    ends = [d for d in (_day(r.get('end')) for r in history if isinstance(r, dict)) if d]
    earliest = min(ends) if ends else None
    by_end = {}
    for obs in observations if isinstance(observations, list) else []:
        if not isinstance(obs, dict):
            continue
        end, filed, value = _day(obs.get('end')), _day(obs.get('filed')), _number(obs.get('val'))
        if (end is None or filed is None or value is None or not obs.get('accn')
                or not isinstance(obs.get('unit'), str) or not obs['unit'].endswith('/shares')):
            continue
        by_end.setdefault(end, []).append((filed, value))

    verdicts = {}
    out = []
    for event in split_events:
        if not isinstance(event, dict):
            out.append(event)
            continue
        when, ratio = _day(event.get('Datum')), _number(event.get('Waarde SEC'))
        if when is None or ratio is None or not 1 < ratio <= 1000:
            out.append(event)          # de bestaande validatie wijst dit af met reden
            continue
        if earliest is not None and when < earliest:
            out.append({**event, 'Datumtype': 'niet_van_toepassing',
                        'Verificatie reden': 'splitsing ligt vóór het eerste boekjaar in het dossier'})
            continue
        key = (when, ratio)
        if key not in verdicts:
            supporting, contradicting = [], []
            for end, rows in sorted(by_end.items()):
                if end >= when:
                    continue
                before = [value for filed, value in rows if filed < when]
                after = [value for filed, value in rows if filed > when]
                if not before or not after:
                    continue
                interval = _ratio_interval(before, after)
                if interval is None:
                    continue
                low, high = interval
                observed = (min(before) / max(after), max(before) / min(after))
                entry = {'periode': end.isoformat(), 'eps_voor': sorted(set(before)),
                         'eps_na': sorted(set(after)),
                         'verhouding_waargenomen': [round(observed[0], 3), round(observed[1], 3)]}
                (supporting if low <= ratio <= high else contradicting).append((end, entry))
            verdicts[key] = (supporting, contradicting)
        supporting, contradicting = verdicts[key]
        if contradicting:
            out.append({**event, 'Verificatie reden':
                        'EPS-herberekening in latere indieningen spreekt de splitverhouding tegen '
                        f'(periode {contradicting[0][0].isoformat()})'})
        elif not supporting:
            out.append({**event, 'Verificatie reden':
                        'geen EPS van dezelfde periode in indieningen van voor én na de splitsing; '
                        'splitverhouding niet bevestigd'})
        else:
            first_after = min(f for end, rows in by_end.items() if end < when for f, _ in rows if f > when)
            last_before = max(f for end, rows in by_end.items() if end < when for f, _ in rows if f < when)
            out.append({**event, 'Datumtype': 'effectieve_splitdatum',
                        'Verificatie': 'EPS-herberekening in indieningen voor en na de splitsing',
                        'Verificatie bewijs': [entry for _, entry in supporting],
                        'Verificatie venster': {'laatste_indiening_voor': last_before.isoformat(),
                                                'eerste_indiening_na': first_after.isoformat()}})
    return out


# ---------------------------------------------------------------- samenhangende controle
def verify_eps(result, safe_history, audit_date):
    """Splitbevestiging, voorlopige normalisatie en onafhankelijke onderbouwing per boekjaar."""
    from history_checks import normalized_eps_history, SPLIT_TAGS
    from eps_reconciliation import reconcile_eps

    split_source = result.get('split_events')
    checked_events = []
    if isinstance(split_source, list):
        checked_events = verify_split_events(split_source, result.get('eps_filing_observations'),
                                             safe_history)
    split_audit = []
    validated_splits = []
    for event in checked_events if isinstance(split_source, list) else []:
        if not isinstance(event, dict):
            split_audit.append({'status': 'rejected', 'reason': 'geen gestructureerde gebeurtenis'})
            continue
        if event.get('Datumtype') == 'niet_van_toepassing':
            split_audit.append({'date': event.get('Datum'), 'source_tag': event.get('Tag'),
                                'unit': event.get('Eenheid'), 'ratio': event.get('Waarde SEC'),
                                'status': 'niet_van_toepassing',
                                'reasons': [event.get('Verificatie reden')]})
            continue
        ratio, unit, when, tag = (event.get('Waarde SEC'), event.get('Eenheid'),
                                  event.get('Datum'), event.get('Tag'))
        reasons = []
        # In SEC companyfacts, 'end' is the reporting period end, NOT necessarily the legal
        # effective date of a stock split. Only a confirmed split (see verify_split_events)
        # carries the type 'effectieve_splitdatum'.
        if event.get('Datumtype') != 'effectieve_splitdatum':
            reasons.append('geen geverifieerde effectieve splitdatum; verslagperiode of onbekende herkomst is onvoldoende')
            if event.get('Verificatie reden'):
                reasons.append(event['Verificatie reden'])
        try:
            split_date = date.fromisoformat(when)
            if split_date > audit_date:
                reasons.append('splitdatum ligt in de toekomst')
        except (TypeError, ValueError):
            reasons.append('datum ontbreekt of is ongeldig')
        if (isinstance(ratio, bool) or not isinstance(ratio, (int, float))
                or not isfinite(ratio) or not 1 < ratio <= 1000):
            reasons.append('ongeldige splitratio')
        if unit not in ('pure', None):
            reasons.append('onverwachte eenheid')
        # Preserve old offline fixtures without a tag, but reject explicit unrecognized tags.
        if tag is not None:
            if not isinstance(tag, str) or tag.split(':')[-1] not in SPLIT_TAGS:
                reasons.append('onbekende SEC-splittag')
        filed = event.get('Ingediend')
        if filed is not None:
            try:
                if date.fromisoformat(filed) > audit_date:
                    reasons.append('splitbron ingediend na peildatum')
            except (TypeError, ValueError):
                reasons.append('ongeldige indieningsdatum')
        entry = {'date': when, 'source_tag': tag, 'unit': unit, 'ratio': ratio,
                 'status': 'rejected' if reasons else 'candidate', 'reasons': reasons}
        if event.get('Verificatie'):
            entry['verification'] = event['Verificatie']
            entry['verification_window'] = event.get('Verificatie venster')
            entry['verification_evidence'] = event.get('Verificatie bewijs')
        split_audit.append(entry)
        if not reasons:
            validated_splits.append(event)
    # Multiple filings can describe one split. Conflicting ratios on the same date invalidate
    # the entire normalization, never select one arbitrarily.
    ratios_by_date = {}
    for event in validated_splits:
        ratios_by_date.setdefault(event['Datum'], set()).add(float(event['Waarde SEC']))
    conflicting_dates = sorted(d for d, ratios in ratios_by_date.items() if len(ratios) > 1)
    if conflicting_dates:
        for item in split_audit:
            if item.get('date') in conflicting_dates and item['status'] == 'candidate':
                item['status'] = 'rejected'
                item['reasons'].append('tegenstrijdige ratio op dezelfde splitdatum')
        validated_splits = []
    # If the source provides invalid split evidence, never quietly discard it and normalize on
    # the remaining subset: completeness is not established.
    rejected_split_evidence = any(item['status'] == 'rejected' for item in split_audit)
    normalization_splits = validated_splits if not rejected_split_evidence else []
    eps_normalized = (normalized_eps_history(safe_history, normalization_splits,
                                             asof=audit_date.isoformat())
                      if normalization_splits else {})

    # Route 1: later ingediende EPS na de splitsing (alleen bruikbaar voor recente jaren).
    restated_source = result.get('restated_eps')
    if restated_source is None and isinstance(result.get('eps_filing_observations'), list):
        from sec_eps_evidence import later_eps_evidence
        restated_source = later_eps_evidence(result['eps_filing_observations'], safe_history,
                                             eps_normalized, normalization_splits)
    eps_reconciliation = reconcile_eps(
        eps_normalized, restated_source if isinstance(restated_source, list) else [],
        asof=audit_date.isoformat()) if eps_normalized else {}
    for audit in eps_reconciliation.values():
        if audit['status'] == 'onderbouwd':
            audit['route'] = 'latere_indiening'

    # Route 2: herberekening uit nettowinst en gewogen aandelen van dezelfde indiening.
    inputs = result.get('eps_recompute_inputs')
    inputs = inputs if isinstance(inputs, list) else []
    recompute = {}
    for row in safe_history:
        end = row.get('end') if isinstance(row, dict) else None
        audit = eps_reconciliation.get(end)
        if audit is None or audit['verwacht'] is None:
            continue
        check = recompute_eps_check(end, (row.get('facts') or {}).get(EPS_FACT), inputs)
        recompute[end] = check
        audit['herberekening'] = check
        if audit['status'] == 'niet_bewezen' and check['status'] == 'consistent':
            audit['status'] = 'onderbouwd'
            audit['route'] = 'herberekening'
            audit['reden'] = check['reden']
    eps_verified_years = sorted(int(end[:4]) for end, audit in eps_reconciliation.items()
                                if audit['status'] == 'onderbouwd')

    conflict = any(audit['status'] in ('bronconflict', 'afwijking') for audit in eps_reconciliation.values())
    if rejected_split_evidence:
        status = 'split_evidence_rejected'
    elif conflict:
        status = 'independent_evidence_conflict'
    elif eps_normalized and len(eps_verified_years) == len(eps_normalized):
        status = 'independently_verified'
    elif eps_verified_years:
        status = 'partially_independently_verified'
    elif eps_normalized:
        status = 'provisional_not_independently_verified'
    else:
        status = 'missing_split_evidence'
    routes = {end: audit.get('route') for end, audit in eps_reconciliation.items()
              if audit['status'] == 'onderbouwd'}
    return {'split_source': split_source, 'split_audit': split_audit,
            'validated_splits': validated_splits, 'conflicting_dates': conflicting_dates,
            'rejected_split_evidence': rejected_split_evidence,
            'normalization_splits': normalization_splits, 'eps_normalized': eps_normalized,
            'eps_reconciliation': eps_reconciliation, 'eps_verified_years': eps_verified_years,
            'status': status, 'routes': routes}


def gate_evidence(report):
    """Bewijs voor het label-slot, afgeleid van hetzelfde rapport als de praktijkcontrole."""
    dossier = report.get('dossier') if isinstance(report, dict) else None
    if not isinstance(dossier, dict) or report.get('status') != 'facts_found':
        return {}
    completeness = dossier.get('completeness') or {}
    return {'eps_status': dossier.get('eps_verification_status'),
            'eps_verified_years': dossier.get('eps_independently_verified_count'),
            'currencies': list(completeness.get('currencies') or []),
            'rejected_sources': len(report.get('rejections') or []),
            'blocking_issues': list(completeness.get('blocking_issues') or [])}


def evidence_from_snapshot(snapshot, history, audit_date):
    """Zelfde controle als de praktijkcontrole, voor gebruik in de app (label-slot)."""
    check = verify_eps(snapshot if isinstance(snapshot, dict) else {}, history, audit_date)
    currencies = sorted({row.get('unit') for row in history if isinstance(row, dict) and row.get('unit')})
    return check, {'eps_status': check['status'],
                   'eps_verified_years': len(check['eps_verified_years']),
                   'currencies': currencies,
                   'rejected_sources': len((snapshot or {}).get('rejections') or [])}
