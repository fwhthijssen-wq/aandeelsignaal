"""Conservatieve import van xBRL-JSON (OIM) uit de ESEF-repository.

Geen automatische mapping van extensieconcepten: alleen bekende IFRS-tags.
"""
import json
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from esef_import import TAG_LOOKUP, is_currency_code

MAX_JSON_BYTES = 20_000_000


def parse_xbrl_json(content, source='ESEF xBRL-JSON'):
    if len(content) > MAX_JSON_BYTES:
        raise ValueError('xBRL-JSON is te groot.')
    try:
        doc = json.loads(content)
    except (ValueError, UnicodeDecodeError) as exc:
        raise ValueError('Ongeldige xBRL-JSON.') from exc
    if not isinstance(doc, dict) or not isinstance(doc.get('facts'), dict):
        raise ValueError('Geen xBRL-JSON-feiten gevonden.')
    info = doc.get('documentInfo') or {}
    namespaces = info.get('namespaces') or {}
    facts = []
    for fid, item in doc['facts'].items():
        if not isinstance(item, dict):
            continue
        dims = item.get('dimensions') or {}
        if not isinstance(dims, dict) or any(k not in ('concept', 'entity', 'period', 'unit', 'language', 'noteId') for k in dims):
            continue
        qname = dims.get('concept', '')
        if ':' not in qname:
            continue
        prefix, tag = qname.split(':', 1)
        namespace = namespaces.get(prefix, '')
        if not (namespace.startswith('http://xbrl.ifrs.org/taxonomy/') or namespace.startswith('https://xbrl.ifrs.org/taxonomy/')
                or namespace.startswith('http://fasb.org/us-gaap/')):
            continue
        concept = TAG_LOOKUP.get(tag)
        if not concept:
            continue
        entity = dims.get('entity', '')
        entity_id = entity.split(':', 1)[-1].upper() if isinstance(entity, str) else ''
        if len(entity_id) != 20:
            continue
        period = dims.get('period', '')
        if not isinstance(period, str):
            continue
        if '/' in period:
            # Duration concepts use a full fiscal-year interval.
            if concept == 'Eigen vermogen':
                continue
            begin, finish = period.split('/', 1)
            try:
                start_date = date.fromisoformat(begin[:10])
                # OIM duration endpoints are exclusive.
                end_date = date.fromisoformat(finish[:10]) - timedelta(days=1)
            except ValueError:
                continue
            days = (end_date - start_date).days + 1
            if not 330 <= days <= 390:
                continue
        else:
            # OIM instant facts refer to a boundary. An instant at midnight
            # on January 1 is the closing balance on December 31.
            # Only balance-sheet equity is supported as an instant fact.
            if concept != 'Eigen vermogen' or not period.endswith('T00:00:00'):
                continue
            try:
                end_date = date.fromisoformat(period[:10]) - timedelta(days=1)
            except ValueError:
                continue
            start_date = None
        unit = dims.get('unit', '')
        if not isinstance(unit, str):
            continue
        # Require explicit OIM namespace prefixes: do not guess unknown units.
        if not unit.startswith('iso4217:'):
            continue
        unit = unit[len('iso4217:'):]
        if '/' in unit and not unit.endswith('/xbrli:shares'):
            continue
        unit = unit.replace('/xbrli:shares', '/shares')
        if concept == 'Winst per aandeel (verwaterd)':
            if not unit.endswith('/shares'):
                continue
            currency = unit.split('/')[0]
        else:
            if '/' in unit:
                continue
            currency = unit
        if not is_currency_code(currency):
            continue
        try:
            value = float(Decimal(str(item['value'])))
        except (KeyError, InvalidOperation, ValueError, OverflowError, TypeError):
            continue
        if not (-float('inf') < value < float('inf')):
            continue
        facts.append({'concept': concept, 'tag': tag, 'start': start_date.isoformat() if start_date else None,
                      'end': end_date.isoformat(), 'unit': unit, 'val': value,
                      'entity_id': entity_id, 'source': source, 'status': 'voorlopig'})
    return facts
