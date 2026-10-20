"""Generieke Europese ESEF-indexontsluiting op basis van LEI.

filings.xbrl.org is een herpublicatie van OAM-rapportages; dit is
bronontdekking, geen bevestiging van financiële juistheid.
"""
from __future__ import annotations
import re
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen
import json

API = 'https://filings.xbrl.org/api/filings'
LEI_PATTERN = re.compile(r'^[A-Z0-9]{18}[0-9]{2}$')


def validate_lei(lei):
    """Controleer LEI-formaat én ISO 17442 mod-97 controlecijfers."""
    lei = (lei or '').strip().upper()
    if not LEI_PATTERN.fullmatch(lei):
        raise ValueError('Ongeldige LEI: verwacht twintig tekens, eindigend op twee cijfers.')
    digits = ''.join(c if c.isdigit() else str(ord(c) - 55) for c in lei)
    if int(digits) % 97 != 1:
        raise ValueError('Ongeldige LEI-controlecijfers.')
    return lei


def api_url(lei, page_size=100):
    lei = validate_lei(lei)
    if not 1 <= page_size <= 100:
        raise ValueError('Ongeldige paginagrootte.')
    return API + '?' + urlencode({'filter[entity.identifier]': lei, 'page[size]': page_size, 'include': 'entity'})


def parse_index(payload, lei):
    """Vertrouw niet blind op API-filtering: controleer LEI per resultaat."""
    lei = validate_lei(lei)
    records = []
    for item in payload.get('data', []):
        attrs = item.get('attributes') or {}
        entity = attrs.get('entity') or {}
        identifier = (entity.get('identifier') if isinstance(entity, dict) else None)
        if identifier != lei:
            continue
        system = str(attrs.get('filing_system') or attrs.get('filing-system') or '')
        if system.upper() != 'ESEF':
            continue
        links = item.get('links') or {}
        detail = links.get('self')
        if isinstance(detail, dict):
            detail = detail.get('href')
        if not isinstance(detail, str) or urlparse(detail).hostname != 'filings.xbrl.org':
            detail = None
        records.append({'lei': lei, 'period_end': attrs.get('period_end') or attrs.get('period-end'),
                        'filing_id': item.get('id'), 'detail_url': detail, 'status': 'bron gevonden, nog niet gevalideerd'})
    return records


def discover(lei, opener=None):
    url = api_url(lei)
    if opener is None:
        opener = urlopen
    with opener(Request(url, headers={'User-Agent': 'AandeelSignaal/4.8 ESEF source discovery', 'Accept': 'application/vnd.api+json'}), timeout=20) as response:
        payload = json.load(response)
    return parse_index(payload, validate_lei(lei))
