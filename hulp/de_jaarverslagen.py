"""Hulpmiddel (ontwikkeling): Duitse jaarverslagen (pdf) ophalen en als tekst bewaren, om daarna winst per aandeel, aantal
aandelen en winst uit te lezen (hulp/pdf_uitlezen.py). Gebruik: python hulp/de_jaarverslagen.py uitmap [TICKER ...] [--jaren 2016-2025]
Per boekjaar eerst het directe adres uit hulp/de_jaarverslagen.json; anders het vaste patroon van EQS (Engels, dan Duits).
Schrijft uitmap/{TICKER}/{jaar}.txt (pdftotext -layout) en uitmap/index.json met adres, grootte en sha256 per document."""
import hashlib, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from pathlib import Path

HIER = Path(__file__).resolve().parent
UA = {'User-Agent': 'Mozilla/5.0 (compatible; AandeelSignaal/1.0; +https://github.com/fwhthijssen-wq/aandeelsignaal)'}
EQS_HOSTS = ('https://irpages2.eqs.com/Download/Companies', 'https://www.more-ir.de/download/companies')


def haal(url):
    req = urllib.request.Request(urllib.parse.quote(url, safe=':/?=&%'), headers=UA)
    with urllib.request.urlopen(req, timeout=180) as r:
        data = r.read()
    return data if data[:4] == b'%PDF' else None


def kandidaten(spec, jaar):
    u = (spec.get('urls') or {}).get(str(jaar))
    if u:
        yield u, 'beleggerssite'
    for host in EQS_HOSTS:
        for taal in ('E', 'D'):
            yield f"{host}/{spec['slug']}/Annual Reports/{spec['isin']}-JA-{jaar}-EQ-{taal}-00.pdf", 'EQS'


def main():
    args = sys.argv[1:]
    jaren = '2016-2025'
    if '--jaren' in args:
        i = args.index('--jaren'); jaren = args[i + 1]; del args[i:i + 2]
    uit = Path(args[0]); tickers = args[1:]
    j0, j1 = (int(x) for x in jaren.split('-'))
    lijst = {k: v for k, v in json.load(open(HIER / 'de_jaarverslagen.json')).items() if not k.startswith('_')}
    index_pad = uit / 'index.json'
    index = json.load(open(index_pad)) if index_pad.exists() else {}
    for t in tickers or list(lijst):
        spec = lijst[t]
        for jaar in range(j0, j1 + 1):
            if str(jaar) in index.get(t, {}):
                continue
            for url, bron in kandidaten(spec, jaar):
                try:
                    data = haal(url)
                except Exception as exc:
                    data = None
                time.sleep(1)
                if not data:
                    continue
                with tempfile.NamedTemporaryFile(suffix='.pdf') as f:
                    f.write(data); f.flush()
                    tekst = subprocess.run(['pdftotext', '-layout', f.name, '-'], capture_output=True, text=True).stdout
                (uit / t).mkdir(parents=True, exist_ok=True)
                (uit / t / f'{jaar}.txt').write_text(tekst, encoding='utf-8')
                index.setdefault(t, {})[str(jaar)] = {'url': url, 'bron': bron, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'tekens': len(tekst)}
                print('ok', t, jaar, bron, len(data), flush=True)
                break
            else:
                print('niet gevonden', t, jaar, flush=True)
        index_pad.parent.mkdir(parents=True, exist_ok=True)
        json.dump(index, open(index_pad, 'w'), indent=1, sort_keys=True)


if __name__ == '__main__':
    main()
