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
from boekjaar import boekjaar
from datetime import date
from math import isfinite

from concept_registry import ANNUAL_FORMS, MONETARY_UNITS
from source_engine import duration_days

CENT_ROUNDING = 0.005          # EPS wordt op centen afgerond
RECOMPUTE_TOLERANCE = 0.0055   # halve cent plus rekenmarge
NET_INCOME_TAG = 'NetIncomeLoss'
SHARES_TAG = 'WeightedAverageNumberOfDilutedSharesOutstanding'
IFRS_NET_INCOME_TAG = 'ProfitLossAttributableToOwnersOfParent'
IFRS_SHARES_TAG = 'AdjustedWeightedAverageShares'
IFRS_NET_INCOME_ORDINARY_TAG = 'ProfitLossAttributableToOrdinaryEquityHoldersOfParentEntity'
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
SHARES_IN_MILLIONS_BELOW = 100_000


def sec_eps_recompute_inputs(payload, asof):
    """Nettowinst en gewogen verwaterde aandelen per indiening (zelfde start, einde en accn).

    Alleen us-gaap NetIncomeLoss (toerekenbaar aan het moederbedrijf). Dubbelzinnige of
    tegenstrijdige waarden binnen één indiening worden weggelaten, nooit gekozen.
    """
    cutoff = _day(asof)
    if cutoff is None:
        return []
    all_facts = payload.get('facts') or {}

    def annual(namespace, tag, accepted_unit):
        facts = all_facts.get(namespace) or {}
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

    records = {}
    money = lambda unit: unit in MONETARY_UNITS
    # US-GAAP en IFRS (ifrs-full) hebben elk eigen namen; per indiening wordt één stelsel gebruikt.
    # Teller van de verwaterde winst per aandeel, in vaste volgorde van beschikbaarheid (niet van uitkomst):
    # 1. winst beschikbaar voor gewone aandeelhouders (verwaterd), dus na dividend op preferente aandelen
    #    (banken, Procter & Gamble); 2. nettowinst; 3. winst min aandeel van minderheidsbelangen.
    us = 'us-gaap'
    preferent = annual(us, 'NetIncomeLossAvailableToCommonStockholdersDiluted', money)
    netto = annual(us, NET_INCOME_TAG, money)
    totaal = annual(us, 'ProfitLoss', money)
    minderheid = annual(us, 'NetIncomeLossAttributableToNoncontrollingInterest', money)
    gewoon = annual(us, 'NetIncomeLossAvailableToCommonStockholdersBasic', money)
    us_income, us_tag = {}, {}
    for key in set(preferent) | set(netto) | set(totaal) | set(gewoon):
        if key in preferent:
            us_income[key], us_tag[key] = preferent[key], 'NetIncomeLossAvailableToCommonStockholdersDiluted'
        elif key in netto:
            us_income[key], us_tag[key] = netto[key], NET_INCOME_TAG
        elif key in gewoon:
            # Thermo Fisher e.d. taggen de jaarwinst alleen als 'beschikbaar voor gewone aandeelhouders'. De herberekening
            # moet de gerapporteerde EPS nog steeds reproduceren, anders blijft het jaar onbewezen.
            us_income[key], us_tag[key] = gewoon[key], 'NetIncomeLossAvailableToCommonStockholdersBasic'
        elif key in totaal and key in minderheid and len(totaal[key]) == 1 and len(minderheid[key]) == 1:
            (unit_a, value_a, filed_a), = totaal[key]
            (unit_b, value_b, _), = minderheid[key]
            if unit_a == unit_b:
                us_income[key], us_tag[key] = {(unit_a, value_a - value_b, filed_a)}, 'ProfitLoss minus NetIncomeLossAttributableToNoncontrollingInterest'
    ifrs_owners = annual('ifrs-full', IFRS_NET_INCOME_TAG, money)
    ifrs_ordinary = annual('ifrs-full', IFRS_NET_INCOME_ORDINARY_TAG, money)
    ifrs_income, ifrs_tag = {}, {}
    for key in set(ifrs_owners) | set(ifrs_ordinary):
        if key in ifrs_owners and key in ifrs_ordinary and ifrs_owners[key] != ifrs_ordinary[key]:
            continue                       # twee tellers die verschillen: nooit kiezen
        bron, tag = (ifrs_owners, IFRS_NET_INCOME_TAG) if key in ifrs_owners else (ifrs_ordinary, IFRS_NET_INCOME_ORDINARY_TAG)
        ifrs_income[key], ifrs_tag[key] = bron[key], tag
    for namespace, income, ni_tags, sh_tag in ((us, us_income, us_tag, SHARES_TAG),
                                               ('ifrs-full', ifrs_income, ifrs_tag, IFRS_SHARES_TAG)):
        shares = annual(namespace, sh_tag, lambda unit: unit == 'shares')
        for key in sorted(set(income) & set(shares)):
            if len(income[key]) != 1 or len(shares[key]) != 1:
                continue
            (currency, net_income, filed), = income[key]
            (_, diluted_shares, _), = shares[key]
            geschaald = False
            if 0 < diluted_shares < SHARES_IN_MILLIONS_BELOW:
                # Sommige indieners (bijv. McDonald's vanaf 2024) rapporteren aandelen in miljoenen
                # (727 i.p.v. 727.000.000). Echte bedrijven hebben nooit minder dan 100.000 aandelen.
                # De herberekening moet daarna nog steeds de gerapporteerde EPS reproduceren.
                diluted_shares *= 1_000_000
                geschaald = True
            ni_tag = ni_tags[key] if ni_tags else IFRS_NET_INCOME_TAG
            record = {'start': key[0], 'end': key[1], 'accn': key[2], 'filed': filed,
                      'currency': currency, 'net_income': net_income,
                      'diluted_shares': diluted_shares,
                      'source': f'SEC {namespace}:{ni_tag} / {sh_tag}' + (' (aandelen in miljoenen, x1.000.000)' if geschaald else '')}
            previous = records.get(key)
            if previous is not None and (previous['net_income'], previous['diluted_shares']) != (net_income, diluted_shares):
                records[key] = None            # tegenstrijdig tussen stelsels: nooit kiezen
            elif previous is None and key not in records:
                records[key] = record
    return [records[k] for k in sorted(records) if records[k] is not None]


