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
        self.assertEqual(pg.locator('#dash table.dash tbody tr').count(), pg.evaluate('window.AANDEEL_DATA.aandelen.length'))
        # onbevestigd: geen enkel groei- of margecijfer, alleen streepjes
        self.assertNotIn('%', ' '.join(pg.locator('#dash table.dash tbody td').all_inner_texts()))   # cellen: geen valse cijfers (de oordeel-chip staat in de kopcel)
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

    def test_timing_kaart_alleen_met_verse_koers_en_zonder_invloed_op_signaal(self):
        def ctx(datum):
            c = self.b.new_context(viewport={'width': 390, 'height': 800})
            self.addCleanup(c.close)
            c.add_init_script("""(function(){var v;Object.defineProperty(window,'AANDEEL_DATA',{configurable:true,
              get:function(){return v;},set:function(d){d.aandelen.forEach(function(a){if(a.ticker==='AAPL')a.koers={slot:123.45,datum:'%s',
              sma50:118.2,sma200:131.9,hoog52:150.3,laag52:101.7,rsi14:62.34,reeks:[['2026-10-01',120.5],['2026-10-02',121.7],['2026-10-05',123.45]]};});v=d;}});
              try{localStorage.setItem('aandeelsignaal.v1',JSON.stringify({volglijst:[],introGezien:true,portefeuille:[]}));}catch(e){}})();""" % datum)
            pg = c.new_page()
            fouten = []
            pg.on('pageerror', lambda e: fouten.append(str(e)))
            return pg, fouten
        import datetime
        pg, fouten = ctx(datetime.date.today().isoformat())
        pg.goto(INDEX + '#/a/AAPL/koers')
        pg.wait_for_timeout(200)
        txt = pg.locator('[data-timing]').inner_text()
        self.assertIn('Timing (informatie)', txt)
        self.assertIn('onder', txt)            # onder SMA200
        self.assertIn('45%', txt)              # plek in jaarbereik
        self.assertIn('geen invloed op het signaal', txt)
        pg2, fouten2 = ctx('2020-01-01')
        pg2.goto(INDEX + '#/a/AAPL/koers')
        pg2.wait_for_timeout(200)
        self.assertEqual(pg2.locator('[data-timing]').count(), 0)
        self.assertEqual(fouten + fouten2, [])

    def test_dashboard_trendfilter_200_dagen(self):
        import datetime
        c = self.b.new_context(viewport={'width': 390, 'height': 800})
        self.addCleanup(c.close)
        c.add_init_script("""(function(){var v;Object.defineProperty(window,'AANDEEL_DATA',{configurable:true,
          get:function(){return v;},set:function(d){var t='%s';d.aandelen.forEach(function(a){
          if(a.ticker==='AAPL')a.koers={slot:90,datum:t,sma50:95,sma200:100,reeks:[['2026-10-01',90]]};
          if(a.ticker==='MSFT')a.koers={slot:110,datum:t,sma50:95,sma200:100,reeks:[['2026-10-01',110]]};});v=d;}});
          try{localStorage.setItem('aandeelsignaal.v1',JSON.stringify({volglijst:[],introGezien:true,portefeuille:[]}));}catch(e){}})();""" % datetime.date.today().isoformat())
        pg = c.new_page()
        fouten = []
        pg.on('pageerror', lambda e: fouten.append(str(e)))
        pg.goto(INDEX)
        pg.wait_for_timeout(200)
        pg.select_option('#d-trend', 'onder')
        rijen = pg.inner_text('#dash table.dash tbody')
        self.assertIn('Apple', rijen)
        self.assertNotIn('Microsoft', rijen)
        pg.select_option('#d-trend', 'boven')
        rijen = pg.inner_text('#dash table.dash tbody')
        self.assertIn('Microsoft', rijen)
        self.assertNotIn('Apple', rijen)
        self.assertEqual(fouten, [])

    def _pagina_met_indexen(self, hash_, breedte=390):
        import datetime
        c = self.b.new_context(viewport={'width': breedte, 'height': 800})
        self.addCleanup(c.close)
        c.add_init_script("""(function(){var v;Object.defineProperty(window,'AANDEEL_DATA',{configurable:true,get:function(){return v;},
          set:function(d){var t='%s';d.aandelen.forEach(function(a){
            if(a.ticker==='ASML.AS')a.indices=['AEX'];
            if(a.ticker==='SAP.DE')a.indices=['DAX'];
            if(a.ticker==='INGA.AS')a.indices=['AEX'];
            if(a.ticker==='MSFT')a.gegevens=null;
            if(a.ticker==='AAPL'||a.ticker==='MSFT'){a.koers={slot:70.5,datum:t,sma50:70,reeks:[['2026-10-01',70],['2026-10-02',70.5]],bereik:{hoog:165.7,laag:40,van:'2016-10-17',tot:'2026-10-16',jaren:10}};}});v=d;}});
          try{localStorage.setItem('aandeelsignaal.v1',JSON.stringify({volglijst:[],introGezien:true}));}catch(e){}})();""" % datetime.date.today().isoformat())
        pg = c.new_page()
        self.fouten = []
        pg.on('pageerror', lambda e: self.fouten.append(str(e)))
        pg.goto(INDEX + hash_)
        pg.wait_for_timeout(200)
        return pg

    def test_zoeken_filter_op_index(self):
        pg = self._pagina_met_indexen('#/zoek')
        pg.select_option('#zi', 'AEX')
        t = pg.inner_text('#res')
        self.assertIn('ASML', t)
        self.assertNotIn('SAP', t)
        self.assertNotIn('Apple', t)
        pg.select_option('#zi', 'DAX')
        self.assertIn('SAP', pg.inner_text('#res'))
        pg.select_option('#zi', '')
        pg.fill('#q', 'apple')
        self.assertIn('Apple', pg.inner_text('#res'))
        self.assertEqual(self.fouten, [])

    def test_dashboard_filter_op_index(self):
        pg = self._pagina_met_indexen('#/')
        pg.select_option('#d-index', 'AEX')
        rijen = pg.inner_text('#dash table.dash tbody')
        self.assertIn('ASML', rijen)
        self.assertIn('ING', rijen)
        self.assertNotIn('SAP', rijen)
        self.assertEqual(pg.locator('#dash table.dash tbody tr').count(), 2)
        self.assertEqual(self.fouten, [])

    def test_uit_jaarverslag_toont_cijfers_met_uitleg_maar_geen_label(self):
        pg = self.pagina(320)
        pg.evaluate("""() => { const a = AANDEEL_DATA.aandelen.find(x => x.ticker === 'AAPL');
            a.gegevens = Object.assign({}, a.gegevens, { eps_status: 'missing_split_evidence', eps_verified_years: 0, niveau: 'jaarverslag' }); }""")
        pg.evaluate("location.hash='#/a/AAPL/gezondheid'")
        pg.wait_for_timeout(150)
        self.assertEqual(pg.locator('[data-jaarverslag]').count(), 1)
        self.assertIn('niet zelf nagerekend', pg.locator('[data-jaarverslag]').inner_text())
        pg.evaluate("location.hash='#/a/AAPL/samenvatting'")
        pg.wait_for_timeout(150)
        self.assertEqual(pg.locator('main .chip[data-niveau="jaarverslag"]').count(), 1)
        self.assertEqual(pg.locator('main .chip.ok').count(), 0)
        pg.evaluate("location.hash='#/a/AAPL/koers'")
        pg.wait_for_timeout(150)
        self.assertEqual(pg.locator('[data-label]').count(), 0)
        pg.evaluate("location.hash='#/'")
        pg.wait_for_timeout(150)
        self.assertTrue(pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        self.assertEqual(self.fouten, [])

    def test_hulpknop_geeft_uitleg_bij_de_pagina_waar_u_bent(self):
        pg = self._pagina_met_indexen('#/')
        self.assertEqual(pg.locator('#hulp-knop').count(), 1)
        pg.click('#hulp-knop')
        self.assertIn('Start', pg.locator('#ph-t').inner_text())
        pg.keyboard.press('Escape')
        self.assertEqual(pg.locator('#ph-t').count(), 0)
        for hash_, woord in (('#/portefeuille', 'portefeuille'), ('#/instellingen', 'back-up'), ('#/a/MSFT/check', 'Verdiepen'), ('#/a/MSFT/waarde', 'NAIC')):
            pg.evaluate("h => location.hash = h", hash_)
            pg.wait_for_timeout(150)
            pg.click('#hulp-knop')
            self.assertIn(woord.lower(), pg.locator('.hulp-blad').inner_text().lower(), hash_)
            self.assertTrue(pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
            pg.click('#ph-sluit')
        pg.click('#hulp-knop'); pg.click('#ph-alles')
        pg.wait_for_timeout(150)
        self.assertEqual(pg.evaluate('location.hash'), '#/hulp')
        self.assertEqual(pg.locator('.hulp-blad').count(), 0)
        self.assertEqual(self.fouten, [])

    def test_methode_aanklikken_toont_wat_erachter_zit(self):
        pg = self._pagina_met_indexen('#/a/MSFT/samenvatting')
        knoppen = pg.locator('[data-signaal] .meth-knop')
        self.assertGreaterEqual(knoppen.count(), 3)
        pg.click('[data-signaal] .meth-knop >> nth=0')
        tekst = pg.locator('.hulp-blad').inner_text()
        for kop in ('Wat meet dit?', 'Hoe wordt het beoordeeld?', 'Gewicht en betrouwbaarheid'):
            self.assertIn(kop, tekst)
        self.assertTrue(pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        pg.keyboard.press('Escape')
        self.assertEqual(pg.locator('.hulp-blad').count(), 0)
        pg.locator('[data-signaal] details summary').click()
        pg.click('[data-signaal] details .meth-knop >> nth=0')
        self.assertIn('Wat is er nodig?', pg.locator('.hulp-blad').inner_text())
        pg.click('#mt-sluit')
        self.assertEqual(self.fouten, [])

    def test_totaalbeeld_detail_dashboard_en_minimum_in_instellingen(self):
        pg = self._pagina_met_indexen('#/a/MSFT/samenvatting')
        kaart = pg.locator('[data-signaal]')
        self.assertEqual(kaart.count(), 1)
        dek = int(pg.locator('[data-dekking]').get_attribute('data-dekking'))
        self.assertTrue(0 < dek < 25, dek)                                  # alleen koers en bereik: onder het standaardminimum
        self.assertEqual(pg.locator('[data-signaal] [data-oordeel="geen"]').count(), 1)
        self.assertIn('Plek in koersbereik', kaart.inner_text())
        self.assertIn('Wat ontbreekt er nog', kaart.inner_text())
        pg.evaluate("location.hash='#/instellingen'")
        pg.wait_for_timeout(150)
        pg.select_option('#mind', '40')
        self.assertEqual(pg.evaluate("localStorage.getItem('as_mindekking')"), '40')
        pg.evaluate("localStorage.setItem('as_mindekking', '5')")     # lager dan het keuzemenu: de test heeft weinig koersgegevens
        pg.wait_for_timeout(100)
        pg.evaluate("location.hash='#/a/MSFT/samenvatting'")
        pg.wait_for_timeout(150)
        self.assertEqual(pg.locator('[data-signaal] [data-oordeel="geen"]').count(), 0)   # met minimum 5% is er een voorlopig oordeel
        self.assertIn('voorlopig oordeel', pg.locator('[data-signaal]').inner_text())
        pg.evaluate("location.hash='#/'")
        pg.wait_for_timeout(150)
        self.assertEqual(pg.locator('[data-kansrijk]').count(), 1)
        self.assertTrue(pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        self.assertEqual(self.fouten, [])

    def test_verdiepen_eigen_invoer_verhoogt_de_dekking_en_blijft_bewaard(self):
        pg = self.pagina(320)
        pg.goto(INDEX + '#/a/ASML.AS/check')
        pg.wait_for_timeout(150)
        d0 = int(pg.locator('#vd-meter [data-dekking]').get_attribute('data-dekking'))
        pg.click('[data-vd-score="management"] [data-cijfer="5"]')
        d1 = int(pg.locator('#vd-meter [data-dekking]').get_attribute('data-dekking'))
        self.assertGreater(d1, d0)
        self.assertEqual(pg.locator('[data-vd-score="management"] [aria-pressed="true"]').count(), 1)
        pg.fill('#vd-c-roe', '18,5'); pg.dispatch_event('#vd-c-roe', 'change')
        d2 = int(pg.locator('#vd-meter [data-dekking]').get_attribute('data-dekking'))
        self.assertGreater(d2, d1)
        self.assertIn('eigen invoer', pg.locator('#vd-meter').inner_text())
        pg.fill('#vd-c-roe', 'abc'); pg.dispatch_event('#vd-c-roe', 'change')
        self.assertTrue(pg.locator('[data-vd-cijfer="roe"] [data-vd-fout]').inner_text())
        pg.wait_for_timeout(300)
        pg.reload(); pg.wait_for_timeout(200)
        self.assertEqual(pg.locator('[data-vd-score="management"] [aria-pressed="true"]').get_attribute('data-cijfer'), '5')
        self.assertEqual(pg.input_value('#vd-c-roe'), '18,5')
        pg.click('[data-vd-score="management"] [data-cijfer="5"]')                      # nogmaals klikken wist
        self.assertEqual(pg.locator('[data-vd-score="management"] [aria-pressed="true"]').count(), 0)
        self.assertTrue(pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        self.assertEqual(self.fouten, [])

    def test_volgen_legt_startpunt_vast_en_portefeuille_markeert_op_signaal(self):
        pg = self._pagina_met_indexen('#/a/AAPL/samenvatting', 390)
        pg.click('#volg')
        pg.wait_for_timeout(250)
        pg.evaluate("location.hash='#/volglijst'"); pg.wait_for_timeout(200)
        t = pg.locator('[data-volg="AAPL"]').inner_text()
        self.assertIn('Sinds', t); self.assertIn('Oordeel toen', t)
        pg.evaluate("location.hash='#/portefeuille'"); pg.wait_for_timeout(200)
        pg.select_option('#pf-t', 'AAPL')
        pg.fill('#pf-n', '2'); pg.fill('#pf-k', '60')
        pg.check('#pf-sig')
        pg.click('#pf button[type="submit"]'); pg.wait_for_timeout(250)
        self.assertEqual(pg.locator('[data-op-signaal]').count(), 1)
        self.assertIn('Op signaal gekocht', pg.locator('[data-op-signaal]').inner_text())
        self.assertEqual(pg.locator('[data-herkomst]').count(), 1)
        pg.select_option('#pf-t', 'AAPL'); pg.fill('#pf-n', '1'); pg.fill('#pf-k', '65')
        pg.click('#pf button[type="submit"]'); pg.wait_for_timeout(250)
        self.assertEqual(pg.locator('[data-op-signaal]').count(), 1)                    # tweede aankoop zonder vinkje: geen herkomst
        self.assertTrue(pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        self.assertEqual(self.fouten, [])

    def test_dashboard_plek_in_bereik_zichtbaar_en_sorteerbaar(self):
        pg = self._pagina_met_indexen('#/', 320)
        pg.select_option('#d-sort', 'positiePct')
        t = pg.inner_text('#dash table.dash tbody')
        self.assertIn('Plek in bereik 24% · 3,1 : 1', t)
        self.assertEqual(pg.locator('[data-plek]').count(), 2)      # AAPL en MSFT hebben een bereik in de fixture
        self.assertTrue(pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        self.assertEqual(self.fouten, [])

    def test_detail_toont_index_en_koers_tab_bereik_zonder_label_als_onbevestigd(self):
        pg = self._pagina_met_indexen('#/a/ASML.AS')
        self.assertIn('AEX (Amsterdam)', pg.locator('[data-indices]').inner_text())
        pg2 = self._pagina_met_indexen('#/a/AAPL/koers')
        kaart = pg2.locator('[data-bereik]')
        self.assertIn('onderste derde', kaart.inner_text())
        self.assertIn('3,1 : 1', kaart.inner_text())
        self.assertEqual(kaart.locator('[data-label]').count(), 1)           # AAPL: bevestigd
        pg3 = self._pagina_met_indexen('#/a/MSFT/koers')
        k3 = pg3.locator('[data-bereik]')
        self.assertIn('onderste derde', k3.inner_text())
        self.assertEqual(k3.locator('[data-label]').count(), 0)               # MSFT: onbevestigd, dus geen label
        self.assertTrue(pg2.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))

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

    def test_kw_historie_gemiddelden_en_overnemen_in_koerszones(self):
        c = self.b.new_context(viewport={'width': 320, 'height': 800})
        self.addCleanup(c.close)
        c.add_init_script("""(function(){var v;Object.defineProperty(window,'AANDEEL_DATA',{configurable:true,get:function(){return v;},
          set:function(d){d.aandelen.forEach(function(a){if(a.ticker==='AAPL'){
            a.gegevens.jaren.forEach(function(j){if(typeof j.comparable_eps==='number'&&j.comparable_eps>0){
              j.koers_hoog=j.comparable_eps*21.37;j.koers_laag=j.comparable_eps*11.13;j.dividend_ps=j.comparable_eps*0.2;}});}});v=d;}});
          try{localStorage.setItem('aandeelsignaal.v1',JSON.stringify({volglijst:[],introGezien:true}));}catch(e){}})();""")
        pg = c.new_page()
        fouten = []
        pg.on('pageerror', lambda e: fouten.append(str(e)))
        pg.goto(INDEX + '#/a/AAPL/waarde')
        pg.wait_for_timeout(200)
        sec = pg.locator('[data-kw-historie]')
        self.assertIn('Koers/winst in het verleden', sec.inner_text())
        self.assertIn('hoog 21,4, laag 11,1', pg.locator('[data-kw-gem]').inner_text())
        self.assertIn('Dividend per aandeel gedeeld door de gemiddelde koers', sec.inner_text())
        pg.click('#kw-over')
        self.assertEqual(pg.input_value('#v-z-kwh'), '21.4')
        self.assertEqual(pg.input_value('#v-z-kwl'), '11.1')
        self.assertTrue(pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        self.assertEqual(fouten, [])

    def test_kw_historie_zonder_koershistorie_toont_onbekend(self):
        pg = self._naic_extra_pagina(False)
        t = pg.locator('[data-kw-historie]').inner_text()
        self.assertIn('Onbekend', t)
        self.assertEqual(pg.locator('#kw-over').count(), 0)

    def test_bereik_kaart_met_verse_koers_en_zonder(self):
        def pagina(datum):
            c = self.b.new_context(viewport={'width': 320, 'height': 800})
            self.addCleanup(c.close)
            c.add_init_script("""(function(){var v;Object.defineProperty(window,'AANDEEL_DATA',{configurable:true,get:function(){return v;},
              set:function(d){d.aandelen.forEach(function(a){if(a.ticker==='AAPL'){
                a.koers={slot:70.5,datum:'%s',sma50:70,reeks:[['2026-10-01',70],['2026-10-02',70.5]]};
                a.gegevens.jaren.forEach(function(j,i){j.koers_hoog=100+i*7.3;j.koers_laag=40+i*1.9;});}});v=d;}});
              try{localStorage.setItem('aandeelsignaal.v1',JSON.stringify({volglijst:[],introGezien:true}));}catch(e){}})();""" % datum)
            pg = c.new_page()
            pg.goto(INDEX + '#/a/AAPL/waarde')
            pg.wait_for_timeout(200)
            return pg
        import datetime
        pg = pagina(datetime.date.today().isoformat())
        n = pg.evaluate("window.AANDEEL_DATA.aandelen.find(function(a){return a.ticker==='AAPL'}).gegevens.jaren.length")
        t = pg.locator('[data-bereik]').inner_text()
        if n >= 8:
            self.assertIn('onderste derde', t)
            self.assertEqual(pg.locator('[data-bereik] [data-label]').count(), 0 if 'Nog niet bevestigd' in pg.inner_text('main') else 1)
            self.assertIn('geen koopadvies', t)
        else:
            self.assertIn('Onbekend', t)
        pg2 = pagina('2020-01-01')
        self.assertIn('Onbekend', pg2.locator('[data-bereik]').inner_text())
        self.assertTrue(pg2.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))

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

    def test_checklist_invullen_bewaren_tellen_zonder_score_en_html_veilig(self):
        pg = self.pagina(320)
        pg.goto(INDEX + '#/a/AAPL/check')
        self.assertIn('0 van 15 beantwoord', pg.inner_text('#ck-voortgang'))
        self.assertEqual(pg.locator('.ck').count(), 15)
        self.assertTrue(pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        pg.click('[data-punt="5"] [data-ant="ja"]')
        pg.click('[data-punt="6"] [data-ant="onzeker"]')
        pg.click('[data-punt="7"] [data-ant="nee"]')
        pg.fill('#ck-n5', '<b>sterke</b> marge')
        pg.dispatch_event('#ck-n5', 'change')
        self.assertIn('3 van 15 beantwoord (1 ja, 1 nee, 1 weet ik niet)', pg.inner_text('#ck-voortgang'))
        self.assertNotIn('%', pg.inner_text('#ck-voortgang') + ' '.join(pg.locator('.ck').all_inner_texts()))   # de check zelf geeft geen score; de dekking-meter staat apart
        self.assertEqual(pg.locator('main h3').all_inner_texts(), ['Concurrentiepositie', 'Management', 'Financieel'])
        pg.click('[data-punt="7"] [data-ant="nee"]')       # nogmaals klikken haalt het antwoord weg
        self.assertIn('2 van 15 beantwoord', pg.inner_text('#ck-voortgang'))
        pg.reload(); pg.wait_for_timeout(150)
        self.assertEqual(pg.get_attribute('[data-punt="5"] [data-ant="ja"]', 'aria-pressed'), 'true')
        self.assertEqual(pg.get_attribute('[data-punt="7"] [data-ant="nee"]', 'aria-pressed'), 'false')
        self.assertEqual(pg.input_value('#ck-n5'), '<b>sterke</b> marge')
        self.assertEqual(pg.locator('.ck b b').count(), 0)  # notitie wordt tekst, geen HTML
        # per aandeel gescheiden
        pg.goto(INDEX + '#/a/MSFT/check')
        self.assertIn('0 van 15 beantwoord', pg.inner_text('#ck-voortgang'))
        # zit in de back-up
        pg.goto(INDEX + '#/instellingen')
        pg.click('#bk'); pg.wait_for_timeout(200)
        self.assertIn('sterke', pg.input_value('#bktekst'))
        self.assertEqual(self.fouten, [])

    def test_alle_tabs_bereikbaar_op_smal_scherm(self):
        pg = self.pagina(320)
        pg.goto(INDEX + '#/a/AAPL/samenvatting')
        self.assertEqual(pg.locator('nav.menu a').count(), 6)
        self.assertTrue(pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        self.assertTrue(pg.evaluate("Array.from(document.querySelectorAll('nav.menu a')).every(a => a.getBoundingClientRect().width >= 44)"))

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
        self.assertIn('positieve zone', z)
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

    def test_koerszones_bewaren_en_zichtbaar_op_start_alleen_met_verse_koers(self):
        def maak(koersdatum_offset_dagen):
            c = self.b.new_context(viewport={'width': 390, 'height': 800})
            self.addCleanup(c.close)
            c.add_init_script("""(function(){var v;Object.defineProperty(window,'AANDEEL_DATA',{configurable:true,get:function(){return v;},
              set:function(d){var dt=new Date(Date.now()-(%d)*86400000).toISOString().slice(0,10);
              d.aandelen.forEach(function(a){if(a.ticker==='AAPL')a.koers={slot:150,datum:dt,sma50:140};});v=d;}});
              try{if(!localStorage.getItem('aandeelsignaal.v1'))localStorage.setItem('aandeelsignaal.v1',JSON.stringify({volglijst:[],introGezien:true}));}catch(e){}})();""" % koersdatum_offset_dagen)
            pg = c.new_page(); self.fouten = []
            pg.on('pageerror', lambda e: self.fouten.append(str(e)))
            return pg
        pg = maak(0)
        pg.goto(INDEX + '#/')
        self.assertEqual(pg.locator('[data-zones]').count(), 0)       # nog niets bewaard: geen kaart
        pg.goto(INDEX + '#/a/AAPL/waarde'); pg.wait_for_timeout(150)
        pg.fill('#v-z-eps', '7'); pg.fill('#v-z-epsl', '5')
        pg.click('#z-bewaar')
        self.assertFalse(pg.is_hidden('#z-wis'))
        pg.goto(INDEX + '#/'); pg.wait_for_timeout(150)
        tekst = pg.inner_text('[data-zones]')
        self.assertIn('Apple', tekst); self.assertRegex(tekst, 'zone|koers')
        pg.goto(INDEX + '#/a/AAPL/waarde'); pg.wait_for_timeout(150)
        self.assertEqual(pg.input_value('#v-z-eps'), '7')          # bewaarde waarden komen terug
        pg.fill('#v-z-kwl', '30'); pg.click('#z-bewaar')           # ongeldig (laag >= hoog) wordt niet bewaard
        self.assertIn('hoge K/W boven lage K/W', pg.inner_text('#meld') if pg.locator('#meld').count() else pg.inner_text('body'))
        pg.reload(); pg.wait_for_timeout(150)
        self.assertEqual(pg.input_value('#v-z-kwl'), '10')
        # verouderde koers: geen zone, wel de reden
        oud = maak(30)
        oud.goto(INDEX + '#/a/AAPL/waarde'); oud.wait_for_timeout(150)
        oud.click('#z-bewaar')
        oud.goto(INDEX + '#/'); oud.wait_for_timeout(150)
        self.assertIn('Geen actuele koers', oud.inner_text('[data-zones]'))
        self.assertNotIn('positieve zone', oud.inner_text('[data-zones]'))
        self.assertEqual(self.fouten, [])

    def test_thema_kiezen_verandert_echt_de_kleuren_ook_tegen_de_voorkeur_van_het_toestel(self):
        achtergrond = "getComputedStyle(document.body).backgroundColor"
        for scheme, kies, verwacht_donker in (('light', 'donker', True), ('dark', 'licht', False), ('light', 'auto', False), ('dark', 'auto', True)):
            c = self.b.new_context(viewport={'width': 390, 'height': 800}, color_scheme=scheme)
            self.addCleanup(c.close)
            pg = c.new_page(); pg.goto(INDEX); pg.click('#intro-sl')
            pg.goto(INDEX + '#/instellingen')
            pg.click(f'[data-th="{kies}"]')
            rgb = [int(x) for x in pg.evaluate(achtergrond).replace('rgb(', '').replace(')', '').split(',')[:3]]
            self.assertEqual(sum(rgb) < 300, verwacht_donker, f'{scheme}/{kies}: {rgb}')
            pg.reload(); pg.wait_for_timeout(100)    # keuze blijft na herladen
            rgb2 = [int(x) for x in pg.evaluate(achtergrond).replace('rgb(', '').replace(')', '').split(',')[:3]]
            self.assertEqual(rgb, rgb2)

    def test_geen_html_injectie_via_zoektekst(self):
        pg = self.pagina()
        pg.goto(INDEX + '#/zoek')
        pg.fill('#q', '<img src=x onerror=window.hack=1>')
        self.assertIsNone(pg.evaluate('window.hack'))


if __name__ == '__main__':
    unittest.main()
