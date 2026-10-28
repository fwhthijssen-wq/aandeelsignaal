"""Hulpmiddel (ontwikkeling): rekent de winst per aandeel uit de Duitse pdf-jaarverslagen na met nettowinst ÷ gemiddeld aantal
aandelen uit hetzelfde verslag. Gebruik: python hulp/de_narekenen.py tekstmap(de/) [TICKER...] > uit.json

Per verslag (boekjaar J) zoeken we de regel met het gewogen gemiddelde aantal aandelen (verwaterd, anders gewoon) en, in de
regels erboven (tot 30), de nettowinst toe te rekenen aan de aandeelhouders. Eenheden komen van de regel zelf (Million €,
1,000, Mio., Tsd., Stück) of uit de kop erboven. Een jaar is nagerekend als nettowinst ÷ aandelen binnen 1% ligt van de winst
per aandeel uit het register (jaarverslag_eps.json, verwaterd) — met zowel de verwaterde als de gewone aandelen als proef.
Uitvoer per fonds: {jaar: {eps, nettowinst, aandelen, verhouding, bewijs: [regels]}}."""
import json, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
NUM = re.compile(r'(?<![\w.,])[-–(]?\d{1,3}(?:[.,\s ]\d{3})+(?:[.,]\d+)?\)?|(?<![\w.,])[-–(]?\d+(?:[.,]\d+)?\)?')

AANDELEN = re.compile(r'(weighted\s+average|average\s+number|gewichtete[nrs]?\s+durchschnitt|durchschnittlich\w*\s+(?:anzahl|zahl)|'
                      r'(?:anzahl|zahl)\s+der\s+(?:im\s+durchschnitt|durchschnittlich)|gewogen|'
                      r'moyen\w*\s+pond[ée]r[ée]|nombre\s+moyen|n[uú]mero\s+medio|medio\s+ponderad|media\s+ponderata|medio\s+ponderato|'
                      r'numero\s+medio|gewogen\s+gemiddeld)', re.I)
AANDELEN2 = re.compile(r'(shares|aktien|stückaktien|actions|acciones|azioni|aandelen|titres)', re.I)
NIET_AANDELEN = re.compile(r'cost\s+of\s+capital|kapitalkosten|tax\s+rate|steuersatz|wacc|zinssatz|interest|maturity|laufzeit|'
                           r'remaining|restlaufzeit|price|preis|kurs|exercise|ausübung|employees|mitarbeiter|treasury\s+shares\s+held', re.I)
VERWATERD = re.compile(r'dilut|verwässert', re.I)
WINST = re.compile(r'(attributable\s+to\s+(?:the\s+)?(?:shareholders|owners|equity\s+holders|stockholders)|'
                   r'net\s+income(?!\s+from\s+(?:continuing|discontinued))|net\s+profit|profit\s+attributable|'
                   r'anteil\s+der\s+aktionäre|aktionären\s+(?:der|zuzurechnen)|anteilseigner|auf\s+die\s+aktionäre|'
                   r'konzernergebnis|jahresüberschuss|periodenergebnis|ergebnis\s+nach\s+steuern)', re.I)
NIET_WINST = re.compile(r'non-?controlling|minderheit|nicht\s+beherrsch|hybrid|per\s+share|je\s+aktie|margin|marge|'
                        r'continuing|fortgeführt|discontinued|aufgegeben|adjusted|bereinigt|%|before|vor\s+steuern|other\s+comprehensive|sonstig', re.I)


def getal(t, komma):
    neg = t.startswith(('(', '-', '–'))
    t = t.strip('()-– ').replace(' ', '').replace(' ', '').replace(' ', '')
    if komma:
        t = t.replace('.', '').replace(',', '.')
    else:
        t = t.replace(',', '')
    try:
        x = float(t)
    except ValueError:
        return None
    return -x if neg else x


def getallen(regel, komma):
    """Getallen na het label (tekst vóór het eerste getal), zonder voetnootcijfers direct achter woorden."""
    m = re.search(r'\s(?=[-–(]?\d)', regel)
    rest = regel[m.start():] if m else ''
    uit = []
    for t in NUM.findall(rest):
        x = getal(t, komma)
        if x is not None:
            uit.append(x)
    return uit


