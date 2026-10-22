"""Hulpmiddel voor ontwikkeling: jaarlijkse financiële verslagen van Franse beursfondsen uit het officiële Franse register
(info-financiere.gouv.fr, het 'mécanisme officiel de stockage' van de AMF; open data van de DILA).

Gebruik:  python hulp/fr_jaarverslagen.py uitmap TICKER=LEI ... --jaren 2016-2019
Per bedrijf en per boekjaar één document (bij voorkeur de Engelstalige geconsolideerde jaarrekening, anders het jaarlijks
financieel verslag of het registratiedocument). Opgeslagen als tekst (pdftotext -layout, pagina's gescheiden door \\f) plus
index.json met registerdatum, documentsoort, titel en de officiële downloadlink; de pdf zelf blijft bij de bron."""
import json, os, re, subprocess, sys, time, urllib.parse, urllib.request

API = 'https://www.info-financiere.gouv.fr/api/explore/v2.1/catalog/datasets/flux-amf-new-prod/records?'
BESTAND = 'https://echanges.dila.gouv.fr/OPENDATA/AMF/'
UA = {'User-Agent': 'Mozilla/5.0 (AandeelSignaal research)'}
JAARVERSLAG = ('003000', '002002')                              # jaarlijkse financiële en auditverslagen
REGISTRATIE = tuple(f'30000{i}' for i in range(1, 8))           # document de référence / d'enregistrement universel
VELDEN = ('informationdeposee_inf_dat_emt,informationdeposee_inf_tit_inf,informationdeposee_inf_stp_pri,'
          'fichierdecontenu_inf_fic_nom,identificationsociete_iso_nom_soc,identificationsociete_iso_cd_isi')


def get(url, binair=False):
    for poging in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
                data = r.read()
                return data if binair else json.loads(data)
        except Exception:
            if poging == 2:
                raise
            time.sleep(5)


def zoek(where, select=VELDEN, limit=100):
    return get(API + urllib.parse.urlencode({'where': where, 'limit': limit, 'select': select,
                                             'order_by': 'informationdeposee_inf_dat_emt'})).get('results') or []


def isins(lei):
    rijen = zoek(f'identificationsociete_iso_cd_lei="{lei}"', select='identificationsociete_iso_cd_isi', limit=100)
    tel = {}
    for r in rijen:
        if r.get('identificationsociete_iso_cd_isi'):
            tel[r['identificationsociete_iso_cd_isi']] = tel.get(r['identificationsociete_iso_cd_isi'], 0) + 1
    return sorted(tel, key=tel.get, reverse=True)


def engels(titel):
    t = titel.lower()
    return bool(re.search(r'consolidated|annual|financial statements|registration document|report|pdf version', t)) and \
        not re.search(r'comptes|rapport|document d|version pdf|états', t)


def score(r):
    """Lager is beter: jaarrekening vóór jaarverslag vóór registratiedocument, Engels vóór Frans."""
    soort = r['informationdeposee_inf_stp_pri']
    basis = 0 if soort == '003000' else 1 if soort == '002002' else 2
    return basis * 2 + (0 if engels(r['informationdeposee_inf_tit_inf'] or '') else 1)


def main():
    uit = sys.argv[1]
    paren = [a for a in sys.argv[2:] if '=' in a and not a.startswith('--')]
    if not paren:     # standaard: alle Parijse noteringen met een LEI in esef_lei.json
        lei = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'esef_lei.json')))
        paren = [f'{t}={v["lei"]}' for t, v in sorted(lei.items()) if t.endswith('.PA')]
    j0, j1 = map(int, (sys.argv[sys.argv.index('--jaren') + 1] if '--jaren' in sys.argv else '2016-2019').split('-'))
    for paar in paren:
        ticker, sleutel = [x.strip() for x in paar.split('=', 1)]
        codes = [sleutel] if re.fullmatch(r'[A-Z]{2}[A-Z0-9]{9}\d', sleutel) else isins(sleutel)
        if not codes:
            print(ticker, 'geen ISIN gevonden'); continue
        soorten = ','.join(f'"{s}"' for s in JAARVERSLAG + REGISTRATIE)
        rijen = []
        for isin in codes[:2]:
            rijen += zoek(f'identificationsociete_iso_cd_isi="{isin}" and informationdeposee_inf_stp_pri in ({soorten}) and '
                          f'informationdeposee_inf_dat_emt>="{j0 + 1}-01-01" and informationdeposee_inf_dat_emt<"{j1 + 2}-01-01"')
        rijen = [r for r in rijen if r.get('fichierdecontenu_inf_fic_nom', '').lower().endswith('.pdf')
                 and not re.search(r'mise à disposition|mise a disposition|availability|disponibilit', (r['informationdeposee_inf_tit_inf'] or '').lower())]
        map_ = os.path.join(uit, ticker)
        os.makedirs(map_, exist_ok=True)
        pad_index = os.path.join(map_, 'index.json')
        index = json.load(open(pad_index)) if os.path.exists(pad_index) else []
        al = {x['bestand_bron'] for x in index}
        per_jaar = {}
        for r in rijen:
            datum = r['informationdeposee_inf_dat_emt'][:10]
            boekjaar = int(datum[:4]) - 1 if datum[5:7] <= '09' else int(datum[:4])
            if j0 <= boekjaar <= j1:
                per_jaar.setdefault(boekjaar, []).append(r)
        print(ticker, codes[:2], {j: len(v) for j, v in sorted(per_jaar.items())})
        for boekjaar, kandidaten in sorted(per_jaar.items()):
            r = sorted(kandidaten, key=score)[0]
            naam = r['fichierdecontenu_inf_fic_nom']
            if naam in al:
                continue
            try:
                data = get(BESTAND + naam, binair=True)
            except Exception as exc:
                print('fout', ticker, boekjaar, naam, exc); continue
            pdf = os.path.join(map_, f'fr-{boekjaar}.pdf')
            open(pdf, 'wb').write(data)
            txt = pdf[:-4] + '.txt'
            subprocess.run(['pdftotext', '-layout', pdf, txt], check=False)
            os.remove(pdf)
            index.append({'boekjaar': boekjaar, 'registerdatum': r['informationdeposee_inf_dat_emt'], 'soort': r['informationdeposee_inf_stp_pri'],
                          'titel': r['informationdeposee_inf_tit_inf'], 'bedrijf': r['identificationsociete_iso_nom_soc'],
                          'isin': r['identificationsociete_iso_cd_isi'], 'bestand_bron': naam, 'download': BESTAND + naam,
                          'tekst': os.path.basename(txt), 'grootte_pdf': len(data)})
            print('ok', ticker, boekjaar, r['informationdeposee_inf_stp_pri'], len(data), r['informationdeposee_inf_tit_inf'][:70])
            time.sleep(1)
        json.dump(index, open(pad_index, 'w'), indent=1, ensure_ascii=False)


if __name__ == '__main__':
    main()
