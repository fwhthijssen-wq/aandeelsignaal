# Jaarverslagbronnen Europa (beta.55–63, 22-10-2026)

**Doel:** 10 bevestigde jaren voor Europese fondsen, terwijl ESEF pas vanaf boekjaar 2020 bestaat en het aantal aandelen daarin meestal alleen als tekst staat.

**Werkwijze (register `jaarverslag_bronnen.json`, module `jaarverslag_bronnen.py`):**
1. ESEF-rapporten 2020–2025 (filings.xbrl.org): tekst van de EPS-toelichting automatisch uitgelezen (NL/EN/FR/DE/ES/IT, Europese notatie genormaliseerd); getal moet winst / aandelen = gemelde EPS op de cent geven. Anders met de hand.
2. Jaarverslagen van vóór 2020 uit officiële registers:
   - **Nederland: AFM-register** (`hulp/afm_jaarverslagen.py`), met de hand gelezen.
   - **Frankrijk: info-financiere.gouv.fr** (`hulp/fr_jaarverslagen.py`, Opendatasoft-API). Vóór 2020 vaak alleen persberichten.
   - **VK: FCA National Storage Mechanism** (`hulp/uk_jaarverslagen.py`; POST `api.data.fca.org.uk/search?index=nsm-search`, criterium `company_lei` = ['', LEI, 'disclose_org', ''], datumfilter, pauzes; 403 bij te veel vragen). Alleen via GitHub-workflow bereikbaar. Op LEI vóór ~2018 vaak weinig te vinden.
   - Alles → tak `jaarverslagen` (fr/, uk/, afm/) als tekst met registerdatum en officiële link.
3. **Automatische pdf-uitlezer** (`hulp/pdf_uitlezen.py`) + `hulp/pdf_naar_register.py`: beide jaren op de (halve) cent, precies één combinatie, pence/cents, Britse combitabellen, basic/diluted-kolommen, html met één cel per regel, orde van grootte via ESEF-aantallen. **Het tweede jaar komt uit de jaartallenkop** (fout in beta.62 hersteld: bij gebroken boekjaren werd het een jaar te vroeg vastgelegd). Controle: 184/184 overlappende jaren gelijk aan getagde ESEF-EPS. Een Brits/Frans jaarverslag dat bij een ESEF-rapport hoort, krijgt hetzelfde kenmerk (fxo_id).
4. Regels register: alleen aanvullen; getagd ESEF-feit gaat voor (afgerond = gelijk); afwijking = document ongeldig. De bestaande controle beslist.

**Resultaten (volledig bevestigd, 10 jaar):** 66 in totaal (stand 22 okt; sinds versie 1.2: 76).
- AEX: Heineken, NN, Wolters Kluwer, ASM, Randstad, ABN AMRO (+ Eni).
- AMX: Aalberts, AMG, Arcadis, BAM, Corbion, Flow Traders, Heijmans, SBM Offshore, Signify, TKH, Van Lanschot Kempen, Vopak.
- Londen: Coca-Cola HBC, Glencore, BAE Systems, DCC, Imperial Brands, Marks & Spencer, Smiths. Computacenter en St. James's Place 9.
- Bevestigde jaren opgeteld: Londen 3 → 221, Parijs 43 → 80, Madrid 20 → 71, Milaan 25 → 41, Brussel 27 → 40, Frankfurt 13 → 17.

**Bewust niet / open:** BP (ADS-EPS met hetzelfde begrip getagd → 2020 dubbelzinnig), AkzoNobel 2016–2019, IMCD 2016–2019, ArcelorMittal, Pharming, Fugro, HAL, Theon/CSG, CVC/Havas/Allfunds/CTP/InPost. Spanje (CNMV) en België (FSMA STORI) nog niet onderzocht; Duitsland: zie duitse-jaarverslagen.md.

