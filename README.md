# Doktor MCP

> **v1 Sürüm Adayı** — `doktor-mcp v0.45.0`, v1.0.0 sürüm adayıdır.
> Kontrol listesi için [docs/RELEASE_v1.md](docs/RELEASE_v1.md) dosyasına bakın.

`doktor-mcp`, hekimlere yönelik **kaynak-temelli hukuki bilgilendirme paketleri** üreten,
bağımsız bir TypeScript/Node.js MCP iskeletidir. Kategorik nihai hukuki görüş vermez ve
hekime ne yapacağını söylemez. Soruları resmî mevzuat metniyle ve gerekçeli yüksek mahkeme
karar metniyle eşleştirir; kesin hüküm vermeden, kaynağa dayalı koşullu değerlendirmeler
(ör. "kaynaklar bu yönde eğilim göstermektedir") sunabilir.

Adaptör sınırları şunlar için hazırlanmıştır:

- `legislation` (mevzuat)
- `yargitay`
- `danistay`
- `aym`

Genel internet makaleleri, bloglar, haberler, hukuk bürosu tanıtım sayfaları ve forumlar
bu projenin kaynak girdileri **değildir**.

## Kaynak Motoru Aktarımı (Source Engine Port)

Kaynak-motoru katmanı, canlı adaptörlerin ihtiyaç duyduğu sağlamlaştırmayı sağlar:

- Bedesten istekleri; sınırlı yeniden deneme, `Retry-After` işleme, üstel geri-çekilme
  (backoff), titreşim (jitter) ve istek telemetrisi içeren paylaşılan bir `HttpClient` ve
  `RateLimiter` yolu kullanır.
- Canlı kaynak hataları yapılandırılmış ve yalnızca-JSON kalır. Kaynak tanılaması; CLI JSON
  çıktısına log yazmadan yeniden deneme sayısı, backoff süresi, durum ve içerik tipini taşıyabilir.
- `src/sources/sourceRegistry.ts`, mevzuat ve emsal kaynakları için sadeleştirilmiş kaynak
  yeteneği, hız limiti ve önbellek politikası meta verisini sunar.
- Bedesten/Yargıtay adaptörleri yalnızca-meta veri içeren kararları doğrulanmış emsal
  çıktısından uzak tutar; resmî mevzuat ise resmî arama, doküman getirme veya madde çıkarımı
  bir alıntıyı destekleyemediğinde yapılandırılmış `unavailable` sonuç döndürür.

## Canlı Mevzuat Durumu

Canlı resmî mevzuat adaptörü, opsiyonel MCP araç akışlarına bağlanmıştır:

- adaptör: `LiveOfficialLegislationAdapter`
- resmî kaynak: T.C. Cumhurbaşkanlığı Mevzuat Bilgi Sistemi — `mevzuat.gov.tr`
- arama yeteneği: resmî `MevzuatDatatable` arama isteği ayrıştırıcısı
- tam-metin yeteneği: resmî `MevzuatMetin` doküman getirme
- mevcut çıkarım kanıtı: eşlenmiş mevzuat için PDF metin çıkarımı ve madde ayrıştırma

Sağlık mevzuatı ilk canlı eşleme yoludur. Hasta hakları ve aydınlatılmış onam soruları,
Hasta Hakları Yönetmeliği `4847` için resmî üretilmiş PDF yolunu kullanır (eşlenmiş madde
`24` ve `26` dahil). Sağlık hukuku eşlemeleri ayrıca Tıbbi Deontoloji Nizamnamesi, Tababet
ve Şuabatı San'atlarının Tarzı İcrasına Dair Kanun ve Sağlık Hizmetleri Temel Kanunu'nu da
kapsar. KVKK madde `6`, kişisel-sağlık-verisi ve mahremiyet soruları için, sağlığa özel
kaynaklardan sonra destekleyici genel mevzuat olarak kullanılabilir.

Resmî bir doküman çıkarılabilir bir formatta gelmediğinde veya eşlenmiş bir madde
çıkarılamadığında, canlı adaptör bir hüküm üretmek yerine yapılandırılmış `unavailable`
çıktısı döndürür.

Canlı kaynak hataları şu sözleşmeyi kullanır:

```json
{
  "status": "unavailable",
  "source": "mevzuat.gov.tr",
  "errorCode": "provision_not_found",
  "message": "Official text was retrieved but the mapped article could not be extracted.",
  "retryable": false,
  "recommendedNextStep": "Inspect the official text parser before using this provision in an answer."
}
```

## MVP Kapsamı

İskelet şunları içerir:

- MCP sunucu kaydı ve araç işleyici iskelesi
- resmî mevzuat delili, mahkeme kararı delili, sınıflandırma, emsal durumu ve hukuki
  bilgilendirme paketi için tip sözleşmeleri
- mock mevzuat ve yüksek mahkeme adaptörleri
- resmî kaynak doğrulaması için canlı resmî mevzuat adaptörü
- canlı mevzuat için MCP `sourceMode` yönlendirmesi
- sağlık-öncelikli mevzuat eşlemeleri ve kaynak izleme (source trace) meta verisi
- sağlık hukuku boru hattı parçaları:
  - soru sınıflandırıcı
  - mevzuat eşleyici
  - emsal filtresi
  - cevap derleyici
- yerel JSON smoke komutu
- ilk kaynak-güvenliği kuralları için Vitest kapsamı

Emsal filtresi şu an şu durumları sunar:

- `precedent_usable`: tam metin, hukuki gerekçe ve olay ilgililiği mevcut
- `limited_value`: tam metin var ama ilgililik zayıf
- `procedural_only`: esasa ilişkin gerekçe yok; usuli metin, salt onama veya salt bozma
- `metadata_only`: tam metin olmadan künye meta verisi
- `no_reasoning`: tam metin var ama hukuki gerekçe yok

Derlenen pakette doğrulanmış emsal bölümüne yalnızca `precedent_usable` kayıtları girer.

## Yanıt Sözleşmesi (Response Contract)

Tüm araç yanıtları `dataOrigin` alanı taşır. Bu alan, yanıtın kaynağını belirtir:

