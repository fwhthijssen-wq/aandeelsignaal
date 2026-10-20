"""Bron-onafhankelijke analyse van hiaten tussen SEC-dekking en oud bronbewijs.

Dit is een audit, geen aanvulling van geverifieerde financiële jaarfeiten.
"""
from source_registry import find_evidence


def analyze_historical_gaps(sec_year_coverage, registry, ticker, *, concepts=None):
    """Geef ontbrekende SEC-feiten met hun eventuele historische bewijsstatus.

    sec_year_coverage: mapping year -> {'found': [...], 'missing': [...]}.
    De functie wijzigt SEC-feiten en bronregister nooit.
    """
    issuer = str(ticker).upper().split('.')[0]
    output = []
    for year, coverage in sorted(sec_year_coverage.items(), key=lambda pair: int(pair[0])):
        for concept in coverage.get('missing', []):
            if concepts is not None and concept not in concepts:
                continue
            matches = find_evidence(registry, issuer, int(year), concept)
            candidates = []
            for entry in matches:
                candidates.append({
                    'value': entry.get('value'), 'unit': entry.get('unit'),
                    'source': entry.get('source'),
                    'evidence_status': entry.get('evidence_status'),
                    'analysis_approved': False,
                })
            output.append({
                'year': int(year), 'concept': concept,
                'sec_status': 'missing',
                'historic_evidence_found': bool(candidates),
                'historic_candidates': candidates,
                'next_action': ('Verifieer oorspronkelijke bron en verslaggevingsgrondslag'
                                if candidates else 'Zoek oorspronkelijke bron'),
                'valuation_approved': False,
            })
    return output
