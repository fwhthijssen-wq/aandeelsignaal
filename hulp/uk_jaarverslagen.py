"""Hulpmiddel voor ontwikkeling: jaarlijkse financiële verslagen van Londense beursfondsen uit het officiële Britse register
(FCA National Storage Mechanism, data.fca.org.uk).

Gebruik:  python hulp/uk_jaarverslagen.py uitmap [TICKER=LEI ...] --jaren 2015-2019
Zonder TICKER=LEI: alle Londense noteringen (.L) uit esef_lei.json. Per bedrijf en boekjaar één jaarverslag, opgeslagen als
tekst (pdf via pdftotext -layout met \\f tussen pagina's; xhtml/html als platte tekst) met index.json (publicatiedatum,
soort, kop, officiële downloadlink) en zoeklog.json (alle gevonden meldingen, om te kunnen nagaan wat er was)."""
import html, io, json, os, re, subprocess, sys, time, urllib.request, zipfile

ZOEK = 'https://api.data.fca.org.uk/search?index=fca-nsm-searchdata'
ARTEFACT = 'https://data.fca.org.uk/artefacts/'
UA = {'User-Agent': 'Mozilla/5.0 (AandeelSignaal research)', 'Content-Type': 'application/json', 'Accept': 'application/json'}
JAARVERSLAG = re.compile(r'annual (financial )?report|annual report and accounts|final results|jaarverslag', re.I)
UITSLUITEN = re.compile(r'half[- ]?year|interim|quarter|q[1-4]\b|notice of|availability|form of proxy|agm|general meeting|'
                        r'publication of|posting of|circular|prospectus|transaction in own|director|holding', re.I)


def post(body):
    req = urllib.request.Request(ZOEK, data=json.dumps(body).encode(), headers=UA, method='POST')
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA['User-Agent']}), timeout=300) as r:
        return r.read()


def zoek(lei):
    """Alle meldingen van een LEI (laatste versie), nieuwste eerst. Probeert de bekende vorm van de zoekvraag van de NSM-site."""
    body = {'from': 0, 'size': 500, 'sortorder': 'desc', 'sort': 'publication_date',
            'criteriaObj': {'criteria': [{'name': 'latest_flag', 'value': 'Y'}, {'name': 'lei', 'value': ['', lei, 'disclose_org', 'related_org']}],
                            'dateCriteria': [{'name': 'publication_date', 'value': {'from': None, 'to': None}}]}}
    d = post(body)
    hits = (d.get('hits') or {}).get('hits') or []
    return [h.get('_source') or {} for h in hits], d


def tekst_uit(data, naam):
    if data[:4] == b'%PDF':
        p = '/tmp/uk_doc.pdf'
        open(p, 'wb').write(data)
        subprocess.run(['pdftotext', '-layout', p, '/tmp/uk_doc.txt'], check=False)
        return open('/tmp/uk_doc.txt', errors='ignore').read() if os.path.exists('/tmp/uk_doc.txt') else ''
    if data[:2] == b'PK':
        z = zipfile.ZipFile(io.BytesIO(data))
        kand = [n for n in z.namelist() if re.search(r'\.(xhtml|html?)$', n, re.I)]
        if not kand:
            pdfs = [n for n in z.namelist() if n.lower().endswith('.pdf')]
            return tekst_uit(z.read(pdfs[0]), pdfs[0]) if pdfs else ''
        data = z.read(max(kand, key=lambda n: z.getinfo(n).file_size))
    s = data.decode('utf-8', 'ignore')
    s = re.sub(r'data:[a-z/+]+;base64,[A-Za-z0-9+/=]+', '', s)
    s = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', s, flags=re.S)
    s = re.sub(r'</(p|div|tr|li|h\d)>', '\n', s)
    s = re.sub(r'</t[dh]>', '   ', s)
    s = html.unescape(re.sub(r'<[^>]+>', '', s))
    return re.sub(r'[ \t\xa0]{4,}', '   ', s)


