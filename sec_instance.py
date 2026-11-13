"""Jaarcijfers rechtstreeks uit het jaarverslag (XBRL) als de SEC-database (companyfacts) ze nog niet heeft.

Bij sommige buitenlandse bedrijven (TSMC, Shinhan, KEPCO ...) staat het nieuwste jaarverslag (20-F) wel in het register en
in companyfacts met zijn dei-gegevens (soort verslag, boekjaar), maar zonder één cijfer uit de jaarrekening (ifrs-full of
us-gaap). De app stopte dan een jaar te vroeg. Dit module leest in dat geval het XBRL-bestand dat de SEC bij elk inline-XBRL
jaarverslag zelf maakt (<naam>_htm.xml in de map van de indiening) en voegt de feiten toe in dezelfde vorm als companyfacts.

Alleen feiten zonder dimensies (de cijfers van het geheel, niet per segment), en alleen voor het ontbrekende verslag. De
controles daarna (narekening van de winst per aandeel, vergelijking met eerdere verslagen) gelden onverkort. Het
oorspronkelijke companyfacts-bestand wordt niet gewijzigd: er komt een aangevulde kopie terug. Elke fout -> geen aanvulling.
"""
import json
from datetime import date
import xml.etree.ElementTree as ET
from urllib.request import Request, urlopen

JAARVORMEN = ('10-K', '10-K/A', '20-F', '20-F/A', '40-F', '40-F/A')
STELSELS = ('ifrs-full', 'us-gaap')
ARCHIEF = 'https://www.sec.gov/Archives/edgar/data/{cik}/{accn}/'
XBRLI = '{http://www.xbrl.org/2003/instance}'


def ontbrekend_verslag(payload):
    """(accn, form, filed, fy) van het nieuwste jaarverslag dat in companyfacts alleen dei-feiten heeft; anders None."""
    facts = (payload or {}).get('facts') or {}
    met_cijfers, dei = set(), {}
    for ns, concepten in facts.items():
        for data in (concepten or {}).values():
            for rijen in ((data or {}).get('units') or {}).values():
                for r in rijen or []:
                    if not isinstance(r, dict) or r.get('form') not in JAARVORMEN or not r.get('accn'):
                        continue
                    if ns in STELSELS:
                        met_cijfers.add(r['accn'])
                    elif ns == 'dei':
                        oud = dei.get(r['accn'])
                        if oud is None or (r.get('filed') or '') > (oud[1] or ''):
                            dei[r['accn']] = (r['form'], r.get('filed'), r.get('fy'))
    if not dei:
        return None
    accn = max(dei, key=lambda a: (dei[a][1] or '', a))
    laatste_met = max((dei[a][1] or '' for a in met_cijfers if a in dei), default='')
    if accn in met_cijfers or (dei[accn][1] or '') <= laatste_met:
        return None
    return (accn,) + dei[accn]


def _maat(unit_el):
    def naam(el):
        t = (el.text or '').strip()
        return t.split(':', 1)[1] if ':' in t else t
    deel = unit_el.find(XBRLI + 'divide')
    if deel is not None:
        boven = deel.find(XBRLI + 'unitNumerator/' + XBRLI + 'measure')
        onder = deel.find(XBRLI + 'unitDenominator/' + XBRLI + 'measure')
        if boven is None or onder is None:
            return None
        return f'{naam(boven)}/{naam(onder)}'
    m = unit_el.findall(XBRLI + 'measure')
    return naam(m[0]) if len(m) == 1 else None


def _stelsel(uri):
    uri = uri or ''
    if 'fasb.org/us-gaap' in uri:
        return 'us-gaap'
    if 'xbrl.ifrs.org' in uri and 'ifrs-full' in uri:
        return 'ifrs-full'
    return None


def feiten_uit_instance(xml_bytes, accn, form, filed, fy):
    """{stelsel: {concept: {'units': {unit: [rij, ...]}}}} uit een XBRL-instance, alleen feiten zonder dimensies."""
    wortel = ET.fromstring(xml_bytes)
    perioden = {}
    for c in wortel.iter(XBRLI + 'context'):
        ent = c.find(XBRLI + 'entity')
        if ent is not None and ent.find(XBRLI + 'segment') is not None:
            continue
        if c.find(XBRLI + 'scenario') is not None:
            continue
        p = c.find(XBRLI + 'period')
        if p is None:
            continue
        s, e, i = p.find(XBRLI + 'startDate'), p.find(XBRLI + 'endDate'), p.find(XBRLI + 'instant')
        if s is not None and e is not None:
            perioden[c.get('id')] = (s.text.strip()[:10], e.text.strip()[:10])
        elif i is not None:
            perioden[c.get('id')] = (None, i.text.strip()[:10])
    eenheden = {u.get('id'): _maat(u) for u in wortel.iter(XBRLI + 'unit')}
    uit, gezien = {}, set()
    for el in wortel:
        if not isinstance(el.tag, str) or not el.tag.startswith('{'):
            continue
        uri, concept = el.tag[1:].split('}', 1)
        ns = _stelsel(uri)
        ctx = el.get('contextRef')
        if not ns or ctx not in perioden or el.get('{http://www.w3.org/2001/XMLSchema-instance}nil') == 'true':
            continue
        unit = eenheden.get(el.get('unitRef'))
        if not unit:
            continue
        try:
            waarde = float((el.text or '').strip())
        except ValueError:
            continue
        if waarde.is_integer() and abs(waarde) < 1e18:
            waarde = int(waarde)
        start, eind = perioden[ctx]
        sleutel = (ns, concept, unit, start, eind)
        if sleutel in gezien:
            continue
        gezien.add(sleutel)
        rij = {'end': eind, 'val': waarde, 'accn': accn, 'fy': fy, 'fp': 'FY', 'form': form, 'filed': filed,
               'bron': 'xbrl-instance'}
        if start:
            rij = {'start': start, **rij}
        uit.setdefault(ns, {}).setdefault(concept, {'units': {}})['units'].setdefault(unit, []).append(rij)
    return uit