| `dataOrigin` | Anlamı |
|---|---|
| `"mock"` | Yanıt fixture (kurgu) verisi içerir. Gerçek mevzuat veya karar **değildir**. |
| `"live"` | Yanıt canlı kaynaklardan (mevzuat.gov.tr, Bedesten, Danıştay) gelmiştir. |
| `"snapshot"` | Yanıt önceden kaydedilmiş canlı kaynak snapshot'ıdır. |
| `"computed"` | Yanıt yalnızca hesaplama sonucudur (sınflandırıcı gibi). Kaynak veri içermez. |
| `"client-provided"` | Yanıt, istemci tarafından sağlanan girdiye dayanır. |

`dataOrigin: "mock"` olduğunda, yanıt ayrıca `mockDataWarning` alanı taşır:

```json
{
  "dataOrigin": "mock",
  "mockDataWarning": "BU YANIT KURGU (FIXTURE) VERİSİDİR. Gerçek mevzuat veya mahkeme kararı DEĞİLDİR. Gerçek kaynaklar için sourceMode: 'live' kullanın."
}
```

Bu uyarı, mock verinin gerçek mevzuat alıntısı gibi görünmesini önlemek için
kaçırılamaz şekilde eklenmiştir. `shortAnswer` gibi hekime-dönük metin alanlarına
ek önek eklenmez; üst-seviye `dataOrigin` ve `mockDataWarning` alanları yeterlidir.

Yapılandırılmış paket, istenen hekime-dönük bölümler etrafında şekillenir:

1. `shortAnswer`
2. `legalClassification`
   - `criminal`
   - `civilCompensation`
   - `disciplinaryAdministrative`
   - `patientRights`
   - `privacyKvkk`
   - `professionalEthics`
3. `relevantLegislation`
   - mevzuat adı
   - madde numarası
   - kaynak hükümden birebir kopyalanmış alıntı
   - olay bağlantısı
4. `verifiedHighCourtPrecedents`
   - mahkeme/daire, tarih, esas/karar numaraları
   - olay özeti, hukuki değerlendirme, sonuç
   - benzerlik/farklılık notu
5. `missingInformation`
6. `lawyerReviewPoints`

Her mevzuat girdisi bir kaynak doküman id'si ve birebir kaynak alıntısı taşır. Her
doğrulanmış emsal girdisi, gerekçeli-emsal filtresinden geçmek zorundadır.

## Bilinçli Olarak Kapsam Dışı

MVP şunları içermez:

- canlı AYM yüksek mahkeme istemcisi (AYM kararlar bilgi bankası HTML-only arayüzdür; JSON API yoktur — `synthetic_only` işaretlidir)
- kaynak referansı veya koşullu dil olmaksızın kategorik risk seviyesi puanlaması ("risk seviyesi yüksek/düşük")
- acil eylem talimatları
- dilekçe veya savunma yazımı
- nihai hukuki sonuçlar
- "sorumluluk vardır" veya "sorumluluk yoktur" gibi kategorik ifadeler
- Araç, kaynağa dayalı koşullu değerlendirmeler (ör. "kaynaklar şu yönde eğilim gösteriyor") sunabilir; ama asla kategorik nihai hüküm vermez
- MCP kaynak kayıtlarıyla doğrulanmamış, yalnızca-modele dayalı hukuki önermeler

## v0.44.0'da Yeni