def _rounding_unit(value):
    """Grootste macht van duizend waarop het bedrag exact deelbaar is (1, 1e3, 1e6, 1e9)."""
    for unit in (1e9, 1e6, 1e3):
        if value % unit == 0:
            return unit
    return 1.0


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
    # Bronbedragen zijn afgerond (aandelen vaak op duizenden of miljoenen, winst op miljoenen):
    # de herberekende EPS ligt dus in een interval. Gerapporteerde EPS moet binnen dat interval
    # plus de halve-cent-marge vallen.
    u_ni, u_sh = _rounding_unit(net_income) / 2, _rounding_unit(shares) / 2
    low = (net_income - u_ni) / (shares + u_sh)
    high = (net_income + u_ni) / max(shares - u_sh, 1e-9)
    if low - RECOMPUTE_TOLERANCE <= reported <= high + RECOMPUTE_TOLERANCE:
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


def share_count_continuity(history, inputs):
    """Is het gewogen aantal aandelen over alle boekjaren stabiel (elk jaar 0,8 tot 1,2 keer het vorige)?

    Een niet-gemelde splitsing of omgekeerde splitsing zou als sprong zichtbaar zijn. Ontbreekt een jaar
    of een invoer, dan geldt de continuïteit niet als vastgesteld (nooit stilzwijgend goed).
    """
    rows, geen_eps, geen_aandelen = [], [], []
    for row in history:
        fact = (row.get('facts') or {}).get(EPS_FACT) if isinstance(row, dict) else None
        end = _day(row.get('end')) if isinstance(row, dict) else None
        label = row.get('end') if isinstance(row, dict) else '?'
        if not isinstance(fact, dict) or end is None or not fact.get('accn'):
            geen_eps.append(str(label))
            continue
        matches = [r for r in (inputs or []) if isinstance(r, dict) and r.get('end') == row.get('end')
                   and r.get('accn') == fact.get('accn')]
        shares = {_number(r.get('diluted_shares')) for r in matches}
        if len(shares) != 1 or None in shares or next(iter(shares)) <= 0:
            geen_aandelen.append(str(label))
            continue
        rows.append((end, next(iter(shares))))
    if geen_eps:
        return False, 'EPS of indiening ontbreekt voor boekjaar ' + ', '.join(geen_eps)
    if geen_aandelen:
        return False, ('aantal aandelen (of nettowinst) ontbreekt of is dubbelzinnig in dezelfde indiening voor boekjaar '
                       + ', '.join(geen_aandelen))
    rows.sort()
    if len(rows) < 2:
        return False, 'te weinig boekjaren'
    for (e1, s1), (e2, s2) in zip(rows, rows[1:]):
        if not 340 <= (e2 - e1).days <= 390:
            return False, f'boekjaar ontbreekt tussen {e1} en {e2}'
        if not 0.8 <= s2 / s1 <= 1.2:
            return False, f'aantal aandelen springt tussen {e1} en {e2} ({s2 / s1:.2f} keer): mogelijk niet-gemelde splitsing'
    return True, 'aantal aandelen stabiel over alle boekjaren'