def samenvoegen(payload, extra):
    """Kopie van payload met de extra feiten erbij (bestaande lijsten worden niet aangepast)."""
    nieuw = dict(payload)
    facts = dict(payload.get('facts') or {})
    for ns, concepten in extra.items():
        doel = dict(facts.get(ns) or {})
        for concept, data in concepten.items():
            oud = doel.get(concept) or {}
            units = dict(oud.get('units') or {})
            for unit, rijen in data['units'].items():
                units[unit] = list(units.get(unit) or []) + rijen
            doel[concept] = dict(oud, units=units)
        facts[ns] = doel
    nieuw['facts'] = facts
    return nieuw


def _haal(url, email, opener=urlopen):
    req = Request(url, headers={'User-Agent': f'AandeelSignaal Research {email}', 'Accept-Encoding': 'identity'})
    with opener(req, timeout=30) as r:
        return r.read()


def laatste_jaarverslag(payload):
    """Indieningsdatum van het nieuwste jaarverslag met jaarrekeningcijfers in companyfacts ('' als er geen is)."""
    laatst = ''
    for ns in STELSELS:
        for data in (((payload or {}).get('facts') or {}).get(ns) or {}).values():
            for rijen in ((data or {}).get('units') or {}).values():
                for r in rijen or []:
                    if isinstance(r, dict) and r.get('form') in JAARVORMEN and (r.get('filed') or '') > laatst:
                        laatst = r['filed']
    return laatst


def nieuwer_in_register(payload, cik, haal, vandaag):
    """Chunghwa Telecom: het nieuwste 20-F ontbreekt in companyfacts helemaal (ook zonder dei-feiten). Is het laatste
    verslag daar ouder dan 13 maanden, dan wordt het indieningsregister geraadpleegd: (accn, form, filed, fy) van een
    nieuwer jaarverslag met XBRL, anders None."""
    laatst = laatste_jaarverslag(payload)
    if not laatst or (date.fromisoformat(vandaag) - date.fromisoformat(laatst[:10])).days < 395:
        return None
    sub = json.loads(haal(f'https://data.sec.gov/submissions/CIK{int(cik):010d}.json'))
    rec = (sub.get('filings') or {}).get('recent') or {}
    beste = None
    for accn, form, filed, rapport, xbrl in zip(rec.get('accessionNumber', []), rec.get('form', []), rec.get('filingDate', []),
                                                 rec.get('reportDate', []), rec.get('isXBRL', [])):
        if form in JAARVORMEN and xbrl and filed > laatst and filed <= vandaag and (beste is None or filed > beste[2]):
            beste = (accn, form, filed, int(rapport[:4]) if rapport else None)
    return beste


_GEHAALD = {}          # per run: elk XBRL-bestand maar één keer ophalen (snapshot en extra cijfers gebruiken hetzelfde)


def aanvullen(payload, cik, email, haal=None, vandaag=None):
    """(payload, info). Vult het ontbrekende nieuwste jaarverslag aan uit het XBRL-bestand van de indiening.
    info is None als er niets aan te vullen was, anders {'accn', 'bestand', 'feiten'} of {'accn', 'fout'}."""
    if haal is None:
        def haal(url):
            if url not in _GEHAALD:
                _GEHAALD[url] = _haal(url, email)
            return _GEHAALD[url]
    try:
        mist = ontbrekend_verslag(payload)
    except Exception:
        return payload, None
    if not mist and cik:
        try:
            mist = nieuwer_in_register(payload, cik, haal, vandaag or date.today().isoformat())
        except Exception:
            mist = None
    if not mist or not cik:
        return payload, None
    accn, form, filed, fy = mist
    try:
        map_url = ARCHIEF.format(cik=int(cik), accn=accn.replace('-', ''))
        index = json.loads(haal(map_url + 'index.json'))
        namen = [i.get('name') or '' for i in (index.get('directory') or {}).get('item') or []]
        kandidaten = [n for n in namen if n.endswith('_htm.xml')] or [n for n in namen if n.endswith('.xml') and not n.startswith(('FilingSummary', 'Financial_Report', 'MetaLinks'))
                                                                      and not any(n.endswith(x) for x in ('_cal.xml', '_def.xml', '_lab.xml', '_pre.xml'))]
        if not kandidaten:
            return payload, {'accn': accn, 'fout': 'geen XBRL-bestand in de indiening'}
        bestand = kandidaten[0]
        extra = feiten_uit_instance(haal(map_url + bestand), accn, form, filed, fy)
        aantal = sum(len(r) for c in extra.values() for d in c.values() for r in d['units'].values())
        if not aantal:
            return payload, {'accn': accn, 'fout': 'XBRL-bestand zonder jaarrekeningcijfers'}
        return samenvoegen(payload, extra), {'accn': accn, 'bestand': bestand, 'feiten': aantal}
    except Exception as exc:
        return payload, {'accn': accn, 'fout': f'{type(exc).__name__}: {exc}'[:200]}
