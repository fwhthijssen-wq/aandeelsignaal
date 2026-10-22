/* Hulp per pagina: korte uitleg bij wat u op het scherm ziet. Geen rekenlogica; alleen tekst. */
(function (root) {
  'use strict';
  var T = {
    start: ['Start', 'Hier ziet u in één oogopslag hoe het ervoor staat en welke aandelen nu kansrijk zijn.', [
      'De grote kaart bovenaan telt hoeveel aandelen volledig bevestigde gegevens hebben. Dat is iets anders dan een goed of slecht aandeel.',
      'Bij Kansrijk staan aandelen met een positief voorlopig oordeel, met bovenaan de beste. De percentages geven aan hoeveel van de mogelijke gegevens bekend is; hoe hoger, hoe betrouwbaarder.',
      'Elk oordeel heeft twee delen: het oordeel zelf (positief, neutraal of vermijden: wat de cijfers samen zeggen) en de onderbouwing (goed, redelijk, beperkt of zwak: hoeveel van de mogelijke gegevens bekend is).',
      'Alle fondsen, per index en op kansrijkheid gesorteerd, staan onder Fondsen in het menu.',
      'Eigen onderzoek (tabblad Verdiepen) maakt de onderbouwing sterker.'], 'Ziet u een aandeel zonder oordeel? Dan is er te weinig bekend. De app schat nooit.'],
    overzicht: ['Overzicht', 'De complete lijst van aandelen.', [
      'Tik op een aandeel voor details of kies Aandelen vergelijken om er twee naast elkaar te zetten.',
      'De chip bij elk aandeel toont hoe zeker de gegevens zijn: Bevestigd, Uit jaarverslag of Niet bevestigd.'], null],
    zoek: ['Fondsen', 'Alle aandelen, per index gegroepeerd.', [
      'Per index staan de vijf meest kansrijke bovenaan; met “Alle tonen” ziet u de rest. Kies “Eén lijst” om alle fondsen samen te rangschikken.',
      'Kansrijkheid: eerst positief, dan neutraal, dan vermijden, dan te weinig gegevens. Binnen elke groep staat de hoogste score bovenaan, gewogen met de onderbouwing.',
      'U kunt ook sorteren op plek in het koersbereik, winstgroei, omzetgroei of marge, en zoeken op naam of beurscode.',
      'Een aandeel dat in twee indices zit, staat in beide groepen.'], 'Kansrijk betekent: de beschikbare cijfers zijn gunstig. Het is geen koopadvies.'],
    volglijst: ['Mijn volglijst', 'Aandelen die u wilt volgen om te zien of ze echt potentie hebben.', [
      'Bij het volgen legt de app het oordeel, de dekking en de koers van dat moment vast.',
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
      'Minimale dekking: een aandeel krijgt pas een voorlopig oordeel als minstens dit deel van de mogelijke gegevens bekend is. Hoger is strenger.',
      'Uiterlijk: licht, donker of automatisch.',
      'Onderaan ziet u het versienummer van de app.'], null],
    hulp: ['Hulp en woordenlijst', 'Algemene uitleg en alle begrippen.', [
      'Open een begrip om de betekenis te lezen.',
      'Bij elke pagina staat bovenaan het vraagteken: dat geeft uitleg over precies dat scherm.',
      'Via de rondleiding ziet u de basis nog eens.'], null],
    samenvatting: ['Aandeel: Overzicht', 'De samenvatting van één aandeel.', [
      'Totaalbeeld: het voorlopige oordeel (positief, neutraal of vermijden) uit meerdere methoden. Klap de details open om per methode de score en de bron te zien.',
      'De dekking toont hoeveel van de mogelijke gegevens bekend is en hoeveel daarvan gecontroleerd is. Gecontroleerd weegt zwaarder.',
      '"Wat ontbreekt er nog" laat zien welke gegevens het oordeel zekerder zouden maken.',
      'Eronder ziet u of de gegevens bevestigd zijn; zo niet, dan staat er waarom.',
      'Met de ster volgt u het aandeel.'], 'Het oordeel is nooit een koop- of verkoopadvies.'],
    koers: ['Aandeel: Koers', 'De koersontwikkeling en wat die betekent.', [
      'De grafiek toont het verloop; de lijn is het gemiddelde van 50 dagen.',
      'Koers boven het gemiddelde duidt op een stijgende trend, daaronder op een dalende.',
      'Timing is alleen informatie. Het voorspelt niets.',
      'Is de koers ouder dan enkele dagen, dan gebruikt de app hem niet voor het oordeel.'], null],
    waarde: ['Aandeel: NAIC', 'De Stock Selection Guide van de NAIC in stappen.', [
      'Stap 1 tot 4 tonen groei, rendement op eigen vermogen, winstmarge en koerszones op basis van bevestigde jaarcijfers.',
      'Het NAIC-label (positief, neutraal of vermijden) staat er alleen als alle controles slagen: tien jaar winst per aandeel onderbouwd, één valuta en een verse koers.',
      'Ontbreekt iets, dan staat er wat. De app vult nooit zelf in.'], 'Dit is een rekenhulp met uw eigen invoer, geen advies.'],
    check: ['Aandeel: Verdiepen', 'Hier voegt u zelf kennis toe, zodat het oordeel zekerder wordt.', [
      'Geef een score van 1 tot 5 voor management, concurrentiepositie, sector en risico’s en schrijf eventueel een notitie.',
      'Ontbreekt een cijfer (bijvoorbeeld groei of marge), dan kunt u het zelf invullen. Uw eigen cijfer telt lichter dan een gecontroleerd cijfer en vervangt dat nooit.',
      'De meter bovenaan groeit live mee met wat u invult.',
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
