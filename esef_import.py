"""Conservatieve generieke ESEF iXBRL/XBRL import.

Leest originele ingediende facts, geen bedrijfsspecifieke regels. Het is
bewust geen vervanger voor een volledige XBRL-validatie met taxonomie-DTS.
"""
from __future__ import annotations
import io
import re
import zipfile
from datetime import date
from decimal import Decimal, InvalidOperation
from xml.etree import ElementTree as ET

from concept_registry import CONCEPT_TAGS, EPS_TAGS, EQUITY_TAGS

XBRLI = 'http://www.xbrl.org/2003/instance'
IX_NAMESPACES = {'http://www.xbrl.org/2013/inlineXBRL', 'http://www.xbrl.org/2008/inlineXBRL'}
# ESEF: totaal eigen vermogen inclusief minderheidsbelangen is niet gelijk
# aan het eigen vermogen toerekenbaar aan gewone aandeelhouders.
ESEF_EQUITY_TAGS = tuple(tag for tag in EQUITY_TAGS
                         if tag != 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest')
# IFRS consolidated profit includes non-controlling interests. Keep the amount
# attributable to owners of the parent in a separate, explicit concept.
PARENT_PROFIT_TAGS = ('ProfitLossAttributableToOwnersOfParent',
                      'NetIncomeLossAvailableToCommonStockholdersBasic')
CONCEPTS = {**CONCEPT_TAGS, 'Winst toerekenbaar aan aandeelhouders': PARENT_PROFIT_TAGS,
            'Winst per aandeel (verwaterd)': EPS_TAGS, 'Eigen vermogen': ESEF_EQUITY_TAGS}
TAG_LOOKUP = {tag: concept for concept, tags in CONCEPTS.items() for tag in tags}
# ESEF-filings gebruiken uiteenlopende ISO 4217-valuta, niet alleen EUR/USD/GBP.
# Controleer een expliciete iso4217-unit; annual_rows houdt valuta gescheiden.
ALLOWED_CURRENCIES = {'EUR', 'USD', 'GBP'}  # backwards compatibility


def is_currency_code(code):
    return isinstance(code, str) and len(code) == 3 and code.isascii() and code.isalpha() and code.isupper()

MAX_ZIP_BYTES = 75_000_000
MAX_MEMBER_BYTES = 20_000_000


def _local(name):
    return name.rsplit('}', 1)[-1].split(':')[-1]


def _elements(root, local):
    return (e for e in root.iter() if _local(e.tag) == local)


def _text(element):
    return ''.join(element.itertext()).strip()


def _contexts(root):
    result = {}
    for context in _elements(root, 'context'):
        ident = context.get('id')
        if not ident:
            continue
        period = next((e for e in context if _local(e.tag) == 'period'), None)
        if period is None:
            continue
        values = {_local(e.tag): _text(e) for e in period}
        # Dimensionele feiten worden niet met de geconsolideerde totalen gemengd.
        if any(_local(e.tag) in ('segment', 'scenario') for e in context):
            continue
        end = values.get('endDate') or values.get('instant')
        start = values.get('startDate')
        identifier = next((e for e in context.iter() if _local(e.tag) == 'identifier'), None)
        entity_id = _text(identifier) if identifier is not None else ''
        if end and entity_id:
            result[ident] = (start, end, entity_id)
    return result


def _units(root):
    result = {}
    for unit in _elements(root, 'unit'):
        uid = unit.get('id')
        measures = [_text(e).split(':')[-1] for e in _elements(unit, 'measure')]
        if len(measures) == 1 and is_currency_code(measures[0]):
            result[uid] = measures[0]
        elif len(measures) == 2 and is_currency_code(measures[0]) and measures[1] == 'shares':
            result[uid] = measures[0] + '/shares'
    return result


def _value(element, inline):
    if element.get('nil') == 'true' or element.get('{http://www.w3.org/2001/XMLSchema-instance}nil') == 'true':
        return None
    raw = _text(element).replace('\u00a0', '').replace(' ', '')
    if not raw or element.get('format') and 'zerodash' in element.get('format', '').lower():
        return None
    # Inline formats must be interpreted, not guessed. Only safe common
    # numeric presentations are accepted; other formats are skipped.
    fmt = element.get('format', '').lower()
    if fmt and not any(x in fmt for x in ('numdotdecimal', 'numcommadecimal', 'numspacecomma', 'numspacedot', 'numdash')):
        return None
    if 'numcommadecimal' in fmt or 'numspacecomma' in fmt:
        raw = raw.replace('.', '').replace(',', '.')
    else:
        raw = raw.replace(',', '')
    if raw.startswith('(') and raw.endswith(')'):
        raw = '-' + raw[1:-1]
    try:
        number = Decimal(raw)
        scale = int(element.get('scale', '0')) if inline else 0
        if abs(scale) > 15:
            return None
        number *= Decimal(10) ** scale
        if element.get('sign') == '-':
            number = -abs(number)
        return float(number)
    except (InvalidOperation, ValueError, OverflowError):
        return None


def parse_instance(content, filename='verslag.xbrl'):
    """Geeft uniforme conceptfeiten terug, met herkomst en context."""
    if len(content) > MAX_MEMBER_BYTES:
        raise ValueError('ESEF-bestand is te groot voor veilige verwerking.')
    try:
        root = ET.fromstring(content)
    except ET.ParseError as exc:
        raise ValueError('Geen leesbaar XML/iXBRL-bestand.') from exc
    # Inline XBRL QName prefixes must resolve to a real standard taxonomy URI.
    # A company can freely name an extension prefix "ifrs-full".
    namespaces = dict(ET.iterparse(io.BytesIO(content), events=('start-ns',)))
    contexts = _contexts(root)
    units = _units(root)
    facts = []
    for element in root.iter():
        inline = element.tag.startswith('{') and element.tag[1:].split('}', 1)[0] in IX_NAMESPACES
        if inline:
            if _local(element.tag) not in ('nonFraction',):
                continue
            qualified = element.get('name', '')
            # Inline facts may use company-specific prefixes. Without the
            # taxonomy DTS, only an explicitly IFRS-qualified name is safe.
            prefix = qualified.split(':', 1)[0] if ':' in qualified else ''
            resolved = namespaces.get(prefix, '')
            if not (resolved.startswith('http://xbrl.ifrs.org/taxonomy/')
                    or resolved.startswith('http://fasb.org/us-gaap/')):
                continue
            tag = _local(qualified)
        else:
            # A local tag name is not sufficient evidence of a standard IFRS
            # concept: company extensions may reuse the same local name.
            if not element.tag.startswith('{'):
                continue
            namespace, tag = element.tag[1:].split('}', 1)
            if not (namespace.startswith('http://xbrl.ifrs.org/taxonomy/')
                    or namespace == 'http://fasb.org/us-gaap/2024'
                    or namespace.startswith('http://fasb.org/us-gaap/')):
                continue
        concept = TAG_LOOKUP.get(tag)
        if not concept:
            continue
        period = contexts.get(element.get('contextRef'))
        unit = units.get(element.get('unitRef'))
        if not period or not unit:
            continue
        if concept == 'Winst per aandeel (verwaterd)' and not unit.endswith('/shares'):
            continue
        if concept != 'Winst per aandeel (verwaterd)' and unit.endswith('/shares'):
            continue
        value = _value(element, inline)
        if value is None:
            continue
        start, end, entity_id = period
        if start:
            if concept == 'Eigen vermogen':
                continue
            try:
                days = (date.fromisoformat(end) - date.fromisoformat(start)).days + 1
            except ValueError:
                continue
            if not 330 <= days <= 390:
                continue
        elif concept != 'Eigen vermogen':
            continue
        facts.append({'concept': concept, 'tag': tag, 'start': start, 'end': end,
                      'unit': unit, 'val': value, 'entity_id': entity_id, 'source': filename, 'status': 'voorlopig'})
    return facts


def read_esef_package(data):
    """Leest ESEF ZIP of afzonderlijk XBRL/iXBRL document; geen netwerk."""
    if len(data) > MAX_ZIP_BYTES:
        raise ValueError('Het ESEF-pakket is te groot.')
    if not zipfile.is_zipfile(io.BytesIO(data)):
        return parse_instance(data)
    facts = []
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        candidates = [i for i in archive.infolist() if not i.is_dir()
                      and i.filename.lower().endswith(('.xbrl', '.xml', '.xhtml', '.html'))
                      and '/meta-inf/' not in '/' + i.filename.lower()]
        if sum(i.file_size for i in candidates) > MAX_ZIP_BYTES * 3:
            raise ValueError('ESEF-pakket bevat te veel uitgepakte gegevens.')
        for item in candidates:
            if item.file_size > MAX_MEMBER_BYTES:
                continue
            try:
                facts.extend(parse_instance(archive.read(item), item.filename))
            except ValueError:
                continue
    return facts


def annual_rows(facts, years=10, expected_lei=None):
    """Bouw jaarregels zonder dubbelingen of stille conflictoplossing.

    Een concept met afwijkende waarden voor dezelfde periode en valuta is
    onbetrouwbaar en wordt niet als gevalideerd financieel feit weergegeven.
    """
    if expected_lei is not None:
        from esef_discovery import validate_lei
        expected_lei = validate_lei(expected_lei)
    grouped = {}
    conflicts = set()
    identities = {}
    for fact in facts:
        if not isinstance(fact, dict) or not fact.get('end') or not fact.get('unit'):
            continue
        if expected_lei and str(fact.get('entity_id') or '').upper() != expected_lei:
            continue
        currency = fact['unit'].split('/')[0]
        key = (fact['end'], currency)
        identities.setdefault(key, set()).add(fact.get('entity_id') or '')
        concept = fact.get('concept')
        if not concept:
            continue
        group = grouped.setdefault(key, {})
        previous = group.get(concept)
        if previous is not None and previous['val'] != fact['val']:
            conflicts.add((key, concept))
        elif previous is None:
            group[concept] = dict(fact)
    for key, concept in conflicts:
        if concept in grouped[key]:
            del grouped[key][concept]
    # Balance-only periods cannot create an annual financial year.
    eligible = {(end, currency): group for (end, currency), group in grouped.items()
                if len(identities[(end, currency)]) == 1
                and any(name != 'Eigen vermogen' for name in group)}
    # Multiple currencies for the same period are never silently mixed.
    by_end = {}
    for (end, currency), group in eligible.items():
        by_end.setdefault(end, []).append((currency, group))
    rows = []
    for end in sorted(by_end, reverse=True):
        variants = by_end[end]
        if len(variants) != 1:
            continue
        currency, group = variants[0]
        rows.append({'end': end, 'unit': currency, 'facts': group})
        if len(rows) >= years:
            break
    return rows
