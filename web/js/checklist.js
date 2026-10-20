/* Kwaliteitscheck: de 15 punten van Philip Fisher (Common Stocks and Uncommon Profits), ook gebruikt door NAIC-beleggers.
   De app beoordeelt hier niets. U vult per aandeel zelf in (ja / nee / weet ik niet) en schrijft een eigen notitie.
   De app telt alleen hoeveel punten zijn beantwoord; er komt geen score, oordeel of advies uit. */
(function (root) {
  'use strict';
  var PUNTEN = [
    { id: 1, groep: 'Concurrentiepositie', tekst: 'Heeft het bedrijf producten of diensten met genoeg markt om jarenlang flink te blijven groeien?', waar: 'Jaarverslag, onderdeel “Business”: markten en groeiplannen. Cijfers: omzetgroei in stap 1 van de NAIC-tab.' },
    { id: 2, groep: 'Management', tekst: 'Wil het management nieuwe producten of werkwijzen ontwikkelen als de huidige groei op raakt?', waar: 'Jaarverslag en presentaties voor beleggers: wat is er de afgelopen jaren echt nieuw uitgebracht?' },
    { id: 3, groep: 'Concurrentiepositie', tekst: 'Hoe goed is het onderzoek en de ontwikkeling in verhouding tot de omvang van het bedrijf?', waar: 'Jaarverslag: uitgaven aan onderzoek en ontwikkeling en wat dat heeft opgeleverd.' },
    { id: 4, groep: 'Concurrentiepositie', tekst: 'Heeft het bedrijf een bovengemiddelde verkooporganisatie?', waar: 'Jaarverslag, “Business”: klanten, verkoopkanalen, klantbehoud.' },
    { id: 5, groep: 'Concurrentiepositie', tekst: 'Is de winstmarge de moeite waard?', waar: 'NAIC-tab: winstmarge vóór belasting en nettomarge, vergeleken met concurrenten.' },
    { id: 6, groep: 'Management', tekst: 'Doet het bedrijf iets om de winstmarge te behouden of te verbeteren?', waar: 'NAIC-tab: loopt de marge over de jaren op, af of blijft hij gelijk? En wat zegt het management daarover?' },
    { id: 7, groep: 'Management', tekst: 'Zijn de arbeidsverhoudingen en het personeelsbeleid uitstekend?', waar: 'Beoordelingen van werknemers, stakingen, verloop. Het jaarverslag zegt hier meestal weinig over.' },
    { id: 8, groep: 'Management', tekst: 'Zijn de verhoudingen tussen de leidinggevenden onderling uitstekend?', waar: 'Veel vertrekkende topmensen of ruzies in het nieuws zijn waarschuwingen.' },
    { id: 9, groep: 'Management', tekst: 'Heeft het management diepgang, dus ook goede mensen onder de top?', waar: 'Jaarverslag en website: wie leidt de onderdelen en hoe lang zitten ze er al?' },
    { id: 10, groep: 'Management', tekst: 'Zijn kostenanalyse en boekhoudkundige controle van goede kwaliteit?', waar: 'Verklaring van de accountant in het jaarverslag; herstelde cijfers of aanmerkingen zijn waarschuwingen.' },
    { id: 11, groep: 'Concurrentiepositie', tekst: 'Zijn er bedrijfsspecifieke voordelen, zoals octrooien, merken of vaste locaties, die een voorsprong geven?', waar: 'Jaarverslag: octrooien, merken, licenties, contracten met klanten.' },
    { id: 12, groep: 'Financieel', tekst: 'Is het winstvooruitzicht op korte en lange termijn goed?', waar: 'Verwachtingen van het management in het jaarverslag; uw eigen koerszones in stap 4.' },
    { id: 13, groep: 'Financieel', tekst: 'Heeft het bedrijf in de nabije toekomst extra kapitaal nodig dat bestaande aandeelhouders verwatert?', waar: 'NAIC-tab: schuld t.o.v. kapitaal en dividend; uitgifte van nieuwe aandelen in het jaarverslag.' },
    { id: 14, groep: 'Management', tekst: 'Praat het management open met beleggers als het goed gaat, maar ook als het tegenzit?', waar: 'Kwartaalpresentaties en telefonische toelichting: hoe gaat het management om met tegenvallers?' },
    { id: 15, groep: 'Management', tekst: 'Heeft het management een onbetwiste integriteit?', waar: 'Zoek op onderzoeken, boetes of rechtszaken; de volmachtverklaring toont beloning en aandelenbezit.' }
  ];
  var ANTWOORDEN = ['ja', 'nee', 'onzeker'];

  /* Telt alleen. Onbeantwoorde punten tellen niet als nee of ja. */
  function voortgang(antwoorden) {
    var uit = { totaal: PUNTEN.length, beantwoord: 0, ja: 0, nee: 0, onzeker: 0, open: 0 };
    PUNTEN.forEach(function (p) {
      var a = antwoorden && antwoorden[p.id] && antwoorden[p.id].a;
      if (ANTWOORDEN.indexOf(a) > -1) { uit.beantwoord++; uit[a]++; } else uit.open++;
    });
    return uit;
  }

  var api = { PUNTEN: PUNTEN, ANTWOORDEN: ANTWOORDEN, voortgang: voortgang };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Checklist = api;
})(typeof self !== 'undefined' ? self : this);
