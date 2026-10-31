# Oordeel per termijn (stand 31 okt 2026, versie 1.7.1)

Vervangt het oordeelgedeelte van `vijf-vragen-model.md` (25 okt). De app geeft één advies (NAIC) en daarnaast informatie per termijn.

## Lange termijn (3–5 jaar): NAIC-oordeel — het enige advies
- Kopen / Neutraal / Vermijden volgens de Stock Selection Guide (`web/js/naic.js`, `Naic.ssg`): groeibedrijf (EPS-trend ≥ 5%, gerekend met hoogstens 15% of de eigen groeiverwachting), goed bedrijf (omzet draagt de winstgroei; marge vóór belasting en ROE niet dalend), K/W-geschiedenis (gemiddelde hoge/lage K/W 5 jaar), verwachte hoge en lage koers, zones in derden met 3 : 1, totaalrendement ≥ 15% per jaar.
- Tabblad NAIC: de 6 stappen; managementfeiten (Yahoo: CEO, bezit insiders, insidertransacties, aantal aandelen, governance) bij stap 2.
- **Koopmoment** bij NAIC Kopen (sinds 1.6): het trendsignaal zegt gunstig / neutraal / afwachten. Teruggerekend 2018–2025: Kopen + gunstig −1,5% na 1 jaar t.o.v. gemiddeld, + neutraal −8,4%, + afwachten −15,2% (kleine aantallen).
- **Gezondheidscheck** (sinds 1.2.2): de zes metingen (kasstroom, schuld, groei, K/W, trend, rust) als Gezond / Gemengd / Zwak; geen koopadvies. Ongunstige metingen staan als aandachtspunt bij het NAIC-oordeel. Terugrekenen liet zien dat ze als koopadvies niet werkten.

## Middellange termijn (3–12 maanden): `web/js/termijn.js`, `Termijn.middellang`
Vier onderdelen van +1 / 0 / −1; positief vanaf +2, negatief vanaf −2, minstens 3 bekend:
1. Trend: het trendsignaal (`web/js/kortetermijn.js`; vijf checks: koers > 200d, 50d > 200d, koers > 6 mnd geleden, MACD > signaal, RSI < 70). Gunstig +1, neutraal 0, afwachten −1. Teruggerekend: gunstig − afwachten +5,7 pp na 12 mnd (t 3,1).
2. Relatieve sterkte 12 mnd t.o.v. de eigen index (`bouw_webdata.relatieve_sterkte`): > +5% → +1, < −5% → −1. Teruggerekend: sterkste − zwakste vijfde +8,7 pp na 12 mnd (t 2,4).
3. Bijstelling winstverwachting analisten, 90 dagen, dit en volgend boekjaar (`verwachting.py`, Yahoo eps_trend/eps_revisions): > +2% → +1, < −2% → −1. Niet terug te rekenen (Yahoo bewaart geen geschiedenis); steunt op onderzoek.
4. Kwartaalcijfers t.o.v. verwachting (laatste ≤ 4; Yahoo get_earnings_dates): gemiddeld ≥ +3% en laatste positief → +1; gemiddeld ≤ −3% of laatste ≤ −5% → −1. Teruggerekend: +1 − −1 +1,4 pp na 6 mnd (t 2,4).
Verouderde verwachtingen (> 10 dagen) tellen niet.

## Korte termijn (dagen tot weken): alleen feiten, geen signaal
`Termijn.kort`: datum volgende kwartaalcijfers; verwachte bandbreedte voor een maand (koers × (1 ± beweeglijkheid/√12)); RSI; afstand tot de top van 1 jaar. Reden: in het terugrekenen voorspelde geen enkele maatstaf het rendement over 1 maand.

## Risico (informatie)
`bouw_webdata.risico`: onder de top van 1 jaar, grootste daling in 5 jaar (met periode), beweeglijkheid per jaar, beta t.o.v. de index (2 jaar). Teruggerekend: afstand tot de top en grootste daling zeggen niets; beweeglijke aandelen deden het beter (waarschijnlijk periode- en overlevers-effect).

## Waar in de app
- Start: tegels Portefeuille, Volglijst, Signalen, Kansen (met aantal gunstig koopmoment), Marktbeeld, Zekerheid.
- Aandeel › Oordeel: NAIC-oordeel met aandachtspunten en koopmoment; regels middellange en korte termijn, zekerheid, gezondheidscheck; analisten; bedrijf.
- Aandeel › Koers: grafiek (6 mnd / 2 jaar, 200d, NAIC-koopzone, aankoopkoers) en drie lagen: middellang, kort, risico.
- Fondsrapport (PDF): alles hierboven, incl. managementfeiten en de termijnen.

## Terugrekenen
Zie `terugrekenen-2026-10.md` en de uitkomsten in `documentatie/terugrekenen/`. Hulpmiddelen: `hulp/terugrekenen.py/.js` (NAIC), `hulp/terugrekenen_ta.py/.js` (trend, relatieve sterkte, risico), `hulp/terugrekenen_cijfers.py` (kwartaalcijfers); workflows met dezelfde naam (handmatig).
