"""Maandelijkse controle op wijzigingen bij fondsen (naam, beurscode, notering).
Gebruik: python fondsen_controle.py aandelen.json rapport.md
- fonds zonder koers, of met een koers ouder dan 7 dagen → mogelijk van de beurs, nieuwe code of een storing;
- naam bij Yahoo die niets gemeen heeft met de naam in de catalogus → mogelijk een naamswijziging of overname;
- code die Yahoo niet (meer) als aandeel kent.
Schrijft een rapport in Markdown en zet ::warning-regels; de workflow maakt er een GitHub-melding (issue) van."""
import json, re, sys, time, unicodedata
from datetime import date, timedelta

STOP = {'nv', 'n', 'v', 'sa', 'se', 'ag', 'plc', 'spa', 's', 'p', 'a', 'group', 'groep', 'holding', 'holdings', 'the', 'and', 'de', 'of',
        'inc', 'corp', 'corporation', 'company', 'co', 'ltd', 'limited', 'kgaa', 'oyj', 'ab', 'asa', 'bv', 'b', 'international', 'koninklijke',
        'royal', 'class', 'cl', 'ordinary', 'shares', 'voorheen'}


def woorden(t):
    t = unicodedata.normalize('NFKD', str(t or '')).encode('ascii', 'ignore').decode().lower()
    return {w for w in re.split(r'[^a-z0-9]+', t) if len(w) > 1 and w not in STOP}


def naam_past(catalogus, yahoo):
    a, b = woorden(catalogus), woorden(yahoo)
    if not a or not b:
        return True
    if a & b:
        return True
    # afkortingen (bijv. 'ASML', 'KPN') of samengestelde namen: een woord dat in het andere zit
    return any(x in y or y in x for x in a for y in b if min(len(x), len(y)) >= 3)


def controle(aandelen, vandaag, info_ophalen):
    grens = (date.fromisoformat(vandaag) - timedelta(days=7)).isoformat()
    meldingen = []
    for rec in aandelen:
        t, naam, k = rec['ticker'], rec.get('naam', ''), rec.get('koers') or {}
        if not k.get('datum'):
            meldingen.append((t, naam, 'geen koers'))
        elif k['datum'] < grens:
            meldingen.append((t, naam, f"laatste koers van {k['datum']}"))
        try:
            info = info_ophalen(t) or {}
        except Exception as exc:
            info = {'fout': str(exc)[:80]}
        yn = info.get('longName') or info.get('shortName')
        if info.get('fout') or (not yn and not info.get('quoteType')):
            meldingen.append((t, naam, 'Yahoo kent deze code niet (meer)'))
        elif info.get('quoteType') and info['quoteType'] not in ('EQUITY', 'ETF'):
            meldingen.append((t, naam, f"Yahoo noemt dit {info['quoteType']}"))
        elif yn and not naam_past(naam, yn):
            meldingen.append((t, naam, f'naam bij Yahoo: {yn}'))
    return meldingen


def yahoo_info(t):
    import yfinance as yf
    time.sleep(0.4)
    i = yf.Ticker(t).info or {}
    return {k: i.get(k) for k in ('longName', 'shortName', 'quoteType', 'exchange')}


def main():
    data = json.load(open(sys.argv[1], encoding='utf-8'))
    vandaag = date.today().isoformat()
    m = controle(data.get('aandelen') or [], vandaag, yahoo_info)
    regels = [f'# Fondsencontrole {vandaag}', '', f"{len(data.get('aandelen') or [])} fondsen gecontroleerd; {len(m)} aandachtspunten.", '']
    if m:
        regels += ['| Code | Naam in de app | Wat opviel |', '|---|---|---|'] + [f'| {t} | {n} | {w} |' for t, n, w in m]
        regels += ['', 'Mogelijk een naamswijziging, overname, nieuwe beurscode of een tijdelijke storing bij Yahoo. Claude kan dit uitzoeken en de catalogus bijwerken.']
    open(sys.argv[2], 'w', encoding='utf-8').write('\n'.join(regels) + '\n')
    for t, n, w in m:
        print(f'::warning title=Fondsencontrole {t}::{n}: {w}')
    print(f'::notice title=Fondsencontrole::{len(m)} aandachtspunten')


if __name__ == '__main__':
    main()
