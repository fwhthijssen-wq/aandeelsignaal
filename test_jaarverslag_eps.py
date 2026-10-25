"""Winst per aandeel uit pdf-jaarverslagen bij fondsen met alleen Yahoo-cijfers; de keten van hulp/de_eps.py."""
import sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / 'hulp'))
import bouw_webdata as bw
import de_eps


class VulEps(unittest.TestCase):
    def test_vervangt_en_vult_aan(self):
        g = {'jaren': [{'year': y, 'end': f'{y}-12-31', 'currency': 'EUR', 'comparable_eps': 9.9, 'sales': 1.0} for y in (2022, 2023, 2024, 2025)]}
        reg = {'BAS.DE': {'reeks': {'2019': 9.15, '2020': -1.15, '2021': 6.0, '2022': -0.7, '2023': 0.25, '2024': 1.45, '2025': 1.81},
                          'verslagen': {'2025': {'url': 'https://x/2025.pdf', 'pagina': 301}}}}
        bw.vul_eps_jaarverslag(g, 'BAS.DE', register=reg)
        self.assertEqual([j['year'] for j in g['jaren']], [2019, 2020, 2021, 2022, 2023, 2024, 2025])
        self.assertEqual(g['jaren'][3]['comparable_eps'], -0.7); self.assertEqual(g['jaren'][3]['sales'], 1.0)
        self.assertTrue(all(j['eps_bron'] == 'jaarverslag' for j in g['jaren']))
        self.assertEqual(g['jaren'][0]['end'], '2019-12-31'); self.assertNotIn('sales', g['jaren'][0])
        self.assertEqual(g['eps_jaarverslag']['jaren'], 7)

    def test_te_weinig_jaren_doet_niets(self):
        g = {'jaren': [{'year': 2025, 'end': '2025-12-31', 'comparable_eps': 1.0}]}
        bw.vul_eps_jaarverslag(g, 'X', register={'X': {'reeks': {'2024': 1.0, '2025': 1.1}}})
        self.assertEqual(len(g['jaren']), 1); self.assertNotIn('eps_jaarverslag', g)


