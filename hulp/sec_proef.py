"""Proef (ontwikkeling): wat levert de SEC-route (20-F/40-F) op voor Europese fondsen, vergeleken met hun ESEF-dossier?

Gebruik: python hulp/sec_proef.py contact@adres uitmap TICKER=SECCODE [TICKER=SECCODE ...]
Per fonds: aantal jaren, nagerekende jaren (eps_verified_years), status, valuta en de jaren die niet kloppen met reden; en
hetzelfde voor het ESEF-dossier (als dat er is). Schrijft uitmap/sec_proef.json en uitmap/sec_proef.md."""
import json, sys
from datetime import date
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import bouw_webdata as bw
from praktijkcontrole_sec_esef import summarize_sec
from source_engine import sec_snapshot


def kort(g):
    jaren = [j for j in g.get('jaren') or [] if j.get('comparable_eps') is not None]
    return {'jaren': len(jaren), 'van': jaren[0]['year'] if jaren else None, 'tot': jaren[-1]['year'] if jaren else None,
            'nagerekend': g.get('eps_verified_years'), 'status': g.get('eps_status'), 'niveau': g.get('niveau'),
            'valuta': sorted({j.get('currency') for j in jaren if j.get('currency')}),
            'open': [{'jaar': j.get('year'), 'check': j.get('eps_check'), 'reden': str(j.get('eps_reden') or '')[:160]}
                     for j in jaren[-10:] if j.get('eps_check') != 'onderbouwd'],
            'fout': g.get('fout') or g.get('reden')}


def main():
    email, uitmap = sys.argv[1], Path(sys.argv[2])
    uitmap.mkdir(parents=True, exist_ok=True)
    vandaag = date.today().isoformat()
    uit = {}
    for paar in sys.argv[3:]:
        ticker, sec = paar.split('=')
        r = {'sec': sec}
        try:
            r['via_sec'] = kort(bw.gegevens_uit_sec(summarize_sec(sec, email, fetcher=lambda t, a, e: sec_snapshot(t, a, e)), vandaag))
        except Exception as exc:
            r['via_sec'] = {'fout': f'{type(exc).__name__}: {exc}'[:200]}
        try:
            cf = bw.esef_ophalen(ticker)
            r['via_esef'] = kort(bw.gegevens_uit_esef(cf, vandaag)) if cf else None
        except Exception as exc:
            r['via_esef'] = {'fout': f'{type(exc).__name__}: {exc}'[:200]}
        uit[ticker] = r
        s, e = r['via_sec'], r['via_esef'] or {}
        print(ticker, sec, 'SEC', s.get('jaren'), s.get('nagerekend'), s.get('valuta'), '| ESEF', e.get('jaren'), e.get('nagerekend'), flush=True)
    (uitmap / 'sec_proef.json').write_text(json.dumps(uit, ensure_ascii=False, indent=1), encoding='utf-8')
    regels = ['| Fonds | SEC | SEC: jaren (nagerekend) | valuta | ESEF: jaren (nagerekend) | open in SEC (laatste 10) |', '|---|---|---|---|---|---|']
    for t, r in uit.items():
        s, e = r['via_sec'], r['via_esef'] or {}
        regels.append(f"| {t} | {r['sec']} | {s.get('jaren')} ({s.get('nagerekend')}) {s.get('van')}–{s.get('tot')} | {' '.join(s.get('valuta') or [])} | "
                      f"{e.get('jaren')} ({e.get('nagerekend')}) | {'; '.join(str(o['jaar']) + ': ' + (o['reden'] or o['check'] or '')[:70] for o in (s.get('open') or [])) or s.get('fout') or ''} |")
    (uitmap / 'sec_proef.md').write_text('\n'.join(regels) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
