"""Hulpmiddel (ontwikkeling, netwerk: in GitHub Actions): kandidaten voor het gemiddeld aantal aandelen uit de TEKST van
ESEF-jaarverslagen, voor fondsen waarvan het aantal aandelen niet machineleesbaar is (daardoor 'uit jaarverslag' in plaats
van 'bevestigd'). Gebruik: python hulp/esef_aandelen.py uit.json TICKER...

Per rapport (filings.xbrl.org, het leesbare xhtml-jaarverslag): tabellen als regels (cellen gescheiden door twee spaties) en
lopende tekst als alinea's; daarna dezelfde lezer als bij de Duitse pdf's (hulp/de_narekenen.kandidaten). Uitvoer per fonds en
boekjaar (jaar van period_end): {document, kandidaten: [{aandelen, bewijs}]}. Narekenen gebeurt in de nachtelijke run
(bouw_webdata.reken_esef_eps_na) met de officiële nettowinst en winst per aandeel."""
import json, re, sys, tempfile, time
from pathlib import Path

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER)); sys.path.insert(0, str(HIER.parent))
import esef_tekst_eps as E
import de_narekenen as D

X = '{http://www.w3.org/1999/xhtml}'


def tekst_van(pad):
    from lxml import etree
    doc = etree.parse(str(pad), etree.XMLParser(huge_tree=True, recover=True)).getroot()
    regels = []
    for el in doc.iter():
        if el.tag == X + 'tr':
            cellen = [' '.join(''.join(c.itertext()).split()) for c in el if c.tag in (X + 'td', X + 'th')]
            cellen = [c for c in cellen if c]
            if cellen:
                regels.append('  '.join(cellen))
        elif el.tag in (X + 'p', X + 'div', X + 'span') and el.getparent() is not None and not any(a.tag == X + 'tr' for a in el.iterancestors()):
            if el.tag == X + 'p' or (el.text and len(el.text.strip()) > 40):
                t = ' '.join(''.join(el.itertext()).split())
                if t and len(t) < 2000:
                    regels.append(t)
    # dubbele alinea's (div met p erin) eruit
    uit, vorige = [], None
    for r in regels:
        if r != vorige:
            uit.append(r)
        vorige = r
    return '\n'.join(uit)


def main():
    uitpad, tickers = sys.argv[1], sys.argv[2:]
    lei = json.load(open(HIER.parent / 'esef_lei.json'))
    try:
        uit = json.load(open(uitpad))
    except (OSError, ValueError):
        uit = {}
    for t in tickers:
        L = (lei.get(t) or {}).get('lei')
        if not L:
            continue
        per = uit.setdefault(t, {})
        try:
            lijst = E.rapporten(L)
        except Exception as exc:
            print(t, 'fout', exc, flush=True)
            continue
        for a in lijst:
            jaar = str(a['period_end'])[:4]
            if jaar in per:
                continue
            try:
                data = E.get(E.BASE + a['report_url'], binair=True)
                with tempfile.NamedTemporaryFile(suffix='.xhtml') as f:
                    f.write(data); f.flush()
                    tekst = tekst_van(f.name)
                k = D.kandidaten(tekst)
                per[jaar] = {'document': E.BASE + a.get('viewer_url', a['report_url']), 'period_end': a['period_end'], 'kandidaten': k[:15]}
                print(t, jaar, len(k), flush=True)
            except Exception as exc:
                print(t, jaar, 'fout', str(exc)[:120], flush=True)
            time.sleep(1)
        json.dump(uit, open(uitpad, 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
