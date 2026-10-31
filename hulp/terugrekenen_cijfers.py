"""Hulpmiddel (ontwikkeling): terugrekenen van het onderdeel "kwartaalcijfers tegenover de verwachting" (middellange termijn).

Gebruik: python hulp/terugrekenen_cijfers.py aandelen.json koersen.json.gz uitmap [cijfers.json]
  koersen.json.gz: de bewaarde dagkoersen van het terugrekenen van het trendsignaal (met '__index__' voor de indexkoersen).
  cijfers.json: eerder opgehaalde kwartaalcijfers; zonder dit bestand haalt het script ze bij Yahoo op (get_earnings_dates).

Twee toetsen:
 1. Per bekendmaking: het rendement t.o.v. de eigen index vanaf het slot van de eerste handelsdag NA de bekendmaking (de
    eerste koerssprong telt dus niet mee: alleen wat je nog kon halen) over 21, 63 en 126 handelsdagen, per groep verrassing.
 2. De regel van de app (web/js/termijn.js): elke maand (laatste handelsdag) het punt uit de laatste hoogstens 4 bekende
    verrassingen (+1: gemiddeld ≥ 3% en de laatste positief; −1: gemiddeld ≤ −3% of de laatste ≤ −5%), en het rendement
    daarna t.o.v. het gewone gemiddelde van alle fondsen in die maand; per maand +1 min −1, Newey-West.
Beperkingen: Yahoo bewaart ongeveer 5-6 jaar kwartaalcijfers; fondsen van nu; geen kosten.
"""
import bisect, gzip, json, sys, time
from datetime import date
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from bouw_webdata import index_voor

HORIZON_D = {'1 maand': 21, '3 maanden': 63, '6 maanden': 126}
HORIZON_M = {'m1': 1, 'm3': 3, 'm6': 6, 'm12': 12}
GROEPEN = [(-1e9, -5, 'onder −5%'), (-5, 0, '−5% tot 0'), (0, 5, '0 tot +5%'), (5, 10, '+5% tot +10%'), (10, 1e9, 'boven +10%')]


def haal_cijfers(tickers):
    import yfinance as yf
    uit = {}
    for t in tickers:
        try:
            ed = yf.Ticker(t).get_earnings_dates(limit=28)
            rij = []
            if ed is not None and not ed.empty:
                for idx, r in ed.iterrows():
                    sp, w = r.get('Surprise(%)'), r.get('Reported EPS')
                    if sp == sp and w == w and sp is not None:
                        rij.append([idx.date().isoformat(), round(float(sp), 2)])
            uit[t] = sorted(rij)
        except Exception as exc:
            uit[t] = {'fout': str(exc)[:100]}
        time.sleep(0.4)
    return uit


def punt(verrassingen):
    """Zelfde regel als Termijn.middellang (web/js/termijn.js): verrassingen nieuwste eerst, hoogstens 4."""
    if not verrassingen:
        return None
    gem = sum(verrassingen) / len(verrassingen)
    return 1 if gem >= 3 and verrassingen[0] > 0 else (-1 if gem <= -3 or verrassingen[0] <= -5 else 0)


def nw(reeks, lag):
    n = len(reeks)
    if n < 6:
        return None
    gem = sum(reeks) / n
    e = [x - gem for x in reeks]
    s = sum(x * x for x in e) / n
    for l in range(1, min(lag, n - 1) + 1):
        s += 2 * (1 - l / (lag + 1)) * sum(e[i] * e[i - l] for i in range(l, n)) / n
    return {'gemiddeld': round(gem, 2), 't': round(gem / (max(s, 1e-12) / n) ** 0.5, 2), 'positief': round(sum(1 for x in reeks if x > 0) / n * 100), 'n': n}


