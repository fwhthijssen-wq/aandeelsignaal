"""Europese aandelen uit AEX, AMX, BEL 20, CAC 40, DAX, FTSE 100, FTSE MIB en IBEX 35 (samenstelling volgens Wikipedia, oktober 2026).

De samenstelling van indices verandert; dit is een bewuste momentopname. Deze bedrijven krijgen koersen, trend en koersbereik.
Jaarcijfers en een label komen er alleen bij als er een SEC-jaarverslag is dat de controle doorstaat (zie SEC_KOPPELING).
Beurzen: .AS Amsterdam, .PA Parijs, .DE Xetra, .MI Milaan, .MC Madrid, .BR Brussel (alle in euro), .L Londen (in pence, code GBX).
"""
BEURS = {'.AS': ('Amsterdam', 'EUR', 'Nederland'), '.PA': ('Parijs', 'EUR', 'Frankrijk'), '.DE': ('Xetra', 'EUR', 'Duitsland'),
         '.MI': ('Milaan', 'EUR', 'Italië'), '.MC': ('Madrid', 'EUR', 'Spanje'), '.BR': ('Brussel', 'EUR', 'België'),
         '.L': ('Londen', 'GBX', 'Verenigd Koninkrijk')}

# (ticker, naam, indices, land of None = standaard van de beurs)
LIJST = [
    # AEX
    ('ABN.AS', 'ABN AMRO', 'AEX'), ('ADYEN.AS', 'Adyen', 'AEX'), ('AGN.AS', 'Aegon', 'AEX'), ('AD.AS', 'Ahold Delhaize', 'AEX'),
    ('AKZA.AS', 'AkzoNobel', 'AEX'), ('MT.AS', 'ArcelorMittal', 'AEX,CAC40', 'Luxemburg'), ('ASM.AS', 'ASM International', 'AEX'),
    ('ASRNL.AS', 'ASR Nederland', 'AEX'), ('BESI.AS', 'BE Semiconductor', 'AEX'), ('DSFIR.AS', 'DSM-Firmenich', 'AEX', 'Zwitserland'),
    ('EXO.AS', 'Exor', 'AEX'), ('HEIA.AS', 'Heineken', 'AEX'), ('IMCD.AS', 'IMCD', 'AEX'), ('KPN.AS', 'KPN', 'AEX'),
    ('NN.AS', 'NN Group', 'AEX'), ('PRX.AS', 'Prosus', 'AEX'), ('RAND.AS', 'Randstad', 'AMX'), ('REN.AS', 'RELX', 'AEX,FTSE', 'Verenigd Koninkrijk'),
    ('UMG.AS', 'Universal Music Group', 'AEX'), ('WKL.AS', 'Wolters Kluwer', 'AEX'),
    ('CVC.AS', 'CVC Capital Partners', 'AEX', 'Jersey'), ('INPST.AS', 'InPost', 'AEX', 'Luxemburg'), ('SBMO.AS', 'SBM Offshore', 'AEX'),
    ('AALB.AS', 'Aalberts', 'AEX'),
    # AMX (Euronext, na de herziening van juni 2026; ongewijzigd in september 2026)
    ('AF.PA', 'Air France-KLM', 'AMX'), ('ALLFG.AS', 'Allfunds', 'AMX', 'Verenigd Koninkrijk'), ('AMG.AS', 'AMG Critical Materials', 'AMX'),
    ('ARCAD.AS', 'Arcadis', 'AMX'), ('BAMNB.AS', 'BAM Groep', 'AMX'), ('BFIT.AS', 'Basic-Fit', 'AMX'), ('CRBN.AS', 'Corbion', 'AMX'),
    ('CTPNV.AS', 'CTP', 'AMX'), ('ECMPA.AS', 'Eurocommercial Properties', 'AMX'), ('FAGR.BR', 'Fagron', 'AMX'),
    ('FLOW.AS', 'Flow Traders', 'AMX', 'Bermuda'), ('FUR.AS', 'Fugro', 'AMX'), ('GLPG.AS', 'Galapagos', 'AMX', 'België'),
    ('HAL.AS', 'HAL Trust', 'AMX', 'Bermuda'), ('HAVAS.AS', 'Havas', 'AMX'), ('HEIJM.AS', 'Heijmans', 'AMX'), ('PHARM.AS', 'Pharming', 'AMX'),
    ('LIGHT.AS', 'Signify', 'AMX'), ('TWEKA.AS', 'TKH Group', 'AMX'), ('VLK.AS', 'Van Lanschot Kempen', 'AMX'), ('VPK.AS', 'Vopak', 'AMX'),
    ('THEON.AS', 'Theon International', 'AMX', 'Cyprus'), ('CSG.AS', 'CSG', 'AMX'),
    # CAC 40
    ('AC.PA', 'Accor', 'CAC40'), ('AI.PA', 'Air Liquide', 'CAC40'), ('AIR.PA', 'Airbus', 'CAC40,DAX', 'Nederland'), ('BNP.PA', 'BNP Paribas', 'CAC40'),
    ('CS.PA', 'AXA', 'CAC40'), ('EN.PA', 'Bouygues', 'CAC40'), ('BVI.PA', 'Bureau Veritas', 'CAC40'), ('CAP.PA', 'Capgemini', 'CAC40'),
    ('CA.PA', 'Carrefour', 'CAC40'), ('ACA.PA', 'Crédit Agricole', 'CAC40'), ('BN.PA', 'Danone', 'CAC40'), ('DSY.PA', 'Dassault Systèmes', 'CAC40'),
    ('FGR.PA', 'Eiffage', 'CAC40'), ('ENGI.PA', 'Engie', 'CAC40'), ('EL.PA', 'EssilorLuxottica', 'CAC40'), ('ERF.PA', 'Eurofins Scientific', 'CAC40'),
    ('ENX.PA', 'Euronext', 'CAC40', 'Nederland'), ('RMS.PA', 'Hermès', 'CAC40'), ('KER.PA', 'Kering', 'CAC40'), ('OR.PA', "L'Oréal", 'CAC40'),
    ('LR.PA', 'Legrand', 'CAC40'), ('MC.PA', 'LVMH', 'CAC40'), ('ML.PA', 'Michelin', 'CAC40'), ('ORA.PA', 'Orange', 'CAC40'),
    ('RI.PA', 'Pernod Ricard', 'CAC40'), ('PUB.PA', 'Publicis', 'CAC40'), ('RNO.PA', 'Renault', 'CAC40'), ('SAF.PA', 'Safran', 'CAC40'),
    ('SGO.PA', 'Saint-Gobain', 'CAC40'), ('SU.PA', 'Schneider Electric', 'CAC40'), ('GLE.PA', 'Société Générale', 'CAC40'),
    ('STMPA.PA', 'STMicroelectronics', 'CAC40,MIB', 'Zwitserland'), ('HO.PA', 'Thales', 'CAC40'), ('TTE.PA', 'TotalEnergies', 'CAC40'),
    ('URW.PA', 'Unibail-Rodamco-Westfield', 'CAC40'), ('VIE.PA', 'Veolia', 'CAC40'), ('DG.PA', 'Vinci', 'CAC40'),
    # DAX
    ('ADS.DE', 'Adidas', 'DAX'), ('ALV.DE', 'Allianz', 'DAX'), ('BAS.DE', 'BASF', 'DAX'), ('BAYN.DE', 'Bayer', 'DAX'), ('BEI.DE', 'Beiersdorf', 'DAX'),
    ('BMW.DE', 'BMW', 'DAX'), ('BNR.DE', 'Brenntag', 'DAX'), ('CBK.DE', 'Commerzbank', 'DAX'), ('CON.DE', 'Continental', 'DAX'),
    ('DTG.DE', 'Daimler Truck', 'DAX'), ('DBK.DE', 'Deutsche Bank', 'DAX'), ('DB1.DE', 'Deutsche Börse', 'DAX'), ('DHL.DE', 'Deutsche Post (DHL)', 'DAX'),
    ('DTE.DE', 'Deutsche Telekom', 'DAX'), ('EOAN.DE', 'E.ON', 'DAX'), ('FRE.DE', 'Fresenius', 'DAX'), ('FME.DE', 'Fresenius Medical Care', 'DAX'),
    ('G1A.DE', 'GEA Group', 'DAX'), ('HNR1.DE', 'Hannover Rück', 'DAX'), ('HEI.DE', 'Heidelberg Materials', 'DAX'), ('HEN3.DE', 'Henkel', 'DAX'),
    ('IFX.DE', 'Infineon', 'DAX'), ('MBG.DE', 'Mercedes-Benz', 'DAX'), ('MRK.DE', 'Merck KGaA', 'DAX'), ('MTX.DE', 'MTU Aero Engines', 'DAX'),
    ('MUV2.DE', 'Munich Re', 'DAX'), ('PAH3.DE', 'Porsche SE', 'DAX'), ('QIA.DE', 'Qiagen', 'DAX'), ('RHM.DE', 'Rheinmetall', 'DAX'),
    ('RWE.DE', 'RWE', 'DAX'), ('G24.DE', 'Scout24', 'DAX'), ('SIE.DE', 'Siemens', 'DAX'), ('ENR.DE', 'Siemens Energy', 'DAX'),
    ('SHL.DE', 'Siemens Healthineers', 'DAX'), ('SY1.DE', 'Symrise', 'DAX'), ('VOW3.DE', 'Volkswagen', 'DAX'), ('VNA.DE', 'Vonovia', 'DAX'),
    ('ZAL.DE', 'Zalando', 'DAX'),
    # FTSE MIB
    ('A2A.MI', 'A2A', 'MIB'), ('AMP.MI', 'Amplifon', 'MIB'), ('AVIO.MI', 'Avio', 'MIB'), ('AZM.MI', 'Azimut', 'MIB'), ('BMED.MI', 'Banca Mediolanum', 'MIB'),
    ('BMPS.MI', 'Monte dei Paschi di Siena', 'MIB'), ('BAMI.MI', 'Banco BPM', 'MIB'), ('BPE.MI', 'BPER Banca', 'MIB'), ('BC.MI', 'Brunello Cucinelli', 'MIB'),
    ('BZU.MI', 'Buzzi', 'MIB'), ('CPR.MI', 'Campari', 'MIB'), ('DIA.MI', 'DiaSorin', 'MIB'), ('ENEL.MI', 'Enel', 'MIB'), ('FCT.MI', 'Fincantieri', 'MIB'),
    ('FBK.MI', 'FinecoBank', 'MIB'), ('G.MI', 'Generali', 'MIB'), ('HER.MI', 'Hera', 'MIB'), ('ISP.MI', 'Intesa Sanpaolo', 'MIB'), ('INW.MI', 'INWIT', 'MIB'),
    ('IG.MI', 'Italgas', 'MIB'), ('IVG.MI', 'Iveco', 'MIB'), ('LDO.MI', 'Leonardo', 'MIB'), ('LTMC.MI', 'Lottomatica', 'MIB'), ('MB.MI', 'Mediobanca', 'MIB'),
    ('MONC.MI', 'Moncler', 'MIB'), ('NEXI.MI', 'Nexi', 'MIB'), ('PST.MI', 'Poste Italiane', 'MIB'), ('PRY.MI', 'Prysmian', 'MIB'), ('REC.MI', 'Recordati', 'MIB'),
    ('SPM.MI', 'Saipem', 'MIB'), ('SRG.MI', 'Snam', 'MIB'), ('TIT.MI', 'Telecom Italia', 'MIB'), ('TEN.MI', 'Tenaris', 'MIB', 'Luxemburg'),
    ('TRN.MI', 'Terna', 'MIB'), ('UCG.MI', 'UniCredit', 'MIB'), ('UNI.MI', 'Unipol', 'MIB'),
    # IBEX 35
    ('ACS.MC', 'ACS', 'IBEX'), ('ACX.MC', 'Acerinox', 'IBEX'), ('AMS.MC', 'Amadeus IT', 'IBEX'), ('ANA.MC', 'Acciona', 'IBEX'),
    ('ANE.MC', 'Acciona Energía', 'IBEX'), ('BBVA.MC', 'BBVA', 'IBEX'), ('BKT.MC', 'Bankinter', 'IBEX'), ('CABK.MC', 'CaixaBank', 'IBEX'),
    ('CLNX.MC', 'Cellnex', 'IBEX'), ('COL.MC', 'Inmobiliaria Colonial', 'IBEX'), ('AENA.MC', 'Aena', 'IBEX'), ('ELE.MC', 'Endesa', 'IBEX'),
    ('ENG.MC', 'Enagás', 'IBEX'), ('FDR.MC', 'Fluidra', 'IBEX'), ('FER.MC', 'Ferrovial', 'IBEX'), ('GRF.MC', 'Grifols', 'IBEX'),
    ('IBE.MC', 'Iberdrola', 'IBEX'), ('IDR.MC', 'Indra', 'IBEX'), ('ITX.MC', 'Inditex', 'IBEX'), ('LOG.MC', 'Logista', 'IBEX'), ('MAP.MC', 'Mapfre', 'IBEX'),
    ('MRL.MC', 'Merlin Properties', 'IBEX'), ('NTGY.MC', 'Naturgy', 'IBEX'), ('PUIG.MC', 'Puig', 'IBEX'), ('RED.MC', 'Redeia', 'IBEX'),
    ('REP.MC', 'Repsol', 'IBEX'), ('ROVI.MC', 'Laboratorios Rovi', 'IBEX'), ('SAB.MC', 'Banco Sabadell', 'IBEX'), ('SAN.MC', 'Banco Santander', 'IBEX'),
    ('SCYR.MC', 'Sacyr', 'IBEX'), ('SLR.MC', 'Solaria', 'IBEX'), ('TEF.MC', 'Telefónica', 'IBEX'), ('UNI.MC', 'Unicaja', 'IBEX'),
    # BEL 20
    ('ABI.BR', 'AB InBev', 'BEL20'), ('ACKB.BR', 'Ackermans & van Haaren', 'BEL20'), ('AED.BR', 'Aedifica', 'BEL20'), ('AGS.BR', 'Ageas', 'BEL20'),
    ('ARGX.BR', 'argenx', 'BEL20'), ('APAM.AS', 'Aperam', 'BEL20,AMX', 'Luxemburg'), ('AZE.BR', 'Azelis', 'BEL20'), ('DIE.BR', "D'Ieteren", 'BEL20'),
    ('ELI.BR', 'Elia Group', 'BEL20'), ('GBLB.BR', 'GBL', 'BEL20'), ('KBC.BR', 'KBC', 'BEL20'), ('LOTB.BR', 'Lotus Bakeries', 'BEL20'),
    ('MELE.BR', 'Melexis', 'BEL20'), ('MONT.BR', 'Montea', 'BEL20'), ('SOF.BR', 'Sofina', 'BEL20'), ('SOLB.BR', 'Solvay', 'BEL20'),
    ('SYENS.BR', 'Syensqo', 'BEL20'), ('UCB.BR', 'UCB', 'BEL20'), ('UMI.BR', 'Umicore', 'BEL20'), ('WDP.BR', 'WDP', 'BEL20,AEX'),
    # FTSE 100 (zonder beleggingsfondsen en zonder bedrijven die hierboven al met hun hoofdnotering staan)
    ('III.L', '3i Group', 'FTSE'), ('ABDN.L', 'Aberdeen Group', 'FTSE'), ('ADM.L', 'Admiral Group', 'FTSE'), ('AAF.L', 'Airtel Africa', 'FTSE'),
    ('AAL.L', 'Anglo American', 'FTSE'), ('ANTO.L', 'Antofagasta', 'FTSE'), ('ABF.L', 'Associated British Foods', 'FTSE'), ('AUTO.L', 'Auto Trader', 'FTSE'),
    ('AV.L', 'Aviva', 'FTSE'), ('BAB.L', 'Babcock International', 'FTSE'), ('BA.L', 'BAE Systems', 'FTSE'), ('BBY.L', 'Balfour Beatty', 'FTSE'),
    ('BARC.L', 'Barclays', 'FTSE'), ('BTRW.L', 'Barratt Redrow', 'FTSE'), ('BP.L', 'BP', 'FTSE'), ('BATS.L', 'British American Tobacco', 'FTSE'),
    ('BLND.L', 'British Land', 'FTSE'), ('BT-A.L', 'BT Group', 'FTSE'), ('BNZL.L', 'Bunzl', 'FTSE'), ('BRBY.L', 'Burberry', 'FTSE'),
    ('CNA.L', 'Centrica', 'FTSE'), ('CCH.L', 'Coca-Cola HBC', 'FTSE', 'Zwitserland'), ('CPG.L', 'Compass Group', 'FTSE'), ('CCC.L', 'Computacenter', 'FTSE'),
    ('CTEC.L', 'Convatec', 'FTSE'), ('CRDA.L', 'Croda', 'FTSE'), ('DCC.L', 'DCC', 'FTSE'), ('DGE.L', 'Diageo', 'FTSE'), ('DPLM.L', 'Diploma', 'FTSE'),
    ('EZJ.L', 'easyJet', 'FTSE'), ('EDV.L', 'Endeavour Mining', 'FTSE'), ('EXPN.L', 'Experian', 'FTSE'), ('FRES.L', 'Fresnillo', 'FTSE'),
    ('GAW.L', 'Games Workshop', 'FTSE'), ('GLEN.L', 'Glencore', 'FTSE'), ('GSK.L', 'GSK', 'FTSE'), ('HLN.L', 'Haleon', 'FTSE'), ('HLMA.L', 'Halma', 'FTSE'),
    ('HSX.L', 'Hiscox', 'FTSE'), ('HWDN.L', 'Howdens Joinery', 'FTSE'), ('HSBA.L', 'HSBC', 'FTSE'), ('ICG.L', 'ICG', 'FTSE'), ('IGG.L', 'IG Group', 'FTSE'),
    ('IHG.L', 'InterContinental Hotels', 'FTSE'), ('IMI.L', 'IMI', 'FTSE'), ('IMB.L', 'Imperial Brands', 'FTSE'), ('INF.L', 'Informa', 'FTSE'),
    ('ITRK.L', 'Intertek', 'FTSE'), ('INVP.L', 'Investec', 'FTSE'), ('ITH.L', 'Ithaca Energy', 'FTSE'), ('JD.L', 'JD Sports', 'FTSE'),
    ('BGEO.L', 'Lion Finance Group', 'FTSE'), ('KGF.L', 'Kingfisher', 'FTSE'), ('LAND.L', 'Landsec', 'FTSE'), ('LGEN.L', 'Legal & General', 'FTSE'),
    ('LLOY.L', 'Lloyds Banking Group', 'FTSE'), ('LMP.L', 'LondonMetric Property', 'FTSE'), ('LSEG.L', 'London Stock Exchange Group', 'FTSE'),
    ('MNG.L', 'M&G', 'FTSE'), ('MKS.L', 'Marks & Spencer', 'FTSE'), ('MRO.L', 'Melrose Industries', 'FTSE'), ('MTLN.L', 'Metlen Energy & Metals', 'FTSE', 'Griekenland'),
    ('NG.L', 'National Grid', 'FTSE'), ('NWG.L', 'NatWest Group', 'FTSE'), ('NXT.L', 'Next', 'FTSE'), ('PSON.L', 'Pearson', 'FTSE'), ('PRU.L', 'Prudential', 'FTSE'),
    ('RKT.L', 'Reckitt', 'FTSE'), ('RTO.L', 'Rentokil Initial', 'FTSE'), ('RIO.L', 'Rio Tinto', 'FTSE'), ('RR.L', 'Rolls-Royce', 'FTSE'),
    ('SGE.L', 'Sage Group', 'FTSE'), ('SBRY.L', "Sainsbury's", 'FTSE'), ('SGRO.L', 'Segro', 'FTSE'), ('SVT.L', 'Severn Trent', 'FTSE'),
    ('SMIN.L', 'Smiths Group', 'FTSE'), ('SN.L', 'Smith & Nephew', 'FTSE'), ('SPX.L', 'Spirax Group', 'FTSE'), ('SSE.L', 'SSE', 'FTSE'),
    ('STAN.L', 'Standard Chartered', 'FTSE'), ('STJ.L', "St. James's Place", 'FTSE'), ('TSCO.L', 'Tesco', 'FTSE'), ('BBOX.L', 'Tritax Big Box REIT', 'FTSE'),
    ('UU.L', 'United Utilities', 'FTSE'), ('VOD.L', 'Vodafone', 'FTSE'), ('WEIR.L', 'Weir Group', 'FTSE'), ('WTB.L', 'Whitbread', 'FTSE'), ('WPP.L', 'WPP', 'FTSE'),
]

