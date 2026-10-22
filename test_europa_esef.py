"""Aantal aandelen uit de tekst van ESEF-rapporten buiten Nederland (beta.60) en Franse jaarverslagen uit het officiële register."""
import unittest

import bouw_webdata as bw
import jaarverslag_bronnen as jb


class EuropaEsef(unittest.TestCase):
    def jaren(self, t):
        return bw.gegevens_uit_esef(bw.esef_ophalen(t), '2026-10-22')['eps_verified_years']

    def test_londen_parijs_madrid(self):
        self.assertGreaterEqual(self.jaren('CCH.L'), 6)
        self.assertGreaterEqual(self.jaren('SGO.PA'), 6)
        self.assertGreaterEqual(self.jaren('ELE.MC'), 6)

    def test_franse_documenten_met_registerlink(self):
        reg = jb.laad()
        docs = [d for b in reg.values() for d in b['documenten'] if d['kenmerk'].startswith('AMF-FR:')]
        self.assertGreater(len(docs), 5)
        for d in docs:
            self.assertTrue(d['url'].startswith('https://echanges.dila.gouv.fr/OPENDATA/AMF/'))
            self.assertTrue(d['ingediend'])

    def test_gebroken_boekjaar_pernod_ricard(self):
        doc = next(d for d in jb.laad()['RI.PA']['documenten'] if d['kenmerk'].startswith('AMF-FR:'))
        self.assertTrue(all(f['eind'].endswith('-06-30') for f in doc['feiten']))


if __name__ == '__main__':
    unittest.main()
