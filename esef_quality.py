"""Brononafhankelijke, conservatieve ESEF-historiekwaliteitscontrole."""
from collections import Counter
from datetime import date
import math

CONCEPT_ALIASES = {'Investeringen': ('Investeringen', 'Investeringen in vaste activa')}
CORE = ('Omzet', 'Nettowinst', 'Winst per aandeel (verwaterd)',
        'Operationele kasstroom', 'Investeringen', 'Eigen vermogen')


def assess_history(history, conflicts=(), failures=(), years=10):
    if not 1 <= years <= 20:
        raise ValueError('Ongeldig aantal boekjaren.')
    observed = set()
    issues = list(conflicts) + list(failures)
    coverage = Counter()
    currencies = set()
    by_year = {}
    for row in history:
        end = row.get('end')
        try:
            fiscal_date = date.fromisoformat(end)
        except (TypeError, ValueError):
            issues.append('Boekjaar zonder geldige einddatum')
            continue
        if end in observed:
            issues.append(f'{end}: dubbel boekjaar')
            continue
        observed.add(end)
        currencies.add(row.get('unit'))
        facts = row.get('facts') or {}
        present = []
        for concept in CORE:
            aliases = CONCEPT_ALIASES.get(concept, (concept,))
            if any(isinstance(facts.get(alias), dict)
                   and isinstance(facts[alias].get('val'), (int, float))
                   and not isinstance(facts[alias]['val'], bool)
                   and math.isfinite(facts[alias]['val']) for alias in aliases):
                coverage[concept] += 1
                present.append(concept)
        by_year[end] = {'calendar_year': fiscal_date.year, 'currency': row.get('unit'),
                        'present': present, 'missing': [c for c in CORE if c not in present]}
    # Parent-attributable profit is a separate valuation prerequisite; it must
    # never be silently inferred from consolidated net profit.
    parent_profit_years = sum(
        1 for row in history
        if isinstance((row.get('facts') or {}).get('Winst toerekenbaar aan aandeelhouders'), dict)
        and isinstance(row['facts']['Winst toerekenbaar aan aandeelhouders'].get('val'), (int, float))
        and not isinstance(row['facts']['Winst toerekenbaar aan aandeelhouders']['val'], bool)
        and math.isfinite(row['facts']['Winst toerekenbaar aan aandeelhouders']['val'])
    )
    if parent_profit_years < years:
        issues.append(f'Winst voor aandeelhouders afzonderlijk vastgesteld: {parent_profit_years} van {years} boekjaren')
    if len(currencies) > 1:
        issues.append('Verslagvaluta verschilt tussen boekjaren; groeiberekeningen blokkeren')
    calendar_years = sorted({info['calendar_year'] for info in by_year.values()}, reverse=True)
    if calendar_years:
        missing_calendar_years = [y for y in range(calendar_years[0], calendar_years[0] - years, -1)
                                  if y not in calendar_years]
        if missing_calendar_years:
            issues.append('Ontbrekende kalenderjaren binnen analysevenster: ' +
                          ', '.join(str(y) for y in missing_calendar_years))
    else:
        missing_calendar_years = []
    if len(observed) < years:
        issues.append(f'Historie onvolledig: {len(observed)} van {years} boekjaren')
    if len(calendar_years) < len(observed):
        issues.append('Meerdere boekjaareindes in hetzelfde kalenderjaar; controleer verslagperioden')
    return {'years_found': len(observed), 'years_requested': years,
            'coverage': {**{concept: {'found': coverage[concept], 'years': years} for concept in CORE},
                         'Winst toerekenbaar aan aandeelhouders': {'found': parent_profit_years, 'years': years}},
            'year_details': by_year, 'missing_calendar_years': missing_calendar_years,
            'issues': sorted(set(issues)), 'valuation_ready': False,
            'status': 'voorlopig: taxonomie, consolidatie en vergelijkbaarheid niet volledig gevalideerd'}
