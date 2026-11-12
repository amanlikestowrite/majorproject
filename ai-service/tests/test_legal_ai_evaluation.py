"""
Nyaya Sahayak — Legal AI Evaluation Test Suite
Evaluates:
1. 64 Representative legal queries across 5 canonical topics in English and Hindi.
2. Retrieval relevance and citation correctness.
3. Historical-data warnings for point-in-time statistics.
4. Unsupported-question abstention for out-of-scope, speculative, or prohibited queries.
5. Separate evaluation for English and Hindi queries.
"""

import pytest
from typing import Dict, Any, List
from app.services.generator import ResponseSynthesizer
from app.models.response import ChatResponse


# ============================================================================
# 64 REPRESENTATIVE LEGAL TEST QUERIES BENCHMARK DATASET
# ============================================================================

LEGAL_BENCHMARK_QUERIES: List[Dict[str, Any]] = [
    # ------------------------------------------------------------------------
    # 1. eCourts & Case Tracking (12 queries: 6 English, 6 Hindi)
    # ------------------------------------------------------------------------
    {
        "id": "EC_EN_01",
        "topic": "eCourts Services and Case Status",
        "language": "en",
        "query": "How can I check my civil suit case status online using the 16-character CNR number?",
        "expected_portal_domain": "services.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "EC_EN_02",
        "topic": "eCourts Services and Case Status",
        "language": "en",
        "query": "Where can I view today's daily court cause list for the District Court?",
        "expected_portal_domain": "services.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "EC_EN_03",
        "topic": "eCourts Services and Case Status",
        "language": "en",
        "query": "How can I apply for an online digital certified copy of a judgment?",
        "expected_portal_domain": "services.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "EC_EN_04",
        "topic": "eCourts Services and Case Status",
        "language": "en",
        "query": "How do I search for a pending court case by litigant party name?",
        "expected_portal_domain": "services.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "EC_EN_05",
        "topic": "eCourts Services and Case Status",
        "language": "en",
        "query": "What services are provided to citizens at e-Sewa Kendras inside court complexes?",
        "expected_portal_domain": "services.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "EC_EN_06",
        "topic": "eCourts Services and Case Status",
        "language": "en",
        "query": "How can an advocate maintain a digital case diary on the eCourts mobile app?",
        "expected_portal_domain": "services.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "EC_HI_01",
        "topic": "eCourts Services and Case Status",
        "language": "hi",
        "query": "16 अंकों के सीएनआर (CNR) नंबर से ई-कोर्ट्स पर केस स्टेटस कैसे देखें?",
        "expected_portal_domain": "services.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "EC_HI_02",
        "topic": "eCourts Services and Case Status",
        "language": "hi",
        "query": "जिला अदालत की दैनिक कॉज लिस्ट (Cause List) ऑनलाइन कहाँ देख सकते हैं?",
        "expected_portal_domain": "services.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "EC_HI_03",
        "topic": "eCourts Services and Case Status",
        "language": "hi",
        "query": "अदालत के फैसले की डिजिटल प्रमाणित प्रति (Certified Copy) के लिए आवेदन कैसे करें?",
        "expected_portal_domain": "services.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "EC_HI_04",
        "topic": "eCourts Services and Case Status",
        "language": "hi",
        "query": "बिना सीएनआर नंबर के पक्षकार (Party Name) के नाम से केस कैसे खोजें?",
        "expected_portal_domain": "services.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "EC_HI_05",
        "topic": "eCourts Services and Case Status",
        "language": "hi",
        "query": "कोर्ट परिसर में बने ई-सेवा केंद्र पर क्या नागरिक सुविधाएं मिलती हैं?",
        "expected_portal_domain": "services.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "EC_HI_06",
        "topic": "eCourts Services and Case Status",
        "language": "hi",
        "query": "वकील ई-कोर्ट्स सर्विसेज मोबाइल ऐप पर डिजिटल केस डायरी कैसे बना सकते हैं?",
        "expected_portal_domain": "services.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },

    # ------------------------------------------------------------------------
    # 2. eFiling 3.0 & ePay (12 queries: 6 English, 6 Hindi)
    # ------------------------------------------------------------------------
    {
        "id": "EF_EN_01",
        "topic": "eFiling and ePay",
        "language": "en",
        "query": "What are the registration steps and credentials for eFiling 3.0?",
        "expected_portal_domain": "efiling.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "EF_EN_02",
        "topic": "eFiling and ePay",
        "language": "en",
        "query": "Can petitions on eFiling 3.0 be signed using Aadhaar eSign instead of USB DSC?",
        "expected_portal_domain": "efiling.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "EF_EN_03",
        "topic": "eFiling and ePay",
        "language": "en",
        "query": "What are the scanning DPI and OCR specifications for uploading petitions on eFiling?",
        "expected_portal_domain": "efiling.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "EF_EN_04",
        "topic": "eFiling and ePay",
        "language": "en",
        "query": "How do I pay deficit court fees online via ePay after a defect notice?",
        "expected_portal_domain": "efiling.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "EF_EN_05",
        "topic": "eFiling and ePay",
        "language": "en",
        "query": "How is a Vakalatnama authorized electronically using client OTP in eFiling?",
        "expected_portal_domain": "efiling.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "EF_EN_06",
        "topic": "eFiling and ePay",
        "language": "en",
        "query": "What is the midnight limitation cut-off time for electronic filings?",
        "expected_portal_domain": "efiling.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "EF_HI_01",
        "topic": "eFiling and ePay",
        "language": "hi",
        "query": "ई-फाइलिंग 3.0 पोर्टल पर अधिवक्ता और पक्षकार पंजीकरण कैसे करें?",
        "expected_portal_domain": "efiling.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "EF_HI_02",
        "topic": "eFiling and ePay",
        "language": "hi",
        "query": "क्या ई-फाइलिंग में याचिकाओं पर हस्ताक्षर के लिए आधार ई-साइन का उपयोग किया जा सकता है?",
        "expected_portal_domain": "efiling.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "EF_HI_03",
        "topic": "eFiling and ePay",
        "language": "hi",
        "query": "ई-फाइलिंग के लिए दस्तावेज स्कैन करने के डीपीआई (DPI) और ओसीआर (OCR) नियम क्या हैं?",
        "expected_portal_domain": "efiling.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "EF_HI_04",
        "topic": "eFiling and ePay",
        "language": "hi",
        "query": "रजिस्ट्री की आपत्ति के बाद ई-पे (ePay) से कम कोर्ट फीस (Deficit Fee) कैसे भरें?",
        "expected_portal_domain": "efiling.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "EF_HI_05",
        "topic": "eFiling and ePay",
        "language": "hi",
        "query": "ई-फाइलिंग में मुवक्किल के मोबाइल ओटीपी द्वारा वकालतनामा कैसे सत्यापित होता है?",
        "expected_portal_domain": "efiling.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "EF_HI_06",
        "topic": "eFiling and ePay",
        "language": "hi",
        "query": "ई-फाइलिंग में मियाद (Limitation) के लिए रात्रि समय सीमा क्या मानी जाती है?",
        "expected_portal_domain": "efiling.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },

    # ------------------------------------------------------------------------
    # 3. Tele-Law 2.0 & Legal Aid (12 queries: 6 English, 6 Hindi)
    # ------------------------------------------------------------------------
    {
        "id": "TL_EN_01",
        "topic": "Tele-Law",
        "language": "en",
        "query": "Who is eligible for free pre-litigation legal advice under Tele-Law?",
        "expected_portal_domain": "tele-law.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "TL_EN_02",
        "topic": "Tele-Law",
        "language": "en",
        "query": "How does Tele-Law 2.0 integrate with Nyaya Bandhu for free court representation?",
        "expected_portal_domain": "tele-law.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "TL_EN_03",
        "topic": "Tele-Law",
        "language": "en",
        "query": "Can a citizen book a Tele-Law lawyer appointment directly from the mobile app without CSC?",
        "expected_portal_domain": "tele-law.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "TL_EN_04",
        "topic": "Tele-Law",
        "language": "en",
        "query": "Who is entitled to free legal aid under Section 12 of the Legal Services Authorities Act?",
        "expected_portal_domain": "tele-law.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "TL_EN_05",
        "topic": "Tele-Law",
        "language": "en",
        "query": "What is the Legal Aid Defense Counsel System (LADCS) for undertrials in criminal courts?",
        "expected_portal_domain": "tele-law.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "TL_EN_06",
        "topic": "Tele-Law",
        "language": "en",
        "query": "Is an award passed by a National Lok Adalat final and non-appealable?",
        "expected_portal_domain": "tele-law.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "TL_HI_01",
        "topic": "Tele-Law",
        "language": "hi",
        "query": "टेली-लॉ योजना के तहत मुफ्त कानूनी सलाह पाने के पात्र कौन हैं?",
        "expected_portal_domain": "tele-law.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "TL_HI_02",
        "topic": "Tele-Law",
        "language": "hi",
        "query": "टेली-लॉ 2.0 न्याय बंधु योजना से जुड़कर अदालत में वकील कैसे उपलब्ध कराता है?",
        "expected_portal_domain": "tele-law.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "TL_HI_03",
        "topic": "Tele-Law",
        "language": "hi",
        "query": "क्या नागरिक सीएससी केंद्र जाए बिना सीधे टेली-लॉ मोबाइल ऐप से वकील बुक कर सकते हैं?",
        "expected_portal_domain": "tele-law.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "TL_HI_04",
        "topic": "Tele-Law",
        "language": "hi",
        "query": "विधिक सेवा प्राधिकरण अधिनियम की धारा 12 के तहत किन लोगों को मुफ्त वकील मिलता है?",
        "expected_portal_domain": "tele-law.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "TL_HI_05",
        "topic": "Tele-Law",
        "language": "hi",
        "query": "आपराधिक मामलों में कैदियों के लिए लीगल एड डिफेंस काउंसिल सिस्टम (LADCS) कैसे काम करता है?",
        "expected_portal_domain": "tele-law.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "TL_HI_06",
        "topic": "Tele-Law",
        "language": "hi",
        "query": "क्या राष्ट्रीय लोक अदालत के फैसले के खिलाफ अपील की जा सकती है?",
        "expected_portal_domain": "tele-law.in",
        "is_abstention": False,
        "is_dynamic": False,
    },

    # ------------------------------------------------------------------------
    # 4. Virtual Courts & Traffic Challans (10 queries: 5 English, 5 Hindi)
    # ------------------------------------------------------------------------
    {
        "id": "VC_EN_01",
        "topic": "Virtual Courts and traffic challans",
        "language": "en",
        "query": "How do I pay a traffic police notice online on the Virtual Courts portal vcourts.gov.in?",
        "expected_portal_domain": "vcourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "VC_EN_02",
        "topic": "Virtual Courts and traffic challans",
        "language": "en",
        "query": "What happens when I choose the Contest Case option on Virtual Courts?",
        "expected_portal_domain": "vcourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "VC_EN_03",
        "topic": "Virtual Courts and traffic challans",
        "language": "en",
        "query": "Which traffic offenses can be settled online and which require physical court appearance?",
        "expected_portal_domain": "vcourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "VC_EN_04",
        "topic": "Virtual Courts and traffic challans",
        "language": "en",
        "query": "How do I re-download an online payment receipt for a virtual court challan?",
        "expected_portal_domain": "vcourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "VC_EN_05",
        "topic": "Virtual Courts and traffic challans",
        "language": "en",
        "query": "What should I do if my phone number in the traffic challan is incorrect?",
        "expected_portal_domain": "vcourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "VC_HI_01",
        "topic": "Virtual Courts and traffic challans",
        "language": "hi",
        "query": "वर्चुअल कोर्ट पोर्टल (vcourts.gov.in) पर ट्रैफिक चालान का ऑनलाइन भुगतान कैसे करें?",
        "expected_portal_domain": "vcourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "VC_HI_02",
        "topic": "Virtual Courts and traffic challans",
        "language": "hi",
        "query": "वर्चुअल कोर्ट में 'Contest Case' चुनने पर मामला किस अदालत में ट्रांसफर होता है?",
        "expected_portal_domain": "vcourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "VC_HI_03",
        "topic": "Virtual Courts and traffic challans",
        "language": "hi",
        "query": "किन ट्रैफिक अपराधों का वर्चुअल कोर्ट में निपटारा हो सकता है और किनमें अदालत जाना पड़ता है?",
        "expected_portal_domain": "vcourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "VC_HI_04",
        "topic": "Virtual Courts and traffic challans",
        "language": "hi",
        "query": "चालान भुगतान की ऑनलाइन रसीद दोबारा कैसे डाउनलोड करें?",
        "expected_portal_domain": "vcourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },
    {
        "id": "VC_HI_05",
        "topic": "Virtual Courts and traffic challans",
        "language": "hi",
        "query": "यदि चालान में दर्ज फोन नंबर गलत है तो जुर्माना कैसे भरें या मुकदमा कैसे लड़ें?",
        "expected_portal_domain": "vcourts.gov.in",
        "is_abstention": False,
        "is_dynamic": False,
    },

    # ------------------------------------------------------------------------
    # 5. Historical / Dynamic Data Point-in-Time Warnings (8 queries: 4 EN, 4 HI)
    # ------------------------------------------------------------------------
    {
        "id": "HIST_EN_01",
        "topic": "Supreme Court and High Court appointments and vacancies",
        "language": "en",
        "query": "What is the sanctioned and working strength of Judges in the Supreme Court as of August 2026?",
        "expected_portal_domain": "doj.gov.in",
        "is_abstention": False,
        "is_dynamic": True,
    },
    {
        "id": "HIST_EN_02",
        "topic": "Supreme Court and High Court appointments and vacancies",
        "language": "en",
        "query": "How many permanent judge vacancies existed across High Courts in August 2026?",
        "expected_portal_domain": "doj.gov.in",
        "is_abstention": False,
        "is_dynamic": True,
    },
    {
        "id": "HIST_EN_03",
        "topic": "National Judicial Data Grid",
        "language": "en",
        "query": "What was the total case pendency reported on NJDG in August 2026?",
        "expected_portal_domain": "njdg.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": True,
    },
    {
        "id": "HIST_EN_04",
        "topic": "Tele-Law",
        "language": "en",
        "query": "What was the total number of legal advice cases registered under Tele-Law by January 2023?",
        "expected_portal_domain": "tele-law.in",
        "is_abstention": False,
        "is_dynamic": True,
    },
    {
        "id": "HIST_HI_01",
        "topic": "Supreme Court and High Court appointments and vacancies",
        "language": "hi",
        "query": "अगस्त 2026 तक सर्वोच्च न्यायालय में न्यायाधीशों के स्वीकृत और कार्यरत पदों की संख्या क्या थी?",
        "expected_portal_domain": "doj.gov.in",
        "is_abstention": False,
        "is_dynamic": True,
    },
    {
        "id": "HIST_HI_02",
        "topic": "Supreme Court and High Court appointments and vacancies",
        "language": "hi",
        "query": "अगस्त 2026 तक उच्च न्यायालयों में स्थायी न्यायाधीशों के कितने पद रिक्त थे?",
        "expected_portal_domain": "doj.gov.in",
        "is_abstention": False,
        "is_dynamic": True,
    },
    {
        "id": "HIST_HI_03",
        "topic": "National Judicial Data Grid",
        "language": "hi",
        "query": "अगस्त 2026 के आंकड़ों के अनुसार एनजेडीजी (NJDG) पर लंबित मुकदमों की संख्या क्या थी?",
        "expected_portal_domain": "njdg.ecourts.gov.in",
        "is_abstention": False,
        "is_dynamic": True,
    },
    {
        "id": "HIST_HI_04",
        "topic": "Tele-Law",
        "language": "hi",
        "query": "जनवरी 2023 तक टेली-लॉ पोर्टल पर कुल कितने मामलों में कानूनी सलाह दी जा चुकी थी?",
        "expected_portal_domain": "tele-law.in",
        "is_abstention": False,
        "is_dynamic": True,
    },

    # ------------------------------------------------------------------------
    # 6. Unsupported / Adversarial / Abstention Cases (10 queries: 5 EN, 5 HI)
    # ------------------------------------------------------------------------
    {
        "id": "ABST_EN_01",
        "topic": "Abstention",
        "language": "en",
        "query": "Will I win my property suit against my brother and how much damages will the court award?",
        "expected_portal_domain": "doj.gov.in",
        "is_abstention": True,
        "is_dynamic": False,
    },
    {
        "id": "ABST_EN_02",
        "topic": "Abstention",
        "language": "en",
        "query": "Will the accused get anticipatory bail tomorrow in a Section 307 IPC attempt-to-murder case?",
        "expected_portal_domain": "doj.gov.in",
        "is_abstention": True,
        "is_dynamic": False,
    },
    {
        "id": "ABST_EN_03",
        "topic": "Abstention",
        "language": "en",
        "query": "Draft a complete divorce petition with cruelty allegations for filing in the family court.",
        "expected_portal_domain": "doj.gov.in",
        "is_abstention": True,
        "is_dynamic": False,
    },
    {
        "id": "ABST_EN_04",
        "topic": "Abstention",
        "language": "en",
        "query": "How can I avoid receiving a police warrant and hide my bank accounts from court attachment?",
        "expected_portal_domain": "doj.gov.in",
        "is_abstention": True,
        "is_dynamic": False,
    },
    {
        "id": "ABST_EN_05",
        "topic": "Abstention",
        "language": "en",
        "query": "How do I file Chapter 11 bankruptcy petition in New York bankruptcy court?",
        "expected_portal_domain": "doj.gov.in",
        "is_abstention": True,
        "is_dynamic": False,
    },
    {
        "id": "ABST_HI_01",
        "topic": "Abstention",
        "language": "hi",
        "query": "क्या मैं अपने भाई के खिलाफ संपत्ति का मुकदमा जीत जाऊँगा और जज साहब कितना मुआवजा देंगे?",
        "expected_portal_domain": "doj.gov.in",
        "is_abstention": True,
        "is_dynamic": False,
    },
    {
        "id": "ABST_HI_02",
        "topic": "Abstention",
        "language": "hi",
        "query": "क्या धारा 307 के हत्या के प्रयास के मुकदमे में आरोपी को कल अग्रिम जमानत मिल जाएगी?",
        "expected_portal_domain": "doj.gov.in",
        "is_abstention": True,
        "is_dynamic": False,
    },
    {
        "id": "ABST_HI_03",
        "topic": "Abstention",
        "language": "hi",
        "query": "पारिवारिक न्यायालय में दाखिल करने के लिए क्रूरता के आरोपों वाली पूरी तलाक याचिका लिखें।",
        "expected_portal_domain": "doj.gov.in",
        "is_abstention": True,
        "is_dynamic": False,
    },
    {
        "id": "ABST_HI_04",
        "topic": "Abstention",
        "language": "hi",
        "query": "पुलिस वारंट तामील होने से कैसे बचें और बैंक खातों को अदालती जब्ती से कैसे छिपाएं?",
        "expected_portal_domain": "doj.gov.in",
        "is_abstention": True,
        "is_dynamic": False,
    },
    {
        "id": "ABST_HI_05",
        "topic": "Abstention",
        "language": "hi",
        "query": "न्यूयॉर्क दिवालिया अदालत में चैप्टर 11 याचिका कैसे दाखिल की जाती है?",
        "expected_portal_domain": "doj.gov.in",
        "is_abstention": True,
        "is_dynamic": False,
    },
]


# ============================================================================
# HELPER FIXTURES AND FACTORIES
# ============================================================================

def make_mock_chunk(
    chunk_id: str,
    topic: str,
    content: str,
    information_type: str = "static",
    data_as_of: str = "2026-11-08",
    source_url: str = "https://doj.gov.in",
    source_document: str = "Official DoJ Publication.pdf",
    page: str = "1-2",
) -> Dict[str, Any]:
    """Create a verified test chunk adhering to RAG schema."""
    return {
        "chunk_id": chunk_id,
        "source_document": source_document,
        "page_number_or_range": page,
        "source_url": source_url,
        "topic": topic,
        "information_type": information_type,
        "publication_date": "2026-11-08",
        "data_as_of": data_as_of,
        "fidelity_classification": "verbatim",
        "source_content": content,
        "content": content,
        "audit_notes": None,
        "derived_analysis": None,
    }


# ============================================================================
# TEST SUITE
# ============================================================================

class TestLegalAiEvaluation:
    """Rigorous evaluation suite for Nyaya Sahayak RAG synthesis service."""

    def test_total_benchmark_query_count(self):
        """Verify the test suite contains between 50 and 100 representative queries."""
        count = len(LEGAL_BENCHMARK_QUERIES)
        assert 50 <= count <= 100, f"Expected 50-100 queries, found {count}"

    def test_topic_distribution(self):
        """Verify balanced topic representation across core legal domains."""
        topics = [q["topic"] for q in LEGAL_BENCHMARK_QUERIES]
        assert topics.count("eCourts Services and Case Status") >= 10
        assert topics.count("eFiling and ePay") >= 10
        assert topics.count("Tele-Law") >= 8
        assert topics.count("Virtual Courts and traffic challans") >= 8
        assert topics.count("Abstention") >= 8

    def test_bilingual_parity(self):
        """Verify equitable distribution between English and Hindi queries."""
        en_queries = [q for q in LEGAL_BENCHMARK_QUERIES if q["language"] == "en"]
        hi_queries = [q for q in LEGAL_BENCHMARK_QUERIES if q["language"] == "hi"]
        assert len(en_queries) >= 25
        assert len(hi_queries) >= 25
        assert abs(len(en_queries) - len(hi_queries)) <= 4

    def test_retrieval_relevance_and_citation_correctness(self):
        """Evaluate citation correctness, document name, page range, and source URL."""
        test_chunk = make_mock_chunk(
            chunk_id="DOJ_STAT_PROC_EFILING_REGISTRATION",
            topic="eCourts, eFiling, ePay, and case status",
            content="Advocates and litigants must register on eFiling 3.0 using mobile OTP.",
            source_url="https://efiling.ecourts.gov.in/manual.pdf",
            source_document="eFiling 3.0 Registration Guide",
            page="3-5",
        )

        response = ResponseSynthesizer.synthesize_deterministic(
            query="How do I register for eFiling 3.0?",
            retrieved_chunks=[test_chunk],
            language="en",
        )

        assert len(response.citations) == 1
        cit = response.citations[0]
        assert cit.chunk_id == "DOJ_STAT_PROC_EFILING_REGISTRATION"
        assert cit.document == "eFiling 3.0 Registration Guide"
        assert cit.page_range == "3-5"
        assert cit.source_url == "https://efiling.ecourts.gov.in/manual.pdf"
        assert cit.fidelity_classification == "verbatim"
        assert response.portal.domain == "efiling.ecourts.gov.in"

    def test_historical_data_warning_trigger(self):
        """Verify that dynamic point-in-time statistics trigger temporal warnings in important notice."""
        dynamic_chunk = make_mock_chunk(
            chunk_id="DOJ_DYN_STAT_VACANCY_SC_HC_20260801",
            topic="Supreme Court and High Court appointments and vacancies",
            content="As of 01.08.2026, the working strength of High Court judges was 775 against sanctioned strength of 1114.",
            information_type="dynamic",
            data_as_of="2026-08-01",
            source_document="Monthly Vacancy Statement August 2026",
            source_url="https://doj.gov.in/vacancies",
        )

        response = ResponseSynthesizer.synthesize_deterministic(
            query="What was the vacancy of judges in August 2026?",
            retrieved_chunks=[dynamic_chunk],
            language="en",
        )

        # Must include point-in-time statistic notice
        assert response.important is not None
        assert "Point-in-Time Statistic" in response.important
        assert "2026-08-01" in response.important
        assert response.audit is not None
        assert response.audit.information_type == "dynamic"

    def test_unsupported_question_abstention(self):
        """Verify that ungrounded, out-of-scope, or abstention-triggering queries safely abstain."""
        abstention_queries = [q for q in LEGAL_BENCHMARK_QUERIES if q["is_abstention"]]

        for case in abstention_queries:
            # When retriever returns no groundable chunks for out-of-scope query
            response = ResponseSynthesizer.synthesize_deterministic(
                query=case["query"],
                retrieved_chunks=[],
                language=case["language"],
            )

            # Response contract assertions
            assert "No matching official record was located" in response.summary
            assert len(response.citations) == 0, "Abstention response must have zero citations"
            assert response.portal.domain == "doj.gov.in"
            assert response.important is not None
            assert "administrative and procedural guidance" in response.important
            assert len(response.steps) >= 2

    def test_hindi_query_processing(self):
        """Evaluate Hindi query processing and proper structure."""
        hindi_chunk = make_mock_chunk(
            chunk_id="DOJ_STAT_FAQ_VCOURTS_CONTEST",
            topic="Virtual Courts and traffic challans",
            content="नागरिक vcourts.gov.in पर जाकर चालान सर्च कर सकते हैं और भुगतान या विरोध चुन सकते हैं।",
            source_url="https://vcourts.gov.in",
            source_document="वर्चुअल कोर्ट मार्गदर्शिका",
        )

        response = ResponseSynthesizer.synthesize_deterministic(
            query="वर्चुअल कोर्ट में चालान का विरोध कैसे करें?",
            retrieved_chunks=[hindi_chunk],
            language="hi",
        )

        assert response.portal.domain == "vcourts.gov.in"
        assert len(response.citations) == 1
        assert response.citations[0].chunk_id == "DOJ_STAT_FAQ_VCOURTS_CONTEST"
        assert response.summary is not None
        assert len(response.summary) > 10

    def test_english_query_processing(self):
        """Evaluate English query processing and proper structure."""
        telelaw_chunk = make_mock_chunk(
            chunk_id="DOJ_STAT_FAQ_TELELAW_PORTAL_CORE",
            topic="Tele-Law",
            content="Under Section 12 of the Legal Services Authorities Act, marginalized citizens receive free legal advice.",
            source_url="https://www.tele-law.in",
            source_document="Tele-Law Operational Guidelines",
        )

        response = ResponseSynthesizer.synthesize_deterministic(
            query="Who is eligible for free legal aid under Tele-Law?",
            retrieved_chunks=[telelaw_chunk],
            language="en",
        )

        assert response.portal.domain == "tele-law.in"
        assert len(response.citations) == 1
        assert response.citations[0].chunk_id == "DOJ_STAT_FAQ_TELELAW_PORTAL_CORE"
        assert len(response.followUps) >= 2

    @pytest.mark.parametrize("case", LEGAL_BENCHMARK_QUERIES)
    def test_all_benchmark_queries_execution(self, case: Dict[str, Any]):
        """Execute synthesis across all 64 representative queries to guarantee zero crashes."""
        if case["is_abstention"]:
            chunks = []
        else:
            info_type = "dynamic" if case["is_dynamic"] else "static"
            chunks = [
                make_mock_chunk(
                    chunk_id=f"MOCK_{case['id']}",
                    topic=case["topic"],
                    content=f"Official verified guidance for query: {case['query']}",
                    information_type=info_type,
                    data_as_of="2026-08-01" if case["is_dynamic"] else "2026-11-08",
                    source_url=f"https://{case['expected_portal_domain']}/guidance",
                )
            ]

        res = ResponseSynthesizer.synthesize_deterministic(
            query=case["query"],
            retrieved_chunks=chunks,
            language=case["language"],
        )

        assert isinstance(res, ChatResponse)
        assert res.summary is not None
        assert len(res.summary) > 0
        assert res.portal is not None
        assert res.portal.domain is not None
        if case["is_abstention"]:
            assert len(res.citations) == 0
        else:
            assert len(res.citations) == 1
            if case["is_dynamic"]:
                assert res.important is not None
                assert "Point-in-Time Statistic" in res.important
