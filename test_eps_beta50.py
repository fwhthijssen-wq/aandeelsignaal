"""Tests voor de aanpassingen in beta.50 aan de EPS-controle: verliesjaren rond een splitsing, herhaalde meldingen van
dezelfde splitsing, splitsingen afgeleid uit jaarverslagen (ook samenvoegingen), afronding en ontbrekende oudste jaren."""
import unittest
from datetime import date

import eps_verification as ev
import jaarverslag_archief as ja


def obs(end, filed, val, accn=None):
    return {'end': end, 'filed': filed, 'val': val, 'unit': 'USD/shares', 'accn': accn or f'a-{filed}'}


def event(datum, ratio, tag='us-gaap:StockholdersEquityNoteStockSplitConversionRatio1'):
    return {'Datum': datum, 'Waarde SEC': ratio, 'Eenheid': 'pure', 'Tag': tag}


HISTORIE = [{'end': '2018-12-31'}, {'end': '2019-12-31'}, {'end': '2020-12-31'}]


class SplitBevestiging(unittest.TestCase):
    def test_verliesjaar_bevestigt_splitsing(self):
        # Tesla: -4,92 voor de 5:1-splitsing, -0,98 erna
        o = [obs('2019-12-31', '2020-02-13', -4.92), obs('2019-12-31', '2021-02-08', -0.98)]
        uit = ev.verify_split_events([event('2020-08-10', 5)], o, HISTORIE)
        self.assertEqual(uit[0]['Datumtype'], 'effectieve_splitdatum')

    def test_bewijs_dat_ook_bij_geen_verschil_past_telt_niet(self):
        # na de datum staan zowel de oude als de nieuwe waarde: dat bevestigt niets
        o = [obs('2019-12-31', '2020-02-13', 3.0), obs('2019-12-31', '2021-02-08', 3.0), obs('2019-12-31', '2022-02-08', 1.0)]
        uit = ev.verify_split_events([event('2020-08-10', 3)], o, HISTORIE)
        self.assertNotEqual(uit[0].get('Datumtype'), 'effectieve_splitdatum')

    def test_zelfde_bewijsvenster_is_een_splitsing(self):
        o = [obs('2019-12-31', '2020-02-13', 6.0), obs('2019-12-31', '2021-02-08', 2.0)]
        uit = ev.verify_split_events([event('2020-03-31', 3), event('2020-08-10', 3)], o, HISTORIE)
        soorten = sorted(e['Datumtype'] for e in uit)
        self.assertEqual(soorten, ['dubbel_van_bevestigde_splitsing', 'effectieve_splitdatum'])
        self.assertEqual(next(e for e in uit if e['Datumtype'] == 'effectieve_splitdatum')['Datum'], '2020-03-31')

    def test_latere_herhaling_blokkeert_niet(self):
        o = [obs('2019-12-31', '2020-02-13', 6.0), obs('2019-12-31', '2021-02-08', 2.0),
             obs('2020-12-31', '2021-02-08', 2.5), obs('2020-12-31', '2022-02-08', 2.5)]
        uit = ev.verify_split_events([event('2020-08-10', 3), event('2021-06-30', 3)], o, HISTORIE)
        later = next(e for e in uit if e['Datum'] == '2021-06-30')
        self.assertEqual(later['Datumtype'], 'dubbel_van_bevestigde_splitsing')

    def test_echte_tegenspraak_blijft_afgewezen(self):
        o = [obs('2019-12-31', '2020-02-13', 6.0), obs('2019-12-31', '2021-02-08', 3.0)]
        uit = ev.verify_split_events([event('2020-08-10', 3)], o, HISTORIE)
        self.assertNotEqual(uit[0].get('Datumtype'), 'effectieve_splitdatum')
        self.assertIn('spreekt de splitverhouding tegen', uit[0]['Verificatie reden'])


