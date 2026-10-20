"""Conservatieve controle van SEC-gegevens; verandert nooit de aandelen-score."""
from datetime import date


def _valid_date(s):
    try:
        return date.fromisoformat(s)
    except (TypeError, ValueError):
        return None


def status(item, asof, expected_period=None):
    """Resultaat: gecontroleerd, voorlopig of onvoldoende gegevens.

    'Gecontroleerd' betekent uitsluitend technische bron-/periodecontrole,
    geen onafhankelijke audit van de financiële betekenis.
    """
    if not item:
        return 'onvoldoende gegevens', 'Geen passend SEC-bedrag beschikbaar.'
    if not isinstance(item.get('val'), (float, int)):
        return 'onvoldoende gegevens', 'Bedrag ontbreekt of is ongeldig.'
    start, end = (_valid_date(item.get(k)) for k in ('start', 'end'))
    cutoff = _valid_date(asof)
    if not all((start, end, cutoff)) or start > end or end > cutoff:
        return 'onvoldoende gegevens', 'Verslagperiode ontbreekt of ligt na de peildatum.'
    if expected_period and (item['start'], item['end'], item.get('unit')) != (
            expected_period['start'], expected_period['end'], expected_period['unit']):
        return 'onvoldoende gegevens', 'Periode of valuta wijkt af van de geselecteerde periode.'
    if not item.get('tag') or not item.get('namespace') or not item.get('unit'):
        return 'voorlopig', 'Herkomst of valuta niet volledig vastgelegd.'
    if item.get('method'):
        inputs = item.get('inputs', ())
        if not inputs or any(not x.get('accn') for x in inputs):
            return 'voorlopig', 'Afgeleid bedrag: SEC-documentnummers ontbreken voor volledige herleidbaarheid.'
        if (len({x.get('unit') for x in inputs}) != 1 or
                len({x.get('tag') for x in inputs}) != 1 or
                len({x.get('namespace') for x in inputs}) != 1):
            return 'onvoldoende gegevens', 'Afleiding mengt valuta of XBRL-definities.'
        if any(not _valid_date(x.get('filed')) or _valid_date(x['filed']) > cutoff or
               not _valid_date(x.get('start')) or not _valid_date(x.get('end')) or
               _valid_date(x['end']) > cutoff for x in inputs):
            return 'onvoldoende gegevens', 'Een bronrapport is ongeldig of ligt na de peildatum.'
        if item.get('method') == 'boekjaar + huidig YTD - vorig YTD':
            if len(inputs) != 3:
                return 'onvoldoende gegevens', 'TTM vereist drie bronrapportages.'
            from datetime import timedelta
            fy, current, old = inputs
            if not (date.fromisoformat(fy['end']) + timedelta(days=1) == date.fromisoformat(current['start'])
                    and old['start'] == fy['start'] and old['end'] < fy['end']
                    and current['end'] == item['end']):
                return 'onvoldoende gegevens', 'TTM-bronperioden sluiten niet correct aan.'
        return 'voorlopig', 'Afgeleid uit SEC-bronrapporten; inhoudelijke betekenis nog te verifiëren.'
    filed = _valid_date(item.get('filed'))
    if not filed or filed > cutoff:
        return 'onvoldoende gegevens', 'SEC-indieningsdatum ontbreekt of ligt na de peildatum.'
    if not item.get('accn'):
        return 'voorlopig', 'SEC-documentnummer ontbreekt; bron kan niet volledig worden herleid.'
    return 'gecontroleerd', 'SEC-bron, periode, valuta en indieningsdatum technisch gecontroleerd.'


def visible_quarters(facts, derived, asof, period):
    """Toon afgeleide kwartalen alleen wanneer er geen directe kwartaalwaarde is."""
    result = {}
    for name, item in derived.items():
        direct = facts.get(name)
        if direct and direct.get('start') == item.get('start') and direct.get('end') == item.get('end') and direct.get('unit') == item.get('unit'):
            continue
        if status(item, asof, period)[0] != 'onvoldoende gegevens':
            result[name] = item
    return result


def report_quality(facts, asof, period):
    return {name: status(item, asof, period) for name, item in facts.items()}
