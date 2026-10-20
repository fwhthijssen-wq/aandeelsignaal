"""NAIC scenario's op basis van bestaande EPS-bronnen; geen automatische goedkeuring."""
from math import isfinite
from valuation_scenarios import scenario


def eps_candidate(history, normalized):
    """Laatste positieve voorlopige EPS, met herkomst; nooit 'gevalideerd'."""
    for row in sorted(history, key=lambda x: x.get('end', ''), reverse=True):
        end = row.get('end')
        entry = normalized.get(end, {})
        eps = entry.get('EPS vergelijkbaar')
        if isinstance(eps, (int, float)) and not isinstance(eps, bool) and isfinite(eps) and eps > 0:
            return {'eps': eps, 'year_end': end, 'status': entry.get('Status', 'Voorlopig'),
                    'currency': row.get('unit'), 'approved': False}
    return None


def scenario_table(eps, currency, growth_rates, pe_values, years=5, required=10, safety=25):
    """Drie expliciete scenario's; niet hetzelfde als een automatisch koersadvies."""
    if len(growth_rates) != 3 or len(pe_values) != 3:
        raise ValueError('Drie scenario-aannames vereist.')
    result = []
    for label, growth, pe in zip(('Voorzichtig', 'Gemiddeld', 'Gunstig'), growth_rates, pe_values):
        values = scenario(eps, growth, pe, years, required, safety)
        result.append({'Scenario': label, 'EPS-groei p.j. (%)': growth, 'K/W eindjaar': pe,
                       'EPS na horizon': round(values['Toekomstige EPS'], 2),
                       'Indicatieve waarde nu': round(values['Contante indicatieve waarde'], 2),
                       'Waarde na veiligheidsmarge': round(values['Prijs na veiligheidsmarge'], 2),
                       'Valuta': currency})
    return result
