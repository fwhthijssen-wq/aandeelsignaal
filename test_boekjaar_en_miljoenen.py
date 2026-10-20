"""52/53-wekenjaren (J&J-achtig) en aandelen in miljoenen (McDonald's-achtig). Illustratieve gegevens."""
import unittest

import apple_like_fixture as fx
from boekjaar import boekjaar
from praktijkcontrole_sec_esef import summarize_sec


class BoekjaarTests(unittest.TestCase):
    def test_begin_januari_hoort_bij_vorig_boekjaar(self):
        self.assertEqual(boekjaar('2021-01-03'), 2020)
        self.assertEqual(boekjaar('2023-01-01'), 2022)
        self.assertEqual(boekjaar('2023-12-31'), 2023)
        self.assertEqual(boekjaar('2018-12-30'), 2018)
        self.assertEqual(boekjaar('2016-09-24'), 2016)
        self.assertEqual(boekjaar('2024-01-08'), 2024)

    def test_twee_sluitingen_binnen_een_kalenderjaar_botsen_niet_meer(self):
        self.assertNotEqual(boekjaar('2023-01-01'), boekjaar('2023-12-31'))


class AandelenInMiljoenenTests(unittest.TestCase):
    def run_with(self, years_in_millions):
        data = fx.payload()
        for r in data['facts']['us-gaap']['WeightedAverageNumberOfDilutedSharesOutstanding']['units']['shares']:
            if r['end'][:4] in years_in_millions:
                r['val'] = r['val'] / 1e6
        return summarize_sec('AAPL', 'test@example.org', fetcher=fx.snapshot_fetcher(data),
                             asof='2026-10-19')['dossier']

    def test_aandelen_in_miljoenen_worden_herberekend_en_blijven_geverifieerd(self):
        d = self.run_with({'2021'})
        self.assertIn(2021, d['eps_independently_verified_years'])

    def test_werkelijk_foute_aandelen_blijven_afgekeurd(self):
        data = fx.payload()
        for r in data['facts']['us-gaap']['WeightedAverageNumberOfDilutedSharesOutstanding']['units']['shares']:
            if r['end'].startswith('2021'):
                r['val'] = r['val'] / 1e6 * 1.3   # niet consistent met de gerapporteerde EPS
        d = summarize_sec('AAPL', 'test@example.org', fetcher=fx.snapshot_fetcher(data),
                          asof='2026-10-19')['dossier']
        self.assertNotIn(2021, d['eps_independently_verified_years'])


if __name__ == '__main__':
    unittest.main()


class AlternatieveWinsttagTests(unittest.TestCase):
    def run_with(self, hernoem):
        data = fx.payload()
        us = data['facts']['us-gaap']
        for oud, nieuw in hernoem.items():
            us[nieuw] = us.pop(oud)
        return summarize_sec('AAPL', 'test@example.org', fetcher=fx.snapshot_fetcher(data),
                             asof='2026-10-19')['dossier']

    def test_winst_beschikbaar_voor_gewone_aandeelhouders_als_enige_tag(self):
        d = self.run_with({'NetIncomeLoss': 'NetIncomeLossAvailableToCommonStockholdersBasic'})
        self.assertEqual(d['eps_independently_verified_years'], [2016, 2017, 2018, 2019, 2020, 2021])

    def test_zonder_enige_winsttag_blijft_onbewezen(self):
        data = fx.payload()
        del data['facts']['us-gaap']['NetIncomeLoss']
        d = summarize_sec('AAPL', 'test@example.org', fetcher=fx.snapshot_fetcher(data),
                          asof='2026-10-19')['dossier']
        self.assertNotIn(2021, d['eps_independently_verified_years'])
        self.assertNotIn(2020, d['eps_independently_verified_years'])


class IfrsWinsttagTests(unittest.TestCase):
    @staticmethod
    def payload(owners=None, ordinary=None):
        def rij(val, acc='a1'):
            return {'start': '2024-01-01', 'end': '2024-12-31', 'val': val, 'accn': acc, 'fy': 2024,
                    'fp': 'FY', 'form': '20-F', 'filed': '2025-03-13'}
        feiten = {'AdjustedWeightedAverageShares': {'units': {'shares': [rij(2507100000)]}}}
        if owners is not None:
            feiten['ProfitLossAttributableToOwnersOfParent'] = {'units': {'EUR': [rij(owners)]}}
        if ordinary is not None:
            feiten['ProfitLossAttributableToOrdinaryEquityHoldersOfParentEntity'] = {'units': {'EUR': [rij(ordinary)]}}
        return {'facts': {'ifrs-full': feiten}}

    def test_alleen_ordinary_equity_tag_wordt_gebruikt(self):
        from eps_verification import sec_eps_recompute_inputs
        r = sec_eps_recompute_inputs(self.payload(ordinary=5744000000), '2026-10-19')
        self.assertEqual(len(r), 1)
        self.assertEqual(r[0]['net_income'], 5744000000)
        self.assertIn('OrdinaryEquityHolders', r[0]['source'])

    def test_beide_tags_gelijk_is_goed_en_verschillend_wordt_weggelaten(self):
        from eps_verification import sec_eps_recompute_inputs
        self.assertEqual(len(sec_eps_recompute_inputs(self.payload(5744000000, 5744000000), '2026-10-19')), 1)
        self.assertEqual(sec_eps_recompute_inputs(self.payload(5744000000, 5700000000), '2026-10-19'), [])
