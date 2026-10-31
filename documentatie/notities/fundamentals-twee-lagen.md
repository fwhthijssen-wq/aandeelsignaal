# Fundamentals in twee lagen (beta.49–55, 21/22-10-2026)

**Laag 1 – ruw, onveranderlijk.** Per SEC-jaarverslag (10-K, 20-F, 40-F en correcties; per accessienummer) alle feiten precies zoals in dat verslag gerapporteerd, ruwe concepten. `archief/sec/<CIK>/<accn>.json.gz`, één keer schrijven. Wijzigt SEC later de data van een bewaard verslag: melding `bron_gewijzigd`, niet overschrijven.

**Laag 2 – afgeleid.** Per boekjaar de verwaterde EPS uit het meest recente verslag dat dat jaar noemt, omgerekend naar de huidige aandelenbasis met splitsingen die uit laag 1 zelf worden afgeleid. Tweede berekening naast de bestaande EPS-controle (`archief.eps_controle`); sinds beta.50 bij alle 52 SEC-bedrijven gelijk.

**Bij een nieuw jaarverslag:** concept voor concept vergelijken met eerdere verslagen:
- EPS **én** aantal aandelen met dezelfde eenvoudige factor → splitsing/samenvoeging (alleen EPS verschuift = herwerking)
- alleen aandelen ×1000 / ×10⁶, EPS gelijk → schaalcorrectie
- al het andere → herwerking

**Beta.50:** afgeleide splitsingen (tag `afgeleid:Jaarverslagvergelijking`) door dezelfde onafhankelijke EPS-bevestiging; samenvoegingen alleen bij deze tag; verliesjaren; strengere bevestiging; zelfde bewijsvenster = één splitsing; latere herhalingen blokkeren niet; herberekening binnen 0,4% = consistent.
**Beta.51:** terugval gewoon gewogen aantal aandelen (XOM volledig).
**Beta.52:** tweede teller (na preferent dividend / AT1) → JPM, SAN volledig. Totale schulden afgeleid. `EXTRA_VERSIE` (eenmalig opnieuw ophalen bij nieuwe kentallenregels).
**Beta.53:** Londen pence → ponden (koersen, historie, dividenden /100; record in GBP; portefeuille rekent oude GBX-invoer om).
**Beta.54:** gewone winst per aandeel als laatste terugval (ABN AMRO e.a.), gemarkeerd (`eps_gewoon`, waarschuwing).
**Beta.55:** `jaarverslag_bronnen.py` + `jaarverslag_bronnen.json`: cijfers uit pdf-jaarverslagen en uit de tekst van ESEF-rapporten (aantal verwaterde aandelen staat daar niet getagd), per getal document/pagina/tekst, alleen aanvullend, conflict = document ongeldig. Proef Ahold Delhaize: 0 → 9 bevestigde jaren (2016 valt buiten door fusie +24%). Aandelenreeks: langste stabiele reeks tot en met nieuwste jaar (fusies blokkeren niet meer) → Linde 7, Stellantis 5, Eni 9. Workflow 'Jaarverslagen ophalen (ontwikkeling)' → tak `jaarverslagen`.

**Belangrijke vondsten:**
- Oude continuïteitscontrole (0,8–1,2×) zag de Unilever-samenvoeging 8-voor-9 als 'stabiel'.
- 237 van 258 ESEF-bedrijven: aantal aandelen alleen als tekst; ESEF pas vanaf boekjaar 2020 → 10 jaar alleen haalbaar met pdf-jaarverslagen.
- Gratis data-API's (FMP, Alpha Vantage, Tiingo, Marketstack) bieden geen oplossing: licentie voor openbare weergave, alleen SEC-bedrijven, of 5 jaar. DEGIRO-import: gebruiker vindt portefeuille-import niet belangrijk.

**Resultaat (toen):** volledig bevestigd 35 → 40 (JNJ, UNA, XOM, JPM, SAN); AD 9, ENI 9, MA 9, LIN 7, TSLA 6, STLA 5.

**Ontwikkelwerkwijze:** SEC en bedrijfssites niet bereikbaar vanuit Claude's omgeving; workflows halen bestanden op naar takken `ontwikkeldata` / `jaarverslagen`. Claude pusht rechtstreeks naar GitHub en start workflows via de REST-API. Bij elke versie: `VERSION`, `APP_VERSIE` in `web/js/app.js`, CHANGELOG.
