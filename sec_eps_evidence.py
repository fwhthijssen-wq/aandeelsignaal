"""SEC companyfacts EPS filing evidence; reporting periods are not split dates.

This exposes filed observations, not independently verified split-adjusted EPS.
"""
from datetime import date
from math import isfinite
from concept_registry import EPS_TAGS, ANNUAL_FORMS, MONETARY_UNITS
from source_engine import duration_days


def sec_eps_filing_observations(payload, asof):
    """Keep provenance of distinct annual EPS filings, without selecting a 'truth'."""
    cutoff = date.fromisoformat(asof)
    seen = set()
    observations = []
    for namespace in ('us-gaap', 'ifrs-full'):
        for tag in EPS_TAGS:
            units = payload.get('facts', {}).get(namespace, {}).get(tag, {}).get('units', {})
            for unit, rows in units.items():
                if unit not in {f'{currency}/shares' for currency in MONETARY_UNITS}:
                    continue
                for row in rows:
                    try:
                        end = date.fromisoformat(row['end'])
                        filed = date.fromisoformat(row['filed'])
                        value = row['val']
                        if (row.get('form') not in ANNUAL_FORMS
                                or not 330 <= (duration_days(row) or 0) <= 390
                                or not row.get('accn') or not end <= filed <= cutoff
                                or isinstance(value, bool) or not isinstance(value, (int, float))
                                or not isfinite(value)):
                            continue
                    except (KeyError, ValueError, TypeError):
                        continue
                    key = (row['end'], row['filed'], row['accn'], namespace, tag, unit, value)
                    if key in seen:
                        continue
                    seen.add(key)
                    observations.append({'end': row['end'], 'filed': row['filed'],
                                         'val': value, 'unit': unit,
                                         'accn': row['accn'], 'tag': tag,
                                         'source': f'SEC {namespace}:{tag}'})
    return sorted(observations, key=lambda r: (r['end'], r['filed'], r['accn']))


def _iso_date(value):
    """Reject non-ISO, impossible and missing provenance dates."""
    if not isinstance(value, str):
        return None
    try:
        parsed = date.fromisoformat(value)
        return parsed if parsed.isoformat() == value else None
    except ValueError:
        return None


def later_eps_evidence(observations, history, normalized, splits):
    """Return only verifiably later filing evidence after an effective split.

    Invalid split provenance is fail-closed: never corroborate an EPS adjustment
    when any potentially applicable split date cannot be audited.
    """
    baseline = {}
    for row in history:
        fact = (row.get('facts') or {}).get('Winst per aandeel (verwaterd)') or {}
        end = row.get('end')
        filed = fact.get('filed')
        if _iso_date(end) and _iso_date(filed) and _iso_date(filed) >= _iso_date(end):
            baseline[end] = max(baseline.get(end, ''), filed)
    out = []
    for end in normalized:
        period = _iso_date(end)
        if not period or end not in baseline:
            continue
        # An invalid dated split must not silently disappear from the audit.
        if any(_iso_date(s.get('Datum')) is None for s in splits):
            continue
        applicable = [s['Datum'] for s in splits if _iso_date(s['Datum']) > period]
        if not applicable:
            continue
        threshold = max([baseline[end], *applicable])
        rows = [r for r in observations if r.get('end') == end
                and _iso_date(r.get('filed')) and r['filed'] > threshold
                and isinstance(r.get('val'), (int, float))
                and not isinstance(r.get('val'), bool) and isfinite(r['val'])
                and isinstance(r.get('unit'), str) and r['unit'].endswith('/shares')
                and r.get('accn') and r.get('source')]
        if not rows:
            continue
        # Retain *all* eligible later filings. Choosing only the newest can
        # hide an earlier contradictory restatement and falsely corroborate
        # the normalized EPS. The reconciler must see every disagreement.
        out.extend({'end': r['end'], 'filed': r['filed'], 'val': r['val'],
                    'unit': r['unit'], 'source': r['source'], 'accn': r['accn']}
                   for r in rows)
    return out
