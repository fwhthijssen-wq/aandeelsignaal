"""Archief van SEC-jaarverslagen in twee lagen.

Laag 1  Per jaarverslag (10-K, 20-F, 40-F en hun correcties) alle feiten precies zoals in dat verslag gerapporteerd.
        Eén bestand per verslag: archief/sec/<CIK>/<accessienummer>.json.gz. Wordt één keer geschreven en daarna nooit
        meer aangepast. Geeft de SEC later andere cijfers voor een verslag dat al in het archief staat, dan wordt het
        bestand níet overschreven; er komt een melding.
Laag 2  Wordt telkens opnieuw berekend uit laag 1, er wordt niets voor opgehaald: per boekjaar de winst per aandeel uit het
        meest recente verslag dat dat jaar noemt, omgerekend naar de huidige aandelenbasis met splitsingen die uit laag 1
        zelf zijn afgeleid. Dient als onafhankelijke tweede berekening naast de bestaande EPS-controle.

Bij elk nieuw verslag vergelijkt het archief, concept voor concept, wat dat verslag over eerdere jaren zegt met wat er al
stond:
  - winst per aandeel én aantal aandelen verschuiven met dezelfde eenvoudige factor  -> splitsing (of samenvoeging)
  - alleen het aantal aandelen springt x1000 of x1.000.000, winst per aandeel gelijk   -> schaalcorrectie
  - al het andere                                                                     -> herwerking (zelf bekijken)

Het archief verandert niets aan de bestaande controles en het label-slot; het voegt alleen informatie toe. Elke fout in het
archief wordt opgevangen: de nachtelijke run mislukt er nooit door.

Bijkomend voordeel: binnen één run haalt het archief elk SEC-bestand maar één keer op (voorheen tot drie keer per bedrijf,
en de tickerlijst van de SEC bij elk bedrijf opnieuw).
"""
import gzip
import hashlib
import json
from datetime import date
from fractions import Fraction
from pathlib import Path

JAARVORMEN = ('10-K', '10-K/A', '20-F', '20-F/A', '40-F', '40-F/A')

# concept -> soort: 'ps' per aandeel, 'sh' aantal aandelen, 'amt' bedrag
CONCEPTEN = {
    'us-gaap:EarningsPerShareDiluted': 'ps',
    'us-gaap:EarningsPerShareBasic': 'ps',
    'us-gaap:EarningsPerShareBasicAndDiluted': 'ps',
    'ifrs-full:DilutedEarningsLossPerShare': 'ps',
    'ifrs-full:BasicEarningsLossPerShare': 'ps',
    'us-gaap:CommonStockDividendsPerShareDeclared': 'ps',
    'us-gaap:CommonStockDividendsPerShareCashPaid': 'ps',
    'ifrs-full:DividendsRecognisedAsDistributionsToOwnersPerShare': 'ps',
    'us-gaap:WeightedAverageNumberOfDilutedSharesOutstanding': 'sh',
    'us-gaap:WeightedAverageNumberOfSharesOutstandingBasic': 'sh',
    'ifrs-full:WeightedAverageShares': 'sh',
    'ifrs-full:AdjustedWeightedAverageShares': 'sh',
    'us-gaap:Revenues': 'amt',
    'us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax': 'amt',
    'ifrs-full:Revenue': 'amt',
    'us-gaap:NetIncomeLoss': 'amt',
    'us-gaap:NetIncomeLossAvailableToCommonStockholdersBasic': 'amt',
    'us-gaap:ProfitLoss': 'amt',
    'ifrs-full:ProfitLoss': 'amt',
    'ifrs-full:ProfitLossAttributableToOwnersOfParent': 'amt',
    'us-gaap:OperatingIncomeLoss': 'amt',
    'us-gaap:NetCashProvidedByUsedInOperatingActivities': 'amt',
    'ifrs-full:CashFlowsFromUsedInOperatingActivities': 'amt',
    'us-gaap:Assets': 'amt',
    'ifrs-full:Assets': 'amt',
    'us-gaap:StockholdersEquity': 'amt',
    'ifrs-full:EquityAttributableToOwnersOfParent': 'amt',
}
EPS_VOORKEUR = ('us-gaap:EarningsPerShareDiluted', 'ifrs-full:DilutedEarningsLossPerShare',
                'us-gaap:EarningsPerShareBasicAndDiluted')
