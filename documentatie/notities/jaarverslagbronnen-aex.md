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
## ADR-landen in eigen munt (12 nov 2026, versies 1.20 en 1.21)
- Valuta: `concept_registry.MONETARY_UNITS` kent nu ook TWD, KRW, INR, BRL, MXN, ZAR, DKK, SEK, NOK, HKD, PEN, COP, CLP. Omrekening naar USD met ECB-jaargemiddelden; TWD, PEN, COP en CLP (niet bij de ECB) met het jaargemiddelde van Yahoo (EURxxx=X).
- 1.20: Novo Nordisk (DKK), Ambev (BRL), Sasol (ZAR).
- 1.21: TSMC, UMC, ASE (TWD), Chunghwa Telecom (TWD), KB, Shinhan, Woori, KEPCO, KT (KRW). ADR-verhoudingen gecontroleerd met koers ADS / lokale koers (`hulp/adr_verhouding.py`): TSM 5, UMC 5, ASX 2, CHT 10, WF 3, KEP 0,5, KT 0,5; KB en SHG 1.
- Oorzaak dat TSMC c.s. eerst 0 jaren gaven: deze bedrijven zetten in het 20-F het laatste jaar ook in dollars (gemaksomrekening). `history_engine.annual_history` kiest dan de verslagvaluta; `eps_verification.sec_eps_recompute_inputs` maakt per valuta een invoer en de herberekening kiest de valuta van de gemelde EPS. Proef: TSM, UMC, CHT, KB, WF, SHG, KEP 10 van 10 nagerekend; KT 8; ASX 9.
- Kwartaalwinst (Yahoo trailingEps) van een ADR: per gewoon aandeel in eigen munt of al per ADS in dollars; de lezing die het dichtst bij de laatste jaarwinst ligt (binnen factor 2) telt.
- De 20-F's over 2025 (april 2026 ingediend) van TSMC, Shinhan, KEPCO e.a. staan in companyfacts alleen met dei/srt-feiten. Opgelost in 1.22 (`sec_instance.py`): als het nieuwste jaarverslag in companyfacts geen ifrs-full/us-gaap-feiten heeft, leest de bouw `<naam>_htm.xml` uit de map van de indiening (EDGAR-archief), alleen feiten zonder dimensies, en voegt die toe in companyfacts-vorm (kopie; het archief ziet het origineel). Daarna gelden alle controles. TSMC: 2025 EPS 65,47 TWD, nagerekend.

## Nacht van 12 op 13 november 2026 (1.22)
- Splitsingsbewijs (`verify_split_events`) vergelijkt nu per valuta. HDFC Bank en Wipro zetten de EPS ook in dollars (gemaksomrekening); samen met INR gaf dat een verhoudingsinterval dat zowel 'splitsing' als 'geen verschil' toeliet. Wipro: 10 van 10.
- HDFC Bank: splitsing 2019 nu bevestigd, 6 van 10 nagerekend; 2024 en 2025 wijken af (fusie met HDFC Ltd. in 2023). Bovendien bonus 1:1 in augustus 2025, nog niet in een jaarverslag verwerkt: koers na de bonus, winst ervoor. Daarom niet in de app. **Algemeen risico**: een splitsing na het laatste jaarverslag wordt nergens op de jaarwinst toegepast; de kwartaalwinst (Yahoo) vangt het voor de K/W deels op, de NAIC-grafiek niet.
- Itaú, Bradesco, FEMSA: EPS alleen per aandelenklasse (met dimensie) — geen eenduidige winst per aandeel; bewust niet. SK Telecom: splitsing 5:1 én afsplitsing SK Square in 2021, bewijs tegenstrijdig. Gerdau, CSN, Ecopetrol: EPS of aantal aandelen ontbreekt of is dubbelzinnig. POSCO 4, América Movil 4, Coca-Cola FEMSA 4, LG Display 2 nagerekende jaren: te kort.
- Cemex (CX): 1 ADS = 10 CPO's (koers CX / CEMEXCPO.MX = 9,94), 1 CPO = 2 A + 1 B; EPS in het 20-F per gewoon aandeel → `ADR_AANDELEN['CX'] = 30`. 9 van 9 (USD sinds 2017).
- Eén jaar missend (Suncor 2016, Kinross 2021, ICL 2021, Teva 2019, Rogers 2020 en 2024, Enbridge 2025, Gold Fields 2017, Smith & Nephew 2019): herberekend wijkt 0,5–15% af van gemeld; geen tweede teller in de indiening die het verklaart. Enbridge 2025: de teller na preferent dividend ontbreekt in het 10-K over 2025. Niet versoepeld.
- Sector: 82 fondsen zonder Wikidata-sector krijgen de sector van Yahoo (11 sectoren, vertaald), met `sector_bron`.
- Nog open: ICICI (niet in de SEC-tickerlijst). Chinese fondsen bewust niet.
- Diagnose-hulpmiddel: workflow *SEC-feiten bekijken* (`hulp/sec_feiten.py` en `hulp/sec_diagnose.py`): feiten per begrip en eenheid, laatste jaarverslagen, en per stap waar de SEC-route jaren afwijst.

