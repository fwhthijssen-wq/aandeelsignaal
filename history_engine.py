"""Volledige SEC-boekjaren voor NAIC-onderzoek (geen TTM of kwartaalrapportages)."""
from collections import defaultdict, Counter
from source_engine import candidates_for, TAGS, duration_days

CONCEPTS = ('Omzet', 'Nettowinst', 'Operationele kasstroom', 'Investeringen in vaste activa', 'Winst per aandeel (verwaterd)')
from concept_registry import (EPS_TAGS, EQUITY_TAGS, ANNUAL_FORMS,
                              CAPEX_REVIEW_TAGS as CAPEX_ALTERNATIVE_TAGS,
                              MONETARY_UNITS)



def annual_history(payload, asof, years=10):
    """Selecteer uitsluitend jaarfeiten uit jaarrapporten met FY-context.

    10-Q-vergelijkingsperioden van 365 dagen zijn nadrukkelijk GEEN boekjaren.
    Houd valuta gescheiden; vergelijkingsjaren in 10-K blijven toegestaan.
    """
    out = defaultdict(dict)
    for concept in CONCEPTS[:-1]:
        for r in candidates_for(payload, EPS_TAGS if concept == 'Winst per aandeel (verwaterd)' else TAGS[concept], asof):
            if r.get('form') not in ANNUAL_FORMS or not 330 <= (duration_days(r) or 0) <= 390:
                continue
            if not r.get('start') or not r.get('accn'):
                continue
            # Bij SEC kan fp op een vergelijkingsjaar FY zijn; de feitelijke
            # begin- en einddatums blijven leidend.
            if r.get('fp') not in (None, 'FY'):
                continue
            key = (r['end'], r['unit'])
            old = out[key].get(concept)
            if old is None or (r['filed'], -r.get('tag_rank', 0)) > (old['filed'], -old.get('tag_rank', 0)):
                out[key][concept] = r
    # SEC `fp` beschrijft de indiening en niet noodzakelijk de periode van
    # het vergelijkende jaarfeit. Een volledig boekjaar in een 20-F/10-K met
    # bijvoorbeeld fp=Q4 mag alleen een ontbrekend concept aanvullen als het
    # jaarafsluitmoment én de valuta al door reguliere FY-feiten vaststaan.
    # Een reeds geselecteerd FY-feit wordt nooit overschreven.
    established = set(out)
    for concept in CONCEPTS[:-1]:
        candidates = candidates_for(payload, TAGS[concept], asof)
        for r in candidates:
            if (r.get('form') not in ANNUAL_FORMS or
                    not 330 <= (duration_days(r) or 0) <= 390 or
                    not r.get('start') or not r.get('accn') or
                    r.get('fp') in (None, 'FY')):
                continue
            key = (r['end'], r['unit'])
            if key not in established or concept in out[key]:
                continue
            # Twee verschillende waarden voor hetzelfde jaar/concept mogen
            # niet door een willekeurige volgorde worden opgelost.
            matches = [x for x in candidates
                       if x.get('end') == r['end'] and x.get('unit') == r['unit']
                       and x.get('form') in ANNUAL_FORMS
                       and 330 <= (duration_days(x) or 0) <= 390
                       and x.get('start') and x.get('accn')]
            if len({(x['start'], x['val']) for x in matches}) != 1:
                continue
            selected = max(matches, key=lambda x: (x['filed'], -x.get('tag_rank', 0)))
            out[key][concept] = dict(selected, comparative_annual_context=True,
                                     selection_reason='annual_filing_full_year_comparative')
    # Alternatieve investeringstag: NIET als geverifieerde capex samenvoegen.
    # Per boekjaar apart tonen zodat een analist de definitie kan toetsen.
    for r in candidates_for(payload, CAPEX_ALTERNATIVE_TAGS, asof):
        if (r.get('form') not in ANNUAL_FORMS or
                not 330 <= (duration_days(r) or 0) <= 390 or
                not r.get('start') or not r.get('accn') or
                r.get('fp') not in (None, 'FY')):
            continue
        key = (r['end'], r['unit'])
        old = out[key].get('Alternatieve investeringen (voorlopig)')
        if old is None or r['filed'] > old['filed']:
            out[key]['Alternatieve investeringen (voorlopig)'] = r
    # SEC rapporteert EPS in USD/shares (of andere valuta/shares), niet in USD.
    for namespace in ('us-gaap', 'ifrs-full'):
        for tag in EPS_TAGS:
            for unit, records in payload.get('facts', {}).get(namespace, {}).get(tag, {}).get('units', {}).items():
                if unit not in tuple(f"{unit}/shares" for unit in MONETARY_UNITS):
                    continue
                for r in records:
                    if (r.get('form') not in ANNUAL_FORMS or not 330 <= (duration_days(r) or 0) <= 390
                            or r.get('filed', '9999') > asof or r.get('end', '9999') > asof
                            or not r.get('accn') or not isinstance(r.get('val'), (int, float))):
                        continue
                    key = (r['end'], unit.split('/')[0])
                    old = out[key].get('Winst per aandeel (verwaterd)')
                    candidate = dict(r, unit=unit, tag=tag, namespace=namespace, eps_source_filed=r['filed'])
                    if old is None or candidate['filed'] > old['filed']:
                        out[key]['Winst per aandeel (verwaterd)'] = candidate
    # Eigen vermogen is een balansmoment, geen jaarstroom. Alleen USD/EUR/GBP
    # en SEC-jaarverslagen, nooit een kwartaal als vervangend jaarcijfer.
    for tag_rank, tag in enumerate(EQUITY_TAGS):
        for namespace in ('us-gaap', 'ifrs-full'):
            for unit, records in payload.get('facts', {}).get(namespace, {}).get(tag, {}).get('units', {}).items():
                if unit not in MONETARY_UNITS:
                    continue
                for r in records:
                    if (r.get('form') not in ANNUAL_FORMS or r.get('start')
                            or r.get('end', '9999') > asof or r.get('filed', '9999') > asof
                            or not r.get('accn') or not isinstance(r.get('val'), (int, float))):
                        continue
                    key = (r['end'], unit)
                    old = out[key].get('Eigen vermogen')
                    candidate = dict(r, unit=unit, tag=tag, namespace=namespace, tag_rank=tag_rank)
                    if old is None or (candidate['filed'], -tag_rank) > (old['filed'], -old.get('tag_rank', 0)):
                        out[key]['Eigen vermogen'] = candidate
    # Een openingsbalans (bijvoorbeeld 2018-01-01) is geen boekjaar.
    # Selecteer de tien boekjaareinden uitsluitend op basis van jaarlijkse
    # stroomcijfers; anders verdringt een losse balansdatum het oudste jaar.
    annual_concepts = set(CONCEPTS) | {'Alternatieve investeringen (voorlopig)'}
    ends = sorted({end for (end, unit), facts in out.items()
                   if annual_concepts.intersection(facts)}, reverse=True)[:years]
    rows = [{'end': end, 'unit': unit, 'facts': out[end, unit]}
            for end in ends for unit in sorted(u for e, u in out if e == end)
            if annual_concepts.intersection(out[end, unit])]
    # Een SEC-dossier kan een incidenteel historisch feit in een andere valuta
    # bevatten (SAP: 2017 USD naast EUR). Dat is geen tweede boekjaar.
    # Kies alleen bij een overtuigende meerderheid de verslagvaluta;
    # bij een echte valuta-overgang blijft de reeks expliciet gescheiden.
    year_counts = Counter(row['unit'] for row in rows)
    if len(year_counts) > 1:
        primary, count = year_counts.most_common(1)[0]
        if count >= 5 and count >= 3 * (len(rows) - count):
            rows = [row for row in rows if row['unit'] == primary]
    return rows