def adjusted_share_chain(history, inputs, factors):
    """Jaren waarvan het aantal aandelen, omgerekend met de splitfactor, een onafgebroken stabiele reeks vormt
    tot en met het nieuwste jaar. Een verkeerde factor veroorzaakt een sprong en sluit de oudere jaren uit."""
    rows = []
    for row in history:
        fact = (row.get('facts') or {}).get(EPS_FACT) if isinstance(row, dict) else None
        end = row.get('end') if isinstance(row, dict) else None
        day = _day(end)
        if day is None or not isinstance(fact, dict):
            continue
        matches = [r for r in (inputs or []) if isinstance(r, dict) and r.get('end') == end
                   and r.get('accn') == fact.get('accn')]
        shares = {_number(r.get('diluted_shares')) for r in matches}
        factor = factors.get(end)
        if len(shares) != 1 or None in shares or next(iter(shares)) <= 0 or not isinstance(factor, (int, float)):
            rows.append((day, end, None))
        else:
            rows.append((day, end, next(iter(shares)) * factor))
    rows.sort()
    if len(rows) < 2:
        return set(), 'te weinig boekjaren'
    if rows[-1][2] is None:
        return set(), 'aantal aandelen ontbreekt voor het nieuwste boekjaar'
    ok = {rows[-1][1]}
    reason = None
    for (d1, e1, s1), (d2, e2, s2) in zip(rows[-2::-1], rows[::-1]):
        if s1 is None or s2 is None or e2 not in ok:
            if reason is None and s1 is None:
                reason = f'aantal aandelen ontbreekt voor {e1}: oudere jaren niet te bevestigen via aandelenaantal'
            continue
        if not 340 <= (d2 - d1).days <= 390 or not 0.8 <= s2 / s1 <= 1.2:
            reason = (f'omgerekend aantal aandelen springt tussen {e1} en {e2}: splitfactor niet bevestigd')
            continue
        ok.add(e1)
    return ok, reason


def _bundel_bevestigde_duplicaten(events, window_days=100):
    """Dezelfde splitsing onder meerdere data (SEC meldt per verslagperiode) telt één keer.
    De vroegste datum blijft; indieningen binnen de onzekere periode zijn niet te corrigeren."""
    confirmed = sorted(((_day(e.get('Datum')), _number(e.get('Waarde SEC')), i) for i, e in enumerate(events)
                        if isinstance(e, dict) and e.get('Datumtype') == 'effectieve_splitdatum'),
                       key=lambda x: (x[1] or 0, x[0] or date.min))
    result = list(events)
    group = []
    def flush():
        if len(group) < 2:
            return
        first = min(group, key=lambda g: g[0])
        last = max(g[0] for g in group)
        if last == first[0]:
            return
        for d, r, i in group:
            if i == first[2]:
                result[i] = {**result[i], 'Onzeker tot': last.isoformat()}
            elif d != first[0]:
                result[i] = {**result[i], 'Datumtype': 'dubbel_van_bevestigde_splitsing',
                             'Verificatie reden': 'dezelfde splitsing onder een latere datum; '
                                                  f'vroegste datum {first[0].isoformat()}'}
    for item in confirmed:
        if item[0] is None or item[1] is None:
            continue
        if group and (item[1] != group[0][1] or (item[0] - group[0][0]).days > window_days):
            flush(); group.clear()
        group.append(item)
    flush()
    return result


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
    return _bundel_bevestigde_duplicaten(_markeer_dubbele_aankondigingen(out))


