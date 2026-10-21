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
                     'AdjustmentsForDepreciationAndAmortisationExpenseAndImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss',
                     'DepreciationAmortizationAndOther', 'DepreciationAmortizationAndAccretionNet',
                     'AdjustmentsForDepreciationAndAmortisationExpense', 'DepreciationAndAmortisationExpense'),
    'dividends_paid': ('PaymentsOfDividendsCommonStock', 'PaymentsOfDividends', 'DividendsPaidClassifiedAsFinancingActivities',
                       'DividendsPaidToOwnersOfParentClassifiedAsFinancingActivities', 'DividendsPaidToEquityHoldersOfParentClassifiedAsFinancingActivities', 'PaymentsOfOrdinaryDividends', 'DividendsPaid'),
}
STROOM.update({
    # Voor de scoremodellen (Piotroski, Altman Z, Magic Formula). Per jaar, alleen als het bedrijf het zelf meldt.
    'gross_profit': ('GrossProfit',),
    'operating_income': ('OperatingIncomeLoss', 'ProfitLossFromOperatingActivities', 'OperatingIncomeLossIncludingEquityMethodInvestments'),
    'interest_expense': ('InterestExpense', 'InterestExpenseNonoperating', 'InterestExpenseDebt', 'FinanceCosts', 'InterestPaidClassifiedAsOperatingActivities'),
})
AANTALLEN = {
    # Gewogen gemiddeld aantal verwaterde aandelen (eenheid 'shares'), om verwatering en beurswaarde te bepalen.
    'shares_diluted': ('WeightedAverageNumberOfDilutedSharesOutstanding', 'AdjustedWeightedAverageShares', 'WeightedAverageShares'),
}
BALANS = {
    'total_assets': ('Assets',),
    'current_assets': ('AssetsCurrent', 'CurrentAssets'),
    'current_liabilities': ('LiabilitiesCurrent', 'CurrentLiabilities'),
    'total_liabilities': ('Liabilities',),
    'retained_earnings': ('RetainedEarningsAccumulatedDeficit', 'RetainedEarnings'),
    'cash': ('CashAndCashEquivalentsAtCarryingValue', 'CashAndCashEquivalents', 'CashAndCashEquivalentsIncludingRestrictedCash'),
    'long_term_debt': ('LongTermDebtNoncurrent', 'LongTermDebt', 'Borrowings', 'NoncurrentPortionOfNoncurrentBorrowings',
                       'LongTermDebtAndCapitalLeaseObligations', 'LongtermBorrowings', 'NoncurrentPortionOfLongtermBorrowings'),
}


def _dagen(r):
    try:
        return (date.fromisoformat(r['end']) - date.fromisoformat(r['start'])).days
    except (KeyError, TypeError, ValueError):
        return None


def _kies(payload, tags, eind, valuta, stroom, eenheid=None):
    """Eerste tag (in volgorde van voorkeur) met een eenduidige waarde voor dit boekjaareinde."""
    facts = payload.get('facts') if isinstance(payload, dict) else None
    if not isinstance(facts, dict):
        return None
    for tag in tags:
        waarden = {}
        for ns in ('us-gaap', 'ifrs-full'):
            blok = (facts.get(ns) or {}).get(tag)
            rijen = ((blok or {}).get('units') or {}).get(eenheid or valuta) if isinstance(blok, dict) else None
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


def _per_indiening(payload, tags, eind, valuta):
    """{accn: waarde} voor de eerste tag met een balanswaarde op dit boekjaareinde (één waarde per indiening)."""
    facts = payload.get('facts') if isinstance(payload, dict) else None
    for tag in tags:
        uit = {}
        for ns in ('us-gaap', 'ifrs-full'):
            blok = ((facts or {}).get(ns) or {}).get(tag)
            for r in (((blok or {}).get('units') or {}).get(valuta) or []) if isinstance(blok, dict) else []:
                v = r.get('val') if isinstance(r, dict) else None
                if (r.get('end') == eind and r.get('form') in ANNUAL and r.get('accn') and not r.get('start')
                        and isinstance(v, (int, float)) and not isinstance(v, bool) and v == v):
                    uit.setdefault((r.get('filed') or '', r['accn']), set()).add(v)
        uit = {k: next(iter(v)) for k, v in uit.items() if len(v) == 1}
        if uit:
            return uit
    return {}


def _schulden_afgeleid(payload, eind, valuta, activa=None):
    """Totale schulden voor bedrijven die 'Liabilities' niet zelf taggen (Amazon, Walmart, Coca-Cola e.a.): balanstotaal min
    eigen vermogen (inclusief minderheidsbelang) min tijdelijk eigen vermogen, alle onderdelen uit DEZELFDE indiening (de
    nieuwste die ze allemaal heeft). Alleen als die balans sluit (balanstotaal = activa) en de uitkomst tussen 0 en de activa
    ligt; anders None (nooit een gok)."""
    totaal = _per_indiening(payload, ('LiabilitiesAndStockholdersEquity', 'EquityAndLiabilities'), eind, valuta)
    activa_i = _per_indiening(payload, ('Assets',), eind, valuta)
    eigen = _per_indiening(payload, ('StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest', 'Equity'), eind, valuta)
    moeder = _per_indiening(payload, ('StockholdersEquity',), eind, valuta)
    minderheid = _per_indiening(payload, ('MinorityInterest',), eind, valuta)
    tijdelijk = _per_indiening(payload, ('TemporaryEquityCarryingAmountIncludingPortionAttributableToNoncontrollingInterests',
                                         'TemporaryEquityCarryingAmountAttributableToParent',
                                         'RedeemableNoncontrollingInterestEquityCarryingAmount'), eind, valuta)
    nci_winst = _kies(payload, ('NetIncomeLossAttributableToNoncontrollingInterest',), eind, valuta, True)
    for k in sorted(totaal, reverse=True):
        if k not in activa_i or abs(totaal[k] - activa_i[k]) > 0.001 * abs(activa_i[k]):
            continue
        if k in eigen:
            ev = eigen[k]
        elif k in moeder and (k in minderheid or not nci_winst):
            ev = moeder[k] + minderheid.get(k, 0)
        else:
            continue
        schuld = totaal[k] - ev - tijdelijk.get(k, 0)
        return schuld if 0 < schuld < activa_i[k] else None
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
        rij.update({veld: _kies(payload, tags, eind, valuta, True, 'shares') for veld, tags in AANTALLEN.items()})
        # Dividend is een uitgave: positief getal. Een negatieve waarde duidt op een andere betekenis: niet gebruiken.
        if rij['dividends_paid'] is not None and rij['dividends_paid'] < 0:
            rij['dividends_paid'] = None
        if rij['depreciation'] is not None and rij['depreciation'] < 0:
            rij['depreciation'] = None
        for veld in ('long_term_debt', 'total_assets', 'current_assets', 'current_liabilities', 'total_liabilities', 'shares_diluted', 'interest_expense'):
            if rij[veld] is not None and rij[veld] < 0:       # deze velden zijn nooit negatief; een minteken duidt op een andere betekenis
                rij[veld] = None
        if rij['total_liabilities'] is None:
            rij['total_liabilities'] = _schulden_afgeleid(payload, eind, valuta, rij.get('total_assets'))
        if rij['shares_diluted'] is not None and 0 < rij['shares_diluted'] < 100_000:
            rij['shares_diluted'] *= 1_000_000                 # sommige indieners melden aandelen in miljoenen
        uit[eind] = rij
    return uit
