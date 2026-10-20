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


def heeft_sec(ticker):
    """Alleen Amerikaanse noteringen (zonder punt) en expliciet gekoppelde Europese bedrijven hebben een SEC-jaarverslag."""
    from naic_fetch import SEC_LISTING_MAP
    return '.' not in ticker or ticker.upper() in SEC_LISTING_MAP


ESEF_LEI = HERE / 'esef_lei.json'
ESEF_BUNDEL = HERE / 'esef_bundel.json.gz'
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
        return _ESEF_CACHE[ESEF_BUNDEL].get(lei)
    except (OSError, ValueError):
        return None


def gegevens_uit_esef(cf, gecontroleerd_op):
    """Zelfde verificatie als bij SEC-bedrijven, op de ESEF-feiten; `bron` laat zien waar de cijfers vandaan komen."""
    from esef_bron import samenvatting
    from esef_bron import eps_keten
    g = gegevens_uit_sec(samenvatting(cf, asof=gecontroleerd_op), gecontroleerd_op)
    g['bron'] = 'ESEF'
    if g.get('eps_status') != 'independently_verified' and g.get('jaren'):
        # Niet nagerekend (vaak ontbreekt het aantal aandelen in machineleesbare vorm). Het label-slot blijft dicht; maar de
        # cijfers uit het officiële jaarverslag zijn er wel, mits de EPS over de jaren onderling vergelijkbaar is.
        keten = eps_keten(cf)
        if keten:
            for j in g['jaren']:
                if j.get('end') in keten:
                    j['comparable_eps'] = keten[j['end']]
            jaren = [j for j in g['jaren'] if j.get('end') in keten]
            if len(jaren) >= 5:
                g['jaren'] = jaren
                g['niveau'] = 'jaarverslag'
    return g


JAAR_VELDEN = ('year', 'end', 'currency', 'sales', 'net_income', 'reported_eps', 'comparable_eps',
               'operating_cash_flow', 'capex', 'equity', 'eps_check', 'eps_reden')


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
        return {'sec_ticker': sec_ticker, 'concepten': eps_tag_overzicht(payload), 'jaarwaarden': jaarwaarden(payload)}
    except Exception as exc:  # diagnose mag de run nooit laten mislukken
        return {'fout': f'{type(exc).__name__}: {exc}'[:200]}


EXTRA_VELDEN = ('pretax_income', 'depreciation', 'dividends_paid', 'long_term_debt')
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
    for j in jaren:
        rij = extra.get(j.get('end')) or {}
        for veld in EXTRA_VELDEN:
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
            'indices': INDICES.get(ticker), 'koers': koers, 'gegevens': gegevens}


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
                    'extra_dekking': {v: sum(1 for j in g.get('jaren') or [] if j.get(v) is not None) for v in EXTRA_VELDEN + KOERS_VELDEN},
                    'toelichting': g.get('eps_toelichting'),
                    'waarschuwingen': g.get('waarschuwingen'), 'diagnose': g.get('diagnose'),
                    'extra_diagnose': g.get('extra_diagnose')})
    return {'gemaakt': bestand.get('gemaakt'), 'aandelen': uit}


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
         valuta_ophalen=None, pauze=None, esef_ophalen=None):
    from naic_fetch import sec_ticker_for_listing
    if sec_samenvatting is None:
        from praktijkcontrole_sec_esef import summarize_sec as sec_samenvatting
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
    for meta in CATALOGUS:
        ticker = meta[0]
        if heeft_sec(ticker):
            try:
                gegevens = gegevens_uit_sec(sec_samenvatting(sec_ticker_for_listing(ticker), email), vandaag)
            except Exception as exc:  # nooit stilzwijgend een gat: de reden gaat mee
                gegevens = gegevens_uit_sec({'status': 'error', 'message': f'{type(exc).__name__}: {exc}'}, vandaag)
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
        if gegevens.get('jaren'):
            try:
                extra_payload = esef_cf if esef_cf else payload_ophalen(sec_ticker_for_listing(ticker), email)
                voeg_extra_toe(gegevens, extra_payload)
                if any(not sum(1 for j in gegevens['jaren'] if j.get(v) is not None) for v in EXTRA_VELDEN):
                    gegevens['extra_diagnose'] = extra_namen(extra_payload)
            except Exception:
                pass            # extra cijfers ontbreken dan; de rest van de run blijft geldig
        if heeft_sec(ticker) and not esef_cf and (gegevens.get('eps_verified_years') or 0) < 10:
            gegevens['diagnose'] = diagnose(sec_ticker_for_listing(ticker), email)
        koers, punten, dividenden = None, [], []
        if valuta_klopt(meta, valuta_ophalen):
            try:
                koers = koers_uit_reeks(fetch_prijzen(ticker))
            except Exception:
                koers = None
            try:
                punten, dividenden = historie_ophalen(ticker)
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
        pauze()
        records.append(maak_record(meta, koers=koers, gegevens=gegevens))
    return maak_bestand(records, bron='SEC companyfacts, ESEF-jaarverslagen en Yahoo Finance (dagkoersen)')


def _pauze():
    import time
    time.sleep(0.4)             # vriendelijk voor Yahoo bij ruim 300 aandelen


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
        bestand = live(args.email)
    else:
        bestand = demo(args.demo)
    schrijf(bestand, args.uit)
    print('Geschreven:', args.uit, '-', len(bestand['aandelen']), 'aandelen')


if __name__ == '__main__':
    main()
