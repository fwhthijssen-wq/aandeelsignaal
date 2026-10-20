"""Generic read-only audit of IFRS equity facts in OIM JSON; no issuer overrides."""
import json
from collections import Counter
from datetime import date, timedelta
from esef_import import ESEF_EQUITY_TAGS, is_currency_code


def audit_equity_json(content, expected_lei):
    doc = json.loads(content)
    ns = (doc.get('documentInfo') or {}).get('namespaces') or {}
    counts, tag_counts = Counter(), Counter()
    candidates, total_only = set(), set()
    for fact in (doc.get('facts') or {}).values():
        if not isinstance(fact, dict):
            continue
        dims = fact.get('dimensions') or {}
        if not isinstance(dims, dict):
            continue
        concept = dims.get('concept', '')
        if not isinstance(concept, str) or ':' not in concept:
            continue
        prefix, tag = concept.split(':', 1)
        if not str(ns.get(prefix, '')).startswith(('http://xbrl.ifrs.org/taxonomy/', 'https://xbrl.ifrs.org/taxonomy/')):
            continue
        if 'Equity' not in tag and 'Capital' not in tag and 'NetAssets' not in tag:
            continue
        tag_counts[tag] += 1
        entity = dims.get('entity', '')
        if not isinstance(entity, str) or entity.split(':', 1)[-1].upper() != expected_lei.upper():
            counts['other_entity'] += 1
            continue
        if any(key not in ('concept', 'entity', 'period', 'unit', 'language', 'noteId') for key in dims):
            counts['dimensioned'] += 1
            continue
        if tag not in ESEF_EQUITY_TAGS:
            counts['unmapped_or_not_parent_equity'] += 1
            if tag == 'Equity':
                total_only.add(tag)
            continue
        period = dims.get('period', '')
        if not isinstance(period, str) or '/' in period or not period.endswith('T00:00:00'):
            counts['invalid_instant'] += 1
            continue
        try:
            boundary = date.fromisoformat(period[:10])
            if boundary.isoformat() + 'T00:00:00' != period:
                raise ValueError('noncanonical instant')
        except ValueError:
            counts['invalid_instant'] += 1
            continue
        unit = dims.get('unit', '')
        if not isinstance(unit, str) or not unit.startswith('iso4217:') or not is_currency_code(unit[8:]):
            counts['invalid_unit'] += 1
            continue
        counts['eligible_parent_equity_candidate'] += 1
        candidates.add((boundary - timedelta(days=1)).isoformat())
    if candidates:
        conclusion = 'parent_equity_candidates_present'
    elif total_only:
        conclusion = 'only_total_equity_observed_not_equivalent_to_parent_equity'
    elif tag_counts:
        conclusion = 'equity_related_tags_present_but_no_eligible_parent_equity'
    else:
        conclusion = 'no_standard_equity_related_tags_found'
    return {'equity_related_standard_tags': dict(tag_counts.most_common(20)),
            'reasons': dict(counts), 'candidate_boundaries': sorted(candidates),
            'conclusion': conclusion}
