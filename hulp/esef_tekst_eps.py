"""Hulpmiddel (ontwikkeling): winst per aandeel uit de TEKST van ESEF-jaarverslagen, voor bedrijven die het getal niet
taggen (o.a. Italiaanse en Spaanse banken) of waarvan rapporten in de bundel ontbreken.

Stap 1 (netwerk, in GitHub Actions: rapporten zijn tot ~100 MB): python hulp/esef_tekst_eps.py lezen uit.json TICKER...
  Per rapport (filings.xbrl.org, report_url = het leesbare xhtml-jaarverslag) alle tabelregels met een label voor winst per
  aandeel, met de getallen en de jaartallenkop van dezelfde tabel. Niets wordt hier gekozen.
Stap 2 (lokaal): python hulp/esef_tekst_eps.py kiezen uit.json esef_tekst_eps.json
  Per rapport de verwaterde (anders gewone) winst per aandeel van het boekjaar en het jaar ervoor, alleen als alle
  kandidaatregels hetzelfde zeggen. Vastgelegd in de vorm van jaarverslag_bronnen.json (kenmerk = het ESEF-rapport), zodat
  esef_bron.eps_keten de jaren over de rapporten heen controleert (vergelijkend cijfer in het volgende rapport).
"""
import json, re, sys, time, tempfile, urllib.request
from datetime import date, timedelta
from pathlib import Path

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))
BASE = 'https://filings.xbrl.org'
UA = {'User-Agent': 'AandeelSignaal/1.0 (research; github.com/fwhthijssen-wq/aandeelsignaal)'}
X = '{http://www.w3.org/1999/xhtml}'

# label: winst per aandeel in de talen van de ESEF-landen
LABEL = re.compile(r'(earnings|profit|loss|income|beneficio|resultado|utile|perdita|b[ée]n[ée]fice|r[ée]sultat|winst|ergebnis|lucro)'
                   r'[^0-9]{0,60}?\b(per|por|par|je|pro)\s+(ordinary\s+)?(share|acci[oó]n|azion|action|aandeel|aktie)', re.I)
VERWATERD = re.compile(r'dilu|verw[aä]', re.I)
NIET = re.compile(r'adjust|ajustad|rettificat|core|underlying|recurr|ricorrent|continuing|discontinu|interrumpid|continuad|'
                  r'cessat|operazioni|before|antes|prima|avant|excluding|sin\s|senza|hors|pro\s?forma|target|objetivo|dividend|'
                  r'number|n[uú]mero|numero|nombre|aantal|weighted|ponderad|medio|moyen|AT1|cup[oó]n|coupon|tangible|growth|'
                  r'crecimiento|variaci|change|%|\bfor\s+(the\s+purposes?|basic|diluted|calculating)|used\s+in|attributable|atribuible|attribuibile|imputable', re.I)
CENTEN = re.compile(r'pence|\(p\)|\bp\b|cents?\b|eurocent|c[ée]ntimos|centesim', re.I)
MUNT = re.compile(r'[£€$]|\beuros?\b|\bEUR\b|\bGBP\b|\bUSD\b|\bdollars?\b|\bpounds?\b', re.I)
JAAR = re.compile(r'(?<![\d.,])(20[0-3]\d)(?![\d.,])')
GETAL = re.compile(r'\(?[-–−]?\s?\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d+)?\)?')


def get(url, binair=False, pogingen=4):
    for i in range(pogingen):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as r:
                data = r.read()
            return data if binair else json.loads(data)
        except Exception:
            if i == pogingen - 1:
                raise
            time.sleep(5 * (i + 1))


def rapporten(lei):
    """Alle rapporten van een LEI (nieuwste versie per boekjaar), met report_url en publicatiedatum."""
    flt = json.dumps([{'name': 'entity.identifier', 'op': 'eq', 'val': lei}])
    url = f"{BASE}/api/filings?filter={urllib.parse.quote(flt)}&page[size]=100"
    uit = {}
    for d in get(url).get('data') or []:
        a = d.get('attributes') or {}
        if not a.get('report_url') or not a.get('period_end'):
            continue
        oud = uit.get(a['period_end'])
        if oud is None or (a.get('date_added') or '') > (oud.get('date_added') or ''):
            uit[a['period_end']] = a
    return [uit[k] for k in sorted(uit, reverse=True)]


