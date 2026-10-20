"""Indicatieve NAIC-scenario's uit onbewerkte EPS; nooit als gevalideerd advies.

De module toont wat de beschikbare cijfers impliceren zonder te beweren dat
historische EPS op dezelfde aandelenbasis staat. Geen splitsingscorrecties.
"""
from math import isfinite
from naic_valuation import scenario_table


def provisional_naic_preview(dossier, *, growth_rates=(0, 5, 10), pe_values=(10, 15, 20),
                             years=5, required=10, safety=25):
    rows = dossier.get('rows') or []
    if not rows:
        return {'status': 'geen_jaarhistorie', 'approved': False, 'scenarios': []}
    latest = max(rows, key=lambda r: r['end'])
    eps = latest.get('reported_eps')
    currency = latest.get('currency')
    if not isinstance(eps, (int, float)) or isinstance(eps, bool) or not isfinite(eps) or eps <= 0:
        return {'status': 'geen_bruikbare_eps', 'approved': False, 'scenarios': []}
    if not isinstance(currency, str) or len(currency) != 3 or not currency.isalpha():
        return {'status': 'ongeldige_valuta', 'approved': False, 'scenarios': []}
    scenarios = scenario_table(eps, currency, growth_rates, pe_values,
                               years=years, required=required, safety=safety)
    return {
        'status': 'illustratief_niet_gevalideerd', 'approved': False,
        'eps_bronjaar': latest['year'], 'eps_bronwaarde': eps,
        'eps_type': 'gerapporteerd_onbewerkt', 'currency': currency,
        'growth_rates_user_assumptions': list(growth_rates),
        'pe_user_assumptions': list(pe_values),
        'scenarios': scenarios,
        'warnings': [
            'Scenario gebruikt onbewerkte gerapporteerde EPS; historische aandelensplitsingen zijn niet gevalideerd.',
            'Groeipercentages en K/W-verhoudingen zijn illustratieve aannames, geen uit brondata afgeleide verwachtingen.',
            'Geen gevalideerde intrinsieke waarde, koopadvies of automatisch beleggingssignaal.',
        ],
    }
