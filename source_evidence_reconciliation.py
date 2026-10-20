"""Conservatieve, generieke vergelijking van historische bronfeiten.

Een bronregisterregel wordt nooit door de enkele aanwezigheid van een bron
'geverifieerd'. Een onafhankelijke waarneming moet expliciet zijn aangeleverd.
"""
from decimal import Decimal, InvalidOperation


def _number(value):
    if isinstance(value, bool) or value is None:
        return None
    try:
        number = Decimal(str(value))
        return number if number.is_finite() else None
    except (InvalidOperation, ValueError):
        return None


def reconcile_source_evidence(registry, observations, *, relative_tolerance='0.0001'):
    """Controleer bronregels tegen onafhankelijke, expliciete waarnemingen.

    Waarnemingen: ticker, year, concept, value, unit, source, source_id,
    accounting_basis, period_end, independently_checked=True.
    Bronregels moeten voor een automatische goedkeuring ook een accounting_basis
    en period_end hebben. Onbekende grondslag is nooit impliciet vergelijkbaar.
    """
    tolerance = Decimal(str(relative_tolerance))
    results = []
    for record in registry:
        matches = [o for o in observations if
                   str(o.get('ticker', '')).upper() == str(record.get('ticker', '')).upper()
                   and str(o.get('year')) == str(record.get('year'))
                   and o.get('concept') == record.get('concept')]
        approved = []
        reasons = []
        for obs in matches:
            if obs.get('unit') != record.get('unit'):
                reasons.append('valuta_of_eenheid_verschilt')
                continue
            if not record.get('accounting_basis') or obs.get('accounting_basis') != record.get('accounting_basis'):
                reasons.append('verslaggevingsgrondslag_niet_bevestigd')
                continue
            if not record.get('period_end') or obs.get('period_end') != record.get('period_end'):
                reasons.append('verslagperiode_niet_bevestigd')
                continue
            if not obs.get('independently_checked') or not obs.get('source_id'):
                reasons.append('onafhankelijke_broncontrole_ontbreekt')
                continue
            if obs['source_id'] == record.get('source_id') or obs.get('source') == record.get('source'):
                reasons.append('dezelfde_bron_is_geen_onafhankelijke_controle')
                continue
            a, b = _number(record.get('value')), _number(obs.get('value'))
            if a is None or b is None:
                reasons.append('ongeldige_getalswaarde')
                continue
            if abs(a-b) > tolerance * max(abs(a), abs(b), Decimal(1)):
                reasons.append('bedragen_wijken_af')
                continue
            approved.append(obs['source_id'])
        verified = bool(approved) and not reasons
        results.append({'ticker': record.get('ticker'), 'year': record.get('year'),
                        'concept': record.get('concept'), 'verified': verified,
                        'independent_source_ids': approved, 'issues': sorted(set(reasons)) if reasons else
                        ([] if verified else ['geen_onafhankelijke_waarneming']),
                        'eligible_for_manual_approval': verified})
    return results