def getal(tok, komma):
    t = tok.strip()
    neg = t.startswith('(') and t.endswith(')') or t.lstrip('(').startswith(('-', '–', '−'))
    t = re.sub(r'[()\s\-–−]', '', t)
    if komma:
        t = t.replace('.', '').replace(',', '.')
    else:
        t = t.replace(',', '')
    try:
        v = float(t)
    except ValueError:
        return None
    return -v if neg else v


def lees_rapport(pad):
    """Kandidaatregels [{label, waarden: [str], kop: [jaar]}] uit één xhtml-rapport."""
    from lxml import etree
    doc = etree.parse(str(pad), etree.XMLParser(huge_tree=True, recover=True)).getroot()
    tekst = ' '.join(doc.itertext())
    komma = len(re.findall(r'\d,\d{2}\b', tekst)) > len(re.findall(r'\d\.\d{2}\b', tekst)) * 1.5
    uit = []
    for tabel in doc.iter(X + 'table'):
        rijen = list(tabel.iter(X + 'tr'))
        kop = None
        koptekst = ' '.join(' '.join(''.join(tr.itertext()).split()) for tr in rijen[:4])[:400]
        for tr in rijen:
            cellen = [' '.join(''.join(c.itertext()).split()) for c in tr if c.tag in (X + 'td', X + 'th')]
            cellen = [c for c in cellen if c]
            if not cellen:
                continue
            regel = ' '.join(cellen)
            jaren = [int(j) for j in JAAR.findall(regel)]
            if kop is None and len(jaren) >= 2 and len(set(jaren)) == len(jaren) and not LABEL.search(regel):
                kop = jaren
                continue
            eerste = cellen[0]
            if not LABEL.search(eerste) or NIET.search(eerste):
                continue
            waarden = []
            for c in cellen[1:]:
                for tok in GETAL.findall(c):
                    if re.search(r'\d', tok):
                        waarden.append(tok)
            if len(waarden) < 2:
                continue
            uit.append({'label': eerste[:160], 'verwaterd': bool(VERWATERD.search(eerste)), 'waarden': waarden, 'kop': kop,
                        'centen': bool(CENTEN.search(eerste) or CENTEN.search(koptekst)), 'munt': bool(MUNT.search(eerste) or MUNT.search(koptekst))})
    return {'komma': komma, 'regels': uit}


def lezen(uitpad, tickers):
    lei = json.load(open(HIER.parent / 'esef_lei.json'))
    try:
        uit = json.load(open(uitpad))
    except (OSError, ValueError):
        uit = {}
    for t in tickers:
        L = (lei.get(t) or {}).get('lei')
        if not L:
            continue
        per = uit.setdefault(t, {'lei': L, 'rapporten': {}})
        try:
            lijst = rapporten(L)
        except Exception as exc:
            per['fout'] = str(exc)[:150]
            continue
        for a in lijst:
            fx = a['fxo_id']
            if fx in per['rapporten']:
                continue
            try:
                data = get(BASE + a['report_url'], binair=True)
                with tempfile.NamedTemporaryFile(suffix='.xhtml') as f:
                    f.write(data); f.flush()
                    r = lees_rapport(f.name)
                r.update(period_end=a['period_end'], published=(a.get('published') or a.get('date_added') or '')[:10], url=BASE + a.get('viewer_url', a['report_url']))
                per['rapporten'][fx] = r
                print(t, fx, len(r['regels']), flush=True)
            except Exception as exc:
                per['rapporten'][fx] = {'fout': str(exc)[:150], 'period_end': a['period_end']}
            time.sleep(1)
        json.dump(uit, open(uitpad, 'w'), ensure_ascii=False, indent=1)


