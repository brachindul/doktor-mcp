import type { CourtDecision, LegislationProvision, SourceEvidence } from "../contracts/legal.js";

function evidence(source: SourceEvidence["source"], documentId: string, fullText: boolean): SourceEvidence {
  return {
    source,
    documentId,
    retrievedAt: "2026-05-22T00:00:00.000Z",
    official: true,
    fullText
  };
}

export const mockLegislationProvisions: LegislationProvision[] = [
  {
    documentId: "leg-deontology-18",
    legislationName: "Tibbi Deontoloji Nizamnamesi",
    articleNumber: "18",
    verbatimText:
      "Tabip ve dis tabibi, acil vakalar disinda, hastayi reddetme yetkisine sahiptir.",
    connection: "Hekimin hastayi reddetme ve tedaviyi birakma hakki deontoloji kurallariyla duzenlenir.",
    dimensions: ["professional_ethics", "civil_compensation"],
    evidence: evidence("legislation", "leg-deontology-18", true),
    inForce: true,
    lastAmendedDate: "2023-01-15"
  },
  {
    documentId: "leg-tababet-1",
    legislationName: "Tababet ve Suabati Sanatlarinin Tarzi Icrasina Dair Kanun",
    articleNumber: "1",
    verbatimText:
      "Turkiye Cumhuriyeti dahilinde tababet icra etmek ve hasta tedavi edebilmek icin bu kanunun sartlarina haiz olmak lazimdir.",
    connection: "Hekimlik icrasi ve mesleki yukumluluklerin yasal temelidir.",
    dimensions: ["professional_ethics", "patient_rights"],
    evidence: evidence("legislation", "leg-tababet-1", true),
    inForce: true,
    lastAmendedDate: "2021-06-30"
  },
  {
    documentId: "leg-patient-rights-24",
    legislationName: "Hasta Haklari Yonetmeligi",
    articleNumber: "24",
    verbatimText:
      "Tibbi mudahalelerde hastanin rizasi gerekir. Hasta kucuk veya mahcur ise velisinden veya vasisinden izin alinir.",
    connection: "Aydinlatma ve riza sorularinda resmi madde metni eslestirmesi icin mock kayittir.",
    dimensions: ["patient_rights", "civil_compensation", "disciplinary_administrative"],
    evidence: evidence("legislation", "leg-patient-rights-24", true),
    inForce: "unknown"
  },
  {
    documentId: "leg-kvkk-6",
    legislationName: "Kisisel Verilerin Korunmasi Kanunu",
    articleNumber: "6",
    verbatimText:
      "Kisilerin sagligina iliskin veriler ozel nitelikli kisisel veridir.",
    connection: "Saglik verisi ve mahremiyet sorularinda resmi madde metni eslestirmesi icin mock kayittir.",
    dimensions: ["privacy_kvkk"],
    evidence: evidence("legislation", "leg-kvkk-6", true),
    inForce: true,
    lastAmendedDate: "2024-03-12"
  },
  {
    documentId: "leg-tababet-25",
    legislationName: "Tababet ve Suabati Sanatlarinin Tarzi Icrasina Dair Kanun",
    articleNumber: "25",
    verbatimText:
      "Tabip ve dis tabipleri, mesleklerini icra ederken uzmanliklari disinda kalan muameleleri yapamazlar.",
    connection:
      "Hekimin uzmanlık sınırları ve yetkisiz tıbbi faaliyet yasağına ilişkin mesleki kapsam sorularında kullanılır.",
    dimensions: ["professional_ethics", "disciplinary_administrative"],
    evidence: evidence("legislation", "leg-tababet-25", true),
    inForce: false,
    repealed: true
  },
  {
    documentId: "leg-healthservices-9",
    legislationName: "Saglik Hizmetleri Temel Kanunu",
    articleNumber: "9",
    verbatimText:
      "Saglik kurum ve kuruluslari, saglik personelinin mesleki faaliyetlerini ilgili mevzuat hukumlerine uygun sekilde yurutmek zorundadir.",
    connection:
      "Özel ve kamu sağlık kuruluşlarının denetim yükümlülüğü ve mesleki faaliyet çerçevesine ilişkin sorularda kullanılır.",
    dimensions: ["professional_ethics", "disciplinary_administrative"],
    evidence: evidence("legislation", "leg-healthservices-9", true),
    inForce: "unknown"
  },
  {
    documentId: "leg-saglikmeslek-5",
    legislationName: "Sağlık Meslek Mensupları ile Sağlık Hizmetlerinde Çalışan Diğer Meslek Mensuplarının İş ve Görev Tanımlarına Dair Yönetmelik",
    articleNumber: "5",
    verbatimText: "Sağlık meslek mensupları, görevlerini kendi görev tanımları ve yetki sınırları çerçevesinde yürütürler.",
    connection: "Görev tanımları ve yetki sınırları yönetmelikle belirlenmiştir.",
    dimensions: ["professional_ethics", "disciplinary_administrative"],
    evidence: evidence("legislation", "leg-saglikmeslek-5", true),
    inForce: true,
    lastAmendedDate: "2022-11-10"
  },
  {
    documentId: "leg-isg-8",
    legislationName: "Is Sagligi ve Guvenligi Kanunu",
    articleNumber: "8",
    verbatimText: "İşyeri hekimi, mesleki bağımsızlık ilkesine uygun olarak görev yapar.",
    connection: "İşyeri hekimlerinin yetki ve bağımsızlığı kanunla korunmaktadır.",
    dimensions: ["professional_ethics", "disciplinary_administrative"],
    evidence: evidence("legislation", "leg-isg-8", true),
    inForce: true
  },
  {
    documentId: "leg-organ-6",
    legislationName: "Organ ve Doku Nakli Kanunu",
    articleNumber: "6",
    verbatimText: "Organ nakli için donörün yazılı rızası şarttır.",
    connection: "Organ bağışı rıza ve onam kuralları kanunla düzenlenir.",
    dimensions: ["patient_rights", "professional_ethics"],
    evidence: evidence("legislation", "leg-organ-6", true),
    inForce: "unknown"
  },
  {
    documentId: "leg-uyte-10",
    legislationName: "Uremeye Yardimci Tedavi Yonetmeligi",
    articleNumber: "10",
    verbatimText: "Üremeye yardımcı tedavi uygulamalarında eşlerin birlikte rızası aranır.",
    connection: "Tüp bebek ve ÜYTE tedavilerinde rıza standartları yönetmelikle belirlenmiştir.",
    dimensions: ["patient_rights", "professional_ethics"],
    evidence: evidence("legislation", "leg-uyte-10", true),
    inForce: true,
    lastAmendedDate: "2023-08-22"
  },
  {
    documentId: "leg-getat-5",
    legislationName: "Geleneksel ve Tamamlayici Tip Uygulamalari Yonetmeligi",
    articleNumber: "5",
    verbatimText: "Geleneksel ve tamamlayıcı tıp uygulamaları yetkili hekimler tarafından yürütülür.",
    connection: "GETAT yetki sınırları yönetmelikle çerçevelenmiştir.",
    dimensions: ["professional_ethics", "disciplinary_administrative"],
    evidence: evidence("legislation", "leg-getat-5", true),
    inForce: "unknown"
  }
];

