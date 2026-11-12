"""Hulpmiddel (ontwikkeling): hoeveel gewone aandelen is één ADR? Vergelijkt de ADR-koers (USD) met de koers op de eigen
beurs × wisselkoers, over de laatste 20 handelsdagen (mediaan).
Gebruik: python hulp/adr_verhouding.py ADR=THUIS:MUNT [...]   bijv. TSM=2330.TW:TWD"""
import sys, statistics
import yfinance as yf


def slot(t):
    h = yf.Ticker(t).history(period='2mo', interval='1d', auto_adjust=False)
    return {i.date().isoformat(): float(v) for i, v in h['Close'].dropna().items() if v > 0}


for paar in sys.argv[1:]:
    adr, rest = paar.split('=')
    thuis, munt = rest.split(':')
    try:
        a, b, fx = slot(adr), slot(thuis), slot(f'{munt}USD=X')
        dagen = sorted(set(a) & set(b) & set(fx))[-20:]
        r = [a[d] / (b[d] * fx[d]) for d in dagen]
        m = statistics.median(r)
        print(f'{adr:6} {thuis:14} {munt}  dagen {len(dagen):2}  verhouding {m:.4f}  (min {min(r):.4f}, max {max(r):.4f})', flush=True)
    except Exception as exc:
        print(adr, thuis, 'FOUT', type(exc).__name__, str(exc)[:100], flush=True)
