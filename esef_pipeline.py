"""Generieke, begrensde ESEF-verwerking van meerdere verslagjaren.

Geen bedrijfsspecifieke mapping; cijfers blijven voorlopig totdat de
volledige XBRL-taxonomie en consolidatie zijn gecontroleerd.
"""
from collections import defaultdict
from esef_discovery import validate_lei
from esef_auto import filings_for_lei, fetch_filing
from esef_history import combine_filing_histories
from esef_quality import assess_history


def build_esef_history(lei, *, discover=None, fetch=None, max_reports=12, years=10):
    """Zoek en verwerk rapportages met spreiding over boekjaren.

    Dubbele indieningen worden niet stilzwijgend genegeerd: maximaal twee
    rapportages per verslagperiode kunnen worden vergeleken op restatements.
    """
    lei = validate_lei(lei)
    if not 1 <= max_reports <= 30 or not 1 <= years <= 20:
        raise ValueError('Ongeldige grens voor ESEF-verwerking.')
    discover = discover or filings_for_lei
    fetch = fetch or fetch_filing
    filings = discover(lei)
    # Prioritize distinct reporting years before using spare slots for amended filings.
    # A report may also contain prior-year comparatives; do not assume those are complete.
    selected, counts, failures = [], defaultdict(int), []
    valid = []
    for filing in filings:
        if filing.get('lei') != lei:
            failures.append('Rapportage met afwijkende LEI overgeslagen')
            continue
        period = filing.get('period_end')
        try:
            from datetime import date
            date.fromisoformat(period)
        except (TypeError, ValueError):
            failures.append('Rapportage zonder geldig boekjaareinde overgeslagen')
            continue
        valid.append(filing)
    valid.sort(key=lambda f: f['period_end'], reverse=True)
    # Reserve the budget for distinct years first. If a download fails or yields
    # no annual facts, try another filing from that year before giving up.
    # Only after this do we use remaining slots for comparative/restated data.
    imported = []
    attempted = set()
    # API records without a stable ID or URL are distinct submissions too.
    # Never collapse all such filings into one attempted key (None).
    filing_keys = {id(f): (f.get('filing_id') or f.get('json_url') or
                            f.get('package_url') or f'record:{i}')
                   for i, f in enumerate(valid)}
    imported_years = set()
    distinct_years = []
    for filing in valid:
        year = filing['period_end'][:4]
        if year not in distinct_years:
            distinct_years.append(year)
    target_years = set(distinct_years[:years])

    def import_one(filing):
        key = filing_keys[id(filing)]
        if key in attempted or len(selected) >= max_reports:
            return
        attempted.add(key)
        selected.append(filing)
        counts[filing['period_end']] += 1
        try:
            result = fetch(filing)
            if result.get('filing', {}).get('lei') != lei:
                failures.append(f"{filing.get('filing_id', 'onbekend')}: identiteit wijkt af")
                return
            rows = result.get('annual_history') or []
            # Comparatives alone do not establish that the filing's own fiscal
            # year was successfully parsed. Otherwise a broken latest year can
            # consume a history slot and suppress an older usable filing.
            if not rows:
                failures.append(f"{filing.get('filing_id', 'onbekend')}: geen bruikbare jaargegevens")
                return
            # Check the imported year's accepted facts, not just raw candidate
            # facts. A nonempty but invalid filing must not suppress an older
            # usable report from the same issuer.
            accepted_rows, rejected = combine_filing_histories([result], lei, years=20)
            if rejected:
                failures.extend(f"{filing.get('filing_id', 'onbekend')}: {issue}"
                                for issue in rejected)
            imported.append(result)
            if any(row.get('end') == filing['period_end'] and row.get('facts')
                   for row in accepted_rows):
                imported_years.add(filing['period_end'][:4])
            else:
                # Preserve comparative facts for cross-filing conflict checks,
                # but do not count the report's missing primary fiscal year.
                failures.append(f"{filing.get('filing_id', 'onbekend')}: geen bruikbare gegevens voor eigen verslagjaar")
        except (ValueError, OSError, TimeoutError, KeyError, TypeError) as exc:
            failures.append(f"{filing.get('filing_id', 'onbekend')}: {exc}")

    # First attempt a report from each requested fiscal year.
    for year in distinct_years[:years]:
        for filing in valid:
            if filing['period_end'].startswith(year) and len(selected) < max_reports:
                import_one(filing)
                break
    # Retry failed years with alternative filings before spending the budget
    # on successful years' revisions.
    for year in distinct_years[:years]:
        if year in imported_years:
            continue
        for filing in valid:
            if filing['period_end'].startswith(year) and len(selected) < max_reports:
                import_one(filing)
                if year in imported_years:
                    break
    # If some of the newest requested years could not be imported at all,
    # extend the search to older reporting years rather than returning an
    # unnecessarily short history. This never replaces a successfully imported
    # year and respects the same report-download budget.
    for year in distinct_years[years:]:
        if len(imported_years) >= years or len(selected) >= max_reports:
            break
        target_years.add(year)
        for filing in valid:
            if filing['period_end'].startswith(year) and len(selected) < max_reports:
                import_one(filing)
                if year in imported_years:
                    break
    # A revision may reveal a genuine restatement; compare at most two reports
    # for each exact period. Never pull in older unrelated years in this pass.
    for filing in valid:
        if len(selected) >= max_reports:
            break
        if (filing['period_end'][:4] in target_years
                and counts[filing['period_end']] < 2):
            import_one(filing)
    # Preserve only compact, non-sensitive diagnostics for missing equity.
    equity_audits = [
        {'period_end': r['filing'].get('period_end'),
         'filing_id': r['filing'].get('filing_id'),
         'reasons': r['equity_audit'].get('reasons', {}),
         'equity_related_standard_tags': r['equity_audit'].get('equity_related_standard_tags', {}),
         'candidate_boundaries': r['equity_audit'].get('candidate_boundaries', []),
         'conclusion': r['equity_audit'].get('conclusion')}
        for r in imported if r.get('equity_audit') is not None
    ]
    history, conflicts = combine_filing_histories(imported, lei, years=years)
    quality = assess_history(history, conflicts, failures, years=years)
    return {'history': history, 'quality': quality, 'conflicts': conflicts, 'failures': failures,
            'reports_selected': len(selected), 'reports_imported': len(imported),
            'equity_audits': equity_audits,
            'status': 'voorlopig; niet voor automatische waardering'}


def build_esef_dossier(lei, ticker, *, discover=None, fetch=None, max_reports=12, years=10, sector=None):
    """Use the same conservative NAIC dossier as SEC, without a second valuation engine.

    No market signal is approved: ESEF and SEC still need independent
    financial reconciliation and verified split-adjusted EPS history.
    """
    from naic_dossier import build_dossier
    result = build_esef_history(lei, discover=discover, fetch=fetch,
                                max_reports=max_reports, years=years)
    dossier = build_dossier(result['history'], ticker, source='ESEF', sector=sector)
    dossier['warnings'].extend(result['quality']['issues'])
    dossier['quality'] = result['quality']
    dossier['source'] = 'ESEF'
    dossier['ready'] = False
    return {'pipeline': result, 'dossier': dossier}
