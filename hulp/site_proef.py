"""Hulpmiddel (ontwikkeling): de gepubliceerde app in een echte browser proberen (zoekveld, portefeuille, vergelijken).
Gebruik: python hulp/site_proef.py https://fwhthijssen-wq.github.io/aandeelsignaal/"""
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1]
with sync_playwright() as p:
    for naam, kw in (('pc', {'viewport': {'width': 1280, 'height': 900}}), ('telefoon', {**p.devices['Pixel 7']})):
        br = p.chromium.launch(); c = br.new_context(**kw); pg = c.new_page()
        fouten = []
        pg.on('pageerror', lambda e: fouten.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: fouten.append('console ' + m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        pg.add_init_script("try{localStorage.setItem('aandeelsignaal.v1',JSON.stringify({introGezien:true}))}catch(e){}")
        pg.goto(URL + '#/portefeuille', wait_until='networkidle'); pg.wait_for_timeout(1500)
        print('==', naam, 'versie:', pg.evaluate("(document.body.innerText.match(/Aandeel Signaal (\\S+ \\(\\S+\\))/)||[])[1] || ''"), '| fondsen:', pg.evaluate('window.AANDEEL_DATA && AANDEEL_DATA.aandelen.length'))
        print('zoekveld aanwezig:', pg.locator('#pf-t-zoek').count(), '| select data-zoek:', pg.locator('select[data-zoek]').count())
        if pg.locator('#pf-t-zoek').count():
            pg.locator('#pf-t-zoek').click(); pg.keyboard.type('3i', delay=80); pg.wait_for_timeout(300)
            print('treffers 3i:', pg.locator('#pf-t-zoek-lijst').inner_text()[:200].replace('\n', ' | '))
            if pg.locator('[data-treffer]').count():
                pg.locator('[data-treffer]').first.click(); pg.wait_for_timeout(200)
                print('gekozen:', pg.input_value('#pf-t'), pg.input_value('#pf-v'))
        print('fouten:', fouten[:10])
        br.close()
