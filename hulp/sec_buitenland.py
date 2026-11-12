"""Onderzoek (ontwikkeling): grote niet-Amerikaanse bedrijven met jaarcijfers in XBRL bij de SEC (20-F / 40-F).

Gebruik: python hulp/sec_buitenland.py contact@adres uitmap
  1. XBRL-frames per valuta: wie rapporteerde omzet in IFRS (ifrs-full:Revenue) of in US-GAAP in een andere valuta
     dan de dollar, over kalenderjaar 2024 (anders 2023);
  2. alleen omzet van minstens 5 miljard dollar (grove vaste koersen; het gaat om de orde van grootte);
  3. per bedrijf: de gegevens van de SEC (land, beurscodes, soort jaarverslag) en de verwaterde winst per aandeel per
     boekjaar uit de jaarverslagen (20-F, 40-F, 10-K).
Schrijft uitmap/sec_buitenland.json en uitmap/sec_buitenland.md. Gaat niet naar de app."""
import json, sys, time
from datetime import date
from pathlib import Path
from urllib.request import Request, urlopen

VALUTA = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'DKK', 'SEK', 'NOK', 'TWD', 'KRW', 'AUD', 'HKD', 'CNY', 'INR',
          'BRL', 'MXN', 'ZAR', 'ILS', 'SGD', 'CLP', 'COP', 'ARS', 'IDR', 'PHP', 'TRY', 'RUB', 'PEN']
NAAR_USD = {'USD': 1, 'EUR': 1.08, 'GBP': 1.27, 'JPY': 0.0066, 'CHF': 1.13, 'CAD': 0.73, 'DKK': 0.145, 'SEK': 0.095,
            'NOK': 0.093, 'TWD': 0.031, 'KRW': 0.00073, 'AUD': 0.66, 'HKD': 0.128, 'CNY': 0.139, 'INR': 0.012,
            'BRL': 0.18, 'MXN': 0.055, 'ZAR': 0.054, 'ILS': 0.27, 'SGD': 0.74, 'CLP': 0.00105, 'COP': 0.00024,
            'ARS': 0.001, 'IDR': 0.000063, 'PHP': 0.0173, 'TRY': 0.03, 'RUB': 0.011, 'PEN': 0.27}
MIN_OMZET_USD = 5e9
EPS_TAGS = [('ifrs-full', 'DilutedEarningsLossPerShare'), ('ifrs-full', 'BasicEarningsLossPerShare'),
            ('us-gaap', 'EarningsPerShareDiluted'), ('us-gaap', 'EarningsPerShareBasic')]
JAARFORMULIEREN = ('20-F', '20-F/A', '40-F', '40-F/A', '10-K', '10-K/A')


def haal(url, email):
    for poging in range(4):
        try:
            req = Request(url, headers={'User-Agent': f'AandeelSignaal Research {email}', 'Accept': 'application/json'})
            with urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as exc:
            if getattr(exc, 'code', None) == 404:
                return None
            time.sleep(2 * (poging + 1))
    return None


def haal_tekst(url, email):
    for poging in range(4):
        try:
            req = Request(url, headers={'User-Agent': f'AandeelSignaal Research {email}'})
            with urlopen(req, timeout=60) as r:
                return r.read().decode('latin-1')
        except Exception:
            time.sleep(3 * (poging + 1))
    return ''


def kandidaten(email):
    """Alle bedrijven die in 2024-2025 een 20-F of 40-F indienden (EDGAR-index per kwartaal)."""
    uit = {}
    for jaar in (2024, 2025):
        for kw in (1, 2, 3, 4):
            t = haal_tekst(f'https://www.sec.gov/Archives/edgar/full-index/{jaar}/QTR{kw}/form.idx', email)
            time.sleep(0.2)
            for regel in t.splitlines():
                vorm = regel[:12].strip()
                if vorm in ('20-F', '40-F'):
                    delen = regel[12:].split()
                    try:
                        cik = int(next(x for x in reversed(delen) if x.isdigit() and len(x) < 11))
                    except StopIteration:
                        continue
                    uit[cik] = {'cik': cik, 'naam': regel[12:74].strip(), 'jaarverslag_index': vorm}
    print(len(uit), 'bedrijven met een 20-F of 40-F in 2024-2025', flush=True)
    return uit


OMZET_TAGS = [('ifrs-full', 'Revenue'), ('ifrs-full', 'RevenueFromContractsWithCustomers'), ('us-gaap', 'Revenues'),
              ('us-gaap', 'RevenueFromContractWithCustomerExcludingAssessedTax'), ('ifrs-full', 'RevenueAndOperatingIncome'),
              ('ifrs-full', 'InterestIncome'), ('us-gaap', 'InterestAndDividendIncomeOperating')]


