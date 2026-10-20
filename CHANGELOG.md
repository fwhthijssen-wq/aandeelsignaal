# Changelog


## 2026.10.20-beta.31
- **NAIC: koers/winst in het verleden.** Per boekjaar de hoogste en laagste slotkoers gedeeld door de winst per aandeel, het gemiddelde over de laatste 5 jaar (minstens 3 jaar nodig), en het dividendrendement. Knop "Neem deze K/W over in mijn koerszones" vult de hoge en lage K/W in je eigen zones.
- Nieuw `koershistorie.py`; de nachtelijke update haalt 12 jaar dagkoersen en dividenden op (koersen splitsingscorrect, niet dividendgecorrigeerd). Jaar met minder dan 200 handelsdagen of een gat aan begin of eind: onbekend. Koers in een andere valuta dan de jaarcijfers: onbekend, nooit omgerekend. Geen gevonden dividend betekent onbekend, niet nul.
- Het is een kijk op wat de markt in het verleden betaalde; geen koersdoel en geen invloed op het signaal.

## 2026.10.20-beta.30
- **Dashboard:** keuzelijst "Trend 200 dagen" (alle / koers eronder / koers erboven). Alleen aandelen met een verse koers en een bekend 200-daags gemiddelde doen mee; de rest valt bij een gekozen trend weg. Is een hulp om te zoeken, geen signaal.

## 2026.10.20-beta.29
Run van 15:00 UTC: 34 van 48 bevestigd; McDonald's, Sanofi, Ferrari, Nokia en Disney zijn nieuw groen.
- **Thermo Fisher:** jaarwinst die alleen als "beschikbaar voor gewone aandeelhouders" is getagd wordt als teller gebruikt; de herberekende EPS moet de gerapporteerde nog steeds reproduceren.
- **Stellantis, Eni (IFRS):** ook de tag "winst toerekenbaar aan gewone aandeelhouders van het moederbedrijf" wordt gebruikt; verschillen twee tellers, dan wordt het jaar weggelaten.
- **Diagnose extra cijfers:** voor aandelen met 0 jaren afschrijving, dividend of lange schuld staat in de status welke begrippen het bedrijf wel gebruikt (`extra_diagnose`).
- Bewust niet aangepast: JNJ 2023 (13,7295 herberekend tegen 13,72 gemeld), Linde (aandelen springen door de fusie), Honeywell (afgewezen splitsingsregel), Philips (verwaterd aantal aandelen pas vanaf 2024), Visa, Exxon, Tesla.

## 2026.10.20-beta.28
- **Timing (informatie)** op de Koers-tab: korte en lange trend (50 en 200 dagen), plek in het jaarbereik en RSI(14) in gewone taal. Staat los van het signaal en heeft er geen invloed op. Bij een verouderde koers verschijnt de kaart niet; bij te weinig koersgeschiedenis staat er dat de app liever niets toont dan een schatting.
- Nachtelijke update haalt nu 2 jaar koersen op en berekent SMA200, 52-wekenhoog/-laag en RSI (Wilder), getoetst tegen een onafhankelijke pandas-berekening.

## 2026.10.20-beta.27
- **Opruimen:** `opruimlijst.txt` (178 oude bestanden: Streamlit-app, `.cmd`-starters, archief, oude modules en hun tests) en een eenmalige workflow "Opruimen oude bestanden" met proefrun. De nachtelijke update en alle overgebleven tests werken aantoonbaar zonder die bestanden (op een kopie getest). Streamlit uit `requirements.txt`.
- **McDonald's:** aandelen die in miljoenen worden gerapporteerd (727 i.p.v. 727.000.000) worden vermenigvuldigd met 1.000.000, maar alleen onder 100.000 en de herberekende EPS moet de gerapporteerde EPS nog steeds reproduceren.
- **Johnson & Johnson:** 52/53-wekenjaren. Nieuw `boekjaar.py`: een afsluitdatum op 1-7 januari hoort bij het vorige boekjaar, zodat twee boekjaren niet meer in één kalenderjaar botsen.
- **Europa:** Sanofi, Ferrari, Philips, Stellantis, Nokia en Eni (euronotering, SEC 20-F in euro) en **VS/Ierland:** Disney, Honeywell, Linde, Thermo Fisher erbij. Ze krijgen alleen een oordeel als alle controles slagen.
- **NAIC/Dashboard:** tegel "Volglijst met volledig ingevulde checklist"; meer tagnamen voor afschrijving, dividend en lange schuld.

