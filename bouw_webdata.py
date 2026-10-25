"""Maakt de gegevensbestanden voor de webapp (web/data/aandelen.json en aandelen.js).

Twee manieren:
  python bouw_webdata.py --demo SEC_ESEF_praktijkresultaat.json   (alleen eerder gecontroleerde Apple-gegevens)
  python bouw_webdata.py --live --email uw@adres.nl                (SEC + koersen voor de hele lijst; draait 's nachts)

Regels: er worden nooit gegevens verzonnen. Ontbreekt iets, dan staat er null en een reden; de webapp
laat dan geen oordeel zien. Het label-slot zelf draait in de webapp, met de datum van het moment van kijken.
"""
import argparse
import json
from datetime import date, datetime, timezone
from pathlib import Path

SCHEMA = 1
HERE = Path(__file__).resolve().parent
UITVOER = HERE / 'web' / 'data'

# (ticker, naam, land, valuta, beurs)
CATALOGUS = (
    ('ASML.AS', 'ASML Holding', 'Nederland', 'EUR', 'Amsterdam'),
    ('SHEL', 'Shell plc', 'Verenigd Koninkrijk', 'USD', 'New York (NYSE)'),   # Shell rapporteert in USD: notering in dollar, geen omrekening nodig
    ('AAPL', 'Apple Inc.', 'Verenigde Staten', 'USD', 'Nasdaq'),
    ('MSFT', 'Microsoft Corp.', 'Verenigde Staten', 'USD', 'Nasdaq'),
    ('GOOGL', 'Alphabet (Google)', 'Verenigde Staten', 'USD', 'Nasdaq'),
    ('AMZN', 'Amazon.com', 'Verenigde Staten', 'USD', 'Nasdaq'),
    ('NVDA', 'NVIDIA', 'Verenigde Staten', 'USD', 'Nasdaq'),
    ('SAP.DE', 'SAP SE', 'Duitsland', 'EUR', 'Xetra'),
    ('INGA.AS', 'ING Groep', 'Nederland', 'EUR', 'Amsterdam'),
    ('UNA.AS', 'Unilever', 'Nederland', 'EUR', 'Amsterdam'),
    # Amerikaanse large caps (jaarcijfers via SEC, koers in dollar). Ze krijgen alleen een oordeel als alle controles slagen.
    ('META', 'Meta Platforms', 'Verenigde Staten', 'USD', 'Nasdaq'),
    ('TSLA', 'Tesla', 'Verenigde Staten', 'USD', 'Nasdaq'),
    ('COST', 'Costco', 'Verenigde Staten', 'USD', 'Nasdaq'),
    ('WMT', 'Walmart', 'Verenigde Staten', 'USD', 'New York'),
    ('JPM', 'JPMorgan Chase', 'Verenigde Staten', 'USD', 'NYSE'),
    ('V', 'Visa', 'Verenigde Staten', 'USD', 'NYSE'),
    ('MA', 'Mastercard', 'Verenigde Staten', 'USD', 'NYSE'),
    ('JNJ', 'Johnson & Johnson', 'Verenigde Staten', 'USD', 'NYSE'),
    ('LLY', 'Eli Lilly', 'Verenigde Staten', 'USD', 'NYSE'),
    ('PG', 'Procter & Gamble', 'Verenigde Staten', 'USD', 'NYSE'),
    ('KO', 'Coca-Cola', 'Verenigde Staten', 'USD', 'NYSE'),
    ('XOM', 'Exxon Mobil', 'Verenigde Staten', 'USD', 'NYSE'),
    # Uitbreiding (beta.23). Europese bedrijven die in dollar rapporteren staan genoteerd in New York, zodat koers en cijfers
    # dezelfde valuta hebben (zoals Shell). Bedrijven die in een andere valuta rapporteren dan de notering blijven hier weg.
    ('AZN', 'AstraZeneca', 'Verenigd Koninkrijk', 'USD', 'New York (Nasdaq)'),
    ('NVS', 'Novartis', 'Zwitserland', 'USD', 'New York (NYSE)'),
    ('ADBE', 'Adobe', 'Verenigde Staten', 'USD', 'Nasdaq'),
    ('CRM', 'Salesforce', 'Verenigde Staten', 'USD', 'NYSE'),
    ('ORCL', 'Oracle', 'Verenigde Staten', 'USD', 'NYSE'),
    ('CSCO', 'Cisco Systems', 'Verenigde Staten', 'USD', 'Nasdaq'),
    ('PEP', 'PepsiCo', 'Verenigde Staten', 'USD', 'Nasdaq'),
    ('MRK', 'Merck & Co.', 'Verenigde Staten', 'USD', 'NYSE'),
    ('ABBV', 'AbbVie', 'Verenigde Staten', 'USD', 'NYSE'),
    ('HD', 'Home Depot', 'Verenigde Staten', 'USD', 'NYSE'),
    ('MCD', "McDonald's", 'Verenigde Staten', 'USD', 'NYSE'),
    ('UNH', 'UnitedHealth Group', 'Verenigde Staten', 'USD', 'NYSE'),
    ('TXN', 'Texas Instruments', 'Verenigde Staten', 'USD', 'Nasdaq'),
    ('CAT', 'Caterpillar', 'Verenigde Staten', 'USD', 'NYSE'),
    ('AMGN', 'Amgen', 'Verenigde Staten', 'USD', 'Nasdaq'),
    ('NKE', 'Nike', 'Verenigde Staten', 'USD', 'NYSE'),
    # Uitbreiding (beta.27). Europese bedrijven met een SEC-jaarverslag (20-F, IFRS in euro) en een notering in euro:
    # koers en cijfers hebben dezelfde valuta. Gewone aandelen, geen ADR's (die hebben een andere aandelenverhouding).
    ('SAN.PA', 'Sanofi', 'Frankrijk', 'EUR', 'Parijs'),
    ('RACE.MI', 'Ferrari', 'Italië', 'EUR', 'Milaan'),
    ('PHIA.AS', 'Philips', 'Nederland', 'EUR', 'Amsterdam'),
    ('STLAM.MI', 'Stellantis', 'Nederland', 'EUR', 'Milaan'),
    ('NOKIA.HE', 'Nokia', 'Finland', 'EUR', 'Helsinki'),
    ('ENI.MI', 'Eni', 'Italië', 'EUR', 'Milaan'),
    ('DIS', 'Walt Disney', 'Verenigde Staten', 'USD', 'NYSE'),
    ('HON', 'Honeywell', 'Verenigde Staten', 'USD', 'Nasdaq'),
    ('LIN', 'Linde', 'Ierland', 'USD', 'Nasdaq'),
    ('TMO', 'Thermo Fisher Scientific', 'Verenigde Staten', 'USD', 'NYSE'),
)

from europa_indexen import catalogus as _europa_catalogus, indices as _europa_indices
CATALOGUS = CATALOGUS + tuple(_europa_catalogus())
INDICES = _europa_indices()
# Korte bedrijfsbeschrijving en vaste gegevens (Wikipedia CC BY-SA, Wikidata CC0), gemaakt met hulp/bedrijfsinfo.py.
_BEDRIJF_PAD = Path(__file__).with_name('bedrijfsinfo.json')
try:
    BEDRIJFSINFO = json.loads(_BEDRIJF_PAD.read_text(encoding='utf-8'))
except (OSError, ValueError):
    BEDRIJFSINFO = {}
_BEDRIJF_VELDEN = ('sector', 'hoofdkantoor', 'opgericht', 'website', 'beschrijving', 'taal', 'wikipedia', 'wikidata')


