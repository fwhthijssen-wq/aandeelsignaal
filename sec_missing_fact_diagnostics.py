"""Explain why SEC companyfacts observations did not enter annual history.

Read-only: a rejected candidate is never silently promoted to a financial fact.
"""
from datetime import date
from source_engine import duration_days
from concept_registry import CONCEPT_TAGS, ANNUAL_FORMS, MONETARY_UNITS


def diagnose_missing_annual_facts(payload, annual_rows, asof, *, concepts=('Operationele kasstroom',), max_candidates=12):
    """Return provenance-rich rejected candidate summaries for absent year/concept pairs.

    Includes comparative observations in later 20-F/10-K filings, which are often
    missed when the SEC annual selector insists on an FY-labelled filing context.
    """
    available = {(row['end'], name) for row in annual_rows
                 for name in (row.get('facts') or {}) if isinstance(row, dict) and row.get('end')}
    ends = sorted({row.get('end') for row in annual_rows if isinstance(row, dict)
                   and isinstance(row.get('end'), str)}, reverse=True)
    output = []
    for end in ends:
        for concept in concepts:
            if (end, concept) in available:
                continue
            candidates = []
            for namespace in ('us-gaap', 'ifrs-full'):
                catalog = (payload.get('facts') or {}).get(namespace) or {}
                for tag in CONCEPT_TAGS.get(concept, ()):
                    for unit, facts in ((catalog.get(tag) or {}).get('units') or {}).items():
                        if unit not in MONETARY_UNITS:
                            continue
                        for fact in facts:
                            if fact.get('end') != end or not isinstance(fact.get('val'), (int, float)) or isinstance(fact.get('val'), bool):
                                continue
                            if fact.get('filed', '9999-99-99') > asof:
                                continue
                            reasons = []
                            if fact.get('form') not in ANNUAL_FORMS: reasons.append('not_annual_filing')
                            if not 330 <= (duration_days(fact) or 0) <= 390: reasons.append('not_full_fiscal_year')
                            if not fact.get('start'): reasons.append('missing_start')
                            if not fact.get('accn'): reasons.append('missing_accession')
                            if fact.get('fp') not in (None, 'FY'): reasons.append('not_FY_context')
                            candidates.append({'namespace':namespace, 'tag':tag, 'unit':unit,
                                               'value':fact['val'], 'start':fact.get('start'),
                                               'end':end, 'filed':fact.get('filed'),
                                               'form':fact.get('form'), 'accession':fact.get('accn'),
                                               'fiscal_period':fact.get('fp'), 'reasons':reasons})
            candidates.sort(key=lambda c:(len(c['reasons']), c['filed'] or '', c['tag']), reverse=False)
            output.append({'year':end[:4], 'end':end, 'concept':concept,
                           'candidates_found':len(candidates),
                           'candidates':candidates[:max_candidates],
                           'note':'diagnostic_only_not_approved'})
    return output