def schaal(regel, boven):
    """Eenheid: eerst op de regel zelf, dan in de 8 regels erboven."""
    for r in [regel] + boven[::-1]:
        l = r.lower()
        if re.search(r'\b(million|millions|mio\.?|mn|€\s*m\b|eur\s*m\b|in\s+millionen)', l):
            return 1e6
        if re.search(r'\b(billion|mrd\.?|bn)\b', l):
            return 1e9
        if re.search(r'(\b1[.,]000\b|thousand|thousands|tsd\.?|tausend|in\s+t\b|€\s*k\b|\bk€)', l):
            return 1e3
        if re.search(r'\b(stück|units|number of shares)\b', l):
            return 1.0
    return None


RUW = re.compile(r'(?<![\w.,])\d{1,3}(?:[.,\s\u00a0\u202f]\d{3}){2,}(?![\d])')   # volledig uitgeschreven aantal (≥ 1.000.000)


def kandidaten(tekst):
    """Alle getallen die het gewogen gemiddelde aantal aandelen kunnen zijn: uitgeschreven aantallen (≥ 10 miljoen) in of vlak
    na een regel over het gemiddelde aantal aandelen, en tabelgetallen met een eenheid (1,000, million, Mio., Tsd.)."""
    regels = tekst.splitlines()
    komma = len(re.findall(r'\d,\d{2}\b', tekst)) > len(re.findall(r'\d\.\d{2}\b', tekst)) * 1.5
    uit = {}
    for i, r in enumerate(regels):
        if not (AANDELEN.search(r) or re.search(r'theoretical\s+shares|theoretische\s+aktien|(?:no\.|number)\s+of\s+shares|anzahl\s+(?:der\s+)?aktien|aktienanzahl|'
                                                r'nombre\s+d.actions|n[uú]mero\s+de\s+acciones|numero\s+(?:di\s+|delle\s+)?azioni|aantal\s+aandelen', r, re.I)) or NIET_AANDELEN.search(r):
            continue
        blok = ' '.join(regels[i:i + 4])
        if not AANDELEN2.search(blok):
            continue
        for t in RUW.findall(blok):
            x = float(re.sub(r'[.,\s\u00a0\u202f]', '', t))       # uitgeschreven aantal: alle scheidingstekens zijn duizendtallen
            if x and 1e7 <= x <= 3e10:
                uit.setdefault(round(x), ' '.join(r.split())[:160])
        if AANDELEN2.search(r):
            fs = schaal(r, regels[max(0, i - 8):i])
            if fs and fs > 1:
                for x in getallen(r, komma)[:3]:
                    if x and float(x).is_integer() and 1990 <= x <= 2035:
                        continue                              # jaartal, geen aantal
                    if x and 1e7 <= x * fs <= 3e10:
                        uit.setdefault(round(x * fs), ' '.join(r.split())[:160])
    return [{'aandelen': k, 'bewijs': v} for k, v in uit.items()]


