"""Hulpmiddel (ontwikkeling): waarom levert de SEC-route voor een fonds geen of weinig jaren op?
Gebruik: python hulp/sec_diagnose.py contact@adres SECCODE [...]  (uitkomst in het logboek)"""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from praktijkcontrole_sec_esef import summarize_sec
from source_engine import sec_snapshot
from naic_fetch import fetch_naic_facts

email = sys.argv[1]
for t in sys.argv[2:]:
    print('==', t, flush=True)
    try:
        _, res = fetch_naic_facts(t, email, fetcher=sec_snapshot)
        hist = res.get('annual_history') or []
        print('  supported', res.get('supported'), res.get('reason'), 'aanvulling', res.get('aanvulling_jaarverslag'))
        for r in hist:
            print('  rij', r.get('end'), r.get('unit'), sorted((r.get('facts') or {}).keys()))
        per = {}
        for o in res.get('eps_filing_observations') or []:
            per.setdefault(o['end'], []).append((o['filed'], o['val'], o['unit'], o['tag'][:18]))
        for e in sorted(per):
            print('  eps-waarneming', e, sorted(per[e]))
        s = summarize_sec(t, email, fetcher=lambda a, b, c: sec_snapshot(a, b, c))
        print('  status', s.get('status'), s.get('reason'))
        for k in ('annual_history_count', 'accepted_year_rows', 'currencies', 'window_latest_source_year', 'missing_calendar_years',
                  'quality_issues', 'rejections', 'split_event_audit', 'split_conflict_dates', 'year_details'):
            print('  ', k, json.dumps(s.get(k) if k in s else (s.get('dossier') or {}).get(k), ensure_ascii=False, default=str)[:2500])
        d = s.get('dossier') or {}
        print('   eps', d.get('eps_verification_status'), d.get('eps_independently_verified_years'), (d.get('eps_verification_note') or '')[:300])
        for y in d.get('year_table') or []:
            print('   jaar', y.get('year'), y.get('currency'), y.get('reported_eps'), y.get('eps_check'), str(y.get('eps_reden') or '')[-260:])
    except Exception as exc:
        import traceback; traceback.print_exc()