def investment_tag_diagnostics(payload, asof, years=10):
    """Inventariseer SEC-tags met investerings-/aankoopcontext, zonder ze als capex te behandelen.

    Verschillende investeringsconcepten zijn NIET zonder financiële definitie uitwisselbaar.
    """
    tags = []
    for namespace, catalog in payload.get('facts', {}).items():
        for tag, spec in catalog.items():
            name = tag.lower()
            if not any(term in name for term in ('paymentstoacquire', 'capitalexpenditure', 'purchaseofproperty')):
                continue
            observations = []
            for unit, rows in spec.get('units', {}).items():
                if unit not in MONETARY_UNITS:
                    continue
                for r in rows:
                    if (r.get('form') in ANNUAL_FORMS and r.get('filed', '9999') <= asof
                        and r.get('end', '9999') <= asof and 330 <= (duration_days(r) or 0) <= 390
                        and isinstance(r.get('val'), (int, float))):
                        observations.append(r['end'])
            if observations:
                tags.append({'namespace': namespace, 'tag': tag,
                             'jaarafsluitingen': ', '.join(sorted(set(observations), reverse=True)[:years]),
                             'aantal_jaren': len(set(observations))})
    return sorted(tags, key=lambda x: (-x['aantal_jaren'], x['tag']))