def winst_kandidaten(tekst):
    """Nettowinst toe te rekenen aan de aandeelhouders, in de regels rond het gemiddeld aantal aandelen (de toelichting bij
    de winst per aandeel staat meestal als één tabel: nettowinst, aantal aandelen, winst per aandeel). Bedragen met eenheid."""
    regels = tekst.splitlines()
    komma = len(re.findall(r'\d,\d{2}\b', tekst)) > len(re.findall(r'\d\.\d{2}\b', tekst)) * 1.5
    uit = {}
    for i, r in enumerate(regels):
        if not (AANDELEN.search(r) and AANDELEN2.search(' '.join(regels[i:i + 2]))) or NIET_AANDELEN.search(r):
            continue
        for k in range(max(0, i - 30), min(len(regels), i + 8)):
            w = regels[k]
            if not WINST.search(w) or NIET_WINST.search(w):
                continue
            f = schaal(w, regels[max(0, k - 10):k])
            for x in getallen(w, komma)[:2]:
                if x is None or (float(x).is_integer() and 1990 <= abs(x) <= 2035):
                    continue
                for ff in ([f] if f and f > 1 else [1e6, 1e3, 1.0]):
                    v = x * ff
                    if 1e7 <= abs(v) <= 2e11:
                        uit.setdefault(round(v), ' '.join(w.split())[:160])
    # daarnaast: tabelregels in het hele verslag die met een duidelijk winstlabel beginnen (winst-en-verliesrekening, kerncijfers)
    for k, w in enumerate(regels):
        st = w.strip()
        lab = re.split(r'\s(?=[-–−(]?\d)', st, 1)[0]                # alleen het label toetsen (niet een %-kolom erachter)
        if not STERK.match(st) or NIET_WINST.search(re.sub(r'attributable to .{0,40}?(shareholders|owners)', '', lab, flags=re.I)):
            continue
        f = schaal(w, regels[max(0, k - 60):k]) or 1e6        # zonder aanduiding: miljoenen (gebruikelijk in deze verslagen)
        if f < 1e3:
            continue
        for x in getallen(w, komma)[:2]:
            if x is None or (float(x).is_integer() and 1990 <= abs(x) <= 2035):
                continue
            v = x * f
            if 1e7 <= abs(v) <= 2e11:
                uit.setdefault(round(v), ' '.join(w.split())[:160])
    return [{'nettowinst': k, 'bewijs': v} for k, v in uit.items()]


# Winstlabels vooraan een tabelregel: nettowinst toe te rekenen aan de aandeelhouders (niet: incl. minderheden).
STERK = re.compile(r'(net\s+income(\s+attributable\s+to\s+(the\s+)?shareholders.*)?\s{2,}|'
                   r'(net\s+)?(profit|income|earnings)\s+(after\s+tax(es)?\s+)?attributable\s+to\s+(the\s+)?([\w.&-]+\s+){0,3}(shareholders|owners|equity\s+holders)|'
                   r'(konzern)?ergebnis\s+(nach\s+steuern\s+)?(der|den)\s+aktionären|anteil\s+der\s+aktionäre|auf\s+(die\s+)?aktionäre\s+\S+\s+entfallend)', re.I)


def main():
    """Per fonds en boekjaar de kandidaten uit het verslag van dat jaar én dat van het jaar erna (vergelijkende, soms herziene cijfers)."""
    map_ = Path(sys.argv[1])
    alleen = set(sys.argv[2:])
    register = json.loads((HERE.parent / 'jaarverslag_eps.json').read_text(encoding='utf-8'))
    index = json.loads((map_ / 'index.json').read_text(encoding='utf-8'))
    uit = {}
    for t, reg in sorted(register.items()):
        if alleen and t not in alleen:
            continue
        docs = index.get(t) or {}
        jaren = sorted(int(j) for j in (reg.get('reeks') or {}))
        per = {}
        for jaar in jaren:
            for naam in [k for k in docs if k.split('-')[0] == str(jaar)] + [k for k in docs if k.split('-')[0] == str(jaar + 1)]:
                pad = map_ / t / f'{naam}.txt'
                if not pad.exists():
                    continue
                tekst = re.sub(r'(\d)\ufffd(\d)', r'\1.\2', pad.read_text(encoding='utf-8', errors='replace'))
                k = kandidaten(tekst)
                if k:
                    per.setdefault(str(jaar), {'document': docs[naam].get('url'), 'kandidaten': [], 'nettowinst': []})
                    bekend = {x['aandelen'] for x in per[str(jaar)]['kandidaten']}
                    per[str(jaar)]['kandidaten'] += [x for x in k if x['aandelen'] not in bekend][:12]
                    nb = {x['nettowinst'] for x in per[str(jaar)]['nettowinst']}
                    per[str(jaar)]['nettowinst'] += [x for x in winst_kandidaten(tekst) if x['nettowinst'] not in nb][:30]
        uit[t] = per
        print(t, f'{len(per)}/{len(jaren)}', file=sys.stderr, flush=True)
    json.dump(uit, sys.stdout, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
