# doktor-mcp — MCP Araç Ergonomisi ve Güvenlik Roadmap'i (Faz E0–E7)

> **Bu doküman bağımsız bir LLM geliştirici (ör. DeepSeek) tarafından, sohbet bağlamı
> olmadan tüketilmek üzere yazılmıştır.** Her görev kendi başına yeterli detay içerir:
> sorunun tam yeri, neden sorun olduğu, nasıl düzeltileceği ve kabul kriterleri.
> Görevler bağımlılık sırasına göre dizilmiştir; **sırayla ilerle**.
>
> **Genel kurallar (her görevde geçerli):**
> - `npm run build` (tsc) **0 hata** vermeli.
> - `npm test` (vitest) **tamamen yeşil** kalmalı (şu an ~1384 test). Mevcut testleri kırma.
> - `npm run lint` temiz kalmalı.
> - Yeni davranış eklediysen **yeni test yaz**. Test yoksa görev "done" sayılmaz.
> - Araç JSON şekli (response contract) değişiyorsa `README.md` ve `docs/COMPATIBILITY.md` güncellenmeli.
> - Hekime-dönük metinler Türkçe (tam diakritik), kod/yorum İngilizce — mevcut konvansiyonu koru.
> - **Asla uydurma mahkeme kararı / mevzuat metni üretme.** Kaynak-temelli ilke projenin
>   temel invariantıdır; hiçbir görev bunu gevşetemez.
> - Her görev sonunda `git add -A && git commit -m "E<faz>.<görev>: <özet>"`.
>
> **Arka plan — bu roadmap'in teşhisi:** Projenin boru hattı (kaynak adaptörleri, emsal
> kapıları, RRF/rerank, audit) iyi durumda; zayıf taraf **MCP araç yüzeyinin LLM istemci
> perspektifinden ergonomisi**. Bir MCP aracını çağıran şey bir LLM'dir: araç açıklamaları
> onun karar mekanizmasıdır, araç girdi/çıktıları onun bağlam penceresinden geçer. Mevcut
> tasarım bu gerçeğe göre optimize edilmemiş. Ayrıca bir adet gerçek mantık bug'ı ve bir
> güvenlik açısından riskli varsayılan mevcut.

---

## Faz E0 — Kritik Bug Düzeltmeleri (önce bunlar)

### [ ] E0.1 — `drill_down_pack_item` içindeki `includes("")` bug'ını düzelt

- **Dosya**: `src/mcp/tools.ts`, `drill_down_pack_item` handler'ı (~satır 103–135).
- **Sorun**: Emsal eşleme filtresi şu deseni kullanıyor:
  ```ts
  const precedentMatches = precedents.filter((p) =>
    q.includes(p.sourceDocumentId?.toLowerCase() ?? "") ||
    q.includes(p.sourceId?.toLowerCase() ?? "") ||
    q.includes(p.chamber?.toLowerCase() ?? "") ||
    digits.some((d) => (p.meritsNumber ?? "").includes(d) || (p.decisionNumber ?? "").includes(d))
  );
  ```
  JavaScript'te `"herhangi bir string".includes("")` **her zaman `true`** döner. Yani
  `chamber`, `sourceDocumentId` veya `sourceId` alanlarından herhangi biri `undefined`
  olan **her emsal, her takip sorusuyla eşleşir**. Araç filtre değil, geçirgen elek.
  Aynı risk `legislationMatches` tarafında yok (orada `l.legislationName` zorunlu alan)
  ama yine de savunmacı yaz.
- **Yapılacak**:
  1. Yardımcı bir fonksiyon ekle (aynı dosyada veya `src/util/` altında):
     ```ts
     function includesNonEmpty(haystack: string, needle: string | undefined | null): boolean {
       if (!needle) return false;
       const trimmed = needle.trim().toLowerCase();
       if (trimmed.length === 0) return false;
       return haystack.includes(trimmed);
     }
     ```
  2. `drill_down_pack_item` içindeki tüm `q.includes(x ?? "")` çağrılarını
     `includesNonEmpty(q, x)` ile değiştir.
  3. Madde numarası eşlemesinde de aynı kontrolü uygula: `digits.some((d) => ...)`
     içinde `p.meritsNumber`/`p.decisionNumber` boş string'e düşüyorsa `includes(d)`
     `false` döner (bu taraf güvenli), ama `d` boş olamaz çünkü `\d+` ile yakalanıyor —
     yine de bir yorumla belgele.
- **Test** (`tests/` altına `drillDownPackItem.test.ts` veya mevcut tools testine ekle):
  - `chamber: undefined`, `sourceDocumentId: undefined`, `sourceId: undefined` olan bir
    emsal içeren bir pack ile, hiçbir alanla eşleşmeyen bir takip sorusu gönder →
    `matchedPrecedents` **boş dizi** olmalı. (Bu test mevcut kodda FAIL eder — önce
    testi yaz, kırmızı gör, sonra düzelt.)
  - Pozitif durum: `chamber: "13. Hukuk Dairesi"` olan emsal + `"13. hukuk dairesi
    kararını açar mısın"` sorusu → eşleşmeli.
  - Madde numarası: `articleNumber: "24"` olan mevzuat + `"madde 24 ne diyor"` → eşleşmeli;
    `"madde 26"` → eşleşmemeli.
