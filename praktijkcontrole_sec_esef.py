"""Read-only practice validation for ESEF and optionally SEC; never approves valuations."""
from boekjaar import boekjaar
import argparse
import json
from datetime import date, datetime, timezone
from pathlib import Path

from esef_discovery import validate_lei
from esef_pipeline import build_esef_history
from naic_dossier import build_dossier

DEFAULT_LEI = '724500Y6DUVHQD6OXN27'  # ASML Holding N.V.; verify issuer identity independently


def dossier_completeness(dossier, *, expected_years=10, latest_source_year=None):
    """Uniform, read-only completeness audit for either official source route.

    Count *usable values*, not merely present annual rows. No implicit
    interpolation, FX conversion or EPS split normalization.
    """
    concepts = {
        'omzet': 'sales', 'nettowinst': 'profit',
        'winst_aandeelhouders': 'parent_profit',
        'operationele_kasstroom': 'cash', 'investeringen': 'capex',
        'eigen_vermogen': 'equity',
        'eps_gerapporteerd': 'reported_eps',
        'eps_vergelijkbaar': 'eps',
    }
    rows = dossier.get('rows') or []
    years = sorted({row['year'] for row in rows})
    latest = latest_source_year if latest_source_year is not None else max(years, default=None)
    window = list(range(latest - expected_years + 1, latest + 1)) if latest is not None else []
    relevant = [row for row in rows if row['year'] in window]
    from collections import Counter
    duplicates = sorted(y for y, n in Counter(row['year'] for row in relevant).items() if n > 1)
    coverage = {name: sorted({row['year'] for row in relevant if row.get(field) is not None})
                for name, field in concepts.items()}
    currencies = sorted({row['currency'] for row in relevant})
    missing = [year for year in window if year not in years]
    blockers = []
    if len(years) < expected_years or missing:
        blockers.append('Onvolledige tienjaarsdekking')
    if duplicates:
        blockers.append('Meerdere verslagregels binnen hetzelfde kalenderjaar')
    if len(currencies) > 1:
        blockers.append('Verschillende valuta zonder gecontroleerde omrekening')
    if len(coverage['eps_vergelijkbaar']) < expected_years:
        blockers.append('EPS niet tien jaar aantoonbaar splitsingsvergelijkbaar')
    if len(coverage['eigen_vermogen']) < expected_years:
        blockers.append('Eigen vermogen ontbreekt in een of meer boekjaren')
    # A cash-flow valuation needs both operating cash flow and capital
    # expenditure for each year; EPS coverage alone cannot establish FCF.
    fcf_years = sorted({row['year'] for row in relevant
                        if row.get('cash') is not None and row.get('capex') is not None})
    cashflow_issues = []
    if len(fcf_years) < expected_years:
        cashflow_issues.append('Vrije kasstroom niet voor alle tien boekjaren berekenbaar')
    # The top-level readiness verdict must not omit cash-flow blockers.
    blockers.extend(cashflow_issues)
    return {
        'years_in_dossier': years, 'window_latest_year': latest, 'missing_years': missing,
        'duplicate_calendar_years': duplicates, 'currencies': currencies,
        'concept_years': coverage,
        'concept_counts': {name: len(value) for name, value in coverage.items()},
        'fcf_years': fcf_years, 'fcf_coverage_complete': len(fcf_years) == expected_years,
        'cashflow_blocking_issues': cashflow_issues,
        'blocking_issues': blockers, 'valuation_approved': False,
    }


def summarize_esef(lei, *, builder=build_esef_history, max_reports=12):
    result = builder(validate_lei(lei), years=10, max_reports=max_reports)
    dossier = build_dossier(result['history'], lei, source='ESEF')
    return {
        'status': 'history_found' if result['history'] else 'no_history',
        'reports_selected': result['reports_selected'],
        'reports_imported': result['reports_imported'],
        'years': [row['end'] for row in result['history']],
        'currencies': sorted({row.get('unit', '') for row in result['history']}),
        'quality': result['quality'],
        'equity_audits': result.get('equity_audits', []),
        'conflicts': result['conflicts'],
        'failures': result['failures'],
        'dossier': {
            'years': [r['year'] for r in dossier['rows']],
            'warnings': dossier['warnings'],
            'reported_eps_years': [r['year'] for r in dossier['rows'] if r['reported_eps'] is not None],
            'parent_profit_years': [r['year'] for r in dossier['rows'] if r['parent_profit'] is not None],
            'comparable_eps_years': [r['year'] for r in dossier['rows'] if r['eps'] is not None],
            'ready': False,
            'completeness': dossier_completeness(dossier),
        },
    }


