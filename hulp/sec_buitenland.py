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


def kandidaten(email):
    per_jaar = {'CY2024': {}, 'CY2023': {}}
    for jaar, uit in per_jaar.items():
        for taks, tag, munten in (('ifrs-full', 'Revenue', VALUTA), ('us-gaap', 'Revenues', [v for v in VALUTA if v != 'USD']),
                                  ('us-gaap', 'RevenueFromContractWithCustomerExcludingAssessedTax', [v for v in VALUTA if v != 'USD'])):
            for munt in munten:
                d = haal(f'https://data.sec.gov/api/xbrl/frames/{taks}/{tag}/{munt}/{jaar}.json', email)
                time.sleep(0.12)
                for x in (d or {}).get('data', []):
                    usd = x['val'] * NAAR_USD.get(munt, 0)
                    if x['cik'] not in uit or usd > uit[x['cik']]['omzet_usd']:
                        uit[x['cik']] = {'cik': x['cik'], 'naam': x.get('entityName'), 'omzet': x['val'], 'munt': munt, 'omzet_usd': round(usd), 'jaar': jaar, 'taxonomie': taks}
        print(jaar, len(uit), 'bedrijven met omzet', flush=True)
    alle = dict(per_jaar['CY2023']); alle.update(per_jaar['CY2024'])        # 2024 gaat voor
    return {c: v for c, v in alle.items() if v['omzet_usd'] >= MIN_OMZET_USD}


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
    groot = kandidaten(email)
    print(len(groot), 'met omzet van minstens 5 miljard dollar', flush=True)
    rijen = []
    for n, (cik, k) in enumerate(sorted(groot.items(), key=lambda x: -x[1]['omzet_usd'])):
        sub = haal(f'https://data.sec.gov/submissions/CIK{cik:010d}.json', email) or {}
        time.sleep(0.12)
        facts = haal(f'https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json', email)
        time.sleep(0.12)
        formulieren = sub.get('filings', {}).get('recent', {}).get('form', [])
        soort = next((f for f in formulieren if f in ('20-F', '40-F', '10-K')), None)
        adres = (sub.get('addresses') or {}).get('business') or {}
        ej = eps_jaren(facts)
        jaren = sorted(ej)
        laatste10 = [j for j in jaren if j >= (jaren[-1] - 9)] if jaren else []
        rijen.append(dict(k, land=adres.get('stateOrCountryDescription'), tickers=sub.get('tickers') or [], beurzen=sub.get('exchanges') or [],
                          sic=sub.get('sicDescription'), jaarverslag=soort, eps_jaren=len(jaren), eerste=jaren[0] if jaren else None,
                          laatste=jaren[-1] if jaren else None, laatste10=len(laatste10),
                          eps_munt=(ej[jaren[-1]]['unit'] if jaren else None), eps=ej))
        if n % 25 == 0:
            print(n, k['naam'], len(jaren), flush=True)
    buiten = [r for r in rijen if r['jaarverslag'] in ('20-F', '40-F') or (r['land'] and r['land'] not in (
        'DE', 'NY', 'CA', 'TX', 'WA', 'IL', 'MA', 'NJ', 'OH', 'GA', 'FL', 'PA', 'VA', 'MN', 'NC', 'MI', 'CO', 'CT', 'MO', 'IN', 'WI', 'TN', 'AZ', 'MD', 'OR', 'NV', 'UT', 'KY', 'OK', 'LA', 'AR', 'IA', 'NE', 'KS', 'AL', 'SC', 'ID', 'DC', 'RI', 'NH', 'ME', 'VT', 'MS', 'NM', 'WV', 'HI', 'AK', 'MT', 'ND', 'SD', 'WY'))]
    (uitmap / 'sec_buitenland.json').write_text(json.dumps({'gemaakt': date.today().isoformat(), 'bedrijven': buiten}, ensure_ascii=False, indent=1), encoding='utf-8')
    regels = ['| Bedrijf | Land | Beurscodes | Verslag | Omzet (mld USD) | EPS-jaren (laatste 10) | Periode | EPS in |', '|---|---|---|---|---|---|---|---|']
    for r in sorted(buiten, key=lambda r: -r['omzet_usd']):
        regels.append(f"| {r['naam']} | {r['land'] or ''} | {' '.join(f'{t} ({b})' for t, b in zip(r['tickers'], r['beurzen']))} | {r['jaarverslag'] or ''} | "
                      f"{r['omzet_usd'] / 1e9:.0f} | {r['eps_jaren']} ({r['laatste10']}) | {r['eerste'] or ''}–{r['laatste'] or ''} | {r['eps_munt'] or ''} |")
    (uitmap / 'sec_buitenland.md').write_text('\n'.join(regels) + '\n', encoding='utf-8')
    print('klaar:', len(buiten), 'buitenlandse bedrijven,', sum(1 for r in buiten if r['laatste10'] >= 10), 'met 10 jaar winst per aandeel')


if __name__ == '__main__':
    main()
