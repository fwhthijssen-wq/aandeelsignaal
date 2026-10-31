# Duitse jaarverslagen (25 okt 2026, beta.72–81; narekenen 28 okt 2026, versie 1.1–1.1.5)

## Bevinding
- filings.xbrl.org bevat **0** Duitse ESEF-filings. Zonder pdf hadden 37 van de 40 DAX-fondsen alleen Yahoo-cijfers ("indicatief", 4 jaar). SAP en Deutsche Bank (SEC) en Qiagen (ESEF) hebben officiële cijfers.
- Bedrijven publiceren pdf-jaarverslagen; veel via EQS met vast patroon `https://irpages2.eqs.com/Download/Companies/{slug}/Annual Reports/{ISIN}-JA-{jaar}-EQ-{E|D}-{00|01}.pdf` (ook `download/companies` in kleine letters en more-ir.de). Slugs zijn niet altijd de bedrijfsnaam: Mercedes = `daimlerchrysler`, Munich Re = `muenchener-rueck`, adidas = `adidas-salomon`, Hannover Rück = `hannoverrueck`, Daimler Truck = `58610a`. Rheinmetall gebruikt in de bestandsnaam het oude ISIN DE0007030009. Eigen patronen: BMW `bmwgroup.com/en/report/{jaar}/downloads/BMW-Group-Report-{jaar}-en.pdf`, DHL `group.dhl.com/.../annual-reports/DHL-Group-{jaar}-Annual-Report.pdf` (alleen recente jaren).
- Bij een gebroken boekjaar (Siemens) is het EQS-jaar = boekjaar − 1; het boekjaar komt daarom uit de jaartallenkop van de tabel.
- Downloaden in GitHub Actions (`de-jaarverslagen.yml`, pdftotext), resultaat op tak `jaarverslagen` onder `de/`. De sandbox kan bedrijfssites niet bereiken. Workflows die op die tak schrijven doen eerst `pull --rebase` (anders botsen parallelle runs).

## Winst per aandeel (`hulp/de_eps.py`)
1. Verwaterde winst per aandeel (EN/DE), anders gewone. "Uit voortgezette en beëindigde activiteiten" telt als totaal; core/adjusted/pre/voortgezette niet.
2. Soort aandeel: gewoon aandeel (preferent uitgesloten); bij Henkel/Porsche het preferente; Volkswagen zoals voorheen (keten kiest).
3. Een regel met getallen vóór het label (tekst uit een andere kolom) telt niet; tabelregels (label vooraan) gaan voor op lopende tekst.
4. Onleesbaar decimaalteken in de pdf-tekst ('42�78') wordt een punt.
5. Keten nieuw→oud: aansluiten op het vergelijkende cijfer in het volgende verslag (≤ 6% herziening), anders stop; één ontbrekend verslag wordt overbrugd (hoogstens één keer).
6. ≥ 4 jaar → `jaarverslag_eps.json`. In `vul_eps_jaarverslag`: waarden > 20× de mediaan vallen weg; wijkt een jaar > 15% af van Yahoo, dan wordt de hele reeks niet gebruikt (`eps_jaarverslag_afgewezen`).

Stand 28 okt: 31 fondsen in het register; o.a. Munich Re 15, Heidelberg 15, Hannover Rück 13, Rheinmetall 13, RWE 13, BASF/Beiersdorf/Brenntag/BMW/Deutsche Börse/Zalando 12, Allianz/Infineon/Merck/Siemens/VW 11, Bayer/FMC/Symrise 10. Niet gelukt: DHL (3 verslagen, geen eenduidige regel), Fresenius, Henkel, Commerzbank; geen adres gevonden: Vonovia, Siemens Energy, Siemens Healthineers, Porsche SE, GEA.

## Omzet, winst vóór belasting, nettowinst, eigen vermogen (`hulp/de_cijfers.py`)
- Zelfde teksten en keten (relatief gelijk binnen 0,6%), eenheid uit de aanduiding boven de tabel. ≥ 4 jaar → `jaarverslag_cijfers.json`; `vul_jaarcijfers_pdf` gebruikt een veld alleen als het in de gedeelde jaren met Yahoo klopt (≥ 2 jaren, elk binnen 5%) en vult alleen jaren aan waar Yahoo niets heeft.

## Narekenen en Bevestigd (`hulp/de_narekenen.py` → `jaarverslag_aandelen.json`; ESEF: `hulp/esef_aandelen.py` → `esef_aandelen.json`; `bouw_webdata.reken_pdf_eps_na`)
- Per boekjaar, uit het verslag van dat jaar én dat van het jaar erna: kandidaten voor het gemiddeld aantal aandelen (tabellen met eenheid, uitgeschreven aantallen in lopende tekst, "number of shares"; meertalig: EN, DE, FR, ES, IT, NL; alle scheidingstekens in een uitgeschreven aantal zijn duizendtallen) en voor de nettowinst toe te rekenen aan de aandeelhouders (rond het aantal aandelen, én tabelregels met een sterk winstlabel in het hele verslag; uitsluitingen alleen op het label, niet op een %-kolom).
- Een jaar is nagerekend als winst per aandeel × aantal aandelen = nettowinst: uit hetzelfde verslag binnen 1%, of uit een andere bron (Yahoo, ESEF-dossier, of aangeleverde EODHD-nettowinst) binnen 1,5%. Pdf-jaren en officiële ESEF-jaren tellen; aangeleverde winst per aandeel niet. Draait ná het aanvullen.
- Laatste 10 jaren allemaal nagerekend, één valuta → **Bevestigd** (`eps_status independently_verified`).
- Uitkomst 28 okt: **Bevestigd: Allianz, BASF, Bayer, BMW, Deutsche Börse, Fresenius Medical Care, Rheinmetall, RWE.** ESEF: 90 fondsen met 1–5 nagerekende jaren (ESEF bestaat pas vanaf 2020, dus daar zelden 10 jaar).

## Dividend (`hulp/de_dividend.py` → `jaarverslag_dividend.json`; `bouw_webdata.vergelijk_dividend`)
- Dividend per aandeel over boekjaar J uit het verslag, vergeleken met wat Yahoo in boekjaar J+1 telt (binnen 3% of 1 cent). Alleen ter controle (`dividend_controle`, kwaliteitskaart); vervangt niets. Lezer maakt soms fouten (o.a. Fresenius 2023, Heidelberg 2018/2026), die als verschil verschijnen.

## Jaarlijks (`jaarverslagen-jaarlijks.yml`)
- 1 en 15 maart t/m juni (en met de hand, invoer `jaren`): nieuwe verslagen ophalen → tak jaarverslagen; `de_eps`, `de_cijfers`, `de_narekenen`, `de_dividend` opnieuw; alleen als alle tests slagen naar main. Proefrun 28 okt geslaagd.

## Nachtelijke update en meldingen
Meldingen per run (check-run annotations): "Gegevens", "Ontbreekt", "Yahoo-EPS", "Pdf-jaarcijfers", "Dividend", "Aangeleverd", "Tweede bron", "Kwaliteit". Inspectie van live gegevens: workflow `inspecteer.yml` (tickers, of SAMENVATTING / VALUTA / NAREKENEN / ESEFJV / KOERS / VERWACHTING / MANAGEMENT) → `debug/inspectie.txt` (VERWACHTING: `debug/verwachting.txt`) op tak `jaarverslagen`.
