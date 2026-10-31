"""Verwachtingen van analisten: bijstellingen, verrassingen en de volgende cijferdatum (alleen percentages)."""
import unittest
from verwachting import verwachting


class Verwachting(unittest.TestCase):
    def test_bijstelling_verrassingen_en_volgende_cijfers(self):
        trend = {'0y': {'current': 41.2, '30daysAgo': 38.3, '90daysAgo': 38.05}, '+1y': {'current': 55.9, '30daysAgo': 51.7, '90daysAgo': 51.1},
                 '0q': {'current': 15.4, '30daysAgo': 13.1, '90daysAgo': 13.1}}
        rev = {'0y': {'upLast30days': 2, 'downLast30days': 1}}
        cijfers = [('2027-01-27', 15.39, None, None), ('2026-10-14', 10.76, 11.82, 9.86), ('2026-07-13', 6.95, 7.58, 9.09),
                   ('2026-04-14', 6.62, 7.15, 7.99), ('2026-01-27', 7.55, 7.34, -2.72), ('2025-10-15', 5.37, 5.49, 2.14)]
        v = verwachting(trend, rev, cijfers, '2026-10-31')
        self.assertEqual(v['bijstelling']['dit_jaar'], {'d30': 7.6, 'd90': 8.3, 'omhoog': 2, 'omlaag': 1})
        self.assertEqual(v['bijstelling']['volgend_jaar']['d90'], 9.4)
        self.assertEqual([x['datum'] for x in v['verrassingen']], ['2026-10-14', '2026-07-13', '2026-04-14', '2026-01-27'])
        self.assertEqual(v['verrassingen'][0]['pct'], 9.9)
        self.assertEqual(v['volgende_cijfers'], '2027-01-27')

    def test_negatieve_basis_en_niets_bekend(self):
        v = verwachting({'0y': {'current': -0.5, '90daysAgo': -1.0}}, {}, [('2026-05-01', -1.0, -0.8, None)], '2026-10-31')
        self.assertEqual(v['bijstelling']['dit_jaar']['d90'], 50.0)        # verlies kleiner: bijstelling omhoog
        self.assertEqual(v['verrassingen'][0]['pct'], 20.0)               # verrassing berekend als Yahoo hem niet geeft
        self.assertIsNone(verwachting({}, {}, [], '2026-10-31'))
        self.assertNotIn('volgende_cijfers', verwachting(trend := {'0y': {'current': 2, '90daysAgo': 1}}, {}, [('2020-01-01', 1, None, None)], '2026-10-31'))


if __name__ == '__main__':
    unittest.main()
