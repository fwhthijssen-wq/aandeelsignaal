"""Leest een teruggestuurd aanvulsjabloon (hulp/aanvulsjabloon.py) en schrijft de aangevulde cijfers naar aangeleverd_jaarcijfers.json.
Gebruik: python hulp/aangeleverd_inlezen.py ingevuld.xlsx [aangeleverd_jaarcijfers.json]

Alleen de gele cellen (die de app niet had) die nu een getal bevatten. Grijze cellen (cijfers van de app) worden nooit
overgenomen; een correctie in de kolom Opmerking wordt alleen gemeld. Per rij de controles die zonder de rest van de app kunnen:
- winst per aandeel tegen nettowinst ÷ aantal aandelen (binnen 15%); bij Londen een factor 100 (pence) rechtgezet;
  wijkt het meer af, dan vervalt de winst per aandeel van dat jaar (de andere cijfers blijven);
- onmogelijke waarden (omzet, eigen vermogen, bezittingen, aandelen ≤ 0) vervallen.
De vergelijking met de officiële jaren ernaast (eenheid, valuta, sprongen) gebeurt in de nachtelijke run (bouw_webdata.vul_aangeleverd)."""
import json, sys
from collections import Counter
from pathlib import Path

import openpyxl

VELDEN = ['reported_eps', 'comparable_eps', 'sales', 'pretax_income', 'net_income', 'equity', 'shares_diluted',
          'operating_cash_flow', 'capex', 'total_assets', 'total_liabilities']
POSITIEF = {'sales', 'equity', 'shares_diluted', 'total_assets', 'total_liabilities'}
GEEL = 'FFFFFF00'


def getal(x):
    return x if isinstance(x, (int, float)) and not isinstance(x, bool) and x == x else None


def herkomst(wb):
    """(ticker, jaar, veld) -> korte bron uit het tabblad Herkomst; 'alle' geldt voor elk veld van dat jaar."""
    uit = {}
    if 'Herkomst' not in wb.sheetnames:
        return uit
    for r in wb['Herkomst'].iter_rows(min_row=3, values_only=True):
        if not r or not r[0] or str(r[7] or '').startswith('voorbeeld'):
            continue
        try:
            jaar = int(r[1])
        except (TypeError, ValueError):
            continue
        uit[(str(r[0]).strip(), jaar, str(r[2] or 'alle').strip())] = str(r[3] or '').strip()
    return uit


def bron_naam(b):
    b = (b or '').lower()
    if 'eodhd' in b:
        return 'EODHD'
    if 'esef' in b:
        return 'ESEF'
    if 'pdf' in b or 'jaarverslag' in b:
        return 'jaarverslag'
    if 'xls' in b:
        return 'xls'
    return b or 'onbekend'


def eps_controle(ticker, rij, log):
    """Winst per aandeel tegen nettowinst ÷ aandelen. Geeft de (eventueel gecorrigeerde) rij terug."""
    ni, sh = getal(rij.get('net_income')), getal(rij.get('shares_diluted'))
    if not ni or not sh or sh <= 0:
        return
    berekend = ni / sh
    for veld in ('comparable_eps', 'reported_eps'):
        e = getal(rij.get(veld))
        if e is None or e == 0:
            continue
        r = berekend / e
        if 0.85 <= r <= 1.15:
            continue
        if ticker.endswith('.L') and 0.0085 <= r <= 0.0115:
            rij[veld] = round(e / 100, 6)          # in pence opgegeven: de app rekent in ponden
            log['pence'] += 1
            continue
        del rij[veld]
        log['eps_wijkt_af'] += 1


def lees(pad):
    wb = openpyxl.load_workbook(pad)
    ws = wb['Aanvullen']
    kop = [c.value for c in ws[2]]
    assert kop[:5] == ['ticker', 'naam', 'year', 'end', 'currency'], 'Onbekend formaat: tabblad Aanvullen, rij 2 moet de veldnamen bevatten.'
    kolom = {v: kop.index(v) for v in VELDEN}
    bronnen = herkomst(wb)
    log = Counter()
    correcties = []
    uit = {}
    for rij in ws.iter_rows(min_row=3):
        t = rij[0].value
        if not t:
            continue
        t = str(t).strip()
        try:
            jaar = int(rij[2].value)
        except (TypeError, ValueError):
            continue
        opm = rij[kop.index('Opmerking')].value if 'Opmerking' in kop else None
        if opm:
            correcties.append({'ticker': t, 'jaar': jaar, 'opmerking': str(opm)[:300]})
        r = {}
        bron = Counter()
        for v in VELDEN:
            c = rij[kolom[v]]
            if not (c.fill and c.fill.fgColor and str(c.fill.fgColor.rgb)[-6:] == GEEL[-6:]):
                continue                              # grijs: cijfer van de app, nooit overnemen
            x = getal(c.value)
            if x is None:
                if c.value not in (None, ''):
                    log['geen_getal'] += 1
                continue
            if v in POSITIEF and x <= 0:
                log['onmogelijk'] += 1
                continue
            if v == 'capex':
                x = abs(x)                            # de app bewaart investeringen als positief bedrag
            r[v] = x
            bron[bron_naam(bronnen.get((t, jaar, v)) or bronnen.get((t, jaar, 'alle')))] += 1
        if not r:
            continue
        # voor de controle ook de grijze cijfers van die rij gebruiken (nettowinst en aandelen kunnen van de app zijn)
        ctx = dict(r)
        for v in ('net_income', 'shares_diluted'):
            if v not in ctx:
                ctx[v] = getal(rij[kolom[v]].value)
        if 'comparable_eps' in r or 'reported_eps' in r:
            eps_controle(t, ctx, log)
            for v in ('comparable_eps', 'reported_eps'):
                if v in r:
                    if v in ctx:
                        r[v] = ctx[v]
                    else:
                        del r[v]
        if not r:
            continue
        r['end'] = str(rij[3].value or '')[:10]
        r['currency'] = str(rij[4].value or '').strip().upper()
        r['bron'] = bron.most_common(1)[0][0] if bron else 'onbekend'
        uit.setdefault(t, {})[str(jaar)] = r
        log['cellen'] += sum(1 for v in VELDEN if v in r)
    return uit, log, correcties


