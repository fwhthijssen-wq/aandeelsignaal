import unittest
from datetime import date

import bouw_webdata as bw
import yahoo_jaren as yj


def ruw(jaren=5, eps=None, splits=None, ni=None, valuta='EUR', bank=False):
    einden = [f'{2021 + i}-12-31' for i in range(jaren)]
    ni = ni or [100.5 + 10 * i for i in range(jaren)]
    eps = eps or [2.01 + 0.2 * i for i in range(jaren)]
    p = {'TotalRevenue': {e: 1000.5 + 50 * i for i, e in enumerate(einden)},
         'NetIncomeCommonStockholders': {e: ni[i] for i, e in enumerate(einden)},
         'DilutedEPS': {e: eps[i] for i, e in enumerate(einden)},
         'CapitalExpenditure': {e: -30.5 for e in einden}, 'CashDividendsPaid': {e: -12.5 for e in einden},
         'OperatingCashFlow': {e: 140.5 for e in einden}, 'StockholdersEquity': {e: 700.5 for e in einden}}
    return {'posten': p, 'valuta': valuta, 'bank': bank, 'splits': splits or []}


class YahooJaren(unittest.TestCase):
    def test_jaarregels_met_tekens_en_boekjaar(self):
        j = yj.jaren_uit_yahoo(ruw())
        self.assertEqual([x['year'] for x in j], [2021, 2022, 2023, 2024, 2025])
        self.assertEqual(j[0]['capex'], 30.5)                        # uitgaven positief
        self.assertEqual(j[0]['dividends_paid'], 12.5)
        self.assertEqual(j[0]['sales'], 1000.5)
        self.assertIsNone(j[0]['gross_profit'])                      # niet geleverd: leeg, nooit geschat
        self.assertEqual(j[0]['comparable_eps'], j[0]['reported_eps'])

    def test_jaar_zonder_omzet_of_winst_telt_niet(self):
        r = ruw()
        del r['posten']['TotalRevenue']['2023-12-31']
        self.assertEqual([x['year'] for x in yj.jaren_uit_yahoo(r)], [2021, 2022, 2024, 2025])

    def test_splitsing_maakt_eps_ervoor_onbetrouwbaar(self):
        j = yj.jaren_uit_yahoo(ruw(splits=[('2023-06-01', 4.0)]))
        self.assertEqual([x['comparable_eps'] is None for x in j], [True, True, False, False, False])    # jaren die vóór de splitsing eindigden
        j = yj.jaren_uit_yahoo(ruw(splits=[('2026-03-01', 2.0)]))                                    # splitsing na het laatste boekjaar
        self.assertTrue(all(x['comparable_eps'] is None for x in j))

    def test_eps_sprong_die_niet_bij_de_winst_past_verwijdert_oudere_jaren(self):
        j = yj.jaren_uit_yahoo(ruw(eps=[8.0, 8.4, 2.2, 2.4, 2.6]))                                   # niet gecorrigeerde splitsing 4:1
        self.assertEqual([x['comparable_eps'] is None for x in j], [True, True, False, False, False])
        j = yj.jaren_uit_yahoo(ruw())
        self.assertTrue(all(x['comparable_eps'] is not None for x in j))

    def test_gegevensblok_indicatief_zonder_label(self):
        g = yj.gegevens_uit_yahoo(ruw(bank=True), '2026-10-21')
        self.assertEqual(g['niveau'], 'indicatief'); self.assertEqual(g['bron'], 'Yahoo Finance')
        self.assertIsNone(g['eps_status']); self.assertEqual(g['eps_verified_years'], 0)
        self.assertEqual(g['currencies'], ['EUR']); self.assertEqual(g['rejected_sources'], 0)
        self.assertTrue(any(w.startswith('Bank:') for w in g['waarschuwingen']))
        self.assertIsNone(yj.gegevens_uit_yahoo(ruw(valuta=None), '2026-10-21')['currencies'])      # valuta onbekend: geen K/W
        for slecht in (None, ruw(jaren=3)):
            self.assertTrue(yj.gegevens_uit_yahoo(slecht, '2026-10-21')['fout'])

    def test_vergelijking_met_officiele_cijfers(self):
        y = yj.jaren_uit_yahoo(ruw())
        off = [dict(x, sales=x['sales'] * (1.02 if x['year'] == 2022 else 1), net_income=x['net_income'] * 2 if x['year'] == 2023 else x['net_income']) for x in y]
        v = yj.vergelijk(y, off)
        self.assertEqual(v['sales'], {'vergeleken': 5, 'binnen_1pct': 4, 'binnen_5pct': 5})
        self.assertEqual(v['net_income']['binnen_5pct'], 4)
        tot = yj.samenvoegen(yj.samenvoegen({}, v), v)
        self.assertEqual(tot['sales']['vergeleken'], 10)

    def test_frame_naar_dict(self):
        import pandas as pd
        f = pd.DataFrame({pd.Timestamp('2025-12-31'): [5.5, float('nan')], pd.Timestamp('2024-12-31'): [4.5, 1.0]}, index=['TotalRevenue', 'GrossProfit'])
        d = yj.frame_naar_dict(f)
        self.assertEqual(d['TotalRevenue'], {'2025-12-31': 5.5, '2024-12-31': 4.5})
        self.assertEqual(d['GrossProfit'], {'2024-12-31': 1.0})

    def test_live_gebruikt_yahoo_alleen_zonder_officiele_bron_en_vergelijkt_een_steekproef(self):
        aanroepen = []

        def yahoo(t):
            aanroepen.append(t)
            return ruw()
        kw = dict(fetch_prijzen=lambda t: [], historie_ophalen=lambda t: ([], []), valuta_ophalen=lambda t: None, pauze=lambda: None, esef_ophalen=lambda t: None,
                  sec_samenvatting=lambda t, e: {'status': 'geen'}, diagnose=lambda t, e: {}, payload_ophalen=lambda t, e: None, yahoo_ophalen=yahoo)
        b = bw.live('a@b.nl', **kw)
        bmw = next(r for r in b['aandelen'] if r['ticker'] == 'ADS.DE')     # zonder winst per aandeel uit pdf-jaarverslagen
        self.assertEqual(bmw['gegevens']['niveau'], 'indicatief')
        self.assertIsNone(bmw['gegevens']['eps_status'])
        self.assertEqual(len(bmw['gegevens']['jaren']), 5)
        self.assertEqual(b['yahoo_vergelijk']['bedrijven'], 0)                                       # niemand had officiële cijfers
        st = bw.maak_status(b)
        self.assertIn('yahoo_vergelijk', st)

    def test_yahoo_storing_geeft_geen_gegevens_maar_ook_geen_crash(self):
        def kapot(t):
            raise OSError('429')
        kw = dict(fetch_prijzen=lambda t: [], historie_ophalen=lambda t: ([], []), valuta_ophalen=lambda t: None, pauze=lambda: None, esef_ophalen=lambda t: None,
                  sec_samenvatting=lambda t, e: {'status': 'geen'}, diagnose=lambda t, e: {}, payload_ophalen=lambda t, e: None, yahoo_ophalen=kapot)
        b = bw.live('a@b.nl', **kw)
        r = b['aandelen'][0]['gegevens']
        self.assertTrue(r['fout']); self.assertIn('429', r.get('yahoo_fout', ''))


