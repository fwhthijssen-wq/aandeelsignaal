"""Winst per aandeel uit de tabellen van een ESEF-jaarverslag (xhtml), voor bedrijven die het getal niet taggen."""
import sys, tempfile, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / 'hulp'))
import esef_tekst_eps as e

XHTML = '''<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body>
<p>El beneficio por acción es 0,79 en 2025 y otros 1,23 textos.</p>
<table><tr><td></td><td>2025</td><td>2024</td><td>Variación</td></tr>
<tr><td>BENEFICIO BÁSICO POR ACCIÓN (EN EUROS)</td><td>0,79</td><td>0,76</td><td>3,9%</td></tr>
<tr><td>BENEFICIO DILUIDO POR ACCIÓN (EN EUROS)</td><td>0,79</td><td>0,76</td><td>3,9%</td></tr>
<tr><td>Beneficio por acción ajustado por cupón AT1</td><td>0,83</td><td>0,80</td><td></td></tr>
<tr><td>Número de acciones (millones)</td><td>7.060</td><td>7.262</td><td></td></tr></table></body></html>'''


class EsefTekst(unittest.TestCase):
    def lees(self, tekst):
        with tempfile.NamedTemporaryFile('w', suffix='.xhtml', encoding='utf-8', delete=False) as f:
            f.write(tekst)
        return e.lees_rapport(f.name)

    def test_verwaterd_uit_tabel_met_jaartallenkop(self):
        r = self.lees(XHTML)
        self.assertTrue(r['komma'])
        labels = [g['label'] for g in r['regels']]
        self.assertEqual(len(labels), 2)                      # aangepast (AT1) en aantal aandelen vallen af
        r['period_end'] = '2025-12-31'
        self.assertEqual(e.kies_rapport(r)[:2], (0.79, 0.76))

    def test_tegenstrijdige_lezingen_geven_niets(self):
        extra = '<tr><td>Beneficio diluido por acción</td><td>0,81</td><td>0,76</td><td></td></tr></table>'
        r = self.lees(XHTML.replace('</table>', extra, 1))
        r['period_end'] = '2025-12-31'
        self.assertIsNone(e.kies_rapport(r))

    def test_getallen(self):
        self.assertEqual(e.getal('(1,25)', True), -1.25)
        self.assertEqual(e.getal('1,234.5', False), 1234.5)
        self.assertEqual(e.getal('–0,61', True), -0.61)


if __name__ == '__main__':
    unittest.main()