def stat(v):
    n = len(v)
    if n < 3:
        return {'n': n}
    gem = sum(v) / n
    sd = (sum((x - gem) ** 2 for x in v) / (n - 1)) ** 0.5
    s = sorted(v)
    return {'n': n, 'gemiddeld': round(gem, 2), 'mediaan': round(s[n // 2], 2), 'beter': round(sum(1 for x in v if x > 0) / n * 100), 't': round(gem / (sd / n ** 0.5 or 1), 2)}


def main():
    data = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    koersen = json.loads(gzip.decompress(Path(sys.argv[2]).read_bytes()))
    uit_map = Path(sys.argv[3]); uit_map.mkdir(parents=True, exist_ok=True)
    tickers = [a['ticker'] for a in data['aandelen']]
    if len(sys.argv) > 4 and Path(sys.argv[4]).exists():
        cijfers = json.loads(Path(sys.argv[4]).read_text(encoding='utf-8'))
    else:
        cijfers = haal_cijfers(tickers)
        (uit_map / 'cijfers.json').write_text(json.dumps(cijfers, separators=(',', ':')), encoding='utf-8')
    indexen = koersen.get('__index__') or {}

    # ---- toets 1: per bekendmaking, t.o.v. de eigen index ----
    per_groep = {h: {g[2]: [] for g in GROEPEN} for h in HORIZON_D}
    per_kwartaal = {h: {} for h in HORIZON_D}           # kwartaal -> [(verrassing, rendement)] voor de spreiding per kwartaal
    gebeurtenissen = 0
    for t in tickers:
        pts, cij = koersen.get(t) or [], cijfers.get(t)
        code = index_voor(t)
        ix = indexen.get(code) or [] if code else []
        if not pts or not isinstance(cij, list) or not ix:
            continue
        dagen = [p[0] for p in pts]
        ixd = dict((p[0], p[1]) for p in ix)
        for d, sp in cij:
            i = bisect.bisect_right(dagen, d)              # eerste handelsdag NA de bekendmaking
            if i >= len(pts) or pts[i][0] not in ixd:
                continue
            gebeurtenissen += 1
            groep = next(g[2] for g in GROEPEN if g[0] <= sp < g[1])
            kw = d[:4] + 'K' + str((int(d[5:7]) - 1) // 3 + 1)
            for h, n in HORIZON_D.items():
                j = i + n
                if j < len(pts) and pts[j][0] in ixd:
                    r = ((pts[j][1] / pts[i][1]) / (ixd[pts[j][0]] / ixd[pts[i][0]]) - 1) * 100
                    per_groep[h][groep].append(r)
                    per_kwartaal[h].setdefault(kw, []).append((sp, r))
    toets1 = {h: {g: stat(v) for g, v in gr.items()} for h, gr in per_groep.items()}
    # per kwartaal: gemiddelde van de verrassingen > +5% min die < 0 (zelfde kwartaal, dus dezelfde marktomstandigheden)
    spreiding1 = {}
    for h, kws in per_kwartaal.items():
        reeks = []
        for kw in sorted(kws):
            hoog = [r for sp, r in kws[kw] if sp > 5]; laag = [r for sp, r in kws[kw] if sp < 0]
            if len(hoog) >= 3 and len(laag) >= 3:
                reeks.append(sum(hoog) / len(hoog) - sum(laag) / len(laag))
        spreiding1[h] = nw(reeks, {'1 maand': 0, '3 maanden': 1, '6 maanden': 2}[h])

    # ---- toets 2: de regel van de app, maandelijks ----
    rijen = []
    for t in tickers:
        pts, cij = koersen.get(t) or [], cijfers.get(t)
        if not pts or not isinstance(cij, list) or not cij:
            continue
        einde = {}
        for i, (d, _) in enumerate(pts):
            einde[d[:7]] = i
        for maand, i in sorted(einde.items()):
            peil = pts[i][0]
            bekend = [sp for d, sp in cij if d < peil]          # bekendgemaakt vóór de peildag
            laatste = [sp for d, sp in cij if d < peil and (date.fromisoformat(peil) - date.fromisoformat(d)).days <= 400]
            if not laatste:
                continue
            p = punt(list(reversed(laatste))[:4])
            rij = {'t': t, 'maand': maand, 'punt': p}
            j0, m0 = int(maand[:4]), int(maand[5:])
            for naam, n in HORIZON_M.items():
                jj, mm = j0 + (m0 - 1 + n) // 12, (m0 - 1 + n) % 12 + 1
                ie = einde.get(f'{jj:04d}-{mm:02d}')
                if ie is not None and ie > i:
                    rij[naam] = (pts[ie][1] / pts[i][1] - 1) * 100
            rijen.append(rij)
    per_maand = {}
    for r in rijen:
        per_maand.setdefault(r['maand'], []).append(r)
    for lijst in per_maand.values():
        for h in HORIZON_M:
            v = [r[h] for r in lijst if h in r]
            if v:
                g = sum(v) / len(v)
                for r in lijst:
                    if h in r:
                        r['o' + h] = r[h] - g
    toets2 = {str(p): {h: stat([r['o' + h] for r in rijen if r['punt'] == p and 'o' + h in r]) for h in HORIZON_M} for p in (1, 0, -1)}
    spreiding2 = {}
    for h, n in HORIZON_M.items():
        reeks = []
        for m in sorted(per_maand):
            a = [r['o' + h] for r in per_maand[m] if r['punt'] == 1 and 'o' + h in r]
            b = [r['o' + h] for r in per_maand[m] if r['punt'] == -1 and 'o' + h in r]
            if len(a) >= 3 and len(b) >= 3:
                reeks.append(sum(a) / len(a) - sum(b) / len(b))
        spreiding2[h] = nw(reeks, n - 1)

    res = {'gebeurtenissen': gebeurtenissen, 'fondsen_met_cijfers': sum(1 for v in cijfers.values() if isinstance(v, list) and v),
           'van': min((c[0][0] for c in cijfers.values() if isinstance(c, list) and c), default=None),
           'toets1': toets1, 'spreiding1': spreiding1, 'toets2': toets2, 'spreiding2': spreiding2, 'waarnemingen2': len(rijen)}
    (uit_map / 'terugrekenen_cijfers.json').write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding='utf-8')
    f = lambda s: '–' if not s or s.get('n', 0) < 3 else f"{s['gemiddeld']:+}% gem · {s['mediaan']:+}% med · {s['beter']}% beter · n={s['n']}"
    fs = lambda s: '–' if not s else f"{s['gemiddeld']:+} pp · t={s['t']} · {s['positief']}% positief · {s['n']} perioden"
    md = f"# Terugrekenen kwartaalcijfers t.o.v. de verwachting\n\n{res['fondsen_met_cijfers']} fondsen met kwartaalcijfers (vanaf {res['van']}), {gebeurtenissen} bekendmakingen.\n\n"
    md += '## Toets 1: na de bekendmaking, t.o.v. de eigen index (vanaf de eerste handelsdag erna)\n\n| Verrassing | ' + ' | '.join(HORIZON_D) + ' |\n|---|---|---|---|\n'
    md += '\n'.join(f"| {g[2]} | " + ' | '.join(f(toets1[h][g[2]]) for h in HORIZON_D) + ' |' for g in GROEPEN) + '\n\n'
    md += 'Per kwartaal: verrassing boven +5% min onder 0 (Newey-West):\n\n' + '\n'.join(f"- {h}: {fs(spreiding1[h])}" for h in HORIZON_D) + '\n\n'
    md += f"## Toets 2: de regel van de app, maandelijks ({len(rijen)} waarnemingen; t.o.v. het gemiddelde van alle fondsen)\n\n| Punt | 1 maand | 3 maanden | 6 maanden | 12 maanden |\n|---|---|---|---|---|\n"
    md += '\n'.join(f"| {p} | " + ' | '.join(f(toets2[p][h]) for h in HORIZON_M) + ' |' for p in ('1', '0', '-1')) + '\n\n'
    md += 'Per maand +1 min −1 (Newey-West):\n\n' + '\n'.join(f"- {h}: {fs(spreiding2[h])}" for h in HORIZON_M) + '\n'
    (uit_map / 'terugrekenen_cijfers.md').write_text(md, encoding='utf-8')
    print(md)


if __name__ == '__main__':
    main()
