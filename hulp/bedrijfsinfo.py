"""Hulpmiddel voor ontwikkeling: korte bedrijfsbeschrijving en vaste gegevens per fonds uit Wikidata (CC0) en Wikipedia (CC BY-SA).

Gebruik:  python hulp/bedrijfsinfo.py hulp/bedrijfsinfo_lijst.json uit.json
Koppeling alleen op harde sleutels: LEI (Wikidata P1278) of SEC-CIK (P5531). Zonder sleutel: zoeken op naam, en dan alleen een
treffer die beursgenoteerd is (P414); die worden gemarkeerd ('gevonden_op': 'naam') om na te kijken.
Per fonds: Wikidata-item, sector (P452), hoofdkantoor (P159), oprichtingsjaar (P571), website (P856) en de eerste alinea van het
Wikipedia-artikel (Nederlands, anders Engels) met link, zodat de bron vermeld kan worden."""
import json, re, sys, time, urllib.parse, urllib.request

UA = {'User-Agent': 'AandeelSignaal/1.0 (https://github.com/fwhthijssen-wq/aandeelsignaal; research)', 'Accept': 'application/json'}
SPARQL = 'https://query.wikidata.org/sparql?format=json&query='


def get(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
                return json.loads(r.read())
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(5 * (i + 1))


def sparql(q):
    return get(SPARQL + urllib.parse.quote(q))['results']['bindings']


def items_voor(prop, waarden):
    """{waarde: Q-id} voor Wikidata-items met prop = waarde."""
    uit = {}
    for i in range(0, len(waarden), 80):
        stuk = waarden[i:i + 80]
        vals = ' '.join('"%s"' % w for w in stuk)
        for r in sparql(f'SELECT ?item ?w WHERE {{ VALUES ?w {{ {vals} }} ?item wdt:{prop} ?w. }}'):
            uit.setdefault(r['w']['value'], r['item']['value'].rsplit('/', 1)[1])
        time.sleep(1)
    return uit


def details(qids):
    uit = {}
    for i in range(0, len(qids), 60):
        stuk = ' '.join('wd:' + q for q in qids[i:i + 60])
        q = f'''SELECT ?item ?nlTitel ?enTitel ?sectorNl ?sectorEn ?hqNl ?hqEn ?opgericht ?website ?bescNl ?bescEn WHERE {{
          VALUES ?item {{ {stuk} }}
          OPTIONAL {{ ?nl schema:about ?item; schema:isPartOf <https://nl.wikipedia.org/>; schema:name ?nlTitel. }}
          OPTIONAL {{ ?en schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?enTitel. }}
          OPTIONAL {{ ?item wdt:P452 ?s. OPTIONAL {{ ?s rdfs:label ?sectorNl FILTER(lang(?sectorNl)="nl") }} OPTIONAL {{ ?s rdfs:label ?sectorEn FILTER(lang(?sectorEn)="en") }} }}
          OPTIONAL {{ ?item wdt:P159 ?h. OPTIONAL {{ ?h rdfs:label ?hqNl FILTER(lang(?hqNl)="nl") }} OPTIONAL {{ ?h rdfs:label ?hqEn FILTER(lang(?hqEn)="en") }} }}
          OPTIONAL {{ ?item wdt:P571 ?opgericht. }}
          OPTIONAL {{ ?item wdt:P856 ?website. }}
          OPTIONAL {{ ?item schema:description ?bescNl FILTER(lang(?bescNl)="nl") }}
          OPTIONAL {{ ?item schema:description ?bescEn FILTER(lang(?bescEn)="en") }}
        }}'''
        for r in sparql(q):
            qid = r['item']['value'].rsplit('/', 1)[1]
            d = uit.setdefault(qid, {'sector': [], 'hoofdkantoor': None, 'opgericht': None, 'website': None, 'nl': None, 'en': None, 'kort': None})
            v = lambda k: r.get(k, {}).get('value')
            s = v('sectorNl') or v('sectorEn')
            if s and s not in d['sector']:
                d['sector'].append(s)
            d['hoofdkantoor'] = d['hoofdkantoor'] or v('hqNl') or v('hqEn')
            if v('opgericht'):
                j = int(v('opgericht')[:4]) if re.match(r'\d{4}', v('opgericht')) else None
                d['opgericht'] = min(x for x in (d['opgericht'], j) if x) if j else d['opgericht']
            d['website'] = d['website'] or v('website')
            d['nl'] = d['nl'] or v('nlTitel'); d['en'] = d['en'] or v('enTitel')
            d['kort'] = d['kort'] or v('bescNl') or v('bescEn')
        time.sleep(1)
    return uit


def samenvatting(taal, titel):
    d = get(f'https://{taal}.wikipedia.org/api/rest_v1/page/summary/' + urllib.parse.quote(titel.replace(' ', '_')))
    return d.get('extract'), (d.get('content_urls') or {}).get('desktop', {}).get('page')


def op_naam(naam):
    d = get('https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=5&search=' + urllib.parse.quote(naam))
    for kand in d.get('search', []):
        e = get(f'https://www.wikidata.org/wiki/Special:EntityData/{kand["id"]}.json')['entities'][kand['id']]
        if 'P414' in e.get('claims', {}):
            return kand['id']
    return None


def main():
    lijst = json.load(open(sys.argv[1]))
    leis = items_voor('P1278', sorted({x['lei'] for x in lijst if x.get('lei')}))
    ciks = sorted({str(x['cik']).zfill(10) for x in lijst if x.get('cik')})
    cikmap = items_voor('P5531', ciks)
    cikmap.update({k.lstrip('0'): v for k, v in items_voor('P5531', [c.lstrip('0') for c in ciks]).items()})
    koppel = {}
    for x in lijst:
        q = leis.get(x.get('lei') or '') or cikmap.get(str(x.get('cik') or '').zfill(10)) or cikmap.get(str(x.get('cik') or ''))
        hoe = 'LEI' if x.get('lei') and leis.get(x['lei']) else ('CIK' if q else None)
        if not q:
            try:
                q = op_naam(x['naam']); hoe = 'naam' if q else None
            except Exception:
                q = None
        if q:
            koppel[x['ticker']] = (q, hoe)
        print(x['ticker'], q, hoe, flush=True)
    det = details(sorted({q for q, _ in koppel.values()}))
    uit = {}
    for t, (q, hoe) in koppel.items():
        d = det.get(q, {})
        tekst, url, taal = None, None, None
        for tl in ('nl', 'en'):
            if d.get(tl):
                try:
                    tekst, url = samenvatting(tl, d[tl]); taal = tl
                except Exception:
                    tekst = None
                if tekst:
                    break
                time.sleep(0.5)
        uit[t] = {'wikidata': q, 'gevonden_op': hoe, 'sector': d.get('sector', [])[:3], 'hoofdkantoor': d.get('hoofdkantoor'),
                  'opgericht': d.get('opgericht'), 'website': d.get('website'), 'kort': d.get('kort'),
                  'beschrijving': tekst, 'taal': taal, 'wikipedia': url}
        time.sleep(0.3)
    json.dump(uit, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
    print('klaar', len(uit), 'van', len(lijst), 'met beschrijving', sum(1 for v in uit.values() if v['beschrijving']))


if __name__ == '__main__':
    main()
