"""Hulpmiddel (ontwikkeling): kandidaten voor het gemiddeld aantal aandelen en de nettowinst uit de oudere (pdf-)jaarverslagen
van Nederlandse (AFM), Franse (AMF) en Britse (FCA NSM) fondsen, die al als tekst op de tak jaarverslagen staan (mappen afm/,
fr/, uk/). Gebruik: python hulp/eu_narekenen.py takmap esef_aandelen.json

Zelfde lezer als bij de Duitse verslagen (hulp/de_narekenen.kandidaten en winst_kandidaten). Per fonds en boekjaar J komen de
kandidaten uit het verslag over J én dat over J+1 (vergelijkende cijfers). Ze worden toegevoegd aan esef_aandelen.json
(bestaande ESEF-kandidaten blijven staan); de nachtelijke run rekent na (bouw_webdata.reken_pdf_eps_na)."""
import json, re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import de_narekenen as D


def documenten(map_):
    """{ticker: {boekjaar: (pad, url)}} uit de mappen afm/, fr/, uk/."""
    uit = {}
    for land in ('afm', 'fr', 'uk'):
        for tdir in sorted((map_ / land).glob('*')):
            if not tdir.is_dir():
                continue
            try:
                index = json.loads((tdir / 'index.json').read_text(encoding='utf-8'))
            except (OSError, ValueError):
                index = {}
            for txt in sorted(tdir.glob('*.txt')):
                m = re.match(r'(?:afm|fr|uk)-(\d{4})', txt.name)
                if not m:
                    continue
                jaar = int(m.group(1))
                if isinstance(index, list):
                    meta = next((x for x in index if str(x.get('boekjaar') or x.get('jaar')) == str(jaar)), {})
                else:
                    meta = index.get(txt.stem) or index.get(str(jaar)) or {}
                url = meta.get('url') or meta.get('download') or meta.get('link') if isinstance(meta, dict) else None
                uit.setdefault(tdir.name, {}).setdefault(jaar, (txt, url))
    return uit


def main():
    map_, doelpad = Path(sys.argv[1]), Path(sys.argv[2])
    try:
        doel = json.loads(doelpad.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        doel = {}
    docs = documenten(map_)
    cache = {}

    def lees(pad):
        if pad not in cache:
            t = re.sub(r'(\d)�(\d)', r'\1.\2', pad.read_text(encoding='utf-8', errors='replace'))
            cache.clear()                                          # geheugen: alleen het laatste verslag bewaren
            cache[pad] = (D.kandidaten(t), D.winst_kandidaten(t))
        return cache[pad]

    for t, per in sorted(docs.items()):
        for jaar in sorted(per):
            k_all, w_all, url = [], [], None
            for j2 in (jaar, jaar + 1):
                if j2 not in per:
                    continue
                pad, u = per[j2]
                k, w = lees(pad)
                url = url or u
                k_all += [x for x in k if x['aandelen'] not in {y['aandelen'] for y in k_all}][:12]
                w_all += [x for x in w if x['nettowinst'] not in {y['nettowinst'] for y in w_all}][:30]
            if not k_all:
                continue
            r = doel.setdefault(t, {}).setdefault(str(jaar), {'document': url, 'kandidaten': [], 'nettowinst': []})
            r.setdefault('nettowinst', [])
            bekend = {x['aandelen'] for x in r['kandidaten']}
            r['kandidaten'] += [x for x in k_all if x['aandelen'] not in bekend]
            nb = {x['nettowinst'] for x in r['nettowinst']}
            r['nettowinst'] += [x for x in w_all if x['nettowinst'] not in nb]
            r['document'] = r.get('document') or url
        print(t, sorted(per), file=sys.stderr, flush=True)
    doelpad.write_text(json.dumps(doel, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')


if __name__ == '__main__':
    main()
