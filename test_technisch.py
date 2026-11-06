"""Timing-kentallen (SMA200, 52-wekenrange, RSI14): informatief, bij te weinig data None."""
import random
import unittest
from datetime import date, timedelta

import bouw_webdata as bw


def reeks(n, start='2025-01-02', seed=7):
    rnd = random.Random(seed)
    d0, k, uit = date.fromisoformat(start), 100.37, []
    for i in range(n):
        k = round(max(5.0, k * (1 + rnd.uniform(-0.021, 0.0231))), 4)
        uit.append(((d0 + timedelta(days=i)).isoformat(), k))
    return uit


class TechnischTests(unittest.TestCase):
    def test_te_weinig_data_geeft_none(self):
        t = bw.technisch(reeks(60))
        self.assertEqual(t, {'sma200': None, 'hoog52': None, 'laag52': None, 'rsi14': None, 'macd': None,
                             'macd_signaal': None, 'mom6': None, 'kruis_dagen': None, 'kruis_minstens': None})

    def test_sma200_en_range(self):
        r = reeks(380)
        t = bw.technisch(r)
        self.assertAlmostEqual(t['sma200'], round(sum(p[1] for p in r[-200:]) / 200, 4))
        laatste = date.fromisoformat(r[-1][0])
        jaar = [p[1] for p in r if (laatste - date.fromisoformat(p[0])).days <= 365]
        self.assertEqual((t['hoog52'], t['laag52']), (max(jaar), min(jaar)))

    def test_range_vraagt_ongeveer_een_jaar_historie(self):
        t = bw.technisch(reeks(210))        # 210 dagen: wel SMA200, geen 52-wekenrange
        self.assertIsNotNone(t['sma200'])
        self.assertIsNone(t['hoog52'])

    def test_rsi_komt_overeen_met_onafhankelijke_berekening(self):
        import pandas as pd
        r = reeks(300)
        s = pd.Series([p[1] for p in r])
        d = s.diff()
        w = d.clip(lower=0).ewm(alpha=1 / 14, adjust=False).mean()
        v = (-d.clip(upper=0)).ewm(alpha=1 / 14, adjust=False).mean()
        # Wilder start met een gewoon gemiddelde van de eerste 14; de beginwaarde verdwijnt na 300 punten
        verwacht = 100 - 100 / (1 + w.iloc[-1] / v.iloc[-1])
        self.assertAlmostEqual(bw.technisch(r)['rsi14'], verwacht, delta=0.1)

    def test_rsi_uitersten(self):
        op = [((date(2025, 1, 1) + timedelta(days=i)).isoformat(), 10 + i * 0.37) for i in range(120)]
        neer = [((date(2025, 1, 1) + timedelta(days=i)).isoformat(), 200 - i * 0.37) for i in range(120)]
        self.assertEqual(bw.technisch(op)['rsi14'], 100.0)
        self.assertEqual(bw.technisch(neer)['rsi14'], 0.0)

    def test_koersblok_bevat_nieuwe_velden(self):
        blok = bw.koers_uit_reeks(reeks(380))
        for veld in ('sma200', 'hoog52', 'laag52', 'rsi14', 'macd', 'macd_signaal', 'mom6', 'kruis_dagen'):
            self.assertIn(veld, blok)


class KortetermijnTests(unittest.TestCase):
    def test_macd_komt_overeen_met_pandas(self):
        import pandas as pd
        r = reeks(400)
        s = pd.Series([p[1] for p in r])
        lijn = s.ewm(span=12, adjust=False).mean() - s.ewm(span=26, adjust=False).mean()
        sig = lijn.ewm(span=9, adjust=False).mean()
        t = bw.kortetermijn(r)
        # Andere beginwaarde (pandas start bij de eerste koers); na 400 punten is dat verschil weg.
        self.assertAlmostEqual(t['macd'], lijn.iloc[-1], delta=0.01)
        self.assertAlmostEqual(t['macd_signaal'], sig.iloc[-1], delta=0.01)

    def test_momentum_zes_maanden(self):
        r = reeks(300)
        self.assertEqual(bw.kortetermijn(r)['mom6'], round((r[-1][1] / r[-127][1] - 1) * 100, 1))
        self.assertIsNone(bw.kortetermijn(reeks(126))['mom6'])

    def test_kruis_dagen_telt_vanaf_de_omslag(self):
        d0 = date(2024, 1, 1)
        # 260 dagen dalend, daarna stijgend: het 50-daags gaat ergens boven het 200-daagse.
        k = [200 - i * 0.3 for i in range(260)] + [122 + i * 0.8 for i in range(140)]
        r = [((d0 + timedelta(days=i)).isoformat(), round(x, 4)) for i, x in enumerate(k)]
        t = bw.kortetermijn(r)
        sma = lambda j, n: sum(k[j - n + 1:j + 1]) / n
        boven = [sma(j, 50) > sma(j, 200) for j in range(199, len(k))]
        verwacht = len(boven) - 1 - max(j for j, b in enumerate(boven) if not b)
        self.assertTrue(boven[-1])
        self.assertEqual(t['kruis_dagen'], verwacht)
        self.assertFalse(t['kruis_minstens'])

    def test_kruis_zonder_omslag_is_minstens(self):
        op = [((date(2024, 1, 1) + timedelta(days=i)).isoformat(), 10 + i * 0.1) for i in range(320)]
        t = bw.kortetermijn(op)
        self.assertTrue(t['kruis_minstens'])
        self.assertGreater(t['kruis_dagen'], 100)
        self.assertGreater(t['macd'], t['macd_signaal'] - 1e-9)
        self.assertGreater(t['mom6'], 0)


