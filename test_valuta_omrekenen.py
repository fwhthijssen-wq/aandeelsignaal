import copy, unittest
import valuta_omrekenen as V

K = {'USD': {'2023': 0.925, '2024': 0.924, '2025': 0.88}, 'GBP': {'2023': 1.15, '2024': 1.18, '2025': 1.17}}


def g_usd():
    return {'currencies': ['USD'], 'jaren': [
        {'year': 2024, 'end': '2024-12-31', 'currency': 'USD', 'comparable_eps': 1.0, 'reported_eps': 1.0, 'sales': 1000.0, 'net_income': 100.0, 'eps_narekening': {'aandelen': 100}},
        {'year': 2025, 'end': '2025-12-31', 'currency': 'USD', 'comparable_eps': 2.0, 'sales': 2000.0, 'net_income': None}]}


class Omrekenen(unittest.TestCase):
    def test_naar_euro_per_jaar_en_terug(self):
        g = g_usd(); oud = copy.deepcopy(g)
        V.omrekenen(g, 'EUR', K)
        self.assertEqual(g['currencies'], ['EUR'])
        self.assertEqual(g['jaren'][0]['comparable_eps'], 0.924); self.assertEqual(g['jaren'][1]['comparable_eps'], 1.76)
        self.assertEqual(g['jaren'][0]['sales'], 924); self.assertIsNone(g['jaren'][1]['net_income'])
        self.assertEqual(g['jaren'][0]['omgerekend'], {'van': 'USD', 'koers': 0.924, 'jaar': '2024'})
        self.assertIn('ECB-jaargemiddelde', g['omrekening']['uitleg'])
        V.omrekenen(g, 'EUR', K)                                   # tweede keer: niets
        self.assertEqual(g['jaren'][1]['comparable_eps'], 1.76)
        V.terug(g)
        self.assertEqual(g, oud)

    def test_usd_naar_pond_via_euro(self):
        g = V.omrekenen(g_usd(), 'GBP', K)
        self.assertAlmostEqual(g['jaren'][0]['comparable_eps'], round(0.924 / 1.18, 6))

    def test_niets_bij_zelfde_valuta_gemengd_of_zonder_koers(self):
        g = g_usd(); V.omrekenen(g, 'USD', K); self.assertNotIn('omrekening', g)
        g = g_usd(); g['jaren'][1]['currency'] = 'EUR'; V.omrekenen(g, 'GBP', K); self.assertNotIn('omrekening', g)
        g = g_usd(); V.omrekenen(g, 'EUR', {'USD': {'2010': 0.7}}); self.assertNotIn('omrekening', g)


class Ttm(unittest.TestCase):
    def test_kwartaalwinst_mee_omgerekend(self):
        import bouw_webdata as bw
        g = V.omrekenen(g_usd(), 'EUR', K)
        info = {'trailingEps': 2.2, 'financialCurrency': 'USD', 'mostRecentQuarter': 1790000000}   # ±sep 2026
        t = bw.ttm_uit_info(info, g, '2026-11-10')
        self.assertIsNotNone(t)


if __name__ == '__main__':
    unittest.main()


class Centen(unittest.TestCase):
    def test_eps_in_centen_wordt_gecorrigeerd_alleen_als_het_klopt(self):
        from eps_verification import corrigeer_centen, EPS_FACT
        inputs = [{'end': '2016-12-31', 'accn': 'a1', 'net_income': 4617e6, 'diluted_shares': 1808.6e6, 'currency': 'USD', 'source': 'x'}]
        rij = {'end': '2016-12-31', 'facts': {EPS_FACT: {'val': 255.3, 'accn': 'a1', 'unit': 'USD/shares'}}}
        goed = {'end': '2016-12-31', 'facts': {EPS_FACT: {'val': 2.553, 'accn': 'a1', 'unit': 'USD/shares'}}}
        fout = {'end': '2016-12-31', 'facts': {EPS_FACT: {'val': 400.0, 'accn': 'a1', 'unit': 'USD/shares'}}}
        corrigeer_centen([rij, goed, fout], inputs)
        self.assertEqual(rij['facts'][EPS_FACT]['val'], 2.553)
        self.assertEqual(rij['facts'][EPS_FACT]['schaal_correctie']['was'], 255.3)
        self.assertEqual(goed['facts'][EPS_FACT]['val'], 2.553); self.assertNotIn('schaal_correctie', goed['facts'][EPS_FACT])
        self.assertEqual(fout['facts'][EPS_FACT]['val'], 400.0)


import bouw_webdata as bw


class AdrKwartaalwinst(unittest.TestCase):
    def test_tsmc_per_ads_of_per_aandeel(self):
        # jaar: 44,67 TWD per aandeel x 0,031 x 5 = 6,92 USD per ADS
        g = {'jaren': [{'end': '2025-12-31', 'currency': 'USD', 'comparable_eps': 6.92,
                        'omgerekend': {'van': 'TWD', 'koers': 0.031, 'jaar': '2025'}}],
             'adr': {'aandelen_per_ads': 5.0}}
        basis = {'financialCurrency': 'TWD', 'mostRecentQuarter': 1790000000}
        per_aandeel = bw.ttm_uit_info(dict(basis, trailingEps=55.0), g, '2026-11-10')    # TWD per gewoon aandeel
        per_ads = bw.ttm_uit_info(dict(basis, trailingEps=8.5), g, '2026-11-10')         # al USD per ADS
        self.assertAlmostEqual(per_aandeel['eps'], 55.0 * 0.031 * 5, places=3)
        self.assertAlmostEqual(per_ads['eps'], 8.5, places=3)
        self.assertIsNone(bw.ttm_uit_info(dict(basis, trailingEps=500.0), g, '2026-11-10'))