- **Kabul**: Yeni testler yeşil; mevcut testler kırılmıyor; `q.includes(... ?? "")`
  deseni dosyada hiç kalmıyor (grep ile doğrula).

### [x] E0.2 — `z.custom<CourtDecision>()` doğrulama deliğini kapat

- **Dosya**: `src/mcp/tools.ts` (~satır 23–26):
  ```ts
  const decisionsSchema = z.object({
    decisions: z.array(z.custom<CourtDecision>()),
    query: z.string().optional()
  });
  ```
  ve `drillDownSchema` içindeki `z.custom<DoctorLegalInformationPack>()`.
- **Sorun**: `z.custom<T>()` **validatör fonksiyonu verilmediğinde hiçbir doğrulama
  yapmaz** — sadece TypeScript tipini iddia eder. LLM istemcisi bozuk/eksik JSON
  gönderirse (ki uzun JSON'larda sık olur), hata Zod'da değil boru hattının derininde
  patlar ve hata mesajı anlamsız olur. Projenin diğer tüm girdileri sıkı Zod şemasıyla
  doğrulanırken burada delik var.
- **Yapılacak**:
  1. `src/contracts/legal.ts` içindeki `CourtDecision` arayüzüne bakarak gerçek bir Zod
     şeması yaz: `courtDecisionSchema`. Tüm alanları birebir kopyalamak zorunda değilsin —
     **boru hattının gerçekten kullandığı alanları zorunlu kıl**, gerisini
     `.passthrough()` ile geçir. Filtre mantığının kullandığı kritik alanlar
     (`src/health/decisionEligibility.ts` ve `src/health/precedentFilter.ts`'e bak):
     `fullTextAvailable` (boolean), `legalReasoning` (string, opsiyonel),
     `relevanceNote` (string, opsiyonel), `court`, `decisionDate`, `meritsNumber`,
     `decisionNumber`, `sourceDocumentId`/`sourceId`.
  2. Şemayı `src/mcp/schemas.ts` gibi yeni bir dosyaya koy (tools.ts şişmesin) ve
     hem `decisionsSchema` hem ileride başka araçlar kullanabilsin diye export et.
  3. `drillDownSchema` için pack'in tamamını şemalamak pratik değil (çok büyük);
     E1'de pack girdisi zaten kaldırılacak. Şimdilik en azından
     `relevantLegislation: z.array(z.object({...}).passthrough())` ve
     `verifiedHighCourtPrecedents: z.array(...)` dizilerinin **varlığını ve dizi
     olduğunu** doğrulayan minimal bir şema yaz.
  4. Doğrulama hatasında LLM istemcisine **anlaşılır, yapılandırılmış hata** dön:
     Zod hatasını yakala ve `{ ok: false, errorCode: "invalid_input", issues: [...] }`
     şeklinde JSON döndür (exception fırlatma — MCP istemcileri exception'ı kötü işler).
- **Test**: `filter_reasoned_precedents`'e `decisions: [{ "foo": "bar" }]` gönder →
  yapılandırılmış `invalid_input` hatası dönmeli, exception fırlamamalı. Geçerli bir
  karar dizisi → eski davranış aynen korunmalı.
- **Kabul**: `z.custom` çağrısı validatörsüz hiçbir yerde kalmıyor; testler yeşil.

---

## Faz E1 — Pack Cache: Büyük JSON Round-Trip Anti-Pattern'ini Kaldır

> **Neden:** Şu an `drill_down_pack_item` tüm pack'i, `filter_reasoned_precedents`
> tüm karar dizisini **araç girdisi olarak geri istiyor**. MCP'de araç girdisini LLM
> üretir; yani LLM daha önce aldığı (binlerce token'lık) JSON'u kendi bağlamından
> kopyalayıp geri yazmak zorunda. Bu (a) token israfı, (b) LLM'in JSON'u bozma riski,
> (c) bağlam penceresi taşması demek. Doğru desen: sunucu tarafında kısa ömürlü bir
> cache + kısa bir referans id.

### [ ] E1.1 — `PackSessionCache` modülü

- **Yeni dosya**: `src/app/packSessionCache.ts`.
- **Yapılacak**:
  1. Basit bir in-memory LRU cache sınıfı: `PackSessionCache`.
     - `store(pack: DoctorLegalInformationPack): string` → `packId` üretir
       (`pack-` + `crypto.randomUUID()` kısaltması, ör. `pack-3f9a2c`), saklar, id döner.
     - `get(packId: string): DoctorLegalInformationPack | null`.
     - Kapasite: en fazla **20 pack** (LRU tahliye), TTL: **30 dakika**
       (her `get` TTL'i yenilemesin — oluşturma zamanından sabit).
     - Disk yazma YOK — bu süreç-içi bir oturum cache'idir (MCP sunucusu stdio ile
       tek istemciye bağlı uzun ömürlü bir süreçtir, bu yeterli).
  2. `DoktorMcpInformationService`'e (`src/app/service.ts`) opsiyonel olarak enjekte
     edilebilir yap (test edilebilirlik için), varsayılanı sınıf içinde oluştur.
- **Test**: store→get round-trip; 21. pack eklenince en eski tahliye; TTL geçince
  `get` null (fake timer ile).

### [ ] E1.2 — `prepare_doctor_legal_information_pack` yanıtına `packId` ekle

- **Dosya**: `src/mcp/tools.ts` + `src/mcp/formatDoctorPackResponse.ts`.
- **Yapılacak**:
  1. Handler pack'i hazırladıktan sonra `packSessionCache.store(pack)` çağır,
     dönen `packId`'yi yanıtın **en üst seviyesine** ekle:
     `{ packId: "pack-3f9a2c", responseVersion: ..., ... }`.
  2. `DoctorPackResponse` tipine `packId: string` alanını ekle.
  3. README'ye ve `docs/COMPATIBILITY.md`'ye yeni alanı belgele (additive değişiklik —
     geriye uyumlu).
- **Kabul**: Pack yanıtında `packId` var; aynı id ile cache'ten aynı pack okunabiliyor.

### [ ] E1.3 — `drill_down_pack_item`'ı `packId` tabanlı hale getir

- **Dosya**: `src/mcp/tools.ts`.
- **Yapılacak**:
  1. Yeni girdi şeması:
     ```ts
     const drillDownSchema = z.object({
       packId: z.string().min(1),
       followUpQuestion: z.string().min(1)
     });
     ```
  2. Handler `packSessionCache.get(packId)` ile pack'i çeksin. Bulunamazsa
     yapılandırılmış hata dön:
     ```json
     {
       "ok": false,
       "errorCode": "pack_not_found",
       "message": "packId bulunamadı veya süresi doldu. Önce prepare_doctor_legal_information_pack çağırın.",
       "recommendedNextStep": "Re-run prepare_doctor_legal_information_pack and use the new packId."
     }
     ```
  3. **Geriye uyumluluk**: eski `pack` girdisini bir sürüm boyunca kabul etmeye devam
     et (`packId` VEYA `pack` — `z.union` ile), ama yanıtın içine
     `deprecationWarning: "Inline 'pack' girişi v1.0'da kaldırılacak; packId kullanın."`
     ekle. README'de deprecate olarak işaretle.
  4. Araç açıklamasını güncelle (E3'teki açıklama standardına uygun).
- **Test**: packId ile drill-down çalışıyor; geçersiz packId → `pack_not_found`;
  eski inline pack hâlâ çalışıyor ama uyarı taşıyor.

### [ ] E1.4 — `filter_reasoned_precedents` için aynı desen (opsiyonel referans)

- **Sorun**: Bu araç da karar dizisini inline istiyor. Ancak meşru bir kullanım var:
  istemci kendi bulduğu kararları filtreletmek isteyebilir. O yüzden inline girdiyi
  **kaldırma**, ama alternatif ekle.
- **Yapılacak**: Girdi şemasına opsiyonel `packId` ekle: `packId` verilirse pack'in
  `verifiedHighCourtPrecedents` + (varsa) diagnostics'teki dışlanmış kararlar üzerinden
  çalışsın; `decisions` verilirse mevcut davranış. İkisi birden verilirse
  `invalid_input` hatası.
- **Test**: her iki yol + ikisi birden hata durumu.

---

## Faz E2 — Mock Varsayılanı Güvenliği

> **Neden:** `sourceMode` varsayılanı `"mock"`. Gerçek bir hekim istemcisinde LLM
> `sourceMode` belirtmeden pack isterse **fixture (kurgu) verisi** döner ve çıktı
> gerçek mevzuat alıntısı gibi görünür. Proje "asla uydurma içerik sunmayız" ilkesi
> üzerine kurulu; varsayılanın sessizce kurgu veri dönmesi bu ilkeyle çelişir.
> Varsayılanı doğrudan `"live"` yapmak da riskli (testler, CI, ağsız ortamlar).
> Çözüm iki katmanlı: yapılandırılabilir varsayılan + kaçırılamaz mock işareti.

### [x] E2.1 — Mock çıktıyı kaçırılamaz şekilde işaretle

- **Dosyalar**: `src/mcp/formatDoctorPackResponse.ts`, `src/mcp/tools.ts`,
  ilgili contract tipleri.
- **Yapılacak**:
  1. `sourceMode === "mock"` ile üretilen **her** araç yanıtının en üst seviyesine
     şu blok eklensin:
     ```json
     {
       "dataOrigin": "mock",
       "mockDataWarning": "BU YANIT KURGU (FIXTURE) VERİSİDİR. Gerçek mevzuat veya mahkeme kararı DEĞİLDİR. Gerçek kaynaklar için sourceMode: 'live' kullanın."
     }
     ```
     Live modda `dataOrigin: "live"` (warning alanı olmadan), snapshot modda
     `dataOrigin: "snapshot"`.
  2. Bu sadece pack aracında değil; `search_health_legislation`,
     `get_legislation_provisions`, `search_health_precedents` yanıtlarında da olmalı.
     Dizi dönen handler'lar varsa yanıtı `{ dataOrigin, results: [...] }` sarmalına
     taşı (breaking change — README + COMPATIBILITY.md'ye yaz, sürümü minor artır).
  3. `shortAnswer` gibi hekime-dönük metin alanlarına mock modda görünür önek ekleme —
     metni kirletme; üst-seviye alan yeterli, ama `summary` içinde
     `dataOrigin` tekrarlanabilir.
- **Test**: mock pack yanıtında `mockDataWarning` var; live yanıtta yok;
  her aracın mock yanıtı `dataOrigin: "mock"` taşıyor.

### [ ] E2.2 — Varsayılan modu ortam değişkenine bağla

- **Dosya**: `src/core/runtimeConfig.ts` (mevcut config modülü) + `src/mcp/tools.ts`.
- **Yapılacak**:
  1. `DOKTOR_MCP_DEFAULT_SOURCE_MODE` ortam değişkeni: `"mock" | "live" | "snapshot"`.
     Tanımsızsa **`"mock"` kalır** (mevcut davranış — testler/CI kırılmasın).
  2. `sourceModeSchema`'daki `.default("mock")` sabitini kaldır; default'u handler
     katmanında runtime config'ten çöz.
  3. README'ye "Üretim Kurulumu" bölümü ekle: gerçek kullanımda MCP istemci
     konfigürasyonunda (`claude_desktop_config.json` benzeri) `env` içinde
     `DOKTOR_MCP_DEFAULT_SOURCE_MODE=live` ayarlanması önerilir, örnek config bloğuyla.
  4. Geçersiz env değeri → süreç başlangıcında stderr'e uyarı + `"mock"`'a düş
     (crash etme; stdio MCP sürecinde stdout'a ASLA log yazma — JSON protokolünü bozar).
- **Test**: env set edilince default live oluyor (service'i env ile başlatan test);
  env yokken mock; geçersiz env mock'a düşüyor.

---

## Faz E3 — Araç Açıklamaları ve Yanıt Hacmi (LLM Ergonomisi)

> **Neden:** MCP'de araç açıklaması, istemci LLM'in hangi aracı ne zaman çağıracağına
> karar verdiği TEK bilgi kaynağıdır. Mevcut açıklamalar tek cümlelik ve hangi aracın
> ana giriş noktası olduğunu söylemiyor. Ayrıca yanıtlar pretty-print + tam denetim
> meta verisiyle dönüyor; istemci LLM'in bağlamını şişiriyor.

### [ ] E3.1 — Araç açıklamalarını LLM-yönlendirici hale getir

- **Dosya**: `src/mcp/tools.ts`, `registerMedicalLegalTools` içindeki tüm
  `description` alanları.
- **Yapılacak**: Her açıklamayı şu şablona göre yeniden yaz (İngilizce kalabilir —
  istemci LLM'ler İngilizce açıklamayı iyi işler; ama Türkçe soru örnekleri içersin):
  - Ne yapar (1 cümle).
  - **Ne zaman kullanılmalı / ne zaman kullanılmamalı** (diğer araçlara referansla).
  - Kritik parametre rehberi (özellikle `sourceMode`).
  - Kısa girdi örneği.
- **Önerilen açıklamalar** (uyarlayabilirsin ama bilgi içeriğini koru):
  - `prepare_doctor_legal_information_pack`: *"PRIMARY ENTRY POINT — use this tool
    first for any physician legal question. Prepares a complete source-grounded
    legal information pack: classification, verbatim legislation provisions, verified
    high-court precedents, missing information, and lawyer review points. Returns a
    packId for follow-up drill-down. Set sourceMode:'live' to query official sources
    (mevzuat.gov.tr, Yargıtay, Danıştay); default mode returns clearly-marked mock
    fixture data for testing only. Example: { \"question\": \"Hasta tedaviyi
    reddederse hekimin sorumluluğu nedir?\", \"sourceMode\": \"live\" }"*
  - `drill_down_pack_item`: *"Follow-up tool — call ONLY after
    prepare_doctor_legal_information_pack. Pass the packId from that response plus a
    follow-up question mentioning a specific article number, law name, chamber, or
    decision number to retrieve just that item without rebuilding the pack."*
  - `classify_medical_legal_question`, `search_health_legislation`,
    `get_legislation_provisions`, `search_health_precedents`,
    `filter_reasoned_precedents`: her birine *"Advanced/granular tool: prefer
    prepare_doctor_legal_information_pack for end-to-end questions; use this only
    when you specifically need <X> in isolation."* notu ekle.
- **Test**: Açıklama metinleri için snapshot test şart değil; ama her aracın
  description'ının boş olmadığını ve `prepare_doctor_legal_information_pack`
  açıklamasının "PRIMARY" içerdiğini doğrulayan basit bir test ekle (regresyon kilidi).

### [ ] E3.2 — Tanılama meta verisini opsiyonel yap (`includeDiagnostics`)

- **Dosyalar**: `src/mcp/tools.ts`, `src/mcp/formatDoctorPackResponse.ts`.
- **Sorun**: Pack yanıtı `sourceTrace`, `selectionDiagnostics`, `precedentDiagnostics`,
  `decisionSourceTrace` gibi denetim alanlarının tamamını taşıyor. Bunlar audit için
  değerli ama istemci LLM'in bağlamında çoğu zaman ölü ağırlık.
- **Yapılacak**:
  1. `packInputSchema`'ya `includeDiagnostics: z.boolean().optional()` ekle.
     **Varsayılan: `false`** (yeni davranış — token tasarrufu).
  2. `false` iken yanıttan şu alanları çıkar: pack-düzeyi `sourceTrace`,
     hüküm-içi `sourceTrace`'ler, `selectionDiagnostics`, `precedentDiagnostics`
     içindeki `excludedDecisions[]` detayı (sayılar kalsın:
     `excludedDecisionCount`, `sourceSummaries` özet satırları kalsın — bunlar küçük
     ve güvenlik açısından bilgilendirici).
  3. **Güvenlik invariantı korunur**: diagnostics'in çıkarılması SEÇİMİ değiştirmez;
     sadece raporlamayı kırpar. `verifiedHighCourtPrecedents`'e girme kuralları aynen.
  4. Yanıta `diagnosticsIncluded: boolean` alanı ekle; `false` iken
     `diagnosticsHint: "Tam denetim izi için includeDiagnostics: true ile yeniden çağırın."`.
  5. `audit:pack` CLI'ı ve benchmark'lar **her zaman** `includeDiagnostics: true` ile
     çağırmalı — onların sözleşmesi bozulmasın (benchmark runner'larda çağrı noktalarını
    güncelle: `src/benchmark/benchmarkRunner.ts`, `realWorld*` runner'lar).
- **Test**: default çağrıda `sourceTrace` yok ama emsal seçimi birebir aynı
  (aynı fixture ile iki çağrıyı karşılaştır); `includeDiagnostics: true` eski tam şekli
  döndürüyor; benchmark testleri yeşil.

### [ ] E3.3 — Kompakt JSON çıktısı

- **Dosya**: `src/mcp/tools.ts`, `jsonResult` fonksiyonu.
- **Sorun**: `JSON.stringify(value, null, 2)` — pretty-print, token maliyetini ~%20–30
  artırır ve LLM istemciye hiçbir değer katmaz (`structuredContent` zaten ayrıca
  gönderiliyor).
- **Yapılacak**: `JSON.stringify(value)` (girintisiz) kullan. Smoke CLI'ların insan
  tarafından okunan çıktıları etkilenmemeli — onlar kendi stringify'ını yapıyorsa dokunma,
  `jsonResult` sadece MCP yanıt yolu.
- **Kabul**: Araç yanıtlarında girinti yok; tüm testler yeşil (pretty-print'e bağımlı
  test varsa testi güncelle, davranışı değil).

---

## Faz E4 — Soru Sınıflandırıcıyı Sağlamlaştır

> **Neden:** `src/health/questionClassifier.ts` ham `String.includes()` alt-dize
> eşlemesi kullanıyor. Somut yanlış pozitif: `"veri"` terimi `"verilen"`, `"verildi"`,
> `"görev verildi"` gibi çok yaygın kelimelerin İÇİNDE geçer ve alakasız soruları
> `privacy_kvkk` boyutuna iter. Tüm aşağı akış (mevzuat eşleme, emsal sorgu genişletme,
> kaynak önceliklendirme) bu sınıflandırmaya dayanıyor — boru hattının en zayıf halkası
> en baştaki halka. Tam NLP gerekmiyor; **kelime-sınırı duyarlı eşleme + Türkçe ek
> toleransı** yeterli büyük iyileşme sağlar.

### [ ] E4.1 — Token tabanlı eşleme altyapısı

- **Yeni dosya**: `src/health/turkishTokenMatcher.ts`.
- **Yapılacak**:
  1. `tokenizeTr(text: string): string[]` — `toLocaleLowerCase("tr-TR")` sonrası
     harf-dışı karakterlerden böl (`/[^a-zçğıöşü]+/i` ayırıcı; Unicode-aware regex
     kullan: `/[^\p{L}]+/u`).
  2. `matchesTermTr(tokens: string[], term: string): boolean` kuralları:
     - **Tek-kelime terim** (`"veri"`, `"onam"`): bir token, terimin kendisiyse VEYA
       terim + Türkçe ek paterniyle başlıyorsa eşleşir. Ek toleransı: token, terimle
       başlamalı ve kalan kısım ≤ 5 karakter olmalı VE kalan kısım sesli harfle ya da
       yaygın ek ünsüzleriyle (`n, s, y, d, t, l, m, k`) başlamalı. **Önemli istisna
       mekanizması**: terim başına opsiyonel `blockedTokens` listesi —
       `"veri"` için `["verilen", "verildi", "verilme", "verilir", "veril"]` köklerini
       blokla (ör. token `"veril"` ile başlıyorsa eşleşme YOK — `"verilen/verildi"`
       ailesinin tamamını tek kuralla keser; ama `"verisi"`, `"verileri"` eşleşmeye
       devam eder çünkü `"veri" + "si"`, `"veril"` ile başlamaz... DİKKAT: `"verileri"`
       `"veril"` ile başlar! Bu yüzden blok kuralını şöyle incelt: token `"veril"` ile
       başlıyor VE `"verileri"`/`"verilerin"` gibi `"veriler"` çoğul kökü DEĞİLSE blokla.
       Pratik çözüm: `allowedTokens: ["veriler", "verileri", "verilerin", "verisi", "verisini"]`
       önce kontrol edilir, sonra `blockedPrefixes: ["veril"]`).
     - **Çok-kelimeli terim** (`"mecburi hizmet"`): normalize edilmiş tam metinde
       alt-dize olarak ara (mevcut davranış — çok-kelimeli terimlerde yanlış pozitif
       riski düşük).
     - **Kök terimler** (`"aydinlat"`, `"redde"` gibi bilinçli kısaltılmış kökler):
       terim listesinde `prefix: true` işaretiyle tanımlansın; bunlar token'ın
       başlangıcıyla eşleşir (ek toleransı sınırsız).
  3. Mevcut `termDimensions` veri yapısını yeni biçime taşı:
     ```ts
     interface TermRule {
       term: string;
       matchMode: "token" | "prefix" | "substring"; // substring = çok-kelimeli
       allowedTokens?: string[];
       blockedPrefixes?: string[];
     }
     ```
     Her mevcut terimi gözden geçirip uygun moda ata: `"aydinlat"`, `"redde"`,
     `"uyumsu"`, `"mudahale"` → `prefix`; `"mecburi hizmet"`, `"döner sermaye"`,
     `"acil servis"` vb. → `substring`; geri kalan tam kelimeler → `token`.
  4. **ASCII/diakritik eşdeğerliği**: mevcut listede her terimin hem ASCII hem
     diakritikli hali elle tutuluyor (`"riza"`/`"rıza"`). Bir
     `foldTr(s: string): string` fonksiyonu ekle (ı→i, ş→s, ç→c, ğ→g, ö→o, ü→u) ve
     eşlemeyi fold edilmiş uzayda yap — terim listesindeki çiftleri tekilleştir.
- **Test** (`tests/turkishTokenMatcher.test.ts` — kapsamlı yaz, bu modül her şeyin temeli):
  - `"hastaya ilaç verildi"` → `"veri"` EŞLEŞMEZ (kritik regresyon testi).
  - `"kişisel sağlık verisi paylaşımı"` → `"veri"` eşleşir.
  - `"hasta verileri kimlerle paylaşılabilir"` → `"veri"` eşleşir.
  - `"aydınlatılmış onam alınmadı"` → `"aydinlat"` (prefix) eşleşir.
  - `"rıza"` / `"riza"` / `"RIZA"` hepsi aynı sonucu verir (fold testi).
  - `"mecburi hizmet ataması"` → substring eşleşir.

### [ ] E4.2 — Sınıflandırıcıyı yeni eşleyiciye bağla + regresyon koruması

- **Dosya**: `src/health/questionClassifier.ts`.
- **Yapılacak**:
  1. `classifyMedicalLegalQuestion` artık `turkishTokenMatcher` kullanır. Fonksiyon
     imzası ve dönüş şekli DEĞİŞMEZ (geriye uyumlu).
  2. **Önce mevcut davranışı fotoğrafla**: değişiklikten ÖNCE,
     `src/benchmark/doctorQuestions.ts` ve `realWorldPhysicianQuestions.ts`'teki tüm
     benchmark sorularını mevcut sınıflandırıcıdan geçirip
     `fixtures/classifier-baseline.json`'a (soru → dimensions/searchTerms) kaydet.
     Değişiklikten SONRA aynı soruları yeni sınıflandırıcıdan geçir ve farkları
     raporla. **Beklenen fark profili**: yanlış pozitiflerin kaybolması (ör. "verildi"
     içeren soruların `privacy_kvkk`'dan düşmesi) kabul; mevcut DOĞRU eşleşmelerin
     kaybolması RED — kaybolan doğru eşleşme varsa terim kuralını incelt.
  3. Benchmark'ı mock modda çalıştır (`npm run benchmark:doctor-questions`) —
     regresyon yok olmalı. Benchmark beklentileri sınıflandırma değişikliği yüzünden
     güncellenmek zorunda kalırsa, her güncellemeyi commit mesajında tek tek gerekçele.
  4. Fallback davranışı koru: hiçbir boyut eşleşmezse `professional_ethics` +
     `patient_rights` (mevcut davranış), ama dönüş nesnesine
     `classificationConfidence: "fallback" | "matched"` alanı ekle — istemci LLM
     fallback durumunu görebilsin. Contract tipini ve README'yi güncelle.
- **Kabul**: `npm test` + mock benchmark yeşil; baseline diff raporu commit
  mesajında özetlenmiş; `"verildi"` yanlış pozitifi için kalıcı test mevcut.

---

## Faz E5 — Yeni Araç: Karar Tam Metni Getirme

> **Neden:** Arama sonuçları karar özetleri/kırpılmış metin döndürüyor; istemci LLM
> belirli bir kararı derinlemesine incelemek isterse tek yolu tüm pack'i yeniden
> üretmek. Eksik temel taş: id ile tek karar getirme.

### [ ] E5.1 — `get_decision_full_text` aracı

- **Dosyalar**: `src/mcp/tools.ts`, `src/app/service.ts`, ilgili adaptörler.
- **Yapılacak**:
  1. Girdi şeması:
     ```ts
     const decisionFetchSchema = z.object({
       documentId: z.string().min(1),   // "yargitay:99001", "danistay:...", "bedesten:..."
       sourceMode: sourceModeSchema.optional()
     });
     ```
  2. `documentId` ön ekinden kaynağı çöz (`yargitay:` → LiveYargitayAdapter,
     `danistay:` → LiveDanistayAdapter, `bedesten:` → LiveBedestenAdapter). Adaptörlerde
     halihazırda tam-metin getirme yolu var (arama akışı içinde kullanılıyor —
     `fullTextRetrievalMethod` üretimine bak); bunu tek-doküman public metoduna çıkar:
     `fetchDecisionFullText(documentId): Promise<DecisionFullTextResult | UnavailableResult>`.
  3. Yanıt şekli:
     ```json
     {
       "documentId": "yargitay:99001",
       "court": "yargitay",
       "fullText": "...",
       "fullTextRetrievalMethod": "html-text",
       "retrievedAt": "...",
       "eligibility": { "status": "precedent_usable", "reasons": [...] },
       "dataOrigin": "live"
     }
     ```
     Tam metin alınamazsa mevcut yapılandırılmış `unavailable` sözleşmesi aynen kullanılır.
     **Karar metni asla üretilmez/parafraz edilmez** — kaynak ne verdiyse o.
  4. Mock modda mock adaptörlerin fixture kararlarından getir; `dataOrigin: "mock"` +
     `mockDataWarning` (E2.1 ile tutarlı).
  5. Bilinmeyen ön ek (`aym:` dahil — AYM canlı kaynak yok) → yapılandırılmış hata:
     `errorCode: "unsupported_source"`.
  6. Araç açıklaması E3.1 standardına uygun: *"Fetch the full verbatim text of a single
     court decision by its documentId (from search_health_precedents or a pack's
     verifiedHighCourtPrecedents). Use for deep-dive into one decision instead of
     re-running the whole pack."*
  7. README'ye araç listesine ekle.
- **Test**: mock modda bilinen fixture id → tam metin; bilinmeyen id →
  yapılandırılmış `document_not_found`; `aym:` ön eki → `unsupported_source`;
  canlı yol için adaptörü stub'layan birim testi (gerçek ağ çağrısı YOK — mevcut test
  konvansiyonuna bak, adaptörler testlerde nasıl mock'lanıyorsa öyle yap).

---

## Faz E6 — Kalibrasyon Resource'unu Dürüstleştir

> **Neden:** `src/mcp/server.ts` içindeki `doktor://calibration-status` resource'u
> SABİT KODLANMIŞ durumları (`yargitay: "reachable_json"` vb.)
> `lastChecked: new Date().toISOString()` ile dönüyor — "az önce kontrol edildi"
> izlenimi veriyor ama hiçbir şey kontrol edilmiyor. Yanıltıcı tazelik.

### [ ] E6.1 — Gerçek (cache'li) sağlık kontrolü

- **Dosyalar**: `src/mcp/server.ts`, mevcut `src/sourceHealthCli.ts` /
  `src/health/linkHealthChecker.ts` altyapısı.
- **Yapılacak**:
  1. `sourceHealthCli`'ın kullandığı kontrol mantığını yeniden kullanılabilir bir
     fonksiyona çıkar (zaten modülerse direkt import et):
     `checkSourceHealth(): Promise<SourceHealthReport>` — her canlı uç noktaya hafif
     bir istek (HEAD veya minimal arama) atar, durum döner.
  2. Resource handler'ı şöyle çalışsın:
     - Süreç içi 10 dakikalık cache: son kontrol 10 dk'dan yeniyse cache'ten dön.
     - Cache yoksa/bayatsa kontrolü çalıştır; **her kaynak için 5 sn timeout**, toplam
       en fazla ~8 sn (Promise.allSettled ile paralel).
     - Kontrol başarısız olursa o kaynak için `status: "unknown"`, hata kodu ve
       `lastSuccessfulCheck` (varsa) dön — ASLA sahte `reachable` deme.
  3. Yanıta dürüst alanlar: `lastChecked` (gerçek kontrol zamanı), `checkMethod:
     "live-probe" | "cached-probe"`, `cacheAgeMs`. AYM bloğu (synthetic_only
     açıklaması) statik kalabilir — o bir mimari gerçek, sağlık durumu değil; ama
     `checkMethod: "static-architecture-note"` ile işaretle.
  4. Ağ erişimi olmayan ortamda (CI) resource çağrısı çökmemeli — tüm kontroller
     fail olursa yapılandırılmış `unknown` raporu döner.
- **Test**: health-check fonksiyonunu stub'layarak: başarılı kontrol → gerçek durumlar +
  `live-probe`; ikinci çağrı 10 dk içinde → `cached-probe` + aynı `lastChecked`;
  kontrol hatası → `unknown`, exception yok.

---

## Faz E7 — Kapanış

### [ ] E7.1 — Dokümantasyon ve sürüm senkronizasyonu

- **Yapılacak**:
  1. README'nin en üstündeki "v0.45.0 sürüm adayı" notunu güncel sürümle senkronla —
     ya `package.json`'dan otomatik üretilen bir satır yap (docs script'i) ya da
     sabit metni "güncel sürüm için package.json/CHANGELOG'a bakın" şekline çevir.
  2. README "MCP Araçları" bölümünü güncelle: `drill_down_pack_item` (packId'li yeni
     biçim), `get_decision_full_text`, `includeDiagnostics`, `dataOrigin`/
     `mockDataWarning`, `DOKTOR_MCP_DEFAULT_SOURCE_MODE`.
  3. `docs/COMPATIBILITY.md`'ye bu fazlardaki tüm sözleşme değişikliklerini
     additive/breaking olarak sınıflandırarak işle.
  4. Proje kökündeki `nul` adlı artık dosyayı sil (Windows'ta yanlış yönlendirmeyle
     oluşmuş; `git status`'ta görünüyorsa commit'e dahil et).
  5. CHANGELOG'a faz özeti ekle; `package.json` sürümünü minor artır.

### [ ] E7.2 — Tam doğrulama

- **Yapılacak**: Sırayla çalıştır ve hepsinin geçtiğini doğrula:
  ```
  npm run build
  npm test
  npm run lint
  npm run mutation-check
  npm run benchmark:doctor-questions          # mock regresyon koruması
  npm run smoke:mcp -- "riza belgesi" -- --sourceMode mock
  ```
  Mock smoke çıktısında: `packId` mevcut, `dataOrigin: "mock"` + `mockDataWarning`
  mevcut, `sourceTrace` default'ta yok. Sonuçları commit mesajında özetle.

---

## Görev Bağımlılık Grafiği (özet)

```
E0.1, E0.2          → bağımsız, hemen yapılabilir
E1.1 → E1.2 → E1.3 → E1.4
E2.1 → E2.2
E3.1, E3.3          → bağımsız
E3.2                → E2.1'den sonra (yanıt sarmalayıcı değişiklikleri çakışmasın)
E4.1 → E4.2
E5.1                → E2.1'den sonra (dataOrigin alanı için)
E6.1                → bağımsız
E7.*                → en son
```

## Dokunulmaz İnvariantlar (her görevde kontrol et)

1. `verifiedHighCourtPrecedents`'e yalnızca `precedent_usable` kararlar girer.
2. Kaynak erişilemezse içerik UYDURULMAZ; yapılandırılmış `unavailable` döner.
3. Canlı modda mock'a sessiz geri dönüş YOKTUR.
4. Mevzuat alıntıları kaynak hükümden birebirdir; parafraz edilmez.
5. Kategorik nihai hukuki hüküm ("sorumluluk vardır/yoktur") üretilmez.
6. stdio MCP sürecinde stdout'a log yazılmaz (JSON-RPC protokolünü bozar) — log stderr'e.
7. `.cache/`, `fixtures/raw/`, `exports/` commit edilmez.