if __name__ == '__main__':
    unittest.main()


class WeekreeksEnRelatieveSterkte(unittest.TestCase):
    def _reeks(self, start='2024-10-01', eind='2026-10-30', groei=0.0005, begin=100.0):
        import datetime
        d, e, p, uit = datetime.date.fromisoformat(start), datetime.date.fromisoformat(eind), begin, []
        while d < e:
            if d.weekday() < 5:
                p *= 1 + groei
                uit.append((d.isoformat(), p))
            d += datetime.timedelta(days=1)
        return uit

    def test_weekreeks_laatste_handelsdag_per_week_met_200_daags_gemiddelde(self):
        from bouw_webdata import weekreeks, koers_uit_reeks
        pts = self._reeks()
        w = weekreeks(pts)
        self.assertEqual(len(w['week']), 105)
        self.assertEqual(len(w['week200']), 105)
        self.assertEqual(w['week'][-1][0], pts[-1][0])                       # de laatste dag zit erin
        self.assertIsNone(w['week200'][0])                                   # eerste weken: nog geen 200 dagen
        self.assertAlmostEqual(w['week200'][-1], koers_uit_reeks(pts)['sma200'], places=1)
        self.assertEqual(weekreeks(pts[:20]), {})                            # te kort: niets

    def test_relatieve_sterkte_fonds_tegen_index(self):
        from bouw_webdata import relatieve_sterkte, index_voor
        fonds = self._reeks(groei=0.001)
        index = self._reeks(groei=0.0005)
        r = relatieve_sterkte(fonds, index, 'AEX')
        self.assertEqual(r['naam'], 'AEX')
        self.assertGreater(r['m12'], r['m6']); self.assertGreater(r['m6'], r['m3']); self.assertGreater(r['m3'], 0)
        self.assertLess(relatieve_sterkte(index, fonds, 'AEX')['m12'], 0)
        self.assertIsNone(relatieve_sterkte(fonds, [], 'AEX'))
        self.assertIsNone(relatieve_sterkte(fonds, index[:-30], 'AEX'))     # index niet bij: geen vergelijking
        self.assertEqual(index_voor('AAPL'), 'VS')


class Risico(unittest.TestCase):
    def test_terugval_grootste_daling_beweeglijkheid_en_beta(self):
        import datetime
        from bouw_webdata import risico
        d, pts, idx, p, q = datetime.date(2020, 1, 1), [], [], 100.0, 100.0
        i = 0
        while d < datetime.date(2026, 10, 30):
            if d.weekday() < 5:
                stap = 0.01 if i % 2 else -0.008                  # zigzag: beweeglijk
                if datetime.date(2022, 1, 1) <= d < datetime.date(2022, 7, 1):
                    stap -= 0.004                                 # een halfjaar daling
                p *= 1 + 2 * stap; q *= 1 + stap                   # fonds beweegt twee keer zo sterk als de index
                pts.append((d.isoformat(), p)); idx.append((d.isoformat(), q)); i += 1
            d += datetime.timedelta(days=1)
        r = risico(pts, idx)
        self.assertLess(r['max_daling'], -20)
        self.assertTrue('2022' in r['daling_tot'])
        self.assertLessEqual(r['onder_top'], 0)
        self.assertGreater(r['beweeglijk'], 10)
        self.assertAlmostEqual(r['beta'], 2.0, delta=0.15)
        self.assertIsNone(risico(pts[:50]))


