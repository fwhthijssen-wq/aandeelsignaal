/* Hulp per pagina: korte uitleg bij wat u op het scherm ziet. Geen rekenlogica; alleen tekst. */
(function (root) {
  'use strict';
  var T = {
    start: ['Start', 'Hier ziet u in één oogopslag hoe het ervoor staat en welke aandelen nu kansrijk zijn.', [
      'De grote kaart bovenaan telt hoeveel aandelen volledig bevestigde gegevens hebben. Dat is iets anders dan een goed of slecht aandeel.',
      'Bij Kansrijk kiest u wiens oordeel telt: de app (zes metingen), NAIC (Stock Selection Guide) of Beide. Naast elk aandeel staan beide oordelen.',
      'Elk aandeel krijgt zes stippen, één per meting: Kasstroom, Schuld, Groei, K/W, Trend en Rust. ✓ is gunstig, = neutraal, ✗ ongunstig; een lege ring betekent dat het gegeven ontbreekt. Samen geven ze het oordeel Kopen, Neutraal of Vermijden.',
      'Alle fondsen, per index en op kansrijkheid gesorteerd, staan onder Fondsen in het menu.',
      'Uw eigen onderzoek (tabblad Verdiepen) staat bij het aandeel, maar telt niet mee in het oordeel.'], 'Ziet u een aandeel zonder oordeel? Dan is er te weinig bekend. De app schat nooit.'],
    overzicht: ['Overzicht', 'De complete lijst van aandelen.', [
      'Tik op een aandeel voor details of kies Aandelen vergelijken om er twee naast elkaar te zetten.',
      'De chip bij elk aandeel toont hoe zeker de gegevens zijn: Bevestigd, Uit jaarverslag of Niet bevestigd.'], null],
    zoek: ['Fondsen', 'Alle aandelen, per index gegroepeerd.', [
      'Per index staan de vijf meest kansrijke bovenaan; met “Alle tonen” ziet u de rest. Kies “Eén lijst” om alle fondsen samen te rangschikken.',
      'Kansrijkheid: eerst Kopen, dan Neutraal, dan Vermijden, dan geen oordeel. Binnen elke groep staat het hoogste gemiddelde bovenaan.',
      'U kunt ook sorteren op plek in het koersbereik, winstgroei, omzetgroei of marge, en zoeken op naam of beurscode.',
      'Een aandeel dat in twee indices zit, staat in beide groepen.', 'Onder de lijst: welke gegevens er zijn voor alle fondsen samen, per meting, en wat er het vaakst ontbreekt.', 'Naast het oordeel van de app staat het NAIC-oordeel. Sorteer op “NAIC-oordeel” om de NAIC-kandidaten bovenaan te zien.'], 'Kopen betekent: de zes metingen zijn samen duidelijk gunstig. Het is een selectiehulp, geen persoonlijk advies.'],
    volglijst: ['Mijn volglijst', 'Aandelen die u wilt volgen om te zien of ze echt potentie hebben.', [
      'Bij het volgen legt de app het oordeel, de zes metingen en de koers van dat moment vast.',
      'Op de lijst ziet u wat de koers sindsdien deed en hoe het oordeel toen en nu is.',
      'Zo kunt u beoordelen of een kandidaat zijn belofte waarmaakt voordat u iets koopt.',
      'Uw volglijst staat alleen op dit toestel. Maak een back-up in Instellingen.'], null],
    portefeuille: ['Mijn portefeuille', 'Hier bewaart u aankopen om ze te kunnen volgen. Er wordt niets gekocht of verkocht.', [
      'Voeg een aankoop toe met aantal, koers en datum. Vink aan als u kocht op basis van het signaal; dan legt de app het oordeel van dat moment vast.',
      'Aankopen op signaal zijn herkenbaar aan een label. De kaart Op signaal gekocht vergelijkt het rendement met uw overige aankopen.',
      'Bedragen in verschillende valuta’s worden nooit omgerekend, maar apart getoond.',
      'Alles staat alleen op dit toestel. Maak een back-up in Instellingen.'], 'Het rendement is een momentopname en geen belofte voor later.'],
    vergelijk: ['Vergelijken', 'Zet twee aandelen naast elkaar.', [
      'Kies links en rechts een aandeel. Er worden alleen percentages en verhoudingen vergeleken, zodat valuta niet uitmaakt.',
      'Cijfers die niet zijn bevestigd, laat de app weg in plaats van ze te schatten.',
      'De app wijst geen winnaar aan; het is een hulpmiddel om te kiezen.'], null],
    instellingen: ['Instellingen en back-up', 'Hier regelt u uiterlijk, het minimum voor een oordeel en uw back-up.', [
      'Back-up: uw volglijst, portefeuille en eigen beoordelingen staan alleen op dit toestel. Maak een back-up en bewaar het bestand; met Terugzetten haalt u alles weer terug.',
      'Minimum aantal metingen: een aandeel krijgt pas een oordeel als minstens zoveel van de zes metingen beschikbaar zijn (standaard 4). Hoger is strenger.',
      'Uiterlijk: licht, donker of automatisch.',
      'Onderaan ziet u het versienummer van de app.'], null],
    hulp: ['Hulp en woordenlijst', 'Algemene uitleg en alle begrippen.', [
      'Open een begrip om de betekenis te lezen.',
      'Bij elke pagina staat bovenaan het vraagteken: dat geeft uitleg over precies dat scherm.',
      'Via de rondleiding ziet u de basis nog eens.'], null],
    samenvatting: ['Aandeel: Overzicht', 'De samenvatting van één aandeel.', [
      'Over het bedrijf: een korte beschrijving, de sector en vaste gegevens uit Wikipedia en Wikidata. Daarna het oordeel met de zes metingen: per meting de waarde en de bron, of waarom ze ontbreekt.',
      'Bij elk cijfer staat de bron: gecontroleerd, uit jaarverslag (met boekjaar), koersdata (met datum), indicatief (Yahoo) of uw eigen invoer. Tik op een meting voor uitleg.',
      'Daaronder de NAIC-kaart: het oordeel volgens de Stock Selection Guide, met groei, gemiddelde K/W, de verwachte hoge en lage koers over 5 jaar en de koerszones.', 'Ter informatie (telt niet mee): andere kentallen per onderwerp, uw eigen oordeel en het advies van analisten (Yahoo Finance).',
      'Eronder ziet u of de gegevens bevestigd zijn; zo niet, dan staat er waarom.',
      'Met de ster volgt u het aandeel.'], 'Het oordeel is nooit een koop- of verkoopadvies.'],
    koers: ['Aandeel: Koers', 'De koersontwikkeling en wat die betekent.', [
      'De grafiek toont het verloop; de lijn is het gemiddelde van 50 dagen.',
      'Koers boven het gemiddelde duidt op een stijgende trend, daaronder op een dalende.',
      'Timing is alleen informatie. Het voorspelt niets.',
      'Is de koers ouder dan enkele dagen, dan gebruikt de app hem niet voor het oordeel.'], null],
    waarde: ['Aandeel: NAIC', 'De Stock Selection Guide van de NAIC in stappen.', [
      'Stap 1 tot 4 tonen groei, rendement op eigen vermogen, winstmarge en koerszones op basis van bevestigde jaarcijfers.',
      'Het NAIC-oordeel (Kopen, Neutraal of Vermijden) staat ook op het Overzicht en in de lijsten. Hier kunt u met eigen aannames uw eigen koerszones uitrekenen.', 'De plek in het koersbereik (onderin, midden, bovenin) krijgt alleen een label als alle controles slagen: tien jaar winst per aandeel onderbouwd, één valuta en een verse koers.',
      'Ontbreekt iets, dan staat er wat. De app vult nooit zelf in.'], 'Dit is een rekenhulp met uw eigen invoer, geen advies.'],
    check: ['Aandeel: Verdiepen', 'Hier legt u uw eigen kennis vast. Uw beoordeling telt niet mee in het oordeel; een ontbrekend cijfer dat u invult wel.', [
      'Geef een score van 1 tot 5 voor management, concurrentiepositie, sector en risico’s en schrijf eventueel een notitie.',
      'Ontbreekt een cijfer (bijvoorbeeld groei of K/W), dan kunt u het zelf invullen. Het vult dan die meting aan en vervangt nooit een cijfer uit het jaarverslag.',
      'Bovenaan ziet u live hoeveel van de zes metingen er zijn.',
      'Onderaan staat de checklist met vragen over het bedrijf.',
      'Alles wordt opgeslagen op dit toestel en zit in de back-up.'], null],
    gezondheid: ['Aandeel: Cijfers', 'De jaarcijfers en de controle erop.', [
      'De tabel toont omzet, winst, kasstroom en meer per boekjaar, in miljarden.',
      'Jaren waarvan de winst per aandeel niet is nagerekend staan apart, met de reden.',
      'Bij aandelen met cijfers uit een jaarverslag is de winst niet onafhankelijk nagerekend; ze tellen daarom minder zwaar mee.'], null],
    bronnen: ['Aandeel: Bronnen', 'Waar de cijfers vandaan komen en wanneer ze zijn gecontroleerd.', [
      'Jaarcijfers komen van de SEC (Verenigde Staten) of uit officiële Europese jaarverslagen. Ontbreken die, dan gebruikt de app indicatieve cijfers van Yahoo Finance (het label zegt dat). Koersen komen ook van Yahoo Finance.',
      'Per bron staat de datum van de laatste controle.',
      'Een gegeven zonder bron wordt niet gebruikt.'], null]
  };
  function voor(sleutel) {
    var x = T[sleutel] || T.start;
    return { sleutel: T[sleutel] ? sleutel : 'start', titel: x[0], intro: x[1], punten: x[2], tip: x[3] };
  }
  function sleutelVoorHash(hash) {
    hash = hash || '#/';
    var m = hash.match(/^#\/a\/[^\/]+(?:\/(\w+))?$/);
    if (m) return T[m[1]] ? m[1] : 'samenvatting';
    if (/^#\/vergelijk/.test(hash)) return 'vergelijk';
    var s = hash.replace(/^#\//, '');
    if (s === 'fondsen' || s === 'overzicht') s = 'zoek';
    return s === '' ? 'start' : (T[s] ? s : 'start');
  }
  var api = { voor: voor, sleutelVoorHash: sleutelVoorHash, SLEUTELS: Object.keys(T) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Hulp = api;
})(typeof window !== 'undefined' ? window : globalThis);
