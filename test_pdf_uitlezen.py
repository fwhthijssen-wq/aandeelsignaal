"""Automatische uitlezer voor pdf-jaarverslagen (hulp/pdf_uitlezen.py): alleen een uitkomst als alles op de cent klopt."""
import sys
import unittest

sys.path.insert(0, 'hulp')
import pdf_uitlezen as pu

AALBERTS = """
25. EARNINGS PER SHARE
                                                                            2019                  2018
Net profit (in EUR million)                                                225.7                  238.2
Weighted average number of shares in issue (in units)                110,580,102         110,580,102
Basic earnings per share (in EUR)                                           2.04                   2.15
Net profit (in EUR million)                                                225.7                  238.2
Weighted average number of shares in issue including effect of performance share plan (in units)     110,984,102         110,727,102
Diluted earnings per share (in EUR)                                         2.03                   2.15
"""

BRITS = """
                                                     2018                                  2017
                                                        Basic      Diluted                         Basic        Diluted
                                                        pence        pence                         pence          pence
                                              £m     per share    per share              £m     per share      per share
Profit for the year attributable to equity shareholders     1,000      31.3     31.2      827      26.0     25.9
                                                                                 Millions      Millions
Weighted average number of shares used in calculating diluted
  earnings per share                                                              3,201         3,197
"""


class PdfUitlezen(unittest.TestCase):
    def test_nederlandse_tabel(self):
        res, reden = pu.uitlezen(AALBERTS, 2019, komma=False)
        self.assertIsNone(reden)
        self.assertEqual([(r[0], r[1], r[3]) for r in res], [(2019, 2.03, 110_984_102), (2018, 2.15, 110_727_102)])

    def test_britse_tabel_in_pence(self):
        res, reden = pu.uitlezen(BRITS, 2018, komma=False, hint=3.2e9)
        self.assertIsNone(reden)
        self.assertEqual([(r[0], r[1], r[3]) for r in res], [(2018, 0.312, 3_201_000_000), (2017, 0.259, 3_197_000_000)])

    def test_klopt_niet_dan_niets(self):
        res, reden = pu.uitlezen(AALBERTS.replace('2.03', '2.33'), 2019, komma=False)
        self.assertIsNone(res)

    def test_verkeerd_jaar_dan_niets(self):
        self.assertIsNone(pu.uitlezen(AALBERTS, 2021, komma=False)[0])


if __name__ == '__main__':
    unittest.main()
