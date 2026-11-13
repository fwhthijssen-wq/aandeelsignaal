import json, unittest
import sec_instance as si

XML = b'''<?xml version="1.0" encoding="utf-8"?>
<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:iso4217="http://www.xbrl.org/2003/iso4217"
 xmlns:ifrs-full="https://xbrl.ifrs.org/taxonomy/2025-03-27/ifrs-full" xmlns:dei="http://xbrl.sec.gov/dei/2024"
 xmlns:xbrldi="http://xbrl.org/2006/xbrldi" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
 <xbrli:context id="D2025"><xbrli:entity><xbrli:identifier scheme="http://www.sec.gov/CIK">0001046179</xbrli:identifier></xbrli:entity>
  <xbrli:period><xbrli:startDate>2025-01-01</xbrli:startDate><xbrli:endDate>2025-12-31</xbrli:endDate></xbrli:period></xbrli:context>
 <xbrli:context id="D2024"><xbrli:entity><xbrli:identifier scheme="http://www.sec.gov/CIK">0001046179</xbrli:identifier></xbrli:entity>
  <xbrli:period><xbrli:startDate>2024-01-01</xbrli:startDate><xbrli:endDate>2024-12-31</xbrli:endDate></xbrli:period></xbrli:context>
 <xbrli:context id="I2025"><xbrli:entity><xbrli:identifier scheme="http://www.sec.gov/CIK">0001046179</xbrli:identifier></xbrli:entity>
  <xbrli:period><xbrli:instant>2025-12-31</xbrli:instant></xbrli:period></xbrli:context>
 <xbrli:context id="Seg"><xbrli:entity><xbrli:identifier scheme="http://www.sec.gov/CIK">0001046179</xbrli:identifier>
  <xbrli:segment><xbrldi:explicitMember dimension="ifrs-full:SegmentsAxis">x:Y</xbrldi:explicitMember></xbrli:segment></xbrli:entity>
  <xbrli:period><xbrli:startDate>2025-01-01</xbrli:startDate><xbrli:endDate>2025-12-31</xbrli:endDate></xbrli:period></xbrli:context>
 <xbrli:unit id="TWD"><xbrli:measure>iso4217:TWD</xbrli:measure></xbrli:unit>
 <xbrli:unit id="USD"><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unit>
 <xbrli:unit id="sh"><xbrli:measure>xbrli:shares</xbrli:measure></xbrli:unit>
 <xbrli:unit id="TWDps"><xbrli:divide><xbrli:unitNumerator><xbrli:measure>iso4217:TWD</xbrli:measure></xbrli:unitNumerator>
  <xbrli:unitDenominator><xbrli:measure>xbrli:shares</xbrli:measure></xbrli:unitDenominator></xbrli:divide></xbrli:unit>
 <dei:DocumentType contextRef="D2025">20-F</dei:DocumentType>
 <ifrs-full:Revenue contextRef="D2025" unitRef="TWD" decimals="-6">3809054000000</ifrs-full:Revenue>
 <ifrs-full:Revenue contextRef="D2025" unitRef="USD" decimals="-6">116000000000</ifrs-full:Revenue>
 <ifrs-full:Revenue contextRef="D2024" unitRef="TWD" decimals="-6">2894308000000</ifrs-full:Revenue>
 <ifrs-full:Revenue contextRef="Seg" unitRef="TWD" decimals="-6">1</ifrs-full:Revenue>
 <ifrs-full:DilutedEarningsLossPerShare contextRef="D2025" unitRef="TWDps" decimals="2">66.25</ifrs-full:DilutedEarningsLossPerShare>
 <ifrs-full:DilutedEarningsLossPerShare contextRef="D2025" unitRef="TWDps" decimals="2">66.25</ifrs-full:DilutedEarningsLossPerShare>
 <ifrs-full:Equity contextRef="I2025" unitRef="TWD" decimals="-6">5000000000000</ifrs-full:Equity>
 <ifrs-full:AdjustedWeightedAverageShares contextRef="D2025" unitRef="sh" decimals="-3">25930000000</ifrs-full:AdjustedWeightedAverageShares>
</xbrli:xbrl>'''


def payload():
    def r(accn, filed, start, end, val, form='20-F'):
        return {'start': start, 'end': end, 'val': val, 'accn': accn, 'fy': int(filed[:4]) - 1, 'fp': 'FY', 'form': form, 'filed': filed}
    return {'cik': 1046179, 'facts': {
        'dei': {'EntityCommonStockSharesOutstanding': {'units': {'shares': [
            {'end': '2024-12-31', 'val': 1, 'accn': 'A-24', 'fy': 2024, 'fp': 'FY', 'form': '20-F', 'filed': '2025-04-17'},
            {'end': '2025-12-31', 'val': 1, 'accn': 'A-25', 'fy': 2025, 'fp': 'FY', 'form': '20-F', 'filed': '2026-04-16'}]}}},
        'ifrs-full': {'Revenue': {'units': {'TWD': [r('A-24', '2025-04-17', '2024-01-01', '2024-12-31', 2894308000000)]}}}}}


