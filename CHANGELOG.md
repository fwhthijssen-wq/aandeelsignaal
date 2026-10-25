# Changelog

## 2026.10.25-beta.73
- **Herstel: winst per aandeel uit Duitse jaarverslagen kwam niet in de app.** Bij fondsen zonder officiële bron hergebruikte de nachtelijke update de cijfers van de vorige nacht in plaats van Yahoo opnieuw op te halen, waardoor de jaarverslagcijfers niet werden toegepast. Nu wordt Yahoo eerst geprobeerd; alleen als dat mislukt blijven de vorige cijfers staan, en ook dan komen de jaarverslagcijfers erbij.

## 2026.10.25-beta.72
- **Winst per aandeel uit Duitse jaarverslagen (pdf).** Duitse bedrijven leveren geen ESEF-bestanden bij filings.xbrl.org; daarom leest de app nu de gerapporteerde verwaterde winst per aandeel uit de jaarverslagen zelf (via de IR-sites / EQS). Elk jaar wordt gecontroleerd met het vergelijkende cijfer in het volgende verslag; past dat niet, dan stopt de reeks.
- Nieuw met een reeks van minstens 4 jaar: BASF (12 jaar), Beiersdorf (12), Allianz (11), Volkswagen (11), Fresenius Medical Care (10), Siemens (7), MTU Aero Engines (7), RWE (5) en Scout24 (4). Daarmee kan NAIC voor deze fondsen rekenen met een langere groeitrend en K/W-geschiedenis.
- Deze cijfers heten “uit jaarverslag” (gerapporteerd, niet nagerekend). Omzet, kasstroom en balans blijven indicatief (Yahoo Finance). Op het tabblad Bronnen staan per jaar het verslag, de pagina en een link.
- Bij Volkswagen is het de winst per gewoon aandeel (preferente aandelen krijgen € 0,06 meer).

## 2026.10.25-beta.71
- **Het oordeel volgt nu de NAIC-regels.** Bovenaan elk aandeel staat het NAIC-oordeel (Stock Selection Guide); de zes metingen van de app (kasstroom, schuld, groei, K/W, trend, rust) staan eronder als *aanvullend* en tellen niet mee. Ook Kansrijk (standaard NAIC), de fondsenlijst (standaard gesorteerd op NAIC) en de volglijst zetten NAIC voorop.
- **NAIC deel 5 toegevoegd: totaalrendement.** Koersstijging tot de verwachte hoge koers plus het gemiddelde dividendrendement (5 jaar) moet minstens 15% per jaar zijn (geld verdubbelen in 5 jaar). Haalt een aandeel in de koopzone dat niet, dan is het hoogstens Neutraal. Een onbekend dividend telt als 0% (voorzichtig).
- Tabblad Bronnen: bij winst per aandeel uit pdf-jaarverslagen staan de gebruikte verslagen (boekjaar, pagina, link). Wordt zichtbaar zodra die cijfers er zijn.

## 2026.10.25-beta.70
- **Brug over een ontbrekend jaarverslag.** Bij 35 Europese bedrijven ontbreekt één ESEF-jaarverslag in de reeks (ook bij de bron, filings.xbrl.org). Het jaar erna staat wel als vergelijkend cijfer in het volgende verslag, maar er was geen gedeeld jaar om te controleren of beide op hetzelfde aantal aandelen rekenen. Nu wordt dat gecontroleerd met het aantal aandelen uit beide verslagen: ongeveer gelijk → de reeks loopt door; een zuivere splitsingsfactor → omgerekend; anders stopt de reeks zoals voorheen. Minstens één kant moet een gerapporteerd aantal aandelen hebben (bij Air France, met een samenvoeging van aandelen in 2023, blijft de reeks daarom gesplitst).
- Gevolg: langere reeksen voor o.a. Saint-Gobain, Hermès, Bureau Veritas, DiaSorin, Eurofins en ICG; nieuw met een bruikbare reeks: Amplifon, Prysmian, Acciona en Logista.
- Alle jaarcijfers worden bij de eerstvolgende nachtelijke update opnieuw opgehaald.

## 2026.10.25-beta.69
- **NAIC compleet met deel 1 en 2 van de Stock Selection Guide** (“Is het een goed bedrijf?”), zichtbaar op de NAIC-kaart:
  - **Groeien omzet en winst gelijk op?** De omzet moet groeien en de winst per aandeel mag niet meer dan 10 procentpunt per jaar sneller groeien; anders komt de winstgroei uit hogere marges of minder aandelen en houdt die meestal niet lang aan.
  - **Management: marge vóór belasting en rendement op eigen vermogen** over 5 jaar stabiel of stijgend (helling van de lijn). Bij banken en verzekeraars tellen omzet en marge niet; bij heel klein eigen vermogen (veel inkoop van eigen aandelen, zoals Home Depot) zegt het rendement niets en wordt het niet getoetst.
  - Valt een toets af, dan geeft NAIC hoogstens Neutraal: NAIC koopt alleen een goed bedrijf.
- **Groei als trendlijn**, zoals NAIC hem tekent (rechte lijn door alle jaren, hoogstens 10), in plaats van van eerste naar laatste jaar. Eén ingezakt jaar zoals 2020 weegt zo veel minder.
- Op de cijfers van 22 oktober: NAIC-oordeel bij 210 fondsen (14× Kopen, 79× Neutraal, 117× Vermijden). NAIC is daarmee bewust streng.
- Nieuw hulpmiddel voor ontwikkeling: **terugrekenen** (`hulp/terugrekenen.py` en `.js`, workflow “Terugrekenen”): wat zeiden de app en NAIC op vroegere peildata en wat deed de koers daarna.

## 2026.10.24-beta.68
- **NAIC als tweede oordeel naast dat van de app.** Bij elk aandeel staan nu twee oordelen: dat van de app (zes metingen) en dat volgens de NAIC Stock Selection Guide, automatisch berekend met voorzichtige aannames:
  - groei: historische groei van de winst per aandeel (laatste 5 jaar), hoogstens 15% per jaar; minder dan 5% is geen NAIC-groeibedrijf (Vermijden);
  - gemiddelde hoge en lage K/W van de laatste 5 jaar; ongewone jaren (eenmalige lasten, K/W boven 60) worden weggelaten, zoals NAIC voorschrijft;
  - verwachte hoge koers over 5 jaar en lage koers (laagste winst per aandeel van 5 jaar × lage K/W), met drie zones: kopen, houden, verkopen;
  - Kopen: koers in de koopzone met minstens 3 : 1 opwaarts tegen neerwaarts; verkoopzone: Vermijden; anders Neutraal.
- **Waar te zien**: een NAIC-kaart op het Overzicht van elk aandeel (groei, gemiddelde K/W, verwachte koersen, zones, opwaarts tegen neerwaarts, verwacht rendement per jaar), een NAIC-chip naast het oordeel in Fondsen en Kansrijk, sorteren op “NAIC-oordeel”, en bij Kansrijk de keuze **App · NAIC · Beide**. Eigen aannames blijven mogelijk op het tabblad NAIC.
- Op de cijfers van 22 oktober: een NAIC-oordeel bij 188 fondsen (36× Kopen, 57× Neutraal, 95× Vermijden); bij 16 fondsen zeggen app en NAIC allebei Kopen. Zonder NAIC-oordeel vooral door minder dan 4 jaar vergelijkbare winst per aandeel.
- Het label bij de plek in het koersbereik heet nu “Onderin, ruim opwaarts / Midden / Bovenin”, om verwarring met het NAIC-oordeel te voorkomen.