class Samenvoeging(unittest.TestCase):
    """Honeywell: samenvoeging 1:2 (SEC-verhouding 0,5) in juni 2026, na het laatste jaarverslag. Het kwartaal van vóór de
    samenvoeging staat in de eerste 10-Q erna opnieuw, met dubbele EPS: dat bevestigt de verhouding."""
    HIST = [{'end': '2024-12-31'}, {'end': '2025-12-31'}]

    def test_bevestigd_door_kwartaal(self):
        o = [obs('2025-06-30', '2025-07-24', 2.45), obs('2025-06-30', '2026-07-23', 4.9)]
        uit = ev.verify_split_events([event('2026-06-29', 0.5)], o, self.HIST)
        self.assertEqual(uit[0]['Datumtype'], 'effectieve_splitdatum')

    def test_zonder_bewijs_blijft_afgewezen(self):
        uit = ev.verify_split_events([event('2026-06-29', 0.5)], [], self.HIST)
        self.assertNotEqual(uit[0].get('Datumtype'), 'effectieve_splitdatum')
        o = [obs('2025-06-30', '2025-07-24', 2.45), obs('2025-06-30', '2026-07-23', 1.22)]        # verkeerde richting
        uit = ev.verify_split_events([event('2026-06-29', 0.5)], o, self.HIST)
        self.assertNotEqual(uit[0].get('Datumtype'), 'effectieve_splitdatum')

    def test_omrekening_verdubbelt_oude_eps(self):
        from history_checks import normalized_eps_history
        hist = [{'end': '2025-12-31', 'facts': {'Winst per aandeel (verwaterd)': {'val': 7.36, 'filed': '2026-02-17'}}}]
        ev_ = {'Datum': '2026-06-29', 'Waarde SEC': 0.5, 'Eenheid': 'pure', 'Datumtype': 'effectieve_splitdatum', 'Verificatie': 'x'}
        uit = normalized_eps_history(hist, [ev_], asof='2026-10-25')
        self.assertAlmostEqual(uit['2025-12-31']['EPS vergelijkbaar'], 14.72, places=2)
        zonder = normalized_eps_history(hist, [dict(ev_, Verificatie=None)], asof='2026-10-25')
        self.assertIsNone(zonder['2025-12-31']['EPS vergelijkbaar'])


class Verhoudingen(unittest.TestCase):
    def test_samenvoeging_alleen_als_afgeleid(self):
        self.assertFalse(ev.geldige_ratio(8 / 9))
        self.assertTrue(ev.geldige_ratio(8 / 9, ev.AFGELEID_TAG))
        self.assertFalse(ev.geldige_ratio(1.0, ev.AFGELEID_TAG))
        self.assertTrue(ev.geldige_ratio(4))
        self.assertFalse(ev.geldige_ratio(True))

    def test_afgeleide_samenvoeging_wordt_bevestigd(self):
        o = [obs('2019-12-31', '2020-02-13', 2.56), obs('2019-12-31', '2021-02-08', 2.88)]
        uit = ev.verify_split_events([event('2020-02-14', 8 / 9, ev.AFGELEID_TAG)], o, HISTORIE)
        self.assertEqual(uit[0]['Datumtype'], 'effectieve_splitdatum')


class Herberekening(unittest.TestCase):
    def inputs(self, ni, sh):
        return [{'end': '2023-12-31', 'accn': 'x', 'net_income': ni, 'diluted_shares': sh, 'currency': 'USD'}]

    def test_klein_verschil_door_afronding_is_consistent(self):
        # JNJ 2023: herberekend 13,7295, gemeld 13,72
        r = ev.recompute_eps_check('2023-12-31', {'val': 13.72, 'accn': 'x', 'unit': 'USD/shares'},
                                   self.inputs(35_153_000_000, 2_560_400_000))
        self.assertEqual(r['status'], 'consistent')

    def test_echt_verschil_blijft_afwijking(self):
        r = ev.recompute_eps_check('2023-12-31', {'val': 13.0, 'accn': 'x', 'unit': 'USD/shares'},
                                   self.inputs(35_153_000_000, 2_560_400_000))
        self.assertEqual(r['status'], 'afwijking')


class OudsteJaren(unittest.TestCase):
    def rij(self, end, met_eps=True):
        return {'end': end, 'facts': {ev.EPS_FACT: {'val': 1.0, 'accn': f'a{end}'}} if met_eps else {}}

    def test_alleen_aan_het_begin_weglaten(self):
        hist = [self.rij('2019-12-31', False), self.rij('2020-12-31'), self.rij('2021-12-31')]
        inputs = [{'end': r['end'], 'accn': f"a{r['end']}", 'diluted_shares': 100.0} for r in hist[1:]]
        rest, weg = ev.zonder_oudste_onvolledige(hist, inputs)
        self.assertEqual(weg, ['2019-12-31'])
        self.assertEqual([r['end'] for r in rest], ['2020-12-31', '2021-12-31'])

    def test_gat_in_het_midden_blijft_staan(self):
        hist = [self.rij('2019-12-31'), self.rij('2020-12-31', False), self.rij('2021-12-31')]
        inputs = [{'end': r['end'], 'accn': f"a{r['end']}", 'diluted_shares': 100.0} for r in (hist[0], hist[2])]
        rest, weg = ev.zonder_oudste_onvolledige(hist, inputs)
        self.assertEqual(weg, [])
        ok, _ = ev.share_count_continuity(rest, inputs)
        self.assertFalse(ok)