export const mockCourtDecisions: CourtDecision[] = [
  {
    id: "yargitay-reasoned-consent",
    court: "yargitay",
    chamber: "Mock Hukuk Dairesi",
    decisionDate: "2024-03-11",
    meritsNumber: "2023/10",
    decisionNumber: "2024/20",
    factSummary: "Tibbi mudahale oncesi bilgilendirme ve riza kapsami tartisildi.",
    legalReasoning:
      "Karar, somut olaydaki bilgilendirme kaydinin riza tartismasina etkisini gerekcelendirir.",
    outcome: "Uyusmazlik gerekceli degerlendirme ile sonuclandirildi.",
    relevanceNote: "Riza sorularina benzer; kayit ve olay ayrintilari ayrica incelenmelidir.",
    topicTags: ["riza", "aydinlatma", "hasta"],
    fullText: "Mock full text with facts, reasoning, and outcome.",
    evidence: evidence("yargitay", "yargitay-reasoned-consent", true)
  },
  {
    id: "danistay-procedural-affirmance",
    court: "danistay",
    chamber: "Mock Daire",
    decisionDate: "2024-04-02",
    meritsNumber: "2024/30",
    decisionNumber: "2024/40",
    factSummary: "Basvuru usulden incelendi.",
    legalReasoning: "Salt onama.",
    outcome: "Onama.",
    relevanceNote: "Esas saglik hukuku degerlendirmesi yoktur.",
    topicTags: ["riza"],
    fullText: "Usul karari. Salt onama.",
    evidence: evidence("danistay", "danistay-procedural-affirmance", true)
  },
  {
    id: "aym-metadata-only-health-data",
    court: "aym",
    decisionDate: "2023-09-01",
    meritsNumber: "B. No: 2023/1",
    decisionNumber: "Metadata",
    topicTags: ["mahremiyet", "saglik verisi"],
    evidence: evidence("aym", "aym-metadata-only-health-data", false)
  },
  {
    id: "yargitay-no-reasoning",
    court: "yargitay",
    decisionDate: "2022-05-08",
    meritsNumber: "2021/1",
    decisionNumber: "2022/2",
    factSummary: "Saglik hizmeti uyusmazligi.",
    outcome: "Bozma.",
    topicTags: ["komplikasyon"],
    fullText: "Olay ozeti ve sonuc var.",
    evidence: evidence("yargitay", "yargitay-no-reasoning", true)
  }
];