## 2026.10.24-beta.67
- **Meer winst per aandeel uit de Europese jaarverslagen.** Bij veel fondsen bleef de winst per aandeel buiten beeld, omdat de jaarverslagen onderling niet aansloten. De koppeling over de jaren is verbeterd, met het gemiddelde aantal aandelen uit de rapporten als ijkpunt (winst ÷ winst per aandeel moet daarbij passen):
  - **Tagfouten hersteld**: een macht van tien of een verkeerd minteken in de getagde waarde (3i in pence als ponden; Poste Italiane 1.483.000 i.p.v. 1,483; Solvay en Fagron een factor 100; ook Logista, Greggs en Generali, maar daar zijn nog te weinig jaren voor een reeks). Het minteken volgt dat van de winst.
  - **Bonusaandelen en splitsingen**: alleen omgerekend als winst en aantal aandelen dat bevestigen (Veolia, Nexi). Een verschil zonder die bevestiging (bijv. een herrekening naar alleen voortgezette activiteiten) stopt de reeks, zoals voorheen.
  - **Kleine herzieningen** (tot 6%): het nieuwste cijfer telt.
  - Winst per aandeel uit alleen voortgezette activiteiten als laatste terugval (zoals al bij SEC-bedrijven).
  - Minimum voor een reeks uit het jaarverslag: 4 jaar (was 5), gelijk aan wat de meting Groei nodig heeft.
- Gevolg op de cijfers van 22 oktober: 34 fondsen extra met winst per aandeel uit het jaarverslag, waaronder BNP Paribas, AXA, Engie, Safran, Veolia, Poste Italiane, UniCredit, Redeia, D'Ieteren, Solvay, 3i, Antofagasta, IHG, Prudential en Sainsbury's. Groei bekend bij 184 fondsen (was 153), K/W bij 253 (was 223), een oordeel bij 308 (was 296).
- Deze cijfers zijn gerapporteerd, niet onafhankelijk nagerekend; ze krijgen nooit het label Bevestigd.
- Alle jaarcijfers worden bij de eerstvolgende nachtelijke update opnieuw opgehaald.

## 2026.10.24-beta.66
- **Ontbrekende investeringen aangevuld.** Veel Europese bedrijven geven hun investeringen in hun ESEF-jaarverslag op onder een eigen begrip in plaats van het standaardbegrip, soms in het Frans of Spaans (Air Liquide: “AcquisitionDimmobilisationsCorporellesEtIncorporelles…”, Wolters Kluwer: “CapitalExpenditure”). Die zijn voor 54 bedrijven per bedrijf nagekeken en vastgelegd (`esef_investeringen.json`, met de indiening per jaar). Waar een bedrijf de investeringen in delen opgeeft, worden die opgeteld (KPN: software + overige materiële + overige immateriële activa; Vopak: groei + onderhoud + immaterieel). Daarnaast een iets breder standaardbegrip als terugval (IFRS: materiële en immateriële vaste activa samen; SEC: PaymentsToAcquireProductiveAssets, o.a. Amazon, Nvidia, Visa, PepsiCo, Home Depot). Bij elk aangevuld cijfer staat welk begrip is gebruikt.
- Gevolg op de cijfers van 22 oktober: vrije kasstroom bekend bij 275 fondsen (was 188); na de nachtelijke update komen er ongeveer tien Amerikaanse bij. Fondsen met een oordeel: 296 (was 272).
- **Banken en verzekeraars beter herkend**, ook zonder melding in de gegevens: geen omzet (alleen rente- of premie-inkomsten) en verplichtingen van minstens 80% van de bezittingen. Voor hen telt rendement op eigen vermogen in plaats van vrije kasstroom, en schuldgraad vervalt. Eerder kregen onder meer ABN AMRO, NN, Aegon, BNP Paribas, Barclays en HSBC ten onrechte een ongunstige schuldgraad.
- Alle jaarcijfers worden bij de eerstvolgende nachtelijke update één keer opnieuw opgehaald, zodat de aanvulling overal doorwerkt.
- Vastgoedfondsen: de investeringen tellen alleen materiële en immateriële vaste activa, niet de aankoop van vastgoedbeleggingen (WDP, Aedifica, Montea), zodat de definitie gelijk blijft.

## 2026.10.24-beta.65
- **Geen dubbeltellingen meer: het oordeel rust op zes metingen die elkaar niet overlappen.** Op de 347 fondsen is nagemeten hoe sterk de methoden samenhangen. Een deel bleek grotendeels hetzelfde te meten (bijvoorbeeld trend van 200 dagen en momentum 0,79; nettomarge en rendement op eigen vermogen 0,54; koers/winst en dividendrendement 0,59), waardoor zulke kenmerken dubbel telden. Het oordeel gebruikt nu alleen: vrije kasstroom (banken: rendement op eigen vermogen), schuldgraad (nieuw: verplichtingen ÷ bezittingen), groei van de winst per aandeel, koers/winst, trend van 200 dagen en rust (volatiliteit). Grootste onderlinge samenhang: 0,26. Alle zes tellen even zwaar.
- **Oordeel in de woorden van NAIC: Kopen, Neutraal of Vermijden.** Kopen bij een gemiddelde vanaf +0,5 (duidelijk gunstig), Vermijden vanaf −0,25, daartussen Neutraal. Pas een oordeel bij minstens 4 van de 6 metingen (instelbaar onder Instellingen). Het NAIC-label op de plek in het koersbereik heet nu ook Kopen in plaats van Positief.
- **Meningen tellen niet mee.** Uw eigen beoordeling, de kwaliteitscheck en het advies van analisten staan erbij ter informatie. Een ontbrekend cijfer dat u zelf invult (een feit uit het jaarverslag) vult wel de bijbehorende meting aan.
- **Duidelijk wat ontbreekt.** Per aandeel staat “5 van 6 metingen”, met per meting de waarde en de bron, of in gewone woorden waarom ze ontbreekt (“de investeringen staan niet in de jaarcijfers”). Onder Fondsen staat voor alle fondsen samen per meting hoeveel er beschikbaar zijn en wat het vaakst ontbreekt.
- **Analisten van Yahoo Finance** (ter informatie): gemiddeld advies, aantal analisten en gemiddeld koersdoel, met de kanttekening dat analisten gemiddeld optimistisch zijn.
- Balans en kasstroom tellen nu ook bij bedrijven waarvan de winst per aandeel nog niet bevestigd is (een aandelensplitsing zonder bewijs raakt alleen de winst per aandeel). Daardoor hebben meer fondsen een oordeel uit jaarcijfers.
- Andere kentallen (marge, Piotroski, Altman, Magic Formula, dividend, omzetgroei, regelmaat, trend 50 dagen, momentum, RSI, plek in het bereik) blijven zichtbaar onder “Ter informatie”, per onderwerp.
- De regelknoppen (NAIC, Kwaliteit, Trendvolger) van beta.64 zijn vervangen door het ene oordeel; Kansrijk toont de aandelen met Kopen. Op de cijfers van 22 oktober: 78× Kopen, 161× Neutraal, 33× Vermijden, 75 zonder oordeel (te weinig metingen).

