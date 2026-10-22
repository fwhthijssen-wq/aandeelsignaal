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
