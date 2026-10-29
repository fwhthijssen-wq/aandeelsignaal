"""Management-feiten uit Yahoo: alleen feiten, bij ontbreken of onzin None (nooit een schatting)."""
import unittest
from datetime import date, datetime

import management as m

INFO = {
    'companyOfficers': [
        {'name': 'Ms. Jane Doe', 'title': 'President, CEO & Director', 'yearBorn': 1968, 'totalPay': 1_000_000},
        {'name': 'Mr. John Roe', 'title': 'CFO & Executive VP', 'yearBorn': 1975},
        {'name': '', 'title': 'Secretary'},
        {'name': 'Mr. A', 'title': 'COO'}, {'name': 'Mr. B', 'title': 'CTO'}, {'name': 'Mr. C', 'title': 'GC'},
        {'name': 'Mr. D', 'title': 'CMO'},
    ],
    'heldPercentInsiders': 0.02412, 'heldPercentInstitutions': 0.6125,
    'auditRisk': 2, 'boardRisk': 3, 'compensationRisk': 7, 'shareHolderRightsRisk': 1, 'overallRisk': 3,
    'governanceEpochDate': 1759276800,
}


class ManagementInfoTests(unittest.TestCase):
    def test_volledige_info(self):
        r = m.management_uit_info(INFO, '2026-10-29')
        self.assertEqual(r['ceo'], {'naam': 'Ms. Jane Doe', 'functie': 'President, CEO & Director', 'geboren': 1968})
        self.assertEqual(len(r['bestuurders']), 5)                  # lege naam valt weg, maximaal vijf
        self.assertNotIn('totalPay', r['bestuurders'][0])           # beloning niet: de valuta is bij Yahoo niet eenduidig
        self.assertEqual(r['bezit_insiders_pct'], 2.41)
        self.assertEqual(r['bezit_instellingen_pct'], 61.25)
        self.assertEqual(r['governance'], {'audit': 2, 'bestuur': 3, 'beloning': 7, 'aandeelhoudersrechten': 1, 'totaal': 3,
                                           'datum': '2025-10-01'})
        self.assertEqual((r['datum'], r['bron']), ('2026-10-29', 'Yahoo Finance'))

    def test_ceo_ook_als_chief_executive_of_c_e_o(self):
        for titel in ('Chief Executive Officer', 'C.E.O. & Chairman', 'Group CEO'):
            r = m.management_uit_info({'companyOfficers': [{'name': 'X', 'title': 'CFO'}, {'name': 'Y', 'title': titel}]}, 'd')
            self.assertEqual(r['ceo']['naam'], 'Y')
        r = m.management_uit_info({'companyOfficers': [{'name': 'X', 'title': 'CFO'}]}, 'd')
        self.assertIsNone(r['ceo'])

    def test_onzin_en_leeg(self):
        self.assertIsNone(m.management_uit_info(None, 'd'))
        self.assertIsNone(m.management_uit_info({}, 'd'))
        r = m.management_uit_info({'heldPercentInsiders': 1.7, 'heldPercentInstitutions': 0.5, 'auditRisk': 0,
                                   'boardRisk': 11, 'overallRisk': True, 'companyOfficers': [{'name': 'X', 'title': 'CEO', 'yearBorn': 1850}]}, 'd')
        self.assertIsNone(r['bezit_insiders_pct'])
        self.assertIsNone(r['governance'])
        self.assertNotIn('geboren', r['ceo'])


def rij(datum, tekst, n=100, wie='Doe Jane'):
    return {'Start Date': datum, 'Text': tekst, 'Shares': n, 'Insider': wie}


