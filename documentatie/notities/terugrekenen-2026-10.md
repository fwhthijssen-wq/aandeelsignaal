# Terugrekenen (25, 28, 30 en 31 okt 2026)

Werkwijze: `hulp/terugrekenen.py` + `.js`, workflow “Terugrekenen (ontwikkeling)”; resultaat op tak `jaarverslagen` in `debug/terugrekenen*.json/.md`.
- Peildata: 30 april 2018 t/m 2025 (8). Per peildatum alleen jaarcijfers met boekjaareinde ≥ 75 dagen eerder; koers van die dag (Yahoo, splitsingsgecorrigeerd). Sinds 28 okt geen TTM-kwartaalwinst (zou vooruitkijken zijn).
- Rendement incl. dividend over 1 en 3 jaar, in eigen valuta; overrendement = minus het gewone gemiddelde van alle fondsen op die peildatum.
- 2642 fonds-peildata.

## Ronde 3 (28 okt, regels van 1.2: aangeleverde cijfers, tweede bron, uitschieters uit de trend, meer pdf/ESEF-jaren)
| Oordeel | 1 jaar gem / med / % beter / t / n | 3 jaar gem / med / t / n |
|---|---|---|
| NAIC Kopen | −6,3% / −12,8% / 35% / −1,75 / 113 | +1,7% / −9,2% / 0,17 / 71 |
| NAIC Neutraal | +1,2% / −3,3% / 45% / 0,9 / 562 | +3,0% / −13,8% / 0,55 / 306 |
| NAIC Vermijden | −0,9% / −3,0% / 45% / −0,6 / 536 | 0,0% / −20,1% / 0,0 / 328 |
| App Kopen (zes metingen) | −1,0% / −3,7% / 44% / −1,05 / 780 | −8,7% / −17,9% / −2,9 / 556 |
| App Vermijden | +9,1% / +0,8% / 51% / 3,5 / 274 | +32,1% / −1,3% / 2,9 / 232 |

Ook: NAIC-zone “verkoop” +6,1% (1 j) en +30,3% (3 j), n 53; deel 5 “ok” +0,4% / +6,7%; kwaliteit “goed” −4,2% (t −2,95) en “zwak” +2,3%. Per meting: ongunstige schuldgraad (+5,3%, t 4,4), ongunstige rust/beweeglijk (+14,2%, t 5,6) en ongunstige kasstroom (+7,8%, t 3,6) deden het béter; gunstige K/W (+3,7%, t 3,0) is de enige meting die in de verwachte richting werkt.
Per peildatum (NAIC Kopen − Vermijden, 1 j): alleen 2020 positief (+6,5 pp); 2024 −19 pp.

Lezing: met meer fondsen en jaren verdwijnt het positieve beeld van ronde 2. NAIC Kopen presteerde niet beter dan gemiddeld; geen verschil is significant. De zes metingen werken omgekeerd (vooral “rust” en “schuldgraad”): in 2018–2025 wonnen beweeglijke, groeiende, duurdere aandelen. De app toont nu deze cijfers met een eerlijke uitleg (1.2.1); sinds 1.2.2 zijn de zes metingen een gezondheidscheck, geen koopadvies.

## Kortetermijnsignaal (30 okt 2026)
Werkwijze: `hulp/terugrekenen_ta.py` + `.js`, workflow “Terugrekenen kortetermijnsignaal (ontwikkeling)”; resultaat op tak `jaarverslagen` in `debug/terugrekenen_ta*.json/.md`. De koersen (en sinds 31 okt de indexkoersen) staan in `debug/terugrekenen_ta_koersen.json.gz`, zodat varianten lokaal te toetsen zijn (± 1 minuut).
- Elke maand (laatste handelsdag, 2016-10 t/m 2026-10, 121 peildata), per fonds de laatste 2 jaar dagkoersen (zoals de nachtelijke update), signaal met `web/js/kortetermijn.js`. 39.011 waarnemingen, 346 fondsen.
- Overrendement over 1, 3, 6, 12 maanden t.o.v. het gewone gemiddelde in dezelfde maand. Eerlijke toets: per maand Gunstig − Afwachten, Newey-West-t (overlappende perioden).

