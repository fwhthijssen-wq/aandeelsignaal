"""Hoogste en laagste slotkoers en dividend per boekjaar, uit dagkoersen. Geen schattingen: te weinig of gaten = None.

Koersen zijn splitsingscorrect maar niet dividendgecorrigeerd (zoals een koers op een bepaalde dag werkelijk was).
Dividend per aandeel is de som van de uitkeringen met ex-datum in het boekjaar.
"""
from datetime import date, timedelta

MIN_HANDELSDAGEN = 200      # een volledig boekjaar heeft ongeveer 250 handelsdagen
MAX_GAT_DAGEN = 12          # begin en einde van het boekjaar moeten door koersen gedekt zijn


def _dag(x):
    try:
        return date.fromisoformat(str(x)[:10])
    except (TypeError, ValueError):
        return None


def _getal(x):
    return float(x) if isinstance(x, (int, float)) and not isinstance(x, bool) and x == x and abs(x) != float('inf') else None


def jaarkoersen(punten, dividenden, einddata):
    """punten: [(datum, slot)], dividenden: [(datum, bedrag)], einddata: ['YYYY-MM-DD', ...] (boekjaar-einden).
    Geeft {einddatum: {'koers_hoog', 'koers_laag', 'dividend_ps'}}; elk veld None als het niet betrouwbaar kan."""
    schoon = []
    for d, k in punten or []:
        dd, kk = _dag(d), _getal(k)
        if dd is not None and kk is not None and kk > 0:
            schoon.append((dd, kk))
    schoon.sort()
    divs = []
    for d, b in dividenden or []:
        dd, bb = _dag(d), _getal(b)
        if dd is not None and bb is not None and bb > 0:
            divs.append((dd, bb))
    ends = sorted({e for e in (_dag(x) for x in einddata or []) if e is not None})
    uit = {}
    for i, eind in enumerate(ends):
        start = (ends[i - 1] if i else eind - timedelta(days=365)) + timedelta(days=1)
        blok = {'koers_hoog': None, 'koers_laag': None, 'dividend_ps': None}
        uit[eind.isoformat()] = blok
        periode = [k for d, k in schoon if start <= d <= eind]
        if len(periode) < MIN_HANDELSDAGEN:
            continue
        data = [d for d, _ in schoon if start <= d <= eind]
        if (data[0] - start).days > MAX_GAT_DAGEN or (eind - data[-1]).days > MAX_GAT_DAGEN:
            continue
        blok['koers_hoog'], blok['koers_laag'] = round(max(periode), 4), round(min(periode), 4)
        som = sum(b for d, b in divs if start <= d <= eind)
        blok['dividend_ps'] = round(som, 4) if som > 0 else None   # geen uitkering gevonden = onbekend, niet "nul"
    return uit