class InsiderTests(unittest.TestCase):
    def test_telt_alleen_aan_en_verkopen_in_12_maanden(self):
        rijen = [rij(datetime(2026, 9, 1), 'Purchase at price 10.50 per share.', 1000),
                 rij('2026-03-01', 'Purchase at price 9.10 per share.', 500, 'Roe John'),
                 rij(date(2026, 6, 2), 'Sale at price 227.20 - 229.88 per share.', 300),
                 rij('2026-05-01', 'Stock Award(Grant) at price 0.00 per share.', 9999),
                 rij('2026-05-01', 'Conversion of Exercise of derivative security', 9999),
                 rij('2024-01-01', 'Sale at price 100 per share.', 7777)]          # te oud
        r = m.insiders_uit_transacties(rijen, '2026-10-29')
        self.assertEqual((r['aankopen'], r['verkopen']), (2, 1))
        self.assertEqual((r['aandelen_gekocht'], r['aandelen_verkocht']), (1500, 300))
        self.assertEqual((r['personen_gekocht'], r['personen_verkocht']), (2, 1))
        self.assertEqual(r['tot'], '2026-10-29')
        self.assertTrue(r['van'].startswith('2025-10'))

    def test_britse_schrijfwijze(self):
        r = m.insiders_uit_transacties([rij('2026-09-01', 'Bought at price 5.73 per share', 50),
                                        rij('2026-09-02', 'Sold at price 6.00 per share', 20, 'X')], '2026-10-29')
        self.assertEqual((r['aankopen'], r['verkopen'], r['aandelen_gekocht']), (1, 1, 50))

    def test_dubbele_spaties_in_namen(self):
        r = m.management_uit_info({'companyOfficers': [{'name': 'Mr. John  Ternus', 'title': 'CEO  & Director'}]}, 'd')
        self.assertEqual(r['ceo'], {'naam': 'Mr. John Ternus', 'functie': 'CEO & Director'})

    def test_geen_gegevens_is_onbekend_niet_nul(self):
        self.assertIsNone(m.insiders_uit_transacties([], '2026-10-29'))
        self.assertIsNone(m.insiders_uit_transacties([{'Text': '', 'Start Date': None}], '2026-10-29'))

    def test_wel_gegevens_maar_niets_in_de_periode_is_nul(self):
        r = m.insiders_uit_transacties([rij('2020-01-01', 'Sale at price 1 per share.')], '2026-10-29')
        self.assertEqual((r['aankopen'], r['verkopen']), (0, 0))

    def test_pandas_timestamps(self):
        import pandas as pd
        r = m.insiders_uit_transacties([rij(pd.Timestamp('2026-08-01'), 'Purchase at price 1 per share.', float('nan'))], '2026-10-29')
        self.assertEqual((r['aankopen'], r['aandelen_gekocht']), (1, 0))


class LiveTests(unittest.TestCase):
    def test_management_komt_in_het_record_en_een_storing_breekt_niets(self):
        import apple_like_fixture as fx
        import bouw_webdata as bw
        from praktijkcontrole_sec_esef import summarize_sec
        data = fx.payload()

        def sec(t, e):
            return summarize_sec('AAPL', e, fetcher=fx.snapshot_fetcher(data), asof='2026-10-19')
        kw = dict(fetch_prijzen=lambda t: [], historie_ophalen=lambda t: ([], []), valuta_ophalen=lambda t: 'USD' if '.' not in t else 'EUR',
                  pauze=lambda: None, esef_ophalen=lambda t: None, yahoo_ophalen=lambda t: None, sec_samenvatting=sec,
                  diagnose=lambda t, e: {}, payload_ophalen=lambda t, e: None)
        rijen = [rij(date.today().isoformat(), 'Purchase at price 1 per share.', 10)]
        b = bw.live('a@b.nl', analisten_ophalen=lambda t: INFO if t == 'AAPL' else None,
                    insiders_ophalen=lambda t: rijen if t == 'AAPL' else [], **kw)
        recs = {r['ticker']: r for r in b['aandelen']}
        self.assertEqual(recs['AAPL']['management']['ceo']['naam'], 'Ms. Jane Doe')
        self.assertEqual(recs['AAPL']['management']['insiders']['aankopen'], 1)
        self.assertTrue(all('management' not in r for t, r in recs.items() if t != 'AAPL'))

        def kapot(t):
            raise RuntimeError('boem')
        b = bw.live('a@b.nl', analisten_ophalen=lambda t: INFO, insiders_ophalen=kapot, **kw)
        aapl = next(r for r in b['aandelen'] if r['ticker'] == 'AAPL')
        self.assertEqual(aapl['management']['ceo']['naam'], 'Ms. Jane Doe')   # storing bij insiders: de rest blijft
        self.assertNotIn('insiders', aapl['management'])


if __name__ == '__main__':
    unittest.main()
