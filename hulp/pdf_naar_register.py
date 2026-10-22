"""Zet automatisch uitgelezen cijfers uit officiële jaarverslagen (Frankrijk: info-financiere.gouv.fr; VK: FCA NSM) in jaarverslag_bronnen.json.
   Gebruik: python hulp/pdf_naar_register.py resultaten.json fr|uk"""
import json, re, sys
sys.path.insert(0, __import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), '..'))
REG = __import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), '..', 'jaarverslag_bronnen.json')
LEI = json.load(open(REG.replace('jaarverslag_bronnen.json', 'esef_lei.json')))
res = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'fr_res.json'))
BRON = sys.argv[2] if len(sys.argv) > 2 else 'fr'
PREFIX, REGISTER = {'fr': ('AMF-FR:', 'info-financiere.gouv.fr'), 'uk': ('NSM:', 'FCA National Storage Mechanism')}[BRON]
reg = json.load(open(REG))
import bouw_webdata as bw


def esef_valuta(t):
    cf = bw.esef_ophalen(t) or {}
    units = list((cf.get('facts', {}).get('ifrs-full', {}).get('DilutedEarningsLossPerShare', {}).get('units', {}) or {}).keys())
    return units[0].split('/')[0] if units else 'EUR'


def esef_periode(t, jaar):
    from datetime import date
    cf = bw.esef_ophalen(t) or {}
    for rows in (cf.get('facts', {}).get('ifrs-full', {}).get('DilutedEarningsLossPerShare', {}).get('units', {}) or {}).values():
        for r in rows:
            if r.get('start') and r['end'][:4] == str(jaar) and 350 <= (date.fromisoformat(r['end']) - date.fromisoformat(r['start'])).days <= 380:
                return r['start'], r['end']
    return None


def boekjaar_einde(t):
    """Maand-dag van het boekjaareinde uit de ESEF-cijfers (bijv. '06-30' bij Pernod Ricard)."""
    cf = bw.esef_ophalen(t) or {}
    eindes = [r['end'][5:] for rows in (cf.get('facts', {}).get('ifrs-full', {}).get('DilutedEarningsLossPerShare', {}).get('units', {}) or {}).values() for r in rows]
    return max(set(eindes), key=eindes.count) if eindes else '12-31'
for t, docs in res.items():
    b = reg['bedrijven'].setdefault(t, {'naam': LEI[t]['naam'], 'lei': LEI[t]['lei'], 'vastgelegd': '2026-10-22',
                                         'methode': 'automatisch uitgelezen uit officieel gedeponeerde jaarverslagen; per jaar '
                                                    'gecontroleerd: winst / verwaterd aantal aandelen = gemelde verwaterde winst per aandeel',
                                         'documenten': []})
    for d in docs:
        r = d['doc']
        valuta = esef_valuta(t)
        kenmerk = PREFIX + re.sub(r'\.(pdf|html?|zip)$', '', r['bestand_bron'].split('/')[-1])
        feiten = []
        for jaar, eps, teller, aandelen, pagina, b_aand, b_eps, b_winst in d['res']:
            bron = (f'Jaarverslag {r["boekjaar"]} ({r["titel"][:80]}), officieel register {REGISTER}, pdf p.{pagina}: '
                    f'"{b_aand}" / "{b_eps}" / "{b_winst}"')
            md = boekjaar_einde(t)
            bekend = esef_periode(t, jaar)
            if bekend:                         # 52/53-wekenjaren: de echte periode uit de ESEF-cijfers
                s, e = bekend
            elif md == '12-31':
                s, e = f'{jaar}-01-01', f'{jaar}-12-31'
            else:
                from datetime import date, timedelta
                e = f'{jaar}-{md}'; s = (date.fromisoformat(f'{jaar - 1}-{md}') + timedelta(days=1)).isoformat()
            feiten += [{'concept': 'ifrs-full:DilutedEarningsLossPerShare', 'start': s, 'eind': e, 'waarde': eps, 'eenheid': f'{valuta}/shares', 'bewijs': bron},
                       {'concept': 'ifrs-full:ProfitLossAttributableToOrdinaryEquityHoldersOfParentEntityIncludingDilutiveEffects',
                        'start': s, 'eind': e, 'waarde': float(teller), 'eenheid': valuta, 'bewijs': bron},
                       {'concept': 'ifrs-full:AdjustedWeightedAverageShares', 'start': s, 'eind': e, 'waarde': float(aandelen), 'eenheid': 'shares', 'bewijs': bron}]
        doc = {'document': f'{r["titel"][:80]} (boekjaar {r["boekjaar"]})', 'soort': 'pdf', 'url': r['download'],
               'ingediend': r['registerdatum'][:10], 'ingediend_bron': 'datum in het officiële register (' + REGISTER + ')',
               'kenmerk': kenmerk, 'feiten': feiten}
        b['documenten'] = sorted([x for x in b['documenten'] if x.get('kenmerk') != kenmerk] + [doc], key=lambda x: x.get('ingediend', ''))
    print(t, len(docs))
json.dump(reg, open(REG, 'w'), ensure_ascii=False, indent=1)
