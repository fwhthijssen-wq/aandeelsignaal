"""Conservative multi-filing ESEF history aggregation (no issuer-specific mapping).

Every accepted value retains its source; mixed currencies, inconsistent units,
invalid fiscal periods and contradictory restatements remain explicit issues.
"""
from collections import defaultdict
from datetime import date
import math
from esef_discovery import validate_lei
from esef_import import is_currency_code


def _valid_fact_unit(concept, fact, currency):
    unit = fact.get('unit')
    # Older internal test fixtures do not provide a fact-level unit. A real
    # imported fact does; only explicitly supplied units can be checked here.
    if unit is None:
        return True
    expected = currency + ('/shares' if concept == 'Winst per aandeel (verwaterd)' else '')
    return unit == expected


def combine_filing_histories(results, expected_lei, years=10):
    """Merge independently imported filings without hiding restatements.

    Conflicting concepts are excluded, while other facts from the year remain.
    Currency disagreement excludes the entire period.
    """
    lei = validate_lei(expected_lei)
    if not isinstance(years, int) or isinstance(years, bool) or not 1 <= years <= 20:
        raise ValueError('Ongeldig aantal boekjaren')
    grouped = defaultdict(lambda: defaultdict(list))
    issues = []
    for result in results:
        filing = result.get('filing') or {}
        if filing.get('lei') != lei:
            issues.append('Rapportage met afwijkende LEI geweigerd')
            continue
        source = str(filing.get('filing_id') or filing.get('package_url') or 'onbekend')
        for row in result.get('annual_history') or []:
            end, currency = row.get('end'), row.get('unit')
            try:
                date.fromisoformat(end)
            except (TypeError, ValueError):
                issues.append('Feit met ongeldig boekjaareinde geweigerd')
                continue
            if not is_currency_code(currency):
                issues.append(f'{end}: ongeldige verslagvaluta geweigerd')
                continue
            for concept, fact in (row.get('facts') or {}).items():
                if not isinstance(fact, dict):
                    continue
                value = fact.get('val')
                if (not isinstance(value, (int, float)) or isinstance(value, bool)
                        or not math.isfinite(value)):
                    issues.append(f'{end}: {concept} heeft ongeldige numerieke waarde; geweigerd')
                    continue
                if str(fact.get('entity_id') or '').upper() != lei:
                    issues.append(f'{end}: feit met afwijkende entiteit geweigerd')
                    continue
                if not _valid_fact_unit(concept, fact, currency):
                    issues.append(f'{end}: {concept} heeft een afwijkende eenheid; geweigerd')
                    continue
                if fact.get('end') is not None and fact['end'] != end:
                    issues.append(f'{end}: {concept} heeft een afwijkende verslagperiode; geweigerd')
                    continue
                if concept == 'Eigen vermogen' and fact.get('start') is not None:
                    issues.append(f'{end}: eigen vermogen is geen balansstand; geweigerd')
                    continue
                grouped[(end, currency)][concept].append((value, fact, source))
    by_year = defaultdict(list)
    for (end, currency), concepts in grouped.items():
        by_year[end].append((currency, concepts))
    rows = []
    for end in sorted(by_year, reverse=True):
        if len(by_year[end]) != 1:
            issues.append(f'{end}: conflicterende verslagvaluta; boekjaar uitgesloten')
            continue
        currency, concepts = by_year[end][0]
        facts = {}
        for concept, candidates in concepts.items():
            vals = {value for value, _, _ in candidates}
            if len(vals) != 1:
                issues.append(f'{end}: {concept} verschilt tussen rapportages; uitgesloten')
                continue
            fact = dict(candidates[0][1])
            fact['sources'] = sorted({source for _, _, source in candidates})
            facts[concept] = fact
        # A balance-sheet-only filing still contributes a valid fiscal year.
        # Valuation readiness is assessed separately; do not discard equity.
        if facts:
            rows.append({'end': end, 'unit': currency, 'facts': facts, 'status': 'voorlopig'})
    # A calendar year may contain two different fiscal closing dates (e.g. a
    # change of financial year). Do not silently treat both as two NAIC years.
    # Preserve neither until the periods can be reconciled independently.
    calendar_year_ends = defaultdict(set)
    for row in rows:
        calendar_year_ends[row['end'][:4]].add(row['end'])
    ambiguous = {year for year, ends in calendar_year_ends.items() if len(ends) > 1}
    for year in sorted(ambiguous):
        issues.append(f'{year}: meerdere verschillende boekjaareindes; jaar uitgesloten')
    rows = [row for row in rows if row['end'][:4] not in ambiguous][:years]
    return rows, sorted(set(issues))
