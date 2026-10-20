"""Generieke onafhankelijke toets van voorlopige EPS-normalisatie.

Een splitfactor is geen bewijs dat historische EPS daadwerkelijk vergelijkbaar is.
Een herberekende EPS uit een later SEC-rapport kan dat wel onderbouwen,
maar uitsluitend als de bronperiode, indieningsdatum en eenheid kloppen.
"""
from datetime import date
from math import isfinite


def reconcile_eps(normalized, restated, *, asof=None, tolerance=0.015):
    """Vergelijk voorlopige EPS met expliciete, later ingediende EPS-bronnen.

    restated: lijst dicts met end, val, filed, unit='USD/shares' (of andere
    expliciete per-share-eenheid), en source. Duplicaten/conflicten blokkeren.
    Dit is een controleverslag; het verleent geen waarderingsgoedkeuring.
    """
    if not isinstance(tolerance, (int, float)) or isinstance(tolerance, bool) or not isfinite(tolerance) or tolerance < 0:
        raise ValueError("tolerance moet een eindig, niet-negatief getal zijn")
    cutoff = date.fromisoformat(asof) if asof else date.today()
    by_end = {}
    for row in restated:
        by_end.setdefault(row.get('end'), []).append(row)
    results = {}
    for end, original in normalized.items():
        predicted = original.get('EPS vergelijkbaar')
        outcome = {'status': 'niet_bewezen', 'verwacht': predicted, 'bronnen': 0,
                   'waardering_goedgekeurd': False}
        results[end] = outcome
        if (not isinstance(predicted, (int, float)) or isinstance(predicted, bool)
                or not isfinite(predicted)):
            outcome['reden'] = 'Geen bruikbare voorlopige EPS'
            continue
        valid = []
        units = set()
        expected_unit = original.get('unit') or original.get('Eenheid')
        expected_currency = original.get('currency') or original.get('Valuta')
        invalid = False
        original_filed = original.get('EPS bron ingediend')
        for row in by_end.get(end, []):
            try:
                period = date.fromisoformat(row['end'])
                filed = date.fromisoformat(row['filed'])
                val = row['val']
                # Een bron op of vóór de oorspronkelijke indiening is geen
                # onafhankelijk later bewijs van een herberekende EPS.
                if original_filed is not None and filed <= date.fromisoformat(original_filed):
                    invalid = True
                    continue
                if not (period <= filed <= cutoff and row.get('source')
                        and isinstance(val, (int, float)) and not isinstance(val, bool)
                        and isfinite(val) and isinstance(row.get('unit'), str)
                        and row['unit'].endswith('/shares')):
                    invalid = True
                    continue
                valid.append(float(val))
                units.add(row["unit"])
            except (KeyError, ValueError, TypeError):
                invalid = True
        outcome['bronnen'] = len(valid)
        if (expected_unit and units and units != {expected_unit}) or (expected_currency and units and any(u.split('/')[0] != expected_currency for u in units)):
            outcome['status'] = 'bronconflict'
            outcome['reden'] = 'EPS-bron komt niet overeen met de valuta of eenheid van de jaarhistorie'
        elif len(units) > 1:
            outcome["status"] = "bronconflict"
            outcome["reden"] = "EPS-bronnen hebben verschillende valuta of eenheden"
        elif invalid:
            outcome['status'] = 'bronconflict'
            outcome['reden'] = 'Ongeldige of oncontroleerbare EPS-bron'
        elif not valid:
            outcome['reden'] = 'Geen onafhankelijke herberekende EPS-bron'
        elif max(valid) - min(valid) > tolerance:
            outcome['status'] = 'bronconflict'
            outcome['reden'] = 'Herberekende bronnen spreken elkaar tegen'
        elif abs(predicted - valid[0]) > tolerance:
            outcome['status'] = 'afwijking'
            outcome['reden'] = 'Voorlopige EPS wijkt af van herberekende bron'
        else:
            outcome['status'] = 'onderbouwd'
            outcome['reden'] = 'Voorlopige EPS komt overeen met herberekende bron'
    return results