- **`assessmentTone`**: Opsiyonel parametre (`"strict"` | `"grounded-advisory"`, varsayılan: `"grounded-advisory"`). `strict` modda yalnızca kaynak listeleri döner (değerlendirme yok). `grounded-advisory` modda, kaynağa dayalı koşullu değerlendirme içeren bir `preliminaryAssessment` eklenir.
- **`preliminaryAssessment`**: `summary` ve `sentences[]` içeren opsiyonel yanıt alanı. Her cümlede `text`, `sourceRef` ve `sourceLabel` bulunur. Cümleler emsallerden gerçek sonuç/gerekçeyi ve mevzuattan birebir alıntı parçalarını kullanır — asla kalıp (boilerplate) değil.
- **Mevzuat yürürlük meta verisi**: Hükümler `inForce`, `lastAmendedDate` ve `repealed` alanları taşır (varsayılan olarak asla "yürürlükte" varsaymaz).
- **Karar deduplikasyonu**: Çapraz-kaynak tekrarları (ör. aynı kararın Yargıtay ve Bedesten'den gelmesi) deduplike edilir; en zengin sürüm tutulur.
- **Tam Türkçe diakritik politikası**: Tüm hekime-dönük metinler doğru Türkçe karakterleri kullanır (ASCII ikamesi yok).
- Tam sürüm geçmişi için [CHANGELOG.md](./CHANGELOG.md). Kararlılık katmanları için [COMPATIBILITY.md](./docs/COMPATIBILITY.md).

Hız limiti canlı istemciler için ayrılmıştır: amaçlanan davranış, gerçek bir blok veya
kaynak hatasından sonra adaptif backoff ile pratik kamu-kaynağı trafiğidir; baskı kanıtı
olmadan agresif bir kısıtlama değildir.

## MCP Araçları

- `classify_medical_legal_question`
- `search_health_legislation`
- `get_legislation_provisions`
- `search_health_precedents`
- `filter_reasoned_precedents`
- `prepare_doctor_legal_information_pack`

Mevzuata-dönük MCP girdileri opsiyonel `sourceMode` kabul eder:

```json
{
  "question": "kişisel sağlık verisi mahremiyet",
  "sourceMode": "live"
}
```

`sourceMode` varsayılan olarak `"mock"`'tur; yani mock davranışı varsayılandır.
`search_health_legislation`, `get_legislation_provisions` ve
`prepare_doctor_legal_information_pack` `"live"` kullanabilir. Canlı bilgilendirme paketi
aynı MVP şeklini korur ve `sourceUnavailable`'ı yalnızca resmî mevzuat kaynağı doğrulanmış
bir hüküm döndüremediğinde ekler.

Mock mod yerel fixture hükümlerini kullanır. Canlı mod, `mevzuat.gov.tr`'den resmî mevzuat
metnini, ayrıca canlı Yargıtay ve Danıştay emsal adaptörlerini kullanır. AYM yalnızca-mock'tur
ve canlı modda bir geri-dönüş (fallback) olarak kullanılmak yerine devre dışı bırakılır.

## Sağlık Mevzuatı Önceliği

Canlı eşleme katmanı hekim sorularını sağlık-hukuku konu kümelerine ayırır:

- aydınlatılmış onam / onam
- tıbbi müdahale
- hasta hakları
- hasta mahremiyeti
- kişisel sağlık verisi
- kayıt, dosya ve epikriz
- acil müdahale
- sevk ve konsültasyon
- hekimin özen yükümlülüğü
- meslek etiği

Her eşleme; hedef mevzuatı, hedef madde numaralarını, arama terimlerini, bir seçim
gerekçesini ve bir sağlık-hukuku önceliğini taşır. Birden çok eşleme uyduğunda, paket
birincil sağlık mevzuatını destekleyici genel mevzuattan önce sıralar. Örneğin bir
kişisel-sağlık-verisi mahremiyet sorusu, KVKK'dan önce Hasta Hakları Yönetmeliği'ni
döndürebilir; KVKK, ilgisiz hekim soruları için geniş bir geri-dönüş olarak kullanılmaz.

## Kaynak İzleme (Source Trace)

`sourceTrace`, hukuki gerekçe sağlamak yerine canlı mevzuat çıktısını denetler. Her iz, bir
hükmün sağlık-hukuku eşlemesinden resmî dokümana ve madde çıkarım adımına nasıl geçtiğini gösterir:

- orijinal `query`
- `matchedHealthMapping` ve eşleme olmadığında denenen eşleme adayları
- `officialSearchRequest`, resmî arama sonuç sayısı ve kompakt resmî sonuçlar
- `selectedSearchResult` ve `selectedResultReason`
- landing/detay URL'i ve doğrudan ya da üretilmiş PDF URL'i
- `contentType`, çıkarım yöntemi, çıkarılan madde numaraları ve getirme süresi

Canlı `search_health_legislation`, seçilen hükümlerin yanında izi de içerir. Canlı
`get_legislation_provisions`, dönen her hükümde iz taşır. Canlı
`prepare_doctor_legal_information_pack`, izi hem ilgili mevzuat girdilerinde hem de
pakete-düzey `sourceTrace` dizisinde tutar; böylece derlenen alıntı, aynı çıkarılmış
hükme karşı kontrol edilebilir.

Bir `unavailable` canlı paket de denetim bağlamını korur:

```json
{
  "sourceUnavailable": [
    {
      "status": "unavailable",
      "source": "mevzuat.gov.tr",
      "errorCode": "document_not_found",
      "sourceTrace": [
        {
          "query": "bilinmeyen konu",
          "matchedHealthMapping": null,
          "attemptedHealthMappings": ["mevzuat:7.5.4847", "mevzuat:1.5.6698"]
        }
      ]
    }
  ]
}
```

`matchedHealthMapping` ve `selectedResultReason`; konu kümesini, sağlık-hukuku önceliğini ve
seçilen eşlemenin birincil sağlık mevzuatı mı yoksa destekleyici genel mevzuat mı olduğunu
gösterir. İz alanları yalnızca kaynak seçimini ve çıkarımı açıklar. Hukuki önerme üretmezler
ve birebir resmî hüküm metninin yerini asla almazlar.

## Hüküm Sıralaması (Provision Ranking)

Canlı hüküm sıralaması, resmî madde çıkarımından sonra deterministik puanlama çalıştırır.
Paket için kompakt bir kaynak-madde kümesi seçer; madde metni, hukuki tavsiye veya kategorik
hukuki sonuç üretmez.

Sıralama sinyalleri:

- hekim sorgu terimleri
- eşlenen sağlık-hukuku konu kümesi
- eşleme arama terimleri
- çıkarılan madde kullanılabilir bir başlıkla başladığında madde başlığı metni
- çıkarılan madde metni içindeki anahtar kelime eşleşmeleri
- eşlenmiş madde-listesi bonusu
- sağlık-hukuku önceliği ve birincil/destekleyici rol sıralaması

Canlı iz; `candidateArticleNumbers`, `rankedArticleNumbers`, `rejectedArticleNumbers` ve
`rankingMethod`'u gösterir. Dönen her canlı hüküm ayrıca kendi deterministik skorunu, eşleşen
terimleri, sıralama gerekçelerini ve manuel eşlenmiş madde listesinden gelip gelmediğini
taşır. Canlı adaptör tek bir mevzuat dokümanını küçük bir sıralanmış madde kümesiyle
sınırlar — şu an en fazla üç hüküm. Çıkarılan eşlenmiş maddeler önce gelir; yüksek-sinyalli
sıralanmış yedek maddeler yalnızca eşlenmiş maddeler çıkarımda yoksa değerlendirilir. İz hem
seçilen hem reddedilen aday izini korur.

KVKK, kişisel-sağlık-verisi ve mahremiyet soruları için `supporting_general` kalır.
Sıralamada veya paket sıralamasında birincil sağlık mevzuatının yerini almaz. Yargıtay,
Danıştay ve AYM adaptörleri mock adaptör olarak kalır.

## Seçim Tanılaması (Selection Diagnostics)

Seçim tanılaması, kaynak seçimi için kısa bir denetim görünümü sağlar: `sourceTrace` hâlâ
resmî isteği, dokümanı, çıkarımı, adayı, sıralamayı ve `unavailable` detayını içerirken,
tanılama tam bir iz okuması gerektirmeden neyin seçildiğini özetler.

Kompakt tanılama şunları içerir:

- query ve `sourceMode`
- seçilen mevzuat ve hüküm sayıları
- her seçilen mevzuatın rolü, konu kümesi, önceliği, madde numaraları, reddedilen
  madde-numarası özeti ve seçim gerekçesi
- her seçilen hükmün skoru, eşleşen terimleri, en iyi sıralama gerekçeleri ve eşlenmiş-madde bayrağı
- `unavailable` ve uyarı sayıları

Örnek canlı özet:

```json
{
  "selectionDiagnostics": {
    "query": "kisisel saglik verisi mahremiyet",
    "sourceMode": "live",
    "selectedLegislationCount": 2,
    "selectedProvisionCount": 2,
    "selectedLegislations": [
      {
        "legislationName": "Hasta Haklari Yonetmeligi",
        "legislationRole": "health_primary",
        "topicCluster": "patient_privacy",
        "selectedArticleNumbers": ["21"]
      },
      {
        "legislationName": "Kisisel Verilerin Korunmasi Kanunu",
        "legislationRole": "supporting_general",
        "topicCluster": "personal_health_data",
        "selectedArticleNumbers": ["6"]
      }
    ],
    "unavailableCount": 0
  }
}
```

Tanılama yalnızca denetim meta verisidir. Resmî hüküm alıntılarının yerini almaz, hukuki
önerme üretmez ve KVKK'yı destekleyici-genel rolünde tutar. Yargıtay, Danıştay ve AYM
adaptörleri mock adaptör olarak kalır.

## Karar Kaynak İzi (Decision Source Trace)

`DecisionSourceTrace`, her mahkeme kararı adayı için karar boru hattını denetler.
`LegislationSourceTrace`'in emsal-tarafı karşılığıdır. Her iz şunları taşır:

- orijinal `query`
- `source` ve `court` (yargitay / danistay / aym)
- `searchRequest` (mock adaptörler için null)
- `searchResultsCount` ve `selectedResult`
- `documentId` / `sourceId`
- `fullTextAvailable` ve `fullTextRetrievalMethod`
- `retrievedAt`
- `eligibilityStatus` — emsal filtresi sonucu
- `eligibilityReasons` — kararın karşıladığı olumlu kriterler
- `exclusionReasons` — varsa, dışlanmasının belirli neden(ler)i
- getirme başarısız olduysa `error`

Karar kaynak izleri yalnızca denetim meta verisidir. Hukuki gerekçe üretmezler ve karar tüm
uygunluk kriterlerini geçmedikçe pakete asla bir mahkeme kararı eklemezler.

## Gerekçeli-Karar Uygunluğu

`assessDecisionEligibility` (`src/health/decisionEligibility.ts` içinde) emsal filtresi
kurallarını uygular ve durum, olumlu uygunluk gerekçeleri ve dışlama gerekçeleriyle
yapılandırılmış bir `EligibilityResult` döndürür.

Bir karar, aşağıdakilerden herhangi biri geçerliyse doğrulanmış-emsaller bölümünden **dışlanır**:

- `fullTextAvailable: false` — tam karar metni mevcut değil (→ `metadata_only`)
- `legalReasoning` boş veya eksik (→ `no_reasoning`)
- Karar metni salt usuli işaret içeriyor: `salt onama`, `salt bozma`, `usul karar`
  (→ `procedural_only`)
- Hukuki gerekçe, esasa ilişkin içerik olmadan yalnızca `onama` veya `bozma`
  (→ `procedural_only`)
- Kararı sağlık-hukuku olayına bağlayan `relevanceNote` yok (→ `limited_value`)

Paketin `verifiedHighCourtPrecedents` bölümüne yalnızca `precedent_usable` kararları girer.
`limited_value`, `procedural_only`, `no_reasoning` ve `metadata_only` kararları dışlanır.

## Emsal Tanılaması (Precedent Diagnostics)

`PrecedentSelectionDiagnostics`, karar seçimi için kompakt denetim görünümüdür; mevzuat
tarafındaki `LegislationSelectionDiagnostics`'in karşılığıdır. Her
`prepare_doctor_legal_information_pack` yanıtında ve `filter_reasoned_precedents` araç
yanıtında `precedentDiagnostics` olarak görünür.

Tanılama şunları içerir:

- `query` — orijinal soru
- `selectedPrecedentCount` / `excludedDecisionCount`
- `selectedPrecedents[]` — mahkeme, daire, tarih, esas/karar numaraları, durum, eşleşen
  sağlık konuları ve uygunluk gerekçeleri
- `excludedDecisions[]` — mahkeme, tarih, durum ve dışlama gerekçeleri

Tanılama yalnızca seçimi ve dışlamayı özetler. Hukuki yorum sağlamaz ve pakete hiçbir karar
eklemez.

## Canlı Yargıtay Adaptörü

İlk canlı mahkeme kararı adaptörü: `LiveYargitayAdapter`
(`src/sources/yargitay/liveYargitayAdapter.ts`). Danıştay ve AYM mock adaptör olarak kalır.

**Kaynak ve uç nokta:** `https://bedesten.adalet.gov.tr/emsal-karar/searchDocuments` adresini
`YARGITAYKARARI` filtresiyle hedefler. Sağlık hukuku arama terimini içeren JSON POST gövdesi.
429 ve 5xx hataları için adaptif backoff ile üç kez yeniden dener.

**`sourceMode: "live"` emsal davranışı:**

- `search_health_precedents` canlı Yargıtay adaptörünü kullanır; Danıştay ve AYM mock kalır.
- `sourceMode: "live"` ile `prepare_doctor_legal_information_pack`, canlı mevzuata ek olarak
  canlı Yargıtay kararlarını arar.
- Sağlık hukuku arama terimleri sınıflandırılmış sorudan eşlenir: `riza/rıza/onam` →
  `"aydınlatılmış rıza"`, `tibbi/müdahale` → `"tıbbi müdahale"`, vb.
- `verifiedHighCourtPrecedents`'e yalnızca `precedent_usable` kararları girer. Diğerlerinin
  hepsi dışlama gerekçeleriyle `precedentDiagnostics.excludedDecisions`'a kaydedilir.

**`DecisionSourceTrace` canlı örneği:**

```json
{
  "query": "aydınlatılmış rıza",
  "source": "yargitay",
  "court": "yargitay",
  "searchRequest": {
    "url": "https://bedesten.adalet.gov.tr/emsal-karar/searchDocuments",
    "phrase": "aydınlatılmış rıza",
    "pageSize": 5
  },
  "searchResultsCount": 12,
  "selectedResult": { "documentId": "yargitay:99001" },
  "selectedResultReason": "Health law term 'aydınlatılmış rıza' matched Yargıtay emsal search.",
  "fullTextAvailable": true,
  "fullTextRetrievalMethod": "html-text",
  "retrievedAt": "2026-05-22T10:00:00.000Z",
  "eligibilityStatus": "precedent_usable",
  "eligibilityReasons": [
    "Tam karar metni mevcut.",
    "Hukuki gerekçe alanı dolu.",
    "Sağlık hukuku olayıyla bağlantı kurulmuş.",
    "Emsal olarak kullanılabilir."
  ],
  "exclusionReasons": []
}
```

**Canlı kaynak hatası davranışı:** `bedesten.adalet.gov.tr` erişilemezse veya ayrıştırılamayan
bir yanıt dönerse, adaptör yapılandırılmış bir `unavailable` sonucu döndürür:

```json
{
  "status": "unavailable",
  "source": "yargitay.gov.tr",
  "errorCode": "source_error",
  "message": "Yargıtay request failed: fetch failed",
  "retryable": true,
  "recommendedNextStep": "Retry after checking network access to bedesten.adalet.gov.tr.",
  "sourceTrace": [{ "query": "aydınlatılmış rıza", "searchRequest": { ... } }]
}
```

Hiçbir karar uydurulmaz. Paket, mock Danıştay ve AYM sonuçlarıyla çalışmaya devam eder ve
Yargıtay kaynağı için `precedentDiagnostics`'te 0 seçilmiş emsal gösterir.

Danıştay ve AYM adaptörleri mock adaptör olarak kalır.

## Çok-Kaynaklı Canlı Emsal Boru Hattı

Canlı Danıştay adaptörü, merkezi sağlık hukuku sorgu genişletme modülü, kaynak-başına
tanılama (`sourceSummaries`) ve dosya-tabanlı sonuç önbelleği.

### Canlı Danıştay Adaptörü

`LiveDanistayAdapter` (`src/sources/danistay/liveDanistayAdapter.ts`)
`https://karararama.danistay.gov.tr/aramalist` adresini hedefler. Yargıtay adaptörüyle aynı
yeniden deneme, HTML tam-metin çıkarımı ve uygunluk değerlendirme desenini izler. `court`
`"danistay"` olarak ayarlanır ve doküman id'leri `danistay:` ön ekiyle başlar.

Adaptör, kendi terim haritasını tutmak yerine merkezi sorgu genişletme modülünden
`pickHealthLawQuery` kullanır.

### `precedentSources` Parametresi

`prepare_doctor_legal_information_pack` ve `search_health_precedents` artık canlı modda hangi
mahkemelerin sorgulanacağını seçmek için opsiyonel bir `precedentSources` dizisi kabul eder:

```json
{
  "question": "aydınlatılmış rıza",
  "sourceMode": "live",
  "precedentSources": ["yargitay", "danistay"]
}
```

Geçerli değerler: `"yargitay"`, `"danistay"`, `"aym"`. Belirtilmezse varsayılan üçü birden.
AYM bir mock adaptör olarak kalır.

Bir kaynak erişilemez olduğunda, diğerleri devam eder. Paket asla tek bir adaptör hatasına
takılıp bloke olmaz.

### `assessmentTone` Parametresi (v0.44.0)

`prepare_doctor_legal_information_pack` ayrıca opsiyonel bir `assessmentTone` parametresi kabul eder:

```json
{
  "question": "hasta hakları nelerdir",
  "sourceMode": "mock",
  "assessmentTone": "grounded-advisory"
}
```

| Değer | Davranış |
|-------|----------|
| `"grounded-advisory"` (varsayılan) | Paket, kaynağa dayalı koşullu cümleler içeren `preliminaryAssessment`'i içerir. Her cümle bir `sourceRef` taşır. |
| `"strict"` | Eski davranış: yalnızca kaynak listeleri döner. Değerlendirme metni üretilmez. |

`preliminaryAssessment` alanı `summary` (genel bakış) ve `sentences[]` (tekil değerlendirme
maddeleri) içerir. Her cümlede `text`, `sourceRef` ve `sourceLabel` bulunur. Cümleler
emsallerden gerçek sonuç/gerekçeyi ve mevzuattan birebir alıntı parçalarını kullanır — asla
kalıp değil. Kararlılık garantileri için [COMPATIBILITY.md](./docs/COMPATIBILITY.md).

### Sağlık Hukuku Sorgu Genişletme

`src/health/healthLawQueryExpansion.ts`, hem Yargıtay hem Danıştay adaptörleri tarafından
paylaşılan deterministik terim eşlemesi sağlar:

- `riza` / `onam` / `aydinlat` → `"aydınlatılmış rıza"`
- `komplikasyon` → `"komplikasyon tıbbi müdahale"`
- `malpraktis` → `"malpraktis hekim kusur"`
- `hekim` → `"hekimin özen yükümlülüğü"`
- `hasta` → `"hasta hakları"`
- `veri` / `mahrem` → `"sağlık verisi mahremiyet"`
- `kusur` → `"hizmet kusuru tıbbi müdahale"`
- `acil` → `"acil müdahale hekim yükümlülüğü"`

`pickHealthLawQuery`, sınıflandırılmış bir soru için en yüksek öncelikli eşlenmiş terimi
döndürür. `pickHealthLawQueries`, çok-terimli aramalar için en fazla N adet farklı terim döndürür.

### `precedentDiagnostics` içinde `sourceSummaries`

`PrecedentSelectionDiagnostics` artık kaynak-başına dökümle `sourceSummaries[]` içerir:

```json
{
  "precedentDiagnostics": {
    "query": "aydınlatılmış rıza",
    "selectedPrecedentCount": 1,
    "excludedDecisionCount": 2,
    "sourceSummaries": [
      {
        "source": "yargitay",
        "mode": "live",
        "searched": true,
        "searchResultsCount": 5,
        "candidateCount": 2,
        "selectedCount": 1,
        "excludedCount": 1,
        "unavailableCount": 0,
        "errorCodes": []
      },
      {
        "source": "danistay",
        "mode": "live",
        "searched": false,
        "searchResultsCount": null,
        "candidateCount": 0,
        "selectedCount": 0,
        "excludedCount": 0,
        "unavailableCount": 1,
        "errorCodes": ["source_error"]
      }
    ]
  }
}
```

`selectedPrecedents[]` ve `excludedDecisions[]` girdileri artık her kararı hangi adaptörün
ürettiğini belirtmek için bir `source` alanı (`court` ile aynı değer) da içerir.

### Dosya-Tabanlı Önbellek

`PrecedentCache` (`src/sources/precedentCache.ts`), canlı adaptör sonuçlarını bir saatlik TTL
ile `.cache/precedents/`'e önbelleğe alır. Önbellek dosyaları kaynak, sorgu ve sayfa boyutuna
göre anahtarlanır. Önbellek yazma hataları ölümcül değildir.

`smoke:precedents` üç önbellek bayrağını destekler:

```powershell
# Önbelleği kullan (varsayılan)
npm run smoke:precedents -- "aydınlatılmış rıza"

# Önbellek okuma ve yazmalarını atla
npm run smoke:precedents -- "aydınlatılmış rıza" --no-cache

# Taze getirmeyi zorla ve önbellek girdisinin üzerine yaz
npm run smoke:precedents -- "aydınlatılmış rıza" --refresh
```

`.cache/`, `.gitignore`'dadır ve asla commit edilmez.

## Emsal Kaynak Kalibrasyonu

Derin probe analizi ve normalleştirici sağlamlaştırma. Tam kalibrasyon iş akışı için
`docs/LIVE_SOURCE_CALIBRATION.md`.

### Doğrulanmış uç nokta davranışı (2026-05-22)

| Kaynak | Durum | Uç nokta |
|--------|-------|----------|
| **Yargitay** | `reachable_json` | `bedesten.adalet.gov.tr/emsal-karar/searchDocuments` - Bedesten proxy üzerinden aktif entegrasyon. |
| **Danistay** | `reachable_json` | `karararama.danistay.gov.tr/aramalist` - aktif entegrasyon. |
| **Bedesten** | `reachable_json` | `bedesten.adalet.gov.tr/emsal-karar/searchDocuments` - aktif birleşik entegrasyon. |
| **AYM** | `synthetic_only` | Canlı uç nokta yok. Yalnızca mock adaptör. |

### Probe CLI

```powershell
# HTML/SOAP analizi ve fixture kaydıyla derin probe
npm run probe:precedents -- "aydınlatılmış rıza" -- --source yargitay --save-fixture
npm run probe:precedents -- "hizmet kusuru tıbbi müdahale" -- --source danistay --save-fixture
```

Probe çıktısı şunları içerir: HTTP durumu, content-type, HTML/SOAP analizi (başlık, form
aksiyonları, uç nokta ipuçları, gövde uzunluğu, captcha/login tespiti), `calibrationStatus`
ve `recommendedNextStep`.

### JSON-olmayan yanıt sınıflandırması

Bir canlı adaptör JSON-olmayan bir yanıt aldığında, `DecisionSourceTrace.error` şunu içerir:

| Kod | Anlamı |
|------|--------|
| `non_json_response:html_shell_response` | HTTP 200 + küçük HTML SPA kabuğu |
| `non_json_response:unexpected_html_response` | Login/büyük HTML |
| `non_json_response:xml_soap_response` | SOAP/XML servis yanıtı |
| `non_json_response:captcha_or_block` | CAPTCHA tespit edildi |
| `non_json_response:empty_response` | Boş gövde |

### Ham fixture politikası

- `fixtures/raw/` gitignore'dadır — ham yanıt gövdelerini asla commit etme.
- `fixtures/live-samples/` sanitize edilmiş/sentetik fixture'ları tutar — commit etmek güvenli.
- Sanitize edilmiş fixture formatı için `fixtures/live-samples/README.md`.

### Pack audit genişletilmiş kontrolleri

`audit:pack` artık şunları da kontrol eder:

- `sourceSummaries`'te erişilemez kaynaklar → hata kodlarıyla uyarı
- Doğrulanmış bir emsalde `decisionSourceTrace.fullTextAvailable === false` → hata
- Doğrulanmış bir emsalde `decisionSourceTrace.eligibilityStatus !== "precedent_usable"` → hata

Tam kontrol referansı için `docs/PACK_AUDIT.md`.

## Üretim Kurulumu

`sourceMode` varsayılan olarak `"mock"`'tur — yani tool çağrısında `sourceMode`
belirtilmezse, yanıt fixture (kurgu) verisi içerir ve `mockDataWarning` alanı eklenir.

Canlı modda çalışmak için iki seçeneğiniz vardır:

1. Her tool çağrısında `sourceMode: "live"` ekleyin (en basit yol)
2. MCP istemci yapılandırmanızda `DOKTOR_MCP_DEFAULT_SOURCE_MODE=live` ortam değişkenini ayarlayın

İkinci seçenek, tüm tool çağrıları için varsayılanı `"live"` yapar — böylece her çağrıda
`sourceMode` belirtmenize gerek kalmaz.

### Örnek: Claude Desktop Yapılandırması

```json
{
  "mcpServers": {
    "doktor-mcp": {
      "command": "node",
      "args": ["dist/mcp/server.js"],
      "env": {
        "DOKTOR_MCP_DEFAULT_SOURCE_MODE": "live"
      }
    }
  }
}
```

### Geçerli Değerler

| Değer | Anlamı |
|-------|--------|
| `"mock"` | Varsayılan. Fixture (kurgu) verisi döner. Gerçek mevzuat veya karar **değildir**. |
| `"live"` | Canlı resmî kaynaklardan sorgular (mevzuat.gov.tr, Yargıtay, Danıştay). |
| `"snapshot"` | Önceden kaydedilmiş canlı kaynak snapshot'ını kullanır. |

Geçersiz bir değer ayarlanırsa (`DOKTOR_MCP_DEFAULT_SOURCE_MODE=production` gibi),
stderr'ye uyarı yazılır ve `"mock"`'a geri dönülür.

> **Not:** `DOKTOR_MCP_DEFAULT_SOURCE_MODE`, `DOKTOR_MCP_SOURCE_MODE`'un daha keşfedilebilir
> bir karşılığıdır. İkisi de `sourceMode`'u ayarlar; ikisi birden ayarlandığında
> `DOKTOR_MCP_DEFAULT_SOURCE_MODE` son işleme alınır.

## Geliştirme

```powershell
npm install
npm test
npm run build
npm run smoke -- "Aydinlatilmis riza kaydi eksikse hangi resmi kaynaklar eslesir?"
npm run smoke:legislation -- "kisisel saglik verisi mahremiyet"
npm run smoke:legislation -- "aydınlatılmış rıza"

# Hem Yargıtay hem Danıştay smoke (varsayılan)
npm run smoke:precedents -- "aydınlatılmış rıza"

# Belirli kaynaklar
npm run smoke:precedents -- "hizmet kusuru" --precedentSources yargitay,danistay

# Önbellek kontrolü
npm run smoke:precedents -- "aydınlatılmış rıza" --no-cache
npm run smoke:precedents -- "aydınlatılmış rıza" --refresh

npm run smoke:mcp -- "kişisel sağlık verisi mahremiyet" -- --sourceMode live
npm run smoke:mcp -- "hasta haklari tibbi mudahale" -- --sourceMode live
npm run smoke:mcp -- "riza belgesi" -- --sourceMode mock
npm run dev:mcp
```

`smoke:precedents`, canlı Yargıtay ve Danıştay adaptörlerini paralel sorgular, sonuçları
önbelleğe alır ve her aday karar için `sourceTraces` ve `eligibilityStatus` içeren
kaynak-başına `results` ile JSON yazdırır. Bir kaynak erişilemezse, onun yapılandırılmış
`unavailable` sonucu diğer kaynağın çıktısının yanında yazdırılır. JSON ayrıştırılabilirliği
her zaman korunur.

`smoke:mcp`, tam `prepare_doctor_legal_information_pack` işleyicisini çağırır.
`sourceMode: "live"` ile hem canlı mevzuatı hem canlı Yargıtay + Danıştay adaptörlerini
kullanır. Opsiyonel `precedentSources` parametresi hangi adaptörlerin kullanılacağını seçer.
AYM yalnızca-mock'tur ve canlı modda devre dışıdır.

`npm run build` sonrası, derlenmiş stdio MCP sunucusunu şununla çalıştırın:

```powershell
npm run mcp
```

## Hekim Sorusu Benchmark Paketi

Tipik hekim-merkezli hukuki sorulara odaklanan, canlı-kaynak değerlendirme metrikleri içeren
kapsamlı bir kalite değerlendirme ve regresyon-test benchmark paketi.

### Amaç
- **Kalite Ölçümü**: 15 ayrı tıbbi-hukuki kategoride 15-20 hedef sorunun performansını, mevzuat eşlemesini, emsal sayısını ve şema uyumunu sistematik olarak değerlendirir.
- **Regresyon Önleme**: Şu gibi katı güvenlik kısıtlarını zorlar: `Kisisel Verilerin Korunmasi Kanunu (KVKK)`'nın mahremiyet-dışı paketlerde bulunmaması, ret durumlarında hekim-merkezli deontoloji kurallarının genel hasta-haklarına önceliği, ve canlı modda mock-emsal geri-dönüşü olmaması.

### Nasıl Çalıştırılır

Testleri çalıştırmak ve rapor çıktılarını görmek için benchmark runner script'ini kullanın:

```powershell
# Tam benchmark'ı mock modda çalıştır (varsayılan)
npm run benchmark:doctor-questions

# Canlı modda çalıştır (canlı mevzuat ve emsalleri sorgular, canlı-kaynak metriklerini raporlar)
npm run benchmark:doctor-questions -- --sourceMode live

# Eşdeğer canlı kısayol
npm run benchmark:doctor-questions:live

# Çalıştırmayı ilk N soruyla sınırla
npm run benchmark:doctor-questions -- --limit 5

# Özel bir rapor dizini belirt (varsayılan exports/doctor-benchmark)
npm run benchmark:doctor-questions -- --out exports/my-custom-report
```

> [!WARNING]
> Benchmark'ı `--sourceMode live` ile çalıştırmak, Cumhurbaşkanlığı Mevzuat (`mevzuat.gov.tr`) ve yüksek mahkeme servislerine (`bedesten.adalet.gov.tr` ve `karararama.danistay.gov.tr`) gerçek HTTP istekleri yapar. Bu sunucuların hız limiti (HTTP 429) veya IP kısıtlamasından kaçınmak için stabil bir internet bağlantınız olduğundan ve istek hacmini makul tuttuğunuzdan emin olun.

### Mock vs Canlı Benchmark

Mock mod deterministik bir regresyon koruyucusudur. Beklenen mevzuat, öncelik, audit veya
güvenlik invariyantları regresyona uğradığında komutu başarısız kılabilir.

Canlı mod bir değerlendirme çalıştırmasıdır. Aynı güvenlik invariyantlarını korur, ancak
kaynak kesintileri, boş sonuçlar, hız limitleri ve `sourceUnavailable` girdileri otomatik
başarısızlık yerine metrik ve uyarı olarak raporlanır. Güvensiz emsal kullanımı, yasak MVP
alanları, canlı modda mock geri-dönüşü veya audit hataları sert regresyon başarısızlığı
olarak kalır.

### Benchmark Raporları ve Dışa Aktarımlar
Çalıştırmalar `exports/doctor-benchmark/`'ta (gitignore'da) ayrıştırılabilir JSON ve Markdown
raporları üretir:

