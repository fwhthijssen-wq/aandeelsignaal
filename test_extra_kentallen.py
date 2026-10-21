import unittest
from extra_kentallen import extra_jaarcijfers

def feit(end, val, start=None, form='10-K', filed='2026-02-01', accn='a'):
    r = {'end': end, 'val': val, 'form': form, 'filed': filed, 'accn': accn}
    if start: r['start'] = start
    return r

def payload(**tags):
    f = {'us-gaap': {}, 'ifrs-full': {}}
    for naam, (ns, unit, rijen) in tags.items():
        f[ns][naam] = {'units': {unit: rijen}}
    return {'facts': f}

J = [{'end': '2025-12-31', 'currency': 'USD'}]

class Extra(unittest.TestCase):
    def test_haalt_jaarwaarden_op(self):
        p = payload(IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest=('us-gaap', 'USD', [feit('2025-12-31', 123.5, '2025-01-01')]),
                    PaymentsOfDividendsCommonStock=('us-gaap', 'USD', [feit('2025-12-31', 40.5, '2025-01-01')]),
                    DepreciationDepletionAndAmortization=('us-gaap', 'USD', [feit('2025-12-31', 20.5, '2025-01-01')]),
                    LongTermDebtNoncurrent=('us-gaap', 'USD', [feit('2025-12-31', 77.5)]))
        r = extra_jaarcijfers(p, J)['2025-12-31']
        self.assertEqual({k: v for k, v in r.items() if v is not None}, {'pretax_income': 123.5, 'depreciation': 20.5, 'dividends_paid': 40.5, 'long_term_debt': 77.5})

    def test_niet_jaar_of_kwartaal_of_andere_valuta_telt_niet(self):
        p = payload(PaymentsOfDividendsCommonStock=('us-gaap', 'USD', [
            feit('2025-12-31', 1, '2025-10-01'),                       # kwartaal
            feit('2025-12-31', 2, '2025-01-01', form='10-Q'),          # geen jaarverslag
            feit('2025-12-31', 3, '2025-01-01', accn=None)]),          # zonder indieningsnummer
            DepreciationDepletionAndAmortization=('us-gaap', 'EUR', [feit('2025-12-31', 5, '2025-01-01')]),   # andere valuta
            LongTermDebtNoncurrent=('us-gaap', 'USD', [feit('2025-12-31', 9, '2025-01-01')]))                  # balans mag geen periode hebben
        r = extra_jaarcijfers(p, J)['2025-12-31']
        self.assertEqual([k for k, v in r.items() if v is not None], [])

    def test_ander_boekjaareinde_telt_niet(self):
        p = payload(PaymentsOfDividendsCommonStock=('us-gaap', 'USD', [feit('2024-12-31', 8, '2024-01-01')]))
        self.assertIsNone(extra_jaarcijfers(p, J)['2025-12-31']['dividends_paid'])

    def test_nieuwste_indiening_wint_maar_twee_verschillende_waarden_geven_niets(self):
        oud_nieuw = payload(PaymentsOfDividendsCommonStock=('us-gaap', 'USD', [feit('2025-12-31', 10, '2025-01-01', filed='2026-02-01'), feit('2025-12-31', 11, '2025-01-01', filed='2027-02-01')]))
        self.assertEqual(extra_jaarcijfers(oud_nieuw, J)['2025-12-31']['dividends_paid'], 11)
        conflict = payload(PaymentsOfDividendsCommonStock=('us-gaap', 'USD', [feit('2025-12-31', 10.5, '2025-01-01'), feit('2025-12-31', 12.5, '2025-01-01')]))
        self.assertIsNone(extra_jaarcijfers(conflict, J)['2025-12-31']['dividends_paid'])
        zelfde = payload(PaymentsOfDividendsCommonStock=('us-gaap', 'USD', [feit('2025-12-31', 10.5, '2025-01-01'), feit('2025-12-31', 10.5, '2025-01-01')]))
        self.assertEqual(extra_jaarcijfers(zelfde, J)['2025-12-31']['dividends_paid'], 10.5)

    def test_negatieve_en_ongeldige_waarden_en_slechte_invoer(self):
        p = payload(PaymentsOfDividendsCommonStock=('us-gaap', 'USD', [feit('2025-12-31', -5, '2025-01-01')]),
                    DepreciationDepletionAndAmortization=('us-gaap', 'USD', [feit('2025-12-31', float('nan'), '2025-01-01'), feit('2025-12-31', True, '2025-01-01')]))
        r = extra_jaarcijfers(p, J)['2025-12-31']
        self.assertIsNone(r['dividends_paid']); self.assertIsNone(r['depreciation'])
        for slecht in (None, {}, {'facts': None}, {'facts': {'us-gaap': None}}, []):
            self.assertEqual(extra_jaarcijfers(slecht, J)['2025-12-31']['pretax_income'], None)
        self.assertEqual(extra_jaarcijfers(p, [{'end': None, 'currency': 'USD'}, {}, {'end': '2025-12-31'}]), {})

    def test_ifrs_en_voorkeursvolgorde(self):
        p = payload(ProfitLossBeforeTax=('ifrs-full', 'EUR', [feit('2025-12-31', 50.5, '2025-01-01', form='20-F')]))
        r = extra_jaarcijfers(p, [{'end': '2025-12-31', 'currency': 'EUR'}])['2025-12-31']
        self.assertEqual(r['pretax_income'], 50.5)
        p2 = payload(LongTermDebtNoncurrent=('us-gaap', 'USD', [feit('2025-12-31', 1.5)]), LongTermDebt=('us-gaap', 'USD', [feit('2025-12-31', 9.5)]))
        self.assertEqual(extra_jaarcijfers(p2, J)['2025-12-31']['long_term_debt'], 1.5)

