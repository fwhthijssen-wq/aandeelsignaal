"""Automatisch uitlezen van winst per aandeel uit de tekst van een pdf-jaarverslag (pdftotext -layout).

Per jaarverslag (boekjaar J, kolommen J en J-1) zoeken we drie soorten regels:
  - verwaterde winst per aandeel ('dilut' + 'per share'/'par action'), twee kleine getallen;
  - gewogen gemiddeld aantal verwaterde aandelen ('dilut' + 'shares'/'actions'/'number'), twee grote getallen;
  - winst toekomend aan aandeelhouders ('attributable'/'part du groupe'/'net income/profit'), twee getallen.
Een combinatie telt alleen als voor BEIDE jaren winst × schaal / aandelen × schaal de gemelde winst per aandeel op een
halve cent geeft (dezelfde toets als de controle) en als er precies één zo'n combinatie is (afgezien van gelijke
waarden). Geen of meer dan één passende combinatie: niets (met de hand bekijken)."""
import re

NUM = re.compile(r'\(?[-–]?\s?\d{1,3}(?:[ ,.  ]\d{3})+(?:[.,]\d+)?\)?|\(?[-–]?\s?\d+(?:[.,]\d+)?\)?')


def getal(tok, decimaal_komma=False):
    t = tok.strip()
    neg = t.startswith('(') or t.lstrip('(').startswith(('-', '–'))
    t = re.sub(r'[()\-–\s  ]', '', t)
    if decimaal_komma:
        if re.fullmatch(r'\d{1,3}(\.\d{3})+(,\d+)?', t): t = t.replace('.', '').replace(',', '.')
        else: t = t.replace(',', '.')
    else:
        if re.fullmatch(r'\d{1,3}(,\d{3})+(\.\d+)?', t): t = t.replace(',', '')
        elif re.fullmatch(r'\d{1,3}(\.\d{3})+', t): t = t.replace('.', '')
        elif re.fullmatch(r'\d+,\d{1,2}', t): t = t.replace(',', '.')
    try:
        v = float(t)
    except ValueError:
        return None
    return -v if neg else v


def getallen(regel, komma):
    """Getallen rechts van het label (na de eerste twee spaties of '|')."""
    m = re.search(r'\S(\s{2,}|\s\|\s)', regel)
    rest = regel[m.end():] if m else regel
    uit = []
    for tok in NUM.findall(rest):
        g = getal(tok, komma)
        if g is not None and not (1990 <= abs(g) <= 2035 and float(g).is_integer() and len(uit) == 0 and False):
            uit.append(g)
    return uit


def _eenheid(x):
    for u in (1e9, 1e6, 1e3):
        if x and x % u == 0: return u
    return 1.0


def decimalen(x):
    t = repr(float(x))
    return 0 if t.endswith('.0') else len(t.split('.')[1]) if '.' in t and 'e' not in t else 2


def past(teller, aandelen, eps, teller_eenheid=None, eps_tol=0.0055):
    if not aandelen or aandelen <= 0: return False
    ut, ua = max(_eenheid(teller), teller_eenheid or 0) / 2, _eenheid(aandelen) / 2
    lo = (teller - ut) / (aandelen + ua); hi = (teller + ut) / max(aandelen - ua, 1e-9)
    lo, hi = min(lo, hi), max(lo, hi)
    return lo - eps_tol <= eps <= hi + eps_tol


EPS_LABEL = re.compile(r'dilut|verwater|dilu[ée]', re.I)
PER_AANDEEL = re.compile(r'per (ordinary |common )?share|par action|per (gewoon )?aandeel|\(in (€|eur|euros?)\)', re.I)
AANDELEN = re.compile(r'(number|average|nombre|aantal|weighted|gewogen).{0,80}(shares|actions|aandelen)|(shares|actions|aandelen).{0,40}(dilut|dilu|verwater)', re.I)
WINST = re.compile(r'^\s*earnings\s{2,}|^\s*profit for the (year|period)\b|attributable|part du groupe|group share|toe te rekenen|toekomend|net (income|profit|result)|résultat net|'
                   r'profit (for the (year|period) )?attributable|earnings attributable|nettoresultaat|nettowinst', re.I)


AANGEPAST = re.compile(r'before|excluding|adjusted|underlying|continuing|discontinued|recurring|core|normali|pro forma|'
                       r'voor amortisatie|exclusief|voortgezet|hors |courant|ajust|avant |activités poursuivies|cash', re.I)


