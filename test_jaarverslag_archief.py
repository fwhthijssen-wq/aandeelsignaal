"""Tests voor het jaarverslagarchief (laag 1 onveranderlijk, laag 2 afgeleid) en de koppeling met de nachtelijke update."""
import gzip
import json
import tempfile
import unittest
from pathlib import Path

import bouw_webdata as bw
import jaarverslag_archief as ja


def _f(val, end, accn, filed, start=None, form='10-K'):
    r = {'end': end, 'val': val, 'accn': accn, 'filed': filed, 'form': form, 'fp': 'FY'}
    if start:
        r['start'] = start
    return r


def payload(tot=None, wijzig=None):
    """Klein companyfacts-bestand met drie jaarverslagen (ingediend 2023, 2024, 2025). Het verslag van 2023 gaf het aantal
    aandelen in duizenden (het verslag van 2024 corrigeert dat: schaalcorrectie); het verslag van 2025 komt na een
    2:1-splitsing."""
    j = {2022: ('2022-01-01', '2022-12-31'), 2023: ('2023-01-01', '2023-12-31'),
         2024: ('2024-01-01', '2024-12-31'), 2025: ('2025-01-01', '2025-12-31')}
    a23, a24, a25 = ('0000000001-23-000001', '2023-02-20'), ('0000000001-24-000001', '2024-02-20'), \
                    ('0000000001-25-000001', '2025-02-20')
    eps, sh, rev = [], [], []
    # verslag 2023: jaren 2022 en 2023; aandelen in duizenden (fout van de indiener)
    for y, e, s, r in ((2022, 2.00, 500, 1000), (2023, 3.00, 500, 1500)):
        eps.append(_f(e, j[y][1], *a23, start=j[y][0])); sh.append(_f(s, j[y][1], *a23, start=j[y][0]))
        rev.append(_f(r, j[y][1], *a23, start=j[y][0]))
    # verslag 2024: jaren 2023 en 2024; aandelen nu goed (x1000)
    for y, e, s, r in ((2023, 3.00, 500_000, 1500), (2024, 4.00, 500_000, 2000)):
        eps.append(_f(e, j[y][1], *a24, start=j[y][0])); sh.append(_f(s, j[y][1], *a24, start=j[y][0]))
        rev.append(_f(r, j[y][1], *a24, start=j[y][0]))
    # verslag 2025: na een 2:1-splitsing; jaren 2024 en 2025
    for y, e, s, r in ((2024, 2.00, 1_000_000, 2000), (2025, 2.50, 1_000_000, 2500)):
        eps.append(_f(e, j[y][1], *a25, start=j[y][0])); sh.append(_f(s, j[y][1], *a25, start=j[y][0]))
        rev.append(_f(r, j[y][1], *a25, start=j[y][0]))
    if tot:
        eps, sh, rev = ([x for x in l if x['filed'] <= tot] for l in (eps, sh, rev))
    if wijzig:
        for x in rev:
            if x['accn'] == wijzig:
                x['val'] += 1
    return {'cik': 1, 'entityName': 'Proef BV', 'facts': {'us-gaap': {
        'EarningsPerShareDiluted': {'units': {'USD/shares': eps}},
        'WeightedAverageNumberOfDilutedSharesOutstanding': {'units': {'shares': sh}},
        'Revenues': {'units': {'USD': rev}},
    }}}


class ArchiefTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.map = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_opbouw_herkent_schaalcorrectie_en_splitsing_als_terugblik(self):
        a = ja.Archief(self.map)
        res = a.verwerk(payload())
        self.assertEqual(len(res['nieuw']), 3)
        soorten = [(g['soort'], g['historisch']) for g in a.gebeurtenissen('0000000001')]
        self.assertEqual(soorten, [('schaalcorrectie', True), ('splitsing', True)])
        self.assertEqual(a.gebeurtenissen('0000000001')[1]['factor'], '2')

    def test_nieuw_jaarverslag_wordt_toegevoegd_en_gemeld(self):
        ja.Archief(self.map).verwerk(payload(tot='2024-12-31'))
        a = ja.Archief(self.map)
        res = a.verwerk(payload())
        self.assertEqual(res['nieuw'], ['0000000001-25-000001'])
        nieuw = [g for g in a.gebeurtenissen('0000000001') if not g['historisch']]
        self.assertEqual([g['soort'] for g in nieuw], ['splitsing'])

    def test_opnieuw_draaien_verandert_niets(self):
        ja.Archief(self.map).verwerk(payload())
        bestanden = {p: p.read_bytes() for p in self.map.rglob('*') if p.is_file()}
        res = ja.Archief(self.map).verwerk(payload())
        self.assertEqual(res['nieuw'], [])
        self.assertEqual(bestanden, {p: p.read_bytes() for p in self.map.rglob('*') if p.is_file()})

    def test_laag1_wordt_nooit_overschreven_bij_gewijzigde_bron(self):
        ja.Archief(self.map).verwerk(payload())
        pad = self.map / 'sec' / '0000000001' / '0000000001-24-000001.json.gz'
        voor = pad.read_bytes()
        a = ja.Archief(self.map)
        a.verwerk(payload(wijzig='0000000001-24-000001'))
        self.assertEqual(pad.read_bytes(), voor)
        self.assertIn('bron_gewijzigd', [g['soort'] for g in a.gebeurtenissen('0000000001')])
        # een tweede keer geeft geen dubbele melding
        a.verwerk(payload(wijzig='0000000001-24-000001'))
        self.assertEqual([g['soort'] for g in a.gebeurtenissen('0000000001')].count('bron_gewijzigd'), 1)

    def test_herwerking_van_een_bedrag_wordt_gemeld(self):
        p = payload()
        for x in p['facts']['us-gaap']['Revenues']['units']['USD']:
            if x['accn'].endswith('25-000001') and x['end'] == '2024-12-31':
                x['val'] = 2100
        a = ja.Archief(self.map)
        a.verwerk(p)
        herw = [g for g in a.gebeurtenissen('0000000001') if g['soort'] == 'herwerking']
        self.assertEqual(len(herw), 1)
        self.assertEqual((herw[0]['oud'], herw[0]['nieuw']), (2000, 2100))

    def test_laag2_rekent_terug_naar_huidige_aandelenbasis(self):
        a = ja.Archief(self.map)
        a.verwerk(payload())
        reeks = ja.vergelijkbare_eps(a.verslagen('0000000001'), a.gebeurtenissen('0000000001'))
        self.assertEqual({k: v['eps'] for k, v in reeks.items()},
                         {'2023-12-31': 1.5, '2024-12-31': 2.0, '2025-12-31': 2.5})

    def test_samenvatting_vergelijkt_met_bestaande_berekening(self):
        a = ja.Archief(self.map)
        a.verwerk(payload())
        jaren = [{'end': '2023-12-31', 'comparable_eps': 1.5}, {'end': '2024-12-31', 'comparable_eps': 2.0},
                 {'end': '2025-12-31', 'comparable_eps': 3.1}]
        blok = a.samenvatting('0000000001', jaren)
        self.assertEqual(blok['eps_controle']['gelijk'], 2)
        self.assertEqual(blok['eps_controle']['afwijkend'], [{'end': '2025-12-31', 'bestaand': 3.1, 'archief': 2.5}])
        self.assertEqual(blok['verslagen'], 3)

    def test_bestanden_zijn_gzip_en_leesbaar(self):
        ja.Archief(self.map).verwerk(payload())
        pad = next((self.map / 'sec' / '0000000001').glob('*.json.gz'))
        with gzip.open(pad, 'rt', encoding='utf-8') as f:
            self.assertIn('feiten', json.load(f))

    def test_fetch_json_haalt_elk_bestand_een_keer_op(self):
        import source_engine
        oud = source_engine.fetch_json
        teller = []

        def nep(url, email):
            teller.append(url)
            return {'0': {'cik_str': 1, 'ticker': 'PRF'}} if 'company_tickers' in url else payload()
        source_engine.fetch_json = nep
        try:
            a = ja.Archief(self.map)
            url = source_engine.FACTS_URL.format(cik=1)
            for _ in range(3):
                a.fetch_json(source_engine.CIK_MAP_URL, 'x@y.nl')
                a.fetch_json(url, 'x@y.nl')
            self.assertEqual(len(teller), 2)
            self.assertEqual(a.laatste_cik, '0000000001')
            a.vergeet()
            a.fetch_json(url, 'x@y.nl')
            self.assertEqual(len(teller), 3)
        finally:
            source_engine.fetch_json = oud

    def test_fout_in_archief_laat_ophalen_niet_mislukken(self):
        import source_engine
        oud = source_engine.fetch_json
        source_engine.fetch_json = lambda url, email: {'cik': 1, 'facts': {'us-gaap': {'X': {'units': {'USD': 'kapot'}}}}}
        try:
            a = ja.Archief(self.map)
            p = a.fetch_json(source_engine.FACTS_URL.format(cik=1), 'x@y.nl')
            self.assertEqual(p['cik'], 1)
        finally:
            source_engine.fetch_json = oud


