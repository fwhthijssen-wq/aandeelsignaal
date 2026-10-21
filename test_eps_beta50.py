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