class Keten(unittest.TestCase):
    def test_overlap_klopt_herziening_en_breuk(self):
        per = {2025: {'eps': 1.81, 'vorig_jaar': 2024, 'eps_vorig': 1.45}, 2024: {'eps': 1.45, 'vorig_jaar': 2023, 'eps_vorig': 0.25},
               2023: {'eps': 0.26, 'vorig_jaar': 2022, 'eps_vorig': -0.7}, 2022: {'eps': -2.0, 'vorig_jaar': 2021, 'eps_vorig': 6.0}}
        reeks, log = de_eps.keten(per)
        self.assertEqual(reeks, {2022: -0.7, 2023: 0.25, 2024: 1.45, 2025: 1.81})
        self.assertTrue(any('verschil' in x for x in log))

    def test_lezing_kiezen_die_aansluit(self):
        per = {2019: {'eps': 18.83, 'vorig_jaar': 2018, 'eps_vorig': 17.3},
               2018: {'eps': None, 'alternatieven': [(15.23, 17.3, 2017), (17.3, 15.23, 2017)]}}
        reeks, _ = de_eps.keten(per)
        self.assertEqual(reeks[2017], 15.23)

    def test_twee_kolommen_en_toelichting(self):
        self.assertEqual(de_eps.twee([8.5, 21.18, 15.48]), (21.18, 15.48))
        self.assertEqual(de_eps.twee([22.59, 16.87, 5.72]), (22.59, 16.87))
        self.assertEqual(de_eps.twee([5.11, 6.61, 6.61]), (5.11, 6.61))
        # toelichting 11 voor waarden met .60 (Volkswagen 2020): alleen te herkennen aan de schrijfwijze in de tekst
        self.assertEqual(de_eps.twee([11.0, 16.6, 26.6], heel=True), (16.6, 26.6))

    def test_nieuwste_verslag_kiest_lezing_via_ouder_verslag(self):
        # Continental 2025: twee lezingen; de goede is die waarvan 2024 gelijk is aan het eigen cijfer in het verslag van 2024
        per = {2025: {'jaar': 2025, 'eps': None, 'alternatieven': [(-0.83, 5.84, 2024), (99.5, 97.9, 2024)]},
               2024: {'jaar': 2024, 'eps': 5.84, 'vorig_jaar': 2023, 'eps_vorig': 5.78}}
        reeks, log = de_eps.keten(per)
        self.assertEqual(reeks, {2023: 5.78, 2024: 5.84, 2025: -0.83})
        self.assertTrue(any('oudere verslag' in x for x in log))

    def test_meerjarenoverzicht_overbrugt_ontbrekend_verslag(self):
        # Merck: verslagen 2022 en 2023 ontbreken; het overzicht in 2025 toont 2021-2025, zodat 2021 weer aansluit
        per = {2025: {'jaar': 2025, 'eps': 6.0, 'vorig_jaar': 2024, 'eps_vorig': 6.39, 'meerjaren': {2021: 7.03, 2022: 7.65, 2023: 6.49}},
               2021: {'jaar': 2021, 'eps': 7.03, 'vorig_jaar': 2020, 'eps_vorig': 4.57}}
        reeks, _ = de_eps.keten(per)
        self.assertEqual(reeks, {2020: 4.57, 2021: 7.03, 2022: 7.65, 2023: 6.49, 2024: 6.39, 2025: 6.0})

    def test_meerjarenregel_uitlezen(self):
        r = ['Key figures            2017     2018     2019     2020     2021'] + [''] * 3 + ['Earnings per share in €      4.62     5.76     5.50   -10.78     8.91']
        regels = [(1, x) for x in r]
        self.assertEqual(de_eps.jaarrij(regels, 4, 5), [2017, 2018, 2019, 2020, 2021])
        self.assertIsNone(de_eps.jaarrij(regels, 4, 4))


class NachtelijkeRun(unittest.TestCase):
    """Fondsen zonder officiële bron: Yahoo wordt elke nacht opnieuw geprobeerd (niet stil de vorige run hergebruiken),
    en de winst per aandeel uit de jaarverslagen wordt ook op hergebruikte cijfers toegepast."""
    def test_yahoo_opnieuw_en_jaarverslag_ook_bij_uitval(self):
        oud = {'bron': 'Yahoo Finance', 'niveau': 'indicatief', 'fout': None, 'gecontroleerd_op': '2026-10-20',
               'jaren': [{'year': y, 'end': f'{y}-12-31', 'currency': 'EUR', 'comparable_eps': 1.0, 'sales': 1e9} for y in range(2022, 2026)]}
        gevraagd = []

        def yahoo(t):
            gevraagd.append(t)
            raise TimeoutError('Yahoo onbereikbaar')
        kw = dict(fetch_prijzen=lambda t: [], historie_ophalen=lambda t: ([], []), valuta_ophalen=lambda t: 'USD' if '.' not in t else 'EUR',
                  pauze=lambda: None, esef_ophalen=lambda t: None, diagnose=lambda t, e: {}, payload_ophalen=lambda t, e: None,
                  sec_samenvatting=lambda t, e: {'status': 'error', 'message': 'test'}, analisten_ophalen=lambda t: None)
        nu = bw.live('a@b.nl', vorige={'BAS.DE': oud}, yahoo_ophalen=yahoo, **kw)
        self.assertIn('BAS.DE', gevraagd)
        g = next(a for a in nu['aandelen'] if a['ticker'] == 'BAS.DE')['gegevens']
        self.assertTrue(g.get('uit_vorige_run'))
        self.assertGreaterEqual(g['eps_jaarverslag']['jaren'], 10)
        self.assertEqual(g['jaren'][0]['eps_bron'], 'jaarverslag')
        self.assertEqual(oud['jaren'][0]['comparable_eps'], 1.0)        # vorige run niet aangepast


if __name__ == '__main__':
    unittest.main()