def summarize_sec(ticker, email, *, fetcher=None, asof=None, verified_observations=None, registry_override=None):
    from naic_fetch import fetch_naic_facts
    from source_engine import sec_snapshot
    audit_date = date.fromisoformat(asof) if asof else date.today()
    _, result = fetch_naic_facts(ticker, email, asof=audit_date.isoformat(), fetcher=fetcher or sec_snapshot)
    if not result.get('supported'):
        return {'status': 'unsupported', 'reason': result.get('reason')}
    history = result.get('annual_history') or []
    if not isinstance(history, list):
        return {'status': 'invalid_history', 'reason': 'SEC-jaarhistorie heeft ongeldig formaat',
                'valuation_approved': False}
    from collections import Counter
    from datetime import date as _date
    from math import isfinite
    from esef_import import is_currency_code
    accepted, rejected, grouped = [], [], {}
    merged_fact_rows = {}
    eligible_source_years = []
    for row in history:
        if not isinstance(row, dict):
            rejected.append('ongeldige jaarregel')
            continue
        end, unit = row.get('end'), row.get('unit')
        try:
            _date.fromisoformat(end)
        except (ValueError, TypeError):
            rejected.append('ongeldige afsluitdatum')
            continue
        if _date.fromisoformat(end) > audit_date:
            rejected.append(f'toekomstige afsluitdatum: {end}')
            continue
        # A source period remains part of the requested window even when
        # its currency or facts later fail validation.
        eligible_source_years.append(boekjaar(end))
        if not is_currency_code(unit):
            rejected.append('ongeldige valuta')
            continue
        facts = row.get('facts') or {}
        if not isinstance(facts, dict):
            rejected.append('ongeldige financiële feiten')
            continue
        numeric = {name: fact['val'] for name, fact in facts.items()
                   if isinstance(fact, dict)
                   and isinstance(fact.get('val'), (int, float))
                   and not isinstance(fact.get('val'), bool)
                   and isfinite(fact['val'])}
        if not numeric:
            rejected.append(f'geen bruikbare financiële feiten: {end}')
            continue
        grouped.setdefault((end, unit), []).append((numeric, facts))
    # Anchor the audit to the latest eligible source close, including periods
    # subsequently rejected for conflicts. Otherwise a bad recent year can
    # shift the window backwards and make ten older years appear complete.
    latest_source_year = max(eligible_source_years, default=None)
    # Do not arbitrarily keep the first of two conflicting submissions.
    # Repeated identical figures are harmless; incompatible figures invalidate
    # the complete year in this read-only audit, regardless of input order.
    # An identical closing date reported in multiple currencies cannot be
    # compared without a documented conversion. Reject the whole date.
    units_by_end = {}
    for end, unit in grouped:
        units_by_end.setdefault(end, set()).add(unit)
    ambiguous_ends = {end for end, units in units_by_end.items() if len(units) > 1}
    for end in sorted(ambiguous_ends):
        rejected.append(f'conflicterende verslagvaluta: {end}')
    for (end, unit), versions in sorted(grouped.items()):
        if end in ambiguous_ends:
            continue
        # SEC submissions may provide complementary facts for one closing date.
        # Merge only when every overlapping concept agrees exactly.  A true
        # contradiction invalidates the year independent of submission order.
        merged = {}
        metadata_by_concept = {}
        conflict = False
        metadata_conflict = False
        for version, original_facts in versions:
            for concept, value in version.items():
                if concept in merged and merged[concept] != value:
                    conflict = True
                else:
                    merged[concept] = value
                # Equal amounts do not establish comparable facts when the
                # source declares different units or reporting periods.
                fact = original_facts[concept]
                metadata = {key: fact[key] for key in ('unit', 'start', 'end')
                            if key in fact and fact[key] is not None}
                previous = metadata_by_concept.setdefault(concept, {})
                for key, field_value in metadata.items():
                    if key in previous and previous[key] != field_value:
                        metadata_conflict = True
                    previous[key] = field_value
        if conflict or metadata_conflict:
            rejected.append(f'tegenstrijdige dubbele jaarcijfers: {end} {unit}' if conflict
                            else f'tegenstrijdige bronmetadata: {end} {unit}')
            continue
        if len(versions) > 1:
            rejected.append('dubbel boekjaar en valuta' if all(version[0] == versions[0][0] for version in versions[1:]) else 'aanvullende jaarfeiten consistent samengevoegd')
        # A single filing can also contain a fact with inconsistent metadata.
        # Preserve duplicate conflict detection above, then omit such facts
        # from both the coverage and the shared dossier.
        valid_concepts = set()
        for concept in merged:
            fact_metadata = metadata_by_concept[concept]
            expected_unit = unit + ('/shares' if concept == 'Winst per aandeel (verwaterd)' else '')
            if (fact_metadata.get('end', end) == end
                    and fact_metadata.get('unit', expected_unit) == expected_unit
                    and (concept != 'Eigen vermogen' or 'start' not in fact_metadata)):
                valid_concepts.add(concept)
        if not valid_concepts:
            rejected.append(f'geen bruikbare feiten na bronmetadatacontrole: {end}')
            continue
        accepted.append({'end': end, 'currency': unit, 'concepts': sorted(valid_concepts)})
        # Keep the original fact metadata (unit, end, start) so the shared
        # dossier can independently reject incompatible concept definitions.
        facts_for_dossier = {}
        for _numeric, original_facts in versions:
            for concept in valid_concepts:
                if concept in original_facts and concept not in facts_for_dossier:
                    facts_for_dossier[concept] = dict(original_facts[concept])
        # Preserve an explicitly declared basis only when all source versions
        # agree. Never guess IFRS/US-GAAP from ticker or geography.
        bases = {version_row.get('accounting_basis') for version_row in history
                 if isinstance(version_row, dict) and version_row.get('end') == end
                 and version_row.get('unit') == unit}
        basis = next(iter(bases)) if len(bases) == 1 else None
        merged_fact_rows[(end, unit)] = {'end': end, 'unit': unit,
                                         'accounting_basis': basis,
                                         'facts': facts_for_dossier}
    # A changed fiscal year-end can produce two closes in one calendar year.
    # Do not count both as independent NAIC years.
    closes_by_year = {}
    for row in accepted:
        closes_by_year.setdefault(str(boekjaar(row['end'])), set()).add(row['end'])
    ambiguous_calendar_years = {year for year, ends in closes_by_year.items()
                                if len(ends) > 1}
    for year in sorted(ambiguous_calendar_years):
        rejected.append(f'meerdere boekjaareindes in kalenderjaar {year}')
    accepted = [row for row in accepted
                if str(boekjaar(row['end'])) not in ambiguous_calendar_years]
    # Only the latest ten distinct calendar years belong to this audit window.
    # Older history is retained in the source, but must not inflate coverage.
    window_start = latest_source_year - 9 if latest_source_year is not None else None
    out_of_window = [r for r in accepted if boekjaar(r['end']) < window_start] if window_start is not None else []
    accepted = [r for r in accepted if boekjaar(r['end']) >= window_start] if window_start is not None else []
    coverage = dict(Counter(name for row in accepted for name in row['concepts']))
    # An audit must not suggest a comparable ten-year history when reporting
    # currency changes or years are missing. No implicit FX conversion.
    currencies = sorted({row['currency'] for row in accepted})
    calendar_years = sorted({boekjaar(row['end']) for row in accepted})
    requested_years = list(range(latest_source_year - 9, latest_source_year + 1)) if latest_source_year is not None else []
    missing_years = [year for year in requested_years if year not in calendar_years]
    issues = []
    if out_of_window:
        issues.append(f'{len(out_of_window)} oudere boekjaren buiten het tienjaarsvenster gelaten')
    if len(currencies) > 1:
        issues.append('Verschillende verslagvaluta tussen boekjaren; geen automatische vergelijking')
    if missing_years:
        issues.append('Ontbrekende kalenderjaren binnen tienjaarsvenster: ' + ', '.join(map(str, missing_years)))
    if len(calendar_years) < 10:
        issues.append(f'Historie onvolledig: {len(calendar_years)} van 10 boekjaren')
    # Both source routes now use the same conservative NAIC dossier.
    # Only audited/accepted periods enter it, never the raw SEC history.
    safe_history = [merged_fact_rows[(row['end'], row['currency'])] for row in accepted]
    # An optional independently verified supplement is applied only after the
    # original SEC periods and conflicts have been validated. Never overwrite.
    # Missing evidence leaves the source history unchanged.
    from verified_history_overlay import overlay_verified_facts
    from source_registry import load_registry as _load_registry
    overlay_audit = []
    if verified_observations is not None:
        registry_for_overlay = (registry_override if registry_override is not None
                                else _load_registry())
        safe_history, overlay_audit = overlay_verified_facts(
            safe_history, registry_for_overlay, verified_observations, ticker=ticker)
    # Audited primary annual-report facts can fill a missing figure without
    # pretending they are an independently corroborated or comparable series.
    # This never overrides SEC facts or approves a valuation.
    from primary_source_completion import complete_from_primary_sources
    primary_registry = registry_override if registry_override is not None else _load_registry()
    safe_history, primary_source_audit = complete_from_primary_sources(
        safe_history, primary_registry, ticker=ticker)
    supplemented = [item for item in overlay_audit if item['status'] == 'supplemented']
    # Source-level coverage must reflect the SAME accepted and completed facts
    # that enter the NAIC dossier, not the pre-completion SEC selection.
    final_coverage = dict(Counter(concept for row in safe_history
                                  for concept in row.get('facts', {})))
    final_year_details = [{'end': row['end'], 'currency': row['unit'],
                           'concepts': sorted(row.get('facts', {}))}
                          for row in safe_history]
    # EPS-vergelijkbaarheid: splitbevestiging + onafhankelijke onderbouwing (eps_verification.py).
    from eps_verification import verify_eps
    eps_check = verify_eps(result, safe_history, audit_date)
    split_source = eps_check['split_source']
    split_audit = eps_check['split_audit']
    validated_splits = eps_check['validated_splits']
    conflicting_dates = eps_check['conflicting_dates']
    rejected_split_evidence = eps_check['rejected_split_evidence']
    eps_normalized = eps_check['eps_normalized']
    eps_reconciliation = eps_check['eps_reconciliation']
    eps_verified_years = eps_check['eps_verified_years']
    dossier = build_dossier(safe_history, ticker, normalized=eps_normalized, source='SEC')
    from naic_eps_preview import provisional_naic_preview
    naic_preview = provisional_naic_preview(dossier)
    # Historic local source evidence is reported separately; only vetted
    # primary-source completions enter the dossier and coverage.
    from naic_registry_view import registry_evidence_for_history
    from source_registry import load_registry
    try:
        registry_records = load_registry()
        historic_evidence = registry_evidence_for_history(ticker, safe_history, registry_records)
        from source_evidence_reconciliation import reconcile_source_evidence
        issuer = ticker.upper().split('.')[0]
        relevant_records = [r for r in registry_records if r['ticker'].upper() == issuer]
        historic_evidence_audit = reconcile_source_evidence(relevant_records, [])
        from historical_gap_analysis import analyze_historical_gaps
        gap_coverage = {str(year): {
            'missing': [concept for concept in (
                'Omzet', 'Nettowinst', 'Winst per aandeel (verwaterd)',
                'Operationele kasstroom', 'Investeringen in vaste activa', 'Eigen vermogen')
                if concept not in next((row['concepts'] for row in final_year_details
                                        if boekjaar(row['end']) == year), [])]
        } for year in requested_years}
        historic_gap_audit = analyze_historical_gaps(gap_coverage, relevant_records, ticker)
        historic_evidence_error = None
    except (OSError, ValueError, TypeError) as exc:
        historic_evidence = []
        historic_evidence_audit = []
        historic_gap_audit = []
        historic_evidence_error = str(exc)[:300]
    dossier_summary = {
        'years': [r['year'] for r in dossier['rows']],
        'primary_source_completed_years': sorted({item['year'] for item in primary_source_audit
            if item.get('status') == 'added_primary_source'}),
        'accounting_bases': sorted({r['accounting_basis'] for r in dossier['rows']
            if r.get('accounting_basis')}),
        'warnings': dossier['warnings'],
        'reported_eps_years': [r['year'] for r in dossier['rows'] if r['reported_eps'] is not None],
        'parent_profit_years': [r['year'] for r in dossier['rows'] if r['parent_profit'] is not None],
        'comparable_eps_years': [r['year'] for r in dossier['rows'] if r['eps'] is not None],
        'eps_independent_audit': eps_reconciliation,
        'naic_illustrative_preview': naic_preview,
        'eps_independently_verified_years': eps_verified_years,
        'eps_independently_verified_count': len(eps_verified_years),
        'eps_adjustments': [
            {'year': r['year'], 'reported_eps': r['reported_eps'],
             'provisional_comparable_eps': r['eps'],
             'split_factor': eps_normalized.get(r['end'].isoformat(), {}).get('Factor'),
             'status': r['eps_status']}
            for r in dossier['rows']
        ],
        'split_events_found': len(split_source) if isinstance(split_source, list) else 0,
        'split_events_accepted': len(validated_splits) if not rejected_split_evidence else 0,
        'split_conflict_dates': conflicting_dates,
        'split_event_audit': split_audit,
        'eps_verification_status': eps_check['status'],
        'eps_verification_routes': eps_check['routes'],
        'eps_verification_note': eps_check.get('toelichting'),
        'year_table': [
            {'year': r['year'], 'end': r['end'].isoformat(), 'currency': r['currency'],
             'sales': r['sales'], 'net_income': r['profit'], 'reported_eps': r['reported_eps'],
             'comparable_eps': r['eps'], 'operating_cash_flow': r['cash'], 'capex': r['capex'],
             'equity': r['equity'],
             'eps_check': eps_reconciliation.get(r['end'].isoformat(), {}).get('status'),
             'eps_reden': eps_reconciliation.get(r['end'].isoformat(), {}).get('reden')}
            for r in dossier['rows']],
        'ready': False,
        'completeness': dossier_completeness(dossier, latest_source_year=latest_source_year),
    }
    return {'status': 'facts_found' if accepted else 'no_valid_annual_history',
            'dossier': dossier_summary,
            'historic_source_evidence': historic_evidence,
        'primary_source_completion_audit': primary_source_audit,
        'verified_supplement_audit': overlay_audit,
        'verified_supplements_applied': len(supplemented),
            'historic_source_evidence_audit': historic_evidence_audit,
            'historic_gap_audit': historic_gap_audit,
        'coverage_after_primary_completion': final_coverage,
            'historic_source_evidence_error': historic_evidence_error,
            'company': result.get('company'), 'cik': result.get('cik'),
            'missing_annual_fact_diagnostics': result.get('missing_annual_fact_diagnostics', []),
            'missing_cashflow_extension_audit': result.get('missing_cashflow_extension_audit', []),
            'annual_history_count': len(history),
            'accepted_year_rows': len(accepted),
            'distinct_years': len({r['end'] for r in accepted}),
            'currencies': currencies,
            'years_requested': 10, 'window_latest_source_year': latest_source_year,
            'missing_calendar_years': missing_years,
            'older_years_excluded': sorted({boekjaar(r['end']) for r in out_of_window}),
            'quality_issues': issues,
            'concept_coverage': final_coverage, 'year_details': final_year_details,
            'rejections': rejected,
            # A source-level comparability marker is not proof that the shared
            # dossier has actually normalized EPS. Report only dossier evidence.
            'eps_comparability_available': bool(dossier_summary['comparable_eps_years']),
            'eps_comparability_source_claimed': result.get('eps_comparability') is not None,
            'eps_comparability_discrepancy': (result.get('eps_comparability') is not None
                                                 and not dossier_summary['comparable_eps_years']),
            'valuation_approved': False}