def kies_rapport(r, eis_munt=False):
    """(eps_boekjaar, eps_vorig, regel) of None: verwaterd gaat voor; alle gekozen regels moeten hetzelfde zeggen."""
    pe = r.get('period_end') or ''
    try:
        jaar = int(pe[:4])
    except ValueError:
        return None
    lezingen = []
    for soort in (True, False):
        for g in r.get('regels') or []:
            if g['verwaterd'] != soort or not g.get('kop'):
                continue
            kop = g['kop']
            if jaar not in kop or (jaar - 1) not in kop:
                continue
            w = [getal(x, r.get('komma')) for x in g['waarden']]
            w = [x for x in w if x is not None]
            if len(w) < len(kop):
                continue
            w = w[:len(kop)]                               # een verschilkolom achteraan valt weg
            nu, vorig = w[kop.index(jaar)], w[kop.index(jaar - 1)]
            if g.get('centen'):
                nu, vorig = nu / 100, vorig / 100                  # in centen of pence gemeld
            elif eis_munt and not g.get('munt'):
                continue                                           # niet-euro zonder aanduiding: schaal onzeker
            if abs(nu) > 1000 or abs(vorig) > 1000:
                continue
            lezingen.append((round(nu, 4), round(vorig, 4), g['label'] + ': ' + ' '.join(g['waarden'][:len(kop)])))
        if lezingen:
            break
    if not lezingen or len({(a, b) for a, b, _ in lezingen}) != 1:
        return None
    return lezingen[0]


def eps_eenheid(ticker):
    """Eenheid van de getagde winst per aandeel van dit bedrijf in de bundel (bijv. 'EUR/shares'), of None."""
    import bouw_webdata as bw
    from collections import Counter
    cf = bw.esef_ophalen(ticker) or {}
    c = Counter()
    for ns in (cf.get('facts') or {}).values():
        for naam, blok in ns.items():
            for unit, rijen in (blok.get('units') or {}).items():
                if unit.endswith('/shares') and 'PerShare' in naam:
                    c[unit] += len(rijen)
    return c.most_common(1)[0][0] if c else None


def kiezen(inpad, uitpad):
    data = json.load(open(inpad))
    bedrijven = {}
    for t, per in data.items():
        eenheid = eps_eenheid(t) or 'EUR/shares'
        eis_munt = eenheid != 'EUR/shares'      # pence of ponden: alleen met een duidelijke aanduiding (pence, £, cent)
        docs = []
        for fx, r in per.get('rapporten', {}).items():
            if r.get('fout'):
                continue
            k = kies_rapport(r, eis_munt)
            if not k:
                continue
            nu, vorig, bewijs = k
            pe = date.fromisoformat(r['period_end'])
            vorig_eind = date(pe.year - 1, pe.month, min(pe.day, 28 if pe.month == 2 else pe.day))
            feiten = [{'concept': 'ifrs-full:DilutedEarningsLossPerShare', 'start': (pe - timedelta(days=364)).isoformat(), 'eind': pe.isoformat(),
                       'waarde': nu, 'eenheid': eenheid, 'oorspronkelijk': nu, 'schaal': 1, 'bewijs': 'ESEF-tekst: "' + bewijs + '"'},
                      {'concept': 'ifrs-full:DilutedEarningsLossPerShare', 'start': (vorig_eind - timedelta(days=364)).isoformat(), 'eind': vorig_eind.isoformat(),
                       'waarde': vorig, 'eenheid': eenheid, 'oorspronkelijk': vorig, 'schaal': 1, 'bewijs': 'ESEF-tekst (vergelijkend cijfer)'}]
            docs.append({'document': fx, 'soort': 'esef-tekst', 'url': r.get('url'), 'ingediend': r.get('published') or r['period_end'],
                         'kenmerk': fx, 'period_end': r['period_end'], 'feiten': feiten})
        if docs:
            bedrijven[t] = {'lei': per.get('lei'), 'documenten': sorted(docs, key=lambda d: d['period_end'], reverse=True)}
    json.dump({'toelichting': 'Winst per aandeel uit de tekst (tabellen) van ESEF-jaarverslagen waar het getal niet getagd is. '
                              'Gemaakt met hulp/esef_tekst_eps.py; vult alleen aan (een getagd feit gaat voor).',
               'bedrijven': bedrijven}, open(uitpad, 'w'), ensure_ascii=False, indent=1, sort_keys=True)
    print(len(bedrijven), 'bedrijven')


if __name__ == '__main__':
    import urllib.parse
    if sys.argv[1] == 'lezen':
        lezen(sys.argv[2], sys.argv[3:])
    elif sys.argv[1] == 'kiezen':
        kiezen(sys.argv[2], sys.argv[3])
