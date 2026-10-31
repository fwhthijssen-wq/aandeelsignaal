"""Verwachtingen van analisten voor de middellange en korte termijn (Yahoo Finance), ter informatie.

- Bijstellingen: hoe de gemiddelde verwachte winst per aandeel voor dit en volgend boekjaar veranderde in 30 en 90 dagen,
  en hoeveel analisten hun schatting de afgelopen 30 dagen verhoogden of verlaagden.
- Verrassingen: de laatste (hoogstens 4) kwartaalcijfers tegenover de verwachting vooraf.
- De datum van de volgende kwartaalcijfers.
Alleen percentages en aantallen, zodat de munt (bijv. pence) niet uitmaakt. Ontbreekt iets, dan staat het er niet.
"""
from datetime import date


def _getal(x):
    try:
        x = float(x)
    except (TypeError, ValueError):
        return None
    return x if x == x and abs(x) != float('inf') else None


def _pct(nu, toen):
    nu, toen = _getal(nu), _getal(toen)
    if nu is None or toen is None or toen == 0:
        return None
    return round((nu / toen - 1) * 100 * (1 if toen > 0 else -1), 1) + 0.0


def verwachting(trend, revisies, cijfers, vandaag):
    """trend: {periode: {'current', '30daysAgo', '90daysAgo'}}; revisies: {periode: {'upLast30days', 'downLast30days'}};
    cijfers: [(datum 'YYYY-MM-DD', verwacht, werkelijk, verrassing_pct)] in willekeurige volgorde (werkelijk None = nog niet bekend).
    Periodes: '0y' dit boekjaar, '+1y' volgend boekjaar."""
    uit = {'datum': vandaag, 'bron': 'Yahoo Finance'}
    jaren = {}
    for p, naam in (('0y', 'dit_jaar'), ('+1y', 'volgend_jaar')):
        t = (trend or {}).get(p) or {}
        r = (revisies or {}).get(p) or {}
        x = {'d30': _pct(t.get('current'), t.get('30daysAgo')), 'd90': _pct(t.get('current'), t.get('90daysAgo'))}
        up, dn = _getal(r.get('upLast30days')), _getal(r.get('downLast30days'))
        if up is not None and dn is not None:
            x['omhoog'], x['omlaag'] = int(up), int(dn)
        x = {k: v for k, v in x.items() if v is not None}
        if x:
            jaren[naam] = x
    if jaren:
        uit['bijstelling'] = jaren
    gemeld, komend = [], []
    for d, verw, werk, sp in cijfers or []:
        if not d:
            continue
        verw, werk, sp = _getal(verw), _getal(werk), _getal(sp)
        if werk is None:
            if d >= vandaag:
                komend.append(d)
            continue
        if sp is None and verw:
            sp = (werk / verw - 1) * 100 * (1 if verw > 0 else -1)
        if sp is not None and d <= vandaag:
            gemeld.append({'datum': d, 'pct': round(sp, 1) + 0.0})
    gemeld.sort(key=lambda x: x['datum'], reverse=True)
    if gemeld:
        uit['verrassingen'] = gemeld[:4]
    if komend:
        uit['volgende_cijfers'] = min(komend)
    return uit if len(uit) > 2 else None


def _uit_frame(df, kolommen):
    """DataFrame met periodes als index naar {periode: {kolom: waarde}}."""
    if df is None or getattr(df, 'empty', True):
        return {}
    uit = {}
    for idx, rij in df.iterrows():
        uit[str(idx)] = {k: rij.get(k) for k in kolommen if k in rij}
    return uit


def yahoo_verwachting(ticker, vandaag=None):
    import yfinance as yf
    vandaag = vandaag or date.today().isoformat()
    t = yf.Ticker(ticker)
    trend, revisies, cijfers = {}, {}, []
    try:
        trend = _uit_frame(t.eps_trend, ('current', '30daysAgo', '90daysAgo'))
    except Exception:
        pass
    try:
        revisies = _uit_frame(t.eps_revisions, ('upLast30days', 'downLast30days'))
    except Exception:
        pass
    try:
        ed = t.get_earnings_dates(limit=12)
        if ed is not None and not ed.empty:
            for idx, rij in ed.iterrows():
                cijfers.append((idx.date().isoformat(), rij.get('EPS Estimate'), rij.get('Reported EPS'), rij.get('Surprise(%)')))
    except Exception:
        pass
    if not any(d >= vandaag for d, _, w, _ in cijfers if _getal(w) is None):
        try:                                                    # terugval: de agenda
            cal = t.calendar or {}
            for d in cal.get('Earnings Date') or []:
                cijfers.append((d.isoformat(), None, None, None))
        except Exception:
            pass
    return verwachting(trend, revisies, cijfers, vandaag)
