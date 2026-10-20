"""Herbruikbare brongegevens: zichtbaar naast SEC, nooit stilzwijgend goedgekeurd."""
from source_registry import load_registry

ISSUER_FOR_LISTING = {'ASML.AS': 'ASML', 'INGA.AS': 'ING', 'SAP.DE': 'SAP'}


def registry_evidence_for_history(ticker, history, registry=None):
    """Geef geregistreerde feiten terug die ontbreken in de SEC-jaarhistorie."""
    issuer = ISSUER_FOR_LISTING.get((ticker or '').upper(), (ticker or '').upper())
    records = load_registry() if registry is None else registry
    present = set()
    for h in history:
        try:
            year = int(str(h['end'])[:4])
        except (KeyError, ValueError, TypeError):
            continue
        for concept, fact in h.get('facts', {}).items():
            if isinstance(fact, dict) and isinstance(fact.get('val'), (float, int)):
                present.add((year, concept))
    result = []
    for record in records:
        if record['ticker'].upper() != issuer:
            continue
        year, concept = int(record['year']), record['concept']
        if (year, concept) in present:
            continue
        result.append({'Boekjaar': year, 'Begrip': concept, 'Bedrag': record['value'],
                       'Valuta': record['unit'], 'Bron': record['source'],
                       'Status bronbewijs': record['evidence_status'],
                       'Goedgekeurd voor analyse': bool(record.get('analysis_approved', False))})
    return sorted(result, key=lambda r: (r['Boekjaar'], r['Begrip']))


def history_with_approved_evidence(history, registry_rows):
    """Vul alleen expliciet goedgekeurde, valuta-gelijke ontbrekende feiten aan.

    Originele SEC-historie wordt niet gewijzigd; niet-goedgekeurde feiten blijven
    uitsluitend bronbewijs. Nooit nieuwe boekjaren uit losse bronregels maken.
    """
    import copy
    enriched = copy.deepcopy(history)
    by_year = {int(h['end'][:4]): h for h in enriched if h.get('end') and h.get('unit')}
    for record in registry_rows:
        if not record['Goedgekeurd voor analyse']:
            continue
        h = by_year.get(record['Boekjaar'])
        if h is None or h['unit'] != record['Valuta']:
            continue
        facts = h.setdefault('facts', {})
        if record['Begrip'] in facts:
            continue
        facts[record['Begrip']] = {'val': record['Bedrag'], 'unit': record['Valuta'],
                                   'tag': 'BRONREGISTER_GOEDGEKEURD', 'filed': '',
                                   'source': record['Bron']}
    return enriched