class Instance(unittest.TestCase):
    def test_ontbrekend_verslag(self):
        self.assertEqual(si.ontbrekend_verslag(payload()), ('A-25', '20-F', '2026-04-16', 2025))
        p = payload(); p['facts']['ifrs-full']['Revenue']['units']['TWD'].append(dict(p['facts']['ifrs-full']['Revenue']['units']['TWD'][0], accn='A-25', filed='2026-04-16'))
        self.assertIsNone(si.ontbrekend_verslag(p))
        self.assertIsNone(si.ontbrekend_verslag({'facts': {}}))

    def test_feiten_uit_instance(self):
        f = si.feiten_uit_instance(XML, 'A-25', '20-F', '2026-04-16', 2025)
        self.assertEqual(sorted(f), ['ifrs-full'])                                   # dei en segmenten niet
        rev = f['ifrs-full']['Revenue']['units']
        self.assertEqual(sorted((x['end'], x['val']) for x in rev['TWD']), [('2024-12-31', 2894308000000), ('2025-12-31', 3809054000000)])
        self.assertEqual(rev['USD'][0]['val'], 116000000000)
        eps = f['ifrs-full']['DilutedEarningsLossPerShare']['units']['TWD/shares']
        self.assertEqual(len(eps), 1); self.assertEqual(eps[0]['val'], 66.25); self.assertEqual(eps[0]['start'], '2025-01-01')
        self.assertEqual(f['ifrs-full']['Equity']['units']['TWD'][0], {'end': '2025-12-31', 'val': 5000000000000, 'accn': 'A-25', 'fy': 2025,
                                                                       'fp': 'FY', 'form': '20-F', 'filed': '2026-04-16', 'bron': 'xbrl-instance'})
        self.assertIn('shares', f['ifrs-full']['AdjustedWeightedAverageShares']['units'])

    def test_aanvullen_zonder_wijziging_van_het_origineel(self):
        p = payload(); voor = json.dumps(p, sort_keys=True)
        urls = []
        def haal(url):
            urls.append(url)
            if url.endswith('index.json'):
                return json.dumps({'directory': {'item': [{'name': 'tsm-20251231.htm'}, {'name': 'tsm-20251231_htm.xml'}, {'name': 'tsm-20251231_lab.xml'}]}}).encode()
            return XML
        nieuw, info = si.aanvullen(p, 1046179, 'x@y.z', haal=haal)
        self.assertEqual(json.dumps(p, sort_keys=True), voor)
        self.assertEqual(urls[0], 'https://www.sec.gov/Archives/edgar/data/1046179/A25/index.json')
        self.assertTrue(urls[1].endswith('/tsm-20251231_htm.xml'))
        self.assertEqual(info['accn'], 'A-25'); self.assertGreater(info['feiten'], 4)
        self.assertEqual(len(nieuw['facts']['ifrs-full']['Revenue']['units']['TWD']), 3)
        self.assertIsNone(si.ontbrekend_verslag(nieuw))

    def test_fout_geeft_origineel(self):
        p = payload()
        def haal(url):
            raise OSError('weg')
        nieuw, info = si.aanvullen(p, 1046179, 'x@y.z', haal=haal)
        self.assertIs(nieuw, p); self.assertIn('fout', info)


if __name__ == '__main__':
    unittest.main()


class Register(unittest.TestCase):
    def test_nieuwer_jaarverslag_uit_het_register(self):
        p = payload(); p['facts'].pop('dei')                       # Chunghwa: niets van het nieuwe verslag in companyfacts
        sub = {'filings': {'recent': {'accessionNumber': ['A-6K', 'A-25', 'A-24'], 'form': ['6-K', '20-F', '20-F'],
                                      'filingDate': ['2026-11-10', '2026-04-15', '2025-04-17'],
                                      'reportDate': ['', '2025-12-31', '2024-12-31'], 'isXBRL': [0, 1, 1]}}}
        haal = lambda url: json.dumps(sub).encode()
        self.assertEqual(si.nieuwer_in_register(p, 1132924, haal, '2026-11-13'), ('A-25', '20-F', '2026-04-15', 2025))
        self.assertIsNone(si.nieuwer_in_register(p, 1132924, haal, '2026-01-13'))      # nog geen 13 maanden: niet kijken
