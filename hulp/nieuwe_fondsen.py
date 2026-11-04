"""Hulpmiddel (ontwikkeling): nieuwe fondsen controleren vóór ze in de catalogus komen.
Per 'TICKER=Naam': koers en valuta bij Yahoo, en kandidaat-LEI's bij GLEIF (op naam, land NL), met het aantal ESEF-rapporten
bij filings.xbrl.org. Gebruik: python hulp/nieuwe_fondsen.py "ACOMO.AS=Acomo" "PNL.AS=PostNL" ..."""
import json, sys, time, urllib.parse, urllib.request

UA = {'User-Agent': 'AandeelSignaal/1.0 (+https://github.com/fwhthijssen-wq/aandeelsignaal)', 'Accept': 'application/vnd.api+json'}


def haal(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
        return json.loads(r.read().decode('utf-8'))


for arg in sys.argv[1:]:
    t, naam = arg.split('=', 1)
    regel = [t, naam]
    try:
        import yfinance as yf
        h = yf.Ticker(t).history(period='1mo')
        fi = yf.Ticker(t).fast_info
        regel.append(f"koers {round(float(h['Close'].iloc[-1]), 2) if len(h) else '-'} {fi.get('currency') if len(h) else ''} ({len(h)} dagen)")
    except Exception as exc:
        regel.append('yahoo fout ' + str(exc)[:60])
    try:
        q = urllib.parse.quote(naam)
        d = haal(f'https://api.gleif.org/api/v1/lei-records?filter[fulltext]={q}&filter[entity.legalAddress.country]=NL&page[size]=5')
        kand = []
        for x in d.get('data', [])[:5]:
            lei = x['id']; ln = x['attributes']['entity']['legalName']['name']
            try:
                f = haal(f'https://filings.xbrl.org/api/filings?filter[entity.identifier]={lei}&page[size]=100')
                n = len(f.get('data', []))
            except Exception:
                n = '?'
            kand.append(f'{lei} "{ln}" esef={n}')
            time.sleep(0.3)
        regel.append(' ; '.join(kand) or 'geen LEI gevonden')
    except Exception as exc:
        regel.append('gleif fout ' + str(exc)[:60])
    print(' | '.join(regel), flush=True)
    time.sleep(0.5)
