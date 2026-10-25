"""Tests voor cijfers uit officiële jaarverslagen die niet machineleesbaar zijn (jaarverslag_bronnen.json)."""
import unittest

import jaarverslag_bronnen as jb


def register(waarde=1281_000_000, accn='X:jaarverslag-2017'):
    return {'TEST.AS': {'documenten': [{
        'document': 'jv.pdf', 'soort': 'pdf', 'kenmerk': accn, 'ingediend': '2018-02-27',
        'feiten': [{'concept': 'ifrs-full:AdjustedWeightedAverageShares', 'start': '2017-01-02', 'eind': '2017-12-31',
                    'waarde': waarde, 'eenheid': 'shares', 'bewijs': 'p.194'}]}]}}


class Bronnen(unittest.TestCase):
    def test_aanvullen(self):
        cf, v = jb.aanvullen({'facts': {}}, 'TEST.AS', register())
        rij = cf['facts']['ifrs-full']['AdjustedWeightedAverageShares']['units']['shares'][0]
        self.assertEqual((rij['val'], rij['accn'], rij['form'], rij['filed']), (1281_000_000, 'X:jaarverslag-2017', '20-F', '2018-02-27'))
        self.assertEqual(v['toegevoegd'], 1)
        self.assertEqual(cf['rapporten'][0]['fxo_id'], 'X:jaarverslag-2017')

    def test_officieel_feit_gaat_voor_en_conflict_wijst_document_af(self):
        getagd = {'facts': {'ifrs-full': {'AdjustedWeightedAverageShares': {'units': {'shares': [
            {'start': '2017-01-02', 'end': '2017-12-31', 'val': 1281_000_000, 'accn': 'X:jaarverslag-2017', 'form': '20-F', 'filed': '2018-02-27'}]}}}}}
        cf, v = jb.aanvullen(getagd, 'TEST.AS', register())
        self.assertEqual(len(cf['facts']['ifrs-full']['AdjustedWeightedAverageShares']['units']['shares']), 1)
        self.assertEqual(v['toegevoegd'], 0)
        cf, v = jb.aanvullen(getagd, 'TEST.AS', register(waarde=1300_000_000))
        self.assertEqual(len(v['afgewezen']), 1)

    def test_afgerond_getagd_feit_is_geen_conflict(self):
        getagd = {'facts': {'ifrs-full': {'AdjustedWeightedAverageShares': {'units': {'shares': [
            {'start': '2017-01-02', 'end': '2017-12-31', 'val': 127_626_000, 'accn': 'X:jaarverslag-2017', 'form': '20-F', 'filed': '2018-02-27'}]}}}}}
        cf, v = jb.aanvullen(getagd, 'TEST.AS', register(waarde=127_626_399))
        self.assertEqual((v['afgewezen'], v['toegevoegd']), ([], 0))
        cf, v = jb.aanvullen(getagd, 'TEST.AS', register(waarde=127_627_399))
        self.assertEqual(len(v['afgewezen']), 1)

    def test_onbekend_bedrijf_ongewijzigd(self):
        cf = {'facts': {}}
        self.assertIs(jb.aanvullen(cf, 'ANDER.AS', register())[0], cf)

    def test_origineel_niet_aangepast(self):
        cf = {'facts': {}}
        jb.aanvullen(cf, 'TEST.AS', register())
        self.assertEqual(cf, {'facts': {}})

    def test_register_in_repo_is_geldig(self):
        reg = jb.laad()
        self.assertIn('AD.AS', reg)
        for doc in reg['AD.AS']['documenten']:
            self.assertTrue(doc['kenmerk'] and doc['ingediend'] and doc['url'].startswith('https://'))
            for f in doc['feiten']:
                self.assertTrue(f['bewijs'])


class Ahold(unittest.TestCase):
    def test_ahold_delhaize_negen_jaar_bevestigd(self):
        import bouw_webdata as bw
        g = bw.gegevens_uit_esef(bw.esef_ophalen('AD.AS'), '2026-10-22')
        self.assertEqual(g['eps_status'], 'independently_verified')
        self.assertEqual(g['eps_verified_years'], 9)
        eps = {j['year']: j['comparable_eps'] for j in g['jaren']}
        self.assertEqual((eps[2017], eps[2019], eps[2025]), (1.43, 1.59, 2.5))
        self.assertIsNone(eps[2016])            # vóór de fusie-sprong in het aantal aandelen: buiten de reeks

    def test_keten_als_maar_twee_jaar_nagerekend(self):
        # L'Oréal: aantal aandelen alleen voor de laatste 2 jaar stabiel nagerekend; de keten over de jaarverslagen geeft 8 jaar
        import bouw_webdata as bw
        g = bw.gegevens_uit_esef(bw.esef_ophalen('OR.PA'), '2026-10-25')
        self.assertEqual(g['niveau'], 'jaarverslag')
        self.assertGreaterEqual(sum(1 for j in g['jaren'] if j.get('comparable_eps') is not None), 8)


if __name__ == '__main__':
    unittest.main()


