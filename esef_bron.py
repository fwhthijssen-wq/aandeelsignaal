"""ESEF-jaarverslagen (filings.xbrl.org, xBRL-JSON) omgezet naar de vorm van een SEC-companyfacts-bestand.

Zo gebruikt een bedrijf zonder SEC-notering exact dezelfde, strenge verificatie als een SEC-bedrijf: de herberekening van de
EPS uit winst en aandelen van DEZELFDE indiening, splitsbewijs uit opeenvolgende indieningen, enzovoort. Niets wordt aangevuld
of geschat; feiten met extra dimensies (segmenten, componenten) worden niet overgenomen.
"""
import json
from datetime import date, timedelta

BASE = 'https://filings.xbrl.org'
FORM = '20-F'             # de verificatie accepteert jaarverslagen alleen onder deze vormen; ESEF-jaarverslagen zijn dat
NEGEER_DIM = ('concept', 'entity', 'period', 'unit', 'language')


def _dag(s):
    return date.fromisoformat(s[:10])


def _eenheid(u):
    if not u:
        return None
    u = u.replace('iso4217:', '').replace('xbrli:', '')
    return u if u in ('shares',) or '/' in u or (len(u) == 3 and u.isalpha()) else None


def omzetten(doc, filing, uit=None):
    """Voegt de feiten van één rapport (xBRL-JSON) toe aan `uit` (companyfacts-vorm). Alleen ifrs-full en us-gaap, zonder dimensies."""
    uit = uit if uit is not None else {'facts': {}}
    accn = filing['fxo_id']
    filed = (filing.get('date_added') or '')[:10]
    gezien = set()
    for fact in (doc.get('facts') or {}).values():
        dims = fact.get('dimensions') or {}
        if any(k not in NEGEER_DIM for k in dims):
            continue
        concept = dims.get('concept') or ''
        ns, _, naam = concept.partition(':')
        if ns not in ('ifrs-full', 'us-gaap') or not naam:
            continue
        unit = _eenheid(dims.get('unit'))
        if unit is None:
            continue
        try:
            val = float(fact['value'])
        except (TypeError, ValueError, KeyError):
            continue
        per = dims.get('period') or ''
        try:
            if '/' in per:
                a, b = per.split('/')
                start, end = _dag(a), _dag(b) - timedelta(days=1)
            else:
                start, end = None, _dag(per) - timedelta(days=1)
        except ValueError:
            continue
        rij = {'end': end.isoformat(), 'val': val, 'accn': accn, 'fy': end.year, 'fp': 'FY', 'form': FORM, 'filed': filed}
        if start is not None:
            rij['start'] = start.isoformat()
        sleutel = (concept, unit, rij.get('start'), rij['end'], val)
        if sleutel in gezien:
            continue
        gezien.add(sleutel)
        uit['facts'].setdefault(ns, {}).setdefault(naam, {'units': {}})['units'].setdefault(unit, []).append(rij)
    return uit


def rapporten(lei, ophalen_json):
    """Alle ESEF-rapporten van een LEI, nieuwste eerst: [{fxo_id, period_end, date_added, json_url, ...}]."""
    d = ophalen_json(f'{BASE}/api/entities/{lei}/filings')
    uit = []
    for f in d.get('data') or []:
        a = f.get('attributes') or {}
        if a.get('json_url') and a.get('period_end') and a.get('fxo_id'):
            uit.append({k: a.get(k) for k in ('fxo_id', 'period_end', 'date_added', 'json_url', 'country', 'error_count')})
    return sorted(uit, key=lambda r: r['period_end'], reverse=True)


def companyfacts(lei, naam, ophalen_json, min_einde='2017-12-31'):
    """Bouwt het companyfacts-achtige bestand uit alle rapporten sinds `min_einde`. Een rapport dat niet te lezen is wordt
    overgeslagen en genoteerd; de rest blijft geldig."""
    uit = {'entityName': naam, 'lei': lei, 'facts': {}, 'rapporten': [], 'overgeslagen': []}
    for r in rapporten(lei, ophalen_json):
        if r['period_end'] < min_einde:
            continue
        try:
            omzetten(ophalen_json(BASE + r['json_url']), r, uit)
            uit['rapporten'].append({k: r[k] for k in ('fxo_id', 'period_end', 'date_added')})
        except Exception as exc:
            uit['overgeslagen'].append({'fxo_id': r['fxo_id'], 'reden': f'{type(exc).__name__}: {exc}'[:150]})
    return uit


