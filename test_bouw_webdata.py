import json
import tempfile
import unittest
from datetime import date
from pathlib import Path

import apple_like_fixture as fx
import bouw_webdata as bw
from praktijkcontrole_sec_esef import summarize_sec

HERE = Path(__file__).resolve().parent
DEMO = HERE / 'web' / 'demo' / 'apple_praktijkrun_2026-10-19.json'


class WebdataTests(unittest.TestCase):
    def test_demo_contains_only_apple_with_real_checked_data(self):
        bestand = bw.demo(DEMO)
        met_gegevens = [r['ticker'] for r in bestand['aandelen'] if r['gegevens']]
        self.assertEqual(met_gegevens, ['AAPL'])
        self.assertTrue(all(r['koers'] is None for r in bestand['aandelen']))  # geen koersen verzonnen
        apple = next(r for r in bestand['aandelen'] if r['ticker'] == 'AAPL')['gegevens']
        self.assertEqual(apple['eps_status'], 'independently_verified')
        self.assertEqual(apple['eps_verified_years'], 10)
        self.assertEqual(apple['currencies'], ['USD'])
        self.assertEqual(apple['rejected_sources'], 0)
        self.assertEqual([j['year'] for j in apple['jaren']], list(range(2016, 2026)))
        self.assertEqual(apple['jaren'][0]['comparable_eps'], 2.0775)

    def test_splits_are_deduplicated_and_keep_evidence(self):
        apple = next(r for r in bw.demo(DEMO)['aandelen'] if r['ticker'] == 'AAPL')['gegevens']
        statussen = sorted(s['status'] for s in apple['splits'])
        self.assertEqual(statussen, ['candidate', 'niet_van_toepassing'])
        kandidaat = next(s for s in apple['splits'] if s['status'] == 'candidate')
        self.assertEqual(len(kandidaat['bewijs']), 2)

    def test_error_summary_becomes_error_block_without_label_evidence(self):
        blok = bw.gegevens_uit_sec({'status': 'error', 'message': 'netwerk'}, '2026-10-20')
        self.assertEqual(blok['fout'], 'netwerk')
        self.assertIsNone(blok['eps_status'])
        self.assertEqual(blok['jaren'], [])

    def test_price_block_sma_and_cleaning(self):
        reeks = [(f'2026-01-{d:02d}', 100 + d) for d in range(1, 29)] + [(f'2026-02-{d:02d}', 130 + d) for d in range(1, 28)]
        reeks += [('kapot', 5), ('2026-03-01', None), ('2026-03-02', -3), ('2026-03-03', float('nan'))]
        blok = bw.koers_uit_reeks(reeks)
        self.assertEqual(blok['datum'], '2026-02-27')
        self.assertIsNotNone(blok['sma50'])
        self.assertLessEqual(len(blok['reeks']), 130)
        self.assertIsNone(bw.koers_uit_reeks([('x', 1)]))
        self.assertIsNone(bw.koers_uit_reeks(reeks[:10])['sma50'])

    def test_live_run_with_fakes_and_failures_never_invents(self):
        data = fx.payload()

        def sec(ticker, email):
            if ticker == 'AAPL':
                return summarize_sec('AAPL', email, fetcher=fx.snapshot_fetcher(data), asof='2026-10-19')
            raise OSError('geen verbinding')

        def prijzen(ticker):
            if ticker == 'AAPL':
                return [(f'2026-10-{d:02d}', 200 + d) for d in range(1, 20)]
            raise OSError('geen koers')

        def payload_ophalen(t, e):
            if t == 'AAPL':
                return {'facts': {'us-gaap': {'PaymentsOfDividendsCommonStock': {'units': {'USD': [
                    {'end': '2021-09-25', 'start': '2020-09-27', 'val': 15234000000, 'form': '10-K', 'filed': '2025-10-31', 'accn': 'x'}]}}}}}
            raise OSError('geen verbinding')

        bestand = bw.live('a@b.nl', fetch_prijzen=prijzen, historie_ophalen=lambda t: ([], []), valuta_ophalen=lambda t: 'USD' if '.' not in t else 'EUR', pauze=lambda: None, esef_ophalen=lambda t: None, sec_samenvatting=sec, diagnose=lambda t, e: {'sec_ticker': t},
                          payload_ophalen=payload_ophalen)
        apple = next(r for r in bestand['aandelen'] if r['ticker'] == 'AAPL')
        self.assertEqual(apple['koers']['datum'], '2026-10-19')
        self.assertEqual(apple['gegevens']['eps_status'], 'independently_verified')
        jr = {j['end']: j for j in apple['gegevens']['jaren']}
        self.assertEqual(jr['2021-09-25']['dividends_paid'], 15234000000)
        self.assertIsNone(jr['2020-09-26']['dividends_paid'])           # niet in het bestand: onbekend, niet 0
        self.assertTrue(all(j['pretax_income'] is None and j['long_term_debt'] is None for j in jr.values()))
        rest = [r for r in bestand['aandelen'] if r['ticker'] != 'AAPL']
        self.assertTrue(all(r['koers'] is None and r['gegevens']['fout'] for r in rest))
        self.assertTrue(all(r['gegevens'].get('diagnose') for r in rest if bw.heeft_sec(r['ticker'])), 'mislukte aandelen met SEC-route krijgen een diagnose')
        zonder = [r for r in rest if not bw.heeft_sec(r['ticker'])]
        self.assertGreater(len(zonder), 200)
        self.assertTrue(all('alleen koersgegevens' in r['gegevens']['fout'] and not r['gegevens'].get('diagnose') for r in zonder))
        self.assertEqual('diagnose' in apple['gegevens'], (apple['gegevens']['eps_verified_years'] or 0) < 10,
                         'diagnose alleen als er minder dan 10 jaar onderbouwd zijn')

    def test_valuta_controle_pence_en_onbekend(self):
        gbx = ('BP.L', 'BP', 'Verenigd Koninkrijk', 'GBX', 'Londen')
        eur = ('MC.PA', 'LVMH', 'Frankrijk', 'EUR', 'Parijs')
        self.assertTrue(bw.valuta_klopt(gbx, lambda t: 'GBp'))
        self.assertFalse(bw.valuta_klopt(gbx, lambda t: 'GBP'), 'pond is niet pence: geen koers')
        self.assertFalse(bw.valuta_klopt(gbx, lambda t: None), 'onbekend bij Londen: geen koers')
        self.assertTrue(bw.valuta_klopt(eur, lambda t: None))
        self.assertFalse(bw.valuta_klopt(eur, lambda t: 'USD'))
        def stuk(t):
            raise OSError('x')
        self.assertFalse(bw.valuta_klopt(gbx, stuk))
        self.assertTrue(bw.valuta_klopt(eur, stuk))

    def test_europese_indexen_labels_en_sec_koppeling(self):
        rec = bw.maak_record(next(m for m in bw.CATALOGUS if m[0] == 'MC.PA'))
        self.assertEqual(rec['indices'], ['CAC40'])
        self.assertEqual(bw.INDICES['AIR.PA'], ['CAC40', 'DAX'])
        self.assertEqual(bw.INDICES['SAP.DE'], ['DAX'])
        self.assertTrue(bw.heeft_sec('DBK.DE') and bw.heeft_sec('SAP.DE') and bw.heeft_sec('AAPL'))
        self.assertFalse(bw.heeft_sec('MC.PA') or bw.heeft_sec('BP.L'))

    def test_extra_cijfers_mislukken_nooit_de_run_en_raken_het_slot_niet(self):
        data = fx.payload()

        def sec(t, e):
            return summarize_sec('AAPL', e, fetcher=fx.snapshot_fetcher(data), asof='2026-10-19')

        def kapot(t, e):
            raise RuntimeError('boem')
        bestand = bw.live('a@b.nl', fetch_prijzen=lambda t: [], historie_ophalen=lambda t: ([], []), valuta_ophalen=lambda t: 'USD' if '.' not in t else 'EUR', pauze=lambda: None, esef_ophalen=lambda t: None, sec_samenvatting=sec, diagnose=lambda t, e: {}, payload_ophalen=kapot)
        g = bestand['aandelen'][0]['gegevens']
        self.assertEqual(g['eps_status'], 'independently_verified')
        self.assertTrue(all(j.get('dividends_paid') is None for j in g['jaren']))

    def test_tijdelijke_sec_storing_krijgt_een_tweede_poging(self):
        data = fx.payload()
        aantal = {}

        def sec(t, e):
            aantal[t] = aantal.get(t, 0) + 1
            if aantal[t] == 1:
                raise TimeoutError('traag')
            return summarize_sec('AAPL', e, fetcher=fx.snapshot_fetcher(data), asof='2026-10-19')
        bestand = bw.live('a@b.nl', fetch_prijzen=lambda t: [], historie_ophalen=lambda t: ([], []), valuta_ophalen=lambda t: 'USD' if '.' not in t else 'EUR', pauze=lambda: None, esef_ophalen=lambda t: None, sec_samenvatting=sec, diagnose=lambda t, e: {}, payload_ophalen=lambda t, e: None)
        eerste = bestand['aandelen'][0]['gegevens']
        self.assertEqual(eerste['eps_status'], 'independently_verified')   # tweede poging slaagde
        self.assertEqual(next(iter(aantal.values())), 2)

    def test_goedgekeurde_jaren_worden_hergebruikt_en_bij_uitval_bewaard(self):
        data = fx.payload()
        sec_ok = lambda t, e: summarize_sec('AAPL', e, fetcher=fx.snapshot_fetcher(data), asof='2026-10-19')
        kw = dict(fetch_prijzen=lambda t: [], historie_ophalen=lambda t: ([], []), valuta_ophalen=lambda t: 'USD' if '.' not in t else 'EUR', pauze=lambda: None, esef_ophalen=lambda t: None, diagnose=lambda t, e: {}, payload_ophalen=lambda t, e: None)
        eerste = bw.live('a@b.nl', sec_samenvatting=sec_ok, **kw)
        vorige = {a['ticker']: a['gegevens'] for a in eerste['aandelen'] if a['gegevens'] and a['gegevens'].get('jaren')}
        self.assertTrue(vorige)
        t = 'AAPL'
        vorige[t]['eps_status'] = 'independently_verified'; vorige[t]['eps_verified_years'] = 10      # volledig goedgekeurd dossier
        vorige[t]['gecontroleerd_op'] = date.today().isoformat()
        aantal = {}

        def telt(tk, e):
            aantal[tk] = aantal.get(tk, 0) + 1
            raise TimeoutError('SEC onbereikbaar')
        nu = bw.live('a@b.nl', sec_samenvatting=telt, vorige=vorige, **kw)
        rec = next(a for a in nu['aandelen'] if a['ticker'] == t)
        self.assertEqual(rec['gegevens']['eps_status'], 'independently_verified')     # goedgekeurd: niet opnieuw opgehaald
        self.assertNotIn('AAPL', aantal)
        # verouderd (31 dagen): wel opnieuw proberen; mislukt het, dan blijven de laatste goede cijfers staan, gemarkeerd
        vorige[t]['gecontroleerd_op'] = '2020-01-01'
        nu2 = bw.live('a@b.nl', sec_samenvatting=telt, vorige=vorige, **kw)
        rec2 = next(a for a in nu2['aandelen'] if a['ticker'] == t)
        self.assertTrue(rec2['gegevens'].get('uit_vorige_run'))
        self.assertEqual(rec2['gegevens']['eps_verified_years'], vorige[t]['eps_verified_years'])
        # een fout in de vorige run wordt nooit hergebruikt
        self.assertFalse(bw._hergebruik({'fout': 'x', 'jaren': [1], 'eps_status': 'independently_verified', 'eps_verified_years': 10, 'gecontroleerd_op': date.today().isoformat()}, date.today().isoformat()))
        self.assertFalse(bw._hergebruik({'jaren': [1], 'eps_status': 'independently_verified', 'eps_verified_years': 9, 'gecontroleerd_op': date.today().isoformat()}, date.today().isoformat()))

    def test_written_js_matches_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            bw.schrijf(bw.demo(DEMO), tmp)
            js = (Path(tmp) / 'aandelen.js').read_text(encoding='utf-8')
            data = json.loads((Path(tmp) / 'aandelen.json').read_text(encoding='utf-8'))
            self.assertTrue(js.startswith('window.AANDEEL_DATA = '))
            self.assertEqual(json.loads(js[len('window.AANDEEL_DATA = '):].rstrip().rstrip(';')), data)


