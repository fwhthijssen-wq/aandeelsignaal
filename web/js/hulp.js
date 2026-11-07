/* Hulp per pagina: korte uitleg bij wat u op het scherm ziet. Geen rekenlogica; alleen tekst. */
(function (root) {
  'use strict';
  var T = {
    start: ['Start', 'Het dashboard: in één oogopslag wat er speelt. Elke tegel opent één scherm; daar zoomt u verder in.', [
      'Het getal op een tegel is het aantal regels op het scherm dat de tegel opent.',
      'Mijn portefeuilles: elke portefeuille op een eigen regel met waarde en rendement; tik op een regel en die portefeuille opent. Signalen in mijn portefeuilles: hoeveel signalen er zijn bij aandelen die u nu bezit, in alle portefeuilles, met per portefeuille het aantal.',
      'Volgen: de Volglijst (hoeveel aandelen, en hoeveel daarvan in de koopzone; die staan bovenaan als u de tegel opent) en de fictieve Modelportefeuille.',
      'De markt: Kansen (alle fondsen met NAIC Kopen, op een eigen scherm met filters), Marktbeeld (de verdeling Kopen, Neutraal en Vermijden) en Zekerheid (hoeveel fondsen bevestigde of officiële cijfers hebben).',
      'Onderaan staat van welke dag de gegevens zijn.',
      'In het menu: Markt (kansen en alle fondsen), Volglijst, Portefeuille en Achtergrond (datakwaliteit, het oordeel in het verleden, uitleg en instellingen).'], 'Ziet u een aandeel zonder oordeel? Dan is er te weinig bekend. De app schat nooit.'],
    model: ['Modelportefeuille', 'Een fictieve portefeuille die de signalen van de app automatisch volgt, om te zien of ze over langere tijd werken.', [
      'Bij elke NAIC-koopkans koopt de modelportefeuille voor ongeveer 1.000 euro (minstens 1 aandeel); staat de koers in de verkoopzone, dan verkoopt hij. Uitgevoerd tegen de slotkoers van de dag erna, met 3 euro kosten per transactie.',
      'Drie regels naast elkaar: alle kansen; ook verkopen als de kwaliteit wegvalt; en alleen kansen met een gunstig koopmoment. Zo ziet u welke regel het best werkt.',
      'De vergelijking met de index laat zien wat hetzelfde geld in de index had opgeleverd. Pas na een paar jaar zegt dat echt iets.',
      'Teruggerekend toont dezelfde regels vanaf 2018 op oude koersen: een indruk, geen bewijs (fondsen en cijfers van nu).',
      'De paarse kleur en het label fictief houden hem apart van uw eigen portefeuille.'], 'Fictief en geen beleggingsadvies.'],
    signalen: ['Signalen in mijn portefeuilles', 'Wat er speelt bij de aandelen die u nu bezit, per portefeuille.', [
      'Alle portefeuilles, niet alleen de gekozen. Verkochte aandelen en de volglijst tellen niet mee.',
      'Dringend eerst: verkoopzone, kwaliteit loopt terug, NAIC Vermijden en een omslag van de middellange termijn naar negatief. Daarna: koopzone (bijkopen?) en een omslag naar positief.',
      'Staat een aandeel in twee portefeuilles, dan ziet u het signaal in beide.',
      '“Nieuw sinds” vergelijkt met de vorige gegevensupdate; dat staat alleen op dit toestel. De pushmeldingen gaan over dezelfde aandelen.'], null],
    kansen: ['Kansen', 'Alle fondsen met NAIC Kopen op één scherm.', [
      'NAIC Kopen: de koers staat in de koopzone, met minstens 3 : 1 opwaarts tegen neerwaarts en voldoende verwacht rendement per jaar.',
      'Volgorde: eerst een gunstig koopmoment (kortetermijnsignaal), dan de meeste ruimte opwaarts tegen neerwaarts.',
      'Filters: gunstig koopmoment, onder de koopprijs, nieuw sinds de vorige update, en per index. De getallen op de knoppen zijn dezelfde als op de tegel.',
      'Onderaan: welke fondsen sinds de vorige update niet meer Kopen zijn.'], 'Kopen betekent: het fonds voldoet aan alle NAIC-regels. Het is een selectiehulp, geen persoonlijk advies.'],
    markt: ['Markt', 'Van de hele markt naar het afzonderlijke fonds.', [
      'Marktbeeld: per index een balk met hoeveel fondsen Kopen, Neutraal of Vermijden zijn volgens NAIC. Tik op een index en de lijst eronder toont die fondsen.',
      'Kansen: hoeveel fondsen NAIC Kopen zijn; tik voor het scherm Kansen met alle fondsen en filters.',
      'Alle fondsen: per index gegroepeerd, standaard met NAIC Kopen bovenaan. Zoek op naam of beurscode, filter op index of op zekerheid van de cijfers, of sorteer anders (afstand tot de koopprijs, gezondheidscheck, groei, marge).',
      'Per fonds staat eerst het NAIC-oordeel, daarna de gezondheidscheck van de zes metingen (Check: Gezond, Gemengd of Zwak).',
      'Onder de lijst: welke gegevens er zijn voor alle fondsen samen, per meting, en wat er het vaakst ontbreekt.'], 'Kopen betekent: het fonds voldoet aan alle NAIC-regels. Het is een selectiehulp, geen persoonlijk advies.'],
    achtergrond: ['Achtergrond', 'Hoe zeker en hoe goed is wat de app laat zien?', [
      'Zekerheid van de gegevens: hoeveel fondsen bevestigde, officiële of indicatieve cijfers hebben. Tik voor de datakwaliteit per fonds.',
      'Oordeel in het verleden: hoe aandelen met NAIC Kopen, Neutraal en Vermijden het deden in 2018–2025, vergeleken met het gemiddelde.',
      'De methode: hoe het NAIC-oordeel en de gezondheidscheck tot stand komen.',
      'Verder: hulp en begrippen, instellingen en back-up, en twee aandelen vergelijken.'], null],
    volglijst: ['Mijn volglijst', 'Aandelen die u wilt volgen om te zien of ze echt potentie hebben.', [
      'Bij het volgen legt de app het NAIC-oordeel, de gezondheidscheck en de koers van dat moment vast.',
      'Op de lijst ziet u wat de koers sindsdien deed, hoe het oordeel toen en nu is, en of het aandeel nu in de koop- of verkoopzone staat.',
      'Zo kunt u beoordelen of een kandidaat zijn belofte waarmaakt voordat u iets koopt.',
      'Met “Dichtst bij koopprijs” staan de aandelen bovenaan die het dichtst bij een NAIC-koop zitten: zo werkt de volglijst als wachtlijst.',
      'Uw volglijst staat alleen op dit toestel. Maak een back-up in Instellingen.'], null],
    portefeuille: ['Mijn portefeuille', 'Hier bewaart u aankopen om ze te kunnen volgen. Er wordt niets gekocht of verkocht.', [
      'Voeg een aankoop toe met aantal, koers, datum, aankoopkosten en (bij dollars of ponden) het betaalde bedrag in euro. Vink aan als u kocht op basis van het signaal; dan legt de app het oordeel van dat moment vast.',
      'Bovenaan in euro: waarde, resultaat (na kosten, met dividend), rendement, wat de index met dezelfde bedragen deed, en een grafiek. Daaronder de open posities en wat u verkocht.',
      'Per aankoop: Verkopen (ook een deel), Bewerken (aanvullen of verbeteren) en Verwijderen.',
      'Aankopen op signaal zijn herkenbaar aan een label. De kaart Op signaal gekocht vergelijkt het rendement met uw overige aankopen.',
      'Meerdere portefeuilles, bijvoorbeeld een eigen en die van een beleggingsclub: kies Nog een portefeuille bijhouden. Bovenaan wisselt u tussen de portefeuilles; elke heeft eigen aankopen en totalen. Een portefeuille die u als back-upbestand krijgt, zet u erbij met Terugzetten › Toevoegen.',
      'Alles staat alleen op dit toestel. Maak een back-up in Instellingen.'], 'Het rendement is een momentopname en geen belofte voor later.'],
    vergelijk: ['Vergelijken', 'Zet twee aandelen naast elkaar.', [
      'Kies links en rechts een aandeel. Er worden alleen percentages en verhoudingen vergeleken, zodat valuta niet uitmaakt.',
      'Cijfers die niet zijn bevestigd, laat de app weg in plaats van ze te schatten.',
      'De app wijst geen winnaar aan; het is een hulpmiddel om te kiezen.'], null],
    instellingen: ['Instellingen en back-up', 'Hier regelt u uiterlijk, het minimum voor een oordeel en uw back-up.', [
      'Back-up: uw volglijst, portefeuille en eigen beoordelingen staan alleen op dit toestel. Maak een back-up en bewaar het bestand; met Terugzetten haalt u alles weer terug.',
      'Minimum aantal metingen: de gezondheidscheck (Gezond, Gemengd of Zwak) verschijnt pas als er minstens zoveel beschikbaar zijn (standaard 4). Hoger is strenger. Het NAIC-oordeel heeft eigen eisen.',
      'Uiterlijk: licht, donker of automatisch.',
      'Weergave: Eenvoudig verbergt de details (zoals de kentallen ter informatie); Uitgebreid toont alles. Met ?weergave=eenvoudig achter de link opent iemand anders de app meteen eenvoudig.',
      'Onderaan ziet u het versienummer van de app.'], null],
    hulp: ['Hulp en woordenlijst', 'Algemene uitleg en alle begrippen.', [
      'Open een begrip om de betekenis te lezen.',
      'Bij elke pagina staat bovenaan het vraagteken: dat geeft uitleg over precies dat scherm.',
      'Via de rondleiding ziet u de basis nog eens.'], null],
    oordeel: ['Aandeel: Oordeel', 'Wat vindt de app, en waar moet u op letten? Kort; de onderbouwing staat op de andere tabbladen.', [
      'Bovenaan het NAIC-oordeel (lange termijn: Kopen, Neutraal of Vermijden) met de vijf toetsen als vinkjes, bij Kopen het koopmoment (gunstig, neutraal of afwachten), de koopprijs (“Kopen onder …”) en of het oordeel stevig is of op het randje staat. Hier vult u ook uw eigen groeiverwachting in.',
      'Aandachtspunten: de ongunstige metingen uit de gezondheidscheck, bijvoorbeeld hoge schuld.',
      'Daaronder één regel per termijn (middellang en kort), de zekerheid van de cijfers en de gezondheidscheck. Tik op een regel voor de details.',
      'Het advies van analisten (Yahoo Finance) is een mening en telt niet mee. Onderaan staat het bedrijf.',
      'Met de ster volgt u het aandeel; met Afdrukken / PDF maakt u een fondsrapport.'], 'Het oordeel is nooit een koop- of verkoopadvies.'],
    naic: ['Aandeel: NAIC', 'De Stock Selection Guide van de NAIC in zes stappen.', [
      'Stap 1 groei, stap 2 het management (winstmarge, rendement op eigen vermogen, schuld en de managementfeiten), stap 3 de koers/winst-geschiedenis, stap 4 de verwachte hoge en lage koers, stap 5 risico en rendement, stap 6 het totaalrendement.',
      'De gids verschijnt bij elk aandeel met minstens 4 jaar winst per aandeel; bovenaan staat hoe zeker de cijfers zijn (bevestigd, uit jaarverslag of indicatief).',
      'Met “Zelf rekenen” rekent u met eigen aannames uw eigen koerszones uit. Dat verandert het NAIC-oordeel niet.',
      'Ontbreekt iets, dan staat er wat. De app vult nooit zelf in.'], 'Dit is een rekenhulp, geen advies.'],
    gezond: ['Aandeel: Gezondheid', 'Hoe staat het bedrijf ervoor? Geen koopadvies: een gezond bedrijf kan te duur zijn.', [
      'De gezondheidscheck: zes metingen (kasstroom, schuld, groei, K/W, trend en rust), samen Gezond, Gemengd of Zwak. Per meting de waarde en de bron, of waarom ze ontbreekt. Tik op een meting voor uitleg.',
      'Ter informatie: andere kentallen per onderwerp. Die tellen niet mee.',
      'Uw eigen onderzoek: geef een score van 1 tot 5 voor management, concurrentiepositie, sector en risico’s, en vul de kwaliteitscheck van Philip Fisher in. Dat telt niet mee in het oordeel.',
      'Alles wat u invult staat op dit toestel en zit in de back-up.'], null],
    koers: ['Aandeel: Koers', 'De koers, en wat die zegt voor de middellange en de korte termijn.', [
      'Bovenaan de grafiek: 6 maanden of 2 jaar, met het gemiddelde van 50 of 200 dagen, de NAIC-koopzone als groene band en uw gemiddelde aankoopkoers.',
      'Middellange termijn (3–12 maanden): één oordeel, positief, neutraal of negatief, uit vier onderdelen: trend, relatieve sterkte t.o.v. de index, bijstellingen van de winstverwachting door analisten en de kwartaalcijfers t.o.v. de verwachting. Onder “Onderbouwing” staan de details.',
      'Korte termijn (dagen tot weken): alleen feiten, zoals de datum van de volgende kwartaalcijfers en de verwachte bandbreedte voor een maand. Geen signaal: op 1 maand werkte in het terugrekenen niets.',
      'Risico: hoeveel de koers onder de top staat, de grootste daling in 5 jaar, de beweeglijkheid en de beta.',
      'Is de koers ouder dan 7 dagen, dan gebruikt de app hem niet.'], 'Dit is informatie naast het NAIC-oordeel (lange termijn); het verandert dat oordeel niet.'],
    cijfers: ['Aandeel: Cijfers', 'De jaarcijfers, hoe zeker ze zijn en waar ze vandaan komen.', [
      'Bovenaan of de gegevens bevestigd zijn; zo niet, dan staat er waarom.',
      'De tabel toont omzet, winst, kasstroom en meer per boekjaar, in miljarden. Jaren waarvan de winst per aandeel niet is nagerekend staan apart, met de reden.',
      'Ontbreekt een cijfer voor de gezondheidscheck, dan kunt u het zelf invullen. Het vervangt nooit een cijfer uit het jaarverslag.',
      'Bronnen: jaarcijfers komen van de SEC (Verenigde Staten) of uit officiële Europese jaarverslagen (digitaal of uit de pdf). Ontbreken die, dan indicatieve cijfers van Yahoo Finance. Per bron de datum van de laatste controle; een gegeven zonder bron wordt niet gebruikt.'], null],
    kwaliteit: ['Datakwaliteit', 'Hoe zeker zijn de cijfers achter de oordelen?', [
      'De balk telt de fondsen per soort gegevens: Bevestigd (10 jaar winst per aandeel onafhankelijk nagerekend), Uit jaarverslag (officieel, niet nagerekend), Twee bronnen eens (Yahoo, maar de winst per aandeel klopt met uw tweede bron), Indicatief (Yahoo of door u aangeleverd) en zonder jaarcijfers.',
      'Tweede bron: hoeveel cijfers van de app overeenkomen met de controlecijfers die u aanleverde. Een afwijking betekent niet dat de app fout zit; vaak is het een andere definitie of een herziening.',
      'Gecorrigeerd: de winst per aandeel is vervangen door die van de tweede bron, alleen als de eigen nettowinst en het aantal aandelen van de app dat aantonen (bijvoorbeeld een splitsing die niet verwerkt was).',
      'Met de knoppen filtert u, bijvoorbeeld op fondsen met minder dan 6 jaar winst per aandeel. Tik op een fonds voor de bronnen.'], 'Wilt u gaten vullen? Het aanvulsjabloon (Excel) vraagt precies wat hier ontbreekt.']
  };
  function voor(sleutel) {
    var x = T[sleutel] || T.start;
    return { sleutel: T[sleutel] ? sleutel : 'start', titel: x[0], intro: x[1], punten: x[2], tip: x[3] };
  }
  var TAB = { oordeel: 1, naic: 1, gezond: 1, koers: 1, cijfers: 1 };
  var TAB_OUD = { samenvatting: 'oordeel', waarde: 'naic', check: 'gezond', gezondheid: 'cijfers', bronnen: 'cijfers' };
  function sleutelVoorHash(hash) {
    hash = hash || '#/';
    var m = hash.match(/^#\/a\/[^\/]+(?:\/(\w+))?$/);
    if (m) { var t = TAB_OUD[m[1]] || m[1]; return TAB[t] ? t : 'oordeel'; }
    if (/^#\/vergelijk/.test(hash)) return 'vergelijk';
    var s = hash.replace(/^#\//, '');
    if (s === 'fondsen' || s === 'overzicht' || s === 'zoek') s = 'markt';
    return s === '' ? 'start' : (T[s] ? s : 'start');
  }
  var api = { voor: voor, sleutelVoorHash: sleutelVoorHash, SLEUTELS: Object.keys(T) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Hulp = api;
})(typeof window !== 'undefined' ? window : globalThis);
