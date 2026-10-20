"""Uitleg van vaktermen in gewone taal ("Wat betekent dit?")."""

TERMS = (
    ('EPS (winst per aandeel)', 'De winst van een bedrijf gedeeld door het aantal aandelen. '
     'Na een aandelensplitsing is EPS van vroeger jaren alleen vergelijkbaar als die is omgerekend.'),
    ('K/W (koers-winstverhouding)', 'De koers gedeeld door de winst per aandeel. Een K/W van 15 betekent dat u '
     '15 keer de jaarwinst per aandeel betaalt. Ook wel P/E genoemd.'),
    ('SMA50 (50-daags gemiddelde)', 'De gemiddelde slotkoers van de laatste 50 handelsdagen. '
     'Het toont of de koers de laatste tijd boven of onder zijn gewone niveau zit.'),
    ('RSI (14)', 'Een getal van 0 tot 100 dat recente stijgingen en dalingen vergelijkt. '
     'Hoog betekent dat de koers recent sterk steeg, laag dat hij sterk daalde. Het is geen koop- of verkoopsignaal.'),
    ('F-score (Piotroski)', 'Een score van 0 tot 9 voor de financiële gezondheid van een bedrijf. '
     'Hoger is beter. Het voorspelt niets.'),
    ('Vrije kasstroom', 'Het geld dat een bedrijf uit zijn bedrijfsvoering overhoudt nadat het investeringen heeft betaald.'),
    ('Veiligheidsmarge', 'Een korting op een berekende waarde, zodat er ruimte is voor fouten in de aannames.'),
    ('Beoordeling en label', 'Een label zoals "Interessant om te bekijken" is een selectiehulp, geen persoonlijk advies. '
     'De app toont het alleen als alle gegevens bevestigd zijn.'),
)

STEPS = (
    'Kies "Een aandeel bekijken" en selecteer een bedrijf.',
    'Druk op "Bekijk het aandeel". U ziet de koers en een korte samenvatting.',
    'Kies onderin het scherm een ander onderdeel voor meer details.',
    'Druk op "Zet op mijn volglijst" om het aandeel te bewaren.',
    'Met "Terug naar het begin" gaat u altijd terug naar het hoofdmenu.',
)


def term_names():
    return [name for name, _ in TERMS]