class ValutaEnStatusTests(unittest.TestCase):
    def test_koers_in_andere_valuta_dan_cijfers_blokkeert_eenduidigheid(self):
        g = {'currencies': ['USD'], 'jaren': [], 'splits': []}
        rec = bw.maak_record(('SHELL.AS', 'Shell plc', 'Nederland', 'EUR', 'Amsterdam'), gegevens=g)
        self.assertEqual(rec['gegevens']['currencies'], ['EUR', 'USD'])
        self.assertEqual(g['currencies'], ['USD'])           # invoer blijft ongewijzigd

    def test_zelfde_valuta_blijft_een_valuta(self):
        g = {'currencies': ['EUR'], 'jaren': [], 'splits': []}
        rec = bw.maak_record(('SAP.DE', 'SAP SE', 'Duitsland', 'EUR', 'Xetra'), gegevens=g)
        self.assertEqual(rec['gegevens']['currencies'], ['EUR'])

    def test_status_bevat_open_jaren_met_reden(self):
        g = {'currencies': ['USD'], 'eps_status': 'partially_independently_verified', 'eps_verified_years': 1,
             'rejected_sources': 0, 'splits': [], 'waarschuwingen': [],
             'jaren': [{'year': 2018, 'eps_check': 'niet_bewezen', 'eps_reden': 'x' * 400},
                       {'year': 2019, 'eps_check': 'onderbouwd', 'eps_reden': 'ok'}]}
        bestand = bw.maak_bestand([bw.maak_record(('AAPL', 'Apple', 'VS', 'USD', 'Nasdaq'), gegevens=g)])
        status = bw.maak_status(bestand)['aandelen'][0]
        self.assertEqual([j['jaar'] for j in status['open_jaren']], [2018])
        self.assertEqual(len(status['open_jaren'][0]['reden']), 300)

    def test_status_toont_dekking_van_de_extra_kentallen(self):
        bestand = bw.maak_bestand([bw.maak_record(('AAA', 'Aaa', 'VS', 'USD', 'NYSE'), gegevens={
            'currencies': ['USD'], 'jaren': [{'year': 1, 'dividends_paid': 5.0, 'pretax_income': None}, {'year': 2, 'dividends_paid': 0.0}], 'splits': []})])
        st = bw.maak_status(bestand)['aandelen'][0]['extra_dekking']
        self.assertEqual(st['dividends_paid'], 2)
        self.assertEqual({k: v for k, v in st.items() if k != 'dividends_paid'}, {k: 0 for k in st if k != 'dividends_paid'})
        for veld in ('total_assets', 'current_assets', 'retained_earnings', 'shares_diluted', 'operating_income', 'cash'):
            self.assertIn(veld, st)

    def test_jaarwaarden_alleen_jaarverslagen_van_een_jaar_en_ruis_valt_weg(self):
        def r(end, start, val, form='10-K'):
            return {'end': end, 'start': start, 'val': val, 'form': form, 'filed': '2026-02-01', 'fp': 'FY'}
        payload = {'facts': {'us-gaap': {
            'WeightedAverageNumberOfDilutedSharesOutstanding': {'units': {'shares': [
                r('2020-12-31', '2020-01-01', 7.4e8), r('2021-12-31', '2021-01-01', 7.5e8),
                r('2021-12-31', '2021-10-01', 1.0, form='10-K'),            # kwartaalperiode
                r('2021-09-30', '2021-01-01', 5.0, form='10-Q'),             # geen jaarverslag
                r('2010-12-31', '2010-01-01', 9.0)]}},                       # te oud
            'ShareBasedCompensationArrangementByShareBasedPaymentAwardOptionsExercisableWeightedAverageExercisePrice': {'units': {'USD/shares': [r('2020-12-31', '2020-01-01', 3.0)]}},
            'NetIncomeLoss': {'units': {'USD': [{'end': 'x', 'start': 'y', 'val': 1, 'form': '10-K'}]}}}}}
        j = bw.jaarwaarden(payload)
        self.assertEqual(list(j), ['us-gaap:WeightedAverageNumberOfDilutedSharesOutstanding [shares]'])
        self.assertEqual([x[:2] for x in j['us-gaap:WeightedAverageNumberOfDilutedSharesOutstanding [shares]']], [['2020-12-31', 7.4e8], ['2021-12-31', 7.5e8]])
        self.assertEqual(bw.jaarwaarden(None), {}); self.assertEqual(bw.jaarwaarden({'facts': 'x'}), {})
        ov = bw.eps_tag_overzicht({'facts': {'us-gaap': {'ShareBasedCompensationArrangementByShareBasedPaymentAwardOptionsExercisableWeightedAverageExercisePrice': {'units': {'USD': []}},
                                                         'EarningsPerShareDiluted': {'units': {'USD/shares': []}}}}})
        self.assertEqual(list(ov), ['us-gaap:EarningsPerShareDiluted [USD/shares]'])

    def test_eps_tag_overzicht_toont_gebruikte_namen_zonder_te_verzinnen(self):
        payload = {'facts': {
            'ifrs-full': {'DilutedEarningsLossPerShare': {'units': {'USD/shares': [
                {'fy': 2020, 'form': '20-F', 'accn': 'a1'}, {'fy': 2022, 'form': '20-F', 'accn': 'a2'}, {'fy': 2021, 'form': '6-K'}]}},
                'Revenue': {'units': {'USD': [{'fy': 2020}]}}},
            'dei': {'EntityCommonStockSharesOutstanding': {'units': {'shares': [{'fy': 2020}]}}}}}
        o = bw.eps_tag_overzicht(payload)
        self.assertEqual(list(o), ['ifrs-full:DilutedEarningsLossPerShare [USD/shares]'])
        r = o['ifrs-full:DilutedEarningsLossPerShare [USD/shares]']
        self.assertEqual((r['n'], r['fy'], r['met_accn'], r['indieningen']), (3, [2020, 2022], 2, ['20-F', '6-K']))
        self.assertEqual(bw.eps_tag_overzicht(None), {})
        self.assertEqual(bw.eps_tag_overzicht({'facts': 'x'}), {})

    def test_sec_diagnose_vangt_fouten_en_onbekend_bedrijf_af(self):
        def stuk(url, email):
            raise OSError('geen verbinding')
        self.assertIn('OSError', bw.sec_diagnose('SHEL', 'a@b.nl', fetcher=stuk)['fout'])
        self.assertIn('niet in de SEC-lijst', bw.sec_diagnose('ZZZZ', 'a@b.nl', fetcher=lambda u, e: {})['fout'])

    def test_shell_staat_in_dollar_zodat_koers_en_cijfers_gelijk_zijn(self):
        meta = next(m for m in bw.CATALOGUS if m[0] == 'SHEL')
        self.assertEqual(meta[3], 'USD')
        g = {'currencies': ['USD'], 'eps_status': 'independently_verified', 'eps_verified_years': 10,
             'rejected_sources': 0, 'splits': [], 'waarschuwingen': [], 'jaren': []}
        self.assertEqual(bw.maak_record(meta, gegevens=g)['gegevens']['currencies'], ['USD'])
        self.assertFalse(any(m[0] == 'SHELL.AS' for m in bw.CATALOGUS))

    def test_catalogus_is_geldig_uniek_en_bruikbaar_in_de_app(self):
        import re
        ts = [m[0] for m in bw.CATALOGUS]
        self.assertEqual(len(ts), len(set(ts)), 'dubbele beurscode')
        self.assertGreaterEqual(len(ts), 37)
        for ticker, naam, land, valuta, beurs in bw.CATALOGUS:
            self.assertRegex(ticker, r'^[A-Z0-9][A-Z0-9.\-]{0,14}$', ticker)   # zelfde regel als de opslag in de app
            self.assertTrue(naam and land and beurs, ticker)
            self.assertRegex(valuta, r'^[A-Z]{3}$', ticker)
            if '.' not in ticker:
                self.assertIn(valuta, ('USD',), f'{ticker}: een SEC-notering zonder punt is hier in dollar')

    def test_zonder_jaarcijfers_noemt_de_fout_de_status_van_de_bron(self):
        blok = bw.gegevens_uit_sec({'status': 'insufficient_history'}, '2026-10-20')
        self.assertIn('insufficient_history', blok['fout'])
        blok = bw.gegevens_uit_sec({}, '2026-10-20')
        self.assertTrue(blok['fout'])
        self.assertIsNone(blok['eps_status'])

    def test_status_bevat_einddata_van_de_jaren(self):
        g = {'currencies': ['USD'], 'eps_status': 'x', 'eps_verified_years': 0, 'rejected_sources': 0, 'splits': [],
             'waarschuwingen': [], 'jaren': [{'year': 2023, 'end': '2023-12-31'}, {'year': 2024, 'end': '2024-12-29'}]}
        st = bw.maak_status(bw.maak_bestand([bw.maak_record(('JNJ', 'J&J', 'VS', 'USD', 'NYSE'), gegevens=g)]))
        self.assertEqual(st['aandelen'][0]['einddata'], ['2023-12-31', '2024-12-29'])

    def test_status_neemt_diagnose_mee(self):
        g = {'currencies': ['USD'], 'eps_status': 'x', 'eps_verified_years': 0, 'rejected_sources': 0, 'splits': [],
             'waarschuwingen': [], 'jaren': [], 'diagnose': {'concepten': {'a': 1}}}
        st = bw.maak_status(bw.maak_bestand([bw.maak_record(('SHEL', 'Shell', 'NL', 'EUR', 'A'), gegevens=g)]))
        self.assertEqual(st['aandelen'][0]['diagnose'], {'concepten': {'a': 1}})


if __name__ == '__main__':
    unittest.main()
