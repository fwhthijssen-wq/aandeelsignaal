"""Ophalen van SEC-jaarfeiten voor het NAIC-dossier, zonder scorewijzigingen."""
from datetime import date
from source_engine import sec_snapshot


# Beursnotering en SEC-registratie zijn verschillende identificaties.
# Alleen expliciet gecontroleerde koppelingen, nooit automatisch een suffix strippen.
SEC_LISTING_MAP = {
    'ASML.AS': 'ASML',  # ASML Holding NV, SEC Form 20-F
    'INGA.AS': 'ING',   # ING Groep NV, SEC Form 20-F
    'SAP.DE': 'SAP',    # SAP SE, SEC Form 20-F
    'SHELL.AS': 'SHEL',  # Shell plc, SEC Form 20-F (rapporteert in USD)
    'UNA.AS': 'UL',      # Unilever PLC, SEC Form 20-F
    'SAN.PA': 'SNY',     # Sanofi, SEC Form 20-F (EUR)
    'RACE.MI': 'RACE',   # Ferrari NV, SEC Form 20-F (EUR)
    'PHIA.AS': 'PHG',    # Koninklijke Philips NV, SEC Form 20-F (EUR)
    'STLAM.MI': 'STLA',  # Stellantis NV, SEC Form 20-F (EUR)
    'NOKIA.HE': 'NOK',   # Nokia Oyj, SEC Form 20-F (EUR)
    'ENI.MI': 'E',       # Eni SpA, SEC Form 20-F (EUR)
}


def sec_ticker_for_listing(ticker):
    return SEC_LISTING_MAP.get((ticker or '').upper(), ticker)


def fetch_naic_facts(ticker, email, asof=None, fetcher=sec_snapshot):
    email = (email or '').strip()
    if not email or '@' not in email or '\n' in email or '\r' in email:
        raise ValueError('Vul eerst een geldig contact-e-mailadres voor de SEC in.')
    if not ticker:
        raise ValueError('Selecteer eerst een aandeel.')
    sec_ticker = sec_ticker_for_listing(ticker)
    result = fetcher(sec_ticker, asof or date.today().isoformat(), email)
    if isinstance(result, dict):
        result = dict(result, beursnotering=ticker, sec_ticker=sec_ticker)
    return ticker, result
