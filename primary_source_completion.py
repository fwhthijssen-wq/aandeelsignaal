"""Aanvulling uit aantoonbaar gecontroleerde originele jaarverslagen.

Een gecontroleerde primaire bron is GEEN onafhankelijke tweede bron en geeft
geen toestemming om IFRS en US-GAAP als onderling vergelijkbaar te behandelen.
"""
from boekjaar import boekjaar
from copy import deepcopy
from datetime import date
from urllib.parse import urlparse


def complete_from_primary_sources(history, registry, *, ticker):
    rows = deepcopy(history)
    audit = []
    issuer = ticker.upper().split('.')[0]
    for record in registry:
        if str(record.get('ticker', '')).upper() != issuer:
            continue
        reason = None
        period = record.get('period_end')
        try:
            year = int(record['year'])
            if boekjaar(period) != year:
                reason = 'jaar_en_periode_verschillen'
        except (KeyError, TypeError, ValueError):
            reason = 'ongeldige_periode'
        matches = [r for r in rows if r.get('end') == period]
        if reason is None and len(matches) != 1:
            reason = 'geen_eenduidige_jaarregel'
        if reason is None:
            row = matches[0]
            concept = record.get('concept')
            url = record.get('source_url', '')
            parsed = urlparse(url)
            amount = record.get('value')
            if concept in row.get('facts', {}):
                reason = 'bestaand_feit_niet_overschrijven'
            elif record.get('unit') != row.get('unit'):
                reason = 'valuta_verschilt'
            elif not isinstance(amount, (int, float)) or isinstance(amount, bool) or not (float('-inf') < amount < float('inf')):
                reason = 'ongeldig_bedrag'
            elif not record.get('accounting_basis') or not record.get('source_id'):
                reason = 'onvoldoende_bronmetadata'
            elif not record.get('source_verified') or not record.get('source_page'):
                reason = 'originele_bron_niet_gecontroleerd'
            elif parsed.scheme != 'https' or parsed.hostname != 'www.sec.gov':
                reason = 'bron_url_niet_officieel'
            elif row.get('accounting_basis') not in (None, record['accounting_basis']):
                reason = 'verslaggevingsgrondslag_conflict'
            elif any(f.get('accounting_basis') not in (None, record['accounting_basis'])
                     for f in row.get('facts', {}).values() if isinstance(f, dict)):
                reason = 'feit_verslaggevingsgrondslag_conflict'
            else:
                # Record the accounting basis at period level as well: later
                # growth and valuation must not mix US GAAP with IFRS silently.
                row['accounting_basis'] = record['accounting_basis']
                row.setdefault('facts', {})[concept] = {
                    'val': amount, 'unit': record['unit'], 'end': period,
                    'source': 'verified_primary_annual_report',
                    'source_id': record['source_id'],
                    'source_url': url, 'source_page': record['source_page'],
                    'accounting_basis': record['accounting_basis'],
                    'comparability_approved': False,
                }
        audit.append({'year': record.get('year'), 'concept': record.get('concept'),
                      'status': 'added_primary_source' if reason is None else 'rejected',
                      'reason': reason})
    return rows, audit