- Mock mod:
  - `doctor-benchmark-report.json`
  - `doctor-benchmark-report.md`
- Canlı mod:
  - `live-benchmark-report.json`
  - `live-benchmark-report.md`

Raporlar şunları içerir: `startedAt`, `completedAt`, `durationMs`, `passedRegressionCount`,
`failedRegressionCount`, `liveSourceUnavailableCount`, audit sayıları, mevzuat/emsal kapsama
sayıları ve soru-başına puanlama.

Raporlar, seçilen her doğrulanmış emsal için canlı benchmark kalite audit alanlarını içerir:
mahkeme, daire, karar tarihi, esas/karar numaraları, erişim kaynağı, doküman id/kaynak id,
varsa kaynak URL'i, tam-metin erişilebilirliği, gerekçe tespiti, uygunluk durumu/gerekçeleri,
sağlık-hukuku ilgililik skoru, eşleşen terimler ve karar kaynak izi varlığı. Rapor tam karar
metnini yazdırmaz.

Canlı modda mock geri-dönüşü sert bir regresyondur. AYM devre dışı/yalnızca-mock kalır ve
sessizce canlı doğrulanmış emsal sağlayamaz. `sourceUnavailable`, boş canlı arama sonuçları
ve geçici üst-kaynak hataları; bir güvensiz emsal veya şema/audit ihlaline yol açmadıkça
kalite metriği ve uyarı olarak kalır.

