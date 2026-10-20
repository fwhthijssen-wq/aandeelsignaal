# Aandeel Signaal — bèta 2026.10.20-beta.17

Dit is een **bèta voor eigen gebruik en feedback**. Geen gevalideerd beleggingsadvies, geen definitieve NAIC-vrijgave, geen productieversie.

## Wat zit er in deze map
- `LEES_DIT_EERST.md` (dit bestand) en `CHANGELOG.md`: wat er nieuw is.
- `documentatie/`: projectstatus met openstaande punten en het sjabloon voor het testlogboek. Zo ligt alles bij elkaar; een update brengt ook de documentatie bij.
- `mijn_gegevens/`: uw eigen volglijst (komt niet in de ZIP, wordt nooit overschreven).
- Kopieer het testlogboek-sjabloon onder een eigen naam voordat u het invult.

## Nieuw: de webapp (aanbevolen, ook voor de telefoon)
Dubbelklik `START_WEBAPP.cmd`. Het venster toont een adres voor deze computer en een voor uw telefoon (zelfde wifi). Dit vervangt de Streamlit-versie, die op de telefoon een lege pagina gaf. Uitleg, ook voor gratis online zetten: `documentatie/WEBAPP.md`. Let op: uw volglijst staat per toestel; gebruik Instellingen > Back-up maken.

## Eerst: veiligheid van je gegevens
1. Verwijder of overschrijf je oude versie **niet**.
2. Maak een kopie van de oude map en van je eigen gegevens.
3. Pak deze ZIP uit in een **nieuwe, aparte map**, bijvoorbeeld `C:\AandeelSignaal_Beta`.

## Starten op Windows
1. Pak de ZIP **eerst volledig uit** (rechtermuisknop, "Alles uitpakken"). Dubbelklik daarna in de uitgepakte map op **START_AANDEEL_SIGNAAL.cmd**. Python 3 en internet zijn nodig voor de eerste start.
2. De eerste start maakt een eigen `.venv` en installeert Streamlit, pandas en yfinance. Daarna wordt de installatie vastgelegd in `installed_versions.txt`.
3. Sluit het zwarte venster om te stoppen.
4. Bij SEC-jaarhistorie vraagt de app om een contact-e-mailadres (eis van de SEC).
5. Gaat iets mis: maak een schermafbeelding en noteer het in `AandeelSignaal_Testlogboek.md` (indien meegeleverd).

## Op de telefoon (zelfde wifi)
Dubbelklik `START_OOK_OP_TELEFOON.cmd` in plaats van het gewone startbestand. Het venster toont een adres als `http://192.168.1.20:8501`; typ dat in de browser van de telefoon. Kies in Windows bij de vraag om toegang "Privénetwerken". Laat het venster open. Alleen op uw eigen thuisnetwerk gebruiken. Op de telefoon kunt u in het browsermenu "Zet op beginscherm" kiezen.

## Wat is nieuw in beta.8: nieuw uiterlijk
Dashboard als startscherm, menu onderin het scherm en licht/donker. Zie CHANGELOG.md. Het uiterlijk is nog niet in een echte browser bekeken door de bouwer: kijk vooral naar de onderbalk op uw telefoon en in donkere modus.

## Wat is nieuw in beta.7: overzicht van aandelen
Onder "Interessante aandelen" ziet u in één tabel van welke aandelen de gegevens bevestigd zijn en wat de koers doet ten opzichte van het 50-daags gemiddelde. Er worden geen koop- of verkoopsignalen gegeven.

## Wat is nieuw in beta.6: label gekoppeld aan de controle
De app controleert nu zelf de jaarcijfers van een aandeel en toont "Gegevens bevestigd" zodra alles klopt én de koers maximaal 7 dagen oud is. Het SEC-contactadres is een instelling (zie CHANGELOG.md); standaard staat het adres van de beheerder erin. Hernoem `instellingen_VOORBEELD.json` naar `instellingen.json` om een ander adres te gebruiken.

## Wat is nieuw in beta.5: aandelensplitsingen worden nu echt gecontroleerd
Splitsingen (zoals bij Apple) worden bevestigd met bewijs uit de SEC zelf, en de winst per aandeel van de oudste jaren wordt herberekend uit nettowinst en aantal aandelen. Zie CHANGELOG.md. Of dit op echte Apple-data werkt, is pas bewezen nadat u `AandeelSignaal_Apple_controle.pyz` opnieuw hebt gedraaid.

## Wat is nieuw in beta.4: rustiger scherm
- Het startscherm heeft drie keuzes plus Hulp. Onderzoeksfuncties staan onder "Voor gevorderden".
- Bij een aandeel kiest u bij "Wat wilt u zien?" een onderdeel: Samenvatting, Koersverloop, Waardering (rekenvoorbeeld), Financiële gezondheid of Bronnen en onderzoek. Standaard ziet u alleen de samenvatting.
- De Hulp-pagina legt EPS, K/W, SMA50, RSI en F-score uit in gewone taal.
- **Let op:** de samenvatting zegt nu bij elk aandeel "Nog geen beoordeling mogelijk". Dat is correct: de bevestigde EPS-gegevens zijn nog niet aan dit scherm gekoppeld (volgende stap).

## Wat werkt
**Mijn volglijst** (nieuw): aandelen bewaren, bekijken, verwijderen (met bevestiging en ongedaan maken), exporteren en importeren als CSV. Koersen en technische gegevens (Yahoo Finance), SEC-jaarhistorie, kasstroom en FCF, NAIC-onderzoekstabellen, voorlopige scenario's met eigen aannames, CSV-export, ESEF-onderzoek.

## Regels die de app volgt
- Een **beoordelingslabel** verschijnt alleen als de EPS onafhankelijk bevestigd is (10 jaar), de koers niet ouder is dan 7 dagen, er één valuta is en geen bron is afgewezen. Anders staat er waarom niet. Op dit moment wordt de SEC-EPS-bewijsketen nog niet automatisch aan het koersscherm gekoppeld, dus het label blijft daar verborgen.
- Een **score** verschijnt niet bij een verouderde koers.
- Er worden **geen koop- of verkoopsignalen** getoond. "Interessante aandelen" is nog niet beschikbaar.
- Uw **volglijst** staat in de map `mijn_gegevens` naast de app, alleen op deze computer. Die map zit niet in de ZIP, dus een update overschrijft hem niet. Hij synchroniseert niet met uw telefoon. Maak af en toe een back-up via "Download mijn volglijst (CSV)".

## Wat niet bewezen is
Windows-installatie, live bronopvraging, definitieve EPS-controle bij aandelensplitsingen, onafhankelijke NAIC-narekening. Zie `CHANGELOG.md`.

## Tests
`RUN_TESTS.cmd` (of `python run_tests.py`) draait alle offline tests en schrijft `TESTRAPPORT.txt`.
