"""Kwaliteitsbewaker voor de nachtelijke update: vergelijkt de kerngetallen van de nieuwe gegevens met die van de vorige run.

Gebruik: python bewaker.py vorige.json nieuwe.json
- Drukt altijd een overzicht af (melding 'Kwaliteit').
- Waarschuwt bij een duidelijke daling (meer dan 10% én minstens 5 fondsen) en noemt de fondsen die iets kwijtraakten
  (bijv. niet meer Bevestigd).
- Bij een ernstige daling (meer dan 25% van de fondsen met jaarcijfers, of meer dan 40% van de bevestigde fondsen, of
  meer dan de helft van de verse koersen) zet hij de vorige gegevens terug en eindigt met code 2: de app blijft dan op de
  gegevens van gisteren staan in plaats van half lege gegevens te publiceren.
"""
import json, shutil, sys
from datetime import date


def _getal(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and x == x


def bevestigd(g):
    return g.get('eps_status') == 'independently_verified' and (g.get('eps_verified_years') or 0) >= 10 and not g.get('rejected_sources')


def kenmerken(data):
    """Per fonds wat het heeft; en de tellingen."""
    gemaakt = str(data.get('gemaakt') or '')[:10]
    try:
        peil = date.fromisoformat(gemaakt)
    except ValueError:
        peil = None
    per = {}
    for a in data.get('aandelen') or []:
        g = a.get('gegevens') or {}
        jr = [j for j in g.get('jaren') or [] if isinstance(j, dict)]
        eps = sum(1 for j in jr if _getal(j.get('comparable_eps')))
        k = a.get('koers') or {}
        vers = False
        try:
            vers = bool(peil and k.get('datum') and (peil - date.fromisoformat(str(k['datum'])[:10])).days <= 6)
        except ValueError:
            pass
        per[a['ticker']] = {
            'jaarcijfers': bool(jr) and not g.get('fout'),
            'bevestigd': bool(jr) and bevestigd(g),
            'eps6': eps >= 6,
            'koers': vers,
            'officieel': bool(jr) and g.get('bron') not in ('Yahoo Finance', None) and not g.get('fout'),
        }
    tel = {k: sum(1 for v in per.values() if v[k]) for k in ('jaarcijfers', 'bevestigd', 'eps6', 'koers', 'officieel')}
    tel['fondsen'] = len(per)
    return per, tel


NAMEN = {'fondsen': 'fondsen', 'jaarcijfers': 'met jaarcijfers', 'bevestigd': 'Bevestigd', 'eps6': 'met ≥ 6 jaar winst per aandeel',
         'koers': 'met verse koers', 'officieel': 'met officiële cijfers'}
ERNSTIG = {'jaarcijfers': 0.25, 'bevestigd': 0.40, 'koers': 0.50, 'fondsen': 0.25}


def vergelijk(oud, nieuw):
    po, to = kenmerken(oud)
    pn, tn = kenmerken(nieuw)
    waarschuwingen, ernstig = [], []
    for k in ('fondsen', 'jaarcijfers', 'bevestigd', 'eps6', 'koers', 'officieel'):
        a, b = to.get(k, 0), tn.get(k, 0)
        if a and b < a:
            daling = (a - b) / a
            kwijt = sorted(t for t in po if po[t].get(k) and not (pn.get(t) or {}).get(k))
            if daling > 0.10 and a - b >= 5:
                waarschuwingen.append(f"{NAMEN[k]}: {a} → {b} (−{round(daling * 100)}%)" + (f"; o.a. {' '.join(kwijt[:15])}" if kwijt else ''))
            elif k == 'bevestigd' and kwijt:
                waarschuwingen.append(f"niet meer Bevestigd: {' '.join(kwijt)}")
            if k in ERNSTIG and daling > ERNSTIG[k] and a - b >= 5:
                ernstig.append(f"{NAMEN[k]}: {a} → {b}")
    return to, tn, waarschuwingen, ernstig


def main():
    vorig_pad, nieuw_pad = sys.argv[1], sys.argv[2]
    nieuw = json.load(open(nieuw_pad, encoding='utf-8'))
    try:
        oud = json.load(open(vorig_pad, encoding='utf-8'))
    except (OSError, ValueError):
        _, tn = kenmerken(nieuw)
        print('::notice title=Kwaliteit::' + ', '.join(f"{NAMEN[k]} {v}" for k, v in tn.items()) + ' (geen vorige run om mee te vergelijken)')
        return 0
    to, tn, waarschuwingen, ernstig = vergelijk(oud, nieuw)
    print('::notice title=Kwaliteit::' + ', '.join(f"{NAMEN[k]} {tn[k]} ({tn[k] - to.get(k, 0):+d})" for k in tn))
    for w in waarschuwingen:
        print(f'::warning title=Kwaliteit gedaald::{w}')
    if ernstig:
        try:                                          # alle bestanden van de app terug (json, js-versie, status)
            import bouw_webdata
            from pathlib import Path
            bouw_webdata.schrijf(oud, Path(nieuw_pad).parent)
        except Exception:
            shutil.copyfile(vorig_pad, nieuw_pad)
        print('::error title=Niet gepubliceerd::Ernstige daling (' + '; '.join(ernstig) + '). De gegevens van de vorige run blijven staan.')
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
