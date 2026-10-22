"""Hulpmiddel voor ontwikkeling: zoekt in het AFM-register 'financiële verslaggeving' de jaarlijkse financiële verslagen van
de opgegeven bedrijven en jaren en downloadt ze (officieel gedeponeerde stukken). Gebruik:
  python hulp/afm_jaarverslagen.py uitmap "TICKER=Exacte naam in register" ... --jaren 2016-2019
Schrijft per bedrijf TICKER/afm-<boekjaar>-<id>-<n>.<ext> en index.json met deponeringsdatum en documentsoort."""
import html, json, os, re, sys, time, urllib.parse, urllib.request
BASE = 'https://www.afm.nl'
ZOEK = BASE + '/nl-nl/sector/registers/meldingenregisters/financiele-verslaggeving?keywords={kw}&page={p}'
UA = {'User-Agent': 'Mozilla/5.0 (AandeelSignaal research)'}
def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
        return r.read(), r.headers.get('Content-Disposition', ''), r.headers.get('Content-Type', '')
uit = sys.argv[1]
args = [a for a in sys.argv[2:] if '=' in a and not a.startswith('--')]
j0, j1 = map(int, (sys.argv[sys.argv.index('--jaren') + 1] if '--jaren' in sys.argv else '2016-2019').split('-'))
RIJ = re.compile(r'<tr class="jq_registers_register-paged-list_results_tr">\s*<td>\s*<a href="([^"]+)"[^>]*>\s*([^<]+?)\s*</a>\s*</td>\s*<td>\s*([^<]+?)\s*</td>\s*<td>\s*(\d{4})\s*</td>\s*<td>\s*([^<]+?)\s*</td>', re.S)
for a in args:
    ticker, naam = [x.strip() for x in a.split('=', 1)]
    namen = [n.strip() for n in naam.split('|') if n.strip()]     # oude en nieuwe statutaire naam: 'Naam A|Naam B'
    os.makedirs(os.path.join(uit, ticker), exist_ok=True)
    rijen = []
    for zoek in namen:
        p = 1
        while p <= 20:
            page = get(ZOEK.format(kw=urllib.parse.quote(zoek), p=p))[0].decode('utf-8', 'ignore')
            nieuw = [(html.unescape(h), d, html.unescape(b), int(j), html.unescape(s)) for h, d, b, j, s in RIJ.findall(page)]
            if not nieuw: break
            rijen += nieuw; p += 1
    print(ticker, 'namen in register:', sorted({r[2] for r in rijen})[:15])
    pad_index = os.path.join(uit, ticker, 'index.json')
    index = json.load(open(pad_index)) if os.path.exists(pad_index) else []
    al = {x['detail'] for x in index}
    for href, datum, bedrijf, jaar, soort in rijen:
        if bedrijf.lower() not in [n.lower() for n in namen] or not (j0 <= jaar <= j1) or not soort.lower().startswith('jaarlijkse'):
            continue
        detail = BASE + href if href.startswith('/') else href
        if detail in al: continue
        al.add(detail)
        rid = re.search(r'id=([^&]+)', href).group(1)
        dpage = get(detail)[0].decode('utf-8', 'ignore')
        for n, l in enumerate(re.findall(r'href="([^"]*downloadregisterfile[^"]*)"', dpage)):
            l = html.unescape(l); l = BASE + l if l.startswith('/') else l
            data, cd, ct = get(l)
            ext = (re.search(r'\.(\w+)"?\s*$', cd) or re.search(r'/(pdf|zip|xhtml|html)', ct) or [None, 'bin'])[1]
            pad = os.path.join(uit, ticker, f'afm-{jaar}-{rid}-{n}.{ext.lower()}')
            open(pad, 'wb').write(data)
            index.append({'boekjaar': jaar, 'deponering': datum, 'soort': soort, 'bedrijf': bedrijf, 'bestand': os.path.basename(pad),
                          'grootte': len(data), 'detail': detail, 'download': l, 'bestandsnaam': cd})
            print('ok', ticker, jaar, datum, pad, len(data), cd)
        time.sleep(1)
    json.dump(index, open(pad_index, 'w'), indent=1, ensure_ascii=False)
    print(ticker, len(rijen), 'meldingen gevonden,', len(index), 'bestanden')
