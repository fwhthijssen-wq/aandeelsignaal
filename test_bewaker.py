"""Kwaliteitsbewaker: daling melden, bij een ernstige daling de vorige gegevens terugzetten."""
import json, tempfile, unittest
from pathlib import Path
import bewaker


def fonds(t, bev=False, jaren=6, koers='2026-10-27'):
    g = {'bron': 'ESEF', 'jaren': [{'year': 2016 + i, 'comparable_eps': 1.0} for i in range(jaren)]}
    if bev:
        g.update(eps_status='independently_verified', eps_verified_years=10, rejected_sources=0)
    return {'ticker': t, 'gegevens': g, 'koers': {'datum': koers, 'slot': 10}}


def bestand(fondsen):
    return {'gemaakt': '2026-10-28T02:00:00Z', 'aandelen': fondsen}


class Bewaker(unittest.TestCase):
    def test_kleine_wijziging_meldt_niet_bevestigd(self):
        oud = bestand([fonds('A', True), fonds('B', True)] + [fonds(f'X{i}') for i in range(20)])
        nieuw = bestand([fonds('A', True), fonds('B', False)] + [fonds(f'X{i}') for i in range(20)])
        to, tn, w, e = bewaker.vergelijk(oud, nieuw)
        self.assertEqual((to['bevestigd'], tn['bevestigd']), (2, 1))
        self.assertTrue(any('niet meer Bevestigd: B' in x for x in w)); self.assertEqual(e, [])

    def test_ernstige_daling_zet_vorige_terug(self):
        oud = bestand([fonds(f'X{i}') for i in range(40)])
        nieuw = bestand([fonds(f'X{i}', jaren=0 if i < 20 else 6) for i in range(40)])
        d = Path(tempfile.mkdtemp())
        (d / 'vorige.json').write_text(json.dumps(oud)); (d / 'data').mkdir(); (d / 'data' / 'aandelen.json').write_text(json.dumps(nieuw))
        import sys
        sys.argv = ['bewaker.py', str(d / 'vorige.json'), str(d / 'data' / 'aandelen.json')]
        self.assertEqual(bewaker.main(), 2)
        terug = json.loads((d / 'data' / 'aandelen.json').read_text())
        self.assertEqual(sum(1 for a in terug['aandelen'] if a['gegevens']['jaren']), 40)
        self.assertTrue((d / 'data' / 'aandelen.js').exists())


if __name__ == '__main__':
    unittest.main()
