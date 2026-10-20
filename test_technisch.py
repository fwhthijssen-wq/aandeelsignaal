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
        self.assertEqual(t, {'sma200': None, 'hoog52': None, 'laag52': None, 'rsi14': None})

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
        for veld in ('sma200', 'hoog52', 'laag52', 'rsi14'):
            self.assertIn(veld, blok)


if __name__ == '__main__':
    unittest.main()
