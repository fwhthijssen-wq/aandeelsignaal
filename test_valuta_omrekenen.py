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


class SectorUitYahoo(unittest.TestCase):
    def test_alleen_als_wikidata_niets_heeft(self):
        rec = {'bedrijf': {'beschrijving': 'x', 'sector': []}}
        bw.sector_aanvullen(rec, {'sector': 'Technology'})
        self.assertEqual(rec['bedrijf']['sector'], ['technologie']); self.assertEqual(rec['bedrijf']['sector_bron'], 'Yahoo Finance')
        rec = {'bedrijf': {'sector': ['semiconductorindustrie']}}
        bw.sector_aanvullen(rec, {'sector': 'Technology'})
        self.assertEqual(rec['bedrijf']['sector'], ['semiconductorindustrie'])
        rec = {'bedrijf': None}
        bw.sector_aanvullen(rec, {'sector': 'Onbekend'})
        self.assertIsNone(rec['bedrijf'])
        bw.sector_aanvullen(rec, {'sector': 'Real Estate'})
        self.assertEqual(rec['bedrijf']['sector'], ['vastgoed'])


class SplitsingNaVerslag(unittest.TestCase):
    def g(self):
        return {'bron': 'SEC', 'jaren': [{'end': '2024-03-31', 'comparable_eps': 2.0, 'ingediend': '2024-07-20'},
                                          {'end': '2025-03-31', 'comparable_eps': 2.4, 'ingediend': '2025-07-14'}]}

    def test_splitsing_na_laatste_verslag_wordt_verrekend_en_is_terug_te_draaien(self):
        g = self.g()
        bw.split_na_verslag(g, 'XYZ', [('2019-09-19', 2.0), ('2025-08-26', 2.0)])
        self.assertEqual([j['comparable_eps'] for j in g['jaren']], [1.0, 1.2])
        self.assertEqual(g['split_na_verslag']['factor'], 2.0); self.assertIn('2025-07-14', g['split_na_verslag']['uitleg'])
        bw.split_na_verslag(g, 'XYZ', [('2025-08-26', 2.0)])                 # niet dubbel
        self.assertEqual(g['jaren'][0]['comparable_eps'], 1.0)
        bw.split_na_verslag_terug(g)
        self.assertEqual(g, self.g())

    def test_afsplitsing_is_geen_splitsing(self):
        g = self.g(); bw.split_na_verslag(g, 'HON', [('2026-06-29', 0.9535)]); self.assertEqual(g, self.g())
        g = self.g(); bw.split_na_verslag(g, 'AI.PA', [('2026-06-08', 1.1)]); self.assertAlmostEqual(g['jaren'][1]['comparable_eps'], 2.4 / 1.1)
        g = self.g(); bw.split_na_verslag(g, 'TIT.MI', [('2026-06-15', 0.1)]); self.assertAlmostEqual(g['jaren'][1]['comparable_eps'], 24.0)

    def test_splitsing_voor_het_verslag_of_zonder_datum_niets(self):
        g = self.g(); bw.split_na_verslag(g, 'XYZ', [('2025-07-01', 2.0)]); self.assertEqual(g, self.g())
        g = self.g(); [j.pop('ingediend') for j in g['jaren']]; bw.split_na_verslag(g, 'XYZ', [('2025-08-26', 2.0)])
        self.assertNotIn('split_na_verslag', g)

    def test_adr_alleen_als_de_lokale_notering_ook_splitst(self):
        g = self.g(); bw.split_na_verslag(g, 'HDB', [('2025-08-26', 2.0)], [('2025-08-26', 2.0)])
        self.assertEqual(g['jaren'][1]['comparable_eps'], 1.2)
        g = self.g(); bw.split_na_verslag(g, 'HDB', [('2025-08-26', 2.0)], [])
        self.assertEqual(g['jaren'][1]['comparable_eps'], 2.4); self.assertIn('ADS-verhouding', g['waarschuwingen'][0])
        bw.split_na_verslag_terug(g); self.assertEqual(g['waarschuwingen'], [])