class EenheidCorrectie(unittest.TestCase):
    def cf(self, eps_unit):
        def r(v, accn='a'):
            return {'start': '2025-01-01', 'end': '2025-12-31', 'val': v, 'accn': accn, 'filed': '2026-03-01', 'form': '20-F'}
        return {'facts': {'ifrs-full': {'ProfitLoss': {'units': {'EUR': [r(1e9)]}},
                                        'DilutedEarningsLossPerShare': {'units': {eps_unit: [r(5.64)]}}}}}

    def test_tagfout_in_valuta_wordt_hersteld(self):
        from esef_bron import corrigeer_eenheden
        cf, c = corrigeer_eenheden(self.cf('AED/shares'))
        self.assertIn('EUR/shares', cf['facts']['ifrs-full']['DilutedEarningsLossPerShare']['units'])
        self.assertNotIn('AED/shares', cf['facts']['ifrs-full']['DilutedEarningsLossPerShare']['units'])
        self.assertEqual(len(c), 1)

    def test_juiste_valuta_blijft(self):
        from esef_bron import corrigeer_eenheden
        cf0 = self.cf('EUR/shares')
        cf, c = corrigeer_eenheden(cf0)
        self.assertEqual(c, [])
        self.assertIs(cf, cf0)

    def test_rapport_met_twee_valuta_niet_aanpassen(self):
        from esef_bron import corrigeer_eenheden
        cf0 = self.cf('USD/shares')
        cf0['facts']['ifrs-full']['Revenue'] = {'units': {'USD': [{'start': '2025-01-01', 'end': '2025-12-31', 'val': 1, 'accn': 'a', 'filed': '2026-03-01', 'form': '20-F'}]}}
        self.assertEqual(corrigeer_eenheden(cf0)[1], [])


class TellerPerIndiening(unittest.TestCase):
    def test_terugval_op_totale_winst_per_indiening(self):
        import eps_verification as ev
        def r(v, accn):
            return [{'start': '2024-01-01', 'end': '2024-12-31', 'val': v, 'accn': accn, 'filed': '2025-03-01', 'form': '20-F'}]
        p = {'facts': {'ifrs-full': {
            'ProfitLossAttributableToOwnersOfParent': {'units': {'EUR': [{'start': '2025-01-01', 'end': '2025-12-31', 'val': 7e8, 'accn': 'nieuw', 'filed': '2026-03-01', 'form': '20-F'}]}},
            'ProfitLoss': {'units': {'EUR': r(6.86e8, 'oud')}},
            'AdjustedWeightedAverageShares': {'units': {'shares': r(4.9386e7, 'oud')}}}}}
        inp = ev.sec_eps_recompute_inputs(p, '2026-10-22')
        self.assertEqual([(i['accn'], i['net_income']) for i in inp], [('oud', 6.86e8)])


class SchaalCorrectieEps(unittest.TestCase):
    def cf(self, eps):
        def r(v):
            return [{'start': '2020-01-01', 'end': '2020-12-31', 'val': v, 'accn': 'a', 'filed': '2021-03-01', 'form': '20-F'}]
        return {'facts': {'ifrs-full': {'ProfitLossAttributableToOwnersOfParent': {'units': {'EUR': r(296e6)}},
                                        'AdjustedWeightedAverageShares': {'units': {'shares': r(184.2e6)}},
                                        'DilutedEarningsLossPerShare': {'units': {'EUR/shares': r(eps)}}}}}

    def test_schaalfout_hersteld_met_bewijs_uit_hetzelfde_rapport(self):
        from esef_bron import corrigeer_eps_schaal
        cf, c = corrigeer_eps_schaal(self.cf(1610000.0))
        self.assertEqual(cf['facts']['ifrs-full']['DilutedEarningsLossPerShare']['units']['EUR/shares'][0]['val'], 1.61)
        self.assertEqual(len(c), 1)

    def test_juiste_waarde_of_onverklaarbaar_blijft(self):
        from esef_bron import corrigeer_eps_schaal
        self.assertEqual(corrigeer_eps_schaal(self.cf(1.61))[1], [])
        self.assertEqual(corrigeer_eps_schaal(self.cf(7.77))[1], [])      # geen macht van tien die past: niets doen


class AlleenVerwaterdeTeller(unittest.TestCase):
    def test_teller_uit_pdf_als_enige_winstcijfer(self):
        import eps_verification as ev
        def r(v):
            return [{'start': '2017-01-01', 'end': '2017-12-31', 'val': v, 'accn': 'AFM:1', 'filed': '2018-02-26', 'form': '20-F'}]
        p = {'facts': {'ifrs-full': {
            'ProfitLossAttributableToOrdinaryEquityHoldersOfParentEntityIncludingDilutiveEffects': {'units': {'EUR': r(432e6)}},
            'AdjustedWeightedAverageShares': {'units': {'shares': r(4_230_185_047)}}}}}
        inp = ev.sec_eps_recompute_inputs(p, '2026-10-22')
        self.assertEqual(len(inp), 1)
        chk = ev.recompute_eps_check('2017-12-31', {'val': 0.10, 'accn': 'AFM:1', 'unit': 'EUR/shares'}, inp)
        self.assertEqual(chk['status'], 'consistent')


class AexVolledig(unittest.TestCase):
    def test_vijf_aex_fondsen_tien_jaar_bevestigd(self):
        import bouw_webdata as bw
        for t in ('HEIA.AS', 'NN.AS', 'WKL.AS', 'ASM.AS', 'RAND.AS', 'ABN.AS'):
            g = bw.gegevens_uit_esef(bw.esef_ophalen(t), '2026-10-22')
            self.assertEqual((t, g['eps_status'], g['eps_verified_years']), (t, 'independently_verified', 10))
