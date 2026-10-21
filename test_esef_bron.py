import unittest
from esef_bron import omzetten, companyfacts, sec_vorm_fetcher, samenvatting
from eps_verification import sec_eps_recompute_inputs

LEI = '5493001KJTIIGC8Y1R12'


def feit(concept, per, waarde, unit='iso4217:EUR', **dims):
    return {'value': str(waarde), 'dimensions': {'concept': concept, 'entity': 'scheme:' + LEI, 'period': per, 'unit': unit, **dims}}


def rapport(jaar, winst, aandelen, eps, nci=None):
    p = f'{jaar}-01-01T00:00:00/{jaar + 1}-01-01T00:00:00'
    f = {'a': feit('ifrs-full:ProfitLoss', p, winst), 'b': feit('ifrs-full:AdjustedWeightedAverageShares', p, aandelen, 'xbrli:shares'),
         'c': feit('ifrs-full:DilutedEarningsLossPerShare', p, eps, 'iso4217:EUR/xbrli:shares'),
         'd': feit('ifrs-full:ProfitLoss', p, 1.0, **{'ifrs-full:ComponentsOfEquityAxis': 'ifrs-full:OtherReservesMember'}),
         'e': feit('asml:Eigen', p, 5)}
    if nci is not None:
        f['n'] = feit('ifrs-full:ProfitLossAttributableToNoncontrollingInterests', p, nci)
    return {'facts': f}


def filing(jaar):
    return {'fxo_id': f'{LEI}-{jaar}-12-31-ESEF-NL-0', 'period_end': f'{jaar}-12-31', 'date_added': f'{jaar + 1}-03-01 00:00:00'}


class Omzetten(unittest.TestCase):
    def test_periode_eenheid_en_dimensies(self):
        uit = omzetten(rapport(2022, 1234567.0, 1000.0, 1234.57), filing(2022))
        rij = uit['facts']['ifrs-full']['ProfitLoss']['units']['EUR']
        self.assertEqual(len(rij), 1)                        # de feit met segment-dimensie is niet overgenomen
        self.assertEqual((rij[0]['start'], rij[0]['end']), ('2022-01-01', '2022-12-31'))   # einde is exclusief in xBRL-JSON
        self.assertEqual(rij[0]['filed'], '2023-03-01')
        self.assertIn('shares', uit['facts']['ifrs-full']['AdjustedWeightedAverageShares']['units'])
        self.assertIn('EUR/shares', uit['facts']['ifrs-full']['DilutedEarningsLossPerShare']['units'])
        self.assertNotIn('asml', uit['facts'])

    def test_instant_en_rommel_worden_veilig_behandeld(self):
        doc = {'facts': {'x': feit('ifrs-full:Equity', '2023-01-01T00:00:00', 777.5), 'y': feit('ifrs-full:Equity', 'onzin', 1),
                         'z': {'value': 'tekst', 'dimensions': {'concept': 'ifrs-full:Equity', 'period': '2023-01-01T00:00:00', 'unit': 'iso4217:EUR'}}}}
        rij = omzetten(doc, filing(2022))['facts']['ifrs-full']['Equity']['units']['EUR']
        self.assertEqual(len(rij), 1)
        self.assertEqual(rij[0]['end'], '2022-12-31')
        self.assertNotIn('start', rij[0])


