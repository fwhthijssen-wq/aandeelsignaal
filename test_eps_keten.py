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


class WinstZonderAandelen(unittest.TestCase):
    """Beta.77: geen bruikbaar aantal aandelen, wel dezelfde winst in beide rapporten."""
    def test_schaalfout_met_gelijke_winst_wordt_omgerekend(self):
        # AB InBev 2024: winst per aandeel als 286 en 260 (centen) getagd; het rapport erna: 2,86 bij dezelfde winst
        c = cf([('R25', '2025-12-31', {2025: (3.39, 6800 * M, None), 2024: (2.86, 5800 * M, None)}),
                ('R24', '2024-12-31', {2024: (286.0, 5800 * M, None), 2023: (260.0, 5300 * M, None)})])
        log = []
        k = e.eps_keten(c, min_jaren=1, verslag=log)
        self.assertAlmostEqual(k['2023-12-31'], 2.6, places=4)
        self.assertTrue(any('zelfde winst' in x for x in log))

    def test_willekeurige_factor_bij_gelijke_winst_stopt(self):
        # Iberdrola-achtig: 0,589 tegen 0,838 bij dezelfde winst is geen bonus of splitsing maar een ander begrip
        c = cf([('R25', '2025-12-31', {2025: (0.843, 5800 * M, None), 2024: (0.589, 5600 * M, None)}),
                ('R24', '2024-12-31', {2024: (0.838, 5600 * M, None), 2023: (0.75, 4800 * M, None)})])
        k = e.eps_keten(c, min_jaren=1)
        self.assertNotIn('2023-12-31', k)

    def test_zuivere_factoren(self):
        self.assertTrue(e._zuivere_factor(1 / 1.1)); self.assertTrue(e._zuivere_factor(0.01)); self.assertTrue(e._zuivere_factor(2))
        self.assertFalse(e._zuivere_factor(0.6625)); self.assertFalse(e._zuivere_factor(1.03))


class BrugNaOmrekening(unittest.TestCase):
    def test_brug_neemt_eerdere_omrekening_over(self):
        # 2024: bonus 1 op 10 (2023 herrekend); rapport over 2022 ontbreekt; rapport over 2021 sluit via de brug aan.
        c = cf([('R24', '2024-12-31', {2024: (5.72, 3306 * M, 578 * M), 2023: (5.33, 3078 * M, 577.5 * M)}),
                ('R23', '2023-12-31', {2023: (5.87, 3078 * M, 524.4 * M), 2022: (5.27, 2759 * M, 523.5 * M)}),
                ('R21', '2021-12-31', {2021: (5.42, 2572 * M, 474.5 * M), 2020: (5.14, 2435 * M, 473.7 * M)})])
        log = []
        k = e.eps_keten(c, min_jaren=1, verslag=log)
        self.assertNotIn('2020-12-31', k)            # 2021 → 2022: aantal aandelen 10% hoger (bonus 2022 niet bewezen): geen brug
        c2 = cf([('R24', '2024-12-31', {2024: (5.72, 3306 * M, 578 * M), 2023: (5.33, 3078 * M, 577.5 * M)}),
                 ('R23', '2023-12-31', {2023: (5.87, 3078 * M, 524.4 * M), 2022: (5.27, 2759 * M, 523.5 * M)}),
                 ('R21', '2021-12-31', {2021: (4.92, 2572 * M, 522.8 * M), 2020: (4.67, 2435 * M, 521 * M)})])
        log = []
        k = e.eps_keten(c2, min_jaren=1, verslag=log)
        self.assertAlmostEqual(k['2021-12-31'], 4.92 * 5.33 / 5.87, places=3)      # de bonus van 2024 geldt ook voor 2021
        self.assertTrue(any('overgenomen' in x for x in log))


if __name__ == '__main__':
    unittest.main()


class Brug(unittest.TestCase):
    def test_brug_over_ontbrekend_rapport_bij_gelijk_aantal_aandelen(self):
        c = cf([('R25', '2025-12-31', {2025: (1.31, 131 * M, 100 * M), 2024: (1.25, 125 * M, 100 * M)}),
                ('R22', '2022-12-31', {2022: (1.02, 103 * M, 101 * M), 2021: (0.92, 93 * M, 101 * M)})])
        # gat: rapport 2023 ontbreekt, maar 2023 staat niet in R25 -> geen aansluiting op één jaar
        self.assertNotIn('2022-12-31', e.eps_keten(c, min_jaren=1))
        c = cf([('R24', '2024-12-31', {2024: (1.25, 125 * M, 100 * M), 2023: (1.1, 110 * M, 100 * M)}),
                ('R22', '2022-12-31', {2022: (1.02, 103 * M, 101 * M), 2021: (0.92, 93 * M, 101 * M)})])
        log = []
        k = e.eps_keten(c, min_jaren=1, verslag=log)
        self.assertEqual(k['2021-12-31'], 0.92); self.assertTrue(any('brug' in x for x in log))

    def test_brug_rekent_splitsing_om_en_weigert_onduidelijke_factor(self):
        # 1 op 10 samengevoegd: toen 10x zoveel aandelen
        c = cf([('R24', '2024-12-31', {2024: (3.6, 934 * M, 259 * M), 2023: (2.9, 750 * M, 258 * M)}),
                ('R22', '2022-12-31', {2022: (0.28, 728 * M, 2600 * M), 2021: (-1.0, -2600 * M, 2600 * M)})])
        k = e.eps_keten(c, min_jaren=1)
        self.assertAlmostEqual(k['2022-12-31'], 2.8, places=4)
        c2 = cf([('R24', '2024-12-31', {2024: (3.6, 934 * M, 259 * M), 2023: (2.9, 750 * M, 258 * M)}),
                 ('R22', '2022-12-31', {2022: (2.0, 600 * M, 300 * M), 2021: (1.9, 570 * M, 300 * M)})])
        self.assertNotIn('2022-12-31', e.eps_keten(c2, min_jaren=1))