def bedrijf_voor(ticker):
    x = BEDRIJFSINFO.get(ticker)
    if not isinstance(x, dict):
        return None
    uit = {k: x.get(k) for k in _BEDRIJF_VELDEN if x.get(k) not in (None, '', [])}
    if isinstance(uit.get('beschrijving'), str) and len(uit['beschrijving']) > 450:
        # Kort houden: hele zinnen tot ongeveer 450 tekens; het volledige artikel staat achter de bronlink.
        t, zinnen = '', uit['beschrijving'].replace('. ', '.\n').split('\n')
        for z in zinnen:
            if t and len(t) + len(z) > 450:
                break
            t = (t + ' ' + z).strip()
        uit['beschrijving'] = t if len(t) <= 520 else t[:450].rsplit(' ', 1)[0] + ' …'
    return uit or None


def heeft_sec(ticker):
    """Alleen Amerikaanse noteringen (zonder punt) en expliciet gekoppelde Europese bedrijven hebben een SEC-jaarverslag."""
    from naic_fetch import SEC_LISTING_MAP
    return '.' not in ticker or ticker.upper() in SEC_LISTING_MAP


ESEF_LEI = HERE / 'esef_lei.json'
ARCHIEF_MAP = HERE / 'archief'          # jaarverslagarchief (laag 1); bewaard tussen runs via de GitHub-cache
ESEF_BUNDEL = HERE / 'esef_bundel.json.gz'
ESEF_INVESTERINGEN = HERE / 'esef_investeringen.json'
JAARVERSLAG_EPS = HERE / 'jaarverslag_eps.json'      # gerapporteerde winst per aandeel uit pdf-jaarverslagen (hulp/de_eps.py)   # eigen begrippen van bedrijven voor investeringen (hulp/esef_investeringen.py)
_ESEF_CACHE = {}


def esef_ophalen(ticker):
    """ESEF-feitenbestand (companyfacts-vorm, zie esef_bron.py) van een noteringscode, of None als er geen LEI of gegevens zijn.
    Alle bedrijven staan in één bestand (GitHub accepteert via de website maximaal 100 bestanden per upload)."""
    import gzip
    try:
        lei = json.loads(ESEF_LEI.read_text(encoding='utf-8')).get(ticker.upper(), {}).get('lei')
        if not lei:
            return None
        if ESEF_BUNDEL not in _ESEF_CACHE:
            with gzip.open(ESEF_BUNDEL, 'rt', encoding='utf-8') as f:
                _ESEF_CACHE[ESEF_BUNDEL] = json.load(f)
        cf = _ESEF_CACHE[ESEF_BUNDEL].get(lei)
        if cf:
            from esef_bron import corrigeer_eenheden
            cf, correcties = corrigeer_eenheden(cf)
            if correcties:
                cf = {**cf, 'eenheid_correcties': correcties}
            # cijfers uit pdf-jaarverslagen en uit de tekst van ESEF-rapporten (jaarverslag_bronnen.json), alleen aanvullend
            from jaarverslag_bronnen import aanvullen
            cf, verslag = aanvullen(cf, ticker)
            if verslag:
                cf = {**cf, 'jaarverslag_bronnen': verslag}
            # winst per aandeel uit de tekst van ESEF-rapporten waar het getal niet getagd is (esef_tekst_eps.json)
            from jaarverslag_bronnen import laad, TEKST_REGISTER
            cf, tverslag = aanvullen(cf, ticker, register=laad(TEKST_REGISTER))
            if tverslag:
                cf = {**cf, 'esef_tekst': tverslag}
            from esef_bron import corrigeer_eps_schaal
            cf, schaal = corrigeer_eps_schaal(cf)
            if schaal:
                cf = {**cf, 'eenheid_correcties': list(cf.get('eenheid_correcties') or []) + schaal}
        return cf
    except (OSError, ValueError):
        return None


def gegevens_uit_esef(cf, gecontroleerd_op):
    """Zelfde verificatie als bij SEC-bedrijven, op de ESEF-feiten; `bron` laat zien waar de cijfers vandaan komen."""
    from esef_bron import samenvatting
    from esef_bron import eps_keten, JAARVERSLAG_MIN_JAREN
    g = gegevens_uit_sec(samenvatting(cf, asof=gecontroleerd_op), gecontroleerd_op)
    g['bron'] = 'ESEF'
    if g.get('jaren') and (g.get('eps_status') != 'independently_verified' or (g.get('eps_verified_years') or 0) < 6):
        # Niet (volledig) nagerekend (vaak ontbreekt het aantal aandelen in machineleesbare vorm, of het is maar voor de laatste
        # jaren stabiel, zoals L'Oréal en Pernod Ricard). Het label-slot blijft dicht; maar de cijfers uit het officiële
        # jaarverslag zijn er wel, mits de EPS over de jaren onderling vergelijkbaar is. Alleen als de keten langer is, en
        # alleen bij minder dan 6 nagerekende jaren (genoeg voor NAIC: 5 jaar K/W); een langere nagerekende reeks blijft staan.
        keten = eps_keten(cf)
        nagerekend = (g.get('eps_verified_years') or 0) if g.get('eps_status') == 'independently_verified' else 0
        if keten and len(keten) > nagerekend:
            for j in g['jaren']:
                if j.get('end') in keten:
                    j['comparable_eps'] = keten[j['end']]
            jaren = [j for j in g['jaren'] if j.get('end') in keten]
            if len(jaren) >= JAARVERSLAG_MIN_JAREN:
                g['jaren'] = jaren
                g['niveau'] = 'jaarverslag'
    vul_investeringen_aan(g, cf)
    return g


CAPEX_IFRS_BREED = 'PurchaseOfPropertyPlantAndEquipmentIntangibleAssetsOtherThanGoodwillInvestmentPropertyAndOtherNoncurrentAssets'
# Terugval als het standaardbegrip voor materiële vaste activa ontbreekt (in volgorde van voorkeur). Deze begrippen zijn iets
# breder (ook immateriële activa of vastgoed); de app toont welk begrip gebruikt is.
CAPEX_TERUGVAL = (
    ('ifrs-full', CAPEX_IFRS_BREED, 'materiële en immateriële vaste activa en vastgoed samen'),
    ('us-gaap', 'PaymentsToAcquireProductiveAssets', 'betalingen voor productieve activa: materiële en immateriële vaste activa'),
    ('us-gaap', 'PaymentsToAcquireOtherPropertyPlantAndEquipment', 'overige materiële vaste activa'),
)


