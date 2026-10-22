"""Aanvulling uit officiële jaarverslagen die niet machineleesbaar beschikbaar zijn (zie jaarverslag_bronnen.json).

Per document zijn de getallen één keer uitgelezen en vastgelegd met bron, pagina en oorspronkelijke tekst. Ze worden als
feiten in het companyfacts-achtige ESEF-bestand gezet, met het kenmerk van het eigen document (pdf) of van het ESEF-rapport
waar ze als tekst in staan. Zo draait de bestaande controle er ongewijzigd op. Regels:
  - alleen aanvullen: bestaat het feit al (zelfde begrip, periode en document), dan blijft het officiële getagde feit staan;
  - een vastgelegd getal dat afwijkt van een al getagd feit in hetzelfde document maakt het hele document ongeldig;
  - de herberekening (winst / aandelen = gemelde winst per aandeel) beslist daarna of een jaar bevestigd is.
"""
import json
from copy import deepcopy
from pathlib import Path

REGISTER = Path(__file__).resolve().parent / 'jaarverslag_bronnen.json'


def laad(pad=REGISTER):
    try:
        return json.loads(Path(pad).read_text(encoding='utf-8')).get('bedrijven') or {}
    except (OSError, ValueError):
        return {}


def aanvullen(cf, ticker, register=None):
    """Kopie van `cf` met de vastgelegde feiten erbij, plus een verslag {'documenten', 'toegevoegd', 'afgewezen'}."""
    register = laad() if register is None else register
    bedrijf = register.get(str(ticker).upper())
    if not bedrijf or not isinstance(cf, dict):
        return cf, None
    uit = deepcopy(cf)
    facts = uit.setdefault('facts', {})
    verslag = {'documenten': 0, 'toegevoegd': 0, 'afgewezen': []}
    for doc in bedrijf.get('documenten') or []:
        accn, filed = doc.get('kenmerk'), doc.get('ingediend')
        if not accn or not filed:
            verslag['afgewezen'].append({'document': doc.get('document'), 'reden': 'kenmerk of datum ontbreekt'})
            continue
        nieuw, conflict = [], None
        for f in doc.get('feiten') or []:
            ns, _, naam = str(f.get('concept', '')).partition(':')
            if not naam or not isinstance(f.get('waarde'), (int, float)) or not f.get('eind') or not f.get('eenheid'):
                conflict = f'onvolledig feit {f.get("concept")}'
                break
            rijen = facts.setdefault(ns, {}).setdefault(naam, {'units': {}})['units'].setdefault(f['eenheid'], [])
            bestaand = [r for r in rijen if r.get('accn') == accn and r.get('end') == f['eind'] and r.get('start') == f.get('start')]
            if bestaand:
                if any(abs(r.get('val', 0) - f['waarde']) > 1e-9 * max(1, abs(f['waarde'])) for r in bestaand):
                    conflict = f'{f["concept"]} {f["eind"]}: vastgelegd {f["waarde"]} wijkt af van getagd {bestaand[0].get("val")}'
                    break
                continue                                    # officieel getagd feit gaat voor
            rij = {'end': f['eind'], 'val': f['waarde'], 'accn': accn, 'fy': int(f['eind'][:4]), 'fp': 'FY', 'form': '20-F',
                   'filed': filed, 'bron': 'jaarverslag_bronnen'}
            if f.get('start'):
                rij['start'] = f['start']
            nieuw.append((rijen, rij))
        if conflict:
            verslag['afgewezen'].append({'document': doc.get('document'), 'reden': conflict})
            continue
        for rijen, rij in nieuw:
            rijen.append(rij)
        verslag['documenten'] += 1
        verslag['toegevoegd'] += len(nieuw)
        if doc.get('soort') == 'pdf':
            einden = [f['eind'] for f in doc.get('feiten') or []]
            uit.setdefault('rapporten', []).append({'fxo_id': accn, 'period_end': max(einden), 'date_added': filed,
                                                   'bron': doc.get('url')})
    return uit, verslag
