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
  },
  {
    documentId: "leg-atama-1",
    legislationName: "Sağlık Bakanlığı Atama ve Yer Değiştirme Yönetmeliği",
    articleNumber: "1",
    verbatimText:
      "Bu Yönetmeliğin amacı; sağlık hizmetlerinin yurt genelinde etkin ve verimli bir şekilde yürütülebilmesi için Sağlık Bakanlığında görev yapan sağlık hizmetleri ve yardımcı sağlık hizmetleri sınıfı personelinin atama ve yer değiştirmelerine ilişkin usul ve esasları düzenlemektir.",
    connection: "Atama ve yer değiştirme usulleri bu yönetmelikle düzenlenir; tayin talepleri ve itiraz süreçleri bu kapsamda değerlendirilir.",
    dimensions: ["disciplinary_administrative", "professional_ethics"],
    evidence: evidence("legislation", "leg-atama-1", true),
    inForce: true,
    lastAmendedDate: "2024-11-27"
  },
  {
    documentId: "leg-atama-2",
    legislationName: "Sağlık Bakanlığı Atama ve Yer Değiştirme Yönetmeliği",
    articleNumber: "2",
    verbatimText:
      "Bu Yönetmelik; Sağlık Bakanlığı taşra teşkilatında görev yapan sağlık hizmetleri ve yardımcı sağlık hizmetleri sınıfı personelini kapsar. Ancak, Bakanlık merkez teşkilatından taşra teşkilatına, taşra teşkilatından merkez teşkilatına yapılacak atamalar ve görevlendirmeler ile eğitim ve araştırma hastanelerinde görev yapan eğitim görevlisi, başasistan ve asistanları kapsamaz.",
    connection: "Kapsam belirlemesi; hangi personelin bu yönetmelik hükümlerine tabi olduğunu netleştirir.",
    dimensions: ["disciplinary_administrative"],
    evidence: evidence("legislation", "leg-atama-2", true),
    inForce: true,
    lastAmendedDate: "2024-11-27"
  },
  {
    documentId: "leg-atama-5",
    legislationName: "Sağlık Bakanlığı Atama ve Yer Değiştirme Yönetmeliği",
    articleNumber: "5",
    verbatimText:
      "Bu Yönetmelik tüm atama ve yer değiştirmelerde; a) Kadro imkânları göz önünde bulundurulması, b) Ekonomik, sosyal ve kültürel şartlar ile ulaşım şartları yönünden benzerlik ve yakınlık gösteren illerin gruplandırılarak işlem yapılması, c) Personelin hizmet bölgeleri ve grupları arasında, hizmet gerekleri de dikkate alınarak, adil ve dengeli dağılımın sağlanması, ç) Personel hareketlerinde hizmet puanının belirleyici olması, d) PDC'de belirlenen sayılardaki aktif çalışanların dikkate alınarak idarenin hizmet ihtiyacının karşılanması, e) Atamalarda hizmet birimlerinin ihtiyacına göre sertifika, diploma gibi özel nitelikler aranılarak, nitelikli personel eliyle hizmet sunumunun sağlanması, f) Personelin başvuru tarihinde yürürlükte olan usul ve esaslar çerçevesinde işlem yapılması ilkelerini esas alır.",
    connection: "Temel ilkeler; atama ve yer değiştirme taleplerinin değerlendirilmesinde dikkate alınan kriterleri belirler.",
    dimensions: ["disciplinary_administrative", "professional_ethics"],
    evidence: evidence("legislation", "leg-atama-5", true),
    inForce: true,
    lastAmendedDate: "2024-11-27"
  },
  {
    documentId: "leg-tuey-1",
    legislationName: "Tıpta ve Diş Hekimliğinde Uzmanlık Eğitimi Yönetmeliği",
    articleNumber: "1",
    verbatimText:
      "Bu Yönetmeliğin amacı; tıp ve diş hekimliği alanlarında uzmanlık eğitimi, uzmanlık belgelerinin verilmesi ve Tıpta Uzmanlık Kurulunun çalışma usul ve esaslarını düzenlemektir. Bu Yönetmelik; Tıpta Uzmanlık Kurulu ile tıp ve diş hekimliği alanlarında eğitim vermeye yetkili kurum ve uzmanlık eğitimi ile ilgili programları ve kişileri kapsar.",
    connection: "Tıpta uzmanlık eğitiminin yasal çerçevesi; asistan hakları, eğitim süreleri ve uzmanlık belgeleri bu yönetmelikle düzenlenir.",
    dimensions: ["professional_ethics", "disciplinary_administrative"],
    evidence: evidence("legislation", "leg-tuey-1", true),
    inForce: true,
    lastAmendedDate: "2023-10-07"
  },
  {
    documentId: "leg-tuey-2",
    legislationName: "Tıpta ve Diş Hekimliğinde Uzmanlık Eğitimi Yönetmeliği",
    articleNumber: "2",
    verbatimText:
      "Bu Yönetmelik, 11/4/1928 tarihli ve 1219 sayılı Tababet ve Şuabatı San'atlarının Tarzı İcrasına Dair Kanun ile 1 sayılı Cumhurbaşkanlığı Teşkilatı Hakkında Cumhurbaşkanlığı Kararnamesinin 369 uncu ve 508 inci maddelerine dayanılarak hazırlanmıştır.",
    connection: "Dayanak maddesi; yönetmeliğin hukuki temelini ve kanuni dayanağını gösterir.",
    dimensions: ["professional_ethics"],
    evidence: evidence("legislation", "leg-tuey-2", true),
    inForce: true,
    lastAmendedDate: "2023-10-07"
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