### Puanlama

Her soru şunları alır:

- `legislationMatchScore` 0 ile 2 arası
- `priorityScore` 0 ile 2 arası
- `precedentSafetyScore` 0 ile 2 arası
- `sourceAvailabilityScore` 0 ile 2 arası
- `auditScore` 0 ile 2 arası
- `forbiddenFieldsScore` 0 veya 2
- `totalScore`, `maxScore`, `scorePercent` ve `qualityBand`

`qualityBand`: `good`, `acceptable`, `needs_tuning` veya `unsafe`. Canlı kaynak
erişilemezliği kaliteyi düşürebilir, ama bir maddeyi `unsafe` yapan yalnızca güvenlik
ihlalleri veya audit hatalarıdır.

Doğrulanmış emsal puanlaması bilinçli olarak katıdır. Seçilen bir doğrulanmış emsal
`precedent_usable` olmalı, doğrulanmış tam metne, tespit edilmiş hukuki gerekçeye sahip
olmalı ve bir karar kaynak izini korumalıdır. Yalnızca-meta veri, yalnızca-usuli,
gerekçesiz, tam-metni-yok veya mock-erişim kayıtları canlı modda doğrulanmış emsal kredisi
alamaz. Zayıf sağlık-hukuku ilgililiği, emsal güvenlik kredisini sınırlar ve yüksek bir
toplam skorun arkasına gizlenmek yerine bir tuning uyarısı olarak raporlanır.

