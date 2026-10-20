# Aandeel Signaal als webapp (beta.10)

## Wat het is
Een statische website in de map `web/`: HTML, CSS en JavaScript zonder server en zonder externe diensten. Dezelfde link werkt op pc, Android en iPhone; installeren is niet nodig (wel mogelijk via "Zet op beginscherm").

## Waar staat wat
- **Gegevens** (`web/data/aandelen.js` en `.json`): gemaakt door `bouw_webdata.py`, elke nacht opnieuw. Bevat per aandeel de jaarcijfers, splitsingen, controles en de laatste koersreeks.
- **Uw volglijst, portefeuille (aankopen) en instellingen**: alleen op uw eigen toestel (localStorage). Niets gaat naar een server. Daarom: back-up maken via Instellingen. De app herinnert u daaraan bij een nieuwe wijziging of na 14 dagen.
- **Het oordeel** (`web/js/gate.js`): hetzelfde slot als in Python (`label_gate.py`). Een label verschijnt alleen als winst per aandeel 10 jaar onderbouwd is, één valuta, koers maximaal 7 dagen oud (op de dag dat u kijkt) en geen afgewezen bronnen. `test_web_js.py` bewijst dat beide uitvoeringen hetzelfde antwoord geven.

## Proberen op eigen netwerk
Dubbelklik `START_WEBAPP.cmd`. Het toont een adres voor de pc en een voor uw telefoon (zelfde wifi). Dit is een gewone statische webserver; er is geen Streamlit meer nodig.

## Gratis online zetten (GitHub Pages)
1. Maak een gratis GitHub-account en een nieuwe repository; upload de inhoud van deze map.
2. Instellingen > Pages > Source: "GitHub Actions".
3. Instellingen > Secrets and variables > Actions > Variables: maak `SEC_CONTACT_EMAIL` met uw e-mailadres (de SEC vraagt een contactadres bij automatische aanvragen).
4. Tabblad Actions > "Nachtelijke update" > Run workflow. Daarna draait het elke nacht (ma t/m za, 03:17 UTC).
5. De link verschijnt bij de Pages-instelling. Open die op uw telefoon.

Grenzen van gratis: GitHub kan limieten wijzigen of de dienst storen; €0 is een ontwerpdoel en geen belofte. De app zelf is een map met bestanden en kan naar elk gratis webhosting (bijvoorbeeld Cloudflare Pages) worden verplaatst.

## Nu nog niet
- `--live` haalt koersen bij Yahoo en jaarcijfers bij de SEC; dit is offline getest met nagebootste bronnen en niet met de echte bronnen vanuit GitHub.
- Europese jaarcijfers (ESEF) zitten nog niet in de nachtelijke update; die aandelen staan als "nog niet gecontroleerd".
- De demo-gegevens hebben alleen Apple (uit uw eigen praktijkrun van 19 oktober) en geen koersen; daarom staat overal "nog niet bevestigd". Dat is bedoeld gedrag.
- Portefeuille (aankopen en verkopen) volgt later.

## Tests
`python run_tests.py` draait alles, inclusief de JavaScript-tests (vereist Node) en de browsertest (vereist Playwright met Chromium). Ontbreekt dat, dan worden die tests overgeslagen en staat dat in het rapport.

- **Vergelijken** (`#/vergelijk`): twee aandelen naast elkaar; jaarcijfers alleen bij volledig bevestigde aandelen.
- **Rondleiding**: eerste keer drie schermpjes; opnieuw via Hulp.
- **NAIC-gids** (tabblad NAIC bij elk aandeel): groei, rendement op eigen vermogen, marge en koerszones, met eigen aannames.
