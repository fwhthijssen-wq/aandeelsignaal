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