def sec_vorm_fetcher(cf):
    """Fetcher voor source_engine.sec_snapshot (url, email): geeft een ticker-lijst en `cf` terug alsof het de SEC was.
    De 'ticker' is de LEI zelf, zodat geen enkele Europese notering stilzwijgend voor een Amerikaanse wordt aangezien."""
    import source_engine
    lei = cf['lei']

    def fetch(url, email=None):
        if url == source_engine.CIK_MAP_URL:
            return {'0': {'ticker': lei, 'cik_str': 1, 'title': cf.get('entityName') or lei}}
        if url == source_engine.FACTS_URL.format(cik=1):
            return cf
        raise ValueError('onverwachte url')
    return fetch


def samenvatting(cf, asof=None):
    """summarize_sec-uitkomst (zelfde als bij SEC-bedrijven) voor dit ESEF-bestand."""
    from praktijkcontrole_sec_esef import summarize_sec
    from source_engine import sec_snapshot
    fetch = sec_vorm_fetcher(cf)
    return summarize_sec(cf['lei'], 'esef@localhost.invalid', asof=asof,
                         fetcher=lambda t, a, e: sec_snapshot(t, a, e, fetcher=fetch))


JAARVERSLAG_MIN_JAREN = 5


def eps_keten(cf, min_jaren=JAARVERSLAG_MIN_JAREN, tolerantie=0.005):
    """Verwaterde EPS per boekjaar uit de officiële ESEF-jaarverslagen, alleen waar de jaren onderling vergelijkbaar zijn.

    Elk rapport bevat drie jaren. Beginnend bij het nieuwste rapport wordt een ouder rapport pas toegevoegd als het de jaren
    die het deelt met het al gekozen deel precies dezelfde EPS geeft; bij een verschil (herziening, splitsing) stopt de keten
    en blijven oudere jaren buiten beeld. Zo bestaat er geen EPS-groei over een niet-herkende splitsing. {} bij minder dan
    `min_jaren` jaren. Dit is gerapporteerd, niet nagerekend."""
    ifrs = (cf.get('facts') or {}).get('ifrs-full') or {}
    per_rapport = {}
    # per rapport: verwaterd, anders 'gewoon en verwaterd', anders gewoon (zelfde volgorde als het dossier)
    alle = []
    for rang, tag in enumerate(('DilutedEarningsLossPerShare', 'BasicAndDilutedEarningsLossPerShare', 'BasicEarningsLossPerShare')):
        for unit, lijst in ((ifrs.get(tag) or {}).get('units') or {}).items():
            alle.extend((rang, unit, r) for r in lijst)
    beste = {}
    for rang, unit, r in alle:
        beste[r.get('accn')] = min(beste.get(r.get('accn'), rang), rang)
    for rang, unit, r in alle:
        if rang != beste.get(r.get('accn')):
            continue
        try:
            dagen = (date.fromisoformat(r['end']) - date.fromisoformat(r['start'])).days + 1
        except (KeyError, ValueError):
            continue
        if 330 <= dagen <= 390:
            per_rapport.setdefault(r['accn'], {}).setdefault(r['end'], set()).add((unit, r['val']))
    eind = {r['fxo_id']: r['period_end'] for r in cf.get('rapporten') or []}
    keten, valuta = {}, None
    for accn in sorted(per_rapport, key=lambda a: eind.get(a, ''), reverse=True):
        jaren = per_rapport[accn]
        if any(len(v) != 1 for v in jaren.values()):
            break
        huidig = {e: next(iter(v)) for e, v in jaren.items()}
        if keten:
            gedeeld = [e for e in huidig if e in keten]
            if not gedeeld or any(huidig[e][0] != keten[e][0] or abs(huidig[e][1] - keten[e][1]) > tolerantie for e in gedeeld):
                break
        for e, v in huidig.items():
            keten.setdefault(e, v)
    uit = {e: v[1] for e, v in sorted(keten.items())}
    return uit if len(uit) >= min_jaren else {}


