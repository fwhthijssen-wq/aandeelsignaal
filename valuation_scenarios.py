"""Transparent NAIC-style illustrative EPS/PE scenarios, no investment recommendation."""
import math

def scenario(eps, growth_pct, future_pe, years, required_return_pct, margin_pct):
    vals = (eps, growth_pct, future_pe, required_return_pct, margin_pct)
    if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in vals):
        raise ValueError('Alle aannames moeten eindige getallen zijn.')
    if eps <= 0 or future_pe <= 0 or years not in range(1, 11):
        raise ValueError('EPS en toekomstige K/W moeten positief zijn; horizon 1–10 jaar.')
    if not (-100 < growth_pct <= 100 and 0 <= required_return_pct <= 50 and 0 <= margin_pct < 100):
        raise ValueError('Groei, rendement of veiligheidsmarge buiten toegestaan bereik.')
    future_eps = eps * (1 + growth_pct / 100) ** years
    future_price = future_eps * future_pe
    present_value = future_price / (1 + required_return_pct / 100) ** years
    return {'Toekomstige EPS': future_eps, 'Veronderstelde koers over horizon': future_price,
            'Contante indicatieve waarde': present_value,
            'Prijs na veiligheidsmarge': present_value * (1 - margin_pct / 100)}