class AfgeleideSplitsingen(unittest.TestCase):
    def payload(self, aandelen_na):
        def f(val, end, filed):
            return {'start': end[:4] + '-01-01', 'end': end, 'val': val, 'accn': f'acc-{filed}', 'filed': filed, 'form': '10-K'}
        eps = [f(4.0, '2022-12-31', '2023-02-01'), f(2.0, '2022-12-31', '2024-02-01'), f(2.2, '2023-12-31', '2024-02-01')]
        sh = [f(100_000_000, '2022-12-31', '2023-02-01'), f(aandelen_na, '2022-12-31', '2024-02-01'),
              f(200_000_000, '2023-12-31', '2024-02-01')]
        return {'cik': 1, 'facts': {'us-gaap': {'EarningsPerShareDiluted': {'units': {'USD/shares': eps}},
                                                'WeightedAverageNumberOfDilutedSharesOutstanding': {'units': {'shares': sh}}}}}

    def test_splitsing_met_aandelen_wordt_afgeleid(self):
        uit = ja.afgeleide_splitsingen(self.payload(200_000_000), '2026-01-01')
        self.assertEqual([(e['Datum'], e['Waarde SEC']) for e in uit], [('2023-02-02', 2.0)])

    def test_alleen_eps_verschuiving_is_geen_splitsing(self):
        self.assertEqual(ja.afgeleide_splitsingen(self.payload(100_000_000), '2026-01-01'), [])

    def test_bekende_sec_splitsing_niet_dubbel(self):
        bestaand = [{'Datum': '2023-06-30', 'Waarde SEC': 2}]
        self.assertEqual(ja.afgeleide_splitsingen(self.payload(200_000_000), '2026-01-01', bestaand), [])


if __name__ == '__main__':
    unittest.main()


class TerugvalGewoonAantal(unittest.TestCase):
    def payload(self, verwaterd=None):
        def f(val, accn='x'):
            return [{'start': '2023-01-01', 'end': '2023-12-31', 'val': val, 'accn': accn, 'filed': '2024-02-20', 'form': '10-K'}]
        g = {'NetIncomeLoss': {'units': {'USD': f(1_003_000_000)}},
             'WeightedAverageNumberOfSharesOutstandingBasic': {'units': {'shares': f(400_000_000)}}}
        if verwaterd:
            g['WeightedAverageNumberOfDilutedSharesOutstanding'] = {'units': {'shares': f(verwaterd)}}
        return {'facts': {'us-gaap': g}}

    def test_gewoon_aantal_als_verwaterd_ontbreekt(self):
        r = ev.sec_eps_recompute_inputs(self.payload(), '2026-01-01')
        self.assertEqual(r[0]['diluted_shares'], 400_000_000)
        self.assertIn('gewoon aantal', r[0]['source'])
        check = ev.recompute_eps_check('2023-12-31', {'val': 2.51, 'accn': 'x', 'unit': 'USD/shares'}, r)
        self.assertEqual(check['status'], 'consistent')

    def test_verwaterd_gaat_voor(self):
        r = ev.sec_eps_recompute_inputs(self.payload(verwaterd=410_000_000), '2026-01-01')
        self.assertEqual(r[0]['diluted_shares'], 410_000_000)

    def test_merkbare_verwatering_blijft_onbewezen(self):
        # verwaterde EPS 2,40 (ruim 4% verwatering) past niet bij het gewone aantal: geen bevestiging
        r = ev.sec_eps_recompute_inputs(self.payload(), '2026-01-01')
        check = ev.recompute_eps_check('2023-12-31', {'val': 2.40, 'accn': 'x', 'unit': 'USD/shares'}, r)
        self.assertEqual(check['status'], 'afwijking')


