"""Hulpmiddel (ontwikkeling): dividend per aandeel uit de tekst van de Duitse jaarverslagen (zelfde teksten als hulp/de_eps.py),
om het dividend van Yahoo Finance te controleren. Gebruik: python hulp/de_dividend.py tekstmap(de/) uit.json

Per verslag de regel 'Dividend per share' / 'Dividende je Aktie' met het (voorgestelde) dividend over het boekjaar en het jaar
ervoor, kolomvolgorde volgens de jaartallenkop; daarna dezelfde keten als bij de winst per aandeel (vergelijkend cijfer in het
volgende verslag). Het dividend over boekjaar J wordt in J+1 uitgekeerd; de nachtelijke run vergelijkt het daarom met het
dividend dat Yahoo in boekjaar J+1 telt (bouw_webdata.vergelijk_dividend)."""
import json, re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import de_eps

LABEL = re.compile(r'^\s*(proposed\s+)?dividends?\s+per\s+(ordinary\s+|common\s+)?share|^\s*dividende?\s+je\s+(stamm)?aktie|^\s*dividend\s+\(€?\s*per\s+share', re.I)
NIET = re.compile(r'yield|rendite|payout|ausschüttungsquote|total|summe|growth|wachstum|special|sonder|preferred|vorzug|%', re.I)


def main():
    map_, uitpad = Path(sys.argv[1]), sys.argv[2]
    index = json.load(open(map_ / 'index.json'))
    uit = {}
    for t, docs in sorted(index.items()):
        per_jaar = {}
        for j, meta in docs.items():
            tekst = re.sub(r'(\d)�(\d)', r'\1.\2', (map_ / t / f'{j}.txt').read_text(encoding='utf-8'))
            r, reden = de_eps._lees(tekst, None, LABEL, niet=NIET, maxabs=100)
            if r and r.get('eps') is not None and r['jaar'] not in per_jaar:
                r['url'] = meta['url']; per_jaar[r['jaar']] = r
        reeks, log = de_eps.keten(per_jaar)
        reeks = {k: v for k, v in reeks.items() if v is not None and 0 < v < 100}
        uit[t] = {'reeks': {str(k): v for k, v in reeks.items()}, 'log': log,
                  'verslagen': {str(k): {'url': v.get('url'), 'pagina': v.get('pagina'), 'bewijs': v.get('bewijs')} for k, v in per_jaar.items()}}
        print(t, len(reeks), reeks, file=sys.stderr, flush=True)
    json.dump(uit, open(uitpad, 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