class Herberekening(unittest.TestCase):
    def cf(self, nci=None, eps_fout=0.0):
        uit = {'facts': {}}
        for jaar in (2021, 2022, 2023):
            omzetten(rapport(jaar, 123456789.0, 1234567.0, round(123456789.0 / 1234567.0 + eps_fout, 2), nci), filing(jaar), uit)
        return uit

    def test_profitloss_zonder_minderheid_wordt_onderbouwd(self):
        r = sec_eps_recompute_inputs(self.cf(), '2026-01-01')
        self.assertEqual(len(r), 3)
        self.assertIn('ProfitLoss (geen minderheidsbelang gerapporteerd)', r[0]['source'])
        self.assertAlmostEqual(r[0]['net_income'], 123456789.0)

    def test_minderheidsbelang_wordt_afgetrokken(self):
        r = sec_eps_recompute_inputs(self.cf(nci=23456789.0), '2026-01-01')
        self.assertAlmostEqual(r[0]['net_income'], 100000000.0)
        self.assertIn('minus', r[0]['source'])

    def test_afwijkende_eps_blijft_onbewezen(self):
        from bouw_webdata import gegevens_uit_esef
        cf = self.cf(eps_fout=0.5)
        cf.update(lei=LEI, entityName='X')
        g = gegevens_uit_esef(cf, '2026-01-01')
        self.assertNotEqual(g['eps_status'], 'independently_verified')
        self.assertFalse(g['eps_verified_years'])

    def test_fetcher_geeft_alleen_de_eigen_lei(self):
        cf = self.cf(); cf.update(lei=LEI, entityName='X')
        f = sec_vorm_fetcher(cf)
        import source_engine
        self.assertEqual(f(source_engine.CIK_MAP_URL)['0']['ticker'], LEI)
        with self.assertRaises(ValueError):
            f('https://example.invalid/')


class Ophalen(unittest.TestCase):
    def test_onleesbaar_rapport_wordt_overgeslagen_rest_blijft(self):
        def oph(url):
            if url.endswith('/filings'):
                return {'data': [{'attributes': {'fxo_id': filing(j)['fxo_id'], 'period_end': filing(j)['period_end'], 'date_added': filing(j)['date_added'], 'json_url': f'/r{j}.json'}} for j in (2021, 2022)]}
            if '2022' in url:
                raise OSError('stuk')
            return rapport(2021, 5.5, 3.0, 1.83)
        cf = companyfacts(LEI, 'X', oph)
        self.assertEqual([r['period_end'] for r in cf['rapporten']], ['2021-12-31'])
        self.assertEqual(len(cf['overgeslagen']), 1)


if __name__ == '__main__':
    unittest.main()


class GewoneWinstPerAandeel(unittest.TestCase):
    """ABN AMRO meldt alleen de gewone winst per aandeel (geen verwaterde): die wordt gebruikt, en gemarkeerd."""

    def cf(self, tag):
        uit = {'facts': {'ifrs-full': {tag: {'units': {'EUR/shares': []}}}}, 'rapporten': []}
        for jaar, (eps, vorig) in {2023: (2.99, 1.96), 2024: (2.72, 2.99), 2025: (2.45, 2.72)}.items():
            accn = f'r{jaar}'
            uit['rapporten'].append({'fxo_id': accn, 'period_end': f'{jaar}-12-31'})
            for j, v in ((jaar, eps), (jaar - 1, vorig)):
                uit['facts']['ifrs-full'][tag]['units']['EUR/shares'].append(
                    {'start': f'{j}-01-01', 'end': f'{j}-12-31', 'val': v, 'accn': accn, 'filed': f'{jaar + 1}-03-01', 'form': '20-F'})
        return uit

    def test_keten_met_gewone_winst_per_aandeel(self):
        from esef_bron import eps_keten
        self.assertEqual(eps_keten(self.cf('BasicEarningsLossPerShare'), min_jaren=3),
                         {'2022-12-31': 1.96, '2023-12-31': 2.99, '2024-12-31': 2.72, '2025-12-31': 2.45})

    def test_verwaterd_gaat_voor(self):
        from esef_bron import eps_keten
        cf = self.cf('BasicEarningsLossPerShare')
        cf['facts']['ifrs-full']['DilutedEarningsLossPerShare'] = {'units': {'EUR/shares': [
            dict(r, val=r['val'] - 0.01) for r in cf['facts']['ifrs-full']['BasicEarningsLossPerShare']['units']['EUR/shares']]}}
        self.assertAlmostEqual(eps_keten(cf, min_jaren=3)['2025-12-31'], 2.44)