## Nederlandse small caps (AScX en Amsterdam overig, 5 nov 2026, versie 1.11–1.12)
- 32 fondsen toegevoegd; LEI's via GLEIF (`hulp/nieuwe_fondsen.py`, workflow *Nieuwe fondsen controleren*); ESEF-rapporten in de bundel via workflow *ESEF-bundel aanvullen* (`hulp/esef_bundel_aanvullen.py`): 26 fondsen, rapporten vanaf boekjaar 2021 (NL: ESEF verplicht vanaf 2021).
- ESEF-aantallen aandelen (`esef_aandelen.json`, 26 fondsen) en AFM-jaarverslagen 2015–2020 (workflow *AFM-jaarverslagen ophalen*). Het **AFM-verslag over 2020 is de brug**: zonder overlappend jaar sluit de keten oud → ESEF niet aan.
- Automatisch uitgelezen (`hulp/afm_uitlezen.py` → `pdf_naar_register.py ... afm`): Avantium, Brunel, Kendrion (2014–2020), Sif, Sligro, TomTom, Heineken Holding. Veel Nederlandstalige verslagen worden nog niet herkend (Nedap, PostNL, Wereldhave, NSI, Ctac, Hydratec, Holland Colours, Ajax, ForFarmers, Vastned).
- Narekenkandidaten uit de AFM-teksten (`hulp/eu_narekenen.py`, pdf's eerst met pdftotext naar .txt): Kendrion 8/10, Alfen 6/6, Acomo 5/5, TomTom 4/5. Nog geen nieuw Bevestigd (81).
- Pdf-lezer Nederlandse verslagen (5 nov): toelichtingsnummer vóór grote getallen ('8   6.444.622   6.407.929'), aantal aandelen voluit onder '(€ x 1.000)' (niet nog eens schalen), winst onder het kopje 'Winst toe te rekenen aan:' ('Aandeelhouders van de Vennootschap'), en de toelichting met het aantal aandelen mag verder weg staan (1500 regels, alleen bij Nederlandstalige regels). Uitgelezen: 22 → 47 verslagen (nieuw o.a. Nedap, ForFarmers, Fastned, Alfen, Hydratec, Ctac). Controle tegen 811 Franse, Britse en Duitse teksten: niets verloren, 7 jaren erbij. Resultaat: **Nedap Bevestigd → 82**.
- Open: Kendrion 2019 en 2022; PostNL, Wereldhave, NSI, Vastned, Acomo, Ajax, Holland Colours worden nog niet gelezen (vastgoed-/afwijkende tabellen); Brunel, Sif, Sligro, ForFarmers, Fastned missen vooral narekening van recente jaren.

## SEC-jaarverslagen (20-F) voor Europese en Britse fondsen (12 nov 2026)
- Veel grote Europese en Britse bedrijven dienen hun jaarverslag ook bij de SEC in (20-F, XBRL vanaf ± boekjaar 2016): tien jaar officiële winst per aandeel, winst en aandelen. Gratis, officieel, en via de bestaande SEC-controle (die ook IFRS-begrippen kent).
- Onderzoek: `hulp/sec_buitenland.py` (alle 20-F/40-F-indieners 2024-2025 uit de EDGAR-index, omzet ≥ 5 mld USD; 189 bedrijven, 166 met NYSE/Nasdaq, 93 met 10 jaar EPS). Proef per fonds SEC naast ESEF: `hulp/sec_proef.py` (workflow *SEC-proef*), uitkomst op tak `onderzoek`.
- Gekoppeld in `europa_indexen.SEC_KOPPELING` (20 fondsen met meer nagerekende jaren dan ESEF): MT, STM, Aegon, RELX, Orange (ORANY), FMC, Tenaris, HSBC, GSK, Lloyds, WPP, IHG, Barclays, NatWest, Vodafone, Prudential, Rio Tinto, BAT, Smith & Nephew, Haleon. De nachtelijke update kiest per fonds het dossier met de meeste nagerekende jaren (SEC of ESEF), nooit gemengd.
- Resultaat: **Bevestigd 82 → 90**. Bijna (9 van 10): Barclays, NatWest, Vodafone, Prudential, FMC; 8: Rio, Smith & Nephew, BAT, Orange.
- Geen of te weinig SEC-gegevens: TotalEnergies, Diageo, National Grid, Rentokil, AB InBev, BP, Deutsche Bank.
- Omrekening (1.18, `valuta_omrekenen.py`): jaarcijfers in een andere valuta dan de notering worden ná de controle per boekjaar omgerekend met het ECB-jaargemiddelde (`ecb_jaargemiddelden.json`, workflow *ECB-jaarkoersen*); terug te draaien bij hergebruik. Zo krijgen HSBC, Rio, ArcelorMittal, STMicro, Prudential en IHG een K/W en NAIC-zones.
- Volgende stappen (afgesproken): Canada en Japan (eigen beurs, zelfde valuta), daarna landen alleen via ADR. Alleen fondsen die bij Saxo én DEGIRO te koop zijn; geen kleine fondsen. EODHD niet: persoonlijke licentie verbiedt tonen aan anderen.

## Canada, Japan en ADR-landen (12 nov 2026, versies 1.18 en 1.19)
- SEC-controle accepteert nu ook CAD, JPY, CHF, AUD (`concept_registry.MONETARY_UNITS`).
- 1.18: 27 Canadese fondsen (Toronto, CAD, index S&P/TSX) en 5 Japanse (Tokio, JPY, Nikkei 225) met minstens 6 jaar nagerekend: TD, RY, BNS, BMO, CM, CNQ, SU, TRP, ENB, CP, IMO, NTR, SLF, TRI, BCE, RCI-B, FTS, GIB-A, TECK-B, ABX, K, PPL, EMA, SHOP, BN, CLS, TFII; MUFG, Mizuho, Sony, Toyota, Takeda. Niet: CN Rail, Magna, TELUS (geen SEC-cijfers), Manulife (4 nagerekend), Nomura, ORIX, Honda.
- 1.19: 8 fondsen alleen via New York (20-F in USD): Infosys, BHP (1 ADS = 2 aandelen), Teva, Check Point, Elbit, ICL, Gold Fields, Sea. Groep 'ADR' ('Overige landen (New York)'), vergeleken met de S&P 500.
- Stand: 418 fondsen, **Bevestigd 109**.
- Controle verbeterd (12 nov, `eps_verification.corrigeer_centen` en splitsingsroute): winst per aandeel in centen/pence onder de valuta-eenheid (×100) wordt herkend en gecorrigeerd als winst / aandelen van dezelfde indiening het bevestigt; de splitsingsroute accepteert de verwaterde naast de gewone oorspronkelijke waarde (Toyota 2020). Nieuw Bevestigd: Rio Tinto, NatWest, Vodafone, Barclays, Toyota → **Bevestigd 114**.
- Bewust niet opgerekt: kleine afwijkingen (0,5–4%) door een aangepaste teller (Suncor 2016, Kinross 2021, ICL 2021, Teva 2019, Rogers 2020/2024, Enbridge 2025, Gold Fields 2017, Smith & Nephew 2019).
- Hulpmiddel `hulp/data_proef.js` (workflow *Gegevens bekijken*): gepubliceerde gegevens per fonds (valuta, omrekening, K/W, NAIC, open jaren met reden).
- Open: Taiwan (TSMC, UMC, Chunghwa) en Korea/India/Brazilië/Mexico rapporteren in eigen munt (TWD, KRW, INR, BRL, MXN); de SEC-controle kent die nog niet, TWD staat niet bij de ECB (Yahoo-koers nodig), en de ADR-verhouding moet per fonds gecontroleerd worden. Cemex: verhouding ADS/CPO onzeker. Chinese fondsen bewust niet. Sectorinformatie (Wikidata) voor de nieuwe fondsen nog aanvullen.