def omzet(facts):
    """Laatste jaaromzet (of rentebaten bij banken) uit een jaarverslag, met valuta."""
    best = None
    for taks, tag in OMZET_TAGS:
        units = (((facts or {}).get('facts') or {}).get(taks) or {}).get(tag, {}).get('units') or {}
        for unit, rijen in units.items():
            for r in rijen:
                if r.get('form') not in JAARFORMULIEREN or not r.get('start') or not r.get('end'):
                    continue
                if not 340 <= (date.fromisoformat(r['end']) - date.fromisoformat(r['start'])).days <= 380:
                    continue
                if best is None or r['end'] > best[0] or (r['end'] == best[0] and r['val'] * NAAR_USD.get(unit, 0) > best[1] * NAAR_USD.get(best[2], 0)):
                    best = (r['end'], r['val'], unit)
        if best:
            return best
    return None


def eps_jaren(facts):
    """Per boekjaar (jaar van het einde) de verwaterde (anders gewone) winst per aandeel uit jaarverslagen."""
    beste = {}
    for taks, tag in EPS_TAGS:
        units = (((facts or {}).get('facts') or {}).get(taks) or {}).get(tag, {}).get('units') or {}
        for unit, rijen in units.items():
            for r in rijen:
                if r.get('form') not in JAARFORMULIEREN or not r.get('start') or not r.get('end'):
                    continue
                dagen = (date.fromisoformat(r['end']) - date.fromisoformat(r['start'])).days
                if not 340 <= dagen <= 380:
                    continue
                j = int(r['end'][:4])
                if j not in beste:
                    beste[j] = {'eps': r['val'], 'unit': unit, 'tag': tag, 'form': r['form'], 'end': r['end']}
        if beste:
            break                      # de eerste soort die er is (verwaterd gaat voor gewoon)
    return dict(sorted(beste.items()))


def main():
    email, uitmap = sys.argv[1], Path(sys.argv[2])
    uitmap.mkdir(parents=True, exist_ok=True)
    alle = kandidaten(email)
    rijen = []
    for n, (cik, k) in enumerate(sorted(alle.items())):
        facts = haal(f'https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json', email)
        time.sleep(0.11)
        o = omzet(facts)
        if not o or o[1] * NAAR_USD.get(o[2], 0) < MIN_OMZET_USD:
            continue
        sub = haal(f'https://data.sec.gov/submissions/CIK{cik:010d}.json', email) or {}
        time.sleep(0.11)
        adres = (sub.get('addresses') or {}).get('business') or {}
        ej = eps_jaren(facts)
        jaren = sorted(ej)
        laatste10 = [j for j in jaren if j >= (jaren[-1] - 9)] if jaren else []
        rijen.append(dict(k, naam=sub.get('name') or k['naam'], land=adres.get('stateOrCountryDescription'), tickers=sub.get('tickers') or [],
                          beurzen=sub.get('exchanges') or [], sic=sub.get('sicDescription'), jaarverslag=k['jaarverslag_index'],
                          omzet=o[1], munt=o[2], omzet_usd=round(o[1] * NAAR_USD.get(o[2], 0)), omzet_einde=o[0],
                          eps_jaren=len(jaren), eerste=jaren[0] if jaren else None, laatste=jaren[-1] if jaren else None,
                          laatste10=len(laatste10), eps_munt=(ej[jaren[-1]]['unit'] if jaren else None), eps=ej))
        if n % 50 == 0:
            print(n, len(rijen), flush=True)
    buiten = rijen
    (uitmap / 'sec_buitenland.json').write_text(json.dumps({'gemaakt': date.today().isoformat(), 'bedrijven': buiten}, ensure_ascii=False, indent=1), encoding='utf-8')
    regels = ['| Bedrijf | Land | Beurscodes | Verslag | Omzet (mld USD) | EPS-jaren (laatste 10) | Periode | EPS in | Sector |', '|---|---|---|---|---|---|---|---|---|']
    for r in sorted(buiten, key=lambda r: -r['omzet_usd']):
        regels.append(f"| {r['naam']} | {r['land'] or ''} | {' '.join(f'{t} ({b})' for t, b in zip(r['tickers'], r['beurzen']) if b != 'OTC')} | {r['jaarverslag'] or ''} | "
                      f"{r['omzet_usd'] / 1e9:.0f} | {r['eps_jaren']} ({r['laatste10']}) | {r['eerste'] or ''}–{r['laatste'] or ''} | {r['eps_munt'] or ''} | {r['sic'] or ''} |")
    (uitmap / 'sec_buitenland.md').write_text('\n'.join(regels) + '\n', encoding='utf-8')
    print('klaar:', len(buiten), 'buitenlandse bedrijven,', sum(1 for r in buiten if r['laatste10'] >= 10), 'met 10 jaar winst per aandeel')


if __name__ == '__main__':
    main()
