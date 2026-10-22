"""AMX in de catalogus (samenstelling na de Euronext-herziening van juni 2026) en de bijgewerkte AEX."""
import json
import unittest

import europa_indexen as ei


class Amx(unittest.TestCase):
    def test_samenstelling(self):
        ix = ei.indices()
        amx = sorted(t for t, v in ix.items() if 'AMX' in v)
        self.assertEqual(len(amx), 25)
        self.assertIn('RAND.AS', amx)
        self.assertNotIn('AEX', ix['RAND.AS'])
        for t in ('SBMO.AS', 'AALB.AS', 'CVC.AS', 'INPST.AS', 'WDP.BR'):
            self.assertIn('AEX', ix[t])

    def test_esef_koppeling(self):
        lei = json.load(open('esef_lei.json'))
        for t in ('ARCAD.AS', 'VPK.AS', 'LIGHT.AS', 'SBMO.AS', 'AALB.AS'):
            self.assertIn(t, lei)


if __name__ == '__main__':
    unittest.main()


class AmxTienJaar(unittest.TestCase):
    def test_tien_jaar_bevestigd_met_afm_en_esef(self):
        import bouw_webdata as bw
        for t, jaar, eps in (('VPK.AS', 2016, 4.18), ('ARCAD.AS', 2018, -0.31), ('CRBN.AS', 2015, 1.28)):
            g = bw.gegevens_uit_esef(bw.esef_ophalen(t), '2026-10-22')
            self.assertEqual((g['eps_status'], g['eps_verified_years']), ('independently_verified', 10), t)
            self.assertEqual({j['year']: j['comparable_eps'] for j in g['jaren']}[jaar], eps)

    def test_basic_fit_beursgang_buiten_reeks(self):
        import bouw_webdata as bw
        g = bw.gegevens_uit_esef(bw.esef_ophalen('BFIT.AS'), '2026-10-22')
        self.assertEqual(g['eps_verified_years'], 9)
