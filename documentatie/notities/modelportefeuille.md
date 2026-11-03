# Modelportefeuille (versie 1.9.1, 3 nov 2026)

Een fictieve portefeuille die de signalen automatisch volgt, om de betrouwbaarheid over langere tijd te zien (een eerlijke test vooruit, naast het terugrekenen). Voorstel en keuzes met Frans op 3 nov: zoals voorgesteld, in een eigen kleur (paars, label *fictief*).

## Regels (`web/js/model.js`, één bron voor nacht, terugrekenen en tests)
- **Kopen:** NAIC Kopen (variant *moment*: ook een gunstig koopmoment). Voor ongeveer € 1.000, minstens 1 aandeel. Geen bijkoop als het fonds al in de portefeuille zit.
- **Verkopen:** bij de NAIC-verkoopzone of erboven. Daarna opnieuw te kopen bij een nieuwe kans.
- **Variant kwaliteit (1.9.1, op verzoek van Frans):** ook verkopen als de kwaliteit wegvalt (`kwaliteitVan` in modelportefeuille.js): een NAIC-kwaliteitstoets valt af (omzet draagt de winstgroei niet, marge vóór belasting of ROE daalt), geen groeibedrijf meer (Vermijden zonder zones), of een verliesjaar. Reden *Kwaliteit* bij de verkoop.
- **Uitvoering:** het signaal ontstaat op een slotkoers; uitgevoerd tegen de slotkoers van de volgende handelsdag. € 3 kosten per transactie.
- **Euro:** USD en GBP met de ECB-referentiekoers (euro per eenheid). Dividend bruto op de ex-datum, als geld. Splitsingen passen het aantal aan. Fonds uit de lijst: verkocht tegen de laatste koers.
- **Index:** per aankoop hetzelfde bedrag in de eigen index (index_voor), met dezelfde kosten, verkocht op hetzelfde moment. Indexen zonder dividend, behalve de DAX; daarom toont de app ook het rendement zonder dividend.
- Bij elke aankoop vastgelegd: zone, koopmoment en zekerheid van de cijfers.

## Techniek
- Nachtelijke update: `node modelportefeuille.js web/data/aandelen.json mt/staat.json web/data --terug mt/terug.json [--stap]`. Alleen bij de geplande run én goede gegevens (bouw en bewaker geslaagd) wordt de dag verwerkt (`--stap`); bij publicaties overdag alleen getoond (geen koersen van een lopende handelsdag). Staat op de tak `model` (`staat.json`), alleen aangevuld. App leest `web/data/model.js` (`window.MODEL_DATA`).
- Gegevens: `koers.dividenden` en `koers.splitsingen` (laatste 400 dagen) per fonds en `indexen` (laatste twee standen) in aandelen.json (`bouw_webdata.recent_acties`, `index_standen`).
- Twee keer dezelfde dag verwerken verandert niets (orders alleen op een nieuwere koersdatum, dividend per datum één keer, stand per dag vervangen).
- Terugrekenen: workflow *Modelportefeuille terugrekenen* (handmatig): `hulp/model_terug.py` (koersen sinds 2016 teruggezet naar werkelijke bedragen, ECB, indexen, wekelijks een fonds zoals toen: jaarcijfers ≥ 75 dagen oud) → `hulp/model_signalen.js` → `hulp/model_terug.js` → tak `model` (`terug.json`, `terug.md`).

## Eerste uitkomst terugrekenen (27 apr 2018 – 2 nov 2026, wekelijkse signalen)
| | posities | rendement | index | zonder dividend |
|---|---|---|---|---|
| Alle kansen | 119 (82 open, 37 verkocht) | +66,2% | +57,4% | +50,3% |
| Gunstig koopmoment | 86 (59 open, 27 verkocht) | +55,0% | +50,3% | +40,2% |

- Het voordeel op de index komt vrijwel helemaal uit dividend (de meeste indexen zijn zonder dividend). Zonder dividend bleven de signalen achter bij de index.
- Verkocht: 36 van 37 met winst (gemiddeld 35 maanden), logisch omdat alleen in de verkoopzone wordt verkocht; de verliezers blijven open (26 van 82 open met verlies).
- Het koopmoment hielp in deze periode niet.
- Per zekerheid wisselend (Bevestigd +63% tegen index +61%; indicatief +87% tegen +67%; uit jaarverslag +26% tegen +26%); kleine aantallen.
- Beperkingen: fondsen van nu (overlevers), jaarcijfers zoals nu bekend, wekelijks i.p.v. dagelijks.
- Proef nachtelijke stap 3 nov: 343 fondsen, 15 kooporders (moment: 5); ECB-koersen opgehaald. Echte start: eerste geplande nachtelijke run na 1.9.

## Drie regels naast elkaar (terugrekenen 3 nov, 2018-04-27 t/m 2026-11-03)
| | posities | rendement | index | verschil | zonder dividend | per ingezette euro per jaar (index) |
|---|---|---|---|---|---|---|
| Alle kansen | 119 (82 open) | +66,6% | +56,6% | +10,0 | +50,8% | 20,6% (17,5%) |
| Ook verkopen bij zwakkere kwaliteit | 133 (33 open) | +28,9% | +25,4% | +3,5 | +23,4% | 18,5% (16,2%) |
| Gunstig koopmoment | 86 (59 open) | +55,4% | +49,6% | +5,8 | +40,6% | 16,6% (14,9%) |

- Verkopen bij zwakkere kwaliteit werkte slechter: 86 verkopen om kwaliteit (gemiddeld na 18 maanden, 33 met verlies). Bij 59 van de 77 vergelijkbare aankopen had vasthouden (de hoofdregel) meer opgeleverd, gemiddeld 57 procentpunt. De kwaliteitstoetsen slaan vaak tijdelijk aan; veel van die bedrijven herstelden.
- De rendementen over het ingelegde geld zijn niet direct te vergelijken (andere looptijden); daarom ook het resultaat per ingezette euro per jaar.
- Conclusie: de hoofdregel (alleen verkopen in de verkoopzone) blijft de beste van de drie.
