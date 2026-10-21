"""Conservatieve controles van vergelijkbaarheid van historische SEC-feiten."""
from datetime import date
from source_engine import candidates_for, duration_days

ANNUAL = {'10-K', '20-F', '40-F'}
CAPEX_TAGS = ('PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets')
SPLIT_TAGS = ('StockholdersEquityNoteStockSplitConversionRatio1', 'StockholdersEquityNoteStockSplitConversionRatio', 'StockSplitConversionRatio1')


def capex_comparison(payload, asof):
    """Toon overlap tussen tags; keur ze nooit automatisch als equivalent goed."""
    result = {}
    for tag in CAPEX_TAGS:
        rows = candidates_for(payload, (tag,), asof)
        for r in rows:
            if r.get('form') not in ANNUAL or not 330 <= (duration_days(r) or 0) <= 390:
                continue
            key = (r['start'], r['end'], r['unit'])
            old = result.setdefault(key, {}).get(tag)
            if old is None or r['filed'] > old['filed']:
                result[key][tag] = r
    comparisons = []
    for (start, end, unit), facts in sorted(result.items(), reverse=True):
        a, b = (facts.get(t) for t in CAPEX_TAGS)
        if a and b:
            equal = abs(a['val'] - b['val']) <= max(1, abs(a['val']) * .001)
            label = 'Bedragen vrijwel gelijk; definitie nog verifiëren' if equal else 'Verschillende bedragen; niet samenvoegen'
        else:
            label = 'Geen overlappende tag; definitie nog verifiëren'
        comparisons.append({'Boekjaareinde': end, 'Valuta': unit,
                            'Materiële activa (mld)': round(a['val']/1e9,3) if a else None,
                            'Productieve activa (mld)': round(b['val']/1e9,3) if b else None,
                            'Beoordeling': label})
    return comparisons


def split_events(payload, asof):
    """Toon alleen expliciete SEC-splitfeiten; interpreteer ratio niet automatisch."""
    events = []
    for namespace, catalog in payload.get('facts', {}).items():
        for tag in SPLIT_TAGS:
            for unit, records in catalog.get(tag, {}).get('units', {}).items():
                for r in records:
                    if (r.get('end', '9999') <= asof and r.get('filed', '9999') <= asof
                        and r.get('form') in ANNUAL | {'10-Q'}
                        and isinstance(r.get('val'), (int,float))):
                        events.append({'Datum':r['end'],'Tag':f'{namespace}:{tag}',
                                       'Waarde SEC':r['val'],'Eenheid':unit,'Ingediend':r['filed'],
                                       'Datumtype':'verslagperiode_einde'})
    return sorted({(x['Datum'],x['Tag'],x['Waarde SEC'],x['Eenheid'],x['Ingediend']):x for x in events}.values(),key=lambda x:x['Datum'],reverse=True)


def eps_comparability(history, splits):
    """Vergelijk EPS alleen als de bron na de laatste bekende split is ingediend.

    Zelfs dan is dit een voorlopige controle: latere SEC-restatements zijn niet
    noodzakelijk voor ieder oud boekjaar beschikbaar.
    """
    dates = [x['Datum'] for x in splits]
    if not dates:
        return {h['end']: 'Niet bevestigd: geen expliciete splitgegevens gevonden' for h in history}
    last_split = max(dates)
    out = {}
    for h in history:
        eps = h.get('facts', {}).get('Winst per aandeel (verwaterd)')
        if not eps:
            out[h['end']] = 'Geen EPS-bron'
        elif h['end'] < last_split and eps.get('filed','') < last_split:
            out[h['end']] = 'Niet vergelijkbaar: bron van vóór bekende split'
        else:
            out[h['end']] = 'Voorlopig: bron na split; aandelenbasis nog verifiëren'
    return out


def normalized_eps_history(history, splits, *, asof=None, geen_splitsingen=False):
    """Voorzichtige EPS-presentatie op post-splitbasis, zonder bronwaarden te wijzigen.

    Alleen eenduidige expliciete SEC-ratio's worden toegepast op feiten die
    zowel vóór de gebeurtenis eindigen als vóór die gebeurtenis zijn ingediend.
    Later ingediende herberekeningen worden nooit opnieuw gedeeld.
    """
    from datetime import date
    from math import isfinite
    audit_date = date.fromisoformat(asof) if asof is not None else date.today()
    events = {}
    uncertain_until = {}
    invalid_event = False
    for event in splits:
        when, ratio = event.get('Datum'), event.get('Waarde SEC')
        # An SEC reporting-period end is not a verified effective split date.
        # This helper is public and must enforce provenance independently.
        if event.get('Datumtype') not in (None, 'effectieve_splitdatum'):
            invalid_event = True
            continue
        from eps_verification import geldige_ratio
        if (not when or not geldige_ratio(ratio, event.get('Tag')) or event.get('Eenheid') not in ('pure', None)):
            invalid_event = True
            continue
        # Also validate dates here: this helper is called independently of the
        # SEC practice runner, so upstream checks alone are insufficient.
        try:
            event_date = date.fromisoformat(when)
        except (TypeError, ValueError):
            invalid_event = True
            continue
        if event_date > audit_date:
            invalid_event = True
            continue
        events.setdefault(event_date.isoformat(), set()).add(float(ratio))
        tot = event.get('Onzeker tot')
        if isinstance(tot, str) and tot > event_date.isoformat():
            uncertain_until[event_date.isoformat()] = max(uncertain_until.get(event_date.isoformat(), ''), tot)
    ambiguous = invalid_event or any(len(ratios) != 1 for ratios in events.values())
    result = {}
    for h in history:
        eps = h.get('facts', {}).get('Winst per aandeel (verwaterd)')
        end = h['end']
        if (not isinstance(eps, dict) or not isinstance(eps.get('val'), (int, float))
                or isinstance(eps.get('val'), bool) or not isfinite(eps['val'])):
            result[end] = {'EPS vergelijkbaar': None, 'Status': 'Geen EPS-bedrag', 'Factor': None}
            continue
        filed = eps.get('filed')
        try:
            end_date = date.fromisoformat(end)
            filed_date = date.fromisoformat(filed)
            valid_chronology = end_date <= filed_date <= audit_date
        except (TypeError, ValueError):
            valid_chronology = False
        if not valid_chronology or ambiguous or (not events and not geen_splitsingen):
            result[end] = {'EPS vergelijkbaar': None, 'Status': 'Niet vast te stellen: splitinformatie ontbreekt of is tegenstrijdig', 'Factor': None}
            continue
        factor = 1.0
        onzeker = False
        for when, ratios in events.items():
            if end < when and filed < when:
                factor *= next(iter(ratios))
            elif end < when and when <= filed <= uncertain_until.get(when, ''):
                onzeker = True            # de splitsing wordt onder meerdere datums gemeld; deze indiening valt ertussen
        if onzeker:
            result[end] = {'EPS vergelijkbaar': None, 'Status': 'Niet vast te stellen: indieningsdatum valt in de onzekere splitperiode',
                           'Factor': None}
            continue
        result[end] = {
            'EPS vergelijkbaar': round(eps['val'] / factor, 6),
            'Status': ('Voorlopig omgerekend op latere aandelenbasis' if factor != 1
                       else ('Geen splitsing in de periode; aandelenaantal stabiel' if (geen_splitsingen and not events)
                             else 'Voorlopig: SEC-bron na splitsing of geen correctie nodig')),
            'Factor': int(factor) if factor.is_integer() else factor,
            'EPS bron ingediend': filed,
        }
    return result
