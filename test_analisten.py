"""Analistenadvies van Yahoo: alleen ter informatie, nooit onzin doorgeven."""
import unittest
import bouw_webdata as bw


class Analisten(unittest.TestCase):
    def test_gewoon_advies(self):
        a = bw.analisten_uit_info({'numberOfAnalystOpinions': 31, 'recommendationMean': 1.9, 'recommendationKey': 'buy', 'targetMeanPrice': 1150, 'currency': 'EUR'}, '2026-10-24')
        self.assertEqual(a, {'advies': 'buy', 'gemiddeld': 1.9, 'aantal': 31, 'koersdoel': 1150.0, 'valuta': 'EUR', 'datum': '2026-10-24', 'bron': 'Yahoo Finance'})

    def test_londen_in_ponden(self):
        a = bw.analisten_uit_info({'numberOfAnalystOpinions': 12, 'recommendationMean': 2.4, 'recommendationKey': 'hold', 'targetMeanPrice': 450, 'currency': 'GBp'}, 'd', True)
        self.assertEqual((a['koersdoel'], a['valuta']), (4.5, 'GBP'))

    def test_geen_of_onzin(self):
        for info in (None, {}, {'numberOfAnalystOpinions': 0, 'recommendationKey': 'buy'}, {'numberOfAnalystOpinions': 3, 'recommendationKey': '<b>'}, 'x'):
            self.assertIsNone(bw.analisten_uit_info(info, 'd'))
        a = bw.analisten_uit_info({'numberOfAnalystOpinions': 3, 'recommendationKey': 'sell', 'recommendationMean': 9, 'targetMeanPrice': -1}, 'd')
        self.assertIsNone(a['gemiddeld']); self.assertIsNone(a['koersdoel'])


if __name__ == '__main__':
    unittest.main()