## 2026.10.23-beta.64
- **Vijf vragen per aandeel in plaats van één totaaloordeel.** Elk aandeel krijgt vijf antwoorden: *Is het een goed bedrijf?* (rendement, marge, kasstroom, schuld, Piotroski, Altman), *Groeit het?* (omzet- en winstgroei, regelmaat), *Is de prijs aantrekkelijk?* (K/W, Magic Formula, dividend, plek in het koersbereik), *Hoe staat de koers ervoor?* (trends, RSI, momentum, schommelingen) en *Wat vindt u zelf?* (uw kwaliteitscheck en beoordelingen). Per vraag: gunstig (✓), neutraal (=), ongunstig (✗) of te weinig gegevens (lege ring). Een sterk bedrijf met een hoge prijs blijft zo zichtbaar, in plaats van weg te vallen in één gemiddelde.
- **Duidelijk waar het advies vandaan komt.** Op het aandeelscherm staat per vraag een kaart met elk cijfer dat meetelt, of het gunstig of ongunstig is, en de bron: gecontroleerd, uit jaarverslag (met boekjaar), koersdata (met datum), indicatief (Yahoo) of uw eigen invoer. Wat nog onbekend is staat erbij. Bij banken staat welke methoden niet van toepassing zijn; die tellen niet mee.
- **Kansrijk volgens een regel die u kiest**: NAIC (goed bedrijf, groeit, prijs gunstig), Kwaliteit voor een redelijke prijs, Trendvolger of Alle vragen. Te kiezen met knoppen bij Kansrijk en bij Fondsen; de keuze wordt onthouden. Fondsen sorteert eerst op wie aan de regel voldoet.
- **Over het bedrijf**: korte beschrijving, sector, hoofdkantoor, oprichtingsjaar en website, uit Wikipedia (CC BY-SA) en Wikidata (CC0), met bronvermelding. Beschikbaar voor 323 van de 347 fondsen; gekoppeld via LEI of SEC-nummer, de rest op naam en nagekeken. De sector staat ook in de lijsten.
- Instellingen: “Minimale onderbouwing per vraag” (standaard 40%) vervangt “Minimale dekking”.
- Volglijst en aankopen “op signaal” bewaren nu de vijf antwoorden en de regel van dat moment. Oudere momentopnames blijven leesbaar.

