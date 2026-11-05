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
- Open: Nederlandse labels in de pdf-lezer ('verwaterd', 'per aandeel', 'toe te rekenen aan aandeelhouders'); Kendrion 2019 en 2022.