# Bedrijven die al eerder in de lijst stonden: alleen de indexlabels erbij.
BESTAANDE_INDEX = {'ASML.AS': 'AEX', 'INGA.AS': 'AEX', 'UNA.AS': 'AEX,FTSE', 'PHIA.AS': 'AEX', 'SAP.DE': 'DAX', 'SAN.PA': 'CAC40',
                   'RACE.MI': 'MIB', 'ENI.MI': 'MIB', 'STLAM.MI': 'MIB,CAC40', 'SHEL': 'AEX,FTSE', 'AZN': 'FTSE'}

# Beursnotering -> SEC-ticker voor bedrijven met een 20-F in euro en een notering in euro (anders geen omrekening mogelijk).
SEC_KOPPELING = {'DBK.DE': 'DB', 'BBVA.MC': 'BBVA', 'SAN.MC': 'SAN', 'TEF.MC': 'TEF', 'GRF.MC': 'GRFS'}


def catalogus():
    """[(ticker, naam, land, valuta, beurs)] voor de nieuwe aandelen."""
    uit, gezien = [], set()
    for rij in LIJST:
        ticker, naam = rij[0], rij[1]
        suffix = '.' + ticker.rsplit('.', 1)[1]
        beurs, valuta, land = BEURS[suffix]
        if len(rij) > 3 and rij[3]:
            land = rij[3]
        if ticker in gezien:
            raise ValueError(f'dubbele ticker {ticker}')
        gezien.add(ticker)
        uit.append((ticker, naam, land, valuta, beurs))
    return uit


def indices():
    """{ticker: ['AEX', ...]} voor alle aandelen met een indexlabel."""
    uit = {t: v.split(',') for t, v in BESTAANDE_INDEX.items()}
    for rij in LIJST:
        uit[rij[0]] = rij[2].split(',')
    return uit