SPLIT_CONCEPT = 'us-gaap:StockholdersEquityNoteStockSplitConversionRatio1'

TOL_PS_ABS = 0.0051      # winst per aandeel: afronding op 2 decimalen
TOL_REL = 0.001          # aantallen en bedragen: 0,1 %
SPLIT_TOL = 0.03         # een splitsingsfactor ligt binnen 3 % van een eenvoudige verhouding
MAX_MELDINGEN = 12       # zoveel meldingen gaan mee naar de webapp (alles staat in het archief zelf)


def _dag(s):
    return date.fromisoformat(s)


def _jaarperiode(r):
    if 'start' not in r:
        return True                                   # balanspost op een moment
    try:
        return 350 <= (_dag(r['end']) - _dag(r['start'])).days <= 380
    except (ValueError, TypeError):
        return False


def _kort(c):
    return c.split(':', 1)[1]


def _canon(obj):
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(',', ':'))


# ------------------------------------------------------------------------------------------------ laag 1: opsplitsen

def verslagen_uit_payload(payload):
    """Alle feiten van een companyfacts-bestand, gegroepeerd per jaarverslag (accessienummer)."""
    verslagen = {}
    for tax, concepten in (payload.get('facts') or {}).items():
        if not isinstance(concepten, dict):
            continue
        for naam, data in concepten.items():
            for unit, rijen in ((data or {}).get('units') or {}).items():
                for f in rijen or []:
                    if not isinstance(f, dict) or f.get('form') not in JAARVORMEN or not f.get('accn'):
                        continue
                    v = verslagen.setdefault(f['accn'], {'accn': f['accn'], 'form': f['form'],
                                                         'ingediend': f.get('filed'), 'feiten': []})
                    rij = {'concept': f'{tax}:{naam}', 'unit': unit, 'end': f.get('end'), 'val': f.get('val')}
                    if f.get('start'):
                        rij['start'] = f['start']
                    v['feiten'].append(rij)
    for v in verslagen.values():
        v['feiten'].sort(key=lambda r: (r['concept'], r['unit'], r.get('start') or '', r['end'] or ''))
        jaren = [r['end'] for r in v['feiten'] if r.get('start') and r.get('end') and _jaarperiode(r)]
        v['boekjaar_einde'] = max(jaren) if jaren else None
    return verslagen


def _waarden(verslag):
    """{(concept, unit): {einddatum: waarde}} voor de concepten die het archief vergelijkt, alleen jaarperioden."""
    uit = {}
    for r in verslag['feiten']:
        if r['concept'] in CONCEPTEN and isinstance(r.get('val'), (int, float)) and _jaarperiode(r):
            uit.setdefault((r['concept'], r['unit']), {})[r['end']] = r['val']
    return uit


# ------------------------------------------------------------------------------------------------ controle

def _afwijking(soort, oud, nieuw):
    if oud == nieuw:
        return False
    verschil = abs(oud - nieuw)
    if soort == 'ps':
        return verschil > TOL_PS_ABS and verschil > TOL_REL * max(abs(oud), abs(nieuw))
    return verschil > TOL_REL * max(abs(oud), abs(nieuw), 1)


def _nette_factor(x):
    if not x or x <= 0:
        return None
    fr = Fraction(x).limit_denominator(10)
    if fr == 1 or fr.numerator > 200:
        return None
    return fr if abs(float(fr) - x) / x <= SPLIT_TOL else None