if __name__ == '__main__':
    unittest.main()


class ExtraNamenTests(unittest.TestCase):
    def test_extra_namen_vindt_afschrijving_dividend_en_schuld(self):
        import bouw_webdata as bw
        rij = lambda fy, form='10-K': {'fy': fy, 'form': form, 'val': 1.0}
        payload = {'facts': {'us-gaap': {
            'DepreciationAmortizationAndOther': {'units': {'USD': [rij(2019), rij(2024), rij(2022, '10-Q')]}},
            'DividendsCommonStockCash': {'units': {'USD': [rij(2023)]}},
            'DividendsPerShareDeclared': {'units': {'USD/shares': [rij(2023)]}},
            'LongTermDebtNoncurrent': {'units': {'USD': [rij(2020)]}},
            'Revenues': {'units': {'USD': [rij(2020)]}}}}}
        uit = bw.extra_namen(payload)
        self.assertEqual(uit['depreciation'], {'us-gaap:DepreciationAmortizationAndOther [USD]': [2019, 2024, 2]})
        self.assertEqual(list(uit['dividends_paid']), ['us-gaap:DividendsCommonStockCash [USD]'])
        self.assertEqual(list(uit['long_term_debt']), ['us-gaap:LongTermDebtNoncurrent [USD]'])
        self.assertEqual(bw.extra_namen(None), {'pretax_income': {}, 'depreciation': {}, 'dividends_paid': {}, 'long_term_debt': {}})


class IfrsDividendTag(unittest.TestCase):
    def test_ifrs_dividend_aan_aandeelhouders_moederbedrijf(self):
        j = [{'end': '2025-12-31', 'currency': 'EUR'}]
        p = payload(DividendsPaidToEquityHoldersOfParentClassifiedAsFinancingActivities=('ifrs-full', 'EUR', [feit('2025-12-31', 4321.5, '2025-01-01')]))
        self.assertEqual(extra_jaarcijfers(p, j)['2025-12-31']['dividends_paid'], 4321.5)


class ScoreVelden(unittest.TestCase):
    def test_balans_en_resultaatvelden_voor_de_scoremodellen(self):
        p = payload(Assets=('us-gaap', 'USD', [feit('2025-12-31', 1234.5)]),
                    AssetsCurrent=('us-gaap', 'USD', [feit('2025-12-31', 400.5)]),
                    LiabilitiesCurrent=('us-gaap', 'USD', [feit('2025-12-31', 301.5)]),
                    Liabilities=('us-gaap', 'USD', [feit('2025-12-31', 612.5)]),
                    RetainedEarningsAccumulatedDeficit=('us-gaap', 'USD', [feit('2025-12-31', -50.5)]),
                    CashAndCashEquivalentsAtCarryingValue=('us-gaap', 'USD', [feit('2025-12-31', 99.5)]),
                    GrossProfit=('us-gaap', 'USD', [feit('2025-12-31', 333.5, '2025-01-01')]),
                    OperatingIncomeLoss=('us-gaap', 'USD', [feit('2025-12-31', 155.5, '2025-01-01')]),
                    WeightedAverageNumberOfDilutedSharesOutstanding=('us-gaap', 'shares', [feit('2025-12-31', 98765.4, '2025-01-01')]))
        r = extra_jaarcijfers(p, J)['2025-12-31']
        self.assertEqual((r['total_assets'], r['current_assets'], r['current_liabilities'], r['total_liabilities']), (1234.5, 400.5, 301.5, 612.5))
        self.assertEqual((r['retained_earnings'], r['cash'], r['gross_profit'], r['operating_income']), (-50.5, 99.5, 333.5, 155.5))   # achterstand (negatief) is toegestaan
        self.assertIsNotNone(r['shares_diluted'])
