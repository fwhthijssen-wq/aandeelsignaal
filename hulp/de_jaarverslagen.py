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
    for slug in spec.get('slugs') or [spec['slug']]:
        for host in EQS_HOSTS:
            for taal in ('E', 'D'):
                yield f"{host}/{slug}/Annual Reports/{spec['isin']}-JA-{jaar}-EQ-{taal}-00.pdf", 'EQS'


def werkende_slug(spec):
    """Welke EQS-mapnaam levert voor dit fonds een verslag op (proef met de laatste jaren)? Zet spec['slugs'] op die ene."""
    for jaar in (2024, 2023, 2022, 2021):
        for slug in spec.get('slugs') or [spec['slug']]:
            for host in EQS_HOSTS:
                for taal in ('E', 'D'):
                    url = f"{host}/{slug}/Annual Reports/{spec['isin']}-JA-{jaar}-EQ-{taal}-00.pdf"
                    try:
                        req = urllib.request.Request(urllib.parse.quote(url, safe=':/?=&%'), headers=dict(UA, Range='bytes=0-7'))
                        with urllib.request.urlopen(req, timeout=60) as r:
                            if r.read(8)[:4] == b'%PDF':
                                spec['slugs'] = [slug]
                                return slug
                    except Exception:
                        pass
                    time.sleep(0.3)
    return None


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
        if not spec.get('urls') and len(spec.get('slugs') or []) > 1:
            slug = werkende_slug(spec)
            print('mapnaam', t, slug, flush=True)
            if not slug:
                continue
        for jaar in range(j0, j1 + 1):
            # Elk adres apart proberen (beleggerssite én EQS): EQS sorteert bij een gebroken boekjaar soms op beginjaar,
            # zodat hetzelfde bestandsjaar een ander boekjaar kan zijn. Het boekjaar komt later uit de tekst zelf.
            for url, bron in kandidaten(spec, jaar):
                sleutel = f'{jaar}' if bron == 'beleggerssite' else f'{jaar}-eqs'
                if sleutel in index.get(t, {}) or (bron == 'EQS' and any(v.get('url') == url for v in index.get(t, {}).values())):
                    continue
                if bron == 'EQS' and f'{jaar}-eqs' in index.get(t, {}):
                    continue
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
                sha = hashlib.sha256(data).hexdigest()
                if any(v.get('sha256') == sha for v in index.get(t, {}).values()):
                    continue                                           # zelfde document al binnen
                (uit / t).mkdir(parents=True, exist_ok=True)
                (uit / t / f'{sleutel}.txt').write_text(tekst, encoding='utf-8')
                index.setdefault(t, {})[sleutel] = {'url': url, 'bron': bron, 'bytes': len(data), 'sha256': sha, 'tekens': len(tekst)}
                print('ok', t, sleutel, bron, len(data), flush=True)
                if bron == 'EQS':
                    break                                              # één EQS-variant per jaar (Engels, anders Duits)
        index_pad.parent.mkdir(parents=True, exist_ok=True)
        json.dump(index, open(index_pad, 'w'), indent=1, sort_keys=True)


if __name__ == '__main__':
    main()