| Horizon | Gunstig − Afwachten | t | maanden positief |
|---|---|---|---|
| 1 maand | +0,3 pp | 1,0 | 56% |
| 3 maanden | +1,9 pp | 2,6 | 68% |
| 6 maanden | +3,3 pp | 2,3 | 67% |
| 12 maanden | +5,7 pp | 3,1 | 70% |

Ten opzichte van het gemiddelde: Gunstig +0,35% (3 m) en +1,7% (12 m), mediaan licht negatief; Afwachten −0,7% en −2,6%. De winst zit vooral in het vermijden van Afwachten.
Per check (ja − nee, 12 m): trend200 +4,7 pp (t 2,8), kruis +4,4 (2,7), mom6 +4,2 (2,8): samen in feite één trendsignaal. MACD +0,4 (0,5) voegt niets toe. RSI “niet overkocht” −6,8 pp (t −4,1): overkochte aandelen liepen juist door (momentum).
Regio: EU +5,7 pp (t 2,8); VS −6,2 pp (t −1,2, maar alleen 48 maanden met genoeg VS-fondsen in beide groepen).
Variant met alleen de drie trendchecks: niet beter dan de app-versie (12 m +5,1 pp, t 2,8). Het signaal blijft zoals het is.

Koppeling met het NAIC-terugrekenen (april-peildata 2018–2025, 1 jaar):
| NAIC + signaal | 1 jaar gem | n |
|---|---|---|
| Kopen + Gunstig | −1,5% (med −3,0%) | 46 |
| Kopen + Neutraal | −8,4% | 56 |
| Kopen + Afwachten | −15,2% | 11 |
| Vermijden + Afwachten | −9,9% (t −2,5) | 33 |

Lezing: het signaal scheidt redelijk betrouwbaar (vooral in Europa, op 3–12 maanden), vooral door koersen in een dalende trend te mijden. Bij NAIC Kopen lijkt het “vallende messen” eruit te halen, maar de aantallen zijn klein. In de app als koopmoment bij NAIC Kopen (1.6).

## Relatieve sterkte en risico (31 okt 2026)
Zelfde opzet (maandelijks 2016–2026, alle fondsen), per maand vijf even grote groepen (kwintielen); groep 5 (hoogste waarde) min groep 1, Newey-West-t.

| Maatstaf | 3 mnd | 6 mnd | 12 mnd |
|---|---|---|---|
| Relatieve sterkte 3 mnd | +1,2 pp (t 1,9) | +2,8 (2,4) | +6,7 (3,1) |
| Relatieve sterkte 6 mnd | +1,8 (2,3) | +4,2 (2,6) | +8,1 (2,6) |
| Relatieve sterkte 12 mnd | +2,1 (2,0) | +5,0 (2,3) | +8,7 (2,4); 72% van de maanden |
| Beweeglijkheid | +2,6 (2,6) | +5,7 (2,9) | +12,5 (3,0) |
| Beta | +1,8 (1,6) | +3,6 (1,7) | +8,1 (1,7) |
| Afstand tot top 1 jaar | +0,2 (0,2) | +0,7 (0,4) | +0,9 (0,3) |
| Grootste daling 5 jaar | −0,9 (−0,8) | −2,1 (−0,9) | −6,8 (−1,3) |

Gunstig moment én sterker dan de index (12 mnd) tegen de rest: +4,5 pp na 12 maanden (t 2,3).
Lezing: relatieve sterkte (momentum) werkt, vooral het sterkste vijfde deel (+4 tot +7% t.o.v. gemiddeld). Beweeglijke aandelen deden het beter, tegen de bekende “lage-volatiliteitsanomalie” in: waarschijnlijk een periode-effect (groeiaandelen wonnen) en een overlevers-effect (beweeglijke fondsen die onderuit gingen, ontbreken). Afstand tot de top en grootste daling zeggen niets over het rendement daarna. In de app (1.6.1): onderbouwing bij Relatieve sterkte en bij Risico; risico blijft informatie.
Belangrijk: bij 1 maand is geen enkele maatstaf significant. De technische signalen werken op 3–12 maanden (middellange termijn), niet op de korte termijn.

