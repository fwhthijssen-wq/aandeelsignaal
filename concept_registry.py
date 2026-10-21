"""Centraal register voor standaard SEC US-GAAP en IFRS-XBRL begrippen.

Alleen semantisch overeenkomstige tags worden samengevoegd. Tags voor
bredere investeringsdefinities blijven buiten de goedgekeurde capex-reeks.
"""

MONETARY_UNITS = ('USD', 'EUR', 'GBP')
ANNUAL_FORMS = frozenset(('10-K', '20-F', '40-F'))

CONCEPT_TAGS = {
    'Omzet': (
        'RevenueFromContractWithCustomerExcludingAssessedTax',
        'RevenueFromContractWithCustomerIncludingAssessedTax',
        'Revenues', 'SalesRevenueNet',
        'Revenue', 'RevenueFromContractsWithCustomers',
    ),
    'Nettowinst': ('NetIncomeLoss', 'ProfitLoss'),
    'Operationele kasstroom': (
        'NetCashProvidedByUsedInOperatingActivities',
        'CashFlowsFromUsedInOperatingActivities',
    ),
    'Investeringen in vaste activa': (
        'PaymentsToAcquirePropertyPlantAndEquipment',
        'PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities',
    ),
}

EPS_TAGS = ('EarningsPerShareDiluted', 'DilutedEarningsLossPerShare',
            # 'gewoon en verwaterd' in één cijfer: het bedrijf meldt zelf dat beide gelijk zijn
            'EarningsPerShareBasicAndDiluted', 'BasicAndDilutedEarningsLossPerShare')
# Uitwijknaam (o.a. Shell): alleen gebruikt voor een boekjaar waarvoor geen gewone EPS-naam bestaat.
# De herberekening (nettowinst / aandelen) en de overige controles beslissen daarna of het cijfer geldt;
# bij afgestoten bedrijfsonderdelen wijkt het af van de herberekening en blijft het jaar onbevestigd.
EPS_FALLBACK_TAGS = ('DilutedEarningsLossPerShareFromContinuingOperations',
                     # Laatste terugval: alleen de gewone winst per aandeel gemeld (ABN AMRO e.a. zonder verwaterende
                     # instrumenten). Gemarkeerd in het dossier; de herberekening beslist daarna nog steeds.
                     'EarningsPerShareBasic', 'BasicEarningsLossPerShare')
EPS_GEWOON_TAGS = ('EarningsPerShareBasic', 'BasicEarningsLossPerShare')
EQUITY_TAGS = (
    'StockholdersEquity',
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
    'EquityAttributableToOwnersOfParent',
)

# Geen automatische capex: definities zijn breder dan materiele investeringen.
CAPEX_REVIEW_TAGS = ('PaymentsToAcquireProductiveAssets',)


def tag_candidates(payload, concept):
    """Diagnostiek: welke standaardbegrippen zijn werkelijk aanwezig?"""
    tags = CONCEPT_TAGS.get(concept, ())
    return [(namespace, tag) for namespace in ('us-gaap', 'ifrs-full')
            for tag in tags if tag in payload.get('facts', {}).get(namespace, {})]
