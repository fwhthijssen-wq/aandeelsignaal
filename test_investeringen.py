"""Ontbrekende investeringen aanvullen: eerst het nagekeken eigen begrip, dan een iets breder standaardbegrip; nooit vervangen."""
import unittest
import bouw_webdata as bw


def rij(end, val, form='20-F', start=None, filed='2025-03-01', accn='A1'):
    return {'end': end, 'start': start or (end[:4] + '-01-01'), 'val': val, 'form': form, 'fp': 'FY', 'filed': filed, 'accn': accn}


class Investeringen(unittest.TestCase):
    def test_bestaand_cijfer_blijft_en_eigen_begrip_gaat_voor_breed(self):
        g = {'jaren': [{'year': 2023, 'end': '2023-12-31', 'currency': 'EUR', 'capex': 10.0},
                       {'year': 2024, 'end': '2024-12-31', 'currency': 'EUR'}, {'year': 2025, 'end': '2025-12-31', 'currency': 'EUR'}]}
        cf = {'lei': 'L1', 'facts': {'ifrs-full': {bw.CAPEX_IFRS_BREED: {'units': {'EUR': [rij('2023-12-31', 99.0), rij('2024-12-31', 700.0), rij('2025-12-31', 800.0)]}}}}}
        reg = {'L1': {'jaren': {'2025-12-31': {'val': -30.0, 'unit': 'EUR', 'fxo_id': 'X9', 'begrippen': ['wdp:Capex']}}}}
        bw.vul_investeringen_aan(g, cf, register=reg)
        self.assertEqual(g['jaren'][0]['capex'], 10.0)                         # nooit vervangen
        self.assertEqual(g['jaren'][1]['capex'], 700.0)                        # breed begrip als terugval
        self.assertIn('ifrs-full:', g['jaren'][1]['capex_bron'])
        self.assertEqual(g['jaren'][2]['capex'], 30.0)                         # nagekeken eigen begrip gaat voor; altijd positief
        self.assertIn('wdp:Capex', g['jaren'][2]['capex_bron']); self.assertIn('X9', g['jaren'][2]['capex_bron'])

    def test_andere_valuta_of_geen_jaarperiode_telt_niet(self):
        g = {'jaren': [{'year': 2024, 'end': '2024-12-31', 'currency': 'EUR'}]}
        cf = {'facts': {'ifrs-full': {bw.CAPEX_IFRS_BREED: {'units': {'USD': [rij('2024-12-31', 5.0)], 'EUR': [rij('2024-12-31', 6.0, start='2024-07-01')]}}}}}
        bw.vul_investeringen_aan(g, cf, register={})
        self.assertIsNone(g['jaren'][0].get('capex'))

    def test_sec_productieve_activa_nieuwste_indiening(self):
        g = {'jaren': [{'year': 2024, 'end': '2024-12-31', 'currency': 'USD'}]}
        cf = {'facts': {'us-gaap': {'PaymentsToAcquireProductiveAssets': {'units': {'USD': [rij('2024-12-31', 80.0, form='10-K', filed='2025-02-01'), rij('2024-12-31', 83.0, form='10-K', filed='2026-02-01'), rij('2024-12-31', 1.0, form='10-Q', filed='2026-05-01')]}}}}}
        bw.vul_investeringen_aan(g, cf, register={})
        self.assertEqual(g['jaren'][0]['capex'], 83.0)
        self.assertIn('PaymentsToAcquireProductiveAssets', g['jaren'][0]['capex_bron'])


if __name__ == '__main__':
    unittest.main()
