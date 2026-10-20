"""ESEF filing discovery and guarded retrieval, independent of issuer-specific rules.

The public filings.xbrl.org JSON:API supplies filing attributes and linked entity
resources. Imported facts remain unverified until taxonomy/consolidation checks.
"""
from __future__ import annotations
import hashlib
import json
from urllib.parse import urlparse, urljoin
from urllib.request import Request, urlopen
from esef_discovery import validate_lei, api_url
from esef_import import read_esef_package, annual_rows, MAX_ZIP_BYTES
from esef_json import parse_xbrl_json, MAX_JSON_BYTES

HOST = 'filings.xbrl.org'
MAX_INDEX_BYTES = 5_000_000
MAX_PAGES = 15


def _safe_url(url):
    if not isinstance(url, str):
        raise ValueError('Geen geldige rapportage-URL.')
    if url.startswith("/") and not url.startswith("//"):
        url = urljoin("https://filings.xbrl.org", url)
    p = urlparse(url)
    if (p.scheme != 'https' or p.hostname != HOST or p.username or p.password
            or p.port or not p.path.startswith('/') or p.path.startswith('//')
            or p.fragment):
        raise ValueError('Rapportage-URL is niet afkomstig van de toegestane ESEF-bron.')
    return url


def _get(url, opener=None, limit=MAX_ZIP_BYTES):
    opener = opener or urlopen
    request = Request(_safe_url(url), headers={'User-Agent': 'AandeelSignaal/4.8 ESEF reader', 'Accept': '*/*'})
    with opener(request, timeout=35) as response:
        final_url = response.geturl() if hasattr(response, 'geturl') else url
        _safe_url(final_url)
        declared = response.headers.get('Content-Length') if hasattr(response, 'headers') else None
        if declared and int(declared) > limit:
            raise ValueError('ESEF-download overschrijdt de maximale bestandsgrootte.')
        payload = response.read(limit + 1)
    if len(payload) > limit:
        raise ValueError('ESEF-download is te groot.')
    return payload


def _entity_ids(document):
    return {str(x.get('id')): str((x.get('attributes') or {}).get('identifier') or '').upper()
            for x in document.get('included', []) if x.get('type') in ('entity', 'entities')}


def _filing_identity(item, entity_ids):
    attrs = item.get('attributes') or {}
    entity = attrs.get('entity') or {}
    if isinstance(entity, dict) and entity.get('identifier'):
        return str(entity['identifier']).upper()
    relationship = (item.get('relationships') or {}).get('entity') or {}
    relation = relationship.get('data') or {}
    return entity_ids.get(str(relation.get('id')), '') if isinstance(relation, dict) else ''


def filings_for_lei(lei, opener=None):
    lei = validate_lei(lei)
    url = api_url(lei)
    results = {}
    seen_pages = set()
    for _ in range(MAX_PAGES):
        if url in seen_pages:
            raise ValueError('De ESEF-index bevat een herhalende paginaverwijzing.')
        seen_pages.add(url)
        document = json.loads(_get(url, opener, MAX_INDEX_BYTES))
        entity_ids = _entity_ids(document)
        for item in document.get('data', []):
            attrs = item.get('attributes') or {}
            if _filing_identity(item, entity_ids) != lei:
                continue
            # No guessed ESEF classification when a system is explicitly specified.
            system = str(attrs.get('filing_system') or attrs.get('filing-system') or 'ESEF').upper()
            if system != 'ESEF':
                continue
            package = attrs.get('package_url') or attrs.get('package-url')
            json_url = attrs.get('json_url') or attrs.get('json-url')
            try:
                package = _safe_url(package) if package else None
                json_url = _safe_url(json_url) if json_url else None
            except ValueError:
                continue
            if not package and not json_url:
                continue
            identifier = str(item.get('id') or package or json_url)
            results[identifier] = {'lei': lei, 'period_end': attrs.get('period_end') or attrs.get('period-end'),
                                   'package_url': package, 'json_url': json_url, 'filing_id': identifier,
                                   'sha256': attrs.get('sha256'), 'errors': attrs.get('error_count'),
                                   'status': 'bron beschikbaar; inhoud niet gevalideerd'}
        next_page = (document.get('links') or {}).get('next')
        if isinstance(next_page, dict):
            next_page = next_page.get('href')
        if not next_page:
            break
        url = _safe_url(next_page)
    else:
        raise ValueError('ESEF-resultaat overschrijdt de ingestelde paginalimiet; resultaten zijn niet volledig.')
    return sorted(results.values(), key=lambda x: x['period_end'] or '', reverse=True)


def fetch_filing(filing, opener=None):
    """Prefer the structured report; use the original package if it is unusable.

    An empty or unsupported JSON extraction must not silently count as a
    successful annual report. The fallback is independent of the issuer.
    """
    errors = []
    for kind, url in (("json", filing.get('json_url')),
                      ("package", filing.get('package_url'))):
        if not url:
            continue
        try:
            content = _get(url, opener, MAX_JSON_BYTES if kind == 'json' else MAX_ZIP_BYTES)
            digest = hashlib.sha256(content).hexdigest()
            if kind == 'json':
                facts = parse_xbrl_json(content, source=url)
            else:
                expected = filing.get('sha256')
                if expected and expected.lower() != digest.lower():
                    raise ValueError('SHA-256 van het gedownloade ESEF-pakket komt niet overeen.')
                facts = read_esef_package(content)
            # Audit absent parent equity against the *same downloaded JSON*,
            # avoiding another network request or an issuer-specific rule.
            equity_audit = None
            if kind == 'json' and not any(f.get('concept') == 'Eigen vermogen' for f in facts):
                from esef_equity_audit import audit_equity_json
                equity_audit = audit_equity_json(content, filing.get('lei') or '')
            history = annual_rows(facts, expected_lei=filing.get('lei'))
            if not history:
                raise ValueError('Geen bruikbare jaarfeiten in dit formaat.')
            return {'filing': filing, 'sha256': digest, 'facts': facts,
                    'annual_history': history, 'format': kind,
                    'source_url': url, 'fallback_reasons': errors, 'equity_audit': equity_audit,
                    'status': 'voorlopig, niet voor automatische waardering'}
        except (ValueError, OSError, TimeoutError, KeyError, TypeError) as exc:
            errors.append(f'{kind}: {exc}')
    if not errors:
        raise ValueError('Geen ondersteund ESEF-downloadformaat gevonden.')
    raise ValueError('Geen bruikbare ESEF-jaarfeiten: ' + '; '.join(errors))
