const CHATBOT_KNOWLEDGE_BASE = {
  doj_divisions: {
    keys: [
      'doj', 'department of justice', 'ministry of law', 'divisions', 'functions of doj',
      'about doj', 'what does department of justice do', 'article 39a',
      'न्याय विभाग', 'कानून और न्याय मंत्रालय', 'विभाग'
    ],
    en: {
      summary: 'The <strong>Department of Justice</strong> is a key department within the Ministry of Law & Justice, Government of India. Guided by Article 39A of the Constitution of India, its mandate is ensuring equal access to justice, court modernization, and judicial administration.',
      steps: [
        '<strong>Judicial Appointments:</strong> Administers constitutional appointments of Judges and Chief Justices to the Supreme Court of India and 25 High Courts.',
        '<strong>eCourts Mission Mode Project:</strong> Oversees national ICT enablement and digitization of 3,400+ district and taluka court complexes.',
        '<strong>Access to Justice (DISHA Scheme):</strong> Implements Tele-Law, Nyaya Bandhu (Pro Bono legal services), and Nyaya Mitra programs across rural India.',
        '<strong>Fast Track Special Courts (FTSCs):</strong> Centrally sponsored scheme for expeditious disposal of cases under POCSO Act and rape offenses.'
      ],
      important: 'The Department of Justice performs administrative functions for judicial reform and infrastructure; it does not adjudicate cases or interfere in court proceedings.',
      portal: {
        title: 'Department of Justice Official Portal',
        url: 'https://doj.gov.in',
        domain: 'doj.gov.in'
      },
      source: 'Department of Justice, Ministry of Law & Justice, Govt. of India',
      followUps: [
        'What is the eCourts Mission Mode Project?',
        'Where can I find information about judicial vacancies?',
        'How can I access Tele-Law services?'
      ]
    },
    hi: {
      summary: '<strong>न्याय विभाग</strong>, भारत सरकार के विधि एवं न्याय मंत्रालय का एक महत्वपूर्ण विभाग है। भारतीय संविधान के अनुच्छेद 39A के अनुसार, इसका उद्देश्य सभी नागरिकों के लिए समान न्याय सुनिश्चित करना तथा न्यायिक सुधारों को लागू करना है।',
      steps: [
        '<strong>न्यायिक नियुक्तियाँ:</strong> सर्वोच्च न्यायालय और 25 उच्च न्यायालयों में न्यायाधीशों की नियुक्ति का प्रशासनिक समन्वय।',
        '<strong>ई-कोर्ट्स मिशन मोड प्रोजेक्ट:</strong> देश भर के 3,400 से अधिक न्यायालय परिसरों का डिजिटलीकरण।',
        '<strong>दिशा योजना (न्याय तक पहुंच):</strong> टेली-लॉ, न्याय बंधु और न्याय मित्र कार्यक्रमों का संचालन।',
        '<strong>फास्ट ट्रैक विशेष न्यायालय (FTSC):</strong> पोक्सो (POCSO) और गंभीर अपराधों के त्वरित निस्तारण हेतु।'
      ],
      important: 'न्याय विभाग प्रशासनिक और नीतिगत सुधारों का कार्य करता है; यह न्यायालयों के निर्णयों में हस्तक्षेप नहीं करता।',
      portal: {
        title: 'न्याय विभाग आधिकारिक पोर्टल',
        url: 'https://doj.gov.in',
        domain: 'doj.gov.in'
      },
      source: 'न्याय विभाग, विधि और न्याय मंत्रालय, भारत सरकार',
      followUps: [
        'ई-कोर्ट्स मिशन मोड प्रोजेक्ट क्या है?',
        'न्यायिक रिक्तियों के बारे में जानकारी कहाँ मिलेगी?'
      ]
    }
  },
  judicial_appointments: {
    keys: [
      'judge strength', 'vacancies', 'judicial vacancies', 'high court judges',
      'supreme court judges', 'collegium', 'sanctioned strength', 'appointments',
      'न्यायिक रिक्तियां', 'न्यायाधीशों की संख्या', 'रिक्तियां', 'कॉलेजियम'
    ],
    en: {
      summary: 'Judicial appointments to the Supreme Court of India and High Courts are made under <strong>Articles 124, 217, and 224</strong> of the Constitution of India, following the Memorandum of Procedure (MoP).',
      steps: [
        '<strong>Supreme Court of India:</strong> Sanctioned strength of 34 Judges (including the Chief Justice of India).',
        '<strong>High Courts (25 across India):</strong> Combined sanctioned strength of 1,114 Judges (approximately 790 working judges as per baseline data).',
        '<strong>District & Subordinate Judiciary:</strong> Sanctioned cadre of over 25,400 judicial officers across States and Union Territories.',
        '<strong>Transparency & Vacancy Reports:</strong> The Department publishes monthly vacancy statements detailing sanctioned, working, and vacant positions across all High Courts.'
      ],
      important: 'Demonstration baseline figures. Live real-time vacancy numbers are updated on the 1st of every month on the official Department of Justice vacancy portal.',
      portal: {
        title: 'DoJ High Court Vacancy Position Reports',
        url: 'https://doj.gov.in/vacancy-positions',
        domain: 'doj.gov.in/vacancy-positions'
      },
      source: 'Department of Justice & Supreme Court Registry Data',
      followUps: [
        'What is the National Judicial Data Grid?',
        'How do Fast Track Special Courts work?'
      ]
    },
    hi: {
      summary: 'भारत के सर्वोच्च न्यायालय और उच्च न्यायालयों में न्यायाधीशों की नियुक्तियाँ संविधान के <strong>अनुच्छेद 124, 217 एवं 224</strong> के तहत प्रक्रिया ज्ञापन (MoP) के अनुसार की जाती हैं।',
      steps: [
        '<strong>सर्वोच्च न्यायालय:</strong> मुख्य न्यायाधीश सहित 34 स्वीकृत पद।',
        '<strong>25 उच्च न्यायालय:</strong> कुल 1,114 स्वीकृत पद।',
        '<strong>जिला एवं अधीनस्थ न्यायालय:</strong> 25,400 से अधिक स्वीकृत न्यायिक पद।'
      ],
      important: 'यह प्रदर्शन डेटा है। आधिकारिक वास्तविक स्थिति न्याय विभाग की मासिक रिपोर्ट में प्रकाशित की जाती है।',
      portal: {
        title: 'उच्च न्यायालय रिक्ति विवरण',
        url: 'https://doj.gov.in/vacancy-positions',
        domain: 'doj.gov.in'
      },
      source: 'न्याय विभाग, भारत सरकार',
      followUps: [
        'राष्ट्रीय न्यायिक डेटा ग्रिड क्या है?'
      ]
    }
  },
  njdg_pendency: {
    keys: [
      'njdg', 'national judicial data grid', 'pendency', 'case pendency', 'pending cases',
      'how many cases are pending', 'case delay', 'disposal rate',
      'एनजेडीजी', 'लंबित मामले', 'पेंडेंसी'
    ],
    en: {
      summary: 'The <strong>National Judicial Data Grid (NJDG)</strong> is an open-access monitoring platform developed under Phase-II of the eCourts Project. It tracks case institutions, disposals, and pendency across 3,400+ district and taluka court complexes as well as High Courts and the Supreme Court.',
      steps: [
        '<strong>Open Public Access:</strong> Citizens and researchers can view nationwide, state-wise, and district-wise case statistics without registration.',
        '<strong>Age-wise Classification:</strong> Tracks pending cases categorized by age brackets (0–1 year, 1–3 years, 3–5 years, 5–10 years, and >10 years).',
        '<strong>Civil & Criminal Segregation:</strong> Distinct breakdown of pending civil disputes and criminal trials.',
        '<strong>Judicial Delay Analysis:</strong> Provides data to High Court Arrears Committees to target old cases for disposal.'
      ],
      important: 'NJDG figures update continuously through automated sync from district court CIS (Case Information System) servers.',
      portal: {
        title: 'National Judicial Data Grid Public Portal',
        url: 'https://njdg.ecourts.gov.in',
        domain: 'njdg.ecourts.gov.in'
      },
      source: 'eCommittee, Supreme Court of India & NIC',
      followUps: [
        'How can I check my case status?',
        'How do Fast Track Special Courts work?'
      ]
    },
    hi: {
      summary: '<strong>राष्ट्रीय न्यायिक डेटा ग्रिड (NJDG)</strong> ई-कोर्ट परियोजना के तहत विकसित एक सार्वजनिक पोर्टल है, जो देश के सभी जिला न्यायालयों, उच्च न्यायालयों और सर्वोच्च न्यायालय के मुकदमों की स्थिति प्रदर्शित करता है।',
      steps: [
        '<strong>सार्वजनिक पारदर्शिता:</strong> कोई भी नागरिक राज्य और जिला स्तर पर लंबित मुकदमों का विवरण देख सकता है।',
        '<strong>समय अवधि वर्गीकरण:</strong> मुकदमों को उनकी अवधि (0-1 वर्ष, 1-3 वर्ष, 10 वर्ष से अधिक) के अनुसार वर्गीकृत किया जाता है।'
      ],
      portal: {
        title: 'NJDG आधिकारिक पोर्टल',
        url: 'https://njdg.ecourts.gov.in',
        domain: 'njdg.ecourts.gov.in'
      },
      source: 'ई-कमेटी, सर्वोच्च न्यायालय एवं एनआईसी',
      followUps: [
        'मैं अपने केस की स्थिति कैसे देखूँ?'
      ]
    }
  },
  traffic_challan: {
    keys: [
      'traffic challan', 'pay challan', 'traffic fine', 'virtual court', 'virtual courts',
      'vcourts', 'traffic violation', 'echallan', 'pay traffic fine', 'how do i pay a traffic challan',
      'ट्रैफिक चालान', 'चालान', 'वर्चुअल कोर्ट', 'चालान भुगतान'
    ],
    en: {
      summary: 'Traffic violation notices and compounding fines can be resolved online without physically visiting a courtroom through the <strong>Virtual Courts (vCourts)</strong> portal.',
      steps: [
        'Visit the official Virtual Courts portal at <strong>vcourts.gov.in</strong>.',
        'Select your state and the designated Virtual Court (e.g. Notice Court or Traffic Court).',
        'Search for your challan by entering your <strong>Mobile Number, Vehicle Registration Number, or Challan Number</strong>.',
        'Review the violation particulars, evidence photograph, and compounding amount.',
        'Choose <strong>"Plead Guilty & Pay Fine"</strong> to settle via UPI/Debit/Netbanking, or select <strong>"Contest Challan"</strong> to refer the case to regular physical trial.'
      ],
      important: 'If you choose to contest the challan, the matter is scheduled before a regular physical magistrate court, and online payment will be disabled.',
      portal: {
        title: 'Virtual Courts Official Payment Portal',
        url: 'https://vcourts.gov.in',
        domain: 'vcourts.gov.in'
      },
      source: 'eCommittee Supreme Court of India & NIC',
      followUps: [
        'What is e-Pay court fee system?',
        'How can I check my case status?'
      ]
    },
    hi: {
      summary: 'ट्रैफिक चालान का निपटारा <strong>वर्चुअल कोर्ट (vCourts)</strong> पोर्टल के माध्यम से बिना अदालत जाए ऑनलाइन किया जा सकता है।',
      steps: [
        'आधिकारिक पोर्टल <strong>vcourts.gov.in</strong> पर जाएं।',
        'अपना राज्य और संबंधित वर्चुअल कोर्ट चुनें।',
        'वाहन नंबर, चालान नंबर या मोबाइल नंबर दर्ज कर चालान खोजें।',
        'विवरण जांचें और ऑनलाइन यूपीआई (UPI) या नेट बैंकिंग द्वारा जुर्माना भरें, या कोर्ट में चुनौती देने का विकल्प चुनें।'
      ],
      portal: {
        title: 'वर्चुअल कोर्ट आधिकारिक पोर्टल',
        url: 'https://vcourts.gov.in',
        domain: 'vcourts.gov.in'
      },
      source: 'ई-कमेटी, सर्वोच्च न्यायालय',
      followUps: [
        'ई-कोर्ट्स मोबाइल ऐप क्या है?'
      ]
    }
  },
  live_streaming: {
    keys: [
      'live court', 'live streaming', 'stream court', 'watch court', 'live proceedings',
      'youtube court', 'video conference', 'court broadcast',
      'लाइव स्ट्रीमिंग', 'कोर्ट की लाइव कार्यवाही', 'अदालत प्रसारण'
    ],
    en: {
      summary: 'Live streaming of court hearings in India is governed by the <strong>Model Rules for Live Streaming and Recording of Court Proceedings</strong> formulated by the eCommittee of the Supreme Court of India.',
      steps: [
        '<strong>Constitutional Benches:</strong> Constitutional bench hearings of the Supreme Court of India are live-streamed on official Supreme Court YouTube and webcasting channels.',
        '<strong>High Courts Live Streaming:</strong> Several High Courts (including Gujarat, Karnataka, Madhya Pradesh, Orissa, Patna, and Calcutta) regularly stream open-court hearings on YouTube.',
        '<strong>Exceptions & Privacy:</strong> Cases involving matrimonial disputes, child custody, POCSO, sexual offenses, and matters affecting national security are strictly excluded from live streaming.',
        '<strong>How to Watch:</strong> Citizens can access stream links directly through the official website of the Supreme Court of India or respective High Courts.'
      ],
      important: 'Recording, screen-capturing, or sharing unauthorized re-edited clips of live-streamed court hearings is prohibited under court rules.',
      portal: {
        title: 'Supreme Court of India Webcast Portal',
        url: 'https://main.sci.gov.in',
        domain: 'sci.gov.in'
      },
      source: 'eCommittee, Supreme Court of India',
      followUps: [
        'What is the eCourts Services mobile application?',
        'What is e-Filing 3.0?'
      ]
    },
    hi: {
      summary: 'सर्वोच्च न्यायालय और कई उच्च न्यायालयों (जैसे गुजरात, कर्नाटक, मध्य प्रदेश) की खुली अदालती कार्यवाहियों का सीधा प्रसारण (लाइव स्ट्रीमिंग) आधिकारिक चैनलों पर किया जाता है।',
      steps: [
        'सर्वोच्च न्यायालय की संविधान पीठों का प्रसारण आधिकारिक यूट्यूब चैनल पर उपलब्ध रहता है।',
        'वैवाहिक विवादों, बाल संरक्षण और संवेदनशील मामलों का प्रसारण वर्जित है।'
      ],
      portal: {
        title: 'सर्वोच्च न्यायालय वेबकास्ट',
        url: 'https://main.sci.gov.in',
        domain: 'sci.gov.in'
      },
      source: 'ई-कमेटी, सर्वोच्च न्यायालय',
      followUps: [
        'ई-फाइलिंग 3.0 क्या है?'
      ]
    }
  },
  efiling_epay: {
    keys: [
      'efiling', 'e-filing', 'epay', 'e-pay', 'file a case online', 'online filing',
      'court fees', 'file petition', 'upload petition', 'how can i file a case online',
      'ई-फाइलिंग', 'ई-पे', 'ऑनलाइन केस दायर', 'कोर्ट फीस'
    ],
    en: {
      summary: '<strong>e-Filing 3.0</strong> is the official electronic portal allowing advocates and litigants in person to file civil and criminal cases, caveats, and interlocutory applications online 24×7.',
      steps: [
        'Register an account on <strong>efiling.ecourts.gov.in</strong> using your Bar Registration Number (for Advocates) or mobile/Aadhaar OTP (for Party-in-Person).',
        'Enter petitioner and respondent details, case type, and jurisdiction.',
        'Upload court pleadings and affidavits strictly in <strong>PDF/A (searchable text)</strong> format with digital signature (DSC or Aadhaar e-Sign).',
        'Pay court fees and judicial deposits electronically via <strong>e-Pay (pay.ecourts.gov.in)</strong> integrated with State Treasuries and Bharatkosh.',
        'Receive an instant electronic acknowledgment with a temporary filing number for registry scrutiny.'
      ],
      important: 'Uploaded documents must be formatted according to High Court e-filing rules with clean optical character recognition (OCR) indexing.',
      portal: {
        title: 'e-Filing 3.0 National Portal',
        url: 'https://efiling.ecourts.gov.in',
        domain: 'efiling.ecourts.gov.in'
      },
      source: 'eCommittee, Supreme Court of India',
      followUps: [
        'How can I check my case status?',
        'How do I pay a traffic challan?'
      ]
    },
    hi: {
      summary: '<strong>ई-फाइलिंग 3.0</strong> के माध्यम से अधिवक्ता और वादी घर बैठे 24×7 नए मुकदमे, याचिकाएं और हलफनामे ऑनलाइन जमा कर सकते हैं।',
      steps: [
        '<strong>efiling.ecourts.gov.in</strong> पर पंजीकरण करें।',
        'याचिका की सर्च करने योग्य PDF/A फाइल डिजिटल हस्ताक्षर (DSC या ई-साइन) के साथ अपलोड करें।',
        '<strong>pay.ecourts.gov.in</strong> द्वारा कोर्ट फीस का ऑनलाइन भुगतान करें।'
      ],
      portal: {
        title: 'ई-फाइलिंग आधिकारिक पोर्टल',
        url: 'https://efiling.ecourts.gov.in',
        domain: 'efiling.ecourts.gov.in'
      },
      source: 'ई-कमेटी, सर्वोच्च न्यायालय',
      followUps: [
        'केस की स्थिति कैसे देखें?'
      ]
    }
  },
  fast_track_courts: {
    keys: [
      'fast track', 'ftsc', 'fast track special courts', 'pocso courts', 'rape cases',
      'speedy trial', 'expeditious disposal', 'how do fast track special courts work',
      'फास्ट ट्रैक कोर्ट', 'फास्ट ट्रैक विशेष अदालतें', 'पोक्सो कोर्ट'
    ],
    en: {
      summary: '<strong>Fast Track Special Courts (FTSCs)</strong> are dedicated courts established under a Centrally Sponsored Scheme formulated by the Department of Justice to ensure swift justice in cases of rape and offenses under the Protection of Children from Sexual Offences (POCSO) Act.',
      steps: [
        '<strong>Exclusive Jurisdiction:</strong> Dedicated exclusively to trial of sexual offenses and POCSO matters, freeing judges from routine civil or criminal rosters.',
        '<strong>Time-Bound Disposal:</strong> Designed to achieve trial disposal within 1 year from the date of chargesheet filing.',
        '<strong>Vulnerable Witness Deposition:</strong> Equipped with child-friendly courtrooms and vulnerable witness deposition complexes to ensure non-traumatizing testimony.',
        '<strong>Nationwide Network:</strong> Hundreds of FTSCs are operational across participating States and Union Territories funded jointly by the Centre and States.'
      ],
      important: 'Cases are assigned to FTSCs automatically by the Principal District & Sessions Judge based on statutory offense sections in the FIR/chargesheet.',
      portal: {
        title: 'DoJ Fast Track Special Courts Information',
        url: 'https://doj.gov.in/fast-track-special-court-ftsc',
        domain: 'doj.gov.in'
      },
      source: 'Department of Justice, Ministry of Law & Justice',
      followUps: [
        'How can I access free legal aid?',
        'What is the National Judicial Data Grid?'
      ]
    },
    hi: {
      summary: '<strong>फास्ट ट्रैक विशेष न्यायालय (FTSC)</strong> पोक्सो (POCSO) अधिनियम और महिलाओं के विरुद्ध अपराधों के त्वरित और समयबद्ध निस्तारण के लिए न्याय विभाग की विशेष योजना है।',
      steps: [
        'मुकदमों का 1 वर्ष के भीतर निपटारा करने का लक्ष्य।',
        'बाल-अनुकूल और संवेदनशील गवाह कक्षों की सुविधा।'
      ],
      portal: {
        title: 'FTSC विवरण - न्याय विभाग',
        url: 'https://doj.gov.in/fast-track-special-court-ftsc',
        domain: 'doj.gov.in'
      },
      source: 'न्याय विभाग, भारत सरकार',
      followUps: [
        'मुफ्त कानूनी सहायता कैसे प्राप्त करें?'
      ]
    }
  },
  ecourts_app: {
    keys: [
      'ecourts app', 'mobile app', 'ecourts services mobile application', 'app',
      'download ecourts', 'how to use ecourts app', 'what is the ecourts services mobile application',
      'ई-कोर्ट्स ऐप', 'मोबाइल ऐप'
    ],
    en: {
      summary: 'The <strong>eCourts Services Mobile App</strong> is an official citizen-centric mobile application developed by the eCommittee of the Supreme Court of India and NIC. It serves as a single-window mobile interface for Indian courts.',
      steps: [
        '<strong>Download:</strong> Available free on Google Play Store and Apple App Store (Search: "eCourts Services").',
        '<strong>Case Portfolio Tracking:</strong> Save your cases in a personal "My Cases" portfolio and receive automated hearing date updates.',
        '<strong>QR Code Verification:</strong> Scan QR codes on court summons or certified copies to instantly verify authentic case history.',
        '<strong>Daily Cause Lists:</strong> View daily cause lists of any District Court or High Court courtroom across India.',
        '<strong>Multi-Criteria Search:</strong> Search case records by 16-character CNR Number, Case Number, Filing Number, Party Name, FIR details, or Advocate Name.'
      ],
      important: 'The app supports English, Hindi, and regional languages and does not charge any subscription or access fee.',
      portal: {
        title: 'eCourts Mobile App Portal',
        url: 'https://doj.gov.in/ecourts-services-mobile-app',
        domain: 'doj.gov.in'
      },
      source: 'eCommittee, Supreme Court of India & NIC',
      followUps: [
        'How can I check my case status?',
        'How do I pay a traffic challan?'
      ]
    },
    hi: {
      summary: '<strong>ई-कोर्ट्स सर्विसेज मोबाइल ऐप</strong> सर्वोच्च न्यायालय की ई-कमेटी और एनआईसी द्वारा विकसित आधिकारिक ऐप है।',
      steps: [
        'गूगल प्ले स्टोर या एप्पल ऐप स्टोर से मुफ्त डाउनलोड करें।',
        '16-अंकीय CNR नंबर या पक्षकार के नाम से केस सर्च करें।',
        'QR कोड स्कैन कर न्यायालयी आदेशों की पुष्टि करें।'
      ],
      portal: {
        title: 'ई-कोर्ट्स ऐप विवरण',
        url: 'https://doj.gov.in/ecourts-services-mobile-app',
        domain: 'doj.gov.in'
      },
      source: 'ई-कमेटी, सर्वोच्च न्यायालय',
      followUps: [
        'केस की स्थिति कैसे जांचें?'
      ]
    }
  },
  tele_law: {
    keys: [
      'tele-law', 'telelaw', 'legal aid', 'free legal aid', 'free legal assistance',
      'nalsa', 'csc', 'section 12', '15100', 'legal advice', 'how can i access tele-law services',
      'where can i get free legal assistance', 'how can i access free legal aid',
      'टेली-लॉ', 'मुफ्त कानूनी सहायता', 'कानूनी सलाह', 'नालसा'
    ],
    en: {
      summary: '<strong>Tele-Law</strong> is an innovative initiative by the Department of Justice connecting citizens in rural and remote areas with panel lawyers via video conferencing and telephone facilities available at Common Services Centres (CSCs).',
      steps: [
        '<strong>Step 1:</strong> Visit your nearest Village-level Common Services Centre (CSC) or log on directly to <strong>tele-law.in</strong> / Tele-Law Mobile App.',
        '<strong>Step 2:</strong> Village Level Entrepreneur (VLE) registers the citizen inquiry and uploads relevant documents.',
        '<strong>Step 3:</strong> An appointment slot is scheduled with a dedicated panel advocate.',
        '<strong>Step 4:</strong> Citizen consults with the panel lawyer via video conference or phone and receives formal advice.',
        '<strong>Eligibility & Free Service:</strong> Tele-Law is <strong>100% Free</strong> for categories covered under Section 12 of the Legal Services Authorities Act, 1987 (women, children, SC/ST, victims of trafficking, disabled, industrial workmen, and low-income citizens).'
      ],
      important: 'For round-the-clock urgent legal aid inquiries, citizens can dial the 24×7 NALSA toll-free helpline number <strong>15100</strong>.',
      portal: {
        title: 'Tele-Law National Portal',
        url: 'https://tele-law.in',
        domain: 'tele-law.in'
      },
      source: 'Department of Justice & NALSA',
      followUps: [
        'Who is eligible for free legal aid under Section 12?',
        'How can I check my case status?'
      ]
    },
    hi: {
      summary: '<strong>टेली-लॉ सेवा</strong> न्याय विभाग की एक अनूठी पहल है, जिसके माध्यम से ग्रामीण और दूरदराज के नागरिक कॉमन सर्विस सेंटर (CSC) के जरिए वकीलों से मुफ्त कानूनी सलाह ले सकते हैं।',
      steps: [
        'निकटतम सीएससी (CSC) केंद्र पर जाएं या <strong>tele-law.in</strong> पोर्टल पर जाएं।',
        'महिलाएं, बच्चे, अनुसूचित जाति/जनजाति और कम आय वर्ग के लिए यह सेवा पूरी तरह <strong>मुफ्त</strong> है।',
        'तत्काल सहायता के लिए 24×7 राष्ट्रीय लीगल एड हेल्पलाइन <strong>15100</strong> पर कॉल करें।'
      ],
      portal: {
        title: 'टेली-लॉ आधिकारिक पोर्टल',
        url: 'https://tele-law.in',
        domain: 'tele-law.in'
      },
      source: 'न्याय विभाग एवं नालसा (NALSA)',
      followUps: [
        'केस की स्थिति कैसे जांचें?'
      ]
    }
  },
  case_status: {
    keys: [
      'case status', 'check case status', 'cnr', 'cnr number', 'case number',
      'court case', 'order', 'judgment', 'next hearing', 'party name',
      'how do i check my case status', 'how can i check my case status',
      'केस की स्थिति', 'केस स्टेटस', 'सीएनआर नंबर', 'अगली सुनवाई'
    ],
    en: {
      summary: 'You can check the status of any case in District Courts, High Courts, and the Supreme Court using the 16-character <strong>CNR (Case Number Record)</strong> number or case details.',
      steps: [
        'Visit <strong>services.ecourts.gov.in</strong> or open the eCourts Services Mobile App.',
        'Enter your 16-character alphanumeric <strong>CNR Number</strong> (e.g. DLST01-001234-2023). The CNR is printed on your court filing receipt, summons, or certified order copy.',
        'Alternatively, search by <strong>Case Number, Party Name, Filing Number, FIR Number, or Advocate Name</strong>.',
        'View complete case history: Registration Date, Current Stage, Next Hearing Date, Judge details, and download certified Daily Orders / Final Judgments.'
      ],
      important: 'CNR numbers are permanent and remain unchanged throughout the life of the case, including during transfers between courtrooms.',
      portal: {
        title: 'eCourts Case Status Portal',
        url: 'https://services.ecourts.gov.in',
        domain: 'services.ecourts.gov.in'
      },
      source: 'eCourts Project, Supreme Court of India & NIC',
      followUps: [
        'How can I file a case online?',
        'How do I pay a traffic challan?'
      ]
    },
    hi: {
      summary: 'आप 16-अंकीय <strong>CNR (Case Number Record)</strong> नंबर या पक्षकार के नाम से किसी भी मुकदमे की स्थिति ऑनलाइन देख सकते हैं।',
      steps: [
        '<strong>services.ecourts.gov.in</strong> पोर्टल या ई-कोर्ट्स ऐप खोलें।',
        '16-अंकीय सीएनआर नंबर (जैसे DLST01-001234-2023) दर्ज करें।',
        'अगली सुनवाई की तारीख, मुकदमे की वर्तमान स्थिति और कोर्ट के आदेश डाउनलोड करें।'
      ],
      portal: {
        title: 'ई-कोर्ट्स केस स्टेटस पोर्टल',
        url: 'https://services.ecourts.gov.in',
        domain: 'services.ecourts.gov.in'
      },
      source: 'ई-कमेटी, सर्वोच्च न्यायालय',
      followUps: [
        'ऑनलाइन केस कैसे दायर करें?',
        'ट्रैफिक चालान का भुगतान कैसे करें?'
      ]
    }
  }
};
const CHATBOT_FALLBACK_RESPONSE = {
  en: {
    summary: 'I am here to guide you on Department of Justice initiatives, eCourts services, and judicial procedures. I could not locate an exact match for your inquiry.',
    steps: [
      'Verify if your inquiry relates to <strong>Case Status, Traffic Challans, e-Filing, Free Legal Aid, Tele-Law, or Court Appointments</strong>.',
      'Check the suggested questions below for quick assistance.',
      'For formal judicial filings and certified orders, refer directly to official government portals.'
    ],
    important: 'Demonstration Assistant Notice: Nyaya Sahayak provides general informational guidance and does not substitute legal representation.',
    portal: {
      title: 'Department of Justice Citizen Services',
      url: 'https://doj.gov.in',
      domain: 'doj.gov.in'
    },
    source: 'Department of Justice, Govt. of India',
    followUps: [
      'How can I check my case status?',
      'How do I pay a traffic challan?',
      'How can I access free legal aid?',
      'What is the eCourts Services mobile application?'
    ]
  },
  hi: {
    summary: 'मैं न्याय विभाग की योजनाओं और न्यायिक प्रक्रियाओं के बारे में सहायता प्रदान करने के लिए उपलब्ध हूँ। आपके प्रश्न के लिए सटीक जानकारी नहीं मिल सकी।',
    steps: [
      'कृपया जांचें कि आपका प्रश्न <strong>केस स्टेटस, चालान, ई-फाइलिंग, मुफ्त कानूनी सलाह या टेली-लॉ</strong> से संबंधित है।',
      'त्वरित उत्तर के लिए नीचे दिए गए सुझावों में से चुनें।'
    ],
    portal: {
      title: 'न्याय विभाग पोर्टल',
      url: 'https://doj.gov.in',
      domain: 'doj.gov.in'
    },
    source: 'न्याय विभाग, भारत सरकार',
    followUps: [
      'मैं अपने केस की स्थिति कैसे देखूँ?',
      'ट्रैफिक चालान का भुगतान कैसे करें?'
    ]
  }
};
