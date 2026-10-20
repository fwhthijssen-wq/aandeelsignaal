"""Extra jaarcijfers voor de NAIC-gids uit het SEC-companyfacts-bestand: winst vóór belasting, afschrijvingen,
uitgekeerd dividend (totaal, niet per aandeel: dat verandert bij een aandelensplitsing) en langlopende schuld.

Alleen jaarverslagen (10-K/20-F/40-F), alleen de valuta van het boekjaar, en alleen een waarde die bij precies dat
boekjaareinde hoort. Bij twee verschillende waarden voor hetzelfde jaar in dezelfde indiening-rang: niets (geen gok).
Ontbreekt iets, dan is het veld None: de app toont dan 'onbekend' en rekent er niet mee."""
from datetime import date

ANNUAL = ('10-K', '20-F', '40-F')
STROOM = {
    'pretax_income': ('IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
                      'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments',
                      'ProfitLossBeforeTax'),
    'depreciation': ('DepreciationDepletionAndAmortization', 'DepreciationAndAmortization',
                     'DepreciationAmortisationAndImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss',
                     'AdjustmentsForDepreciationAndAmortisationExpenseAndImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss'),
    'dividends_paid': ('PaymentsOfDividendsCommonStock', 'PaymentsOfDividends', 'DividendsPaidClassifiedAsFinancingActivities'),
}
BALANS = {
    'long_term_debt': ('LongTermDebtNoncurrent', 'LongTermDebt', 'Borrowings', 'NoncurrentPortionOfNoncurrentBorrowings'),
}


def _dagen(r):
    try:
        return (date.fromisoformat(r['end']) - date.fromisoformat(r['start'])).days
    except (KeyError, TypeError, ValueError):
        return None


def _kies(payload, tags, eind, valuta, stroom):
    """Eerste tag (in volgorde van voorkeur) met een eenduidige waarde voor dit boekjaareinde."""
    facts = payload.get('facts') if isinstance(payload, dict) else None
    if not isinstance(facts, dict):
        return None
    for tag in tags:
        waarden = {}
        for ns in ('us-gaap', 'ifrs-full'):
            blok = (facts.get(ns) or {}).get(tag)
            rijen = ((blok or {}).get('units') or {}).get(valuta) if isinstance(blok, dict) else None
            for r in rijen or []:
                if not isinstance(r, dict) or r.get('end') != eind or r.get('form') not in ANNUAL or not r.get('accn'):
                    continue
                v = r.get('val')
                if not isinstance(v, (int, float)) or isinstance(v, bool) or v != v:
                    continue
                if stroom:
                    d = _dagen(r)
                    if d is None or not 330 <= d <= 390:
                        continue
                elif r.get('start'):
                    continue
                waarden.setdefault(r.get('filed') or '', set()).add(v)
        if waarden:
            laatste = waarden[max(waarden)]
            if len(laatste) == 1:           # twee verschillende waarden in de nieuwste indiening: geen gok
                return next(iter(laatste))
    return None


def extra_jaarcijfers(payload, jaren):
    """jaren: lijst dicts met 'end' en 'currency'. Geeft {end: {veld: waarde of None}}."""
    uit = {}
    for j in jaren or []:
        eind, valuta = j.get('end'), j.get('currency')
        if not isinstance(eind, str) or not isinstance(valuta, str):
            continue
        rij = {veld: _kies(payload, tags, eind, valuta, True) for veld, tags in STROOM.items()}
        rij.update({veld: _kies(payload, tags, eind, valuta, False) for veld, tags in BALANS.items()})
        # Dividend is een uitgave: positief getal. Een negatieve waarde duidt op een andere betekenis: niet gebruiken.
        if rij['dividends_paid'] is not None and rij['dividends_paid'] < 0:
            rij['dividends_paid'] = None
        if rij['depreciation'] is not None and rij['depreciation'] < 0:
            rij['depreciation'] = None
        if rij['long_term_debt'] is not None and rij['long_term_debt'] < 0:
            rij['long_term_debt'] = None
        uit[eind] = rij
    return uit