class HergebruikTests(unittest.TestCase):
    def _oud(self, gecontroleerd, laatste_end):
        return {'eps_status': 'independently_verified', 'eps_verified_years': 10, 'gecontroleerd_op': gecontroleerd,
                'jaren': [{'end': '2016-12-31'}, {'end': laatste_end}], 'extra_versie': bw.EXTRA_VERSIE}

    def test_geen_nieuw_verslag_mogelijk_dan_afblijven(self):
        self.assertTrue(bw._hergebruik(self._oud('2026-04-01', '2025-12-31'), '2026-06-15'))

    def test_na_90_dagen_toch_opnieuw(self):
        self.assertFalse(bw._hergebruik(self._oud('2026-03-01', '2025-12-31'), '2026-06-15'))

    def test_nieuw_verslag_te_verwachten_dan_elke_week_kijken(self):
        self.assertTrue(bw._hergebruik(self._oud('2027-01-22', '2025-12-31'), '2027-01-27'))
        self.assertFalse(bw._hergebruik(self._oud('2027-01-15', '2025-12-31'), '2027-01-27'))

    def test_niet_bevestigd_nooit_hergebruiken(self):
        oud = self._oud('2026-06-14', '2025-12-31')
        oud['eps_status'] = 'missing_split_evidence'
        self.assertFalse(bw._hergebruik(oud, '2026-06-15'))


class KoppelingTests(unittest.TestCase):
    """live() met het echte archief: één ophaalactie per bedrijf en het blok `archief` in de gegevens."""

    def test_live_gebruikt_archief_en_voegt_blok_toe(self):
        import praktijkcontrole_sec_esef as pse
        import source_engine
        oud_fetch, oud_snap, oud_sum, oud_cat = source_engine.fetch_json, source_engine.sec_snapshot, pse.summarize_sec, bw.CATALOGUS
        opgehaald = []

        def nep_fetch(url, email):
            opgehaald.append(url)
            return {'0': {'cik_str': 1, 'ticker': 'PRF'}} if 'company_tickers' in url else payload()

        def nep_snapshot(ticker, asof, email, fetcher):
            fetcher(source_engine.CIK_MAP_URL, email)
            fetcher(source_engine.FACTS_URL.format(cik=1), email)
            return {'supported': False}

        def nep_summarize(ticker, email, fetcher=None):
            fetcher(ticker, '2026-10-21', email)
            return {'status': 'error', 'message': 'proef'}
        with tempfile.TemporaryDirectory() as tmp:
            try:
                source_engine.fetch_json, source_engine.sec_snapshot, pse.summarize_sec = nep_fetch, nep_snapshot, nep_summarize
                bw.CATALOGUS = (('PRF', 'Proef', 'Verenigde Staten', 'USD', 'NYSE'),)
                bestand = bw.live('x@y.nl', fetch_prijzen=lambda t: [], historie_ophalen=lambda t: ([], []),
                                  valuta_ophalen=lambda t: 'USD', pauze=lambda: None, esef_ophalen=lambda t: None,
                                  yahoo_ophalen=lambda t: None, archief=ja.Archief(tmp))
            finally:
                source_engine.fetch_json, source_engine.sec_snapshot, pse.summarize_sec = oud_fetch, oud_snap, oud_sum
                bw.CATALOGUS = oud_cat
            g = bestand['aandelen'][0]['gegevens']
            self.assertEqual(g['archief']['verslagen'], 3)
            # tweede poging + diagnose vragen het companyfacts-bestand opnieuw; tickerlijst maar één keer
            self.assertEqual(sum('company_tickers' in u for u in opgehaald), 1)
            status = bw.maak_status(bestand)['aandelen'][0]['archief']
            self.assertEqual(status['verslagen'], 3)
            self.assertTrue(Path(tmp, 'sec', '0000000001', 'gebeurtenissen.json').exists())


if __name__ == '__main__':
    unittest.main()


class ExtraVersieTests(unittest.TestCase):
    def test_oude_rekenregels_worden_eenmalig_vernieuwd(self):
        oud = {'eps_status': 'independently_verified', 'eps_verified_years': 10, 'gecontroleerd_op': '2026-04-01',
               'jaren': [{'end': '2025-12-31'}]}
        self.assertFalse(bw._hergebruik(oud, '2026-06-15'))
        oud['extra_versie'] = bw.EXTRA_VERSIE
        self.assertTrue(bw._hergebruik(oud, '2026-06-15'))