## Kwartaalcijfers t.o.v. de verwachting (31 okt 2026)
Werkwijze: `hulp/terugrekenen_cijfers.py`, workflow “Terugrekenen kwartaalcijfers (ontwikkeling)”; resultaat in `debug/terugrekenen_cijfers*.json/.md`, de opgehaalde cijfers in `debug/terugrekenen_cijfers_bron.json`. Yahoo `get_earnings_dates` geeft tot ± 28 kwartalen; met de bewaarde koersen effectief 2014–2026. 251 fondsen, 8.652 bekendmakingen.
- Toets 1 (per bekendmaking, t.o.v. de eigen index, vanaf de eerste handelsdag ná de bekendmaking): per kwartaal verrassing > +5% min < 0: 1 mnd +0,2 pp (t 0,9), 3 mnd +0,5 (1,1), 6 mnd +1,3 (t 2,2; 69% van de kwartalen positief). Alle groepen liggen boven de index (overlevers en dividend in de fondskoers): alleen het verschil telt.
- Toets 2 (de regel van de app, maandelijks, 25.683 waarnemingen; +1 min −1, Newey-West): 1 mnd +0,2 pp (t 1,9), 3 mnd +0,8 (2,8), 6 mnd +1,4 (2,4), 12 mnd +2,1 (1,8).
Lezing: klein maar meetbaar effect, zwakker dan trend (+5,7 pp na 12 mnd) en relatieve sterkte (+8,7). Het onderdeel blijft in het oordeel middellange termijn; uitleg in de app bijgewerkt (1.7.1). Bijstellingen van analisten blijven ongetoetst (geen geschiedenis bij Yahoo).

## Ronde 2 (25 okt, beta.76-regels: strikt NAIC incl. deel 5, Duitse jaarverslag-EPS)
| Oordeel | 1 jaar gem / med / % beter / t / n | 3 jaar gem / med / t / n |
|---|---|---|
| NAIC Kopen | +4,5% / −2,4% / 47% / 0,9 / 75 | +21,9% / −7,7% / 1,3 / 52 |
| NAIC Neutraal | +1,6% / −4,0% / 44% / 0,8 / 284 | +0,8% / −9,2% / 0,1 / 135 |
| NAIC Vermijden | −2,4% / −4,2% / 44% / −1,1 / 241 | −8,5% / −26,3% / −1,0 / 118 |
| App Kopen (zes metingen) | −0,6% / −2,9% / 46% / −0,5 / 528 | −6,9% / −18,1% / −1,6 / 319 |

## Ronde 1 (beta.69-regels)
K/W gunstig vs rest +13,1 pp (t 2,5); rustig vs beweeglijk −14,9 pp (t −2,5); de rest niet significant.

## Beperkingen
Eén periode (2016/2018–2026, sterk groei-gedreven), alleen fondsen van nu (overlevers), jaarcijfers zoals nu bekend, valuta's door elkaar, geen kosten. Niet als bewijs lezen, in geen van beide richtingen.

## Besluit
25 okt: Frans koos voor exact de NAIC-regels (hoofdoordeel), zes metingen aanvullend. 28 okt: cijfers en uitleg in de app bijgewerkt; zes metingen worden gezondheidscheck (1.2.2). 30–31 okt: kortetermijnsignaal, relatieve sterkte en risico teruggerekend; koopmoment bij NAIC Kopen (1.6), risico en terugval (1.6.1). Voorstel ligt open: indeling naar horizon (lang: NAIC; middellang: trend, relatieve sterkte, schattingen van analisten; kort: alleen gebeurtenissen en verwachte bandbreedte).
