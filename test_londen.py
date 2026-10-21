"""Londen noteert in pence (GBX); de app rekent in ponden (GBP). 100 pence = 1 pond is een vaste eenheid, geen wisselkoers."""
import tempfile
import unittest
from datetime import date, timedelta

import bouw_webdata as bw
import jaarverslag_archief as ja


class Londen(unittest.TestCase):
    def test_pence_naar_pond(self):
        self.assertEqual(bw.pence_naar_pond([('2026-01-02', 4500.0)]), [('2026-01-02', 45.0)])

    def test_dividend_in_pence_of_al_in_ponden(self):
        koers = [('2026-01-02', 45.0)]
        self.assertEqual(bw.dividend_naar_pond([('2026-03-01', 40.0)], koers), [('2026-03-01', 0.40)])
        self.assertEqual(bw.dividend_naar_pond([('2026-03-01', 0.40)], koers), [('2026-03-01', 0.40)])
        self.assertEqual(bw.dividend_naar_pond([('2025-12-01', 40.0)], koers), [])     # geen koers op of vóór die dag

    def test_live_rekent_londen_in_ponden(self):
        oud = bw.CATALOGUS
        start = date(2026, 10, 21) - timedelta(days=400)
        reeks = [((start + timedelta(days=i)).isoformat(), 4500.0 + i) for i in range(400)]
        try:
            bw.CATALOGUS = (('ULVR.L', 'Unilever', 'Verenigd Koninkrijk', 'GBX', 'Londen'),)
            with tempfile.TemporaryDirectory() as tmp:
                bestand = bw.live('x@y.nl', fetch_prijzen=lambda t: reeks, historie_ophalen=lambda t: (reeks, [(reeks[-10][0], 40.0)]),
                                  valuta_ophalen=lambda t: 'GBp', pauze=lambda: None, esef_ophalen=lambda t: None,
                                  yahoo_ophalen=lambda t: None, archief=ja.Archief(tmp))
        finally:
            bw.CATALOGUS = oud
        rec = bestand['aandelen'][0]
        self.assertEqual(rec['valuta'], 'GBP')
        self.assertAlmostEqual(rec['koers']['slot'], (4500.0 + 399) / 100)

    def test_verkeerde_valuta_van_yahoo_geeft_geen_koers(self):
        oud = bw.CATALOGUS
        try:
            bw.CATALOGUS = (('ULVR.L', 'Unilever', 'Verenigd Koninkrijk', 'GBX', 'Londen'),)
            with tempfile.TemporaryDirectory() as tmp:
                bestand = bw.live('x@y.nl', fetch_prijzen=lambda t: [('2026-10-20', 45.0)], historie_ophalen=lambda t: ([], []),
                                  valuta_ophalen=lambda t: 'GBP', pauze=lambda: None, esef_ophalen=lambda t: None,
                                  yahoo_ophalen=lambda t: None, archief=ja.Archief(tmp))
        finally:
            bw.CATALOGUS = oud
        self.assertIsNone(bestand['aandelen'][0]['koers'])        # Yahoo zegt GBP i.p.v. pence: niet raden


if __name__ == '__main__':
    unittest.main()