def kolommen(regels, i):
    """Jaartallenkop boven regel i: (2019, 2018) of (2018, 2019), of None."""
    for j in range(i, max(0, i - 60), -1):
        m = re.findall(r'(?<!\d)(20[0-3]\d)(?!\d)', regels[j][1])
        paren = [(int(a), int(b)) for a, b in zip(m, m[1:]) if abs(int(a) - int(b)) == 1]
        if paren:
            return paren[0]
    return None


GETALREGEL = re.compile(r'^\s*\(?[-–]?[£$€]?\s?\d[\d,.\u00a0 ]*[p%c]?\)?\s*$')


def cellen_samenvoegen(tekst):
    """Html-tabellen (één cel per regel): een label gevolgd door regels met alleen een getal wordt één tabelregel."""
    regels = tekst.split('\n'); uit = []; i = 0
    while i < len(regels):
        r = regels[i]; j = i + 1; extra = []
        if re.search(r'[A-Za-z]{3}', r) and not re.search(r'\d', r.split('  ')[-1] if '  ' in r.strip() else ''):
            while j < len(regels) and len(extra) < 6:
                if not regels[j].strip() or regels[j].strip() == '\f':
                    j += 1; continue
                if GETALREGEL.match(regels[j].replace('\f', '')):
                    extra.append(regels[j].strip()); j += 1; continue
                break
        if len(extra) >= 2:
            uit.append(r.rstrip() + '    ' + '    '.join(extra)); i = j
        else:
            uit.append(r); i += 1
    return '\n'.join(uit)


def regels_met(tekst):
    pagina = 1
    for r in tekst.split('\n'):
        pagina += r.count('\f')
        yield pagina, r.replace('\f', '')