def _markeer_dubbele_aankondigingen(events):
    """Een tegengesproken gebeurtenis met dezelfde verhouding als een bevestigde splitsing die
    ten hoogste een jaar later ligt, is dezelfde splitsing onder de datum van de aankondiging.
    Zij blokkeert dan niet; zij telt ook niet mee voor de omrekening."""
    confirmed = [(_day(e.get('Datum')), _number(e.get('Waarde SEC'))) for e in events
                 if isinstance(e, dict) and e.get('Datumtype') == 'effectieve_splitdatum']
    result = []
    for e in events:
        if (isinstance(e, dict) and e.get('Datumtype') != 'effectieve_splitdatum'
                and str(e.get('Verificatie reden') or '').startswith('EPS-herberekening in latere indieningen spreekt')):
            when, ratio = _day(e.get('Datum')), _number(e.get('Waarde SEC'))
            match = [c for c, r in confirmed if when and c and ratio is not None and r == ratio
                     and 0 < (c - when).days <= 366]
            if match:
                e = {**e, 'Datumtype': 'dubbel_van_bevestigde_splitsing',
                     'Verificatie reden': 'dezelfde splitsing onder een eerdere datum (waarschijnlijk de aankondiging); '
                                          f'bevestigde splitsing op {min(match).isoformat()}'}
        result.append(e)
    return result


