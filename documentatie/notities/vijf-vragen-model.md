# Oordeelmodel (beta.71–77, 25 okt 2026) — historisch

> Het oordeelgedeelte is achterhaald: zie `oordeel-en-termijnen.md` (stand 1.7.1). Sinds 1.2.2 zijn de zes metingen een gezondheidscheck (Gezond / Gemengd / Zwak), geen "App"-oordeel; sinds 1.5 bestaat de keuze App/NAIC/Beide niet meer. De bronnen- en controlesecties hieronder gelden nog.

## Besluit 25 okt 2026 (beta.71)
Frans vroeg om **exact de NAIC-regels te volgen**. Het hoofdoordeel is het NAIC-oordeel (Naic.ssg).
- NAIC deel 5: totaalrendement = koersstijging per jaar tot de verwachte hoge koers + gemiddeld dividendrendement (5 jaar, onbekend = 0%) ≥ 15% (TOTAAL_MIN). Anders hoogstens Neutraal.
- Zones in derden (standaard SSG). 3 : 1 opwaarts/neerwaarts (NAIC-aanbeveling).

## NAIC-regels zoals toegepast (Naic.ssg)
- Groeibedrijf: trendgroei EPS (log-lineair, hoogstens 10 jaar) ≥ 5%; in de berekening begrensd op 15%. Minder dan 5% → Vermijden.
- Eigen groeiverwachting (beta.76): per aandeel in te vullen (winkel.verdieping cijfers.naicgroei, −50..50, in de back-up). Dan rekent ssg daarmee (ook voor de 5%-toets, zonder 15%-grens; waarschuwing boven 15%).
- Deel 1: omzet groeit en EPS groeit niet meer dan 10 procentpunt sneller dan omzet.
- Deel 2: marge vóór belasting (helling ≥ −0,5 pp/jaar) en ROE (≥ −1 pp/jaar; niet getoetst bij |ROE| > 60) over 5 jaar niet dalend. Banken: omzet en marge niet getoetst.
- Deel 3: gemiddelde hoge/lage K/W laatste 5 jaar (min. 3), jaren met hoge K/W > 60 weggelaten. Relatieve waarde (ter informatie): K/W nu ÷ gemiddelde K/W × 100; NAIC liefst 85–110%.
- Deel 4: hoog over 5 jaar = EPS × (1+g)^5 × hoge K/W; laag = laagste EPS van 5 jaar × lage K/W; drie gelijke zones; ≥ 3 : 1.
- Deel 5: totaalrendement ≥ 15% per jaar. PAR (ter informatie): rendement als de K/W over 5 jaar op het gemiddelde staat, plus dividend.
- Kopen = koopzone (of eronder) + 3 : 1 + deel 5 + geen kwaliteitstoets afgevallen. Verkoopzone/erboven = Vermijden. Anders Neutraal.

## Signalen (beta.74, web/js/signalen.js)
- Per eigen aandeel (portefeuille, volglijst): koopzone (NAIC Kopen), verkoopzone/erboven, kwaliteit daalt (toets deel 1–2 af), te weinig groei. Sinds 1.5 op het scherm Signalen (tegel op Start); sinds 1.6 met het koopmoment.
- "Nieuw sinds de vorige update": NAIC-oordelen per gegevensdatum in localStorage `as_naic_vorig` ({basis, laatst}).

## Winst per aandeel: bronnen en controles
- SEC: onafhankelijk nagerekend. Beta.77: een recente splitsing/samenvoeging wordt ook bevestigd met kwartaal-EPS (10-Q, `eps_quarter_observations`). Samenvoeging (SEC-verhouding < 1) alleen na zo'n bevestiging (Honeywell 1:2, juni 2026 → 10 jaar bevestigd).
- ESEF (esef_bron.eps_keten): ijkpunt aantal aandelen; tagfix; keten nieuw→oud; beta.77: bij gelijke winst in beide rapporten maar andere EPS een zuivere factor (k, 1/k, bonus 1+1/n) toegepast (AB InBev ×0,01; Air Liquide 1 op 10); willekeurige factor = stop.
- Duitse pdf-jaarverslagen: zie duitse-jaarverslagen.md.

## Investeringen (capex), beta.66
Eigen ESEF-begrip (esef_investeringen.json) en bredere standaardbegrippen; nooit een bestaand cijfer vervangen.

## Open punten (25 okt)
- Banken in Italië/Spanje (CaixaBank, UniCredit, Banco BPM, MPS, Mediobanca, Fineco, Mediolanum, Unipol…) taggen geen winst per aandeel in ESEF: alleen via pdf of Yahoo.
- Visa: SEC-feiten bevatten geen EPS of aantal aandelen zonder klasse-dimensie.
- Onvolledige ESEF-reeksen (bijv. Intesa), Vodafone (schaal 1e8), Repsol/Société Générale (gat zonder aantal aandelen), Prysmian (aandelen +9% door conversie).
