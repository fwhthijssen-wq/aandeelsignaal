"""Read-only audit of SEC cash-flow tags not selected by the generic mapping.

An extension is evidence to investigate, not an approved accounting concept.
"""
from source_engine import duration_days
from concept_registry import ANNUAL_FORMS


def inspect_cashflow_extensions(payload, annual_rows, asof, max_per_year=25):
    """Return period-aware candidates, conflicts and provenance for missing OCF.

    Full-year duration and consistent amount are required even to label an
    observation a *review candidate*. No observations enter annual_rows.
    """
    missing = [r for r in annual_rows if 'Operationele kasstroom' not in r.get('facts', {})]
    results = []
    for row in missing:
        end, unit = row['end'], row['unit']
        matches = []
        for namespace, tags in (payload.get('facts') or {}).items():
            if not isinstance(tags, dict):
                continue
            for tag, info in tags.items():
                normalized = tag.lower()
                if not ('cash' in normalized and ('operat' in normalized or 'providedby' in normalized)):
                    continue
                for obs in ((info or {}).get('units') or {}).get(unit, []):
                    if (obs.get('end') != end or obs.get('form') not in ANNUAL_FORMS
                            or obs.get('filed', '9999-99-99') > asof
                            or not isinstance(obs.get('val'), (int, float))
                            or isinstance(obs.get('val'), bool)):
                        continue
                    days = duration_days(obs)
                    reasons = []
                    if days is None or not 330 <= days <= 390:
                        reasons.append('geen aantoonbaar volledig boekjaar')
                    if not obs.get('accn'):
                        reasons.append('SEC-accession ontbreekt')
                    matches.append({'namespace': namespace, 'tag': tag, 'value': obs['val'],
                                    'unit': unit, 'start': obs.get('start'), 'end': end,
                                    'duration_days': days, 'form': obs.get('form'),
                                    'fp': obs.get('fp'), 'filed': obs.get('filed'),
                                    'accession': obs.get('accn'), 'reasons': reasons})
        matches.sort(key=lambda x: (x['namespace'], x['tag'], x['filed'] or '', str(x['value'])))
        eligible = [m for m in matches if not m['reasons']]
        values = {m['value'] for m in eligible}
        status = ('no_candidate' if not matches else
                  'invalid_context' if not eligible else
                  'conflicting_amounts' if len(values) > 1 else
                  'review_candidate_not_approved')
        results.append({'year': end[:4], 'end': end, 'unit': unit,
                        'candidates_total': len(matches), 'candidates': matches[:max_per_year],
                        'full_year_candidates': len(eligible),
                        'distinct_full_year_values': len(values),
                        'status': 'diagnostic_only_not_approved', 'review_status': status, 'approved': False})
    return results
