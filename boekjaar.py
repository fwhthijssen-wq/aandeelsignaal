"""Boekjaarlabel voor een afsluitdatum.

Bedrijven met een 52/53-wekenjaar (bijv. Johnson & Johnson) sluiten soms op 1-3 januari van het
volgende kalenderjaar (2021-01-03 voor boekjaar 2020) en een ander jaar op 31 december. Met het
kalenderjaar van de afsluitdatum botsen dan twee boekjaren (2023-01-01 en 2023-12-31). Door 7 dagen af te
trekken krijgt een afsluitdatum van 1-7 januari het vorige jaar; alle andere datums houden hun jaar.
"""
from datetime import date, timedelta


def boekjaar(end):
    """Boekjaar (int) van een afsluitdatum (date of 'YYYY-MM-DD')."""
    if isinstance(end, str):
        end = date.fromisoformat(end[:10])
    return (end - timedelta(days=7)).year