def samenvoegen(oud, nieuw):
    """Nieuwe aanlevering bij de vorige: per fonds, jaar en veld wint het nieuwe cijfer. Staat het jaar nu in een andere valuta
    (het vorige sjabloon had soms de valuta van de beurs), dan vervalt de vorige rij van dat jaar helemaal."""
    uit = {t: {j: dict(r) for j, r in f.items()} for t, f in (oud or {}).items()}
    for t, f in nieuw.items():
        for j, r in f.items():
            o = uit.setdefault(t, {}).get(j)
            if o is None or (o.get('currency') and r.get('currency') and o['currency'] != r['currency']):
                uit[t][j] = dict(r)
            else:
                o.update(r)
    return uit


CONTROLE_VELDEN = ('comparable_eps', 'sales', 'net_income', 'equity')


def lees_controle(pad):
    """Tabblad Controle: per fonds en jaar de cijfers uit de tweede bron (kolom zonder _app). Leeg = niet vergeleken."""
    wb = openpyxl.load_workbook(pad, read_only=True)
    if 'Controle' not in wb.sheetnames:
        return {}, Counter()
    ws = wb['Controle']
    rijen = ws.iter_rows(values_only=True)
    next(rijen, None)
    kop = list(next(rijen, None) or [])
    kol = {v: kop.index(v) for v in CONTROLE_VELDEN if v in kop}
    uit, log = {}, Counter()
    for r in rijen:
        if not r or not r[0]:
            continue
        try:
            jaar = int(r[2])
        except (TypeError, ValueError):
            continue
        w = {v: getal(r[i]) for v, i in kol.items() if getal(r[i]) is not None}
        if w:
            if str(r[0]).strip().endswith('.L') and 'comparable_eps' in w and getal(r[kop.index('comparable_eps_app')]):
                app = r[kop.index('comparable_eps_app')]
                if 90 <= abs(w['comparable_eps'] / app) <= 110:
                    w['comparable_eps'] = round(w['comparable_eps'] / 100, 6); log['pence'] += 1
            uit.setdefault(str(r[0]).strip(), {})[str(jaar)] = w
            log['cellen'] += len(w)
    return uit, log


def main():
    pad = Path(sys.argv[1])
    root = Path(__file__).resolve().parent.parent
    doel = Path(sys.argv[2]) if len(sys.argv) > 2 else root / 'aangeleverd_jaarcijfers.json'
    data, log, correcties = lees(pad)
    try:
        vorig = json.loads(doel.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        vorig = {}
    alles = samenvoegen(vorig.get('fondsen'), data)
    bronnen = Counter(r['bron'] for f in alles.values() for r in f.values())
    uit = {'uitleg': 'Jaarcijfers aangeleverd door de gebruiker via het aanvulsjabloon (gele cellen). Niet gecontroleerd tegen het jaarverslag. '
                     'Alleen gaten worden gevuld; officiële cijfers gaan altijd voor. Elke nieuwe aanlevering komt bij de vorige (nieuw wint).',
           'bestanden': (vorig.get('bestanden') or ([vorig['bestand']] if vorig.get('bestand') else [])) + [pad.name],
           'bronnen': dict(bronnen), 'controle': dict(log), 'correcties': (vorig.get('correcties') or []) + correcties, 'fondsen': alles}
    doel.write_text(json.dumps(uit, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('aanvulling:', len(data), 'fondsen,', log['cellen'], 'nieuwe cellen;', dict(log), '| totaal', len(alles), 'fondsen;', len(correcties), 'opmerkingen')
    ctl, clog = lees_controle(pad)
    if ctl:
        tdoel = root / 'tweede_bron.json'
        try:
            tvorig = json.loads(tdoel.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            tvorig = {}
        tf = {t: {j: dict(r) for j, r in f.items()} for t, f in (tvorig.get('fondsen') or {}).items()}
        for t, f in ctl.items():
            for j, r in f.items():
                tf.setdefault(t, {}).setdefault(j, {}).update(r)
        bron = bronnen.most_common(1)[0][0] if bronnen else 'tweede bron'
        tdoel.write_text(json.dumps({'bron': bron, 'uitleg': 'Controlecijfers uit een tweede bron, aangeleverd door de gebruiker (tabblad Controle). Alleen vergeleken, nooit gebruikt.',
                                     'fondsen': tf}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        print('controle:', len(ctl), 'fondsen,', dict(clog))


if __name__ == '__main__':
    main()