Benchmark, bu audit katmanının üzerine emsal ilgililik tuning'i içerir. Soru ve kaynağa göre
zayıf ilgililiği, örnek karar id'lerini, eşleşen konu terimlerini, eksik beklenen konu
terimlerini, bir `whyWeak` açıklamasını ve önerilen takip sorgu terimlerini raporlar. Ayrıca
`goodCleanCount`'ı `goodWithWarningsCount`'tan ayırır ve ortalama/medyan sağlık-hukuku
ilgililik skorlarını raporlar.

Zayıf ilgililik, kararın sert emsal güvenlik kapılarını geçtiği ama karar metninin yalnızca
geniş sağlık kelimeleriyle eşleştiği veya sorunun konu profiliyle güçlü örtüşmediği anlamına
gelir. Konu profilleri şunları içerir: aydınlatılmış onam, malpraktis/komplikasyon, acil
bakım, tedavi reddi, mahremiyet/kayıtlar, psikiyatrik mahremiyet, şiddet/tehdit, sevk, özel
hastane ücret uyuşmazlıkları, kamu disiplini, yoğun bakım ve gebelik acili. Canlı kaynak
erişilemezliği bir metrik/uyarı olarak kalır; `unsafe` ise mock geri-dönüşü, eksik tam
metin/gerekçe/iz veya kullanılamaz emsal durumlarının doğrulanmış çıktıya sızması gibi
güvenlik ihlalleri için ayrılmıştır.

