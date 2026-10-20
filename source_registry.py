"""Lokale, herbruikbare bronregistratie; bronbewijs is geen automatische validatie."""
import json
from pathlib import Path

DEFAULT_PATH = Path(__file__).with_name('bronregister.json')
REQUIRED = ('ticker', 'year', 'concept', 'value', 'unit', 'source', 'evidence_status')


def load_registry(path=None):
    target = Path(path) if path is not None else DEFAULT_PATH
    if not target.exists():
        return []
    data = json.loads(target.read_text(encoding='utf-8'))
    if not isinstance(data, list):
        raise ValueError('Bronregister moet een lijst zijn.')
    seen = set()
    for entry in data:
        if not isinstance(entry, dict) or any(k not in entry for k in REQUIRED):
            raise ValueError('Onvolledige bronregistratie.')
        key = (entry['ticker'], entry['year'], entry['concept'], entry['source'])
        if key in seen:
            raise ValueError('Dubbele bronregistratie.')
        seen.add(key)
    return data


def find_evidence(registry, ticker, year, concept):
    return [entry for entry in registry if entry['ticker'] == ticker and int(entry['year']) == int(year) and entry['concept'] == concept]
