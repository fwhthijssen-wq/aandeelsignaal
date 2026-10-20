"""Echte-browsertest van de webapp (Chromium via Playwright). Wordt overgeslagen als Playwright ontbreekt."""
import unittest
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:  # pragma: no cover
    sync_playwright = None

INDEX = (Path(__file__).resolve().parent / 'web' / 'index.html').as_uri()


@unittest.skipIf(sync_playwright is None, 'Playwright niet geïnstalleerd')
class WebUi(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.p = sync_playwright().start()
        try:
            cls.b = cls.p.chromium.launch()
        except Exception as e:  # geen browser beschikbaar
            cls.p.stop()
            raise unittest.SkipTest(f'Chromium niet beschikbaar: {e}')

    @classmethod
    def tearDownClass(cls):
        cls.b.close(); cls.p.stop()

    def pagina(self, breedte=390, intro=False):
        c = self.b.new_context(viewport={'width': breedte, 'height': 800})
        self.addCleanup(c.close)
        pg = c.new_page()
        self.fouten = []
        pg.on('pageerror', lambda e: self.fouten.append(str(e)))
        pg.on('console', lambda m: self.fouten.append(m.text) if m.type == 'error' else None)
        pg.goto(INDEX)
        if not intro:   # de rondleiding is alleen de eerste keer zichtbaar; de meeste tests slaan die over via de echte knop
            pg.click('#intro-sl')
            pg.wait_for_timeout(100)
        return pg

    def test_start_geen_fouten_en_geen_valse_bevestiging(self):
        pg = self.pagina()
        self.assertIn('op een rij', pg.inner_text('main').lower())
        # Demo-gegevens bevatten geen koersen: geen enkel aandeel mag 'Bevestigd' zijn.
        self.assertEqual(pg.locator('main .chip.ok').count(), 0)
        self.assertEqual(self.fouten, [])

    def test_aandeel_open_en_volglijst_blijft_bewaard(self):
        pg = self.pagina()
        pg.goto(INDEX + '#/a/AAPL/samenvatting')
        pg.click('#volg')
        pg.wait_for_timeout(300)   # opslag van de browser wegschrijven laten afronden
        pg.reload()
        pg.goto(INDEX + '#/volglijst')
        self.assertIn('Apple', pg.inner_text('main'))
        self.assertEqual(self.fouten, [])

    def test_alle_tabs_zonder_fouten_en_zonder_scrollbalk(self):
        pg = self.pagina()
        for t in ('samenvatting', 'koers', 'waarde', 'gezondheid', 'bronnen'):
            pg.goto(INDEX + f'#/a/AAPL/{t}')
            self.assertFalse(pg.evaluate('document.documentElement.scrollWidth>innerWidth'), t)
        self.assertEqual(self.fouten, [])

    def test_portefeuille_toevoegen_bewaren_verwijderen_en_waarde(self):
        pg = self.pagina()
        pg.goto(INDEX + '#/portefeuille')
        self.assertIn('nog geen aankopen', pg.inner_text('main'))
        pg.select_option('#pf-t', 'AAPL')
        self.assertTrue(pg.input_value('#pf-v'))
        pg.fill('#pf-n', '-3'); pg.fill('#pf-k', '100')
        pg.click('#pf button[type=submit]')
        self.assertTrue(pg.inner_text('#pf-fout').strip(), 'ongeldige invoer moet een melding geven')
        pg.fill('#pf-n', '10'); pg.fill('#pf-k', '100.5')
        pg.click('#pf button[type=submit]')
        self.assertIn('gekocht voor', pg.inner_text('main'))
        pg.wait_for_timeout(300)
        pg.reload()
        self.assertIn('gekocht voor', pg.inner_text('main'), 'moet na herladen blijven staan')
        # zonder verse koers: nooit een waarde of winst tonen
        pg.evaluate("AANDEEL_DATA.aandelen.forEach(a => { a.koers = null; })"); pg.evaluate("location.hash='#/'"); pg.evaluate("location.hash='#/portefeuille'")
        self.assertIn('Geen waarde', pg.inner_text('main'))
        self.assertFalse([l for l in pg.inner_text('main').split('\n') if l.startswith('Nu ')], 'geen waarde zonder verse koers')
        # met verse koers in dezelfde valuta: wel een waarde
        pg.evaluate("""() => { const d = new Date(), p = n => String(n).padStart(2, '0');
            const a = AANDEEL_DATA.aandelen.find(x => x.ticker === 'AAPL');
            a.koers = { slot: 200, datum: d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()), sma50: 190, reeks: [] };
            location.hash = '#/'; location.hash = '#/portefeuille'; }""")
        txt = pg.inner_text('main')
        self.assertIn('Nu 2.000,00', txt)
        self.assertIn('+995,00', txt)
        # andere valuta bij de aankoop: niet omrekenen
        pg.evaluate("AANDEEL_DATA.aandelen.find(x => x.ticker === 'AAPL').valuta = 'EUR'"); pg.evaluate("location.hash='#/'"); pg.evaluate("location.hash='#/portefeuille'")
        self.assertIn('niet omgerekend', pg.inner_text('main'))
        # verwijderen en ongedaan maken
        pg.click('[data-weg]')
        self.assertIn('nog geen aankopen', pg.inner_text('main'))
        pg.click('#ong')
        self.assertIn('gekocht voor', pg.inner_text('main'))
        self.assertEqual(self.fouten, [])

    def test_portefeuille_zonder_scrollbalk_op_smal_scherm(self):
        pg = self.pagina(320)
        pg.goto(INDEX + '#/portefeuille')
        self.assertFalse(pg.evaluate('document.documentElement.scrollWidth>innerWidth'))
        pg.goto(INDEX + '#/')
        self.assertFalse(pg.evaluate('document.documentElement.scrollWidth>innerWidth'), 'menu met 5 items past op 320px')

    def test_dashboard_op_start_tabel_filter_en_spreiding(self):
        pg = self.pagina(320)
        txt = pg.inner_text('#dash')
        self.assertIn('Dashboard', txt)
        self.assertNotIn('0 / 22', txt)
        self.assertEqual(pg.locator('#dash table.dash tbody tr').count(), 22)
        # onbevestigd: geen enkel groei- of margecijfer, alleen streepjes
        self.assertNotIn('%', pg.inner_text('#dash table.dash tbody'))
        self.assertEqual(pg.locator('[data-spreiding]').count(), 0)   # nog geen portefeuille
        pg.check('#d-bev')
        self.assertEqual(pg.locator('#dash table.dash').count(), 0)
        self.assertIn('Geen aandelen die aan dit filter voldoen', pg.inner_text('#dash'))
        pg.uncheck('#d-bev')
        pg.select_option('#d-sort', 'nettomarge')
        pg.click('#d-rtg')
        self.assertIn('Aflopend', pg.inner_text('#dash'))
        self.assertTrue(pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        self.assertEqual(self.fouten, [])

    def test_dashboard_spreiding_per_land_en_valuta_met_verse_koersen(self):
        c = self.b.new_context(viewport={'width': 390, 'height': 800})
        self.addCleanup(c.close)
        c.add_init_script("""(function(){var v;Object.defineProperty(window,'AANDEEL_DATA',{configurable:true,
          get:function(){return v;},set:function(d){var t=new Date().toISOString().slice(0,10);
          d.aandelen.forEach(function(a){if(a.ticker==='AAPL')a.koers={slot:200,datum:t,sma50:180};
          if(a.ticker==='ASML.AS')a.koers={slot:700,datum:t,sma50:650};
          if(a.ticker==='MSFT')a.koers={slot:400,datum:'2020-01-01',sma50:380};});v=d;}});
          try{localStorage.setItem('aandeelsignaal.v1',JSON.stringify({volglijst:[],introGezien:true,
          portefeuille:[{id:'1',ticker:'AAPL',aantal:3,koers:100,valuta:'USD',datum:'2024-01-01'},
          {id:'2',ticker:'ASML.AS',aantal:1,koers:500,valuta:'EUR',datum:'2024-01-01'},
          {id:'3',ticker:'MSFT',aantal:1,koers:300,valuta:'USD',datum:'2024-01-01'}]}));}catch(e){}})();""")
        pg = c.new_page()
        fouten = []
        pg.on('pageerror', lambda e: fouten.append(str(e)))
        pg.goto(INDEX)
        pg.wait_for_timeout(200)
        txt = pg.inner_text('#dash')
        self.assertEqual(pg.locator('[data-spreiding]').count(), 2)   # USD en EUR apart
        self.assertIn('100%', pg.locator('[data-spreiding="USD"]').inner_text())
        self.assertIn('Verenigde Staten', pg.locator('[data-spreiding="USD"]').inner_text())
        self.assertIn('Nederland', pg.locator('[data-spreiding="EUR"]').inner_text())
        self.assertIn('Aankopen zonder waarde', txt)   # MSFT: koers verouderd
        self.assertEqual(fouten, [])

    def _naic_extra_pagina(self, bank):
        c = self.b.new_context(viewport={'width': 320, 'height': 800})
        self.addCleanup(c.close)
        c.add_init_script("""(function(){var v;Object.defineProperty(window,'AANDEEL_DATA',{configurable:true,get:function(){return v;},
          set:function(d){var t=new Date().toISOString().slice(0,10);
          d.aandelen.forEach(function(a){if(a.ticker==='AAPL'){a.koers={slot:200,datum:t,sma50:180};
            a.gegevens.jaren.forEach(function(j,i){if(i>0){j.pretax_income=j.net_income*1.2;j.dividends_paid=j.net_income*0.25;
              j.long_term_debt=j.equity*0.5;j.depreciation=j.capex*0.8;}});
            if(%s)a.gegevens.waarschuwingen.push('Bank: kasstroom, investeringen en winstmarge vragen sectorspecifieke interpretatie.');}});v=d;}});
          try{localStorage.setItem('aandeelsignaal.v1',JSON.stringify({volglijst:[],introGezien:true}));}catch(e){}})();""" % ('true' if bank else 'false'))
        pg = c.new_page()
        self.fouten = []
        pg.on('pageerror', lambda e: self.fouten.append(str(e)))
        pg.goto(INDEX + '#/a/AAPL/waarde')
        pg.wait_for_timeout(200)
        return pg

    def test_naic_extra_kentallen_en_bank_krijgt_ze_niet(self):
        pg = self._naic_extra_pagina(False)
        t = pg.inner_text('main')
        for kop in ('Winstmarge vóór belasting', 'Uitgekeerd deel van de winst', 'Schuld t.o.v. totaal kapitaal', 'Investeringen t.o.v. afschrijvingen'):
            self.assertIn(kop, t)
        self.assertEqual(pg.locator('#naic-extra ~ section svg.grafiek').count(), 4)
        self.assertTrue(pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        pb = self._naic_extra_pagina(True)
        tb = pb.inner_text('main')
        self.assertIn('Uitgekeerd deel van de winst', tb)
        for kop in ('Winstmarge vóór belasting', 'Schuld t.o.v. totaal kapitaal', 'Investeringen t.o.v. afschrijvingen'):
            self.assertNotIn(kop, tb)
        self.assertEqual(self.fouten, [])

    def test_versie_in_instellingen_komt_overeen_met_versiebestand(self):
        pg = self.pagina()
        pg.goto(INDEX + '#/instellingen')
        versie = (Path(__file__).resolve().parent / 'VERSION').read_text().strip()
        self.assertIn('Versie ' + versie, pg.inner_text('main'))

    def test_rondleiding_eerste_keer_dan_nooit_meer_en_opnieuw_via_hulp(self):
        pg = self.pagina(intro=True)
        self.assertEqual(pg.locator('.intro').count(), 1)
        self.assertIn('Welkom', pg.inner_text('.intro'))
        pg.click('#intro-vk'); self.assertIn('Bevestigd', pg.inner_text('.intro'))
        pg.click('#intro-vk'); self.assertIn('Uw gegevens', pg.inner_text('.intro'))
        self.assertEqual(pg.locator('#intro-sl').count(), 0, 'op de laatste stap geen Overslaan')
        pg.click('#intro-vk')
        self.assertEqual(pg.locator('.intro').count(), 0)
        pg.wait_for_timeout(300)
        pg.reload()
        self.assertEqual(pg.locator('.intro').count(), 0, 'na afronden niet opnieuw tonen')
        pg.goto(INDEX + '#/hulp'); pg.click('#intro-opnieuw')
        self.assertEqual(pg.locator('.intro').count(), 1)
        pg.keyboard.press('Escape')
        self.assertEqual(pg.locator('.intro').count(), 0)
        self.assertEqual(self.fouten, [])

    def test_rondleiding_overslaan_telt_als_gezien_en_past_op_smal_scherm(self):
        pg = self.pagina(320, intro=True)
        box = pg.locator('.intro').bounding_box()
        self.assertGreaterEqual(box['x'], 0); self.assertLessEqual(box['x'] + box['width'], 320)
        pg.click('#intro-sl')
        pg.wait_for_timeout(300)
        pg.reload()
        self.assertEqual(pg.locator('.intro').count(), 0)

    def test_vergelijken_toont_alleen_cijfers_bij_bevestigd_en_past_op_smal_scherm(self):
        pg = self.pagina(320)
        pg.goto(INDEX + '#/vergelijk/AAPL/MSFT')
        self.assertFalse(pg.evaluate('document.documentElement.scrollWidth>innerWidth'))
        pg.evaluate("""() => { const d = new Date(), p = n => String(n).padStart(2, '0');
            const t = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
            const jr = Array.from({ length: 10 }, (_, i) => ({ year: 2016 + i, sales: 100e9 * Math.pow(1.1, i), comparable_eps: 2 * Math.pow(1.1, i), net_income: 20e9 * Math.pow(1.1, i) }));
            AANDEEL_DATA.aandelen.forEach(a => { a.koers = { slot: 100, datum: t, sma50: 90, reeks: [] }; });
            const ok = AANDEEL_DATA.aandelen.find(a => a.ticker === 'AAPL');
            ok.gegevens = { eps_status: 'independently_verified', eps_verified_years: 10, currencies: [ok.valuta], rejected_sources: 0, fout: null, jaren: jr };
            const nee = AANDEEL_DATA.aandelen.find(a => a.ticker === 'MSFT');
            nee.gegevens = Object.assign({}, ok.gegevens, { eps_verified_years: 4, eps_status: 'partially_independently_verified', currencies: [nee.valuta] });
            location.hash = '#/'; location.hash = '#/vergelijk/AAPL/MSFT'; }""")
        tekst = pg.inner_text('main')
        self.assertIn('+10,0%', tekst, 'bevestigd aandeel toont groei')
        self.assertEqual(tekst.count('+10,0%'), 2, 'groei van het onbevestigde aandeel mag niet verschijnen (omzet en winst van AAPL = 2)')
        self.assertIn('Waarom ontbreken er cijfers', tekst)
        pg.select_option('#vg-b', 'AAPL')
        self.assertIn('Kies twee verschillende aandelen', pg.inner_text('main'))
        self.assertIn('AAPL', pg.evaluate('location.hash'))
        self.assertEqual(self.fouten, [])

    def test_naic_gids_stappen_en_koerszones(self):
        pg = self.pagina()
        pg.goto(INDEX + '#/a/AAPL/waarde')
        tekst = pg.inner_text('main')
        for kop in ('Stap 1', 'Stap 2', 'Stap 3', 'Stap 4'):
            self.assertIn(kop, tekst)
        self.assertFalse(pg.evaluate('document.documentElement.scrollWidth>innerWidth'))
        pg.fill('#v-z-kwl', '30')   # lage K/W boven hoge K/W: geweigerd
        self.assertIn('Controleer de getallen', pg.inner_text('#zones'))
        pg.fill('#v-z-kwl', '10')
        self.assertIn('Hoge koers', pg.inner_text('#zones'))
        # zonder verse koers: zones wel, vergelijking niet
        pg.evaluate("AANDEEL_DATA.aandelen.find(a => a.ticker === 'AAPL').koers = null; location.hash = '#/'; location.hash = '#/a/AAPL/waarde'")
        self.assertIn('Geen vergelijking met de koers', pg.inner_text('#zones'))
        self.assertNotIn(' : 1', pg.inner_text('#zones'))
        # met verse koers en bevestigd: wel een zone
        pg.evaluate("""() => { const d = new Date(), p = n => String(n).padStart(2, '0');
            const a = AANDEEL_DATA.aandelen.find(x => x.ticker === 'AAPL');
            a.koers = { slot: 100, datum: d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()), sma50: 40, reeks: [] };
            location.hash = '#/'; location.hash = '#/a/AAPL/waarde'; }""")
        z = pg.inner_text('#zones')
        self.assertIn('koopzone', z)
        self.assertIn(': 1', z)
        self.assertEqual(self.fouten, [])

    def test_waarde_rekenvoorbeeld_reageert(self):
        pg = self.pagina()
        pg.goto(INDEX + '#/a/AAPL/waarde')
        voor = pg.inner_text('#uitkomst')
        pg.fill('#v-groei', '12')
        self.assertNotEqual(voor, pg.inner_text('#uitkomst'))
        pg.fill('#v-marge', '150')
        self.assertIn('Controleer de getallen', pg.inner_text('#uitkomst'))

    def test_onbekend_aandeel_en_zoeken(self):
        pg = self.pagina()
        pg.goto(INDEX + '#/a/ZZZZ')
        self.assertIn('Niet gevonden', pg.inner_text('main'))
        pg.goto(INDEX + '#/zoek')
        pg.fill('#q', 'asml')
        self.assertIn('ASML', pg.inner_text('#res'))

    def test_donker_thema_kiezen(self):
        pg = self.pagina()
        pg.goto(INDEX + '#/instellingen')
        pg.click('[data-th="donker"]')
        self.assertEqual(pg.evaluate("document.documentElement.getAttribute('data-theme')"), 'donker')

    def test_geen_html_injectie_via_zoektekst(self):
        pg = self.pagina()
        pg.goto(INDEX + '#/zoek')
        pg.fill('#q', '<img src=x onerror=window.hack=1>')
        self.assertIsNone(pg.evaluate('window.hack'))


if __name__ == '__main__':
    unittest.main()