if __name__ == '__main__':
    unittest.main()


class TestValutaZonderInfo(unittest.TestCase):
    """MTU, november 2026: Yahoo weigerde get_info (401 'Invalid Crumb'); de cijfers kwamen zonder valuta en het NAIC-oordeel verdween."""

    def test_valuta_uit_vorige_run_of_aangeleverd(self):
        from bouw_webdata import yahoo_info_van_vorige
        ruw = {'posten': {}, 'valuta': None, 'bank': False, 'splits': []}
        oud = {'currencies': ['EUR'], 'waarschuwingen': ['Bank: kengetallen zoals schuld en kasstroom zeggen bij banken weinig.']}
        uit = yahoo_info_van_vorige(ruw, oud)
        self.assertEqual((uit['valuta'], uit['bank'], uit['valuta_bron']), ('EUR', True, 'vorige run'))
        uit = yahoo_info_van_vorige(ruw, {'currencies': None, 'jaren': [{'currency': None}]}, {'EUR'})
        self.assertEqual((uit['valuta'], uit['valuta_bron']), ('EUR', 'aangeleverde cijfers'))
        self.assertIsNone(yahoo_info_van_vorige(ruw, None, {'EUR', 'USD'})['valuta'])     # twijfel: geen gok
        self.assertEqual(yahoo_info_van_vorige(dict(ruw, valuta='USD'), oud)['valuta'], 'USD')   # Yahoo gaat voor

    def test_waarschuwing_in_gegevens(self):
        from yahoo_jaren import gegevens_uit_yahoo
        import yahoo_jaren
        ruw = {'posten': {}, 'valuta': 'EUR', 'valuta_bron': 'vorige run', 'bank': False, 'splits': []}
        jaren = [{'year': 2016 + i, 'end': f'{2016 + i}-12-31', 'currency': 'EUR', 'comparable_eps': 1.0} for i in range(8)]
        oud = yahoo_jaren.jaren_uit_yahoo
        yahoo_jaren.jaren_uit_yahoo = lambda r: jaren
        try:
            g = gegevens_uit_yahoo(ruw, '2026-11-17')
        finally:
            yahoo_jaren.jaren_uit_yahoo = oud
        self.assertEqual(g['currencies'], ['EUR'])
        self.assertTrue(any('valuta van de cijfers niet door' in w for w in g['waarschuwingen']))