class AndereTeller(unittest.TestCase):
    def test_winst_voor_gewone_aandeelhouders_als_standaardteller_niet_klopt(self):
        # JPMorgan 2019: nettowinst 36.431 / 3.230 aandelen = 11,28; gemeld 10,72 = 34.642 (na preferent dividend) / 3.230
        def f(v):
            return [{'start': '2019-01-01', 'end': '2019-12-31', 'val': v, 'accn': 'x', 'filed': '2020-02-25', 'form': '10-K'}]
        p = {'facts': {'us-gaap': {'NetIncomeLoss': {'units': {'USD': f(36_431_000_000)}},
                                   'NetIncomeLossAvailableToCommonStockholdersBasic': {'units': {'USD': f(34_642_000_000)}},
                                   'WeightedAverageNumberOfDilutedSharesOutstanding': {'units': {'shares': f(3_230_400_000)}}}}}
        r = ev.sec_eps_recompute_inputs(p, '2026-01-01')
        check = ev.recompute_eps_check('2019-12-31', {'val': 10.72, 'accn': 'x', 'unit': 'USD/shares'}, r)
        self.assertEqual(check['status'], 'consistent')
        self.assertEqual(check['teller'], 'NetIncomeLossAvailableToCommonStockholdersBasic')
        # een EPS die bij geen enkele teller past blijft een afwijking
        check = ev.recompute_eps_check('2019-12-31', {'val': 9.50, 'accn': 'x', 'unit': 'USD/shares'}, r)
        self.assertEqual(check['status'], 'afwijking')


class SchuldenAfgeleid(unittest.TestCase):
    def payload(self, totaal=1000, activa=1000, eigen=300, tijdelijk=None, accn_eigen='x'):
        def f(v, accn='x'):
            return [{'end': '2024-12-31', 'val': v, 'accn': accn, 'filed': '2025-02-01', 'form': '10-K'}]
        g = {'LiabilitiesAndStockholdersEquity': {'units': {'USD': f(totaal)}}, 'Assets': {'units': {'USD': f(activa)}},
             'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest': {'units': {'USD': f(eigen, accn_eigen)}}}
        if tijdelijk:
            g['TemporaryEquityCarryingAmountAttributableToParent'] = {'units': {'USD': f(tijdelijk)}}
        return {'facts': {'us-gaap': g}}

    def test_afgeleid(self):
        import extra_kentallen as ek
        self.assertEqual(ek._schulden_afgeleid(self.payload(), '2024-12-31', 'USD'), 700)
        self.assertEqual(ek._schulden_afgeleid(self.payload(tijdelijk=50), '2024-12-31', 'USD'), 650)

    def test_balans_sluit_niet_of_andere_indiening(self):
        import extra_kentallen as ek
        self.assertIsNone(ek._schulden_afgeleid(self.payload(totaal=1100), '2024-12-31', 'USD'))
        self.assertIsNone(ek._schulden_afgeleid(self.payload(accn_eigen='y'), '2024-12-31', 'USD'))

    def test_eigen_melding_gaat_voor(self):
        import extra_kentallen as ek
        p = self.payload()
        p['facts']['us-gaap']['Liabilities'] = {'units': {'USD': [{'end': '2024-12-31', 'val': 690, 'accn': 'x', 'filed': '2025-02-01', 'form': '10-K'}]}}
        self.assertEqual(ek.extra_jaarcijfers(p, [{'end': '2024-12-31', 'currency': 'USD'}])['2024-12-31']['total_liabilities'], 690)


class StabieleReeksNaSprong(unittest.TestCase):
    def rij(self, end, aandelen):
        return {'end': end, 'facts': {ev.EPS_FACT: {'val': 1.0, 'accn': f'a{end}', 'filed': end[:4] + '-12-31'}}}

    def test_sprong_aan_het_begin_valt_buiten_de_reeks_maar_aan_het_eind_niet(self):
        jaren = ['2016-12-31', '2017-12-31', '2018-12-31', '2019-12-31']
        for aandelen, verwacht in (([100, 130, 131, 132], '2017-12-31'), ([100, 101, 102, 140], None)):
            hist = [self.rij(e, a) for e, a in zip(jaren, aandelen)]
            inputs = [{'end': e, 'accn': f'a{e}', 'diluted_shares': a * 1e6, 'net_income': a * 1e6, 'currency': 'USD'}
                      for e, a in zip(jaren, aandelen)]
            res = ev.verify_eps({'split_events': [], 'eps_recompute_inputs': inputs}, hist, date(2026, 1, 1))
            if verwacht:
                self.assertTrue(res['no_splits'])
                self.assertEqual(sorted(res['eps_normalized']), jaren[1:])
            else:
                self.assertFalse(res['no_splits'])