def _route_oorspronkelijke_indiening(end, row, observations, confirmed, expected):
    """None als deze route niet van toepassing is, anders een uitkomst met status 'consistent' of 'afwijking'."""
    period = _day(end)
    fact = (row.get('facts') or {}).get(EPS_FACT) or {}
    primary_filed = _day(fact.get('filed'))
    if period is None or primary_filed is None or any(d is None or r is None for d, r in confirmed):
        return None
    applicable = sorted({(d, r) for d, r in confirmed if d > period})
    if not applicable or any(d > primary_filed for d, _ in applicable):
        return None                    # het dossier gebruikt hier geen indiening van ná de splitsing
    first_split = min(d for d, _ in applicable)
    factor = 1.0
    for _, r in applicable:
        factor *= r
    originals = []
    for obs in observations:
        if not isinstance(obs, dict) or obs.get('end') != end:
            continue
        filed, value = _day(obs.get('filed')), _number(obs.get('val'))
        if (filed is None or value is None or not obs.get('accn') or not isinstance(obs.get('unit'), str)
                or not obs['unit'].endswith('/shares') or filed >= first_split):
            continue
        originals.append(value)
    if not originals:
        return None
    verschil = max(abs(v / factor - expected) for v in originals)
    # EPS is op centen afgerond: toegestaan is een halve cent per oorspronkelijke waarde, gedeeld door de factor,
    # plus een halve cent op de gebruikte waarde.
    marge = CENT_ROUNDING / factor + CENT_ROUNDING + 1e-9
    if verschil <= marge:
        return {'status': 'consistent', 'factor': factor, 'oorspronkelijk': sorted(set(originals)),
                'reden': f'Oorspronkelijke indiening ({", ".join(str(v) for v in sorted(set(originals)))}) gedeeld door '
                         f'de bevestigde splitverhouding {factor:g} geeft de EPS van het dossier'}
    return {'status': 'afwijking', 'factor': factor, 'oorspronkelijk': sorted(set(originals)),
            'reden': 'Oorspronkelijke indiening (' + ', '.join(str(v) for v in sorted(set(originals))) +
                     f') gedeeld door de splitverhouding {factor:g} wijkt af van de EPS van het dossier ({expected})'}


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
        if event.get('Datumtype') in ('niet_van_toepassing', 'dubbel_van_bevestigde_splitsing'):
            split_audit.append({'date': event.get('Datum'), 'source_tag': event.get('Tag'),
                                'unit': event.get('Eenheid'), 'ratio': event.get('Waarde SEC'),
                                'status': ('niet_van_toepassing' if event.get('Datumtype') == 'niet_van_toepassing'
                                           else 'dubbel'),
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
    no_splits = False
    no_splits_reason = None
    # Splitsingen van vóór het eerste boekjaar in het dossier raken geen enkele EPS: dan geldt de controle zonder splitsing.
    relevante_splits = [a for a in split_audit if a.get('status') != 'niet_van_toepassing']
    if (isinstance(split_source, list) and not relevante_splits and not rejected_split_evidence):
        no_splits, no_splits_reason = share_count_continuity(safe_history, result.get('eps_recompute_inputs'))
    eps_normalized = (normalized_eps_history(safe_history, normalization_splits,
                                             asof=audit_date.isoformat(), geen_splitsingen=no_splits)
                      if (normalization_splits or no_splits) else {})

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
    factors = {end: item.get('Factor') for end, item in eps_normalized.items()}
    chain_ok, chain_reason = (adjusted_share_chain(safe_history, inputs, factors)
                              if eps_normalized else (set(), None))
    for row in safe_history:
        end = row.get('end') if isinstance(row, dict) else None
        audit = eps_reconciliation.get(end)
        if audit is None or audit['verwacht'] is None:
            continue
        check = recompute_eps_check(end, (row.get('facts') or {}).get(EPS_FACT), inputs)
        recompute[end] = check
        audit['herberekening'] = check
        if audit['status'] == 'niet_bewezen' and check['status'] == 'consistent':
            factor = (eps_normalized.get(end) or {}).get('Factor')
            if factor not in (None, 1, 1.0) and end not in chain_ok:
                # De herberekening bewijst alleen dat de gemelde EPS klopt binnen één indiening. Voor een jaar dat
                # is omgerekend moet ook de omrekening zelf kloppen: dat bewijst een stabiele reeks aandelen.
                audit['reden'] = (f"{audit.get('reden')}; omrekening met factor {factor:g} niet bevestigd door een "
                                  f"stabiele reeks aandelen" + (f' ({chain_reason})' if chain_reason else ''))
                continue
            audit['status'] = 'onderbouwd'
            audit['route'] = 'herberekening'
            audit['reden'] = check['reden']
    # Route 3: het dossier gebruikt voor dit jaar al een indiening van ná de splitsing, dus er is geen
    # nog latere indiening. Dan vergelijken we de oorspronkelijke (voor-de-splitsing) indieningen,
    # gedeeld door de bevestigde splitverhouding, met de EPS die het dossier gebruikt.
    observations = result.get('eps_filing_observations')
    observations = observations if isinstance(observations, list) else []
    confirmed = [(_day(e.get('Datum')), _number(e.get('Waarde SEC'))) for e in normalization_splits]
    for row in safe_history:
        end = row.get('end') if isinstance(row, dict) else None
        audit = eps_reconciliation.get(end)
        if audit is None or audit['status'] != 'niet_bewezen' or audit['verwacht'] is None:
            continue
        check = _route_oorspronkelijke_indiening(end, row, observations, confirmed, audit['verwacht'])
        if check is None:
            continue
        audit['oorspronkelijke_indiening'] = check
        if check['status'] == 'consistent':
            audit['status'] = 'onderbouwd'
            audit['route'] = 'oorspronkelijke_indiening_omgerekend'
            audit['reden'] = check['reden']
        else:
            audit['reden'] = f"{audit.get('reden')}; {check['reden']}"
    for end, check in recompute.items():
        audit = eps_reconciliation.get(end)
        if audit and audit['status'] == 'niet_bewezen' and check.get('reden'):
            detail = (f" (herberekend {check['herberekend']}, gemeld {check['gerapporteerd']})"
                      if 'herberekend' in check else '')
            audit['reden'] = f"{audit.get('reden')}; herberekening: {check['reden']}{detail}"
    eps_verified_years = sorted(boekjaar(end) for end, audit in eps_reconciliation.items()
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
            'status': status, 'routes': routes, 'no_splits': no_splits, 'toelichting': no_splits_reason or chain_reason,
            'no_splits_reason': no_splits_reason}


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
