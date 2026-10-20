"""Hoogste/laagste koers en dividend per boekjaar. Illustratieve, niet-ronde getallen."""
import random
import unittest
from datetime import date, timedelta

import bouw_webdata as bw
from koershistorie import jaarkoersen


def dagen(van, tot, seed=3, start=47.31):
    rnd, k, d, uit = random.Random(seed), start, date.fromisoformat(van), []
    while d <= date.fromisoformat(tot):
        if d.weekday() < 5:
            k = round(k * (1 + rnd.uniform(-0.02, 0.0215)), 4)
            uit.append((d.isoformat(), k))
        d += timedelta(days=1)
    return uit


class JaarkoersenTests(unittest.TestCase):
    def setUp(self):
        self.p = dagen('2022-12-20', '2025-01-05')
        self.divs = [('2023-03-09', 0.2375), ('2023-09-14', 0.2375), ('2024-03-07', 0.25), ('2024-09-12', 0.25)]

    def test_hoog_laag_en_dividend_per_jaar(self):
        r = jaarkoersen(self.p, self.divs, ['2023-12-31', '2024-12-31'])
        j23 = [k for d, k in self.p if '2023-01-01' <= d <= '2023-12-31']
        self.assertEqual(r['2023-12-31']['koers_hoog'], round(max(j23), 4))
        self.assertEqual(r['2023-12-31']['koers_laag'], round(min(j23), 4))
        self.assertAlmostEqual(r['2023-12-31']['dividend_ps'], 0.475)
        self.assertAlmostEqual(r['2024-12-31']['dividend_ps'], 0.5)

    def test_te_weinig_koersen_of_gat_geeft_none(self):
        kort = [p for p in self.p if p[0] >= '2023-09-01']
        r = jaarkoersen(kort, self.divs, ['2023-12-31', '2024-12-31'])
        self.assertEqual(r['2023-12-31'], {'koers_hoog': None, 'koers_laag': None, 'dividend_ps': None})
        self.assertIsNotNone(r['2024-12-31']['koers_hoog'])
        gat = [p for p in self.p if not ('2024-11-01' <= p[0] <= '2024-12-31')]
        self.assertIsNone(jaarkoersen(gat, self.divs, ['2024-12-31'])['2024-12-31']['koers_hoog'])

    def test_geen_dividend_gevonden_is_onbekend_niet_nul(self):
        r = jaarkoersen(self.p, [], ['2023-12-31'])
        self.assertIsNotNone(r['2023-12-31']['koers_hoog'])
        self.assertIsNone(r['2023-12-31']['dividend_ps'])

    def test_rommel_in_invoer_wordt_genegeerd(self):
        p = self.p + [('kapot', 5), ('2023-05-05', None), ('2023-05-06', -4), ('2023-05-07', float('nan')), ('2023-05-08', 99999)]
        r = jaarkoersen(p, [('x', 1), ('2023-04-01', -1)], ['2023-12-31'])
        self.assertEqual(r['2023-12-31']['koers_hoog'], 99999.0)   # een geldige (hoge) koers telt wel mee
        self.assertIsNone(r['2023-12-31']['dividend_ps'])


class KoppelingTests(unittest.TestCase):
    def gegevens(self, valuta='EUR'):
        return {'currencies': [valuta], 'jaren': [{'year': 2023, 'end': '2023-12-31', 'currency': valuta},
                                                  {'year': 2024, 'end': '2024-12-31', 'currency': valuta}]}

    def test_zelfde_valuta_vult_velden(self):
        g = bw.voeg_koershistorie_toe(self.gegevens(), dagen('2022-12-20', '2025-01-05'), [('2024-05-01', 0.31)], 'EUR')
        self.assertIsNotNone(g['jaren'][1]['koers_hoog'])
        self.assertEqual(g['jaren'][1]['dividend_ps'], 0.31)

    def test_andere_valuta_geeft_niets_en_geen_omrekening(self):
        g = bw.voeg_koershistorie_toe(self.gegevens('USD'), dagen('2022-12-20', '2025-01-05'), [], 'EUR')
        for j in g['jaren']:
            self.assertEqual((j['koers_hoog'], j['koers_laag'], j['dividend_ps']), (None, None, None))


if __name__ == '__main__':
    unittest.main()


class KoersbereikTests(unittest.TestCase):
    def test_bereik_over_laatste_tien_jaar(self):
        from koershistorie import koersbereik
        p = dagen('2014-01-02', '2026-10-16', start=31.77)
        b = koersbereik(p)
        laatste = date.fromisoformat(p[-1][0])
        venster = [k for d, k in p if (laatste - date.fromisoformat(d)).days <= 3652]
        self.assertEqual((b['hoog'], b['laag']), (round(max(venster), 4), round(min(venster), 4)))
        self.assertGreaterEqual(b['jaren'], 9.9)

    def test_te_korte_reeks_of_te_weinig_dagen_geeft_none(self):
        from koershistorie import koersbereik
        self.assertIsNone(koersbereik(dagen('2022-01-03', '2026-10-16')))
        weinig = [p for i, p in enumerate(dagen('2014-01-02', '2026-10-16')) if i % 5 == 0]
        self.assertIsNone(koersbereik(weinig))
        self.assertIsNone(koersbereik([]))
        self.assertIsNone(koersbereik(None))