def vergelijk(eerdere, nieuw):
    """Vergelijkt een nieuw verslag met de eerdere verslagen. Geeft een lijst gebeurtenissen (dicts)."""
    basis = {}
    for v in eerdere:
        for sleutel, w in _waarden(v).items():
            for end, val in w.items():
                basis.setdefault(sleutel, {})[end] = (val, v['accn'])
    afw = []
    for sleutel, w in _waarden(nieuw).items():
        for end, val in w.items():
            if end == nieuw.get('boekjaar_einde') or end not in basis.get(sleutel, {}):
                continue
            oud, accn = basis[sleutel][end]
            if _afwijking(CONCEPTEN[sleutel[0]], oud, val):
                afw.append({'concept': sleutel[0], 'unit': sleutel[1], 'end': end, 'oud': oud, 'nieuw': val,
                            'eerder_in': accn})
    ps = [a for a in afw if CONCEPTEN[a['concept']] == 'ps']
    sh = [a for a in afw if CONCEPTEN[a['concept']] == 'sh']
    verklaard, uit = set(), []
    basisinfo = {'accn': nieuw['accn'], 'ingediend': nieuw.get('ingediend'), 'form': nieuw.get('form')}

    if sh and not ps:
        ratios = [a['nieuw'] / a['oud'] for a in sh if a['oud']]
        for schaal in (1000, 1_000_000, 0.001, 0.000001):
            if ratios and len(ratios) == len(sh) and all(abs(r / schaal - 1) < 0.01 for r in ratios):
                verklaard = {id(a) for a in sh}
                jaren = sorted({a['end'] for a in sh})
                uit.append(dict(basisinfo, soort='schaalcorrectie', factor=schaal,
                                tekst=f'aantal aandelen x{schaal:g} voor {", ".join(jaren)}, winst per aandeel gelijk '
                                      f'(een eerder verslag gaf het aantal in duizenden of miljoenen)'))
                break
    # Een splitsing verandert zowel de winst per aandeel als het aantal aandelen. Verschuift alleen de winst per aandeel
    # (bijvoorbeeld door een nieuwe boekhoudregel), dan is het een herwerking, ook als de verhouding toevallig 'net' is.
    if ps and sh and not verklaard:
        ratios = []
        for a in ps + sh:
            if CONCEPTEN[a['concept']] == 'ps':
                ratios.append(a['oud'] / a['nieuw'] if a['nieuw'] else None)
            else:
                ratios.append(a['nieuw'] / a['oud'] if a['oud'] else None)
        if None not in ratios:
            kandidaat = _nette_factor(sorted(ratios)[len(ratios) // 2])
            if kandidaat and all(abs(r / float(kandidaat) - 1) <= SPLIT_TOL for r in ratios):
                verklaard = {id(a) for a in ps + sh}
                getagd = [r['val'] for r in nieuw['feiten'] if r['concept'] == SPLIT_CONCEPT]
                jaren = sorted({a['end'] for a in ps + sh})
                uit.append(dict(basisinfo, soort='splitsing', factor=str(kandidaat), getagd=getagd[:1] or None,
                                tekst=f'winst per aandeel en aantal aandelen verschoven met factor {kandidaat} voor '
                                      f'{", ".join(jaren)}' + (f' (in het verslag getagd als splitsing {getagd[0]})'
                                                               if getagd else ' (niet als splitsing getagd)')))
    for a in afw:
        if id(a) in verklaard:
            continue
        rel = (a['nieuw'] - a['oud']) / abs(a['oud']) * 100 if a['oud'] else None
        uit.append(dict(basisinfo, soort='herwerking', concept=_kort(a['concept']), end=a['end'],
                        oud=a['oud'], nieuw=a['nieuw'], eerder_in=a['eerder_in'],
                        tekst=f'{_kort(a["concept"])} {a["end"]}: {a["oud"]:,} -> {a["nieuw"]:,}'
                              + (f' ({rel:+.2f}%)' if rel is not None else '')))
    return uit


# ------------------------------------------------------------------------------------------------ laag 2

def vergelijkbare_eps(verslagen, gebeurtenissen):
    """{boekjaar_einde: verwaterde winst per aandeel op de huidige aandelenbasis} uit laag 1."""
    volgorde = {v['accn']: i for i, v in enumerate(verslagen)}
    splitsingen = [(volgorde[g['accn']], Fraction(g['factor'])) for g in gebeurtenissen
                   if g.get('soort') == 'splitsing' and g.get('accn') in volgorde]
    eindjaren = {v['boekjaar_einde'] for v in verslagen if v.get('boekjaar_einde')}
    laatste = {}
    for v in verslagen:                                   # oud naar nieuw: het laatste verslag wint
        w = _waarden(v)
        gekozen = {}
        for concept in EPS_VOORKEUR:                      # binnen één verslag: de voorkeursvolgorde
            for (c, unit), reeks in w.items():
                if c != concept:
                    continue
                for end, val in reeks.items():
                    gekozen.setdefault(end, (val, unit))
        for end, (val, unit) in gekozen.items():
            if end in eindjaren:
                laatste[end] = (val, unit, v['accn'])
    uit = {}
    for end, (val, unit, accn) in sorted(laatste.items()):
        f = Fraction(1)
        for pos, factor in splitsingen:
            if pos > volgorde[accn]:
                f *= factor
        uit[end] = {'eps': round(val / float(f), 4), 'gerapporteerd': val, 'factor': str(f), 'valuta': unit.split('/')[0]}
    return uit


# ------------------------------------------------------------------------------------------------ het archief

class Archief:
    """Laag 1 op schijf plus een geheugen voor de lopende run. Gebruik `fetch_json` als fetcher voor alle SEC-aanroepen."""

    def __init__(self, map_):
        self.map = Path(map_)
        self._geheugen = {}           # url -> payload, alleen deze run (tickerlijst en het laatste companyfacts-bestand)
        self._verwerkt = {}           # cik -> resultaat van verwerk() in deze run
        self.laatste_cik = None

    # -- ophalen
    def fetch_json(self, url, email):
        from source_engine import fetch_json, FACTS_URL
        if url in self._geheugen:
            return self._geheugen[url]
        payload = fetch_json(url, email)
        if FACTS_URL.split('{')[0] in url:
            # alleen het laatste companyfacts-bestand bewaren (die kunnen groot zijn)
            for k in [k for k in self._geheugen if FACTS_URL.split('{')[0] in k]:
                del self._geheugen[k]
            try:
                self.verwerk(payload)
            except Exception as exc:          # het archief mag de run nooit laten mislukken
                self._verwerkt[self._cik(payload)] = {'fout': f'{type(exc).__name__}: {exc}'[:200]}
            self.laatste_cik = self._cik(payload)
        self._geheugen[url] = payload
        return payload

    def vergeet(self):
        """Voor een tweede poging: het companyfacts-bestand echt opnieuw ophalen."""
        from source_engine import FACTS_URL
        for k in [k for k in self._geheugen if FACTS_URL.split('{')[0] in k]:
            del self._geheugen[k]

    @staticmethod
    def _cik(payload):
        try:
            return f'{int(payload.get("cik")):010d}'
        except (TypeError, ValueError):
            return None

    # -- laag 1 schrijven
    def _map(self, cik):
        return self.map / 'sec' / cik

    def _lees(self, pad):
        with gzip.open(pad, 'rt', encoding='utf-8') as f:
            return json.load(f)

    def _schrijf(self, pad, obj):
        pad.parent.mkdir(parents=True, exist_ok=True)
        tmp = pad.with_suffix(pad.suffix + '.tmp')
        with open(tmp, 'wb') as fh, gzip.GzipFile(fileobj=fh, mode='wb', mtime=0) as gz:
            gz.write(_canon(obj).encode('utf-8'))
        tmp.replace(pad)

    def verslagen(self, cik):
        m = self._map(cik)
        if not m.is_dir():
            return []
        uit = [self._lees(p) for p in m.glob('*.json.gz')]
        return sorted(uit, key=lambda v: (v.get('ingediend') or '', v['accn']))

    def gebeurtenissen(self, cik):
        pad = self._map(cik) / 'gebeurtenissen.json'
        try:
            return json.loads(pad.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            return []

    def verwerk(self, payload):
        """Voegt nieuwe jaarverslagen aan laag 1 toe en vergelijkt ze met wat er al stond."""
        cik = self._cik(payload)
        if not cik:
            return None
        bestaand = self.verslagen(cik)
        eerste_keer = not bestaand
        bekend = {v['accn']: v for v in bestaand}
        gebeurtenissen = self.gebeurtenissen(cik)
        nieuw_accn = []
        binnen = sorted(verslagen_uit_payload(payload).values(), key=lambda v: (v.get('ingediend') or '', v['accn']))
        for v in binnen:
            if v['accn'] in bekend:
                if hashlib.sha256(_canon(bekend[v['accn']]).encode()).digest() != hashlib.sha256(_canon(v).encode()).digest():
                    if not any(g.get('soort') == 'bron_gewijzigd' and g.get('accn') == v['accn'] for g in gebeurtenissen):
                        gebeurtenissen.append({'accn': v['accn'], 'ingediend': v.get('ingediend'), 'form': v.get('form'),
                                               'soort': 'bron_gewijzigd', 'gevonden': date.today().isoformat(),
                                               'tekst': 'de SEC geeft nu andere cijfers voor dit verslag dan in het '
                                                        'archief staan; het archief is niet aangepast'})
                continue
            eerdere = [x for x in bestaand if (x.get('ingediend') or '', x['accn']) < (v.get('ingediend') or '', v['accn'])]
            for g in vergelijk(eerdere, v):
                g['gevonden'] = date.today().isoformat()
                g['historisch'] = eerste_keer          # bij de eerste opbouw van het archief: terugblik, geen nieuws
                gebeurtenissen.append(g)
            self._schrijf(self._map(cik) / f'{v["accn"]}.json.gz', v)
            bestaand.append(v)
            bestaand.sort(key=lambda x: (x.get('ingediend') or '', x['accn']))
            nieuw_accn.append(v['accn'])
        if nieuw_accn or not (self._map(cik) / 'gebeurtenissen.json').exists():
            self._map(cik).mkdir(parents=True, exist_ok=True)
            (self._map(cik) / 'gebeurtenissen.json').write_text(
                json.dumps(gebeurtenissen, ensure_ascii=False, indent=1), encoding='utf-8')
        elif any(g.get('soort') == 'bron_gewijzigd' for g in gebeurtenissen):
            (self._map(cik) / 'gebeurtenissen.json').write_text(
                json.dumps(gebeurtenissen, ensure_ascii=False, indent=1), encoding='utf-8')
        res = {'cik': cik, 'nieuw': nieuw_accn, 'eerste_keer': eerste_keer}
        self._verwerkt[cik] = res
        return res

    # -- samenvatting voor de webapp
    def samenvatting(self, cik, jaren=None):
        """Klein blok voor gegevens['archief']: wat er in laag 1 staat, wat er deze run bijkwam, meldingen, en de
        vergelijking van de winst per aandeel uit laag 2 met de bestaande berekening (`jaren`)."""
        if not cik:
            return None
        run = self._verwerkt.get(cik) or {}
        if run.get('fout'):
            return {'cik': cik, 'fout': run['fout']}
        verslagen = self.verslagen(cik)
        if not verslagen:
            return None
        gebeurtenissen = self.gebeurtenissen(cik)
        laatste = verslagen[-1]
        reeks = vergelijkbare_eps(verslagen, gebeurtenissen)
        uit = {'cik': cik, 'verslagen': len(verslagen),
               'laatste_verslag': {'accn': laatste['accn'], 'form': laatste.get('form'),
                                   'ingediend': laatste.get('ingediend'), 'boekjaar_einde': laatste.get('boekjaar_einde')},
               'nieuw_deze_run': run.get('nieuw') or [],
               'meldingen': [{k: g.get(k) for k in ('soort', 'ingediend', 'accn', 'tekst', 'historisch')}
                             for g in gebeurtenissen[-MAX_MELDINGEN:]],
               'vergelijkbare_eps': {end: r['eps'] for end, r in reeks.items()}}
        if jaren:
            gelijk, afwijkend = 0, []
            for j in jaren:
                end, eps = j.get('end'), j.get('comparable_eps')
                if end not in reeks or not isinstance(eps, (int, float)):
                    continue
                a = reeks[end]['eps']
                if abs(a - eps) <= max(0.006, 0.01 * abs(eps)):
                    gelijk += 1
                else:
                    afwijkend.append({'end': end, 'bestaand': eps, 'archief': a})
            uit['eps_controle'] = {'vergeleken': gelijk + len(afwijkend), 'gelijk': gelijk, 'afwijkend': afwijkend}
        return uit


# ------------------------------------------------------------------------------------------------ voor de EPS-controle

AFGELEID_TAG = 'afgeleid:Jaarverslagvergelijking'


def afgeleide_splitsingen(payload, asof, bestaande=None):
    """Splitsingen en samenvoegingen die blijken uit de vergelijking van opeenvolgende jaarverslagen, in de vorm van de
    splitgebeurtenissen van history_checks.split_events. Puur afgeleid uit het companyfacts-bestand (geen schijf).

    Datum = de dag na het laatste jaarverslag van vóór de splitsing: alle cijfers uit dat en eerdere verslagen staan op de
    oude basis, alle cijfers vanaf het volgende verslag op de nieuwe. Een gebeurtenis die al als SEC-splitsing (zelfde
    verhouding, in de buurt) bekend is, wordt niet nog eens toegevoegd. De EPS-controle bevestigt elke gebeurtenis daarna
    nog onafhankelijk met de winst per aandeel van vóór en na."""
    from datetime import timedelta
    verslagen = sorted((v for v in verslagen_uit_payload(payload).values() if (v.get('ingediend') or '9999') <= asof),
                       key=lambda v: (v.get('ingediend') or '', v['accn']))
    bekend = []
    for e in bestaande or []:
        try:
            bekend.append((_dag(e['Datum']), float(e['Waarde SEC'])))
        except (KeyError, TypeError, ValueError):
            continue
    uit = []
    for i, v in enumerate(verslagen):
        if i == 0:
            continue
        for g in vergelijk(verslagen[:i], v):
            if g.get('soort') != 'splitsing':
                continue
            factor = float(Fraction(g['factor']))
            voor = _dag(verslagen[i - 1]['ingediend'])
            na = _dag(v['ingediend'])
            if any(abs(r / factor - 1) < 0.01 and voor - timedelta(days=400) <= d <= na + timedelta(days=800)
                   for d, r in bekend):
                continue
            uit.append({'Datum': (voor + timedelta(days=1)).isoformat(), 'Waarde SEC': factor, 'Eenheid': 'pure',
                        'Tag': AFGELEID_TAG, 'Ingediend': v['ingediend'], 'Datumtype': None,
                        'Afgeleid': f'winst per aandeel en aantal aandelen in het jaarverslag van {v["ingediend"]} '
                                    f'({v["accn"]}) verschoven met factor {g["factor"]} t.o.v. eerdere verslagen; '
                                    f'splitsing tussen {voor.isoformat()} en {na.isoformat()}'})
    return uit
