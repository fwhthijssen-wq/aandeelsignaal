"""Hulpmiddel voor ontwikkeling: zoekt in het AFM-register 'financiële verslaggeving' de jaarlijkse financiële verslagen van
de opgegeven bedrijven en jaren en downloadt ze (officieel gedeponeerde stukken). Gebruik:
  python hulp/afm_jaarverslagen.py uitmap "TICKER=Naam in register" ... --jaren 2016-2019
Schrijft per bedrijf TICKER/afm-<jaar>-<id>.pdf en index.json met meldingsdatum en documentsoort."""
import csv, io, json, os, re, sys, time, urllib.request, html
EXPORT = 'https://www.afm.nl/export.aspx?type=e8825b05-4004-4301-b736-651e8c61053d&format=csv'
DETAIL = 'https://www.afm.nl/nl-nl/sector/registers/meldingenregisters/financiele-verslaggeving/details?id={id}'
UA = {'User-Agent': 'Mozilla/5.0 (AandeelSignaal research)'}
def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        return r.read()
uit = sys.argv[1]
args = [a for a in sys.argv[2:] if '=' in a and not a.startswith('--')]
j0, j1 = map(int, (sys.argv[sys.argv.index('--jaren') + 1] if '--jaren' in sys.argv else '2016-2019').split('-'))
ruw = get(EXPORT).decode('utf-8-sig', 'ignore')
rijen = list(csv.reader(io.StringIO(ruw), delimiter=';'))
kop = [k.strip().lower() for k in rijen[0]]
print('kolommen:', kop, len(rijen))
os.makedirs(uit, exist_ok=True)
open(os.path.join(uit, 'afm_export_kolommen.txt'), 'w').write(';'.join(kop) + '\n' + '\n'.join(';'.join(r) for r in rijen[1:6]))
for a in args:
    ticker, naam = a.split('=', 1)
    gevonden = []
    for r in rijen[1:]:
        tekst = ' | '.join(r)
        if naam.lower() not in tekst.lower(): continue
        if not re.search(r'jaarlijks|annual', tekst, re.I) or re.search(r'halfjaar|semi', tekst, re.I): continue
        jr = [int(x) for x in re.findall(r'\b(20[12]\d)\b', tekst)]
        if not any(j0 <= x <= j1 for x in jr): continue
        gevonden.append(r)
    os.makedirs(os.path.join(uit, ticker), exist_ok=True)
    index = []
    for r in gevonden:
        d = dict(zip(kop, r))
        rid = next((v for k, v in d.items() if k in ('id', 'kenmerk', 'nummer')), None) or r[0]
        try:
            page = get(DETAIL.format(id=rid)).decode('utf-8', 'ignore')
            links = re.findall(r'href="([^"]*downloadregisterfile[^"]*)"', page)
            for n, l in enumerate(links):
                l = html.unescape(l)
                if l.startswith('/'): l = 'https://www.afm.nl' + l
                jaar = next((x for x in re.findall(r'\b(20[12]\d)\b', ' '.join(r)) if j0 <= int(x) <= j1), 'onbekend')
                pad = os.path.join(uit, ticker, f'afm-{jaar}-{rid}-{n}.pdf')
                open(pad, 'wb').write(get(l))
                index.append({'id': rid, 'rij': d, 'bestand': os.path.basename(pad), 'grootte': os.path.getsize(pad), 'url': l, 'detail': DETAIL.format(id=rid)})
                print('ok', ticker, pad, os.path.getsize(pad))
            time.sleep(1)
        except Exception as exc:
            print('fout', ticker, rid, exc)
    json.dump(index, open(os.path.join(uit, ticker, 'index.json'), 'w'), indent=1, ensure_ascii=False)
    print(ticker, len(gevonden), 'meldingen')