def main():
    uit = sys.argv[1]
    paren = [a for a in sys.argv[2:] if '=' in a and not a.startswith('--')]
    if not paren:
        lei = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'esef_lei.json')))
        paren = [f'{t}={v["lei"]}' for t, v in sorted(lei.items()) if t.endswith('.L')]
    j0, j1 = map(int, (sys.argv[sys.argv.index('--jaren') + 1] if '--jaren' in sys.argv else '2015-2019').split('-'))
    for paar in paren:
        ticker, lei = [x.strip() for x in paar.split('=', 1)]
        map_ = os.path.join(uit, ticker)
        os.makedirs(map_, exist_ok=True)
        try:
            items, ruw = zoek(lei)
        except Exception as exc:
            print('zoekfout', ticker, exc); json.dump({'fout': str(exc)}, open(os.path.join(map_, 'zoeklog.json'), 'w')); continue
        log = [{k: it.get(k) for k in ('publication_date', 'type', 'type_code', 'headline', 'download_link', 'company', 'lei', 'source')} for it in items]
        json.dump({'aantal': len(items), 'meldingen': log, 'voorbeeld': items[:2], 'ruw_sleutels': list(ruw.keys())},
                  open(os.path.join(map_, 'zoeklog.json'), 'w'), indent=1, ensure_ascii=False, default=str)
        pad_index = os.path.join(map_, 'index.json')
        index = json.load(open(pad_index)) if os.path.exists(pad_index) else []
        gedaan = {x['boekjaar'] for x in index}
        per_jaar = {}
        for it in items:
            kop = f"{it.get('type') or ''} {it.get('headline') or ''}"
            datum = str(it.get('publication_date') or '')[:10]
            if not it.get('download_link') or not re.match(r'\d{4}-\d\d-\d\d', datum) or not JAARVERSLAG.search(kop) or UITSLUITEN.search(it.get('headline') or ''):
                continue
            boekjaar = int(datum[:4]) - 1 if datum[5:7] <= '09' else int(datum[:4])
            if j0 <= boekjaar <= j1:
                per_jaar.setdefault(boekjaar, []).append(it)
        print(ticker, len(items), {j: len(v) for j, v in sorted(per_jaar.items())}, flush=True)
        for boekjaar, kand in sorted(per_jaar.items()):
            if boekjaar in gedaan:
                continue
            # voorkeur: 'Annual Financial Report' boven 'Final Results'
            kand.sort(key=lambda it: (0 if re.search(r'annual financial report', str(it.get('type')), re.I) else 1 if re.search(r'annual report', str(it.get('headline')), re.I) else 2))
            for it in kand[:4]:
                link = it['download_link'] if it['download_link'].startswith('http') else ARTEFACT + it['download_link'].lstrip('/')
                try:
                    data = get(link)
                except Exception as exc:
                    print('downloadfout', ticker, boekjaar, link, exc); continue
                tekst = tekst_uit(data, link)
                if not (re.search(r'dilut', tekst, re.I) and re.search(r'per share', tekst, re.I)):
                    print('geen winst per aandeel', ticker, boekjaar, (it.get('headline') or '')[:60]); continue
                naam = f'uk-{boekjaar}.txt'
                open(os.path.join(map_, naam), 'w').write(tekst)
                index.append({'boekjaar': boekjaar, 'registerdatum': str(it.get('publication_date'))[:10], 'soort': it.get('type'),
                              'titel': it.get('headline'), 'bedrijf': it.get('company'), 'download': link, 'tekst': naam, 'grootte': len(data)})
                print('ok', ticker, boekjaar, it.get('type'), len(data), (it.get('headline') or '')[:60], flush=True)
                time.sleep(1)
                break
        json.dump(index, open(pad_index, 'w'), indent=1, ensure_ascii=False)


if __name__ == '__main__':
    main()