class ModelGegevens(unittest.TestCase):
    def test_recent_dividend_en_splitsingen(self):
        import bouw_webdata as bw
        k = {}
        bw.recent_acties(k, [('2024-01-02', 0.5), ('2026-05-01', 0.6)], [('2026-06-01', 4.0), ('2026-07-01', 1.0)], '2026-11-03', dagen=400)
        self.assertEqual(k['dividenden'], [['2026-05-01', 0.6]])
        self.assertEqual(k['splitsingen'], [['2026-06-01', 4.0]])

    def test_index_standen(self):
        import bouw_webdata as bw
        u = bw.index_standen({'AEX': [('2026-10-30', 900.0), ('2026-11-02', 905.5)], 'DAX': []})
        self.assertEqual(u, {'AEX': {'datum': '2026-11-02', 'stand': 905.5, 'vorige': {'datum': '2026-10-30', 'stand': 900.0}}})

    def test_per_week(self):
        import bouw_webdata as bw
        self.assertEqual(bw.per_week([('2026-10-26', 1.0), ('2026-10-30', 2.0), ('2026-11-02', 3.0)]), [['2026-10-30', 2.0], ['2026-11-02', 3.0]])


class KoersenOverdag(unittest.TestCase):
    def test_alleen_koersblok_nieuwer_en_rest_blijft(self):
        import koersen_bijwerken as kb
        from datetime import date, timedelta, datetime, timezone
        d0 = date(2025, 1, 1)
        reeks = [((d0 + timedelta(days=i)).isoformat(), 100 + i * 0.1) for i in range(300)]
        best = {'aandelen': [{'ticker': 'AAPL', 'koers': {'datum': reeks[-2][0], 'slot': 1, 'bereik': {'x': 1}, 'dividenden': [['2025-02-01', 0.2]]}},
                             {'ticker': 'ASML.AS', 'koers': {'datum': '2030-01-01', 'slot': 5}}]}
        n = kb.bijwerken(best, {'AAPL': reeks, 'ASML.AS': reeks}, nu=datetime(2025, 10, 28, 17, 5, tzinfo=timezone.utc))
        self.assertEqual(n, 1)
        k = best['aandelen'][0]['koers']
        self.assertEqual(k['datum'], reeks[-1][0]); self.assertAlmostEqual(k['slot'], round(reeks[-1][1], 4))
        self.assertEqual(k['bereik'], {'x': 1}); self.assertEqual(k['dividenden'], [['2025-02-01', 0.2]])
        self.assertEqual(best['aandelen'][1]['koers']['slot'], 5, 'een oudere koers vervangt niets')
        self.assertTrue(best['koersen_bijgewerkt'].startswith('2025-10-28T17:05'))

    def test_koersdata_per_beurs(self):
        import koersen_bijwerken as kb
        best = {'aandelen': [{'ticker': 'AAPL', 'koers': {'datum': '2026-11-05'}}, {'ticker': 'ASML.AS', 'koers': {'datum': '2026-11-04'}},
                             {'ticker': 'INGA.AS', 'koers': {'datum': '2026-11-05'}}, {'ticker': 'X.PA'}]}
        self.assertEqual(kb.koersdata(best), 'AS 2026-11-05/2026-11-04 VS 2026-11-05')


class Fondsencontrole(unittest.TestCase):
    def test_naam_en_koers(self):
        import fondsen_controle as fc
        self.assertTrue(fc.naam_past('Sligro Food Group', 'Sligro Food Group N.V.'))
        self.assertTrue(fc.naam_past('ASML Holding', 'ASML Holding N.V.'))
        self.assertFalse(fc.naam_past('Galapagos', 'Lakefront Biotherapeutics NV'))
        info = {'GLPG.AS': {}, 'PNL.AS': {'longName': 'PostNL N.V.', 'quoteType': 'EQUITY'}, 'X.AS': {'longName': 'Iets Anders NV', 'quoteType': 'EQUITY'}}
        a = [{'ticker': 'GLPG.AS', 'naam': 'Galapagos', 'koers': {'datum': '2026-10-01'}}, {'ticker': 'PNL.AS', 'naam': 'PostNL', 'koers': {'datum': '2026-11-04'}},
             {'ticker': 'X.AS', 'naam': 'Voorbeeld', 'koers': {'datum': '2026-11-04'}}]
        m = fc.controle(a, '2026-11-05', lambda t: info[t])
        self.assertEqual([x[0] for x in m], ['GLPG.AS', 'GLPG.AS', 'X.AS'])
        self.assertIn('laatste koers van 2026-10-01', m[0][2]); self.assertIn('kent deze code niet', m[1][2]); self.assertIn('Iets Anders', m[2][2])
