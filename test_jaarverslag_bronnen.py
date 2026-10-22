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


if __name__ == '__main__':
    unittest.main()
