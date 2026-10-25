"""Hulpmiddel (ontwikkeling): omzet, winst vóór belasting, nettowinst (aandeelhouders) en eigen vermogen uit de tekst van
Duitse jaarverslagen (zelfde teksten als hulp/de_eps.py). Gebruik: python hulp/de_cijfers.py tekstmap(de/) uit.json [TICKER...]

Per veld en per verslag de regel met het bedrag voor het boekjaar en het jaar ervoor (kolomvolgorde volgens de jaartallenkop,
eenheid volgens de aanduiding miljoen/miljard/duizend boven de tabel). Alle lezingen in één verslag moeten overeenkomen
(andere afronding telt als dezelfde). Daarna dezelfde keten als bij de winst per aandeel: het vorige jaar uit verslag J moet
aansluiten op jaar J uit verslag J-1 (binnen 0,6%, tot 6% herziening), anders stopt de reeks. Gerapporteerd, niet nagerekend."""
import json, re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import de_eps

VELDEN = {
    'sales': (re.compile(r'^\s*(total\s+)?(revenues?|sales|net\s+sales|sales\s+revenues?|umsatzerl[öo]se|umsatz)\b(?!\s+(growth|per|by|from|in\s+%))', re.I),
              re.compile(r'cost|kosten|growth|wachstum|ver[äa]nderung|change|%|per\s|je\s|share\s+of|anteil|segment|region|other|sonstig|organic|organisch|currency|w[äa]hrung|margin|marge|ratio|quote|days|tage', re.I)),
    'pretax_income': (re.compile(r'^\s*(income|profit|earnings|result)\s+(before|from\s+continuing\s+operations\s+before)\s+(income\s+)?tax(es)?\b|^\s*(konzern)?ergebnis\s+vor\s+(ertrag)?steuern\b|^\s*vorsteuerergebnis\b', re.I),
                      re.compile(r'margin|marge|%|ratio|quote|adjusted|bereinigt|segment|per\s|je\s|interest|zinsen|ebit\b|operating|operativ', re.I)),
    'net_income': (re.compile(r'(net\s+income|profit|net\s+profit|earnings|result)\s+(for\s+the\s+year\s+)?attributable\s+to\s+(the\s+)?(shareholders|owners|equity\s+holders|stockholders)|'
                              r'anteil\s+der\s+aktion[äa]re|auf\s+(die\s+)?aktion[äa]re\s+(der\s+\w+\s+)?entfallend|ergebnis\s+nach\s+steuern\s+der\s+aktion', re.I),
                   re.compile(r'non-?controlling|minderheit|nicht\s+beherrsch|hybrid|per\s|je\s|%|margin|adjusted|bereinigt|continuing|fortgef|discontinued|aufgegeben', re.I)),
    'equity': (re.compile(r'^\s*(total\s+)?(equity|shareholders.?\s+equity|stockholders.?\s+equity)(\s+attributable\s+to\s+(the\s+)?(shareholders|owners|equity\s+holders)\b.*)?\s*$|'
                          r'^\s*(summe\s+)?eigenkapital(\s+gesamt|\s+der\s+aktion[äa]re.*)?\s*$|^\s*equity\s+attributable\s+to\s+(the\s+)?(shareholders|owners)', re.I),
               re.compile(r'ratio|quote|%|return|rendite|per\s|je\s|non-?controlling|minderheit|nicht\s+beherrsch|and\s+liabilities|und\s+schulden|change|ver[äa]nderung|statement|entwicklung', re.I)),
}


def lees_veld(tekst, veld):
    label, niet = VELDEN[veld]
    # het label staat vooraan de regel; de getallen erachter (tot 4 regels lager als het label een kop is, zoals bij de winst per aandeel)
    return de_eps._lees(tekst, None, _Voor(label), niet=niet, maxabs=None, aantal=False)


class _Voor:
    """Label alleen aan het begin van de regel (tekst vóór de getallen), zodat een zin met het woord niet meetelt."""
    def __init__(self, rx):
        self.rx = rx

    def search(self, r):
        m = re.search(r'\S(\s{2,}|\s\|\s)', r)
        kop = r[:m.start() + 1] if m else r
        return self.rx.search(kop.strip())


def main():
    map_, uitpad = Path(sys.argv[1]), sys.argv[2]
    alleen = set(sys.argv[3:])
    index = json.load(open(map_ / 'index.json'))
    uit = {}
    for t, docs in sorted(index.items()):
        if alleen and t not in alleen:
            continue
        teksten = {j: (map_ / t / f'{j}.txt').read_text(encoding='utf-8') for j in docs if (map_ / t / f'{j}.txt').exists()}
        per_veld = {}
        for veld in VELDEN:
            per_jaar = {}
            for j, tekst in teksten.items():
                r, reden = lees_veld(tekst, veld)
                if not r:
                    continue
                r['url'] = docs[j]['url']; r['bestand'] = j
                if r['jaar'] in per_jaar and per_jaar[r['jaar']].get('eps') is not None and r.get('eps') is not None \
                        and abs(per_jaar[r['jaar']]['eps'] - r['eps']) > 0.006 * abs(r['eps']):
                    per_jaar[r['jaar']] = dict(per_jaar[r['jaar']], eps=None, alternatieven=[])   # twee bestanden zeggen iets anders
                    continue
                per_jaar.setdefault(r['jaar'], r)
            reeks, log = de_eps.keten(per_jaar, relatief=True)
            per_veld[veld] = {'reeks': {str(k): v for k, v in reeks.items()}, 'log': log,
                              'verslagen': {str(k): {'url': v.get('url'), 'pagina': v.get('pagina'), 'bewijs': v.get('bewijs')} for k, v in per_jaar.items() if v.get('eps') is not None}}
            print(t, veld, len(reeks), {k: round(v / 1e6) for k, v in reeks.items()}, log[-1:] if log else '', flush=True)
        uit[t] = per_veld
    json.dump(uit, open(uitpad, 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