## 13 november 2026 (1.23)
- Splitsing na het laatste jaarverslag (`bouw_webdata.split_na_verslag`): de indieningsdatum van de EPS gaat per jaar mee (`ingediend`, uit het EPS-feit). Splitsingen van Yahoo met een datum na het nieuwste `ingediend` worden op `comparable_eps` van alle jaren toegepast, vóór de K/W-historie; terug te draaien (`split_na_verslag_terug`, als eerste stap bij hergebruik). Bij ADR's (`ADR_LOKAAL`) alleen als de lokale notering binnen 15 dagen dezelfde verhouding splitste; anders gewijzigde ADS-verhouding (waarschuwing, niet verrekend). Dividend per aandeel komt al gecorrigeerd van Yahoo. EXTRA_VERSIE 7.
- `sec_instance.nieuwer_in_register`: is het laatste jaarverslag in companyfacts ouder dan 13 maanden, dan wordt het indieningsregister (submissions) geraadpleegd voor een nieuwer verslag met XBRL. Chunghwa: 20-F over 2025 stond helemaal niet in companyfacts → nu 2016–2025, 10 van 10. Aanvullen alleen bij de echte SEC-fetchers (`sec_echt`).
- HDFC Bank: met het 20-F over FY2026 (via de aanvulling) 3 van 10; aantal aandelen springt door de fusie met HDFC Ltd. (juli 2023), en de oude jaren hebben de bonus van 2025 niet verwerkt (2017 nog 54,57). Niet in de app.
- ICICI Bank (CIK 1103838): companyfacts 404, geen XBRL-cijfers bij de SEC.

## 14 november 2026 (1.24): overzicht en tranche oudere verslagen
- Stand 13 nov: 309 van 432 fondsen niet Bevestigd. Oorzaken: ESEF zonder bewijs over splitsingen (vaak: aantal aandelen niet getagd) ~139; ESEF nagerekend maar korter dan 10 jaar (ESEF pas vanaf boekjaar 2020/2021) ~89; alleen Yahoo 32; SEC gedeeltelijk of < 10 jaar ~38. De grootste hefboom blijft: jaarverslagen van vóór ESEF (2016–2020) per land.
- ESEF-bundel ververst voor 50 fondsen die op 2024 bleven staan: filings.xbrl.org heeft hun verslag over 2025 (nog) niet. Geen verandering; andere bron (nationale registers, ESEF-zip) zou nodig zijn.
- Frankrijk: `fr_jaarverslagen.py` 2016–2020 opnieuw; verslagen ingediend in 2019 geven 404 bij de DILA (boekjaar 2018 ontbreekt), maar het verslag over 2019 bevat 2018 als vergelijkend cijfer. Nieuw: verslagen over 2020 (brug naar ESEF).
- `hulp/tekst_uitlezen.py`: driver voor fr/ en uk/ (zoals afm_uitlezen). `pdf_uitlezen`: tweede poging met 'EPS' als label en cents-suffix ('10.30c'); jaartallen zijn geen aantal aandelen. Regressie fr/uk/afm: niets verloren of veranderd.
- Register: Franse 2020-verslagen, IMI 2015–2019, Airtel Africa, Convatec, AFM opnieuw (o.a. IMCD 2015–2019). `eu_narekenen` aangevuld (alleen toevoegingen). Uitgesloten: BP (ADS-equivalent, NI in duizenden), Pharming (status zou dalen), Air Liquide 2020-verslag (keten korter).
- Effect (lokaal gemeten): Bevestigd +3 (IMI, BP, IMCD); LVMH 5 → 8, Thales 6 → 7, EssilorLuxottica/Eurofins/Publicis 5 → 6.
- Air Liquide: bonusaandelen 1 per 10 met loyaliteitspremie → werkelijke factor 1,1026 i.p.v. 1,1; de afgeleide splitsing (2017) wordt afgewezen, en voor 2022 en 2024 ontbreekt een overlappend aantal aandelen. Oplossing vergt aantallen aandelen voor de vergelijkende jaren uit de ESEF-tekst.
