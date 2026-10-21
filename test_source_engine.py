import unittest
from source_engine import choose_fact, classify_period, cik_for_ticker, sec_snapshot


class EngineTests(unittest.TestCase):
    def test_periods(self):
        self.assertEqual(classify_period({'start':'2025-09-28','end':'2026-06-27'}), 'negen maanden cumulatief')
        self.assertEqual(classify_period({'start':'2026-03-29','end':'2026-06-27'}), 'kwartaal')

    def test_ticker_lookup(self):
        self.assertEqual(cik_for_ticker('AAPL', {'0':{'ticker':'AAPL','cik_str':320193,'title':'Apple'}})[0], 320193)

    def test_fallback_tag_over_old_data(self):
        payload={'facts':{'us-gaap':{
            'Revenues':{'units':{'USD':[{'start':'2017-10-01','end':'2018-09-29','filed':'2018-11-05','form':'10-K','val':20}]}},
            'RevenueFromContractWithCustomerExcludingAssessedTax':{'units':{'USD':[{'start':'2025-09-28','end':'2026-06-27','filed':'2026-07-31','form':'10-Q','val':30}]}}}}}
        chosen=choose_fact(payload, ('Revenues','RevenueFromContractWithCustomerExcludingAssessedTax'),'2026-10-16')
        self.assertEqual(chosen['val'],30)

    def test_future_filing_excluded(self):
        payload={'facts':{'us-gaap':{'Revenues':{'units':{'USD':[
            {'end':'2026-09-30','filed':'2026-11-01','form':'10-K','val':50},
            {'end':'2026-06-30','filed':'2026-08-01','form':'10-Q','val':40}]}}}}}
        self.assertEqual(choose_fact(payload,('Revenues',),'2026-10-16')['val'],40)

    def test_unsupported_ticker(self):
        def fetcher(url,email):
            return {'0':{'ticker':'AAPL','cik_str':320193,'title':'Apple'}}
        self.assertFalse(sec_snapshot('ASML.AS','2026-10-16','a@b.com',fetcher)['supported'])

if __name__=='__main__':
    unittest.main()


class VoorgangerCik(unittest.TestCase):
    def test_xom_gebruikt_de_registrant_met_de_jaarverslagen(self):
        from source_engine import cik_for_ticker
        lijst = {'0': {'ticker': 'XOM', 'cik_str': 2115436, 'title': 'ExxonMobil Holdings Corp'}}
        self.assertEqual(cik_for_ticker('XOM', lijst), (34088, 'Exxon Mobil Corp'))
        self.assertEqual(cik_for_ticker('AAPL', {'0': {'ticker': 'AAPL', 'cik_str': 320193, 'title': 'Apple'}}), (320193, 'Apple'))
