"""Winst per aandeel over ESEF-jaarverslagen heen: tagfouten, bonusaandelen en herzieningen, met het aantal aandelen als ijkpunt."""
import unittest
import esef_bron as e


def feit(accn, jaar, val):
    return {'accn': accn, 'end': f'{jaar}-12-31', 'start': f'{jaar}-01-01', 'val': val, 'form': '20-F', 'fp': 'FY'}


def cf(rapporten):
    """rapporten: [(accn, periode_einde, {jaar: (eps, winst, aandelen)})], nieuwste eerst of niet: volgorde via periode_einde."""
    f = {'DilutedEarningsLossPerShare': {'units': {'EUR/shares': []}}, 'ProfitLossAttributableToOwnersOfParent': {'units': {'EUR': []}},
         'AdjustedWeightedAverageShares': {'units': {'shares': []}}}
    for accn, _, jaren in rapporten:
        for j, (eps, w, n) in jaren.items():
            f['DilutedEarningsLossPerShare']['units']['EUR/shares'].append(feit(accn, j, eps))
            if w is not None:
                f['ProfitLossAttributableToOwnersOfParent']['units']['EUR'].append(feit(accn, j, w))
            if n is not None:
                f['AdjustedWeightedAverageShares']['units']['shares'].append(feit(accn, j, n))
    return {'facts': {'ifrs-full': f}, 'rapporten': [{'fxo_id': a, 'period_end': p} for a, p, _ in rapporten]}


M = 1e6


class EpsKeten(unittest.TestCase):
    def test_tagfout_macht_van_tien_hersteld_met_aantal_aandelen(self):
        c = cf([('R25', '2025-12-31', {2025: (2130.0, 280 * M, 131.5 * M), 2024: (2340.0, 308 * M, 131.6 * M)}),
                ('R24', '2024-12-31', {2024: (2.34, 308 * M, 131.6 * M), 2023: (2.07, 272 * M, 131.4 * M)})])
        log = []
        k = e.eps_keten(c, min_jaren=1, verslag=log)
        self.assertEqual(k['2025-12-31'], 2.13); self.assertEqual(k['2024-12-31'], 2.34); self.assertEqual(k['2023-12-31'], 2.07)
        self.assertTrue(any('tagfout' in x for x in log))

    def test_bonusaandelen_bevestigd_door_winst_en_aandelen(self):
        # 1 bonusaandeel op 10: het nieuwe rapport herrekent 2023 van 5,87 naar 5,33 bij gelijke winst
        c = cf([('R24', '2024-12-31', {2024: (5.72, 3306 * M, 578 * M), 2023: (5.33, 3078 * M, 577.5 * M)}),
                ('R23', '2023-12-31', {2023: (5.87, 3078 * M, None), 2022: (5.27, 2759 * M, 524 * M)})])
        log = []
        k = e.eps_keten(c, min_jaren=1, verslag=log)
        self.assertAlmostEqual(k['2022-12-31'], 5.27 * 5.33 / 5.87, places=4)
        self.assertTrue(any('bonusaandelen' in x for x in log))

    def test_onbevestigd_verschil_stopt_de_keten(self):
        # winst gelijk maar het aantal aandelen past niet bij de nieuwe winst per aandeel (bijv. alleen voortgezette activiteiten)
        c = cf([('R25', '2025-12-31', {2025: (0.84, 5600 * M, 6400 * M), 2024: (0.589, 5600 * M, 6400 * M)}),
                ('R24', '2024-12-31', {2024: (0.838, 5600 * M, 6400 * M), 2023: (0.75, 4800 * M, 6400 * M)})])
        k = e.eps_keten(c, min_jaren=1)
        self.assertNotIn('2023-12-31', k)

    def test_kleine_herziening_nieuwste_telt(self):
        c = cf([('R25', '2025-12-31', {2025: (1.51, 3600 * M, 2400 * M), 2024: (1.65, 3960 * M, 2400 * M)}),
                ('R24', '2024-12-31', {2024: (1.62, 3900 * M, 2400 * M), 2023: (0.88, 2100 * M, 2400 * M)}),
                ('R23', '2023-12-31', {2023: (0.88, 2100 * M, 2400 * M), 2022: (0.06, 150 * M, 2400 * M)})])
        k = e.eps_keten(c)
        self.assertEqual(k['2024-12-31'], 1.65); self.assertEqual(len(k), 4)

    def test_minteken_volgt_de_winst(self):
        c = cf([('R25', '2025-12-31', {2025: (17.17, 7200 * M, 419 * M), 2024: (-1.6, -670 * M, 418 * M)}),
                ('R24', '2024-12-31', {2024: (-1.6, -670 * M, 418 * M), 2023: (-8.07, 3380 * M, 418 * M)})])
        k = e.eps_keten(c, min_jaren=1)
        self.assertEqual(k['2023-12-31'], 8.07); self.assertEqual(k['2025-12-31'], 17.17)

    def test_minder_dan_vier_jaar_geeft_niets(self):
        c = cf([('R25', '2025-12-31', {2025: (1.0, 100 * M, 100 * M), 2024: (0.9, 90 * M, 100 * M)})])
        self.assertEqual(e.eps_keten(c), {})


if __name__ == '__main__':
    unittest.main()