def run(lei=DEFAULT_LEI, sec_ticker=None, sec_email=None, *, esef_builder=build_esef_history,
        sec_fetcher=None, max_reports=12, skip_esef=False):
    output = {'expected_esef_issuer': 'ASML Holding N.V.' if lei == DEFAULT_LEI else None, 'checked_utc': datetime.now(timezone.utc).isoformat(), 'valuation_approved': False,
              'esef_lei': lei, 'sec_ticker': sec_ticker, 'esef': {}, 'sec': {'status': 'not_requested'}}
    if skip_esef:
        output['esef'] = {'status': 'not_requested'}
    else:
        try:
            output['esef'] = summarize_esef(lei, builder=esef_builder, max_reports=max_reports)
        except Exception as exc:
            output['esef'] = {'status': 'error', 'error_type': type(exc).__name__, 'message': str(exc)[:500]}
    if sec_ticker:
        if not sec_email:
            output['sec'] = {'status': 'not_run', 'reason': 'SEC-contact-e-mailadres ontbreekt'}
        else:
            try:
                output['sec'] = summarize_sec(sec_ticker, sec_email, fetcher=sec_fetcher)
            except Exception as exc:
                output['sec'] = {'status': 'error', 'error_type': type(exc).__name__, 'message': str(exc)[:500]}
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='SEC/ESEF praktijkcontrole (alleen lezen)')
    parser.add_argument('--lei', default=DEFAULT_LEI)
    parser.add_argument('--sec-ticker', default=None)
    parser.add_argument('--sec-email', default=None)
    parser.add_argument('--max-reports', type=int, default=12)
    parser.add_argument('--sec-only', action='store_true', help='Sla de Europese download over')
    args = parser.parse_args()
    if not 1 <= args.max_reports <= 30:
        parser.error('--max-reports moet tussen 1 en 30 liggen')
    result = run(args.lei, args.sec_ticker, args.sec_email, max_reports=args.max_reports, skip_esef=args.sec_only)
    path = Path(__file__).resolve().parent / 'SEC_ESEF_praktijkresultaat.json'
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
    print('ESEF:', result['esef'].get('status'), len(result['esef'].get('years', [])), 'boekjaren')
    print('SEC:', result['sec']['status'])
    print('Resultaat:', path)
