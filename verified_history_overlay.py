"""Generieke, controleerbare aanvulling van ontbrekende jaarfeiten.

Nooit bronregisterregels rechtstreeks promoveren: alleen expliciet en onafhankelijk
geverifieerde waarnemingen met volledige metadata mogen een ontbrekend feit vullen.
"""
from copy import deepcopy
from datetime import date
from math import isfinite


def overlay_verified_facts(history, registry, observations, *, ticker):
    """Return (new_history, audit), leaving all inputs untouched.

    Observation: ticker, year, concept, value, unit, period_end,
    accounting_basis, source_id, independently_checked=True.
    Registry record must independently declare the same period and basis.
    A second observation may not be the same source as the registry record.
    Existing financial facts are never overwritten. Conflicting candidates
    are rejected, not arbitrarily selected.
    """
    from source_evidence_reconciliation import reconcile_source_evidence
    result = deepcopy(history)
    issuer = str(ticker).upper().split('.')[0]
    relevant = [r for r in registry if str(r.get('ticker', '')).upper() == issuer]
    checks = reconcile_source_evidence(relevant, observations)
    audit = []
    for record, check in zip(relevant, checks):
        reason = None
        year, concept = record.get('year'), record.get('concept')
        try:
            year = int(year)
        except (TypeError, ValueError):
            reason = 'ongeldig_boekjaar'
        rows = [row for row in result if isinstance(row, dict) and
                isinstance(row.get('end'), str) and row['end'][:4] == str(year)]
        if reason is None and len(rows) != 1:
            reason = 'geen_eenduidig_bestaand_boekjaar'
        if reason is None and (not check['verified'] or not check['eligible_for_manual_approval']):
            reason = 'bronbewijs_niet_onafhankelijk_geverifieerd'
        if reason is None:
            row = rows[0]
            if row.get('end') != record.get('period_end') or row.get('unit') != record.get('unit'):
                reason = 'periode_of_valuta_verschilt'
            elif not record.get('accounting_basis') or row.get('accounting_basis') != record['accounting_basis']:
                reason = 'verslaggevingsgrondslag_niet_bevestigd'
            elif concept in (row.get('facts') or {}):
                reason = 'bestaand_bronfeit_niet_overschrijven'
            elif (not isinstance(record.get('value'), (int, float)) or
                  isinstance(record['value'], bool) or not isfinite(record['value'])):
                reason = 'ongeldig_bedrag'
            else:
                # The approved observation must refer to this exact reporting period.
                matching = [o for o in observations if o.get('source_id') in check['independent_source_ids']
                            and str(o.get('ticker', '')).upper() == issuer
                            and str(o.get('year')) == str(year)
                            and o.get('concept') == concept]
                if len(matching) != 1:
                    reason = 'geen_eenduidige_onafhankelijke_waarneming'
                else:
                    row.setdefault('facts', {})[concept] = {
                        'val': record['value'], 'unit': record['unit'],
                        'end': record['period_end'],
                        'source': 'verified_historical_supplement',
                        'source_id': matching[0]['source_id'],
                        'accounting_basis': record['accounting_basis'],
                    }
        audit.append({'year': year, 'concept': concept,
                      'status': 'supplemented' if reason is None else 'rejected',
                      'reason': reason, 'evidence_issues': check['issues']})
    return result, audit