## 2026.10.22-beta.63
- **Fout hersteld in de automatische uitlezer (zat in beta.62).** Bij boekjaren die niet op 31 december eindigen (bijvoorbeeld DCC, maart) en bij Britse documenten met een afwijkende publicatiedatum werd het tweede jaar uit een jaarverslag soms een jaar te vroeg vastgelegd. DCC stond daardoor ten onrechte op 10 bevestigde jaren met verkeerde oudere cijfers. Het tweede jaar komt nu uit de jaartallenkop van de tabel zelf. Een winst per aandeel of winst van precies 0 telt niet meer. Controle achteraf: alle 184 automatisch uitgelezen jaren die ook getagd in een ESEF-rapport staan, komen daarmee overeen.
- **Londense fondsen met de hand afgemaakt** (BAE Systems, DCC, Marks & Spencer, Smiths, St. James's Place, BP), met letterlijke tekst en pagina uit de officiële jaarverslagen. Een Brits jaarverslag dat bij een ESEF-rapport hoort, staat nu onder hetzelfde kenmerk, zodat winst per aandeel en aantal aandelen in één indiening te vinden zijn.
- **Nu volledig bevestigd (10 jaar): BAE Systems, DCC (nu met de juiste cijfers), Imperial Brands, Marks & Spencer en Smiths**, naast Coca-Cola HBC en Glencore. Computacenter en St. James's Place 9 jaar (voor 2016 staat geen jaarverslag op naam in het Britse register), BT 7. Volledig bevestigd: 66. Bevestigde jaren in Londen opgeteld: 194 → 221.
- Niet gelukt: BP (de jaarverslagen taggen ook de winst per ADS met hetzelfde begrip, waardoor het jaar 2020 dubbelzinnig blijft).

## 2026.10.22-beta.62
- **Fondsen: compacte filterbalk.** Zoekveld bovenaan, daaronder index, weergave en sortering naast elkaar zonder losse kopjes, en het vinkje voor bevestigde cijfers. De uitleg over de woorden staat nu onder de lijst. Op een telefoon begint de lijst daardoor ongeveer een half scherm hoger.
- **Londense jaarverslagen uit het officiële Britse register** (FCA National Storage Mechanism) met de nieuwe hulpworkflow 'Britse jaarverslagen ophalen (ontwikkeling)': 430 jaarverslagen (boekjaren 2015-2021) van 83 Londense fondsen opgehaald, als tekst bewaard met publicatiedatum en officiële link.
- **Automatische uitlezer verbeterd** (`hulp/pdf_uitlezen.py`): winst per aandeel in pence of cents, Britse tabellen met winst en gewone/verwaterde winst per aandeel op één regel, kolommen gewoon/verwaterd per jaar, labels die over twee regels lopen, toelichtingsnummers voor de getallen, html-tabellen met één cel per regel, en de orde van grootte van het aantal aandelen uit de ESEF-jaren als controle (duizenden of miljoenen). Nog steeds alleen vastgelegd als beide jaren op de cent kloppen en er precies één combinatie past. Test op de met de hand gelezen Nederlandse jaarverslagen: 40 van 40 uitgelezen jaren juist (was 33), geen enkele fout.
- **Nu volledig bevestigd (10 jaar): Coca-Cola HBC, DCC en Glencore.** Ook vooruit: Computacenter 9 jaar, BT 8, Imperial Brands 6. Volledig bevestigd van 59 naar 62; niets achteruit.
- Gebroken boekjaren van 52/53 weken (bijv. Marks & Spencer) krijgen de echte periode uit de ESEF-cijfers.

## 2026.10.22-beta.61
- **Nieuw menu-onderdeel Fondsen** (vervangt Zoeken): alle aandelen per index gegroepeerd (AEX, AMX, BEL 20, CAC 40, DAX, FTSE 100, IBEX 35, FTSE MIB, Verenigde Staten), per groep het aantal fondsen en het aantal met een positief oordeel. Standaard staan per index de vijf meest kansrijke bovenaan, met “Alle tonen” voor de rest. Kies “Eén lijst” om alle fondsen samen te rangschikken.
- **Sorteren op kansrijkheid**: eerst positief, dan neutraal, dan vermijden, dan te weinig gegevens; binnen elke groep de hoogste score, gewogen met de onderbouwing. Ook te sorteren op naam, plek in het koersbereik, afstand tot het gemiddelde, winst- en omzetgroei, marge en opwaarts tegen neerwaarts. Zoeken op naam of beurscode en filteren op index of alleen bevestigde cijfers blijven.
- **Start opgeruimd**: de lange lijst met alle aandelen en het blok “Interessante aandelen” zijn weg. Het dashboard toont de 8 kansrijkste, met een knop naar Fondsen. De cijfertabel staat er alleen nog voor uw eigen volglijst.
- **Duidelijkere woorden bij het oordeel.** Een oordeel heeft twee delen: het oordeel zelf (positief, neutraal, vermijden: wat de cijfers samen zeggen) en de onderbouwing (goed, redelijk, beperkt of zwak onderbouwd: hoeveel van de mogelijke gegevens bekend is). Dit vervangt “stevig / redelijk / voorlopig / zeer voorlopig”, dat naast “voorlopig oordeel” verwarrend was. Uitleg onder “Wat betekenen positief, neutraal, vermijden en onderbouwd?” bij Kansrijk en Fondsen.

## 2026.10.22-beta.60
- **Aantal aandelen uit de tekst van de ESEF-rapporten 2020-2025, nu ook buiten Nederland** (Londen, Parijs, Madrid, Milaan, Brussel, Frankfurt): 231 fondsen automatisch uitgelezen met dezelfde controle (winst / aandelen = gemelde winst per aandeel op de cent; hetzelfde jaar in twee rapporten gelijk). De uitlezer kent nu ook Franse, Spaanse, Italiaanse en Duitse labels en Europese getalnotatie (1 234 567 en 25,13).
- Resultaat (bevestigde jaren, opgeteld): Londen 3 → 176, Parijs 43 → 80, Madrid 20 → 71, Milaan 25 → 41, Brussel 27 → 40, Frankfurt 13 → 17. Voorbeelden: Coca-Cola HBC, Qiagen, Endesa, Bureau Veritas en argenx 7 jaar; Saint-Gobain, Thales, Naturgy, Glencore, BT en Informa 6. Niets achteruit.
- **Nieuw: Franse jaarverslagen uit het officiële Franse register** (info-financiere.gouv.fr, open data van de AMF/DILA), met hulpworkflow 'Franse jaarverslagen ophalen (ontwikkeling)'. Alleen documenten waarin de winst per aandeel staat; per jaar automatisch uitgelezen en alleen vastgelegd als winst / verwaterd aantal aandelen de gemelde winst per aandeel geeft en er precies één passende combinatie is. Getest op de met de hand gelezen Nederlandse jaarverslagen: 33 van 33 uitgelezen jaren juist, de rest niet uitgelezen. Vastgelegd voor o.a. LVMH, Air Liquide, Capgemini, Dassault Systèmes, L'Oréal, Orange, Pernod Ricard (gebroken boekjaar juni), Publicis en Société Générale.
- Nog geen extra fondsen met tien jaar: voor de meeste Franse fondsen staan de volledige jaarverslagen van vóór 2020 niet in dat register (alleen persberichten), en Duitse ESEF-rapporten staan nauwelijks in de openbare database.

## 2026.10.22-beta.59
- **AMX, stap 2: jaarverslagen 2015-2019 uit het AFM-register.** Per jaar winst per aandeel, teller en verwaterd aantal aandelen met de hand gelezen en vastgelegd met AFM-kenmerk, pagina en tekst; elk jaar nagerekend (winst / aandelen = gemelde winst per aandeel).
- **Nu volledig bevestigd (10 jaar): Aalberts, AMG, Arcadis, BAM, Corbion, Flow Traders, Heijmans, SBM Offshore, Signify, TKH, Van Lanschot Kempen en Vopak.** Basic-Fit 9 jaar (beursgang 2016: aantal aandelen +25%, dus 2016 buiten de reeks). Volledig bevestigd van 47 naar 59; niets achteruit, geen bestaande EPS gewijzigd.
- Let op: AMG en SBM Offshore rapporteren in dollar, de koers is in euro. De winst per aandeel is bevestigd, maar koers-winstverhouding en dergelijke worden (zoals bij andere fondsen met twee valuta) niet berekend.
- Bewust niet: Pharming (rapporteert sinds 2020 in dollar, daarvoor in euro: geen vergelijkbare reeks), Fugro en HAL (aangepaste aantallen door claimemissie en stockdividend), Theon, CSG, CVC, Havas, Allfunds, CTP en InPost (te korte historie of andere valuta).
- AFM-hulpscript zoekt nu ook op oude bedrijfsnamen (Philips Lighting, Aalberts Industries, Van Lanschot) en vult de index aan in plaats van te overschrijven.

## 2026.10.22-beta.58
- **AMX toegevoegd (Amsterdamse midcaps, 25 fondsen)** volgens de Euronext-herzieningen tot en met juni 2026 (september 2026: geen wijzigingen). Nieuw in de app o.a. Arcadis, BAM, Basic-Fit, Corbion, CTP, Flow Traders, Fugro, HAL, Heijmans, Pharming, Signify, TKH, Van Lanschot Kempen, Vopak, Allfunds, AMG, Air France-KLM, Fagron, Galapagos, Havas, Theon en CSG. Filter 'AMX (Amsterdam midcap)' in de keuzelijst.
- **AEX bijgewerkt naar de huidige samenstelling:** CVC, InPost, WDP, SBM Offshore en Aalberts erbij; Randstad staat sinds maart 2026 in de AMX.
- **Aantal aandelen uit de tekst van de ESEF-rapporten 2020-2025** voor de nieuwe fondsen (zelfde controle als bij de AEX, nu ook voor Nederlandstalige verslagen en tabellen waarin de winst in miljoenen staat; afgeronde aantallen zoals '27 miljoen' tellen automatisch niet mee). Met de hand aangevuld: Arcadis, BAM, Heijmans, TKH, Van Lanschot Kempen, Vopak, Aalberts, Basic-Fit.
- Resultaat (bevestigde jaren): Vopak 7, Van Lanschot Kempen 7, Signify 7, AMG 6, Arcadis 6, Basic-Fit 6, Corbion 6, Flow Traders 6, Heijmans 6, Pharming 6, SBM Offshore 6, TKH 6, BAM 5, Aalberts 5, WDP 5, CTP 4. Tien jaar vraagt de jaarverslagen 2016-2019 uit het AFM-register (volgende stap).
- Een getagd ESEF-feit dat hetzelfde getal is maar afgerond (127.626.000 tegenover 127.626.399 in de tekst) maakt een document niet meer ongeldig.
- Nog geen jaarcijfers: Theon en CSG (geen ESEF-rapporten in de openbare database), InPost (rapporteert in zloty), Fugro en HAL (aangepaste aantallen door claimemissie/stockdividend).

## 2026.10.22-beta.57
- **AEX, stap 2: jaarverslagen 2016-2019 uit het AFM-register.** De jaarlijkse financiële verslagen die beursfondsen bij de AFM deponeren, opgehaald via de nieuwe hulpworkflow 'AFM-jaarverslagen ophalen (ontwikkeling)' (één officiële bron, met de echte deponeringsdatum). Per jaar winst per aandeel, teller en verwaterd aantal aandelen met de hand gelezen en vastgelegd met AFM-kenmerk, pagina en tekst; elk jaar nagerekend.
- **Nu volledig bevestigd (10 jaar): Heineken, NN, Wolters Kluwer, ASM, Randstad en ABN AMRO.** KPN 9 jaar (2018: KPN meldt 0,06 terwijl winst / aandelen 0,053 geeft). Volledig bevestigd van 41 naar 47; niets achteruit, geen bestaande EPS gewijzigd.
- **Schaalfouten in getagde winst per aandeel hersteld met bewijs:** alleen als de getagde waarde niet past bij winst / aandelen uit hetzelfde rapport en precies één macht van tien dat wel op de cent doet (Randstad 2020/2021: 1.610.000 → 1,61; AkzoNobel 2021/2022: 0,0446 → 4,46). Vastgelegd in `eenheid_correcties`. AkzoNobel van 4 naar 6 jaar.
- Teller voor de verwaterde winst per aandeel telt ook als enige winstcijfer van een jaar (pdf-jaarverslagen die alleen die teller noemen).
- Bewust niet gedaan: AkzoNobel 2016-2019 (samenvoeging van aandelen in 2019), IMCD 2016-2019 (verwaterde winst per aandeel met aangepaste teller, hoger dan de gewone), ArcelorMittal (cijfers in dollar, koers in euro).

## 2026.10.22-beta.56
- **AEX, stap 1: aantal aandelen uit de tekst van de ESEF-rapporten 2020-2025.** Automatisch uitgelezen en per getal gecontroleerd (winst / aandelen = gemelde winst per aandeel op de cent; een getal mag maar bij één jaar passen; hetzelfde jaar in twee rapporten moet gelijk zijn), aangevuld met de hand waar het automatisch niet lukte (KPN, NN, Randstad, AkzoNobel, ABN AMRO). Ook de teller na aftrek van coupons/eeuwigdurende obligaties waar het bedrijf die gebruikt (ABN AMRO, KPN, NN). Alles met bron in `jaarverslag_bronnen.json`.
- Resultaat (bevestigde jaren): ABN AMRO 0→6, Adyen 0→7, KPN 0→6, NN 0→6, Wolters Kluwer 0→6, Randstad 0→5, AkzoNobel 0→4, ASR 0→3, ASM 2→7, Eni 9→10 (nu volledig bevestigd). Volledig bevestigd van 40 naar 41. Niets achteruit, geen bestaande EPS gewijzigd.
- **Fout hersteld: teller per jaarverslag.** De controle koos het type winst (winst voor aandeelhouders of totale winst) voor het hele bedrijf; bij ASM (winst voor aandeelhouders pas vanaf 2025 getagd) vielen daardoor alle oudere jaren weg. Nu per jaarverslag.
- **Tagfout in valuta hersteld:** Wolters Kluwer tagde de winst per aandeel 2025 als dirham (AED) terwijl het hele rapport in euro is. Alleen als een rapport voor alle bedragen één valuta heeft en alleen de per-aandeelbedragen in een andere, verder ongebruikte valuta staan, wordt dat gecorrigeerd en vastgelegd (`eenheid_correcties`).
- Gevonden en bewust niet gerepareerd: schaalfouten in ESEF-rapporten (winst per aandeel ×1.000.000 bij ASR 2022 en Randstad 2021, ×100 bij AkzoNobel 2021); die jaren worden niet bevestigd.
- Nog niet gelukt (complexe aandelenstructuur of beperkte historie): Aegon, BE Semiconductor, DSM-Firmenich, Exor, Prosus, RELX, Universal Music Group.

## 2026.10.22-beta.55
- **Proef: cijfers uit officiële jaarverslagen die niet machineleesbaar zijn** (nieuw `jaarverslag_bronnen.py` en register `jaarverslag_bronnen.json`). Voor Ahold Delhaize zijn uit de pdf-jaarverslagen 2017 en 2019 de verwaterde winst per aandeel, de winst en het gewogen aantal verwaterde aandelen over 2016-2019 vastgelegd, en uit de tekst van de ESEF-rapporten 2021-2025 het aantal verwaterde aandelen (staat daar niet getagd). Per getal: document, pagina en oorspronkelijke tekst. Eén keer uitgelezen, nooit opnieuw opgehaald; een officieel getagd ESEF-feit wordt nooit overschreven en een afwijkend getal maakt het hele document ongeldig. De bestaande controle beslist daarna.
- Resultaat Ahold Delhaize: van 0 naar 9 bevestigde jaren (2017-2025), elk jaar nagerekend (winst / aandelen = gemelde winst per aandeel). 2016 valt buiten de reeks door de fusie met Delhaize (aantal aandelen +24%). Tien jaren zijn voor Ahold Delhaize dus pas haalbaar vanaf boekjaar 2026.
- **Verwaterde teller (IFRS):** de winst voor de verwaterde winst per aandeel (inclusief terugboeking van preferent dividend) telt als tweede teller.
- **Aandelenreeks na een fusie:** springt het aantal aandelen in een ouder jaar (fusie), dan geldt de controle voor de langste stabiele reeks tot en met het nieuwste jaar, in plaats van alles te blokkeren. Een sprong in het nieuwste jaar blokkeert nog steeds. Linde 7 jaar (na Praxair), Stellantis 5 (na FCA/PSA), Eni 9, ook Capgemini, Renault en Diageo krijgen bevestigde jaren. Niets achteruit, geen bestaande EPS gewijzigd.
- Hulpmiddel voor ontwikkeling: workflow 'Jaarverslagen ophalen (ontwikkeling)' zet officiële pdf-jaarverslagen op de aparte tak `jaarverslagen`.
- Nieuw: `test_jaarverslag_bronnen.py` (6 tests) en een test voor de aandelenreeks.

## 2026.10.21-beta.54
- **Gewone winst per aandeel als laatste terugval:** meldt een bedrijf voor een boekjaar geen verwaterde winst per aandeel, maar wel de gewone (ABN AMRO e.a. zonder opties of converteerbare leningen, waar beide gelijk zijn), dan wordt die gebruikt. Ook 'gewoon en verwaterd' in één cijfer telt nu als verwaterd. Het dossier meldt bij 'Let op' voor welke jaren de gewone winst per aandeel is gebruikt (`eps_gewoon` per jaar). De herberekening beslist daarna nog steeds: bij merkbare verwatering blijft een jaar onbewezen.
- ABN AMRO, Inditex, Leonardo en Naturgy krijgen een winstreeks (niveau 'Uit jaarverslag', met K/W-historie); argenx van 5 naar 7 en Montea van 4 naar 5 bevestigde jaren. Niets achteruit, geen bestaande EPS gewijzigd.
- Splitsingscontrole: per jaar maar één uitwijkbegrip, nooit twee door elkaar.

## 2026.10.21-beta.53
- **Londen in ponden:** Yahoo geeft Londense koersen in pence (GBX). De update deelt koersen en koershistorie nu door 100 (een vaste eenheid, geen wisselkoers) en de app toont en rekent Londense aandelen in ponden (GBP). Daardoor krijgen Londense bedrijven die in ponden rapporteren voor het eerst een K/W, dividendrendement, koersbereik op jaarbasis en scoremodellen. Bedrijven die in dollars rapporteren (Shell, BP, AstraZeneca, HSBC, Diageo) houden verschillende valuta en blijven zonder K/W: daarvoor zou een wisselkoers nodig zijn.
- Dividenden van Londense aandelen staan bij Yahoo meestal in pence, soms al in ponden: per uitkering vastgesteld aan de hand van de koers van die dag.
- Controle blijft: geeft Yahoo voor Londen geen pence op, dan komt er geen koers.
- **Portefeuille en volglijst:** aankopen en momentopnamen die eerder in pence (GBX) zijn ingevoerd tellen gewoon mee (1 pond = 100 pence). Bij het invoeren van een Londense aankoop staat een hint om GBX te kiezen als uw bank de koers in pence geeft.
- Nieuw: `test_londen.py` (4 tests) en een JavaScript-test voor de portefeuille.

## 2026.10.21-beta.52
- **Winst voor gewone aandeelhouders als tweede teller:** reproduceert de vaste teller (nettowinst) de gemelde EPS niet, dan mag een andere officiële teller uit hetzelfde jaarverslag het bewijs leveren: winst na preferent dividend (US-GAAP) of winst toerekenbaar aan gewone aandeelhouders (IFRS, na AT1-coupons). Alleen als die de gemelde EPS binnen 0,4% oplevert. De vaste volgorde blijft, dus bij ING en Sanofi (beta.32) verandert niets. JPMorgan en Santander nu volledig bevestigd (10 jaar), Eni van 4 naar 7 jaar. Volledig bevestigd van 38 naar 40; niets achteruit.
- **Totale schulden afgeleid** voor bedrijven die ze niet zelf melden (Amazon, Walmart, Coca-Cola, Eli Lilly, Merck, Amgen, Oracle, Thermo Fisher, Nike, Disney, AbbVie, Honeywell): balanstotaal min eigen vermogen (inclusief minderheidsbelang) min tijdelijk eigen vermogen, alle onderdelen uit hetzelfde jaarverslag en alleen als de balans sluit. 116 jaren extra. Controle bij bedrijven die het wel zelf melden: 421 van 427 jaren binnen 0,5%, de rest binnen 3% (posten tussen schuld en eigen vermogen onder ongebruikelijke namen). Dit voedt o.a. Altman Z en de schuldratio.
- Goedgekeurde bedrijven worden één keer opnieuw opgehaald als de rekenregels voor de extra kentallen veranderen (`EXTRA_VERSIE`), zodat nieuwe kentallen niet maanden op zich laten wachten door 'opslaan en afblijven'.

## 2026.10.21-beta.51
- **Terugval op het gewone gewogen aantal aandelen** als het verwaterde aantal in een jaarverslag ontbreekt (US-GAAP en IFRS). De herberekening vergelijkt nog steeds met de gemelde verwaterde EPS, dus dit lukt alleen als verwatering verwaarloosbaar is (minder dan 0,4%). Exxon Mobil nu volledig bevestigd (10 jaar, gelijk aan het jaarverslagarchief); IMCD en Montea krijgen 5 en 4 bevestigde jaren, argenx 5. Volledig bevestigd van 37 naar 38; niets achteruit.
- Vastgesteld: bij 237 van de 258 Europese (ESEF-)bedrijven staat het aantal aandelen niet in het machineleesbare deel van het jaarverslag (alleen als tekst in de toelichting, gecontroleerd bij onder meer Ahold Delhaize). Voor die bedrijven is onafhankelijk narekenen van de EPS uit de ESEF-gegevens niet mogelijk; zij houden niveau 'Uit jaarverslag'.

## 2026.10.21-beta.50
- **Splitsingen uit de jaarverslagen in de EPS-controle:** als opeenvolgende jaarverslagen de winst per aandeel én het aantal aandelen met dezelfde eenvoudige factor herwerken, telt dat nu als splitsing of samenvoeging, ook als het bedrijf het niet als splitsing tagt. De controle bevestigt de gebeurtenis daarna nog onafhankelijk met de EPS van vóór en na. Gevonden: Mastercard 10:1 (2014) en de samenvoeging van Unilever (8 nieuwe voor 9 oude aandelen, 2025). Unilever had daardoor een niet-vergelijkbare reeks (oude EPS te laag, bv. 2017: 2,14 in plaats van 2,41); dat is hersteld. Alleen de EPS die verschuift (zoals bij een nieuwe boekhoudregel) telt níet als splitsing.
- **Tesla:** splitsingen in verliesjaren worden nu bevestigd (-4,92 -> -0,98 bij de 5:1 van 2020); dezelfde splitsing die de SEC onder veel latere datums herhaalt, blokkeert niet meer. Zes jaren bevestigd met de juiste EPS (2019: -0,33 op huidige basis). Ook strenger: bewijs dat even goed bij 'geen verschil' past telt niet als bevestiging, en dezelfde splitsing onder twee datums met hetzelfde bewijsvenster wordt nooit dubbel toegepast.
- **Ontbrekend oudste jaar blokkeert niet meer alles:** ontbreekt in het oudste jaar (vaak buiten het dossier) de EPS of het aantal aandelen, dan geldt de controle voor de aaneengesloten reeks daarna. Een gat in het midden of in het nieuwste jaar blokkeert nog steeds. Onder meer LVMH, Philips, argenx, Eni, Unibail.
- **Afronding:** een herberekende EPS die minder dan 0,4% van de gemelde afwijkt, telt als consistent (Johnson & Johnson 2023: 13,7295 tegen 13,72). Een splitsing of schaalfout geeft altijd een veel groter verschil.
- Resultaat (offline nagerekend op de SEC- en ESEF-gegevens van 21 oktober): volledig bevestigd van 35 naar 37 (Johnson & Johnson, Unilever), Mastercard van 4 naar 9 jaar, Tesla van 0 naar 6, 26 andere aandelen krijgen bevestigde jaren; geen enkel aandeel gaat achteruit en geen enkele EPS van een al bevestigd aandeel verandert.
- Splitsingen in de app als '4-voor-1' of '8-voor-9 (samenvoeging)'.
- Hulpmiddel voor ontwikkeling: workflow 'SEC-bestanden ophalen (ontwikkeling)' zet de SEC-bestanden op de aparte tak `ontwikkeldata` (alleen handmatig te starten, raakt de app niet).
- Nieuw: `test_eps_beta50.py` (14 tests).

## 2026.10.21-beta.49
- **Jaarverslagarchief in twee lagen** (nieuw `jaarverslag_archief.py`). Laag 1: elk SEC-jaarverslag (10-K, 20-F, 40-F en correcties) wordt per verslag precies zoals gerapporteerd bewaard in `archief/sec/<CIK>/` en daarna nooit meer aangepast. Geeft de SEC later andere cijfers voor een verslag dat al bewaard is, dan blijft het archief staan en komt er een melding. Laag 2 wordt elke run opnieuw uit laag 1 berekend: de winst per aandeel per boekjaar op de huidige aandelenbasis.
- **Melding bij een nieuw jaarverslag:** wat het nieuwe verslag over eerdere jaren zegt, wordt vergeleken met wat er al stond. Splitsing (winst per aandeel en aantal aandelen met dezelfde eenvoudige factor), schaalcorrectie (aantal ×1000 of ×1.000.000, winst per aandeel gelijk) of herwerking (al het andere). Staat per aandeel in `status.json` onder `archief` (`nieuwe_meldingen`; de terugblik bij de eerste opbouw apart).
- **Tweede berekening van de winst per aandeel:** laag 2 wordt naast de bestaande controle gelegd (`archief.eps_controle`). Proef met NVDA (17 jaarverslagen): 10 van 10 jaren gelijk, beide splitsingen (4:1 in 2021, 10:1 in 2024, de laatste niet als splitsing getagd) en de schaalwissel in het verslag van 2012 gevonden. Het archief verandert niets aan de bestaande controle of het label-slot.
- **Opslaan en afblijven:** een volledig bevestigd bedrijf wordt niet meer elke 30 dagen opnieuw opgehaald, maar pas wanneer een nieuw jaarverslag mogelijk is (vanaf 390 dagen na het laatste boekjaareinde, dan wekelijks tot het er is) en anders uiterlijk na 90 dagen.
- **Minder SEC-verkeer:** binnen een run wordt elk SEC-bestand één keer opgehaald (voorheen tot drie keer per bedrijf, en de SEC-tickerlijst bij elk bedrijf opnieuw).
- Nachtelijke update: het archief wordt tussen runs bewaard in de gratis GitHub-cache. Raakt die cache kwijt, dan wordt het archief bij de volgende run opnieuw opgebouwd uit de SEC (er gaat niets verloren; meldingen van die opbouw tellen als terugblik).
- Nieuw: `test_jaarverslag_archief.py` (15 tests). Opmerking: `test_bouw_webdata.py` en `test_boekjaar_en_miljoenen.py` draaien niet omdat `apple_like_fixture.py` niet in de repository staat (was al zo vóór deze versie).

## 2026.10.21-beta.48
- **Indicatieve jaarcijfers van Yahoo Finance** voor bedrijven zonder officiële bron (vooral de Duitse): nieuw `yahoo_jaren.py`. Minimaal 4 boekjaren; kenmerk 'Indicatief (Yahoo)' in plaats van 'Bevestigd'; geen NAIC-label, geen koersdoel en een lager gewicht (0,5) in het totaalbeeld. Twijfelgevallen vervallen: winst per aandeel voor een aandelensplitsing, sprongen in de EPS die niet bij de winst passen, onbekende verslagvaluta (dan geen K/W). Banken krijgen een waarschuwing.
- **Steekproef om Yahoo te toetsen:** bij elk vierde bedrijf met officiële cijfers legt de update de Yahoo-cijfers ernaast. Het resultaat (hoeveel jaren binnen 1% en 5% voor omzet, winst, EPS, kasstroom en eigen vermogen) staat in `status.json` onder `yahoo_vergelijk`.

## 2026.10.21-beta.47
- **XOM hersteld:** oorzaak gevonden met de nieuwe diagnose. Exxon is sinds 2026 een holding (ExxonMobil Holdings Corp, CIK 2115436) en de SEC-tickerlijst wijst daarheen, maar die heeft alleen kwartaalcijfers. De jaarverslagen staan bij de oorspronkelijke Exxon Mobil Corp (CIK 34088); de update gebruikt nu die registrant voor XOM.

## 2026.10.21-beta.46
- **Back-up duidelijker:** bovenaan een gekleurde status ('Uw gegevens zijn veilig bewaard' of 'Er is iets veranderd na uw laatste back-up' met het aantal dagen) en wat er nu op het toestel staat. 'Back-up bewaren' opent op een telefoon het deelmenu (Bestanden, Google Drive, OneDrive, mail); het moment van back-up wordt pas vastgelegd nadat u echt een plek koos, en na afloop staat er waar het bestand is. Sluit u het menu zonder te kiezen, dan meldt de app dat er niets is bewaard.
- **Terugzetten op een telefoon:** de bestandskiezer toont nu alle bestanden (voorheen verborg de telefoon .json-bestanden). Na het kiezen ziet u eerst wat in de back-up zit, wat er nu op het toestel staat en wat nieuw is; daarna kiest u 'Toevoegen' (aanbevolen) of 'Alles vervangen' (met extra bevestiging), of annuleert u. De tekstvariant staat nog onder 'Lukt het niet met een bestand?'.
- **Diagnose SEC:** bij een bedrijf zonder jaarcijfers (zoals XOM) legt de update nu ook vast hoe groot het ontvangen SEC-bestand was, zodat de oorzaak te vinden is.

## 2026.10.21-beta.45
- **Methode aanklikken:** in het Totaalbeeld (en bij 'Wat ontbreekt er nog') opent elke methode een venster met: wat het meet, de cijfers van dit aandeel die erachter zitten, hoe het wordt beoordeeld (drempels), het gewicht en de betrouwbaarheid. Bij Piotroski ziet u alle 9 punten met ✓, ✗ of ? (gegevens ontbreken). Bij een ontbrekende methode staat wat er nodig is.

## 2026.10.21-beta.44
- **Hulp per pagina:** een vraagteken in de kop, naast Instellingen, legt uit wat u op precies deze pagina ziet (Start, Zoeken, Volglijst, Portefeuille, Vergelijken, Instellingen en elk tabblad van een aandeel). De algemene uitleg en woordenlijst staan nog achter 'Alle uitleg en begrippen'. Het menu onderaan heeft daardoor vier onderdelen. Nieuw: `web/js/hulp.js`.

## 2026.10.21-beta.43
- **Goedgekeurde jaren niet elke nacht opnieuw:** de update bewaart het gegevensbestand van de vorige run (gratis GitHub-cache). Een bedrijf met 10 volledig bevestigde jaren wordt tot 30 dagen na de controle niet opnieuw bij de SEC opgehaald (nieuwe jaarverslagen verschijnen hooguit één keer per jaar). Koersen blijven elke nacht vers. Dat scheelt veel looptijd en kans op storingen.
- **Terugval bij uitval:** lukt het ophalen van een bedrijf niet (ook niet na de tweede poging), dan blijven de laatste goede jaarcijfers staan, gemarkeerd als 'uit vorige run' en met hun eigen controledatum. Fouten uit een vorige run worden nooit hergebruikt.

## 2026.10.21-beta.42
- **Tweede kans bij een SEC-storing:** krijgt een Amerikaans bedrijf geen jaarcijfers (time-out, tijdelijke fout, XOM in de run van 21 oktober), dan wacht de update enkele seconden en probeert het één keer opnieuw. Het blijft fail-closed: lukt het nog niet, dan staat er nog steeds geen oordeel.

## 2026.10.21-beta.41
- **Drie extra rekenmodellen (alleen uit eigen jaarcijfers, nooit geschat):** Piotroski F-score (financiële kracht, 9 punten, minimaal 6 toetsbaar), Altman Z-score (faillissementsrisico; niet voor banken) en Magic Formula (winst/bedrijfswaarde en rendement op kapitaal). Zonder alle benodigde cijfers of zonder verse koers tellen ze niet mee. Het aantal aandelen komt uit de jaarcijfers, of uit winst/EPS maar alleen als dat jaar nagerekend is.
- **Nieuwe velden in de nachtelijke update** (SEC en ESEF): totaal activa, vlottende activa en schulden, totale schulden, ingehouden winst, kas, brutowinst, bedrijfsresultaat, gewogen aantal aandelen.
- Standaardminimum voor een oordeel is nu 20% (met de nieuwe onderdelen is 22% het maximum op koersgegevens alleen). Keuzemenu: 10/20/40/60/80.

## 2026.10.21-beta.40
- **Verdiepen (stap 3):** het tabblad 'Checklist' heet nu 'Verdiepen'. Bovenaan de dekking-meter die live meegroeit, daarna uw eigen beoordeling (1-5) van management, concurrentiepositie, sectoruitzicht en risico's (met notitie), en invulplekken voor cijfers die ontbreken (groei, marge, ROE, K/W, dividend). Eigen invoer telt met gewicht 0,6 en vervangt nooit een cijfer uit een jaarverslag. De Fisher-checklist staat eronder en werkt de meter ook bij. Opgeslagen op het toestel en in de back-up (samenvoegen overschrijft nooit).
- **Volgen en portefeuille (stap 4):** bij 'Op mijn volglijst' legt de app het oordeel, de dekking en de koers van dat moment vast; de volglijst toont wat de koers deed sinds die dag en hoe het oordeel toen en nu is. Bij een aankoop kunt u 'Gekocht op basis van het signaal' aanvinken: het oordeel van dat moment wordt vastgelegd, de aankoop is herkenbaar in de portefeuille, en een kaart 'Op signaal gekocht' vergelijkt het rendement met de overige aankopen (per valuta, nooit omgerekend).
## 2026.10.21-beta.39
- **Totaalbeeld per aandeel (nieuw hart van de app):** nieuw `web/js/signaal.js`. 16 onderdelen in 4 groepen: technisch (trend 50/200 dagen, RSI, plek in 10-jaarsbereik), fundamenteel (omzet- en winstgroei, regelmaat, nettomarge, ROE, vrije kasstroom, schuld/kasstroom, K/W, dividend), kwantitatief (momentum, volatiliteit) en kwalitatief (uw Fisher-check). Elk onderdeel geeft −1…+1 of niets bij ontbrekende gegevens, nooit een schatting. Oordeel positief/neutraal/vermijden is altijd voorlopig, met **dekking in %**, de verdeling naar kwaliteit (gecontroleerd 1,0 · koersdata 0,9 · uit jaarverslag 0,7 · eigen invoer 0,6) en een zekerheidsniveau. Onder uw minimale dekking (Instellingen, standaard 25%) geen oordeel.
- **Dashboard:** 'Kansrijk' bovenaan (positieve oordelen, gerangschikt op score gewogen met dekking); oordeel-chip in de tabel. **Aandeelscherm:** kaart 'Totaalbeeld' met per methode de score, de bron en wat er nog ontbreekt. NAIC-label en eerdere controles zijn ongewijzigd.
## 2026.10.21-beta.38
- **Europese jaarcijfers via ESEF:** nieuwe bron voor bedrijven zonder SEC-notering (filings.xbrl.org, officiële jaarverslagen). 258 bedrijven gekoppeld via LEI (`esef_lei.json`), verslagen opgeslagen in één bestand `esef_bundel.json.gz`. De bestaande strenge verificatie draait ongewijzigd op deze cijfers (nieuw: terugval op ProfitLoss voor bedrijven zonder minderheidsbelang). 7 bedrijven worden nagerekend en bevestigd; 111 krijgen niveau 'Uit jaarverslag' (5-8 jaar, niet nagerekend, geen label, geen K/W). Nieuw: `esef_bron.py`.
## 2026.10.20-beta.37
- **Back-upscherm duidelijker:** uitleg waarom een back-up nuttig is, de datum van de laatste back-up vetgedrukt, en twee genummerde stappen (1 maken, 2 terugzetten). De tekstvariant staat onder 'Lukt het bestand niet?'.

## 2026.10.20-beta.36
- **Dashboard:** onder elk aandeel staat "Plek in bereik 24% · 3,1 : 1" (uit de koersreeks van 10 jaar), en je kunt sorteren op die plek (laagste eerst) of op de verhouding opwaarts/neerwaarts. Geldt ook voor aandelen zonder bevestigde cijfers, want het is een koersfeit; een label verschijnt daar nog steeds niet.

## 2026.10.20-beta.35
- **Europa via de indexen:** AEX, BEL 20, CAC 40, DAX, FTSE 100, FTSE MIB en IBEX 35 (samenstelling volgens Wikipedia, oktober 2026): 272 nieuwe aandelen, samen 320. Nieuw `europa_indexen.py`.
- Zij krijgen koers, trend, koersbereik van 10 jaar en een indexlabel, maar **geen jaarcijfers en geen label** tenzij er een SEC-jaarverslag is dat de controle doorstaat. Gekoppeld aan SEC: Deutsche Bank, BBVA, Santander, Telefónica, Grifols. Bij de overige staat "Geen SEC-jaarverslag voor dit bedrijf; alleen koersgegevens".
- **Londen:** koersen staan in pence (code GBX). Controle op de valuta die Yahoo opgeeft; verschilt die van de verwachte, of is hij onbekend bij Londen, dan komt er geen koers. Nooit een omrekening.
- Zoeken en Dashboard: filter op index; zoeken toont zonder zoekterm de eerste 40; Dashboard zonder volglijst de eerste 60.
- Koers-tab: kaart "Plek in het koersbereik" voor alle aandelen met 8+ jaar koershistorie; het label positief/neutraal/vermijden alleen bij bevestigde gegevens.
- De nachtelijke update wacht 0,4 seconde per aandeel (vriendelijk voor Yahoo) en duurt daardoor langer (ongeveer een half uur).

## 2026.10.20-beta.34
- **Labels positief / neutraal / vermijden** in plaats van koop/houd/verkoop. Op de NAIC-tab bij "Plek in het koersbereik": positief = onderste derde én minstens 3 : 1 opwaarts/neerwaarts; vermijden = bovenste derde; anders neutraal. Het label verschijnt alleen bij bevestigde gegevens; zonder bevestiging blijft alleen de beschrijving van het derde staan. Ook de teksten bij je eigen koerszones zijn aangepast (positieve zone, neutrale zone, zone om te vermijden).

## 2026.10.20-beta.33
- **NAIC-tab: plek in het koersbereik.** Hoogste en laagste slotkoers van de laatste (max. 10) boekjaren, de plek van de koers in onderste/middelste/bovenste derde, en de verhouding opwaarts tegen neerwaarts (NAIC-richtlijn 3 : 1). Idee uit een NAIC-handleiding van de gebruiker. Alleen met verse koers en minstens 8 jaar koershistorie; anders "Onbekend". Beschrijving van het verleden, geen koop- of verkoopadvies, geen invloed op het signaal.

## 2026.10.20-beta.32
Run van 15:56 UTC: 33 van 48 bevestigd. Koershistorie lukte voor 47 van 48 aandelen (alleen Exxon niet).
- **Terugdraaien:** de winsttag "gewone aandeelhouders" (beta.29) veroorzaakte dat ING en Sanofi niet meer bevestigd waren: die tag wijkt bij ING en Eni af van de standaardtag en heeft bij Sanofi omgekeerde tekens in oude indieningen. Nu wordt hij alleen gebruikt als een bedrijf de standaardtag helemaal niet heeft (Stellantis).
- Dividend aan aandeelhouders moederbedrijf (IFRS, o.a. Sanofi, Eni) herkend. Diagnose noemt nu ook winst vóór belasting.
- Bewust niet opgelost: afschrijving bij Microsoft, ABBV, TXN, Oracle (alleen losse onderdelen gerapporteerd; optellen zou een ander getal geven dan de NAIC bedoelt).

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