def corrigeer_eenheden(cf):
    """Herstelt een duidelijke tagfout: per-aandeelbedragen in een valuta die nergens anders in hetzelfde rapport voorkomt,
    terwijl alle bedragen van dat rapport één valuta hebben (Wolters Kluwer 2025: winst per aandeel als 'AED/shares' bij
    verder alleen euro's). Alleen dan wordt de eenheid de valuta van het rapport. Geeft (cf, lijst correcties)."""
    from copy import deepcopy
    feiten = cf.get('facts') or {}
    valuta_per_rapport = {}
    for ns in feiten.values():
        for blok in ns.values():
            for unit, rijen in (blok.get('units') or {}).items():
                if len(unit) == 3 and unit.isalpha():
                    for r in rijen:
                        valuta_per_rapport.setdefault(r.get('accn'), set()).add(unit)
    te_herstellen = []
    for nsnaam, ns in feiten.items():
        for naam, blok in ns.items():
            for unit, rijen in (blok.get('units') or {}).items():
                if not unit.endswith('/shares'):
                    continue
                cur = unit.split('/')[0]
                for i, r in enumerate(rijen):
                    v = valuta_per_rapport.get(r.get('accn')) or set()
                    if len(v) == 1 and cur not in v:
                        te_herstellen.append((nsnaam, naam, unit, i, next(iter(v)) + '/shares'))
    if not te_herstellen:
        return cf, []
    uit = deepcopy(cf)
    correcties = []
    for nsnaam, naam, unit, i, nieuw in sorted(te_herstellen, key=lambda x: -x[3]):
        rij = uit['facts'][nsnaam][naam]['units'][unit].pop(i)
        uit['facts'][nsnaam][naam]['units'].setdefault(nieuw, []).append(rij)
        correcties.append(f'{naam} {rij.get("end")}: {unit} -> {nieuw} ({rij.get("accn")})')
    for nsnaam, ns in uit['facts'].items():
        for blok in ns.values():
            for unit in [u for u, rijen in blok.get('units', {}).items() if not rijen]:
                del blok['units'][unit]
    return uit, correcties


EPS_BEGRIPPEN = ('DilutedEarningsLossPerShare', 'BasicEarningsLossPerShare', 'BasicAndDilutedEarningsLossPerShare',
                 'DilutedEarningsLossPerShareFromContinuingOperations', 'BasicEarningsLossPerShareFromContinuingOperations')


def corrigeer_eps_schaal(cf):
    """Herstelt schaalfouten in getagde winst per aandeel (Randstad 2020: 1.610.000 in plaats van 1,61; AkzoNobel 2021:
    0,0446 in plaats van 4,46). Alleen als de getagde waarde NIET past bij winst / aantal aandelen uit hetzelfde rapport,
    en precies één macht van tien (10^-6 .. 10^6) dat wel op de cent doet. Zonder winst en aandelen in dat rapport: niets.
    Geeft (cf, lijst correcties)."""
    from copy import deepcopy
    from eps_verification import sec_eps_recompute_inputs
    try:
        inputs = sec_eps_recompute_inputs(cf, '9999-12-31')
    except Exception:
        return cf, []
    per = {}
    for r in inputs:
        per.setdefault((r['accn'], r['end']), []).append(r)
    def past(eps, rij):
        sh = rij['diluted_shares']
        tellers = [rij['net_income']] + [a['net_income'] for a in rij.get('andere_tellers') or []]
        return sh > 0 and any(abs(ni / sh - eps) <= 0.0055 + 0.004 * abs(eps) for ni in tellers)
    te_doen = []
    ifrs = (cf.get('facts') or {}).get('ifrs-full') or {}
    for naam in EPS_BEGRIPPEN:
        for unit, rijen in ((ifrs.get(naam) or {}).get('units') or {}).items():
            for i, r in enumerate(rijen):
                kand = per.get((r.get('accn'), r.get('end')))
                v = r.get('val')
                if not kand or not isinstance(v, (int, float)) or v == 0 or any(past(v, k) for k in kand):
                    continue
                factoren = [f for f in (10.0 ** p for p in range(-6, 7) if p) if any(past(v * f, k) for k in kand)]
                if len(factoren) == 1:
                    te_doen.append((naam, unit, i, factoren[0]))
    if not te_doen:
        return cf, []
    uit = deepcopy(cf)
    correcties = []
    for naam, unit, i, f in te_doen:
        r = uit['facts']['ifrs-full'][naam]['units'][unit][i]
        oud = r['val']; r['val'] = round(oud * f, 6); r['schaal_gecorrigeerd'] = f
        correcties.append(f'{naam} {r.get("end")}: {oud} -> {r["val"]} (x{f:g}, past bij winst / aandelen in {r.get("accn")})')
    return uit, correcties