### Performans Benchmark Komutu

```sh
npm run benchmark:doctor-questions:performance
# veya limitle:
npm run benchmark:doctor-questions:performance -- --limit 5
```

Benchmark, 15 hekim sorusunun tamamını iki kez çalıştırır. Soğuk (cold) çalıştırma canlı ağa
gider ve yerel dosya önbelleğini (`.cache/precedents-perf/`) doldurur. Sıcak (warm)
çalıştırma aynı sorguları hemen önbellekten yeniden oynatır. Rapor şunları gösterir:

- Soğuk vs sıcak toplam süre ve iyileşme %
- Kaynak-başına soğuk/sıcak ortalama ms, p95, önbellek isabetleri, ağ istekleri
- Önbellek etkinliği: isabet oranı %, önbellekten-sunulan sayısı, ortalama önbellek yaşı
- Yeniden deneme/backoff özeti: toplam yeniden deneme, backoff süresi, hız-limiti olayları, timeout sayısı
- En yavaş 10 sorgu denemesi (soğuk + sıcak birleşik)
- Performans uyarıları (bloke etmez; sert başarısızlıklar test/build/audit olarak kalır)

### p50/p95/p99 Yorumlama

| Değer | Anlamı |
|---|---|
| p50 | Medyan sorgu süresi — sorguların yarısı bu sürede veya daha kısa sürede tamamlanır |
| p95 | 95. yüzdelik — kuyruk gecikmesi; çoğu sorgu bundan hızlıdır |
| p99 | 99. yüzdelik — aykırı gecikme; ara sıra yavaş sorgular |

Soğuk p95 > 60s yavaş bir kaynağa işaret eder (genellikle Yargıtay/Bedesten PDF getirme).
Sıcak p95 > 10s, en yavaş sorgular için önbelleğin etkili olmadığını gösterir (olası TTL
süre dolması veya adaptör içindeki tam-metin getirmeler için önbellek ıskası).

### Önbellek Entegrasyonu

Önbellek normal canlı benchmark ve smoke CLI çalıştırmalarında varsayılan olarak devre
dışıdır. Performans benchmark'ı için paylaşılan bir `PrecedentCache` (TTL 2s, dizin
`.cache/precedents-perf/`) enjekte edilir. Önbellek, (source, query, pageSize) anahtarı
başına tüm `searchAndNormalize` sonucunu saklar. Sıcak çalıştırma yeniden oynatması
eksiksizdir — önbelleğe alınmış sorgular için hiç ağ çağrısı yapılmaz.

`.cache/` gitignore'dadır. Önbellek girdileri commit edilmez.

---

Sürüm geçmişi için bkz. [CHANGELOG.md](./CHANGELOG.md).