def _jaarverslag_eps():
    try:
        return json.loads(JAARVERSLAG_EPS.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {}


def vul_eps_jaarverslag(g, ticker, register=None):
    """Voor fondsen met alleen indicatieve cijfers (Yahoo): de gerapporteerde verwaterde winst per aandeel uit de
    jaarverslagen zelf (pdf, over de jaren gecontroleerd met de overlap tussen opeenvolgende verslagen). Vervangt de
    winst per aandeel van Yahoo in dezelfde jaren en voegt oudere jaren toe (alleen winst per aandeel; omzet, kasstroom en
    balans blijven van Yahoo). Elk jaar krijgt eps_bron 'jaarverslag'. Minder dan 4 jaar: niets."""
    reg = (register if register is not None else _jaarverslag_eps()).get(ticker) or {}
    reeks = {int(j): v for j, v in (reg.get('reeks') or {}).items() if _getal(v) is not None}
    jaren = g.get('jaren') or []
    if len(reeks) < 4 or not jaren:
        return
    eind = max(set(str(j.get('end', ''))[5:] for j in jaren if j.get('end')), key=[str(j.get('end', ''))[5:] for j in jaren].count)
    munt = jaren[-1].get('currency')
    per_jaar = {j.get('year'): j for j in jaren}
    # tweede bron: de winst per aandeel van Yahoo in dezelfde jaren (binnen 5% = overeen)
    vergeleken, afwijkend = 0, []
    for jaar, eps in reeks.items():
        y = _getal((per_jaar.get(jaar) or {}).get('comparable_eps'))
        if y is None:
            continue
        vergeleken += 1
        if not (abs(y - eps) <= 0.02 or (y * eps > 0 and abs(y / eps - 1) <= 0.05)):
            afwijkend.append(jaar)
    for jaar, eps in reeks.items():
        rij = per_jaar.get(jaar)
        if rij is None:
            rij = {'year': jaar, 'end': f'{jaar}-{eind}', 'currency': munt}
            jaren.append(rij)
        rij['comparable_eps'] = eps; rij['reported_eps'] = eps; rij['eps_bron'] = 'jaarverslag'
    jaren.sort(key=lambda j: j.get('year') or 0)
    g['jaren'] = jaren
    g['eps_jaarverslag'] = {'jaren': len(reeks), 'van': min(reeks), 'tot': max(reeks),
                            'documenten': [{'boekjaar': int(j), 'url': d.get('url'), 'pagina': d.get('pagina')} for j, d in sorted((reg.get('verslagen') or {}).items())],
                            'controle': {'bron': 'Yahoo Finance', 'vergeleken': vergeleken, 'overeen': vergeleken - len(afwijkend), 'afwijkend': sorted(afwijkend)},
                            'uitleg': 'Verwaterde winst per aandeel zoals gerapporteerd in de jaarverslagen; per jaar gecontroleerd met het volgende verslag (vergelijkend cijfer). Ontbreekt een verslag, dan komt dat jaar uit het meerjarenoverzicht van een later verslag. Niet nagerekend.'}


def vul_eps_yahoo(g, ruw):
    """Winst per aandeel van Yahoo Finance in de jaren van de officiële cijfers (zelfde valuta, jaareinde binnen 15 dagen).
    Alleen als dat minstens 4 jaren oplevert; elk jaar krijgt eps_bron 'yahoo'."""
    from yahoo_jaren import jaren_uit_yahoo
    if not ruw:
        return
    y = jaren_uit_yahoo(ruw)
    munt = ruw.get('valuta')
    paren = []
    for j in g.get('jaren') or []:
        try:
            e = date.fromisoformat(str(j.get('end')))
        except ValueError:
            continue
        if munt and j.get('currency') and j['currency'] != munt:
            continue
        for x in y:
            try:
                if abs((date.fromisoformat(str(x.get('end'))) - e).days) <= 15 and _getal(x.get('comparable_eps')) is not None:
                    paren.append((j, x['comparable_eps'])); break
            except ValueError:
                continue
    if len(paren) < 4:
        return
    for j, eps in paren:
        j['comparable_eps'] = eps; j['eps_bron'] = 'yahoo'
    if not g.get('niveau'):
        g['niveau'] = 'indicatief'                 # zonder nagerekende of officiële winst per aandeel: indicatief
    g['eps_yahoo'] = {'jaren': len(paren), 'uitleg': 'Winst per aandeel van Yahoo Finance (indicatief): de officiële bron meldt geen bruikbare winst per aandeel. Overige cijfers uit de officiële bron.'}


def _investeringen_register():
    try:
        return json.loads(ESEF_INVESTERINGEN.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {}


def vul_investeringen_aan(g, cf, register=None):
    """Vult ontbrekende investeringen (capex) aan, alleen waar het standaardbegrip voor materiële vaste activa ontbreekt:
    1. het eigen begrip van het bedrijf (per bedrijf nagekeken, esef_investeringen.json), met de indiening erbij;
    2. anders een iets breder standaardbegrip uit hetzelfde bestand (CAPEX_TERUGVAL; ESEF of SEC).
    Alleen bij hetzelfde boekjaareinde en dezelfde valuta; een bestaand cijfer wordt nooit vervangen."""
    jaren = g.get('jaren') or []
    if not jaren or all(j.get('capex') is not None for j in jaren):
        return
    feiten = (cf or {}).get('facts') or {}
    terugval = []                                   # [(omschrijving, {(einde, valuta): feit})] in volgorde van voorkeur
    for ns, tag, wat in CAPEX_TERUGVAL:
        per = {}
        for unit, rijen in (((feiten.get(ns) or {}).get(tag) or {}).get('units') or {}).items():
            for r in rijen:
                try:
                    duur = (date.fromisoformat(r['end']) - date.fromisoformat(r['start'])).days
                except (KeyError, TypeError, ValueError):
                    continue
                if not 330 <= duur <= 390 or r.get('form') not in ('10-K', '10-K/A', '20-F', '40-F') or r.get('fp') not in (None, 'FY'):
                    continue
                oud = per.get((r['end'], unit))
                if oud is None or str(r.get('filed') or '') > str(oud.get('filed') or ''):
                    per[(r['end'], unit)] = r                         # nieuwste indiening wint
        terugval.append((ns + ':' + tag + ' (' + wat + ')', per))
    reg = (register if register is not None else _investeringen_register()).get((cf or {}).get('lei') or '', {}).get('jaren') or {}
    for j in jaren:
        if j.get('capex') is not None or not j.get('end'):
            continue
        e = reg.get(j['end'])
        if e and e.get('unit') == j.get('currency') and _getal(e.get('val')) is not None:
            j['capex'] = abs(e['val'])
            j['capex_bron'] = 'ESEF, eigen begrip van het bedrijf: ' + ' + '.join(e.get('begrippen') or []) + ' (indiening ' + str(e.get('fxo_id')) + ')'
            continue
        for wat, per in terugval:
            r = per.get((j['end'], j.get('currency')))
            if r and _getal(r.get('val')) is not None:
                j['capex'] = abs(r['val'])
                j['capex_bron'] = wat + ', indiening ' + str(r.get('accn'))
                break


JAAR_VELDEN = ('year', 'end', 'currency', 'eps_gewoon', 'sales', 'net_income', 'reported_eps', 'comparable_eps',
               'operating_cash_flow', 'capex', 'capex_bron', 'equity', 'eps_check', 'eps_reden')


def _getal(x):
    return x if isinstance(x, (int, float)) and not isinstance(x, bool) and x == x and abs(x) != float('inf') else None


DIAGNOSE_DELEN = ('PerShare', 'WeightedAverage', 'ProfitLossAttributable', 'NetIncomeLoss', 'ProfitLoss')
RUIS = ('ShareBased', 'Sharebased', 'Antidilutive', 'Exercise', 'DiscountRate', 'Yield', 'InterestRate', 'GrantDateFairValue',
        'RemainingContractualTerm', 'ParValue', 'ParOrStated', 'Acquiree', 'ProForma', 'DividendsPerShare')
JAARWAARDE_TAGS = ('EarningsPerShareDiluted', 'DilutedEarningsLossPerShare', 'EarningsPerShareBasicAndDiluted',
                   'WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfShareOutstandingBasicAndDiluted',
                   'AdjustedWeightedAverageShares', 'NetIncomeLoss', 'ProfitLoss', 'ProfitLossAttributableToOwnersOfParent',
                   'NetIncomeLossAvailableToCommonStockholdersBasic', 'ProfitLossAttributableToOrdinaryEquityHoldersOfParentEntity')


def jaarwaarden(payload, vanaf='2015-01-01', max_per_tag=40):
    """Alleen voor diagnose: de jaarwaarden (jaarverslagen, periode van 330 tot 390 dagen) van de sleutelbegrippen, zodat
    een bedrijf waarvan jaren ontbreken of waarvan het aantal aandelen verspringt gericht onderzocht kan worden."""
    uit = {}
    facts = payload.get('facts') if isinstance(payload, dict) else None
    if not isinstance(facts, dict):
        return uit
    for taxonomie, tags in sorted(facts.items()):
        for tag in JAARWAARDE_TAGS:
            blok = (tags or {}).get(tag) if isinstance(tags, dict) else None
            for eenheid, rijen in sorted(((blok or {}).get('units') or {}).items()):
                lijst = []
                for r in rijen if isinstance(rijen, list) else []:
                    if not isinstance(r, dict) or r.get('form') not in ('10-K', '10-K/A', '20-F', '40-F') or str(r.get('end', '')) < vanaf:
                        continue
                    try:
                        dagen = (date.fromisoformat(r['end']) - date.fromisoformat(r['start'])).days
                    except (KeyError, TypeError, ValueError):
                        continue
                    if 330 <= dagen <= 390:
                        lijst.append([r['end'], r.get('val'), r.get('filed'), r.get('fp')])
                if lijst:
                    uit[f'{taxonomie}:{tag} [{eenheid}]'] = sorted(lijst)[-max_per_tag:]
    return uit


def eps_tag_overzicht(payload):
    """Compact overzicht van de winst- en aandelenconcepten in een SEC-companyfacts-bestand.

    Alleen voor diagnose: laat zien welke namen een bedrijf werkelijk gebruikt (eenheid, soorten indiening,
    jaarbereik), zodat een bedrijf waarvan alle EPS ontbreekt gericht kan worden aangepakt. Verzint niets.
    """
    uit = {}
    facts = payload.get('facts') if isinstance(payload, dict) else None
    if not isinstance(facts, dict):
        return uit
    for taxonomie, tags in sorted(facts.items()):
        if not isinstance(tags, dict):
            continue
        for tag, blok in sorted(tags.items()):
            if not any(d in tag for d in DIAGNOSE_DELEN) or not isinstance(blok, dict):
                continue
            if any(x in tag for x in RUIS):
                continue
            for eenheid, rijen in sorted((blok.get('units') or {}).items()):
                rijen = [r for r in rijen if isinstance(r, dict)] if isinstance(rijen, list) else []
                jaren = sorted({r.get('fy') for r in rijen if isinstance(r.get('fy'), int)})
                uit[f'{taxonomie}:{tag} [{eenheid}]'] = {
                    'n': len(rijen), 'indieningen': sorted({str(r.get('form')) for r in rijen}),
                    'fy': [jaren[0], jaren[-1]] if jaren else None,
                    'met_accn': sum(1 for r in rijen if r.get('accn'))}
    return uit


def sec_diagnose(sec_ticker, email, fetcher=None):
    """Haalt het companyfacts-bestand op en geeft het overzicht; bij een fout staat de reden erin."""
    try:
        from source_engine import CIK_MAP_URL, FACTS_URL, cik_for_ticker, fetch_json
        fetcher = fetcher or fetch_json
        cik, _ = cik_for_ticker(sec_ticker, fetcher(CIK_MAP_URL, email))
        if cik is None:
            return {'fout': f'{sec_ticker} niet in de SEC-lijst'}
        payload = fetcher(FACTS_URL.format(cik=cik), email)
        uit = {'sec_ticker': sec_ticker, 'concepten': eps_tag_overzicht(payload), 'jaarwaarden': jaarwaarden(payload)}
        try:        # hoe groot is het bestand dat we kregen? Een afgeknot bestand verklaart een leeg dossier
            facts = payload.get('facts') or {}
            uit['bestand'] = {'cik': cik, 'taxonomieen': {k: len(v) for k, v in facts.items() if isinstance(v, dict)}, 'entityName': payload.get('entityName'),
                              'rijen_totaal': sum(len(u) for v in facts.values() if isinstance(v, dict) for b in v.values() if isinstance(b, dict) for u in (b.get('units') or {}).values() if isinstance(u, list))}
        except Exception:
            pass
        return uit
    except Exception as exc:  # diagnose mag de run nooit laten mislukken
        return {'fout': f'{type(exc).__name__}: {exc}'[:200]}


EXTRA_VELDEN = ('pretax_income', 'depreciation', 'dividends_paid', 'long_term_debt')
SCORE_VELDEN = ('total_assets', 'current_assets', 'current_liabilities', 'total_liabilities', 'retained_earnings', 'cash',
                'gross_profit', 'operating_income', 'interest_expense', 'shares_diluted')
KOERS_VELDEN = ('koers_hoog', 'koers_laag', 'dividend_ps')


def voeg_koershistorie_toe(gegevens, punten, dividenden, valuta):
    """Per jaar hoogste/laagste koers en dividend per aandeel. Alleen als koers en jaarcijfers dezelfde, enige valuta hebben
    (geen omrekening). Anders of bij te weinig koersen blijft alles None."""
    from koershistorie import jaarkoersen
    jaren = gegevens.get('jaren') or []
    valutas = gegevens.get('currencies') or sorted({j.get('currency') for j in jaren if j.get('currency')})
    ok = len(valutas) == 1 and valutas[0] == valuta
    res = jaarkoersen(punten, dividenden, [j.get('end') for j in jaren]) if ok else {}
    for j in jaren:
        rij = res.get(j.get('end')) or {}
        for veld in KOERS_VELDEN:
            j[veld] = _getal(rij.get(veld))
    return gegevens


def voeg_extra_toe(gegevens, payload):
    """Vult per jaar de extra NAIC-velden (winst vóór belasting, dividend, schuld, afschrijving) uit het
    companyfacts-bestand. Veld ontbreekt = None. Raakt de EPS-controle en het label-slot niet."""
    from extra_kentallen import extra_jaarcijfers
    jaren = gegevens.get('jaren') or []
    extra = extra_jaarcijfers(payload, jaren)
    gegevens['extra_versie'] = EXTRA_VERSIE
    for j in jaren:
        rij = extra.get(j.get('end')) or {}
        for veld in EXTRA_VELDEN + SCORE_VELDEN:
            j[veld] = _getal(rij.get(veld))
    return gegevens


def sec_payload(sec_ticker, email, fetcher=None):
    """Companyfacts-bestand van de SEC, of None bij elke fout (extra cijfers zijn nooit reden voor een mislukte run)."""
    try:
        from source_engine import CIK_MAP_URL, FACTS_URL, cik_for_ticker, fetch_json
        fetcher = fetcher or fetch_json
        cik, _ = cik_for_ticker(sec_ticker, fetcher(CIK_MAP_URL, email))
        return None if cik is None else fetcher(FACTS_URL.format(cik=cik), email)
    except Exception:
        return None


def gegevens_uit_sec(sec, gecontroleerd_op):
    """Zet de SEC-samenvatting (summarize_sec) om naar het gegevensblok voor de webapp.

    Geeft een blok met `fout` als er geen bruikbaar dossier is. Het bewijs voor het label-slot komt uit
    dezelfde functie als in de Streamlit-app (eps_verification.gate_evidence).
    """
    from eps_verification import gate_evidence
    if not isinstance(sec, dict) or sec.get('status') != 'facts_found' or not isinstance(sec.get('dossier'), dict):
        status = (sec or {}).get('status') if isinstance(sec, dict) else None
        reden = ((sec or {}).get('reason') or (sec or {}).get('message')
                 or 'Geen volledige jaarcijfers beschikbaar' + (f' (status van de bron: {status})' if status else ' (de SEC-gegevens bevatten geen volledige jaarreeks voor dit bedrijf)') + '.')
        return {'gecontroleerd_op': gecontroleerd_op, 'fout': str(reden)[:300], 'eps_status': None,
                'eps_verified_years': None, 'currencies': None, 'rejected_sources': None,
                'jaren': [], 'splits': [], 'waarschuwingen': []}
    dossier = sec['dossier']
    bewijs = gate_evidence(sec)
    jaren = [{k: r.get(k) for k in JAAR_VELDEN} for r in dossier.get('year_table') or []]
    splits, gezien = [], set()
    for s in dossier.get('split_event_audit') or []:
        if not isinstance(s, dict):
            continue
        sleutel = (s.get('date'), s.get('ratio'), s.get('status'))
        if sleutel in gezien:
            continue
        gezien.add(sleutel)
        splits.append({'datum': s.get('date'), 'ratio': s.get('ratio'), 'status': s.get('status'),
                       'redenen': s.get('reasons') or [],
                       'bewijs': [{'periode': e.get('periode'), 'voor': e.get('eps_voor'), 'na': e.get('eps_na'),
                                   'verhouding': e.get('verhouding_waargenomen')}
                                  for e in s.get('verification_evidence') or []]})
    return {'gecontroleerd_op': gecontroleerd_op, 'fout': None,
            'eps_status': bewijs.get('eps_status'), 'eps_verified_years': bewijs.get('eps_verified_years'),
            'currencies': bewijs.get('currencies'), 'rejected_sources': bewijs.get('rejected_sources'),
            'jaren': jaren, 'splits': splits, 'waarschuwingen': list(dossier.get('warnings') or []),
            'eps_toelichting': dossier.get('eps_verification_note')}


def koers_uit_reeks(reeks):
    """reeks: lijst (datum 'YYYY-MM-DD', slotkoers). Geeft het koersblok of None."""
    punten = []
    for datum, slot in reeks or []:
        slot = _getal(slot)
        try:
            date.fromisoformat(datum)
        except (TypeError, ValueError):
            continue
        if slot is not None and slot > 0:
            punten.append((datum, round(float(slot), 4)))
    if not punten:
        return None
    punten.sort()
    laatste = punten[-1]
    sma = None
    if len(punten) >= 50:
        sma = round(sum(p[1] for p in punten[-50:]) / 50, 4)
    blok = {'datum': laatste[0], 'slot': laatste[1], 'sma50': sma, 'reeks': [list(p) for p in punten[-130:]]}
    blok.update(technisch(punten))
    return blok


def technisch(punten):
    """Informatieve timing-kentallen uit een gesorteerde reeks (datum, slot). Te weinig data geeft None, nooit een schatting."""
    uit = {'sma200': None, 'hoog52': None, 'laag52': None, 'rsi14': None}
    if len(punten) >= 200:
        uit['sma200'] = round(sum(p[1] for p in punten[-200:]) / 200, 4)
    laatste = date.fromisoformat(punten[-1][0])
    jaar = [p[1] for p in punten if 0 <= (laatste - date.fromisoformat(p[0])).days <= 365]
    eerste = date.fromisoformat(punten[0][0])
    # Minstens ongeveer een volledig jaar aan handelsdagen nodig voor een eerlijke 52-wekenrange.
    if len(jaar) >= 200 and (laatste - eerste).days >= 350:
        uit['hoog52'], uit['laag52'] = max(jaar), min(jaar)
    if len(punten) >= 100:
        koersen = [p[1] for p in punten]
        winst = verlies = 0.0
        for i in range(1, 15):
            d = koersen[i] - koersen[i - 1]
            winst += max(d, 0); verlies += max(-d, 0)
        winst, verlies = winst / 14, verlies / 14
        for i in range(15, len(koersen)):                 # Wilder-afvlakking
            d = koersen[i] - koersen[i - 1]
            winst = (winst * 13 + max(d, 0)) / 14
            verlies = (verlies * 13 + max(-d, 0)) / 14
        uit['rsi14'] = 100.0 if verlies == 0 and winst > 0 else (50.0 if verlies == 0 else round(100 - 100 / (1 + winst / verlies), 1))
    return uit


def maak_record(meta, *, koers=None, gegevens=None):
    ticker, naam, land, valuta, beurs = meta
    if gegevens and isinstance(gegevens.get('currencies'), list):
        # Koers en cijfers moeten in dezelfde valuta staan: zonder omrekening is vergelijken niet zinvol.
        # De notering telt dus mee; bij een verschil (Shell: cijfers in USD, koers in EUR) is de valuta niet eenduidig.
        gegevens = {**gegevens, 'currencies': sorted(set(gegevens['currencies']) | {valuta})}
    return {'ticker': ticker, 'naam': naam, 'land': land, 'valuta': valuta, 'beurs': beurs,
            'indices': INDICES.get(ticker), 'bedrijf': bedrijf_voor(ticker), 'koers': koers, 'gegevens': gegevens}


def maak_bestand(records, gemaakt=None, bron=''):
    gemaakt = gemaakt or datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    return {'schema': SCHEMA, 'gemaakt': gemaakt, 'bron': bron, 'aandelen': records}


def maak_status(bestand):
    """Klein overzicht (zonder koersreeksen) om snel te zien wat er per aandeel is vastgesteld en waarom niet."""
    uit = []
    for rec in bestand.get('aandelen', []):
        g = rec.get('gegevens') or {}
        open_jaren = [{'jaar': j.get('year'), 'status': j.get('eps_check'), 'reden': str(j.get('eps_reden') or '')[:300]}
                      for j in g.get('jaren') or [] if j.get('eps_check') != 'onderbouwd']
        koers = rec.get('koers') or {}
        uit.append({'ticker': rec.get('ticker'), 'koers_datum': koers.get('datum'), 'fout': g.get('fout'),
                    'eps_status': g.get('eps_status'), 'jaren_bevestigd': g.get('eps_verified_years'),
                    'jaren_in_dossier': len(g.get('jaren') or []), 'valuta': g.get('currencies'),
                    'afgewezen_bronnen': g.get('rejected_sources'),
                    'splits': [{'datum': x.get('datum'), 'ratio': x.get('ratio'), 'status': x.get('status'),
                                'redenen': x.get('redenen')} for x in g.get('splits') or []],
                    'open_jaren': open_jaren, 'einddata': [j.get('end') for j in g.get('jaren') or []],
                    'extra_dekking': {v: sum(1 for j in g.get('jaren') or [] if j.get(v) is not None) for v in EXTRA_VELDEN + SCORE_VELDEN + KOERS_VELDEN},
                    'toelichting': g.get('eps_toelichting'),
                    'waarschuwingen': g.get('waarschuwingen'), 'diagnose': g.get('diagnose'),
                    'extra_diagnose': g.get('extra_diagnose'),
                    'archief': _archief_status(g.get('archief'))})
    return {'gemaakt': bestand.get('gemaakt'), 'yahoo_vergelijk': bestand.get('yahoo_vergelijk'), 'aandelen': uit}


def _archief_status(blok):
    """Kort overzicht van het jaarverslagarchief voor status.json (meldingen alleen als ze nieuw zijn, niet de terugblik)."""
    if not isinstance(blok, dict):
        return None
    if blok.get('fout'):
        return {'fout': blok['fout']}
    return {'verslagen': blok.get('verslagen'), 'laatste_verslag': (blok.get('laatste_verslag') or {}).get('ingediend'),
            'nieuw_deze_run': blok.get('nieuw_deze_run'), 'eps_controle': blok.get('eps_controle'),
            'nieuwe_meldingen': [m for m in blok.get('meldingen') or [] if not m.get('historisch')],
            'terugblik': [m.get('tekst') for m in blok.get('meldingen') or [] if m.get('historisch') and m.get('soort') != 'herwerking'][-6:]}


def schrijf(bestand, map_=UITVOER):
    map_ = Path(map_)
    map_.mkdir(parents=True, exist_ok=True)
    tekst = json.dumps(bestand, ensure_ascii=False, separators=(',', ':'))
    (map_ / 'aandelen.json').write_text(tekst, encoding='utf-8')
    # Ook als script, zodat de pagina ook zonder webserver (en zonder fetch) de gegevens kan laden.
    (map_ / 'aandelen.js').write_text('window.AANDEEL_DATA = ' + tekst + ';\n', encoding='utf-8')
    (map_ / 'status.json').write_text(json.dumps(maak_status(bestand), ensure_ascii=False, indent=1), encoding='utf-8')
    import uitleg
    uit = {'termen': [{'naam': n, 'tekst': t} for n, t in uitleg.TERMS]}
    (map_ / 'uitleg.js').write_text('window.AANDEEL_UITLEG = ' + json.dumps(uit, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')


def demo(pad_resultaat):
    """Alleen wat in een eerdere praktijkcontrole echt is gecontroleerd; de rest blijft 'nog niet gecontroleerd'."""
    resultaat = json.loads(Path(pad_resultaat).read_text(encoding='utf-8'))
    sec = resultaat.get('sec') or {}
    gecontroleerd = (resultaat.get('checked_utc') or '')[:10] or None
    gedekt = {resultaat.get('sec_ticker')}
    records = []
    for meta in CATALOGUS:
        gegevens = gegevens_uit_sec(sec, gecontroleerd) if meta[0] in gedekt else None
        records.append(maak_record(meta, gegevens=gegevens))
    return maak_bestand(records, bron='Demo: eerder gecontroleerde praktijkrun; geen koersen')


EXTRA_ZOEK = {'pretax_income': ('BeforeIncomeTax', 'BeforeTax'),
              'depreciation': ('Depreciation', 'Amortization', 'Amortisation'),
              'dividends_paid': ('Dividend',),
              'long_term_debt': ('Borrowings', 'LongTermDebt', 'DebtNoncurrent', 'DebtInstrument')}


def extra_namen(payload, max_per_veld=10):
    """Alleen voor diagnose: welke begrippen een bedrijf gebruikt voor afschrijving, dividend en lange schuld,
    zodat ontbrekende extra cijfers gericht verholpen kunnen worden. Kort: aantal waarden en jaarbereik."""
    uit = {v: {} for v in EXTRA_ZOEK}
    facts = payload.get('facts') if isinstance(payload, dict) else None
    if not isinstance(facts, dict):
        return uit
    for taxonomie, tags in sorted(facts.items()):
        if not isinstance(tags, dict):
            continue
        for tag, blok in sorted(tags.items()):
            if not isinstance(blok, dict) or any(x in tag for x in RUIS) or 'PerShare' in tag:
                continue
            for veld, delen in EXTRA_ZOEK.items():
                if not any(d in tag for d in delen) or len(uit[veld]) >= max_per_veld:
                    continue
                for eenheid, rijen in sorted((blok.get('units') or {}).items()):
                    if eenheid in ('shares', 'pure') or not isinstance(rijen, list):
                        continue
                    jaren = sorted({r.get('fy') for r in rijen if isinstance(r, dict) and r.get('form') in ('10-K', '20-F', '40-F')
                                    and isinstance(r.get('fy'), int)})
                    if jaren:
                        uit[veld][f'{taxonomie}:{tag} [{eenheid}]'] = [jaren[0], jaren[-1], len(jaren)]
    return uit


def live(email, fetch_prijzen=None, sec_samenvatting=None, diagnose=None, payload_ophalen=None, historie_ophalen=None,
         valuta_ophalen=None, pauze=None, esef_ophalen=None, vorige=None, yahoo_ophalen=None, archief=None, analisten_ophalen=None):
    from naic_fetch import sec_ticker_for_listing
    if sec_samenvatting is None:
        # Echte run: alle SEC-aanroepen lopen via het jaarverslagarchief (laag 1). Dat bewaart elk jaarverslag één keer,
        # meldt splitsingen/herwerkingen bij een nieuw verslag en haalt elk SEC-bestand per run maar één keer op.
        from praktijkcontrole_sec_esef import summarize_sec
        from source_engine import sec_snapshot
        if archief is None:
            from jaarverslag_archief import Archief
            archief = Archief(ARCHIEF_MAP)
        _arch = archief

        def sec_samenvatting(t, e):
            return summarize_sec(t, e, fetcher=lambda tk, asof, em: sec_snapshot(tk, asof, em, fetcher=_arch.fetch_json))
        if payload_ophalen is None:
            payload_ophalen = lambda t, e: sec_payload(t, e, fetcher=_arch.fetch_json)
        if diagnose is None:
            diagnose = lambda t, e: sec_diagnose(t, e, fetcher=_arch.fetch_json)
    if analisten_ophalen is None:
        # Alleen in een echte run (koersen van Yahoo) ook het analistenadvies; met nepkoersen (tests) niet.
        analisten_ophalen = _yahoo_analisten if fetch_prijzen is None else (lambda t: None)
    if fetch_prijzen is None:
        fetch_prijzen = _yahoo_reeks
    diagnose = diagnose or sec_diagnose
    payload_ophalen = payload_ophalen or sec_payload
    historie_ophalen = historie_ophalen or _yahoo_historie
    valuta_ophalen = valuta_ophalen if valuta_ophalen is not None else _yahoo_valuta
    pauze = pauze if pauze is not None else _pauze
    esef_ophalen = esef_ophalen if esef_ophalen is not None else globals()['esef_ophalen']
    vandaag = date.today().isoformat()
    records = []
    vorige = vorige or {}
    from yahoo_jaren import gegevens_uit_yahoo, vergelijk as yahoo_vergelijk, samenvoegen as yahoo_samenvoegen, haal_yahoo
    yahoo_ophalen = yahoo_ophalen if yahoo_ophalen is not None else haal_yahoo
    vergelijking, vergeleken_bedrijven = {}, 0
    for nr, meta in enumerate(CATALOGUS):
        ticker = meta[0]
        oud = vorige.get(ticker)
        if _hergebruik(oud, vandaag):
            # Goedgekeurde jaarcijfers veranderen pas bij een nieuw jaarverslag: niet elke nacht opnieuw ophalen.
            gegevens = oud
            esef_cf = None
        elif heeft_sec(ticker):
            if archief is not None:
                archief.laatste_cik = None
            for poging in (1, 2):           # een tijdelijke SEC-storing of -vertraging krijgt één tweede kans
                if poging == 2 and archief is not None:
                    archief.vergeet()       # echt opnieuw ophalen, niet het bestand uit het geheugen
                try:
                    gegevens = gegevens_uit_sec(sec_samenvatting(sec_ticker_for_listing(ticker), email), vandaag)
                except Exception as exc:  # nooit stilzwijgend een gat: de reden gaat mee
                    gegevens = gegevens_uit_sec({'status': 'error', 'message': f'{type(exc).__name__}: {exc}'}, vandaag)
                if gegevens.get('jaren') or poging == 2:
                    break
                for _ in range(10):
                    pauze()             # ongeveer vier seconden wachten
        else:
            gegevens = gegevens_uit_sec({'status': 'geen_sec', 'reason': 'Geen SEC-jaarverslag voor dit bedrijf; alleen koersgegevens.'}, vandaag)
        esef_cf = None
        if (gegevens.get('eps_verified_years') or 0) < 10:
            # Geen of onvolledig SEC-dossier: probeer het officiële ESEF-jaarverslag. Het dossier met de meeste bevestigde
            # jaren wint; bij gelijkspel blijft SEC staan. Er wordt nooit gemengd.
            try:
                esef_cf = esef_ophalen(ticker)
                if esef_cf:
                    esef_g = gegevens_uit_esef(esef_cf, vandaag)
                    if (esef_g.get('eps_verified_years') or 0) > (gegevens.get('eps_verified_years') or 0) or not gegevens.get('jaren'):
                        gegevens = esef_g
                    else:
                        esef_cf = None
            except Exception as exc:
                esef_cf = None
                gegevens.setdefault('esef_fout', f'{type(exc).__name__}: {exc}'[:200])
        yahoo_ruw = None
        officieel_mislukt = bool(oud and oud.get('jaren') and not oud.get('fout') and oud.get('bron') != 'Yahoo Finance')
        if not gegevens.get('jaren') and officieel_mislukt:
            gegevens = dict(oud)                      # officieel ophalen mislukt: de laatste goede jaarcijfers blijven staan, met hun eigen datum
            gegevens['uit_vorige_run'] = True
        if not gegevens.get('jaren'):
            # Geen officiële bron: indicatieve jaarcijfers van Yahoo Finance (nooit het label, wel een voorlopig oordeel).
            try:
                yahoo_ruw = yahoo_ophalen(ticker)
                yg = gegevens_uit_yahoo(yahoo_ruw, vandaag)
                if yg.get('jaren'):
                    vul_eps_jaarverslag(yg, ticker)
                    gegevens = yg
                else:
                    gegevens.setdefault('yahoo_fout', yg.get('fout'))
            except Exception as exc:
                gegevens.setdefault('yahoo_fout', f'{type(exc).__name__}: {exc}'[:200])
            if not gegevens.get('jaren') and oud and oud.get('jaren') and not oud.get('fout'):
                fout = gegevens.get('yahoo_fout')
                gegevens = dict(oud)                  # Yahoo mislukt: de laatste goede (indicatieve) cijfers blijven staan
                gegevens['uit_vorige_run'] = True
                if fout:
                    gegevens['yahoo_fout'] = fout
                if gegevens.get('bron') == 'Yahoo Finance':
                    gegevens['jaren'] = [dict(j) for j in gegevens['jaren']]
                    vul_eps_jaarverslag(gegevens, ticker)
        elif nr % 4 == 0 and gegevens is not oud and not gegevens.get('uit_vorige_run'):
            # Steekproef: leg Yahoo naast de officiële cijfers, zodat zichtbaar wordt hoe betrouwbaar Yahoo is.
            try:
                from yahoo_jaren import jaren_uit_yahoo
                ruw = yahoo_ophalen(ticker)
                if ruw:
                    yahoo_samenvoegen(vergelijking, yahoo_vergelijk(jaren_uit_yahoo(ruw), gegevens['jaren']))
                    vergeleken_bedrijven += 1
            except Exception:
                pass
        if (gegevens.get('jaren') and gegevens.get('bron') != 'Yahoo Finance'
                and not any(_getal(j.get('comparable_eps')) is not None for j in gegevens['jaren'])):
            # Officiële cijfers zonder één bruikbaar jaar winst per aandeel (Visa: alleen per aandelenklasse gemeld; banken die
            # het niet taggen): de winst per aandeel van Yahoo Finance, als indicatief gemarkeerd. De rest blijft officieel.
            try:
                vul_eps_yahoo(gegevens, yahoo_ophalen(ticker))
            except Exception:
                pass
        if gegevens is oud or gegevens.get('bron') == 'Yahoo Finance':
            pass                                      # hergebruikt of van Yahoo: de extra cijfers zitten er al in
        elif gegevens.get('jaren') and not gegevens.get('uit_vorige_run'):
            try:
                extra_payload = esef_cf if esef_cf else payload_ophalen(sec_ticker_for_listing(ticker), email)
                voeg_extra_toe(gegevens, extra_payload)
                if not esef_cf:
                    vul_investeringen_aan(gegevens, extra_payload, register={})
                if any(not sum(1 for j in gegevens['jaren'] if j.get(v) is not None) for v in EXTRA_VELDEN):
                    gegevens['extra_diagnose'] = extra_namen(extra_payload)
            except Exception:
                pass            # extra cijfers ontbreken dan; de rest van de run blijft geldig
        if gegevens is not oud and not gegevens.get('uit_vorige_run') and gegevens.get('bron') != 'Yahoo Finance' and heeft_sec(ticker) and not esef_cf and (gegevens.get('eps_verified_years') or 0) < 10:
            gegevens['diagnose'] = diagnose(sec_ticker_for_listing(ticker), email)
        if (archief is not None and gegevens is not oud and heeft_sec(ticker) and archief.laatste_cik
                and gegevens.get('bron') not in ('ESEF', 'Yahoo Finance') and not gegevens.get('uit_vorige_run')):
            try:
                blok = archief.samenvatting(archief.laatste_cik, gegevens.get('jaren'))
                if blok:
                    gegevens['archief'] = blok
            except Exception as exc:    # het archief is aanvullende informatie; de run gaat altijd door
                gegevens['archief'] = {'fout': f'{type(exc).__name__}: {exc}'[:200]}
        koers, punten, dividenden = None, [], []
        pence = meta[3] == 'GBX'
        if pence:
            meta = meta[:3] + ('GBP',) + meta[4:]     # Londen noteert in pence; de app rekent alles in ponden
        if valuta_klopt(meta[:3] + ('GBX',) + meta[4:] if pence else meta, valuta_ophalen):
            try:
                reeks = fetch_prijzen(ticker)
                koers = koers_uit_reeks(pence_naar_pond(reeks) if pence else reeks)
            except Exception:
                koers = None
            try:
                punten, dividenden = historie_ophalen(ticker)
                if pence:
                    punten = pence_naar_pond(punten)
                    dividenden = dividend_naar_pond(dividenden, punten)
            except Exception:
                punten, dividenden = [], []
            if gegevens.get('jaren'):
                try:
                    voeg_koershistorie_toe(gegevens, punten, dividenden, meta[3])
                except Exception:
                    pass        # geen koershistorie: K/W-historie en dividendrendement ontbreken, de rest blijft geldig
            if koers is not None:
                from koershistorie import koersbereik
                koers['bereik'] = koersbereik(punten)
        analisten = None
        try:
            analisten = analisten_uit_info(analisten_ophalen(ticker), vandaag, pence)
        except Exception:
            analisten = None       # ter informatie; ontbreekt het, dan staat er dat het niet bekend is
        pauze()
        rec = maak_record(meta, koers=koers, gegevens=gegevens)
        if analisten:
            rec['analisten'] = analisten
        records.append(rec)
    bestand = maak_bestand(records, bron='SEC companyfacts, ESEF-jaarverslagen en Yahoo Finance (koersen en indicatieve jaarcijfers)')
    bestand['yahoo_vergelijk'] = {'bedrijven': vergeleken_bedrijven, 'velden': vergelijking}
    return bestand


EXTRA_VERSIE = 5              # verhogen als de rekenregels van de extra kentallen veranderen: dan wordt elk bedrijf
                               # één keer opnieuw opgehaald (2 = afgeleide totale schulden, beta.52; 3 = investeringen uit eigen begrippen, beta.66; 4 = winst per aandeel over ESEF-rapporten, beta.67; 5 = brug over ontbrekend rapport, beta.70)
HERGEBRUIK_DAGEN = 90          # uiterlijk na zoveel dagen toch opnieuw (vangt correcties zoals een 10-K/A op)
NIEUW_VERSLAG_NA = 365 + 25    # vanaf zoveel dagen na het laatste boekjaareinde kan een nieuw jaarverslag verschijnen
ZOEK_NIEUW_ELKE = 7            # in die periode wordt elke week gekeken of het nieuwe verslag er is


def _hergebruik(oud, vandaag):
    """Volledig bevestigde jaarcijfers (10 jaar, onafhankelijk nagerekend) worden niet opnieuw opgehaald zolang er nog geen
    nieuw jaarverslag kan zijn (opslaan en afblijven). Kan er wel een nieuw verslag zijn, dan wordt elke week gekeken;
    en hoe dan ook na 90 dagen, voor het geval een verslag gecorrigeerd is."""
    try:
        if not oud or oud.get('fout') or oud.get('uit_vorige_run') or oud.get('eps_status') != 'independently_verified':
            return False
        if (oud.get('eps_verified_years') or 0) < 10 or not oud.get('jaren') or oud.get('niveau') == 'jaarverslag':
            return False
        if oud.get('extra_versie') != EXTRA_VERSIE:
            return False                # kentallen zijn met oudere rekenregels gemaakt: één keer opnieuw
        nu = date.fromisoformat(vandaag)
        leeftijd = (nu - date.fromisoformat(oud['gecontroleerd_op'])).days
        if not 0 <= leeftijd < HERGEBRUIK_DAGEN:
            return False
        laatste_einde = max(date.fromisoformat(j['end']) for j in oud['jaren'] if j.get('end'))
        if (nu - laatste_einde).days >= NIEUW_VERSLAG_NA:
            return leeftijd < ZOEK_NIEUW_ELKE
        return True
    except (ValueError, TypeError, KeyError):
        return False


def vorige_gegevens(pad):
    """Gegevensblokken uit de vorige echte run (alleen als dat bestand uit een live-run komt)."""
    try:
        d = json.loads(Path(pad).read_text(encoding='utf-8'))
        if not str(d.get('bron', '')).startswith('SEC companyfacts'):
            return {}
        return {a['ticker']: a['gegevens'] for a in d['aandelen'] if a.get('gegevens')}
    except Exception:
        return {}


def _pauze():
    import time
    time.sleep(0.4)             # vriendelijk voor Yahoo bij ruim 300 aandelen


def pence_naar_pond(reeks):
    """Koersen uit Londen (pence, GBX) naar ponden: een vaste eenheid (100 pence = 1 pond), geen wisselkoers."""
    return [(d, v / 100) for d, v in reeks]


def dividend_naar_pond(dividenden, punten_pond):
    """Dividenden van Londense aandelen staan bij Yahoo meestal in pence, soms al in ponden. Per uitkering: is het bedrag
    meer dan 15% van de koers in ponden op die dag, dan zijn het pence (geen dividend is 15% van de koers per keer);
    anders al ponden. Zonder koers op of vóór die dag: weglaten (nooit gokken)."""
    uit = []
    koersen = sorted(punten_pond)
    for d, v in dividenden:
        eerder = [p for dd, p in koersen if dd <= d]
        if not eerder or not eerder[-1] > 0:
            continue
        uit.append((d, v / 100 if v / eerder[-1] > 0.15 else v))
    return uit


def valuta_klopt(meta, valuta_ophalen):
    """Controleert dat Yahoo de koers in de verwachte valuta geeft (Londen noteert in pence). Onbekend is alleen
    toegestaan voor noteringen die niet in pence zijn; een verschil geeft geen koers, nooit een omrekening."""
    try:
        v = valuta_ophalen(meta[0])
    except Exception:
        v = None
    if v == 'GBp':
        v = 'GBX'
    if v is None:
        return meta[3] != 'GBX'
    return str(v).upper() == meta[3]


ADVIEZEN = ('strong_buy', 'buy', 'hold', 'underperform', 'sell', 'strong_sell')


def analisten_uit_info(info, vandaag, pence=False):
    """Analistenadvies uit Yahoo's bedrijfsinfo: alleen ter informatie in de app, telt nooit mee in het oordeel.
    Geeft None als er geen advies of geen analisten zijn. Koersdoel van Londen (pence) in ponden, zoals de koers."""
    if not isinstance(info, dict):
        return None
    n, gem, adv = info.get('numberOfAnalystOpinions'), info.get('recommendationMean'), info.get('recommendationKey')
    if not isinstance(n, (int, float)) or n < 1 or adv not in ADVIEZEN:
        return None
    doel = info.get('targetMeanPrice')
    doel = float(doel) if isinstance(doel, (int, float)) and doel > 0 else None
    valuta = info.get('currency')
    if doel is not None and (pence or valuta in ('GBp', 'GBX')):
        doel, valuta = doel / 100, 'GBP'
    return {'advies': adv, 'gemiddeld': round(float(gem), 2) if isinstance(gem, (int, float)) and 1 <= gem <= 5 else None,
            'aantal': int(n), 'koersdoel': round(doel, 2) if doel else None, 'valuta': valuta if isinstance(valuta, str) else None,
            'datum': vandaag, 'bron': 'Yahoo Finance'}


def _yahoo_analisten(ticker):
    import yfinance as yf
    try:
        return yf.Ticker(ticker).get_info()
    except Exception:
        return None


def _yahoo_valuta(ticker):
    import yfinance as yf
    try:
        return yf.Ticker(ticker).fast_info.get('currency')
    except Exception:
        return None


def _yahoo_historie(ticker):
    """(dagkoersen, dividenden) van de afgelopen ~12 jaar; koersen splitsingscorrect maar niet dividendgecorrigeerd."""
    import yfinance as yf
    h = yf.Ticker(ticker).history(period='12y', interval='1d', auto_adjust=False, actions=True)
    punten = [(idx.date().isoformat(), float(v)) for idx, v in h['Close'].dropna().items()]
    dividenden = [(idx.date().isoformat(), float(v)) for idx, v in h['Dividends'].items() if v and v > 0] if 'Dividends' in h else []
    return punten, dividenden


def _yahoo_reeks(ticker):
    import yfinance as yf
    data = yf.download(ticker, period='2y', interval='1d', auto_adjust=True, progress=False, threads=False, timeout=20)
    if hasattr(data.columns, 'get_level_values'):
        data.columns = data.columns.get_level_values(0)
    return [(idx.date().isoformat(), float(v)) for idx, v in data['Close'].dropna().items()]


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    groep = p.add_mutually_exclusive_group(required=True)
    groep.add_argument('--demo', metavar='RESULTAAT.json')
    groep.add_argument('--live', action='store_true')
    p.add_argument('--email')
    p.add_argument('--uit', default=str(UITVOER))
    args = p.parse_args(argv)
    if args.live:
        if not args.email:
            p.error('--live vraagt --email (contactadres voor de SEC)')
        bestand = live(args.email, vorige=vorige_gegevens(Path(args.uit) / 'aandelen.json'))
    else:
        bestand = demo(args.demo)
    schrijf(bestand, args.uit)
    print('Geschreven:', args.uit, '-', len(bestand['aandelen']), 'aandelen')


if __name__ == '__main__':
    main()