def uitlezen(tekst, jaar, komma=None, hint=None):
    """[(jaar, eps, teller, aandelen, pagina, bewijs)] voor jaar en jaar-1, of (None, reden)."""
    if komma is None:
        komma = len(re.findall(r'\d,\d{2}\b', tekst)) > len(re.findall(r'\d\.\d{2}\b', tekst)) * 1.5
    if len(re.findall(r'\n\s*[\d,.()]+p?\s*\n', tekst)) > 200:   # veel losse getalregels: tabel met één cel per regel
        tekst = cellen_samenvoegen(tekst)
    regels = list(regels_met(tekst))
    eps_r, aand_r, winst_r = [], [], []
    for i, (p, r) in enumerate(regels):
        ctx = ' '.join(x for _, x in regels[max(0, i - 1):i + 1])
        g = getallen(r, komma)
        if len(g) < 2 and re.search(r'[A-Za-z]{3}', r):          # label loopt door: getallen op de volgende regel
            for j in (i + 1, i + 2):
                volgende = regels[j][1] if j < len(regels) else ''
                letters = re.sub(r'[\d\s.,()\-–£$€p]', '', volgende)
                if j < len(regels) and (not re.search(r'[A-Za-z]{4}', volgende) or len(letters) <= 30):
                    g2 = getallen(' x  ' + re.sub(r'^[^\d(\-–]*', '', volgende.strip()), komma)
                    if len(g2) >= 2:
                        g = g2; break
        if len(g) < 2:
            continue
        kop = ' '.join(x for _, x in regels[max(0, i - 8):i]).lower()
        kolom4 = len(g) >= 4 and bool(re.search(r'basic.{0,40}diluted.{0,60}basic.{0,40}diluted', kop))
        if kolom4:
            a, b = g[1], g[3]                                      # kolommen gewoon/verwaterd per jaar
        elif len(g) == 3 and abs(g[0]) < 60 and (float(g[0]).is_integer() or round(g[0], 1) == g[0]) and not float(g[1]).is_integer():
            a, b = g[1], g[2]                                      # eerste getal is een toelichtingsnummer
        else:
            a, b = g[0], g[1]
        if (EPS_LABEL.search(ctx) or kolom4) and PER_AANDEEL.search(ctx) and all(abs(x) < 1000 for x in (a, b)) and \
                not AANDELEN.search(r) and not AANGEPAST.search(r):
            breed = ' '.join(x for _, x in regels[max(0, i - 3):i + 1])
            eps_r.append((p, i, (a, b), bool(re.search(r'pence|cents|\(p\)|\d\s?p\b|\bp\b|\(c\)|\bcent', breed, re.I))))
        if AANDELEN.search(ctx) and all(x >= 1000 or (x > 1 and not float(x).is_integer()) for x in (a, b)):
            aand_r.append((p, i, (a, b), kolom4 or bool(re.search(r'dilut|dilu|verwater|including|inclusief|y compris', ctx, re.I))))
        if WINST.search(r) and not PER_AANDEEL.search(r) and not AANGEPAST.search(r):
            if len(g) == 6:                 # Britse tabel: winst, gewone en verwaterde winst per aandeel, per jaar op één regel
                hoofd = ' '.join(x for _, x in regels[max(0, i - 5):i + 1])
                winst_r.append((p, i, (g[0], g[3])))
                eps_r.append((p, i, (g[2], g[5]), bool(re.search(r'pence|cents', hoofd, re.I))))
            else:
                winst_r.append((p, i, (a, b)))
    oplossingen = {}
    for pe, ie, (e0, e1), pence in eps_r:
        kop = kolommen(regels, ie)
        if not kop or jaar not in kop:
            continue
        nieuwste_links = kop[0] == jaar
        ander = kop[1] if nieuwste_links else kop[0]       # het andere jaar uit de kop (niet blind jaar - 1)
        for pa, ia, (a0, a1), verw in aand_r:
            if abs(ia - ie) > 300:
                continue
            for pw, iw, (w0, w1) in winst_r:
                if abs(iw - ie) > 3000:
                    continue
                for sa in (1, 1e3, 1e6):
                    if not (1e6 <= a0 * sa <= 2e10 and 1e6 <= a1 * sa <= 2e10):
                        continue
                    for sw in (1, 1e3, 1e6):
                        for (x0, x1) in ([(e0, e1)] if nieuwste_links else [(e1, e0)]):   # kolomvolgorde uit de jaartallenkop
                            vol = (a0, a1) if (x0, x1) == (e0, e1) else (a1, a0)
                            win = (w0, w1) if (x0, x1) == (e0, e1) else (w1, w0)
                            if abs(win[0] * sw) < 1e5 or abs(win[1] * sw) < 1e5 or win[0] == win[1] or x0 == 0 or x1 == 0:      # gelijke winst in twee jaren: verkeerde regel
                                continue
                            tol = sw / 10 if any(not float(w).is_integer() for w in win) else sw
                            for te in ((1, 100) if pence else (1,)):      # winst per aandeel in pence/cents: teller × 100
                                t0, t1 = 0.55 * 10 ** -decimalen(x0), 0.55 * 10 ** -decimalen(x1)
                                if past(win[0] * sw * te, vol[0] * sa, x0, tol * te, t0) and past(win[1] * sw * te, vol[1] * sa, x1, tol * te, t1):
                                    sleutel = (round(x0 / te, 6), round(x1 / te, 6), round(vol[0] * sa), round(vol[1] * sa))
                                    oplossingen.setdefault(sleutel + (ander,), (win[0] * sw, win[1] * sw, pe, pa, pw, ie, ia, iw, verw))
    # dezelfde aantallen en eps maar andere winstregel (bv. winst en winst voortgezette activiteiten gelijk) telt als één
    import os
    if os.environ.get('DEBUG'):
        for k, v in oplossingen.items(): print('  opl', k, v[:2], regels[v[5]][1].strip()[:80], '|', regels[v[7]][1].strip()[:80])
    if hint and len(oplossingen) > 1:   # orde van grootte van het aantal aandelen uit de ESEF-jaren (duizenden of miljoenen?)
        binnen = {k: v for k, v in oplossingen.items() if hint / 3 <= k[2] <= hint * 3}
        if binnen:
            oplossingen = binnen
    if len(oplossingen) > 1:      # voorkeur: regel met verwaterd aantal aandelen
        verwaterd = {k: v for k, v in oplossingen.items() if v[8]}
        if len(verwaterd) == 1:
            oplossingen = verwaterd
    if len(oplossingen) != 1:
        return None, f'{len(oplossingen)} passende combinaties ({len(eps_r)} eps-, {len(aand_r)} aandelen-, {len(winst_r)} winstregels)'
    (x0, x1, v0, v1, ander), (w0, w1, pe, pa, pw, ie, ia, iw, _) = next(iter(oplossingen.items()))
    bewijs = lambda i: ' '.join(regels[i][1].split())[:160]
    return [(jaar, x0, w0, v0, pa, bewijs(ia), bewijs(ie), bewijs(iw)),
            (ander, x1, w1, v1, pa, bewijs(ia), bewijs(ie), bewijs(iw))], None
