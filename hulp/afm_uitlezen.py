"""Hulpmiddel (ontwikkeling): AFM-jaarverslagen (tak jaarverslagen, map afm/) automatisch uitlezen met pdf_uitlezen en
het resultaat klaarzetten voor pdf_naar_register.py (bron 'afm').
Gebruik: python hulp/afm_uitlezen.py <map afm> resultaten.json TICKER ..."""
import json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdf_uitlezen import uitlezen

MAAND = {'jan': 1, 'feb': 2, 'mrt': 3, 'apr': 4, 'mei': 5, 'jun': 6, 'jul': 7, 'aug': 8, 'sep': 9, 'okt': 10, 'nov': 11, 'dec': 12}


def iso(dep):
    m = re.match(r'(\d{1,2}) (\w{3}) (\d{4})', dep or '')
    return f'{m.group(3)}-{MAAND.get(m.group(2).lower(), 1):02d}-{int(m.group(1)):02d}' if m else ''


def main():
    afm, uit, tickers = sys.argv[1], sys.argv[2], sys.argv[3:]
    res, log = {}, []
    for t in tickers:
        idx = os.path.join(afm, t, 'index.json')
        if not os.path.exists(idx):
            log.append(f'{t}: geen verslagen'); continue
        for d in json.load(open(idx)):
            pad = os.path.join(afm, t, d['bestand'])
            if not pad.lower().endswith('.pdf') or not os.path.exists(pad):
                continue
            try:
                tekst = subprocess.run(['pdftotext', '-layout', pad, '-'], capture_output=True, text=True, timeout=300).stdout
            except Exception as exc:
                log.append(f'{t} {d["boekjaar"]}: pdftotext mislukt'); continue
            r, reden = uitlezen(tekst, int(d['boekjaar']))
            if not r:
                log.append(f'{t} {d["boekjaar"]}: niet uitgelezen ({reden})'); continue
            res.setdefault(t, []).append({'doc': {'bestand_bron': d['bestand'], 'boekjaar': d['boekjaar'], 'titel': f'Jaarlijkse financiële verslaggeving {d["bedrijf"]}',
                                                  'download': d.get('detail') or d['download'], 'registerdatum': iso(d.get('deponering'))}, 'res': r})
            log.append(f'{t} {d["boekjaar"]}: ' + ', '.join(f'{x[0]}: {x[1]}' for x in r))
    json.dump(res, open(uit, 'w'), ensure_ascii=False, indent=1)
    print('\n'.join(log))


if __name__ == '__main__':
    main()
