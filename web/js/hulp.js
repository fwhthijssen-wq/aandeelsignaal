/* Hulp per pagina: korte uitleg bij wat u op het scherm ziet. Geen rekenlogica; alleen tekst. */
(function (root) {
  'use strict';
  var T = {
    start: ['Start', 'Hier ziet u in één oogopslag wat er speelt bij uw aandelen en welke aandelen nu kansrijk zijn volgens NAIC.', [
      'Bovenaan drie tegels: Portefeuille (waarde en rendement; tik voor alle aankopen), Actie bij uw aandelen (hoeveel van uw aandelen in de koop- of verkoopzone staan of in kwaliteit teruglopen) en Kansen (hoeveel fondsen nu NAIC Kopen zijn). Tik op een tegel om erheen te gaan.',
      'Marktbeeld: per index een balk met hoeveel fondsen Kopen, Neutraal of Vermijden zijn volgens NAIC. Tik op een index en u ziet die fondsen onder Fondsen.',
      'Onderaan staat van welke dag de gegevens zijn en hoeveel aandelen volledig bevestigd zijn (tien jaar winst per aandeel onafhankelijk nagerekend). Dat zegt iets over de zekerheid, niet over goed of slecht.',
      'Signalen: bij de aandelen in uw portefeuille en op uw volglijst ziet u wanneer ze in de koopzone of verkoopzone staan, of wanneer de kwaliteit terugloopt (NAIC). Daaronder: welke fondsen sinds de vorige gegevensupdate naar Kopen of Vermijden gingen. Dat vergelijkt de app met wat u de vorige keer zag; het staat alleen op dit toestel.',
      'Het oordeel volgt de NAIC Stock Selection Guide: groeibedrijf, goed bedrijf (deel 1 en 2), prijs in de koopzone met minstens 3 : 1 (deel 3 en 4) en minstens 15% verwacht rendement per jaar (deel 5). Bij Beste kansen staat NAIC standaard; App (zes metingen, aanvullend) en Beide kunt u kiezen.',
      'Elk aandeel krijgt zes stippen, één per meting: Kasstroom, Schuld, Groei, K/W, Trend en Rust. De kleur loopt van donkergroen naar rood: donkergroen ✓ gunstig, lichtgroen ✓ licht gunstig, half groen en half rood = neutraal, lichtrood ✗ licht ongunstig, rood ✗ ongunstig. Een lege ring betekent dat het gegeven ontbreekt. Samen geven ze een aanvullend oordeel; dat telt niet mee in het NAIC-oordeel.',
      'Alle fondsen, per index en met NAIC Kopen bovenaan, staan onder Fondsen in het menu.',
      'Uw eigen onderzoek (tabblad Verdiepen) staat bij het aandeel, maar telt niet mee in het oordeel.'], 'Ziet u een aandeel zonder oordeel? Dan is er te weinig bekend. De app schat nooit.'],
    overzicht: ['Overzicht', 'De complete lijst van aandelen.', [
      'Tik op een aandeel voor details of kies Aandelen vergelijken om er twee naast elkaar te zetten.',
      'De chip bij elk aandeel toont hoe zeker de gegevens zijn: Bevestigd, Uit jaarverslag of Niet bevestigd.'], null],
    zoek: ['Fondsen', 'Alle aandelen, per index gegroepeerd.', [
      'Per index staan de vijf meest kansrijke bovenaan; met “Alle tonen” ziet u de rest. Kies “Eén lijst” om alle fondsen samen te rangschikken.',
      'Standaard staat NAIC Kopen bovenaan, dan Neutraal, dan Vermijden; binnen elke groep de meeste ruimte opwaarts tegen neerwaarts. Sorteer op “Zes metingen” voor het aanvullende oordeel.',
      'U kunt ook sorteren op afstand tot de koopprijs, plek in het koersbereik, winstgroei, omzetgroei of marge, en zoeken op naam of beurscode.',
      'Een aandeel dat in twee indices zit, staat in beide groepen.', 'Onder de lijst: welke gegevens er zijn voor alle fondsen samen, per meting, en wat er het vaakst ontbreekt.', 'Per fonds staat eerst het NAIC-oordeel, daarna het aanvullende oordeel van de zes metingen (App).'], 'Kopen betekent: het fonds voldoet aan alle NAIC-regels. Het is een selectiehulp, geen persoonlijk advies.'],
    volglijst: ['Mijn volglijst', 'Aandelen die u wilt volgen om te zien of ze echt potentie hebben.', [
      'Bij het volgen legt de app het oordeel (NAIC en de zes metingen) en de koers van dat moment vast.',
      'Op de lijst ziet u wat de koers sindsdien deed, hoe het oordeel toen en nu is, en of het aandeel nu in de koop- of verkoopzone staat.',
      'Zo kunt u beoordelen of een kandidaat zijn belofte waarmaakt voordat u iets koopt.',
      'Met “Dichtst bij koopprijs” staan de aandelen bovenaan die het dichtst bij een NAIC-koop zitten: zo werkt de volglijst als wachtlijst.',
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
      'Minimum aantal metingen: het aanvullende oordeel van de zes metingen verschijnt pas als er minstens zoveel beschikbaar zijn (standaard 4). Hoger is strenger. Het NAIC-oordeel heeft eigen eisen.',
      'Uiterlijk: licht, donker of automatisch.',
      'Weergave: Eenvoudig toont per aandeel alleen het NAIC-oordeel, de vijf stappen, de koopprijs en één zin uitleg; Uitgebreid toont alles. Met ?weergave=eenvoudig achter de link opent iemand anders de app meteen eenvoudig.',
      'Onderaan ziet u het versienummer van de app.'], null],
    hulp: ['Hulp en woordenlijst', 'Algemene uitleg en alle begrippen.', [
      'Open een begrip om de betekenis te lezen.',
      'Bij elke pagina staat bovenaan het vraagteken: dat geeft uitleg over precies dat scherm.',
      'Via de rondleiding ziet u de basis nog eens.'], null],
    samenvatting: ['Aandeel: Overzicht', 'De samenvatting van één aandeel.', [
      'Over het bedrijf: een korte beschrijving, de sector en vaste gegevens uit Wikipedia en Wikidata.',
      'Daaronder, aanvullend, de zes metingen: per meting de waarde en de bron, of waarom ze ontbreekt. Bij elk cijfer staat de bron: gecontroleerd, uit jaarverslag (met boekjaar), koersdata (met datum), indicatief (Yahoo) of uw eigen invoer. Tik op een meting voor uitleg.',
      'Bovenaan het oordeel volgens NAIC: groei, de kwaliteitstoetsen, gemiddelde K/W, de verwachte hoge en lage koers over 5 jaar, de zones, het verwachte rendement en (ter informatie) de relatieve waarde. Daarbij de vijf NAIC-stappen als vinkjes, de koopprijs (“Kopen onder …”) en of het oordeel stevig is of op het randje staat. Hier vult u ook uw eigen groeiverwachting in.', 'Ter informatie (telt niet mee): andere kentallen per onderwerp, uw eigen oordeel en het advies van analisten (Yahoo Finance).',
      'Eronder ziet u of de gegevens bevestigd zijn; zo niet, dan staat er waarom.',
      'Met de ster volgt u het aandeel.'], 'Het oordeel is nooit een koop- of verkoopadvies.'],
    koers: ['Aandeel: Koers', 'De koersontwikkeling en wat die betekent.', [
      'De grafiek toont het verloop; de lijn is het gemiddelde van 50 dagen.',
      'Koers boven het gemiddelde duidt op een stijgende trend, daaronder op een dalende.',
      'Timing is alleen informatie. Het voorspelt niets.',
      'Is de koers ouder dan enkele dagen, dan gebruikt de app hem niet voor het oordeel.'], null],
    waarde: ['Aandeel: NAIC', 'De Stock Selection Guide van de NAIC in stappen.', [
      'Stap 1 tot 4 tonen groei, rendement op eigen vermogen, winstmarge en koerszones. De gids verschijnt bij elk aandeel met minstens 4 jaar winst per aandeel; bovenaan staat hoe zeker de cijfers zijn (bevestigd, uit jaarverslag of indicatief).',
      'Het NAIC-oordeel (Kopen, Neutraal of Vermijden) staat ook op het Overzicht en in de lijsten. Hier kunt u met eigen aannames uw eigen koerszones uitrekenen.', 'De plek in het koersbereik (onderin, midden, bovenin) krijgt alleen een label als alle controles slagen: tien jaar winst per aandeel onderbouwd, één valuta en een verse koers.',
      'Ontbreekt iets, dan staat er wat. De app vult nooit zelf in.'], 'Dit is een rekenhulp met uw eigen invoer, geen advies.'],
    check: ['Aandeel: Verdiepen', 'Hier legt u uw eigen kennis vast. Uw beoordeling telt niet mee in het oordeel; een ontbrekend cijfer dat u invult wel.', [
      'Geef een score van 1 tot 5 voor management, concurrentiepositie, sector en risico’s en schrijf eventueel een notitie.',
      'Ontbreekt een cijfer (bijvoorbeeld groei of K/W), dan kunt u het zelf invullen. Het vult dan die meting aan en vervangt nooit een cijfer uit het jaarverslag. Uw groeiverwachting voor NAIC vult u in op de NAIC-kaart bij Overzicht.',
      'Bovenaan ziet u live hoeveel van de zes metingen er zijn.',
      'Onderaan staat de checklist met vragen over het bedrijf.',
      'Alles wordt opgeslagen op dit toestel en zit in de back-up.'], null],
    gezondheid: ['Aandeel: Cijfers', 'De jaarcijfers en de controle erop.', [
      'De tabel toont omzet, winst, kasstroom en meer per boekjaar, in miljarden.',
      'Jaren waarvan de winst per aandeel niet is nagerekend staan apart, met de reden.',
      'Bij aandelen met cijfers uit een jaarverslag is de winst per aandeel niet onafhankelijk nagerekend; bij Indicatief (Yahoo) komen de cijfers niet uit een officiële bron. Het label bij het aandeel zegt welke.'], null],
    bronnen: ['Aandeel: Bronnen', 'Waar de cijfers vandaan komen en wanneer ze zijn gecontroleerd.', [
      'Jaarcijfers komen van de SEC (Verenigde Staten) of uit officiële Europese jaarverslagen (digitaal, of uit de pdf van het jaarverslag, zoals bij veel Duitse bedrijven). Ontbreken die, dan gebruikt de app indicatieve cijfers van Yahoo Finance (het label zegt dat). Koersen komen ook van Yahoo Finance.',
      'Komt de winst per aandeel uit een pdf-jaarverslag of van Yahoo, dan staat dat hier apart, met per jaar het document en de pagina.',
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