## 2026.10.20-beta.26
Run van 14:09 UTC: 27 van 37 bevestigd. De 15 nieuwe aandelen leverden 13 groen op (AstraZeneca, Novartis, Adobe, Salesforce, Oracle, Cisco, PepsiCo, Merck, AbbVie, Home Depot, UnitedHealth, Texas Instruments, Caterpillar), naast de eerdere 14. Niet bevestigd: McDonald's (aantal aandelen springt 0,00 keer tussen 2020 en 2021: waarschijnlijk een verkeerde eenheid in de bron, niet te zien zonder de waarden) en TotalEnergies (in de SEC-gegevens staat geen winst per aandeel).
- **TotalEnergies vervangen** door Amgen en Nike (TotalEnergies is in de bron niet te controleren; een aandeel dat nooit bevestigd kan worden, is ruis).
- **Betere diagnose** voor aandelen die niet bevestigd raken (Visa, J&J, McDonald's, Exxon enzovoort): `diagnose` bevat nu ook de jaarwaarden van winst per aandeel, aantal aandelen en nettowinst uit de jaarverslagen, zodat de oorzaak direct te zien is. Ruis (opties, rentevoeten) is uit de lijst gehaald.
- `status.json` toont per aandeel `extra_dekking`: in hoeveel jaren winst vóór belasting, afschrijving, dividend en schuld zijn gevonden. Zo is te zien of de nieuwe NAIC-kentallen bij echte bedrijven werken.

## 2026.10.20-beta.25
- **Fout hersteld: donker uiterlijk werkte niet.** De app zette `data-theme` op "donker"/"licht" terwijl de stijl "dark"/"light" verwacht; alleen "Automatisch" volgde het toestel. Nu werkt de keuze. De oude test controleerde alleen het attribuut en niet de kleur; de nieuwe test kijkt naar de echte achtergrondkleur, ook tegen de voorkeur van het toestel in, en na herladen.
- **Eigen koerszones bewaren** (NAIC stap 4): knop "Bewaar mijn zones" per aandeel (op het toestel, in de back-up; samenvoegen laat bestaande zones staan). Op Start staat een kaart "Mijn koerszones" met per aandeel waar de koers nu in uw zones staat. Alleen bij een bevestigd aandeel met verse koers; anders staat er de reden en geen zone. Uw aannames, geen koersdoel of advies.
- 5 + 1 JS-tests, 2 browsertests (zones; thema).

## 2026.10.20-beta.24
Kwaliteitscheck per aandeel (nieuw tabblad "Checklist"): de 15 punten van Philip Fisher over concurrentiepositie en management (ook gebruikt door NAIC-beleggers). U antwoordt zelf ja / nee / weet ik niet en schrijft een eigen notitie; bij elk punt staat waar u het antwoord vindt. De app beoordeelt niets en geeft geen score; ze telt alleen hoeveel punten zijn beantwoord.
- Opslag: alleen op het toestel, per aandeel gescheiden, onderdeel van de back-up. Terugzetten via "samenvoegen" overschrijft nooit een bestaand antwoord; "vervangen" wel. Alleen bekende punten (1–15), alleen ja/nee/onzeker, notitie maximaal 500 tekens en altijd als tekst (nooit als HTML).
- Tabbladen bij een aandeel hernoemd zodat zes tabbladen op een smal scherm passen: Overzicht, Koers, NAIC, Checklist, Cijfers, Bronnen.
- Nieuw: `web/js/checklist.js`, 6 unit-tests, 2 browsertests.

## 2026.10.20-beta.23
Meer aandelen: 15 erbij (37 totaal): AstraZeneca, Novartis, TotalEnergies (Europese bedrijven die in dollar rapporteren, genoteerd in New York zodat koers en cijfers dezelfde valuta hebben) en Adobe, Salesforce, Oracle, Cisco, PepsiCo, Merck, AbbVie, Home Depot, McDonald's, UnitedHealth, Texas Instruments en Caterpillar. Elk aandeel krijgt pas een oordeel als alle controles slagen; wat niet lukt, staat met reden in `status.json`. Er is bewust geen aandeel toegevoegd dat in een andere valuta rapporteert dan het genoteerd is (bijvoorbeeld Novo Nordisk: Deense kroon).

## 2026.10.20-beta.22
Extra NAIC-kentallen over het management (uit dezelfde SEC-bestanden, geen nieuwe bron):
- **Winstmarge vóór belasting** (de echte NAIC-maatstaf), **uitgekeerd deel van de winst** (totaal dividend gedeeld door nettowinst; bewust niet per aandeel, want dat verandert bij een aandelensplitsing), **schuld t.o.v. totaal kapitaal** en **investeringen t.o.v. afschrijvingen**, per jaar in de NAIC-tab.
- Nieuwe module `extra_kentallen.py`: alleen jaarverslagen, alleen de valuta van het boekjaar, alleen een waarde die bij precies dat boekjaareinde hoort; twee verschillende waarden in de nieuwste indiening geven niets. Ontbreekt iets, dan is het onbekend (nooit nul) en staat er een uitleg in plaats van een grafiek.
- Banken (ING, JPMorgan) krijgen alleen het uitgekeerde deel van de winst; marge, schuld en investeringen zeggen daar weinig.
- Raakt de EPS-controle en het label-slot niet; een mislukte ophaalactie van deze extra cijfers laat de run nooit mislukken.
- 6 + 2 Python-tests, 4 JS-tests, 1 browsertest; mutatiecontrole: banken-uitzondering weghalen laat de browsertest falen.

## 2026.10.20-beta.21
Dashboard op het startscherm (geen nieuwe databronnen):
- **Portefeuille in één blik:** waarde en rendement per valuta, aantal aankopen zonder waarde, en een spreiding per land (per valuta apart, nooit omgerekend).
- **Aandachtspunten:** hoeveel volglijst-aandelen geen actuele koers hebben.
- **Tabel "in cijfers":** koers t.o.v. gemiddelde, omzetgroei, winstgroei en nettomarge per aandeel; filter "alleen bevestigd" en sorteren. Groei en marge staan alleen bij bevestigde aandelen; onbekend is een streepje en staat altijd onderaan. Geen rangorde of advies.
- Nieuwe module `web/js/dashboard.js` met 8 unit-tests en 2 browsertests (smal scherm, spreiding met verse en verouderde koersen). Mutatiecontrole: spreiding tellen zonder status-controle laat een test falen.

## 2026.10.20-beta.20
Eerste echte run met 22 aandelen: 12 bevestigd (ASML, Shell, Apple, Microsoft, Amazon, Nvidia, SAP, ING, Meta, Costco, Walmart, Eli Lilly). Uit de diagnose van de overige tien:
- **Teller van de winst per aandeel:** voor banken en bedrijven met preferente aandelen (JPMorgan, Procter & Gamble) is de gemelde verwaterde winst per aandeel berekend op de winst na dividend op preferente aandelen. De herberekening gebruikt nu, in vaste volgorde van beschikbaarheid: (1) winst beschikbaar voor gewone aandeelhouders (verwaterd), (2) nettowinst, (3) winst min het aandeel van minderheidsbelangen (Mastercard, dat geen nettowinst meldt). De keuze hangt van welke naam bestaat af en nooit van de uitkomst; past het resultaat dan niet, dan blijft het jaar onbevestigd.
- **Oude splitsingen:** een splitsing van vóór het eerste boekjaar in het dossier (Coca-Cola 2012) raakt geen enkele winst per aandeel en blokkeert niet meer. Een splitsing binnen de jaren zonder bevestiging blokkeert nog steeds.
- Foutmelding bij een bedrijf zonder jaarcijfers noemt nu de status van de bron (Exxon: de SEC-gegevens bevatten alleen kwartaalcijfers van 2026). `status.json` bevat per aandeel de einddata van de boekjaren (voor Johnson & Johnson, waar twee boekjaren ontbreken).
- Bekend en voorlopig open: Visa (winst per aandeel alleen per aandelenklasse), Exxon (geen jaarcijfers in de bron), Alphabet 2016–2019 (aantal aandelen ontbreekt), Tesla (veel dubbele en tegenstrijdige splitmeldingen), Unilever 2023 en 2025 (0,2% afwijking), Johnson & Johnson (twee boekjaren ontbreken in de bron, nog uit te zoeken).
- Let op: omdat de teller nu in volgorde van beschikbaarheid wordt gekozen, kan een aandeel dat nu bevestigd is in theorie veranderen. Dat is de volgende run te controleren.
- 488 tests; de nieuwe regels zijn gecontroleerd door ze weg te halen.

## 2026.10.20-beta.19
- **NAIC-gids** (tabblad Waarde heet nu NAIC) in vier stappen: groei van omzet en winst (alle jaren en laatste vijf), rendement op eigen vermogen, nettowinstmarge en koerszones (hoge en lage koers over een horizon, verdeeld in drie zones, verhouding opwaarts tegen neerwaarts en mogelijk rendement per jaar). Daarna het bestaande rekenvoorbeeld.
- Alles is een rekenhulp met uw eigen aannames. De positie van de koers in de zones en de verhouding verschijnen alleen bij een volledig bevestigd aandeel met een verse koers; anders alleen de zones zelf. Verliesjaren of vermogen kleiner dan of gelijk aan nul geven een streepje, nooit een verzonnen getal.
- NAIC kijkt naar winst voor belasting; dat veld ontbreekt nog, dus stap 3 toont de marge na belasting (staat zo in de app). Historische K/W per jaar ontbreekt nog (vraagt jaarlijkse hoog- en laagkoersen).
- Nieuw bestand `js/naic.js` met tests; de nieuwe regels zijn gecontroleerd door ze weg te halen.

## 2026.10.20-beta.18
- **Rondleiding bij eerste gebruik:** drie korte schermpjes (wat de app doet, wat "Bevestigd" betekent, uw gegevens en back-up). Alleen de eerste keer; opnieuw te bekijken via Hulp. Overslaan telt als gezien. Sluit met Escape.
- **Vergelijken:** twee aandelen naast elkaar (koers, afstand tot gemiddelde, omzetgroei, winstgroei, nettomarge, K/W). Cijfers uit de jaarverslagen verschijnen alleen bij volledig bevestigde aandelen; anders een streepje met de reden. Alleen percentages en verhoudingen (geen bedragen in verschillende valuta's naast elkaar) en nooit een winnaar.
- **Lijst uitgebreid van 10 naar 22 aandelen:** Meta, Tesla, Costco, Walmart, JPMorgan, Visa, Mastercard, Johnson & Johnson, Eli Lilly, Procter & Gamble, Coca-Cola, Exxon Mobil. Ze krijgen pas een oordeel als alle controles slagen; wat er live uitkomt is nog niet bekend.
- Nieuw bestand `js/vergelijk.js`; tests voor vergelijken en rondleiding (ook op 320 pixels breed).
- 474 Python-tests en 38 JavaScript-tests; nieuwe regels zijn gecontroleerd door ze weg te halen.

## 2026.10.20-beta.17
- **Shell:** uit de diagnose bleek dat Shell zijn winst per aandeel meldt onder de naam `DilutedEarningsLossPerShareFromContinuingOperations`, die de app niet kende. Die naam wordt nu als uitwijk gebruikt, alleen voor een boekjaar waarvoor geen gewone EPS-naam bestaat (de gewone naam gaat altijd voor, ook als de uitwijknaam later is ingediend). Het cijfer geldt pas na dezelfde herberekening als alle andere (nettowinst / aandelen); bij afgestoten bedrijfsonderdelen wijkt het af en blijft het jaar onbevestigd.
- **Shell staat nu in de lijst als SHEL (New York, dollar)** in plaats van SHELL.AS (Amsterdam, euro). Shell rapporteert in dollar, dus koers en cijfers hebben dezelfde valuta en er wordt niets omgerekend. Een eventuele aankoop of volglijstplek onder SHELL.AS blijft bewaard maar toont "zit niet meer in de lijst".
- 470 tests; de nieuwe regels zijn gecontroleerd door ze weg te halen.
- Niet getest met echte gegevens: of Shell hiermee 10 van 10 haalt hangt af van de herberekening met de echte indieningen.

## 2026.10.20-beta.16
- Versienummer staat nu onderaan Instellingen (een test bewaakt dat het gelijk is aan het bestand VERSION).
- Diagnose: voor elk aandeel met minder dan 10 onderbouwde jaren schrijft de nachtelijke run in `status.json` (veld `diagnose`) welke winst- en aandelennamen de SEC-gegevens van het bedrijf bevatten (eenheid, soort indiening, jaarbereik). Bedoeld om Shell (alle EPS ontbreekt) gericht te kunnen oplossen. Mislukt de diagnose, dan staat de reden erin; de run mislukt nooit door de diagnose.
- 466 tests.

## 2026.10.20-beta.15
**Nieuw: Mijn portefeuille. Herstel: de app ververst zichzelf nu op elk toestel.**
- Nieuw scherm Portefeuille: aankopen invoeren (aandeel, aantal, aankoopkoers, valuta, datum), met waarde nu, winst of verlies en percentage per aankoop en per valuta. Alles blijft op het toestel en gaat mee in de back-up (samenvoegen dubbelt niets, oude back-ups blijven werken).
- Rekent alleen met een koers van maximaal 7 dagen oud en in dezelfde valuta als de aankoop. Anders staat er "Geen waarde" met de reden en telt de aankoop niet mee. Er wordt nooit omgerekend en totalen van verschillende valuta's worden nooit opgeteld.
- **Fout hersteld:** de offline-opslag bewaarde de app zelf voor altijd en haalde alleen de gegevens vers op. Verbeteringen aan de app kwamen daardoor niet op telefoons aan. Nu wordt altijd eerst vers geladen; alleen zonder internet komt de bewaarde kopie.
- Foutmeldingen van de winst-per-aandeel-controle noemen nu de boekjaren waarom het misgaat en tonen bij een herberekening het herberekende en het gemelde getal.
- 460 Python-tests, 30 JavaScript-tests; elke nieuwe regel is gecontroleerd door hem weg te halen.

## 2026.10.20-beta.14
**Fout gevonden en hersteld: verkeerde vergelijkbare winst per aandeel bij Nvidia (stond wel als bevestigd).**
- Dezelfde splitsing werd door de bron onder twee data gemeld (Nvidia: 3 juni en 19 juli 2021, 31 mei en 30 juni 2024) en de omrekening paste beide toe. Nvidia FY2017 kwam daardoor uit op 0,0016 in plaats van 0,064 (factor 1600 in plaats van 40). Dezelfde fout zat in de route "herberekening", die alleen controleert of de gemelde winst per aandeel binnen één indiening klopt en niet of de omrekening klopt.
- Nu: (1) dezelfde splitsing binnen 100 dagen telt één keer, (2) indieningen in de onzekere periode tussen die data worden niet omgerekend, (3) een omgerekend jaar mag via de herberekening alleen als bevestigd gelden als het aantal aandelen, omgerekend naar de huidige basis, een stabiele reeks vormt tot en met het nieuwste jaar. Een verkeerde of ontbrekende factor veroorzaakt een sprong en blokkeert de oudere jaren.
- De route "oorspronkelijke indiening" telde dezelfde splitsing meerdere keren mee (Alphabet: factor 8000). Gecorrigeerd.
- IFRS-bedrijven (SAP, ING, Shell, Unilever): de herberekening kijkt nu ook naar de IFRS-namen voor nettowinst van de aandeelhouders en gewogen aandelen.
- De app toont bij Bronnen een toelichting waarom de controle een aandeel niet kan bevestigen.
- 458 tests; elke nieuwe regel is gecontroleerd door hem weg te halen.
- Niet getest met echte gegevens. Het kan zijn dat aandelen die nu bevestigd zijn tijdelijk onbevestigd worden als hun aandelenaantallen niet netjes door de reeks lopen; dat is bedoeld.

## 2026.10.20-beta.13
Derde echte run: 5 van 10 (Apple, Microsoft, ASML, Amazon, Nvidia). Alphabet 4 van 10 jaren.
- Shell (SHEL) en Unilever (UL) zijn gekoppeld aan hun Amerikaanse notering, zodat hun 20-F-jaarcijfers worden gelezen zoals bij ASML, ING en SAP.
- **Valuta:** de valuta van de notering telt mee. Shell rapporteert in dollars en noteert in euro: dat geeft "Cijfers en koers staan in verschillende valuta" en dus geen "bevestigd" zolang er geen omrekening is. De Gezondheid-pagina noemt de valuta's.
- Nieuw bestand `status.json` in de uitvoer: klein overzicht per aandeel (status, aantal jaren, open jaren met reden, splitsingen, waarschuwingen).
- `aandelen.json` is compacter.
- Bij een afwijkende oorspronkelijke indiening noemt de reden nu de waarden (Alphabet 2020 en 2021).
- Niet getest met echte gegevens: Shell, Unilever, SAP en ING in de nachtelijke run.

## 2026.10.20-beta.12
Gevonden in de eerste echte nachtelijke run (Apple en Nvidia bevestigd, de rest niet):
- **Bedrijven zonder splitsing** (zoals Microsoft) bleven op "splitbewijs ontbreekt". Nu geldt: de bron meldt geen splitsing én het gewogen aantal aandelen blijft over alle jaren tussen 0,8 en 1,2 keer het vorige jaar én elk boekjaar is aanwezig. Een niet-gemelde splitsing zou als sprong zichtbaar zijn en blokkeert dan.
- **Aankondiging en doorvoering** van één splitsing (Alphabet: 1 februari en 15 juli 2022) werden als twee gebeurtenissen gezien; de aankondiging werd afgewezen en blokkeerde het hele aandeel. Nu telt een tegengesproken gebeurtenis met dezelfde verhouding en ten hoogste een jaar vóór een bevestigde splitsing als dubbele vermelding. Andere verhoudingen of grotere afstand blijven afgewezen.
- De app toont bij Bronnen per jaar waarom de winst per aandeel niet onderbouwd is (bijvoorbeeld Amazon 2018 en 2019).
- Resultaat van de tweede echte run: Microsoft en ASML bevestigd (4 van de 10 aandelen bevestigd); Alphabet van afgewezen naar 4 van 10 jaren.
- **Nieuwe route per jaar:** gebruikt het dossier voor een jaar al de herziene indiening van na de splitsing (Alphabet 2020 en 2021), dan wordt de oorspronkelijke indiening gedeeld door de bevestigde splitverhouding ermee vergeleken. Een afwijkende oorspronkelijke waarde onderbouwt dat jaar niet.
- **Afronding in de herberekening:** bronbedragen zijn afgerond (Amazon geeft aandelen in hele miljoenen). De herberekende EPS wordt nu als interval vergeleken in plaats van op één getal; exacte bedragen houden de strenge halve-centmarge.
- De reden bij een niet-bewezen jaar noemt nu ook waarom de herberekening niet lukte.
- 16 nieuwe tests; elke veiligheidsregel is gecontroleerd door hem weg te halen (test faalt dan).
- Niet getest: met de echte SEC-gegevens. Of Alphabet 2020/2021 en Amazon 2018/2019 nu slagen, blijkt na de volgende update. Jaren van vóór de splitsing die daarna niet meer zijn ingediend en waarvan de herberekening niet klopt, blijven open; dat is bedoeld.

## 2026.10.20-beta.10
**Nieuwe basis: webapp in plaats van Streamlit (map `web/`)**
- Eén link voor pc, Android en iPhone. Geen Streamlit meer nodig: de pagina's zijn gewone bestanden (zie `documentatie/WEBAPP.md`).
- Zelfde ontwerp als goedgekeurd: dashboard met "Op een rij", volglijst, interessante aandelen, menu onderin, vijf onderdelen per aandeel, licht/donker/automatisch.
- Volglijst en instellingen staan op het eigen toestel; back-up als bestand (delen of downloaden) of als tekst, terugzetten voegt toe, herinnering bij wijziging of na 14 dagen, verzoek om vast bewaren.
- Het label-slot is in JavaScript nagebouwd en getest op gelijke uitkomsten als Python. De datum van vandaag op het toestel bepaalt of een koers vers genoeg is.
- `bouw_webdata.py`: maakt de gegevens (demo uit uw Apple-praktijkrun, of `--live`). `.github/workflows/nachtelijke-update.yml` ververst ze elke nacht en publiceert gratis op GitHub Pages.
- `START_WEBAPP.cmd`: proefversie op eigen netwerk, ook voor de telefoon.
- Tests: 17 JavaScript-tests, 7 echte-browsertests (Chromium), 6 voor de gegevensbouwer, 4 pariteitstests.
- De Streamlit-app blijft in deze map staan maar wordt niet meer doorontwikkeld.
- Niet getest: echte iPhone/Android, installeren op het beginscherm, offline-modus, live bronnen vanuit GitHub.

## 2026.10.20-beta.9
- Compacter: de kaarten zijn zelf de knop. Tik op de kaart "Op een rij" om alle aandelen te controleren, op een volglijstkaart of aandeelkaart om het aandeel te openen, op "Alles zien" voor het volledige overzicht. De losse "Open"-knoppen onder elke kaart zijn vervallen; een pijltje (›) toont dat een kaart klikbaar is.
- De losse "← Terug naar het begin"-knop bovenaan staat alleen nog op de aandeelpagina; op de andere pagina's volstaat het menu onderin.
- Het overzicht "Interessante aandelen" toont de aandelen als kaarten met reden en trend; de tabel staat in een uitklapper.
- Toegankelijkheid: de onzichtbare knop op een kaart heeft nog steeds een naam en een zichtbare rand bij toetsenbordbediening.
- Op Streamlit-versies zonder vaste containers staat de knop gewoon onder de kaart.
- Niet getest in een echte browser: of de onzichtbare knop precies over de kaart ligt en klikt, moet u controleren op pc en telefoon.

## 2026.10.20-beta.8.1
- Nieuw startbestand `START_OOK_OP_TELEFOON.cmd`: start de app zo dat uw telefoon op hetzelfde wifi erbij kan, en toont het adres om op de telefoon in te typen. Het gewone `START_AANDEEL_SIGNAAL.cmd` blijft alleen voor deze computer.
- 3 tests voor de startbestanden (regeleinden, gewone start blijft lokaal, telefoonstart met waarschuwing). Niet getest: Windows zelf, de firewallvraag en het adres dat het script toont.

## 2026.10.20-beta.8
**Nieuw uiterlijk (volgens het goedgekeurde ontwerp)**
- Startscherm als dashboard: kaart "Op een rij" (hoeveel aandelen bevestigd), knop "Controleer alle aandelen", uw volglijst als kaarten met status en trend, en de bovenste aandelen uit het overzicht. Alles opent met één knop.
- Menu onderin het scherm, vast onderaan: Start, Zoeken, Volglijst, Hulp. Op de aandeelpagina staan in plaats daarvan de onderdelen als knoppen onderin: Samenvatting, Koers, Waarde, Gezondheid, Bronnen. Het uitklapmenu "Wat wilt u zien?" is vervallen.
- Licht en donker: de kleuren van de eigen kaarten en balk volgen het thema van Streamlit of anders het apparaat. Op de Hulp-pagina staat hoe u zelf kiest (menu rechtsboven, Settings, Theme). `.streamlit/config.toml` geeft de accentkleur; er is bewust geen vaste keuze licht of donker.
- Statussen zijn nooit alleen een kleur: ✓ Bevestigd en … Nog niet bevestigd.
- `requirements.txt`: streamlit minimaal 1.40 (vaste onderbalk). Op oudere versies werkt alles, maar staat de balk niet vast.

**Testen:** 411 offline tests geslaagd. **Niet getest:** het echte uiterlijk in een browser (Streamlit kon in de testomgeving niet worden geïnstalleerd). Of de onderbalk vast blijft staan, de knoppen op een telefoon naast elkaar blijven en donker er goed uitziet, moet u zelf beoordelen; meld wat afwijkt, dan pas ik de stijl (`stijl.py`) aan.

## 2026.10.20-beta.7.1
- Vanuit "Interessante aandelen" kunt u per aandeel doorklikken naar de details ("Open ..."). Het gekozen aandeel opent op de Samenvatting en gebruikt de al uitgevoerde controle (geen tweede SEC-opvraag). Bovenaan staat "← Terug naar het overzicht"; de uitkomsten blijven staan.
- 402 offline tests geslaagd (2 nieuw).

## 2026.10.20-beta.7
**Toegevoegd (stap 3: overzicht "Interessante aandelen")**
- De pagina toont per aandeel uit de lijst of de gegevens bevestigd zijn (zelfde controle als het label-slot), of de koers actueel is en hoe de koers zich verhoudt tot het 50-daags gemiddelde, met de eerste reden als iets ontbreekt. Bevestigde aandelen staan bovenaan, daarna alfabetisch.
- Geen koop- of verkoopsignaal en geen rangschikking op verwachte winst; wat telt als "bevestigd" is alleen het label-slot (10 onderbouwde jaren, verse koers, één valuta, geen afgewezen bronnen).
- De controle start pas na een druk op "Controleer alle aandelen" (10 SEC-aanvragen); de uitkomst blijft in de sessie.
- Europese noteringen (ASML, SAP, ING, Shell, Unilever) staan als "niet bevestigd" zolang hun jaarcijfers niet via dezelfde SEC-controle lopen; de reden staat erbij.
- `overzicht.py`, `test_overzicht.py` (7 tests) en 3 schermtests.

**Testen:** 400 offline tests geslaagd. Niet getest: echte SEC/Yahoo-verbinding, echt Streamlit, Windows, tijdsduur van de controle van 10 aandelen.

## 2026.10.20-beta.6
**Gewijzigd (stap 1: label koppelen aan echte controle)**
- De aandeelpagina haalt zelf de SEC-jaarcijfers op en voert dezelfde EPS-controle uit als de praktijkcontrole (`bewijs.py`), één keer per sessie en per aandeel. "Samenvatting" en "Financiële gezondheid" gebruiken dat bewijs voor het label-slot. Voor Apple geldt: alle 10 jaren onderbouwd, één valuta, geen afgewezen bronnen; ontbreekt alleen een verse koers (max. 7 dagen), dan staat dat als reden bij "Wat ontbreekt er?".
- Mislukt het ophalen (geen internet, niet door de SEC gedekt, zoals de Europese noteringen), dan staat de reden erbij en komt er nooit een label.
- SEC-contactadres is nu een instelling van de beheerder (`instellingen.py`): omgevingsvariabele `AANDEEL_SEC_EMAIL`, anders `instellingen.json` naast de app (zie `instellingen_VOORBEELD.json`), anders het standaardadres. Gebruikers hoeven geen adres in te vullen.
- Let op: bij een gehoste app horen alle aanvragen onder het adres van de beheerder; draait iedereen lokaal, zet dan ieders eigen adres in `instellingen.json`.

**Testen:** 390 offline tests geslaagd; nieuwe tests voor instellingen, bewijs en de schermkoppeling; de koppeling is gecontroleerd door de aanroep tijdelijk te verwijderen (3 tests faalden). Niet getest: echte SEC- en Yahoo-verbinding vanuit de app, echt Streamlit, Windows.

## 2026.10.19-beta.5.1
- Echte Apple-run (beta.5) bevestigd: splitsing 4:1 (2020) geaccepteerd, 2014-splitsing "niet van toepassing", 10 van 10 jaren onderbouwd, status `independently_verified`.
- Nieuw in het resultaat: `year_table` (omzet, nettowinst, EPS, vergelijkbare EPS, kasstroom, investeringen, eigen vermogen per jaar) zodat het voorbeeld uit echte brondata kan worden gebouwd.
- Let op (bekend): de herberekening toetst de interne samenhang van één SEC-indiening; het is geen vergelijking met het originele jaarverslag. De waarschuwing hierover blijft staan.

## 2026.10.19-beta.5
**Aanleiding:** de echte Apple-run toonde dat alle splitsingen werden afgewezen (geen enkel onderdeel kon een splitdatum bewijzen) en dat de oudste jaren nooit "onderbouwd" werden. Daardoor kon voor elk bedrijf met een splitsing nooit een label verschijnen.

**Toegevoegd**
- `eps_verification.py`: twee onafhankelijke bewijsroutes, beide uitsluitend uit SEC-indieningen en fail-closed.
  1. *Splitbevestiging*: een splitfeit geldt pas als de EPS van dezelfde periode in indieningen van voor én na de splitsing de splitverhouding laat zien (bijv. 11,89 -> 2,97 = 4:1, afrondingsbewust). Een tegenstrijdige of ontbrekende verhouding laat de splitsing afgewezen. Splitsingen van vóór het eerste jaar in het dossier (Apple 2014) zijn "niet van toepassing".
  2. *Herberekening*: nettowinst / gewogen verwaterde aandelen uit dezelfde indiening moet de gerapporteerde EPS geven (marge halve cent). Dit onderbouwt ook de oudste jaren.
- Status `independently_verified` bestaat nu echt (alle genormaliseerde jaren onderbouwd); het label-slot vraagt daarnaast nog minimaal 10 jaar, verse koers, één valuta.
- De app (NAIC-weergave) gebruikt dezelfde controle en levert het bewijs aan het label-slot (`eps_gate_evidence`).
- `test_eps_verification.py` met Apple-achtige, **illustratieve** testgegevens (`apple_like_fixture.py`, geen echte brondata).

**Ongewijzigd:** `valuation_approved` blijft altijd False; zonder bewijs geen label.
**Niet bewezen:** werking op de echte Apple-data op uw pc (daarvoor de nieuwe `AandeelSignaal_Apple_controle.pyz`), live Streamlit, Windows.

## 2026.10.19-beta.4.1
- Alleen verpakking, geen codewijziging: map `documentatie/` met projectstatus (met openstaande punten, routekaart) en testlogboek-sjabloon zit nu in de ZIP, zodat één ZIP over de bestaande map alles bijwerkt.
- Testlogboek heet nu `Testlogboek_SJABLOON.md`, zodat een ingevulde kopie niet door een update wordt overschreven.

## 2026.10.19-beta.4
**Gewijzigd (stap 1: interface opruimen)**
- Startscherm: drie primaire keuzes en Hulp. "Internationale bronnenproef" is verplaatst naar een uitklapper "Voor gevorderden" als "Onderzoek en bronnen".
- Aandeelpagina in onderdelen via het keuzemenu "Wat wilt u zien?": Samenvatting (standaard), Koersverloop, Waardering (rekenvoorbeeld), Financiële gezondheid, Bronnen en onderzoek. Alleen het gekozen onderdeel wordt uitgevoerd; fundamentals, NAIC en ESEF draaien dus niet meer bij elke weergave. Een keuzemenu is gekozen omdat het NAIC- en fundamentals-deel zelf uitklappers gebruiken en Streamlit geen uitklapper binnen een uitklapper toestaat.
- Samenvatting in gewone taal: koers, actualiteit, één zin over het 50-daags gemiddelde, status via het label-slot en de volglijstknop. Zonder bevestigde EPS staat er "Nog geen beoordeling mogelijk" met uitklapper "Wat ontbreekt er?".
- Hulp-pagina met vijf stappen en uitleg van vaktermen (`uitleg.py`).
- Het gekozen onderdeel wordt teruggezet naar Samenvatting bij een nieuw aandeel of terug naar het begin.
- Het bronnendeel blijft onafhankelijk van de koersopvraag (bestaande regressietest blijft slagen).

**Toegevoegd**
- `samenvatting.py`, `uitleg.py`, `test_samenvatting.py` (14 tests), 7 extra schermtests in `test_app_smoke_volglijst.py`.

**Testen**
- 371 offline tests geslaagd (353 + 18), Linux. De omgeving gaf nu Python 3.13.16 en pandas 3.0.5 (eerder 3.12.3 en 3.0.2); `TESTRAPPORT.txt` noemt de werkelijke versies.
- Nieuwe schermtests falen op de beta.3-app (6 van 11) en slagen op beta.4; twee opzettelijke fouten werden ontdekt.
- Schermtests gebruiken nagebootst Streamlit. **Niet getest:** echt Streamlit in een browser, telefoon, Windows. Of het keuzemenu en de uitklappers op een telefoon prettig werken, moet u zelf beoordelen.

**Bekend / nog open**
- De samenvatting toont voor elk aandeel "Nog geen beoordeling mogelijk", omdat de SEC-EPS-bewijsketen nog niet aan het koersscherm is gekoppeld (stap 2).
- Niet gedaan uit het ontwerp: uitleg bij eerste gebruik met Overslaan, lettergrootte/tikvlakken gemeten op echte toestellen, toetsing met twee beginnende gebruikers.
- "Interessante aandelen" is nog niet beschikbaar (stap 3).

## 2026.10.19-beta.3
**Toegevoegd**
- **Mijn volglijst** werkt: aandeel toevoegen vanaf de aandeelpagina ("Zet op mijn volglijst"), lijst bekijken, "Bekijk analyse", verwijderen met bevestiging en "Ongedaan maken", CSV-export, voorbeeldbestand en CSV-import (voegt toe, vervangt nooit, meldt afgekeurde regels).
- `watchlist.py` (opslag, validatie, CSV), `watchlist_ui.py` (schermen), 41 nieuwe tests (`test_watchlist.py`, `test_watchlist_ui.py`, `test_app_smoke_volglijst.py`).
- Opslag in `mijn_gegevens/volglijst.json` naast de app, atomisch geschreven met `.bak`. Een onleesbaar of nieuwer bestand wordt nooit overschreven zonder eerst een kopie; de gebruiker krijgt een melding.
- Startscript controleert of de ZIP is uitgepakt (melding bij ontbrekend `app.py`/`requirements.txt`).
- De versie in de kop van de app komt nu uit het bestand `VERSION` (stond vast op "Proefversie 4.6.3").

**Gewijzigd**
- `app.py`: volglijstpagina vervangen door de werkende pagina; veld "beurscode" heeft een vaste sleutel zodat de volglijst een aandeel kan openen; bij "Terug naar het begin" wordt dat veld leeggemaakt.

**Bewust niet**
- De volglijst bewaart geen scores of signalen. Geen synchronisatie met telefoon of andere apparaten (staat zo in het scherm).
- CSV-cellen die met `=`, `+`, `-` of `@` beginnen krijgen bij export een apostrof tegen formule-injectie in Excel.

**Testen**
- 353 offline tests geslaagd (312 + 41), Linux, Python 3.12.3, pandas 3.0.2.
- De schermtests gebruiken een nagebootst Streamlit en nagebootste Yahoo-gegevens. Echt Streamlit in een echte browser en Windows zijn **niet** getest. Controle dat de nieuwe tests falen op de oude code: ja (volglijstrooktest 4 van 4 gefaald op de oude `app.py`).

## 2026.10.19-beta.2
**Toegevoegd**
- `label_gate.py`: beoordelingslabel alleen bij bevestigde invoer (EPS 10 jaar onafhankelijk bevestigd, koers ≤ 7 dagen, één valuta, geen afgewezen bronnen); anders reden zichtbaar. 
- Verouderde of onbetrouwbare koers geeft geen score meer.
- `test_label_gate.py` (11 tests) en `test_label_wiring.py` (2 tests).
- `run_tests.py` / `RUN_TESTS.cmd`: één testcommando met `TESTRAPPORT.txt`.
- `VERSION`, deze changelog, `installed_versions.txt` wordt bij de eerste succesvolle start aangemaakt.

**Gewijzigd**
- `fundamentals.py`: label achter het slot. Eerder werd het label getoond op basis van twee Yahoo-jaarcijfers, zonder EPS-controle.
- Alle `.cmd`-bestanden naar Windows-regeleinden (CRLF). Het startscript had alleen LF, wat bij `goto` in batchbestanden kan vastlopen.
- Verwijzing naar een specifieke chatdienst in de praktijktest neutraal gemaakt.
- `LEES_DIT_EERST.md` herschreven; tegenstrijdige statusbestanden samengevoegd.

**Opgeruimd**
- 58 `LEESMIJ_*`-bestanden, oude statusnotities en twee losse testuitvoerbestanden verplaatst naar `archief/`. Niets verwijderd.

**Testen**
- 312 offline tests geslaagd (299 bestaand + 13 nieuw), `python run_tests.py`, Linux, Python 3.12.3, pandas 3.0.2.
- Let op: `requirements.txt` staat pandas < 3 toe, de tests draaiden op pandas 3.0.2. Een run op pandas 2.x is niet gedaan.
- Eerdere notities noemden 379 (+3 subtests) en 393 (+3) pytest-tests; deze aantallen zijn niet te herleiden en niet met 312 te vergelijken.

**Niet gedaan / niet bewezen**
- Streamlit-app niet gestart (geen Streamlit of internet in de ontwikkelomgeving); alleen syntaxis en broncodestructuur getoetst.
- Geen Windows-test, geen live SEC/ESEF/Yahoo, geen NAIC-narekening, geen productie-vrijgave.
- Pakketversies niet vastgezet; ze worden na de eerste succesvolle installatie vastgelegd.
- Koppeling van de SEC-EPS-bewijsketen aan het koersscherm ontbreekt nog (via `st.session_state['eps_gate_evidence'][ticker]`).

## Eerdere ontwikkelstanden (samengevat uit `archief/`)
- NAIC-scherm sluit aan op `bronregister.json` (ASML 2016 kasstroom, niet live bevestigd).
- `naic_growth.py` rekent alleen binnen een gelijke verslaggevingsgrondslag.
- `release_gate.py`: conservatieve controle van praktijkresultaten; `production_release_approved` blijft altijd false.
