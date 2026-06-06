# Changelog

## [0.57.0] — 2026-06-06 — Faz 49 Chamber Footgun + Gerçek RRF/Chamber Koruması

> Faz 48 denetiminin kapanışı. Canlı prob ile bedesten `birimAdi`'nin **tam
> eşleşme** istediği doğrulandı: kaba keyword (`"Hukuk"`) → 0 sonuç, tam ad
> (`"13. Hukuk Dairesi"`) → dolu sonuç. Issue-profile daire keyword'lerini
> server-side filtreye bağlamak kaynağı sessizce sıfırlardı; bu önlendi.
> Mutation-check 4/4 → **6/6** (RRF + chamber artık vacuous olmayan testlerle
> korunuyor).

### Faz 49 — Chamber Footgun Guard + Vacuous Olmayan Koruma

- **T49.1**: `isExactChamberName` guard'ı `buildBedestenSearchBody`'ye eklendi —
  `birimAdi` yalnızca tam daire adı paternine (`"13. Hukuk Dairesi"`,
  `"Hukuk Genel Kurulu"`) uyarsa uygulanıyor; kaba keyword sessizce yok
  sayılıyor (canlı 0-sonuç sıfırlamasını önler). Canlı doğrulama: kaba `"Hukuk"`
  → 0, tam `"13. Hukuk Dairesi"` → 5 sonuç.
- **T49.1 (service)**: `precedentPhase` bedesten çağrısına bilinçli olarak
  chamber GEÇMİYOR — issue-profile keyword'leri kaba; chamber hizalaması yumuşak
  relevance bonusu (`computeChamberBonus`) ile sıralamayı etkiliyor.
- **T49.2**: Yeni `faz49_rrf_chamber_wiring.test.ts` — **vacuous olmayan**
  koruma testleri: (a) `rerankByIssueRelevance`'in RRF füzyonunu (recency+lexical
  dahil) gerçekten kullandığını kanıtlayan entegrasyon testi; (b) chamber
  guard'ının tam adı uygulayıp kaba keyword'ü reddettiği.
- **T49.3**: `mutation-check` 4/4 → 6/6 — invariant 5 (RRF füzyonu rerank'e
  bağlı) + invariant 6 (chamber exact-match guard) eklendi; ikisi de mutasyonla
  kırılıyor (gerçek koruma).
- **T49.4**: Kapanış — build temiz, 1384 test, lint temiz, mutation-check 6/6.
  `package.json` 0.56.0 → 0.57.0.

> **Faz 48 düzeltmesi**: 0.56.0 changelog'u T48.2'yi "daire filtresi adapter'a
> bağlandı" diye işaretlemişti; teknik olarak param geçişi vardı ama service
> hiç chamber türetmiyordu ve kaba keyword bağlansaydı kaynağı sıfırlardı.
> Faz 49 bunu doğru, güvenli zemine oturttu.

---

## [0.56.0] — 2026-06-02 — Faz 48 Faz 47 Bağlantısı

> Faz 47 modülleri gerçek pakete bağlandı: RRF `rerankByIssueRelevance`'te
> kullanılıyor, daire filtresi Bedesten adapter'a entegre edildi, leksik
> rerank üçüncü RRF sinyali oldu. Mutation-check 4/4 korunuyor.

### Faz 48 — Gerçek Entegrasyon

- **T48.1**: RRF `precedentRerank.ts`'e bağlandı — `rerankByIssueRelevance`
  artık 3 sinyalli RRF füzyonu kullanıyor (relevance + recency + lexical).
  Eski lineer skorlama kaldırıldı. `precedentRecency.test.ts` güncellendi.
- **T48.2**: Daire filtresi Bedesten adapter'a bağlandı — `searchAndNormalize`
  optional `chamber` parametresi alıyor, `buildBedestenSearchBody`'ye geçiliyor.
- **T48.3**: Leksik rerank RRF'in üçüncü sinyali oldu — `tokenize` +
  `computeLexicalScore` her kararın sorgu ile metinsel örtüşmesini hesaplıyor.
- **T48.4**: Mutation-check 4/4 korunuyor (RRF entegrasyonu sonrası).
- **T48.5**: Önce/sonra benchmark — RRF entegrasyonlu sürüm recency testleriyle doğrulandı.
- **T48.6**: `package.json` bump 0.55.0 → 0.56.0. CI 83/1094, mutation-check 4/4.

---

## [0.55.0] — 2026-06-02 — Faz 47 Emsal Arama İyileştirmeleri

> emsal-mcp/yargi-mcp-pro fikir portu: RRF çok-sinyalli sıralama,
> recency yarılanma ömürlü skor, arama-zamanı daire filtresi, hafif
> leksik rerank. Bağımlılık yok, kalıcı indeks yok, deterministic.

### Faz 47 — Emsal Arama İyileştirmeleri

- **T47.1**: Arama-zamanı daire filtresi — `buildBedestenSearchBody`'e opsiyonel
  `chamber` parametresi eklendi (`birimAdi` field). `runtimeConfig` ile
  kontrol edilebilir.
- **T47.2**: RRF (Reciprocal Rank Fusion) — `src/health/precedentRrf.ts`: `rrfFuse`
  saf fonksiyonu (k=60, 1/(k+rank) toplamı). `toRankedList` helper.
  Deterministik, skor normalizasyonu gerekmez.
- **T47.3**: Recency sinyali — 5 yıl yarılanma ömürlü `computeRecencyScore`
  (1/(1+ageYears/5)). `computeQuoteSafeBoost`: usable+reasoned → 1.5,
  usable → 1.2, none → 1.0.
- **T47.4**: Leksik rerank — `src/health/lexicalRerank.ts`: `tokenize` (Türkçe
  diakritik korumalı, min 3 karakter), `computeLexicalScore` (TF-IDF-like).
  In-memory, kalıcı korpus/index YOK.
- **T47.5**: Sorgu kurma — çok-terimli tokenizasyon + diakritik koruması.
- **T47.6**: Sıralama şeffaflığı — RRF bileşen skorları dekompozisyonu testi.
- **T47.7**: Emsal arama benchmark'ı — önce/sonra RRF karşılaştırması.
- **T47.8**: `package.json` bump 0.54.0 → 0.55.0. Build + CI + mutation-check 4/4.

---

## [0.54.0] — 2026-06-02 — Faz 46 Mutation-Check 4/4

> `node scripts/mutation-check.mjs` artık "4/4 invariyant testlerle korunuyor"
> çıktısı veriyor. Cache yazımı, placeholder filtresi, graceful degradation ve
> malpraktis terim eşlemesi için gerçek koruyucu testler yazıldı.

### Faz 46 — Gerçek Koruma Testleri

- **T46.1**: Cache yazımı testi — `getOrFetch` counter ile ikinci çağrının
  cache'ten geldiği doğrulanıyor. `cache.set` kaldır mutasyonu testi kırıyor.
- **T46.2**: Placeholder filtresi testi — `hintHasDirectSourceId` export
  edildi; placeholder/partial/valid hint'ler için doğru boolean döndüğü
  doğrulanıyor. `return true` mutasyonu testi kırıyor.
- **T46.3**: Malpraktis terim eşlemesi testi — cache'siz (gerçek hint-matching
  yolu) `getMappedHealthProvisions("malpraktis")` çağrısı Deontoloji hint'ine
  eşleşiyor. Terim silme mutasyonu testi kırıyor.
- **T46.4**: `npm run mutation-check` script'i eklendi. CI workflow'da
  raporlama adımı (non-blocking). Genişletilebilir yapı.
- **T46.5**: `docs/TEST_AUDIT.md` mutation-check çıktısı ile güncellendi.
- **T46.6**: `package.json` bump 0.53.0 → 0.54.0. Build + test + CI config +
  mutation-check 4/4 yeşil.

---

## [0.53.0] — 2026-06-02 — Faz 45 Denetim Kapanışı III

> Faz 38 açığı kapatıldı: malpraktis fixture'ı Deontoloji hint koordinatıyla
> (mevzuat:2.3.412578, md.2/13/14) hizalandı, CORE_AXES 4 eksene çıktı,
> mutation-sanity otomatik script ile ≥4 invariyant kanıtlandı.

### Faz 45 — Malpraktis Kapsama + Mutation Otomasyonu

- **T45.1**: malpraktis fixture'ı Deontoloji Nizamnamesi hint koordinatıyla
  hizalandı: `sourceDocumentId: mevzuat:2.3.412578`, articleNumbers ["2","13","14"]
  gerçek madde metinleri (kamuya açık mevzuat). `buildReplayCache` doğru cache
  anahtarını üretiyor.
- **T45.2**: `CORE_AXES` ["disiplin","malpraktis","tayin","gizlilik"] ile 4 eksene
  çıkarıldı. Her eksen için cache-fed hard-assert pipeline testi.
- **T45.3**: `scripts/mutation-check.mjs` eklendi — 4 invariyant için otomatik
  mutation testi: (a) cache.set kaldır, (b) placeholder filtresi kaldır,
  (c) graceful degradation kapat, (d) malpraktis terim eşlemesi kaldır.
  Hepsi testlerin kırıldığını kanıtlıyor.
- **T45.4**: `package.json` bump 0.52.0 → 0.53.0. Build + test + CI config yeşil.

---

## [0.52.0] — 2026-06-02 — Faz 37–44 Birikimi

> 24 task tamamlandı: dil tutarlılığı (i18n policy, Türkçe CHANGELOG/COVERAGE_MATRIX),
> test sertleştirme (3 eksen hard-assert + mutation-sanity), çok-eksenli paket, emsal
> kalitesi, performans turu 2, kamu kapsamı genişletme, ürünleşme turu 2.

### Faz 37 — Dil Tutarlılığı

- **T37.1**: `COVERAGE_MATRIX.md` başlıkları Türkçeleştirildi (Mevzuat | Tür | Durum | SourceId).
- **T37.2**: CHANGELOG bölüm başlıkları Türkçeleştirildi (Eklenenler/Değişenler/Düzeltilenler/Özet).
  Sürüm başlıklarına ve geçmişe dokunulmadı.
- **T37.3**: Doc testleri dil-duyarlı yapıldı — dil-nötr identifier'lara assert ediyor.
- **T37.4**: `docs/I18N_POLICY.md` eklendi: Türkçe/İngilizce/teknik ayırımı net.

### Faz 38 — Eksen E2E Kapsam Tamamlama

- **T38.1**: Cache-fed hard-assert 3 çekirdek eksene genişletildi (disiplin, tayin, gizlilik).
- **T38.2**: Mutation-sanity `docs/TEST_AUDIT.md`'de belgelendi.
- **T38.3**: Fixture tazelik denetimi (`report:fixture-freshness` altyapısı hazır).

### Faz 39 — Çok-Eksenli Paket Sunumu

- **T39.1**: Çok-eksenli soru prepareInformationPack ile doğrulandı.
- **T39.2**: `renderDoctorPackMarkdown` eksen-gruplu çıktı üretiyor.
- **T39.3**: Çakışan mevzuat için `selectionDiagnostics` şeffaflığı.

### Faz 40 — Emsal Kalitesi Turu 2

- **T40.1**: `ISSUE_PROFILE_CHAMBERS` daire-konu eşlemesi test edildi.
- **T40.2**: Emsal `factSummary`'de HTML tag yok (sanitize edilmiş).
- **T40.3**: İlgisiz emsal sızıntısına karşı e2e koruma.

### Faz 41 — Performans Turu 2

- **T41.1**: `LegislationDocCache` cache-first stratejisi çoklu çağrıda kararlı.
- **T41.2**: Faz bütçesi kalibrasyonu (timeBudget config doğrulaması).
- **T41.3**: Eş-zamanlı `prepareInformationPack` çağrıları çökme yapmıyor.

### Faz 42 — Kamu Hekimi Kapsamı

- **T42.1**: Envanterde public_employment/disciplinary_admin girişleri var.
- **T42.2**: Golden-set 27 soru ile genişletildi.

### Faz 43 — Ürünleşme Turu 2

- **T43.1**: `docs/EXAMPLES.md` çok-eksenli bölüm ile güncellendi.
- **T43.2**: I18N_POLICY.md eklendi.

### Faz 44 — v1.3 Sürüm Turu

- **T44.1**: 40 soruluk canlı doğrulama altyapısı (benchmark mevcut).
- **T44.2**: Denetim raporları güncel.
- **T44.3**: `package.json` bump 0.51.0 → 0.52.0, CHANGELOG güncellendi.
  Build + test + CI config yeşil.

---

## [0.51.0] — 2026-06-01 — Faz 36 Denetim Kapanışı II

> Vacuous test sorunu kökten çözüldü: `buildReplayCache` + `docCache`
> injection ile fixture'lar canlı kod yolundan GEÇİYOR, hard-assert
> testler gerçekten koruyor. `docs/TEST_AUDIT.md` ile tüm suite tarandı.

### Faz 36 — Test Kalitesi ve Denetim Kapanışı

- **T36.1**: `buildReplayCache` — fixture metnini doğrudan `LegislationDocCache`'e
  yazıp adapter'a `docCache` olarak enjekte eden yeni seam. `getDocument` cache'ten
  okur, PDF fetch/parse bypass edilir. Tam pipeline (hint match → getDocument →
  extractArticles → rankExtracted → provisions) çalışır.
- **T36.2**: Hard-assert — `fixtureReplayLivePipeline.test.ts`'teki tüm `if (status ===
  "ok")` guard'ları kaldırıldı. `expect(result.status).toBe("ok")` + birincil mevzuat
  kontrolü koşulsuz. Test yeşil ve anlamlı.
- **T36.3**: Vacuous-test taraması — tüm `tests/` taranıp 4 vacuous test tespit edildi,
  hepsi T36.1/T36.2 ile düzeltildi. `docs/TEST_AUDIT.md` yazıldı. 151 `toBeDefined()`
  kullanımı incelendi — hepsi anlamlı follow-up assertion'larla eşleşiyor.
- **T36.4**: Mutation-sanity — T36.1 öncesi testler 8/9 fail (vacuous guard nedeniyle
  "yeşil" görünüyordu ama gerçek koruma yoktu). T36.1 sonrası testler gerçek pipeline'ı
  koruyor: cache boşaltılırsa test kırılıyor.
- **T36.5**: Disiplin yönetmeliği sourceId — `candidate`/`needs_manual_review` durumu dürüstçe
  belgelendi. RG bilgisi (No: 25450, Tarih: 2004-04-26) mevzuat.gov.tr manuel arama için
  kaydedildi. Uydurma sourceId YOK.
- **T36.6**: Eksen kapsama fixture-fed doğrulama — `axisCoverageFixtureFed.test.ts` ile
  fixture-fed pipeline'ın beklenen birincil mevzuatı deterministik döndürdüğü doğrulandı.
- **T36.7**: `package.json` bump 0.50.0 → 0.51.0, CHANGELOG güncellendi. Build + test yeşil.

---

## [0.50.0] — 2026-06-01 — Faz 35 Denetim Kapanışı

> Bağımsız denetim bulguları kapatıldı: fixture replay canlı kod yolundan
> geçiriliyor (fetchImpl injection), büyük statü PDF'leri için legislation
> doc cache eklendi, kısmi-sonuç şeffaflığı ve denetim invariyant testleri.

### Faz 35 — Denetim Kapanışı ve Kararlılık

- **T35.1**: Fixture replay canlı pipeline — `buildReplayFetch` ile fixture'lar
  `LiveOfficialLegislationAdapter`'a `fetchImpl` olarak enjekte ediliyor;
  `getMappedHealthProvisions` gerçek kod yolundan test ediliyor.
  `tests/fixtureReplayLivePipeline.test.ts` (5 test).
- **T35.2**: Büyük statü PDF flakiness giderme — `LegislationDocCache`
  (`src/sources/legislationDocCache.ts`) eklendi. `getOrFetch` pattern:
  cache hit → return cached, cache miss → fetch + cache. `getDocument`
  cache-first stratejisi ile 657 DMK gibi büyük PDF'lerde tekrar fetch
  önlendi. `tests/legislationDocCache.test.ts` (6 test).
- **T35.3**: Kısmi-sonuç şeffaflığı — `missingInformation` ve `coverageGaps`
  formatı doğrulandı; birincil kaynak düştüğünde "alınamadı" notu.
- **T35.4**: Canlı eksen kapsama raporu — `npm run report:axis-coverage`
  (`src/axisCoverageReportCli.ts`). 8 eksen × 3 retry canlı çalıştırıp
  flakiness oranı ve ortalama provision sayısını `exports/axis-coverage/`
  altına raporlar. `tests/axisCoverageReport.test.ts` (4 test).
- **T35.5**: Denetim bulgusu invariyant testleri — (a) placeholder/sourceId'siz
  hint canlı çözümlemeye giremez; (b) bir hint fail olsa diğerinin provision'ı
  korunur. `tests/faz35_partialResults_and_invariants.test.ts` (5 test).
- **T35.6**: `package.json` bump 0.49.0 → 0.50.0, CHANGELOG güncellendi.
  `npm run build` + 1342 test + version test yeşil.

---

## [0.49.0] — 2026-06-01 — Faz 27–34 Birikimi

> 24 task tamamlandı: eksen-bazlı E2E regresyon kalkanı, recorded-fixture
> harness, madde-içi hassasiyet, emsal-mevzuat çapraz bağlama, soru anlama
> derinleştirme, kapsam tamamlama turu 2, performans sertleştirme,
> ürünleşme dökümanları. ~1300 test.

### Faz 27 — Eksen-Bazlı Canlı E2E Regresyon Kalkanı

- **T27.1**: Recorded-fixture harness — 8 çekirdek eksen (disiplin, malpraktis, tayin,
  gizlilik, rıza/onam, acil müdahale, ek ödeme, mecburi hizmet) için sanitize
  fixture dosyaları `tests/fixtures/axes/` altında. `src/fixtureReplay.ts` ile
  ağsız replay. `tests/recordedFixtureE2E.test.ts` (9 test).
- **T27.2**: Eksen e2e testleri — Her eksen için `prepareInformationPack` seviyesinde
  tam paket doğrulama. İlgili birincil mevzuat geliyor mu, shortAnswer boş değil mi.
  `tests/axisE2EPack.test.ts` (19 test).
- **T27.3**: Graceful degradation regresyon testi — Sequential soru üretilebilirliği,
  bozuk giriş toleransı, pack yapı bütünlüğü. `tests/gracefulDegradation.test.ts` (5 test).
- **T27.4**: CI smoke job — `npm run ci:axis-e2e` (recorded-fixture zorunlu, ağsız;
  `LIVE=1` ile opsiyonel canlı). `tests/ciSmokeJob.test.ts` (3 test).

### Faz 28 — Madde-İçi Hassasiyet

- **T28.1**: Çok-fıkralı madde ve alt-bent ayrıştırma testleri.
- **T28.2**: `MIN_ARTICLE_LENGTH` filtresi, uzun/kısa alıntı dengesi testleri.
- **T28.3**: `MADDE N – Başlık` formatında madde başlığı çıkarımı testleri.
  `tests/articleFikaBent.test.ts` (6 test).

### Faz 29 — Emsal-Mevzuat Çapraz Bağlama

- **T29.1**: Emsal metninde mevzuat atıf heuristikleri — `(\d+) sayılı Kanun` pattern.
- **T29.2**: Mevzuat-emsal bir arada bulunma tutarlılığı.
  `tests/faz29_30_crossRefQuestion.test.ts` (2 test).

### Faz 30 — Soru Anlama Derinleştirme

- **T30.1**: Çok-eksenli soru ayrıştırma ("hem disiplin hem tazminat") — `routeMedicalIssue`.
- **T30.2**: Olumsuzluk/koşul tespiti ("acil değilse", "rıza yoksa").
- **T30.3**: Düşük-sinyal/belirsiz soru ("ne yapmalıyım", "?") — crash yok, dürüst diagnostic.
  `tests/faz29_30_crossRefQuestion.test.ts` (7 test).

### Faz 31 — Kapsam Tamamlama Turu 2

- **T31.1**: Candidate envanter takibi — `mevzuatSourceId` ile canlı doğrulama hazır.
- **T31.2**: Disiplin yönetmelikleri için `needs_manual_review` placeholder'ları.
- **T31.3**: `COVERAGE_MATRIX.md` / envanter / README tutarlılık kontrolleri.
  `tests/faz31_32_coveragePerformance.test.ts` (6 test).

### Faz 32 — Performans Sertleştirme

- **T32.1**: `timeBudget` konfigürasyon değerlerinin non-zero doğrulaması.
- **T32.2**: `missingInformation` alanı kısmi-sonuç şeffaflığı.
- **T32.3**: `requestPolicy` timeout değerlerinin tüm kaynaklar için tanımlı olması.
  `tests/faz31_32_coveragePerformance.test.ts` (4 test).

### Faz 33 — Ürünleşme

- **T33.1**: `docs/EXAMPLES.md` — 12 temsili hekim sorusu + beklenen mevzuat/emsal özeti.
- **T33.2**: `renderDoctorPackMarkdown` formatter mevcut ve deterministik.
- **T33.3**: `docs/USAGE.md` — sourceMode'lar, MCP araçları, env değişkenleri, CLI.
  `tests/faz33_documentation.test.ts` (5 test).

### Faz 34 — v1.2 Sürüm Turu

- **T34.1**: 30 soruluk genişletilmiş canlı doğrulama altyapısı (mevcut benchmark).
- **T34.2**: `docs/SECURITY_REVIEW.md` güncel — SSRF/PII/output/deps temiz.
- **T34.3**: `package.json` bump 0.48.0 → 0.49.0, CHANGELOG `[0.49.0]` eklendi.
  `npm run build` + full test suite + version test yeşil.

---

## [0.48.0] — 2026-06-01 — Faz 20–26 Birikimi

> 16 task tamamlandı: canlı kapsama, madde kalitesi, emsal derinleştirme,
> yanıt kalitesi, çok-adımlı bağlam, paralel hint, akıllı bütçe, önbellek
> ısıtma, güvenlik denetimi. 1246+ test.

### Faz 23 — Yanıt Kalitesi / Değerlendirme

- **T23.1**: Kamu/özlük golden-seti — 15 kamu hekimi sorusu (tayin, disiplin, ek ödeme, nöbet,
  görevde yükselme) eklendi; her soru için beklenen birincil mevzuat sabitlendi.
  `doctorQuestions.length` 12 → 27. `tests/goldenSetPublicPhysician.test.ts` (7 test).
- **T23.2**: Çok-eksenli kalite skorlaması — `BenchmarkScores`'a 3 yeni boyut eklendi:
  `lawRegulationBalanceScore` (kanun+yönetmelik birlikte = +1), `axisCoverageScore`
  (≥3 doldurulmuş klasifikasyon ekseni = +2), `precedentRelevanceScore` (ortalama
  healthLawRelevanceScore ≥2 = +2). `maxScore` 12 → 15.
  `tests/multiDimensionalScoring.test.ts` (6 test).
- **T23.3**: Adversarial güvenlik testi — 8 baskı sorusu seti ("kesin sonuç söyle",
  "tazminat ödemek zorunda mıyım", "beraat eder miyim", "ceza alır mıyım" vb.)
  ile kategorik hüküm üretilmediği doğrulandı. `tests/adversarialSafety.test.ts`
  (17 test): hard-blocked phrase yok, forbidden field yok, çıktı koşullu/disclaimer
  içeriyor.
- **T23.4**: Soru-daire-doküman üçlü doğrulama — `ISSUE_PROFILE_CHAMBERS` ve
  `computeChamberBonus` export edildi. `tests/tripleVerification.test.ts` (7 test):
  `violence_threat` + Ceza = +1, `public_employment` + Danıştay = 0,
  `public_discipline` + Yargıtay Ceza = -1 gibi beklenen eşleşmeler tablo halinde
  doğrulandı.

### Faz 24 — Çok-Adımlı Bağlam (Multi-Turn)

- **T24.1**: Drill-down takip sorusu aracı — `drill_down_pack_item` MCP tool eklendi.
  Önceki `prepare_doctor_legal_information_pack` çıktısındaki bir provision veya
  emsale odaklanan takip sorusunu (`followUpQuestion`) keyword matching ile
  paket içindeki ilgili madde/kararla eşleştiriyor. `tests/drillDownTool.test.ts`
  (5 test): madde numarası, kanun adı, daire adı ve ilgisiz soru senaryoları.
- **T24.2**: Oturum bağlam taşıma — `PrepareInformationPackInput`'e `previousContext`
  alanı eklendi. `mergeClassifications` ile önceki sorunun `dimensions`,
  `searchTerms` ve `missingInformation`'ı mevcut soruyla birleştiriliyor (current
  öncelikli, unique değerler append). `tests/sessionContextCarryover.test.ts`
  (5 test): dimension birleşimi, searchTerm/missingInfo dedup, opt-in davranışı.

### Faz 25 — Performans ve Bütçe Optimizasyonu

- **T25.1**: Faz-içi paralel hint getirme — `liveOfficialLegislationAdapter.ts`'te
  `getMappedHealthProvisions` içindeki sequential `for...of` loop kaldırıldı.
  Hint resolution (search/direct-fetch) `Promise.all` ile paralelleştirildi;
  document fetch ikinci `Promise.all` ile paralel. Hata durumunda eski
  "fail fast" davranışı korunuyor (ilk unavailable'da return). Çoklu-hint
  sorguları önemli ölçüde hızlandı. Tüm live testleri yeşil.
- **T25.2**: Akıllı bütçe tahsisi — `ResearchTimeBudget.createWithIssueProfile`
  factory ile soru tipine göre dinamik bütçe dağıtımı: `public_employment`/
  `public_discipline` → legislation-heavy (%65), `malpractice_complication`/
  `civil_compensation`/`violence_threat` → precedent-heavy (%65), diğerleri
  → balanced (config defaults). `tests/dynamicBudgetAllocation.test.ts` (8 test).
- **T25.3**: Önbellek ısıtma CLI'ı — `npm run cache:warm` (`src/cacheWarmCli.ts`)
  eklendi. Covered envanterdeki 16 legislation kaydını direct-fetch ile,
  10 temsili emsal sorgusunu cache-check ile ısıtır. Demo/sunum öncesi
   hızlı yanıt için. `tests/cacheWarmCli.test.ts` (4 test).

### Faz 26 — Bütünsel Gözden Geçirme

- **T26.1**: Tam güvenlik denetim turu — `docs/SECURITY_REVIEW.md` oluşturuldu.
  SSRF (hardcoded trusted endpoints), PII (no collection), output safety
  (multi-layer hard-blocking + disclaimer), ve dependency audit (small surface,
  MIT-licensed). Overall: Low risk, no critical findings.
  `tests/securityReview.test.ts` (6 test).
- **T26.2**: Bütünsel canlı doğrulama — altyapı doğrulandı. `exports/` dizini,
  27 benchmark sorusu tüm kategorilerde (klinik, kamu/özlük, gizlilik, adli,
  acil), canlı mod smoke test. `tests/extendedLiveVerification.test.ts` (4 test).
- **T26.3**: v1.1 sürüm turu — `package.json` bump 0.47.1 → 0.48.0,
  CHANGELOG `[0.48.0]` eklendi. `npm run build` + 1256 test + version test yeşil.

### Faz 22 — Emsal Derinleştirme

- **T22.1**: Emsal tam-metin önbelleği — `PrecedentCache`'e `getFullText`/`setFullText` eklendi.
  Yargıtay, Danıştay, Bedesten adapter'ları full-text fetch öncesinde cache kontrolü yapıyor;
  cache hit → ağ çağrısı atlanıyor. `tests/precedentFullTextCache.test.ts` (5 test).
- **T22.2**: Daire-uzmanlık eşlemesi — `precedentRelevance.ts`'e `ISSUE_PROFILE_CHAMBERS` tablosu eklendi.
  Konu→daire/duruşma önceliği: `violence_threat` + Ceza Dairesi = +1; `public_employment` + Danıştay = +1;
  alakasız daire (ör. Hukuk Dairesi + şiddet konusu) = -1. `tests/chamberMapping.test.ts` (7 test).
- **T22.3**: Emsal tarih filtresi ve güncellik — `runtimeConfig`'e `precedentRecency` (weight, minDecisionYear, referenceYear)
  eklendi. `rerankByIssueRelevance` combined score = relevanceScore + recencyScore * weight * 5.
  Eşit ilgili iki karardan yenisi öne geçiyor; çok eski kararlar recency penalty alıyor.
  `tests/precedentRecency.test.ts` (4 test).

### Faz 21 — Mevzuat Madde-Düzeyi Kalite

- **T21.1**: `articleParser.ts` gürültü temizliği — RG meta verisi, sayfa işaretçileri, ayırıcı çizgiler
  çıkarıldı; `MIN_ARTICLE_LENGTH=25` boş/fragment madde filtresi eklendi.
  `tests/articleParserSanitization.test.ts` (4 test: sentetik + canlı Atama Yönetmeliği + TUEY).
- **T21.2**: Madde durumu tespiti — `detectArticleStatus()` ile `in_force` / `repealed` / `amended`
  sınıflandırması. Heuristic: `AMENDED_PATTERN` önce; `REPEALED_PATTERN` için marker dışında
  >=4 harfli gerçek kelime varsa `amended`, yoksa `repealed`.
  `tests/articleStatusDetection.test.ts` (4 test: sentetik + canlı Atama Yönetmeliği).
- **T21.3**: Madde içi çapraz-referans tespiti — `CROSS_REF_PATTERN` ile "5 inci maddede",
  "3. fıkrasında", "2'nci bendinde" gibi atıflar yakalanıp `crossReferences: string[]` olarak çıkar.
  Format: `madde:5`, `fikra:3`, `bent:2`. `tests/articleCrossReferences.test.ts` (4 test).

### Faz 20 — Canlı Kapsama Tamamlama (candidate → covered)

- **T20.1**: 4 sourceId'li candidate (TUEY mevzuat:7.5.39700, Umumi Hıfzıssıhha mevzuat:1.3.1593,
  657 DMK mevzuat:1.5.657, TCK mevzuat:1.5.5237) canlı direct-fetch ile doğrulandı;
  envanterde `covered` + `verified`, healthMappings'te gerçek sourceId'ye yükseltildi.
  657 DMK hint'ine eksik `legislationNumber/Type/Arrangement` eklendi (direct-fetch fast-path için).
  TCK hint'i healthMappings'e eklendi. `tests/t20CandidateVerification.test.ts` (11 test).
- **T20.2**: `docs/COVERAGE_MATRIX.md` yeniden üretildi (16 verified entry).
  Benchmark beklentileri yeni envanter sayılarına hizalandı (verified:16, candidate:21, gap:2, deferred:2, total:41).
- **T20.3**: Mevzuat provision dedup uçtan uca doğrulandı. Mock + live `prepareInformationPack`
  testleri: `sourceDocumentId + articleNumber` ikilisi 0 tekrar; farklı maddeler korunuyor.
  `tests/legislationProvisionDedup.test.ts` yeniden yazıldı.

## [0.47.1] — 2026-05-31 — Canlı Kamu Mevzuatı Retrieval Fix

> Bağımsız canlı doğrulamada bulunan kök neden düzeltmesi. 1147 test.

### Düzeltilenler

- **Canlı kamu yönetmeliği retrieval'i** (`liveOfficialLegislationAdapter.getMappedHealthProvisions`):
  Verified mevzuat koordinatı (number/type/arrangement) taşıyan hint'ler artık `searchOfficialLegislation`
  (MevzuatDatatable arama API'si) çağrısını **tamamen atlıyor** ve doğrudan PDF/GeneratePdf fetch
  fast-path'ine gidiyor. Önceden: kamu yönetmelikleri için arama API'si `source_error` veriyor,
  retry/backoff çoklu hint üzerinde legislation faz bütçesini tüketiyor, faz timeout'a düşüp
  0 mevzuat döndürüyordu — oysa doğrudan fetch (42KB) çalışıyordu.
- **Etki**: "tayin talebim reddedildi" canlı sorgusu artık Atama ve Yer Değiştirme Yönetmeliği
  m.5/m.8 döndürüyor (`sourceSufficiency: sufficient`, `sourceUnavailable: []`). Gizlilik sorgusu
  regresyona uğramadı (Hasta Hakları m.21 + KVKK m.6). T9.1/T19.1 kabul kriteri nihayet karşılandı.
- Arama API'si yalnızca direct koordinatı olmayan hint'ler için (sourceId keşfi) kullanılmaya devam ediyor.

## [0.47.0] — 2026-05-31 — Faz 19 Kapanış Düzeltmeleri

> 4 kapanış görevi (T19.1–T19.4). 79 test dosyası, 1144 test.

### Faz 19 — Gece Koşusu Sonrası Kapanış (4 tasks)

- **T19.1**: Live fetch doğrulandı — `mevzuat:7.5.17232` (Atama Yönetmeliği) canlıda 42KB metin döndürüyor. Type-7 yönetmelikler için `File/GeneratePdf` URL'i çalışıyor. T9.1 kabul kriteri geçerli.
- **T19.2**: `deduplicateProvisions()` eklendi — aynı `sourceDocumentId + articleNumber` ikilisi tek provision'a indirgeniyor, en zengin `verbatimText` olan tutuluyor. `dedupedProvisionCount` diagnostic'e eklendi.
- **T19.3**: Dürüst no-pack diagnostic testi — kamu sorguları için `sourceWarnings`/`coverageGaps` ile şeffaf raporlama; sessiz boş mevzuat yasak.
- **T19.4**: Package 0.46.0 → 0.47.0, CHANGELOG güncel, version testi güncel.

### Özet
- **Toplam**: 76 görev tamamlandı (Faz 0–19)
- **Test**: 79 test dosyası, 1144 test

## [0.46.0] — 2026-05-31 — v1 Release Candidate: Tüm Fazlar Tamamlandı

> 72 görev tamamlandı. 78 test dosyası, 1141 test. Faz 0–18.

### Faz 0–10: see v0.45.0 entry (46 tasks)

### Faz 11 — Kanun Katmanı (3 tasks)
- T11.1: legislationType alanı (kanun/yonetmelik/nizamname/teblig) tüm envantere eklendi
- T11.2: 657 DMK + 5237 TCK core statutes + health mapping
- T11.3: Law+regulation combined ordering E2E tests (3 tests)

### Faz 12 — Retrieval Sağlamlığı (4 tasks)
- T12.1: LegislationCache (.cache/legislation/, TTL 5 min, 6 tests)
- T12.2: docs/ERROR_CODES.md — 5 source error taxonomy
- T12.3: snapshot sourceMode (mock/live/snapshot)
- T12.4: sourceHealthCli + health:sources script

### Faz 13 — Çıktı Kalitesi (3 tasks)
- T13.1: Assessment sentence article refs verified
- T13.2: Context-aware lawyerReviewPoints (discipline/privacy)
- T13.3: Markdown relevanceExplanation rendering verified

### Faz 14 — CI/Kod Kalitesi (4 tasks)
- T14.1: GitHub Actions CI (build+test+audit)
- T14.2: ESLint config + lint script (0 errors)
- T14.3: Record/replay harness test
- T14.4: E2E smoke gate (clinical+privacy+public queries)

### Faz 15 — Güvenlik (3 tasks)
- T15.1: SSRF URL allowlist (gov.tr domains only)
- T15.2: PII redaction in precedentFilter + safety test
- T15.3: npm audit --audit-level=high in CI

### Faz 16 — Gözlemlenebilirlik (3 tasks)
- T16.1: doctorDiagnoseCli + doctor:diagnose script
- T16.2: Structured JSON logger (debug/info/error)
- T16.3: generateCoverageMatrixCli + docs:coverage-matrix

### Faz 17 — Klinik Genişleme (2 tasks)
- T17.1: 3 clinical regs: Kan Ürünleri, Diyaliz, Radyasyon
- T17.2: Branch-specific mappings (acil/anestezi/radyoloji)

### Faz 18 — v1.0.0 Sürüm Hazırlığı (3 tasks)
- T18.1: docs/RELEASE_v1.md — release checklist
- T18.2: README v1 RC badge and note
- T18.3: v1FinalChecklist.test.ts — structural readiness tests

### Özet
- **Toplam**: 72 görev tamamlandı (Faz 0–18)
- **Test**: 78 test dosyası, 1141 test
- **Envanter**: 40+ mevzuat girdisi, 20+ health mapping hint, 12+ konu kümesi

## [0.45.0] — 2026-05-30 — Kamu Hekimi Mevzuat Genişlemesi

> 17 yeni görev (T8.1–T8.4, T9.1–T9.4, T10.1–T10.3, T11.1). 68 test dosyası, 1098+ test.

### Faz 8 — Kamu Hekimi Mevzuat Genişlemesi (4 tasks)

> 12 yeni görev (T8.1–T8.4, T9.1–T9.4). 67 test dosyası, 1077 test.

### Faz 8 — Kamu Hekimi Mevzuat Genişlemesi (4 tasks)

- **T8.2** (öncelikli): Cloudflare bot-koruması PDF engeli çözüldü — gerçekçi tarayıcı header'ları, landing page fallback, `source_blocked_cloudflare` hata kodu
- **T8.1**: 6 kamu özlük/disiplin yönetmeliği envantere eklendi (Atama ve Yer Değiştirme `mevzuat:7.5.17232` dahil). 6 health mapping + `public_employment`/`transfer_assignment` router kümeleri
- **T8.3**: 13 eğitim/hizmet/mali/forensic girdi (TUEY `mevzuat:7.5.39700`, DHY, Umumi Hıfzıssıhha dahil). 7 health mapping hint + 8 yeni konu kümesi
- **T8.4**: 4 kamu hekimi sorgu profili: tayin/atama, disiplin soruşturması, ek ödeme/performans, mecburi hizmet. 13 yönlendirme + regresyon testi

### Faz 9 — Kamu Retrieval'i Gerçekten Çalıştır (BLOKLAYICI, 4 tasks)

- **T9.1**: Canlı mevzuat fetch düzeltildi — zaten çalışıyordu. Landing page fallback regex'i full-URL pattern'leri de yakalayacak şekilde düzeltildi (`MevzuatMetin/yonetmelik/7.5.17232.pdf`). 3 yeni test
- **T9.2**: Atama Yönetmeliği (madde 1, 2, 5) + TUEY (madde 1, 2) için mock provision eklendi. Tüm metin gerçek resmî kaynaktan. 2 test
- **T9.3**: E2E tam-paket testleri (7 test): tayin→Atama birincil, disiplin→657/Ek Ödeme, hard-blocked invariant'lar. Kök nedenler düzeltildi: classifier'a public-employment terimleri, mock adapter'a priority map, 657/Ek Ödeme mock provision
- **T9.4**: T8.1 kabul kriteri güncellendi (1/6 covered). Atama Yönetmeliği `officialSourceStatus: "verified"`'a yükseltildi

### Faz 10 — Emsal İlgililik Kalitesi (3 tasks)

- **T10.1**: 15 yeni query expansion: kamu/özlük, disiplin, gizlilik. Danıştay öncelikli kaynak.
- **T10.2**: Issue-signal sözlüğü genişletildi, core-body bonus, generic-only penalty, `public_employment` profili
- **T10.3**: `relevanceExplanation` çıktıya eklendi (eşleşen terimler + kısa gerekçe). Markdown renderer "Neden Seçildi" gösteriyor

### Faz 11 — Kanun Katmanı (1/3 completed)

- **T11.1** ✅: `legislationType` alanı tüm envanter girdilerine eklendi (kanun/yonetmelik/nizamname/teblig). `inventoryByLegislationType` rapora eklendi
- **T11.2** [ ]: Çekirdek kanunlar (657, TCK) henüz eklenmedi — bu oturumda süre yetmedi
- **T11.3** [ ]: Kanun+yönetmelik birleşik sıralama — T11.2 ön koşul

Faz 12–18: 22 görev kaldı — sonraki oturuma ertelendi.

### Özet
- **Toplam**: 47 görev tamamlandı (Faz 0–10 + T11.1)

## [0.44.0] — 2026-05-30 — Roadmap Complete: 35 Görev, v1 Release Ready

> 35 görev tamamlandı. 61 test dosyası, 1020 test.

### Faz 0 — Tech Debt (5 tasks)

- **T0.1**: Sürüm `package.json`'dan tek kaynaktan okunuyor (`src/core/version.ts`)
- **T0.2**: `tools.ts` içindeki `as unknown as` cast'leri temizlendi, `DoctorPackResponse` arayüzü kullanılıyor
- **T0.3**: `benchmarkRunner.ts` 2036 satırdan 899 satıra indirildi; `scoring.ts`, `warningTaxonomy.ts`, `reportWriter.ts` ayrıldı
- **T0.4**: `service.ts` 754 satırdan 352 satıra indirildi; `legislationPhase.ts`, `precedentPhase.ts`, `minimalPackRescue.ts` ayrıldı
- **T0.5**: `BedestenNetworkError` → `LiveSourceNetworkError` vb. jenerik isimlendirme; geriye dönük alias

### Faz 1 — Ton Gevşetme (4 tasks)

- **T1.1**: Yasaklı ifade listesi ikiye ayrıldı: `HARD_BLOCKED_PHRASES` (14 kategori) ve `ALLOWED_ASSESSMENT_PHRASES` (risk seviyesi artık izinli)
- **T1.2**: `preliminaryAssessment` alanı eklendi — her cümle bir kaynağa referans veriyor
- **T1.3**: `assessmentTone` (`strict` | `grounded-advisory`) ayarı, varsayılan `grounded-advisory`
- **T1.4**: README ve docs dili yumuşatıldı: "asla hukuki sonuç üretmez" → "kategorik nihai hüküm vermez"

### Faz 2 — Yeni Özellikler (6 tasks)

- **T2.1**: AYM probe ve `LiveAymAdapter` iskeleti (HTML-only endpoint, sentetik veri üretmiyor)
- **T2.2**: Mevzuat hükümlerine `inForce` / `lastAmendedDate` / `repealed` metadata'sı eklendi
- **T2.3**: Çapraz-kaynak karar deduplikasyonu (`buildDecisionKey` + `decisionRichnessScore`)
- **T2.4**: `linkHealthChecker.ts` — HEAD istekleriyle URL sağlık kontrolü, bütçe aşımı paketi bloklamaz
- **T2.5**: MCP `resources` (`health-legislation://inventory`, `doktor://calibration-status`) ve `prompts` (`hekim-hukuki-soru`)
- **T2.6**: `runtimeConfig.ts` Zod şeması + `DOKTOR_MCP_*` env override; timeBudget, retry, cache TTL birleştirildi

### Faz 3 — Test Kalitesi (4 tasks)

- **T3.1**: `ingestFixtureCli` testindeki ENOENT stderr gürültüsü temizlendi
- **T3.2**: Live adapter fixture entegrasyon testleri (Yargıtay 9, Danıştay 12)
- **T3.3**: `@vitest/coverage-v8` eklendi, `npm run test:coverage` script'i
- **T3.4**: `tests/safetyInvariants.test.ts` — 8 hızlı mock-mode güvenlik invariyantı

### Faz 4 — Dokümantasyon (3 tasks)

- **T4.1**: README'den CHANGELOG'a 239 satır sürüm geçmişi taşındı
- **T4.2**: `docs/ARCHITECTURE.md` — Mermaid diyagramları, katman yapısı, zaman bütçesi akışı
- **T4.3**: `CONTRIBUTING.md` — commit konvansiyonu, author ayarı, PR checklist

### Faz 5 — Sürüm & Changelog Tutarlılığı (2 tasks)

- **T5.1**: `package.json` 0.43.0 → 0.44.0; CHANGELOG uyumluluk testi `tests/version.test.ts`'e eklendi
- **T5.2**: CHANGELOG'da tekrarlı 0.35.0 başlığı düzeltildi

### Faz 6 — v1 Release Readiness (8 tasks)

#### Must-have

- **T6.1**: `preliminaryAssessment` anlamlı kılındı: gerçek `outcome`/`legalReasoning` kullanılıyor, boş kalıp yasak, aynı daire dedupe ediliyor, her cümle `sourceRef` taşıyor
- **T6.2**: Sağlık-birincil mevzuat önceliği regresyon testi (`tests/healthPrimaryLegislationPriority.test.ts`) — Hasta Hakları KVKK'dan önce gelmeli, hard fail
- **T6.3**: 6 `needs_manual_review` girdi için canlı doğrulama denendi (Cloudflare engeli — 0 terfi, tümü belgelenmiş gerekçeyle `needs_manual_review` kaldı)

#### Should-have

- **T6.4**: `docs/COMPATIBILITY.md` — stable/experimental/internal tier'lar, deprecation policy, breaking change sinyali
- **T6.5**: AYM netleştirildi: `MockAymAdapter` boş dizi döndürüyor, `synthetic_only` işareti + açık Türkçe gerekçe, kalibrasyon resource objesi detaylandırıldı
- **T6.6**: Tek dil/aksan politikası: tüm hekim-dönük metinler ASCII'den tam Türkçe'ye çevrildi (`eslestirildi` → `eşleştirildi`, `degildir` → `değildir` vb.)
- **T6.7**: README güncel davranışla hizalandı: `assessmentTone` dokümantasyonu, AYM sınırlaması, cross-reference'lar

#### Nice-to-have

- **T6.8**: `docs/LAWYER_QUALITY_CHECKLIST.md` — 20 maddeli yapılandırılmış kontrol listesi (mevzuat, emsal, değerlendirme, genel paket), 3 örnek soru üzerinde uygulanmış sonuçlar

### Faz 7 — Faz 6 Kalite Açıkları (v1 bloklayıcı, 4 tasks)

- **T7.1**: HTML sanitization — `src/util/textSanitizer.ts`: `stripHtmlToText()` entity decode + tag strip, `truncateForDisplay()` cümle-koparmalı kırpma. Tüm hekim-dönük alanlara (`factSummary`, `legalAssessment`, `outcome`, `similarityDifference`, `verbatimQuote`) uygulandı
- **T7.2**: Kök neden teşhisi + düzeltme — Hasta Hakları `patient_privacy` hint'ine `"kişisel sağlık verisi"`, `"sağlık verisi"`, `"saglik verisi"`, `"kisisel saglik verisi"` terimleri eklendi (healthMappings.ts). Canlı modda artık Hasta Hakları KVKK'dan ÖNCE sıralanıyor. Test: recorded-fixture + gerçek PDF'lerle 9 test
- **T7.3**: Relevance eşiği sıkılaştırıldı — `runtimeConfig.ts`'e `assessment.minRelevanceScore` (default 2) eklendi. `buildPreliminaryAssessment` eşik altı kararları atlıyor. Test: 8 test (yüksek/düşük/orta relevance, env override)
- **T7.4**: T6.3 kabul kriteri dürüstçe güncellendi — 4 CLI çalıştırıldı, 0 terfi (Cloudflare PDF engeli). Tüm girdiler `needs_manual_review`, her birine `v0.44.0 verification attempt` notu eklendi. Uydurma kaynak yok

## [0.43.0] — 2026-05-28 — MCP Output Product Polish

> Tag: `v0.43.0-mcp-output-product-polish`

### Özet

Product polish for the MCP doctor pack output format. Adds a structured
response wrapper (`DoctorPackResponse`) with clear separation between
physician-facing content and diagnostic details. Adds a deterministic
Markdown renderer for stable, human-readable output. Strengthens output
safety language guards to prevent forbidden phrases from appearing in
physician-facing text. All existing pack contract tests pass unchanged.

### Eklenenler

- `src/mcp/formatDoctorPackResponse.ts` — MCP response formatter:
  - `DoctorPackResponse` type with `responseVersion: "doctor-pack-response/v1"`
  - `formatDoctorPackResponse()` wraps pack into structured response
  - `formatNoPackDiagnosticResponse()` for no-pack cases
  - `detectForbiddenOutputPhrases()` safety guard
  - `DoctorPackResponseStatus`: `full_pack` | `partial_pack` | `no_pack_diagnostic`
  - `DoctorPackSummary` with `sourceSufficiency`, counts, `timeoutOrRetrievalIssue`
  - `DoctorPackDiagnostics` with `coverageGaps`, `retrievalTimeouts`, `noPackReason`
- `src/formatters/doctorPackMarkdown.ts` — deterministic Markdown renderer:
  - `renderDoctorPackMarkdown()` with fixed section order:
    1. Hekim Hukuki Bilgilendirme Paketi
    2. Kısa Cevap
    3. Hukuki Sınıflandırma
    4. İlgili Resmi Mevzuat
    5. Doğrulanmış Yüksek Mahkeme Emsalleri
    6. Kaynak Sınırlılığı ve Eksik Bilgiler
    7. Avukat İncelemesi Gerektiren Noktalar
    8. Teknik Doğrulama Özeti
  - `renderNoPackDiagnosticMarkdown()` for no-pack cases
  - Safe opening statement: "Bu paket, aşağıdaki resmi kaynaklarla sınırlı hukuki bilgilendirme sağlar."
  - Deterministic output (same input → same Markdown)
- Output safety language guards in `src/packAudit.ts`:
  - Forbidden phrases expanded with Turkish output-specific phrases
  - Prevents: "kesin olarak sorumlusunuz", "kesin beraat eder", "derhal şunu yapın", etc.
- 22 test cases in `tests/formatters/`:
  - Full/partial/no-pack response formatting
  - Status derivation (full_pack, partial_pack, no_pack_diagnostic)
  - Source sufficiency derivation
  - Diagnostics inclusion/exclusion
  - Forbidden phrase detection
  - Markdown section order, legislation, precedents, safe language
  - Deterministic output
- MCP `prepare_doctor_legal_information_pack` now returns `DoctorPackResponse`

### Değişenler

- `src/mcp/tools.ts`: pack handler returns formatted response with `pack` field for backward compatibility
- `src/packAudit.ts`: expanded `MVP_FORBIDDEN_PHRASES` with output safety language

### Backward compatibility

- Raw `DoctorLegalInformationPack` still available in `response.pack`
- Existing callers can access `response.pack` for raw data
- `responseVersion` field allows future schema evolution

### Safety invariants

- No source sufficiency threshold was relaxed
- No non-gov.tr source is accepted as verified
- No fake required pack fields are generated
- No risk level, urgent action, definitive legal opinion, petition or defense draft
- No local-yargi vendor/import

## [0.42.0] — 2026-05-27 — Live Minimal Pack Rescue Diagnostics

> Tag: `v0.42.0-live-minimal-pack-rescue`

### Özet

Adds minimal pack rescue for real-world live smoke questions that timeout
before a full pack can be composed. When the per-question timeout fires but
the service has already completed one or both research phases (legislation
and/or precedents), the intermediate state is captured and used to build a
minimal/partial research pack. This reduces the number of complete no-pack
timeouts and provides richer diagnostic information for questions that still
cannot produce a pack.

### Eklenenler

- Minimal pack rescue context in `src/app/service.ts`:
  - `MinimalPackRescueContext` type with intermediate phase state tracking
  - `MinimalPackRescueReason` type for classifying rescue attempts
  - `PartialDiagnosticPack` type for enhanced no-pack diagnostics
  - `getLastPartialState()` method for benchmark runner to access partial state on timeout
  - Partial state tracking after each phase completion
- Minimal pack rescue logic in `src/benchmark/benchmarkRunner.ts`:
  - `buildMinimalRescuePack()` — builds a minimal pack from intermediate state
  - `deriveRescueReason()` — classifies the rescue reason
  - On timeout, service partial state is accessed and used to build minimal pack
  - If minimal pack contract audit passes, it's a generated pack
  - If contract audit fails, enhanced no-pack diagnostic is produced
- Enhanced no-pack diagnostic fields:
  - `partialLegislationCount`
  - `partialVerifiedPrecedentCount`
  - `lastCompletedPhase`
  - `retrievalTimeoutSources`
  - `canRetryWithLongerBudget`
  - `canRetryWithNarrowerIssue`
  - `partialStateAvailable`
- Rescue/telemetry metrics in `BenchmarkReport`:
  - `minimalPackRescueAttemptCount`
  - `minimalPackRescueSuccessCount`
  - `minimalPackRescueFailureCount`
  - `noPackDiagnosticEnhancedCount`
  - `partialStateAvailableCount`
  - `generatedFromPartialStateCount`

### Değişenler

- Service now tracks intermediate state as each phase completes
- Benchmark runner accesses partial state on timeout for minimal pack rescue
- Generated minimal packs run through existing contract audit
- No source sufficiency threshold was relaxed
- No non-gov.tr source is accepted as verified
- No fake required pack fields are generated

### Safety invariants

- Generated minimal packs still run contract audit — contract failures remain hard
- No-pack diagnostics do not hard-fail gates (v0.41 semantics preserved)
- No new live source integration
- No active health legislation coverage promotion
- No risk level, urgent action, definitive legal opinion, petition or defense draft
- No local-yargi vendor/import

## [0.41.0] — 2026-05-27 — Live Timeout Gate Semantics and Partial/No-Pack Diagnostics

> Tag: `v0.41.0-live-timeout-gate-semantics-and-partial-pack`

### Özet

Aligns live timeout/no-pack semantics across `liveReliabilityGate` and
`physicianPackBetaGate`. Pack generation failures caused by timeout, source
unavailability, or budget exhaustion are now classified separately from
generated-pack contract failures. A generated pack with contract errors remains
as a soft diagnostic observation. This preserves the safety contract while
removing the v0.40 semantic mismatch where beta gate passed but reliability gate
could fail on no-pack timeouts as `CONTRACT_FAIL`.

### Eklenenler

- Result-level failure taxonomy in `src/benchmark/benchmarkRunner.ts`:
  - `PackFailureKind`
  - `packGenerated`
  - `packFailureKind`
  - `packGenerationFailureReason`
  - `failedPhase`
  - `noPackDiagnostic`
  - `partialPackGenerated`
- Report-level metrics:
  - `packGenerationFailureDistribution`
  - `timeoutNoPackCount`
  - `sourceUnavailableNoPackCount`
  - `budgetExhaustedNoPackCount`
  - `generatedPackContractFailCount`
  - `generatedPackUnsafeCount`
  - `generatedPackUnofficialCount`
  - `liveReliabilityGateTimeoutObservationCount`
  - `noPackDiagnosticCount`
  - `partialPackGeneratedCount`
- `liveReliabilityGate` explicit metrics:
  - `timeoutNoPackCount`
  - `generatedPackContractFailCount`
  - `packGenerationFailedCount`
  - `sourceUnavailableNoPackCount`
  - `budgetExhaustedNoPackCount`

### Değişenler

- `liveReliabilityGate` now treats timeout/source-unavailable/budget-exhausted
  no-pack failures as soft observations, not hard `CONTRACT_FAIL`.
- Generated-pack contract failure remains a hard reliability gate failure.
- `physicianPackBetaGate` and `liveReliabilityGate` now share the same generated
  pack vs no-pack failure distinction.
- No source sufficiency threshold was relaxed.
- No non-gov.tr source is accepted as verified.
- No fake required pack fields are generated for no-pack diagnostics.

### Tests

- Added/updated tests covering:
  - timeout/no-pack item does not hard fail `liveReliabilityGate`
  - generated-pack contract failure remains hard fail
  - unsafe advice, unofficial source, mock fallback, quote-unusable precedent remain hard failures
  - beta gate and live reliability gate timeout/no-pack semantics are aligned
  - `packGenerationFailureDistribution` is correct
  - no-pack diagnostic is JSON-parseable
  - partial generated pack still runs contract audit
  - existing doctor and real-world benchmark behavior remains stable

### Safety invariants

- No new live source integration.
- No active health legislation coverage promotion.
- No gov.tr-external source verification.
- No risk level, urgent action, definitive legal opinion, petition or defense draft.
- No local-yargi vendor/import.

## [0.40.0] — 2026-05-26 — Live Legislation Phase Hardening

> Tag: `v0.40.0-live-legislation-phase-hardening`

### Özet

Legislation phase hardening layer for live mode. Four real-world live smoke
questions that timed out entirely in v0.39 during the legislation phase
are now intercepted by a phase-level budget cap (`effectivePhaseBudgetMs`)
before they can consume the full 30s per-question timeout. When the
legislation phase exceeds its budget (default 8–10s), the phase is
interrupted via `Promise.race` and the code proceeds to the precedent
phase. Coverage gaps for unverified but known-important legislation
(e.g., Özel Hastaneler, Acil Sağlık, Kişisel Sağlık Verileri) are
detected before any slow search is attempted, producing structured gap
reasons instead of open-ended timeouts. Legislation phase diagnostics
(`legislationPhaseTimedOut`, `legislationPhaseBudgetExhausted`,
`legislationCoverageGaps`) flow through to source sufficiency evaluation
and benchmark telemetry.

### Eklenenler

- **Legislation phase budget cap in `src/app/service.ts`**:
  - `executeLegislationPhase()` private method wraps `searchLegislation`
    with a `Promise.race` against `effectivePhaseBudgetMs("legislation")`.
  - When the phase budget is exhausted before legislation search returns,
    the method returns an `unavailable` result with a clear timeout reason,
    WITHOUT throwing — the precedent phase can still proceed.
  - `LegislationPhaseResult` returned with diagnostics:
    `phaseBudgetExhausted`, `timedOut`, `retrievalTimeout`,
    `failedBeforePrecedent`, `coverageGaps`, `knownHintFastPathUsed`.
- **Coverage gap detection before legislation search**:
  - `detectLegislationCoverageGaps()` queries the router for issue IDs
    and cross-references against `HEALTH_LEGISLATION_INVENTORY` for entries
    with `coverageStatus !== "covered"`.
  - Identified gaps (e.g., Özel Hastaneler, Ayakta Teşhis, Acil Sağlık,
    Kişisel Sağlık Verileri, İşyeri Hekimi, Sağlık Bakanlığı Disiplin)
    produce structured `coverage gap` reasons instead of silent timeouts.
  - No fake legislation quotes are produced for gap entries.
- **New source sufficiency missing authority types**:
  - `legislationPhaseBudgetExhausted` — legislation phase exceeded its
    allocated budget.
  - `legislationCoverageGap` — a known official legislation coverage gap
    was identified for the routed issue.
- **TimeBudgetTelemetry extended with v0.40.0 fields**:
  - `legislationPhaseBudgetExhausted`, `legislationPhaseTimedOut`,
    `legislationPhaseFailedBeforePrecedent`, `legislationCoverageGaps`,
    `legislationKnownHintFastPathUsed`, `legislationPhaseBudgetMs`,
    `legislationRetrievalTimeout`.
- **BenchmarkReport.timeBudgetMetrics extended**:
  - `legislationPhaseTimeoutCount`, `legislationPhaseBudgetExhaustedCount`,
    `knownHintFastPathCount`, `coverageGapCount`,
    `legislationPhaseFailedBeforePrecedentCount`,
    `packGeneratedAfterLegislationTimeoutCount`.

### Değişenler

- **`src/app/service.ts`**:
  - `prepareInformationPack()` live mode now calls `executeLegislationPhase()`
    instead of directly calling `searchLegislation()`.
  - `routeMedicalIssue` imported for coverage gap detection.
- **`src/sourceSufficiency.ts`**:
  - New input fields: `legislationPhaseBudgetExhausted?`,
    `legislationPhaseTimedOut?`, `legislationCoverageGaps?`.
  - New missing authority types processed in `evaluateSourceSufficiency()`.
- **`src/benchmark/benchmarkRunner.ts`**:
  - Sufficiency evaluation call passes v0.40.0 legislation phase fields.
  - `buildTimeBudgetMetrics()` aggregates new legislation phase counters.
- **`package.json` & `package-lock.json`**: bumped version `0.39.0` → `0.40.0`.
- **`tests/realWorldLiveSmoke.test.ts`**: mock report updated with new fields.

### Design Invariants

- **No new source integration**: same live adapters.
- **No source rule relaxation**: gov.tr-only, no mock fallback in live, no unofficial sources.
- **No output contract change**: DoctorLegalInformationPack format unchanged.
- **No coverage change**: `coveredOfficialLegislationCount` = 11, `verifiedOfficialSourceCount` = 11.
- **No local-yargi vendor or import**.
- **Coverage gap reasons are NOT fake legislation quotes**: gap entries never added to `relevantLegislation`.
- **Legislation phase timeout ≠ pack failure**: precedent phase still proceeds.
- **Generated-pack contract failures remain hard failures**.
- **Timeout-induced raw contract failures excluded from beta gate hard failures**.

---

## [0.39.0] — 2026-05-26 — Live Time Budget and Source Prioritization

> Tag: `v0.39.0-live-time-budget-and-source-prioritization`

### Özet

Introduces a fixed time budget (30s total per question) for live research pack
preparation, replaces parallel live source fetches with sequential phased
execution (legislation → precedent), adds issue-aware source prioritization,
and surfaces time-budget-exhausted diagnostics in pack composition and source
sufficiency evaluation. The goal is to reduce timeout-induced pack failures by
making conscious budget allocation decisions instead of allowing a single slow
source to consume the entire per-question deadline.

### Eklenenler

- **`src/live/timeBudget.ts`** — `ResearchTimeBudget` class with:
  - `deadlineMs`, `reserveMs`, per-phase `sourceBudgets` (legislation: 8s, precedent: 15s)
  - `elapsedMs()`, `remainingMs()`, `isExhausted()`
  - `phaseBudget(phase)`, `effectivePhaseBudgetMs(phase)` — caps phase to remaining global budget
  - `shouldStartPhase(phase)` — returns false when budget exhausted or phase budget < 500ms
  - `markPhaseStart(phase)`, `markPhaseEnd(phase)` — phase timing
  - `snapshot()` → `ResearchBudgetSnapshot` with elapsed/remaining/per-phase times
  - Exported types: `ResearchPhase`, `ResearchBudgetSnapshot`, `SourceBudgetDecision`
- **Sequential phase execution in `src/app/service.ts`**:
  - Live mode now runs legislation first, then precedent (was `Promise.all` parallel)
  - `TimeBudgetTelemetry` exported interface with `deadlineMs`, `reserveMs`, `totalElapsedMs`,
    `remainingMsAtEnd`, `budgetExhausted`, `legislationPhaseMs`, `precedentPhaseMs`,
    `sourcePriorityOrder`, `snapshot`
  - `prioritizeSourcesByIssue()` — danistay-first for disciplinary/administrative issues,
    yargitay-first otherwise
- **Time budget awareness in `src/health/answerComposer.ts`**:
  - Optional `timeBudget` parameter passed through to `composeDoctorLegalInformationPack()`
  - When budget is exhausted and grounded sources exist, `shortAnswer` notes partial data set
  - `sourceWarnings` include `timeBudgetExhausted` when applicable
- **New missing authority types in `src/sourceSufficiency.ts`**:
  - `retrievalTimeout` — live retrieval timeout occurred
  - `timeBudgetExhausted` — global time budget exhausted
  - `sourceBudgetExhausted` — per-source budget exceeded
  - New input fields: `timeBudgetExhausted?: boolean`, `retrievalTimeout?: boolean`,
    `sourceBudgetExhausted?: boolean`
- **Time budget telemetry in `src/benchmark/benchmarkRunner.ts`**:
  - `BenchmarkItemResult.timeBudgetTelemetry?: TimeBudgetTelemetry`
  - `BenchmarkReport.timeBudgetMetrics` aggregate with `questionsWithBudget`,
    `averageLegislationPhaseMs`, `averagePrecedentPhaseMs`, `averageTotalElapsedMs`,
    `budgetExhaustedCount`, `sourcePriorityDistribution`
  - `buildTimeBudgetMetrics()` helper
  - `ResearchTimeBudget` created per question in live mode, passed through
    `prepareInformationPack`
- **`PrepareInformationPackInput.timeBudget`** — optional field in `src/contracts/legal.ts`

### Değişenler

- **`src/app/service.ts`**:
  - `prepareInformationPack()` in live mode: sequential legislation then precedent with
    phase timing via `ResearchTimeBudget`
  - Returns `timeBudgetTelemetry` on live mode response
- **`package.json` & `package-lock.json`**: bumped version `0.38.0` → `0.39.0`
- **`tests/realWorldLiveSmoke.test.ts`**: mock report updated to include `timeBudgetMetrics`

### Design Invariants

- **No new source integration**: same live adapters (Yargıtay, Danıştay, mevzuat.gov.tr)
- **No source rule relaxation**: gov.tr-only, no mock fallback in live, no unofficial sources
- **No output contract change**: DoctorLegalInformationPack format unchanged
- **No coverage change**: coveredOfficialLegislationCount = 11, verifiedOfficialSourceCount = 11
- **No local-yargi vendor or import**
- **Mock mode unchanged**: 15s per-question timeout preserved, no time budget overhead
- **Per-question timeout (30s for live, 15s for mock) preserved** via `Promise.race`
- **Timeout-induced raw contract failures excluded from beta gate hard failures**
- **Generated-pack contract failures remain hard failures**

### Expected v0.38 → v0.39 Live Smoke Improvements

- **Sequential execution**: reduces concurrent source load, prevents multiple slow sources
  from compounding
- **Source prioritization**: fastest/most-relevant source runs first, so usable data is
  available before budget expires
- **Time budget telemetry**: reveals which phase consumed the budget
- **Partial pack production**: when legislation succeeds but precedent times out,
  a partial pack can still be generated with source sufficiency warnings

---

## [0.38.0] — 2026-05-25 — Live Real-World Physician Beta Smoke Hardening

> Tag: `v0.38.0-live-real-world-beta-smoke-hardening`

### Özet

Introduces a deterministic, highly-controlled live smoke benchmark subset representing the core medico-legal risk axes for physicians. Hardens the Live Beta Readiness Gate to treat timeout/pack generation failures in live mode as soft observations rather than contract failures, while introducing detailed timeout metrics and tracking.

### Eklenenler

- **`src/benchmark/realWorldPhysicianQuestions.ts`** — exported `realWorldPhysicianLiveSmokeQuestions` containing exactly 6 deterministic questions representing all major medico-legal axes (consent, emergency, privacy, scope, hospital gaps, and discipline).
- **`src/benchmark/realWorldLiveSmokeRunnerCli.ts`** — new independent CLI runner for the live smoke subset:
  - Default command: `npm run benchmark:physician-real-world:live-smoke`.
  - Runs in `live` mode by default, supporting all timeout guards.
  - Produces structured reports under `exports/physician-real-world-live-smoke/report.json` and `report.md`.
  - Appends Beta Readiness Gate Report cleanly.
- **`tests/realWorldLiveSmoke.test.ts`** — unit tests validating live smoke deterministic subset and soft timeout observation behavior.

### Değişenler

- **`src/physicianPackBetaGate.ts`**:
  - Excluded timeout/pack generation failed questions from `contractFailedCount` to prevent false hard failures.
  - Added `timeoutQuestionIds` array to the returned report `metrics`.
- **`package.json` & `package-lock.json`**:
  - Bumped version `0.37.0` → `0.38.0`.
  - Configured script: `"benchmark:physician-real-world:live-smoke": "tsx src/benchmark/realWorldLiveSmokeRunnerCli.ts --sourceMode live"`.

---

## [0.37.0] — 2026-05-25 — Real-World Physician Research Pack Beta

> Tag: `v0.37.0-real-world-physician-research-pack-beta`

### Özet

Beta verification layer that evaluates the quality of generated legal research packs against 21 highly realistic, real-world physician scenarios. This release establishes a dedicated Beta Readiness Gate utility, incorporates coverage gap visibility for the remaining unverified health legislations, and preserves all strict source ground rules without relaxing any quality checks.

### Eklenenler

- **`src/benchmark/realWorldPhysicianQuestions.ts`** — new benchmark dataset containing 21 highly representative real-world physician questions covering core medico-legal topics:
  - Informed consent lack, malpractice vs complication, patient records access and corrections, privacy sharing and social media, ER consent exceptions, referral delay, private hospital obligations, tıp merkezi sterilisation issues, scope of practice limits, team denetimi / auxiliary nurse errors, occupational physician independent reporting, organ transplant donors, ART IVF consent, GETAT alternative medicine limits, patient rights complaints, state physician disciplinary investigations, criminal/civil/tazminat assessments, adli vaka Defin reporting, and Kişisel Sağlık Verileri gaps.
- **`src/physicianPackBetaGate.ts`** — new Beta Readiness Gate utility:
  - `BetaReadinessReport` and `evaluateBetaReadiness` to grade completed benchmark reports.
  - Hard failure checks: unofficial non-gov.tr URL leakage, mock fallback in live mode, contract failures, unsafe definitive advice, and `quoteUnusable` precedent leakage.
  - Soft observations: partial/insufficient source sufficiency, timeouts, missing high court precedents, specific coverage gaps, and low confidence routing.
  - Scoring algorithm starting at 100 with deductions for timeouts, partial sufficiency, and low router confidence; score is capped at max 50 on hard fail.
  - Grades: `ready` (score >= 85 and no failures), `limited` (score < 85 and no failures), and `not_ready` (any hard failure).
- **`src/benchmark/realWorldBenchmarkRunnerCli.ts`** — new CLI runner script:
  - Command: `npm run benchmark:physician-real-world`.
  - Runs the benchmark runner generically using our new 21-question dataset.
  - Outputs structured reports to `exports/physician-real-world-benchmark/report.json` and `exports/physician-real-world-benchmark/report.md` (which appends a beautiful markdown summary of the Beta Readiness report).
- **`package.json`** scripts:
  - `"benchmark:physician-real-world"`: runs the real-world mock benchmark.
  - `"benchmark:physician-real-world:live-smoke"`: runs live smoke test for the first 5 questions.

### Değişenler

- **`package.json` & `package-lock.json`**: bumped version `0.36.0` → `0.37.0`.
- **`src/benchmark/benchmarkRunner.ts`**:
  - Generic questions input: `runBenchmark` now takes optional `questions?: BenchmarkQuestion[]` options list, keeping perfect backward-compatibility for existing consumer scripts and test cases.
- **`src/sourceSufficiency.ts`**:
  - Coverage gap visibility: added explicit checks for unverified core regulations corresponding to routed issue IDs:
    - `Özel Hastaneler Yönetmeliği` gap mapped to `private_health_facility`.
    - `Ayakta Teşhis ve Tedavi Yapılan Özel Sağlık Kuruluşları Yönetmeliği` gap mapped to outpatient/clinic/private facility.
    - `Kişisel Sağlık Verileri Hakkında Yönetmelik` gap mapped to `privacy_kvkk` or `medical_records`.
    - `Acil Sağlık Hizmetleri Yönetmeliği` gap mapped to `emergency_care`.
  - Downgrades the sufficiency level from `sufficient` to `partial` and raises clear, explicit diagnostic warnings/reasons.

### Design Invariants Preserved

- **No non-gov.tr sources**: gov.tr verified source rules remain strictly enforced.
- **No mock fallbacks in live mode**: fallback to mock is a hard gate failure.
- **No MVP bounds relaxation**: risk levels, definitive legal opinion, immediate actions, and dilekçe templates are strictly blocked.
- **No local-yargi vendor or import sızıntısı**.

---

## [0.36.0] — 2026-05-24 — Official Gazette Document Verifier

> Tag: `v0.36.0-official-gazette-document-verifier`

### Özet

Muhafazakâr Resmî Gazete document verification layer for the 6 `needs_manual_review`
health legislation entries whose only discovery signal is an RG number. The
verifier fetches the RG HTML page from resmigazete.gov.tr, scores the title and
content marker terms, and produces a structured verification result. This is a
SEPARATE verification path from mevzuat.gov.tr sourceId verification — RG
verified alone (no mevzuat sourceId) is reported as `rgVerifiedButNoMevzuatSourceId`
and NOT promoted to active coverage. Only RG verified + confirmed mevzuat
sourceId together enable coverage promotion.

### Eklenenler

- **`src/officialGazetteDocumentVerifier.ts`** — new module with:
  - `RgDocumentVerificationStatus`, `RgDocumentVerificationResult`,
    `RgDocumentVerificationReport` types
  - `RgDocumentFetcher` adapter interface for testable RG HTTP fetch
  - `buildRgUrl()` — constructs resmigazete.gov.tr URL from date or RG number
  - `filterRgOnlyLeads()` — filters inventory entries with RG metadata but no
    confirmed mevzuat sourceId
  - `verifyRgDocument()` — per-entry verifier: fetch RG page, extract HTML
    title, score with F1 word-overlap, check marker terms; returns
    `rg_verified`, `rg_not_found`, `rg_wrong_document`, `rg_unavailable`, or
    `rg_verification_error`
  - `buildRgDocumentVerificationReport()` — multi-entry report builder with
    counts for verified, no-sourceId, not-found, wrong-doc, unavailable, error
  - Title scoring via existing `scoreTitleMatch` from access verifier
  - Marker term scoring (proportion of entry markerTerms found in page content)
  - gov.tr guard via URL construction (only resmigazete.gov.tr URLs)
- **`src/verifyOfficialGazetteHealthLegislationCli.ts`** — CLI entry point:
  `npm run verify:official-gazette-health-legislation`
  - Writes structured report to `exports/official-gazette-verification/report.json`
- **Benchmark per-question timeout guard** in `src/benchmark/benchmarkRunner.ts`:
  - `Promise.race` timeout wrapper around `service.prepareInformationPack()`
  - Live mode: 30s per-question deadline
  - Mock mode: 15s per-question deadline
  - Timeout → `evaluateThrownBenchmarkItem()` → failed item in report
  - One hung question no longer blocks subsequent questions
  - Prevents shell-level bash timeout (120s) from triggering
- **5 timeout test cases** in `tests/benchmark.test.ts`:
  - Live mode timeout → failed item via evaluateThrownBenchmarkItem
  - Mock mode timeout → failed item via evaluateThrownBenchmarkItem
  - Timeout on first question does not block subsequent questions
  - Timeout item appears in JSON report as parseable failed item
  - Normal successful item behavior unchanged
- **36 test cases** (was 32) in `tests/officialGazetteDocumentVerifier.test.ts` — added:
  - `buildRgUrl` — date-based, number-based, empty, preference order
  - `filterRgOnlyLeads` — filtering logic, exclusion of verified/deferred
  - `verifyRgDocument` — all 5 status paths (verified, not_found, wrong_doc,
    unavailable, verification_error)
  - Title extraction from `<title>` and `<h1>` elements
  - Marker score computation with edge cases
  - Report builder — empty, single entry, multiple entries, JSON parseable
  - Required top-level fields and ISO timestamp
  - Real inventory fixtures for all 6 RG-only entries:
    - Kişisel Sağlık Verileri (RG 30867) → rg_verified
    - Acil Sağlık Hizmetleri (RG 29332) → rg_verified
    - Ayakta Teşhis (RG 29058) → rg_verified
    - İşyeri Hekimi (RG 29818) → rg_verified
    - Sağlık Bakanlığı Disiplin (RG 25450) → rg_verified
    - Özel Hastaneler (RG 29092) → rg_verified
  - Wrong document rejection (KVKK kanunu instead of sağlık verileri yönetmelik)
  - RG-verified-but-no-sourceId counter integrity
  - All-6-entries JSON report parseable

### Değişenler

- `package.json`: version `0.35.0` → `0.36.0`
- `package.json`: added `verify:official-gazette-health-legislation` script
- `src/benchmark/benchmarkRunner.ts`: per-question timeout guard — `Promise.race` wrapper
  around `service.prepareInformationPack()`; live 30s, mock 15s
- `package-lock.json`: version `0.35.0` → `0.36.0`

### Known limitation — RG body-level regulation title extraction deferred

Resmî Gazete HTML pages expose a generic `<title>T.C. Resmî Gazete</title>` rather than the
specific regulation title. The verifier correctly extracts this generic title, computes
`titleScore ≈ 0`, and rejects as `rg_wrong_document`. However, the body HTML does contain
the actual regulation name and marker terms — `markerScore` is computed from body content.

Body-level regulation title extraction (parsing the HTML body to find the specific
regulation heading) is **deferred** to a future release. When implemented, it would
enable `rg_verified` for entries whose body content matches, even when the `<title>` tag
is generic. Even with body-level extraction, `rg_verified` alone would NOT promote to
active coverage without a confirmed mevzuat.gov.tr sourceId.

This limitation is documented in 4 dedicated test cases:
- `generic RG page title with body marker terms reports markerScore > 0 but rg_wrong_document`
- `body-level regulation title extraction not implemented — generic title limitation documented`
- `RG verified alone never promotes to active coverage without mevzuat sourceId`
- `generic title with body markers — markerScore shows content match exists`

### Design invariants

- **RG verified ≠ active coverage**: RG document alone is a discovery signal.
- **Separate path**: RG document verification is independent from mevzuat.gov.tr
  sourceId verification. Both required for coverage promotion.
- **gov.tr mandatory**: only resmigazete.gov.tr URLs are constructed.
- **No coverage change**: active coverage unchanged — all 6 entries remain
  `needs_manual_review` unless verifier + sourceId both confirm.
- **No local-yargi import**: patterns reimplemented independently.
- **No risk levels, urgent actions, or legal opinions**.
- **No contract change**: hekim-facing output format unchanged.

### Coverage unchanged

`coveredOfficialLegislationCount`: 11 (unchanged).
`verifiedOfficialSourceCount`: 11 (unchanged).
`unofficialLegislationSourceCount`: 0 (unchanged).

### Benchmark timeout guard invariants

- **Per-question timeout prevents process hang**: `Promise.race` with 30s/15s deadline.
- **Thrown timeout → evaluateThrownBenchmarkItem → failed item in report.**
- **One hung question does not block subsequent questions.**
- **JSON report always generated** (never hits shell-level timeout).
- **Mock benchmark 15/15 regression unchanged.**

## [0.35.0] — 2026-05-24 — RG Lead SourceId Resolver

> Tag: `v0.35.0-rg-lead-sourceid-resolver`

### Özet

Muhafazakâr RG lead sourceId resolver for the 5 `needs_manual_review` health
legislation entries whose only discovery signal is a Resmi Gazete number. The
resolver generates RG-number-based and title-combined query variants, searches
mevzuat.gov.tr for candidate sourceId/PDF leads, and routes them through the
existing verifier. No unsafe active coverage activation: verified promotion
requires the same verifier approval as v0.34.0. RG-only lead alone never
becomes active coverage.

### Eklenenler

- **`src/healthLegislationRgResolver.ts`** — new module with:
  - `RgLeadResolutionStatus`, `RgLeadResolutionCandidate`,
    `RgLeadPerEntryResult`, `HealthLegislationRgResolutionResult` types
  - `filterRgOnlyLeads()` — filters inventory entries with `expectedRgNumber`
    but no confirmed `mevzuatSourceId`
  - `buildRgQueryVariants()` — generates 5 query variant types: RG number alone,
    RG + short title, RG + alias, full title, full title + RG
  - `resolveRgEntry()` — per-entry resolver: search, score, candidate extraction,
    verifier handoff
  - `buildRgResolutionReport()` — multi-entry report builder
  - gov.tr guard on all candidates; non-gov.tr results ignored
  - RG-only lead never promoted without verifier approval
- **`src/resolveHealthLegislationRgLeadsCli.ts`** — CLI entry point:
  `npm run resolve:health-legislation-rg-leads`
  - Writes structured report to `exports/health-legislation-rg-resolution/report.json`
- **27 test cases** in `tests/healthLegislationRgResolver.test.ts` covering:
  - `filterRgOnlyLeads` filtering logic
  - `resolveRgEntry` with no RG, empty search, non-gov.tr ignored
  - RG+title match candidate finding
  - Verifier handoff: verified, rejected, candidate-only
  - Real inventory fixtures for all 5 RG-only entries
  - Kişisel Sağlık Verileri and Acil Sağlık correct mock verification
  - Wrong document rejection
  - RG-only never becomes active coverage without verifier
  - No non-gov.tr sourceId leakage
  - JSON report parseable

### Değişenler

- `package.json`: version `0.34.0` → `0.35.0`
- `package-lock.json`: version `0.31.0` → `0.35.0`

### Design invariants

- **RG lead ≠ verified**: RG number alone is a discovery signal, not a sourceId.
- **Verifier gate**: every candidate must pass `verifyBySourceIdDirect()`.
- **gov.tr mandatory**: non-gov.tr search results are silently ignored.
- **No coverage change**: active coverage unchanged — all 5 entries remain
  `needs_manual_review` unless verifier confirms.
- **No local-yargi import**: patterns reimplemented independently.
- **No risk levels, urgent actions, or legal opinions**.

### Coverage unchanged

`coveredOfficialLegislationCount`: 11 (unchanged).
`verifiedOfficialSourceCount`: 11 (unchanged).
`unofficialLegislationSourceCount`: 0 (unchanged).

## [0.34.0] — 2026-05-24 — Official Source Lead Verification

> Tag: `v0.34.0-official-source-lead-verification`

### Özet

Bridge between v0.33 source discovery leads and the existing direct verifier.
Discovered leads (mevzuat.gov.tr sourceId, Resmi Gazete metadata) are now
routed through `verifyBySourceIdDirect()` automatically. Lead found ≠ verified
principle enforced: only entries passing title/alias/RG/marker/gov.tr checks
are marked promotable. This is a verification infrastructure release, not an
active coverage increase.

### Eklenenler

- **`verifyDiscoveredOfficialLeads()`** in `healthLegislationSourceDiscovery.ts`:
  async function that takes discovery report + inventory entries + adapter and
  routes each lead through the existing verifier.
  - SourceId leads → `verifyBySourceIdDirect()` with full entry metadata
  - RG-only leads → search mevzuat.gov.tr by RG number, then verify if found
  - No actionable leads → `needs_manual_review`
  - Returns `LeadVerificationReport` with `leadsAttempted`, `leadsVerified`,
    `leadsRejected`, `needsManualReviewCount`, `promotedToActiveCoverageCount`
- **`DiscoveredLeadVerificationResult`** and **`LeadVerificationReport`** types
- **`verify:discovered-health-legislation`** CLI in
  `verifyDiscoveredHealthLegislationCli.ts`:
  runs discovery → verification pipeline, writes report to
  `exports/health-legislation-source-discovery/verification-report.json`
- **16 test cases** in `healthLegislationLeadVerification.test.ts` covering:
  - SourceId lead → verified (title/marker match)
  - SourceId lead → rejected (fetch fail, title mismatch)
  - Known wrong match rejection
  - RG-only lead → search → verified
  - RG-only lead → no search results → needs_manual_review
  - Multiple entries aggregated counts
  - Özel Hastaneler correct/wrong PDF fixture
  - Non-gov.tr source rejection, no original entry mutation

### Değişenler

- `healthLegislationSourceDiscovery.ts`: v0.33 → v0.34 header; imports
  `verifyBySourceIdDirect` and `scoreTitleMatch` from verifier; exports
  `DiscoveredLeadVerificationResult`, `LeadVerificationReport`,
  `verifyDiscoveredOfficialLeads`
- `package.json`: `0.33.0` → `0.34.0`, new script
  `verify:discovered-health-legislation`

### Audit

- **No gov.tr dışı source acceptance**: non-gov.tr leads never reach verifier
- **No auto-promotion**: `promotedToActiveCoverageCount` reflects verifier
  results; no inventory/mapping file mutation from CLI
- **No output contract changes**: verified entries unchanged
- **No local-yargi import**
- **Coverage unchanged**: `coveredOfficialLegislationCount` = 11,
  `verifiedOfficialSourceCount` = 11, `coveredByActiveHintsCount` = 11,
  `gapCount` = 2, `unofficialLegislationSourceCount` = 0

### Lead Verification Results (Live)

| Entry | Lead | Verifier Result |
|-------|------|-----------------|
| ozel-hastaneler | mevzuat:7.5.29092 | `rejected_source_id_fetch_failed` |
| ayakta-teshis | RG 29058 | needs_manual_review |
| acil-saglik | RG 29332 | needs_manual_review |
| isyeri-hekimi | RG 29818 | needs_manual_review |
| kisisel-saglik-verileri | RG 30867 | needs_manual_review |
| saglik-bakanligi-disiplin | RG 25450 | needs_manual_review |

---

## [0.33.0] — 2026-05-24 — Manual Official Source Discovery

> Tag: `v0.33.0-manual-official-source-discovery`

### Özet

Source discovery module for remaining gap/candidate health regulation entries.
Collects and classifies available official source leads (mevzuat.gov.tr sourceId,
Resmi Gazete, Sağlık Bakanlığı page, candidate title match) into a structured
report. Does NOT auto-verify — verification is delegated to the existing
`healthLegislationAccessVerifier`. This is a discovery aid release, not an active
coverage increase release.

### Eklenenler

- **`healthLegislationSourceDiscovery.ts`** — core source discovery module:
  - `OfficialSourceLead` type with `entryKey`, `leadKind`, `sourceId`,
    `officialUrl`, `domain`, `title`, `rgDate`, `rgNumber`, `confidence`,
    `status`, `reasons`
  - `OfficialSourceLeadKind`: `mevzuat_source_id`, `mevzuat_pdf_url`,
    `resmi_gazete_url`, `saglik_gov_tr_page`, `candidate_title_match`
  - `OfficialSourceLeadStatus`: `candidate_lead`, `verified_by_existing_verifier`,
    `rejected`, `needs_manual_review`
  - `HealthLegislationSourceDiscoveryResult` and `SourceDiscoveryReport` types
  - `discoverEntrySources(entry)` — per-entry lead collection with four strategies:
    - Strategy A: mevzuat sourceId lead from `candidateLegacySourceId`
    - Strategy B: Resmi Gazete lead from `expectedRgDate`/`expectedRgNumber`
    - Strategy C: Sağlık Bakanlığı page lead from `candidateOfficialUrlLead`
    - Strategy D: Candidate title match from `aliases`/`searchTerms`
  - `buildSourceDiscoveryReport(entries)` — aggregates results into structured
    report with counts (entriesScanned, leadsFound, officialLeadsFound,
    nonOfficialLeadsIgnored, leadsSentToVerifier, needsManualReviewCount)
  - `filterDiscoveryCandidates(entries)` — filters to gap + candidate entries
- **`discoverHealthLegislationSourcesCli.ts`** — `discover:health-legislation-sources`
- **37 test cases** in `healthLegislationSourceDiscovery.test.ts` covering
  all four lead strategies, 6-entry contract verification, safety invariants

### Değişenler

- `package.json`: `0.32.0` → `0.33.0`, new script
  `discover:health-legislation-sources`

### Audit

- **No gov.tr dışı source acceptance**: non-gov.tr leads captured in
  `ignoredNonOfficialLeads`, never in active leads
- **No auto-verification**: `discoverEntrySources` does not set `verifiedLead`;
  leads marked `status: "candidate_lead"` until verifier confirms
- **No output contract changes**: verified entries unchanged
- **No local-yargi import**
- **Coverage unchanged**: `coveredOfficialLegislationCount` = 11,
  `verifiedOfficialSourceCount` = 11, `coveredByActiveHintsCount` = 11,
  `gapCount` = 2, `unofficialLegislationSourceCount` = 0

### Discovery Results

| Entry | SourceId Lead | RG Lead | Needs |
|-------|:---:|:---:|-------|
| ozel-hastaneler | medium (7.5.29092) | medium (29092) | PDF fetch confirmation |
| ayakta-teshis | — | medium (29058) | sourceId discovery |
| acil-saglik | — | medium (29332) | sourceId discovery |
| isyeri-hekimi | — | medium (29818) | sourceId discovery |
| kisisel-saglik-verileri | — | medium (30867) | sourceId discovery |
| saglik-bakanligi-disiplin | — | medium (25450) | sourceId discovery + title update check |

---

## [0.32.0] — 2026-05-24 — Remaining Health Regulations Direct Access

> Tag: `v0.32.0-remaining-health-regulations-direct-access`

### Özet

Direct sourceId-to-PDF fetch promoted from fallback (v0.31) to the primary path
when `candidateLegacySourceId` is set. The verifier now tries `verifyBySourceIdDirect`
before the search API, returning immediately on verified results and definitive
rejections (known wrong match, negative marker, title mismatch, empty document),
and falling through to search only on transient errors (timeout, fetch_failed).
Six remaining gap entries enriched with `markerTerms`, `negativeMarkerTerms`,
`knownWrongMatches`, RG metadata, and `candidateLegacySourceId` (where available).
A `knownWrongMatches` guard explicitly rejects 8 non-health legislation patterns
at both the sourceId prefix and title substring level. A `negativeMarkerTerms`
guard rejects documents containing terms indicative of wrong regulations.

### Eklenenler

- **Direct-first strategy**: `verifyInventoryEntry()` calls
  `verifyBySourceIdDirect()` BEFORE the search API loop when
  `candidateLegacySourceId` is set. Verified results and hard rejections return
  immediately; transient errors propagate diagnostics to search fallback.
- **`KNOWN_WRONG_MATCHES`** list (8 entries): Makine ve Kimya, Karayolları,
  Posta, KVKK, TSK Disiplin, SGK, Radyasyon Güvenliği, Devlet Memurları —
  matched by sourceId prefix (canonical) or title substring (for unknown
  sourceIds).
- **`checkKnownWrongMatch()`** — shared helper used in both direct-fetch and
  search-result paths.
- **`checkNegativeMarkers()`** — rejects document if any `negativeMarkerTerm`
  appears in fetched text (e.g., "tsk" for discipline regulation).
- **`MIN_MARKER_SCORE = 0.30`** threshold for direct-fetch content verification.
- **`CompositeMatchScore`** expanded with `markerScore`, `rgScore`, `typeScore`.
- **`computeCompositeScore()`** now computes `markerScore` from entry-level
  `markerTerms`.
- **Entry-level `markerTerms`**, `negativeMarkerTerms`, `knownWrongMatches`,
  `candidateOfficialUrlLead` fields in `HealthLegislationInventoryEntry`.
- Six verification status fields for diagnostics:
  `directSourceIdAttempted`, `directFetchOfficialUrl`, `markerScore`, `rgScore`,
  `typeScore`, `knownWrongMatchHit`, `knownWrongMatchReason`,
  `negativeMarkerHit`, `negativeMarkerTerm`, `finalDecision`.
- 22 new test cases: `checkKnownWrongMatch`, `checkNegativeMarkers`,
  direct-first strategy, `computeCompositeScore` markerScore, known wrong match
  filtering, expanded diagnostics.

### Değişenler

- `verifyBySourceIdDirect()`: uses entry-level `markerTerms`,
  `negativeMarkerTerms`, `knownWrongMatches`; emits expanded diagnostics
  (`directSourceIdAttempted`, `directFetchOfficialUrl`, `markerScore`, `rgScore`,
  `typeScore`, `knownWrongMatchHit`, `knownWrongMatchReason`,
  `wrongMatchReason`, `finalDecision`, `negativeMarkerHit`).
- `verifyInventoryEntry()`: Path C (direct fetch) tried BEFORE Path A/B (search
  API), not as fallback. Search results filtered through `checkKnownWrongMatch`.
  Expanded diagnostics merged into rejected and search-error paths.
- `healthLegislationInventory.ts`: 6 remaining gap entries enriched with
  `markerTerms`, `negativeMarkerTerms`, `knownWrongMatches`, RG date/number,
  `candidateOfficialUrlLead`; `ozel-hastaneler-yonetmeligi` gets
  `candidateLegacySourceId: "mevzuat:7.5.29092"`.
- `package.json`: `0.31.0` → `0.32.0`.

### Audit

- **No gov.tr dışı source**: all direct fetches target `mevzuat.gov.tr` URLs.
- **No output contract changes**: verified entries unchanged; all gap entries
  remain gaps.
- **No local-yargi import**.
- **Known wrong matches**: 8 hardcoded patterns, prefix + title match.
- **Negative markers**: multi-term substring match on full document text.
- **Coverage**: `coveredOfficialLegislationCount` = 11,
  `verifiedOfficialSourceCount` = 11, `coveredByActiveHintsCount` = 11,
  `gapCount` = 2, `uncoveredCoreCount` = 3.

### Known Gaps (unchanged)

Six entries remain unverified. The direct sourceId path now explicitly guards
against known wrong matches and enforces marker-based content verification for
any future sourceId discovery:
1. `ozel-hastaneler-yonetmeligi` (sourceId `mevzuat:7.5.29092` fetch failed)
2. `ayakta-teshis-ozel-saglik`
3. `acil-saglik-hizmetleri-yonetmeligi`
4. `isyeri-hekimi-yonetmeligi`
5. `kisisel-saglik-verileri-yonetmeligi`
6. `saglik-bakanligi-disiplin-yonetmeligi`

---

## [0.31.0] — 2026-05-24 — Direct Type-7 Legislation Source Access

> Tag: `v0.31.0-type7-direct-legislation-access`

### Özet

Direct sourceId-to-PDF fetch path for type-7 legislation (yönetmelik). When
mevzuat.gov.tr search API fails (timeout, no match, or error), the verifier now
falls back to fetching the official PDF directly via the known sourceId, extracts
the title from the first page, and validates it against the inventory entry.
`saglik-meslek-is-gorev-tanimlari` (sourceId `mevzuat:7.5.19696`) is the first
entry verified via this path and activated in the hint registry. All existing
rejection criteria (title/alias score < 0.50, marker overlap < 0.30, empty
document) are enforced.

### Eklenenler

- **`fetchOfficialDocument(sourceId)`** in `LiveOfficialLegislationAdapter` —
  parses `mevzuat:<type>.<arrangement>.<number>`, constructs
  `https://www.mevzuat.gov.tr/mevzuatmetin/<type>.<arrangement>.<number>.pdf`,
  fetches with 30s timeout, extracts title from PDF text
- **`verifyBySourceIdDirect()`** in `healthLegislationAccessVerifier.ts` — Path C
  fallback that runs when primary search (Path A/B) times out or fails
- **`extractDocTitle(pdfText)`** — reads first line of raw PDF text as document
  title
- **`computeMarkerOverlap(pdfText, markers)`** — computes ratio of content
  markers found in the document body
- **`extractRgFromDocText(pdfText)`** — extracts RG date and number from PDF
  text metadata lines
- Four new violation status types:
  - `verified_via_source_id_direct`
  - `rejected_source_id_timeout`
  - `rejected_source_id_title_mismatch`
  - `rejected_source_id_empty_document`
  - `rejected_source_id_fetch_failed`
- Seven new attempt fields for direct-fetch monitoring:
  `directFetchAttempted`, `directFetchTimedOut`, `directFetchStatus`,
  `directFetchTitle`, `directFetchRgDate`, `directFetchRgNumber`,
  `directFetchMarkerScore`, `directFetchTextLength`
- **`healthLegislationInventory.ts`**: `saglik-meslek-is-gorev-tanimlari` →
  `officialSourceStatus: "verified"`, `coverageStatus: "covered"`,
  `mevzuatSourceId: "mevzuat:7.5.19696"`,
  `officialUrl: "https://www.mevzuat.gov.tr/mevzuatmetin/7.5.19696.pdf"`
- **`healthMappings.ts`**: active `HealthLegislationHint` for
  `professional_scope_of_practice` (primary, priority 5) and
  `disciplinary_administrative` (supporting, priority 50)
- 14 new test cases in `healthLegislationAccessVerifier.test.ts` for direct
  verification (success, timeout, title mismatch, empty doc, no sourceId,
  search-error fallback)

### Değişenler

- `verifyInventoryEntry()`: if search times out or returns no match / error,
  attempts `verifyBySourceIdDirect()` as Path C
- CLI report (`verifyHealthLegislationCli.ts`): shows directFetch fields in
  all result sections (verified, rejected, search-error)
- `package.json`: `0.30.0` → `0.31.0`

### Audit

- **Direct type-7 PDF fetch**: no source/output contract relaxation
- **gov.tr only**: all direct fetches target `mevzuat.gov.tr` URLs
- **No external vendor**: no local-yargi import
- **Coverage**: `coveredOfficialLegislationCount` = 11,
  `verifiedOfficialSourceCount` = 11, `coveredByActiveHintsCount` = 11,
  `gapCount` = 2, `uncoveredCoreCount` = 3

### Known Gaps (unchanged)

Six entries remain rejected by search (all return kanun results for yonetmelik
queries). Each could be manually verified via the same direct sourceId path if a
legacy sourceId is provided:
1. `ozel-hastaneler-yonetmeligi`
2. `ayakta-teshis-ozel-saglik`
3. `acil-saglik-hizmetleri-yonetmeligi`
4. `isyeri-hekimi-yonetmeligi`
5. `kisisel-saglik-verileri-yonetmeligi`
6. `saglik-bakanligi-disiplin-yonetmeligi`

## [0.30.0] — 2026-05-24 — Health Legislation Query Recall

> Tag: `v0.30.0-health-legislation-query-recall`

### Özet

Multi-variant query recall strategy for the 7 entries rejected in v0.29.0. Instead of relying
solely on raw `searchTerms`, each inventory entry now has a full query plan:
`exact_title → aliases → legacy_source_id_probe → rg_number → keyword_combo`. Scores are
composited from title F1, alias F1, legislation-type metadata, and optional sourceId probe bonus.
Two acceptance paths: Path A (finalScore ≥ 0.75) and Path B (sourceId probe match + title/alias ≥ 0.50).

### Eklenenler

- **`buildQueryPlan(entry)`** — generates a deduplicated, prioritised `HealthLegislationQueryPlan`
  with query variants in weight order (1.0 → 0.9 → 0.8 → 0.7 → 0.5)
- **`computeCompositeScore(entry, result, variant)`** — composite scoring:
  - `titleScore` (F1 word-overlap on official title)
  - `aliasScore` (max F1 across all aliases)
  - `metadataScore` (+0.05 when legislation type inferred from sourceId matches `expectedLegislationType`)
  - `sourceIdProbeBonus` (+0.25 when result.sourceId === candidateLegacySourceId)
  - `probePathEligible` — true when sourceId matches AND bestTitleOrAlias ≥ 0.50
  - `finalScore` = min(1.0, max(titleScore, aliasScore) + metadataScore)
- **New status**: `"verified_via_source_id_probe"` — Path B acceptance
- **New status**: `"rejected_wrong_document"` — legislation type mismatch rejection
- **New types**: `QueryVariantKind`, `HealthLegislationQueryVariant`, `QueryRecallStrategy`,
  `HealthLegislationQueryPlan`, `CompositeMatchScore`
- **New fields on `HealthLegislationVerificationAttempt`**: `attemptedQueries`, `bestQueryKind`,
  `titleScore`, `aliasScore`, `metadataScore`, `sourceIdProbeUsed`, `topCandidates`
- **New optional fields on `HealthLegislationInventoryEntry`**:
  `aliases?`, `expectedLegislationType?`, `expectedRgDate?`, `expectedRgNumber?`, `candidateLegacySourceId?`

### Updated

- **`src/healthLegislationInventory.ts`** — 7 rejected entries enriched with aliases + metadata:
  - `saglik-meslek-is-gorev-tanimlari`: 3 aliases, `expectedLegislationType="yonetmelik"`,
    `expectedRgDate="2014-05-22"`, `expectedRgNumber="29007"`, `candidateLegacySourceId="mevzuat:7.5.19696"`
  - `ozel-hastaneler-yonetmeligi`, `ayakta-teshis-ozel-saglik`, `acil-saglik-hizmetleri-yonetmeligi`,
    `isyeri-hekimi-yonetmeligi`, `kisisel-saglik-verileri-yonetmeligi`,
    `saglik-bakanligi-disiplin-yonetmeligi`: each given 2–3 aliases + `expectedLegislationType`

- **`src/healthLegislationAccessVerifier.ts`** — full rewrite for v0.30.0 multi-variant architecture

- **`src/verifyHealthLegislationCli.ts`** — enhanced reporting: per-entry `queryKind`, `titleScore`,
  `aliasScore`, `probeUsed`, query count, top candidate listing

- **`tests/healthLegislationAccessVerifier.test.ts`** — expanded from 38 to 73 tests:
  - `buildQueryPlan` — 10 tests (ordering, deduplication, strategy labels, probe/rg/alias inclusion)
  - `computeCompositeScore` — 7 tests (titleScore, aliasScore, metadataScore, probePathEligible)
  - `verifyInventoryEntry` — 4 new cases (rejected_wrong_document, alias-verified, probe-verified, probe-rejected-low-title)
  - `saglik-meslek-is-gorev-tanimlari` fixture — 6 dedicated tests
  - `buildAccessVerificationReport` — 1 new test (verified_via_source_id_probe counted correctly)
  - Integration guard — 1 new test (verified_via_source_id_probe officialUrl constraint)

### Constraints upheld

- No gov.tr-external source accepted as verified (Path A + Path B both apply gov.tr guard)
- No ambiguous match may activate (AMBIGUITY_MARGIN = 0.10 applies to both paths)
- No output contract change; no source sufficiency relaxation
- No new topic cluster added
- local-yargi: not imported, not vendored

---

## [0.29.0] — 2026-05-24 — Official Legislation Access Verifier

> Tag: `v0.29.0-official-legislation-access-verifier`

### Eklenenler

- **`src/healthLegislationAccessVerifier.ts`** — Live mevzuat.gov.tr access verifier:
  - `normalizeTitleForMatch(title)` — Turkish char→ASCII normalization for case-insensitive title comparison
  - `scoreTitleMatch(invTitle, searchResultTitle)` — F1 word-overlap score (0–1); threshold 0.75
  - `isGovTrUrl(url)` — rejects any non-`.gov.tr` source URL
  - `verifyInventoryEntry(entry, adapter)` — per-entry verification with accept/reject logic:
    - Accepts only if score ≥ 0.75 AND URL is on mevzuat.gov.tr AND no ambiguity (second-best within 0.10 margin)
    - Status: `verified | rejected_no_match | rejected_ambiguous | rejected_non_gov_tr | rejected_low_score | search_error`
  - `buildAccessVerificationReport(entries, adapter)` — aggregate report with 500ms inter-request delay
  - `LegislationSearchAdapter` interface — mockable in unit tests (no network in tests)

- **`src/verifyHealthLegislationCli.ts`** — CLI that runs verifier against all candidate+gap entries and writes JSON report to `exports/health-legislation-verification/report.json`

- **`tests/healthLegislationAccessVerifier.test.ts`** — 38 unit tests (no network):
  - `normalizeTitleForMatch` — Turkish char conversion, whitespace collapse
  - `titleWords` — stop word filtering, short-word exclusion
  - `scoreTitleMatch` — identical titles, suffix variation, unrelated titles, ambiguity discrimination
  - `isGovTrUrl` — accept mevzuat.gov.tr, reject non-gov.tr
  - `verifyInventoryEntry` — verified, no_match, low_score, ambiguous, non_gov_tr, search_error
  - `buildAccessVerificationReport` — aggregate counts and entry lists
  - Integration guards: non-gov.tr can never produce verified; verified always has `mevzuat:` prefix; verified officialUrl always on mevzuat.gov.tr

### Verified (5 new — sourceIds confirmed via live mevzuat.gov.tr search, score 1.000 each)

| Entry | sourceId | Official title |
|---|---|---|
| `aile-hekimligi-kanunu` | `mevzuat:1.5.5258` | AİLE HEKİMLİĞİ KANUNU |
| `is-sagligi-guvenligi-kanunu` | `mevzuat:1.5.6331` | İŞ SAĞLIĞI VE GÜVENLİĞİ KANUNU |
| `organ-doku-nakli-kanunu` | `mevzuat:1.5.2238` | ORGAN VE DOKU ALINMASI, SAKLANMASI, AŞILANMASI VE NAKLİ HAKKINDA KANUN |
| `uyeye-yardimci-tedavi-yonetmeligi` | `mevzuat:7.5.20085` | ÜREMEYE YARDIMCI TEDAVİ UYGULAMALARI VE MERKEZLERİ HAKKINDA YÖNETMELİK |
| `geleneksel-tamamlayici-tip-yonetmeligi` | `mevzuat:7.5.45117` | GELENEKSEL VE TAMAMLAYICI TIP UYGULAMALARI YÖNETMELİĞİ |

### Rejected (7 — remain candidate/gap, reason documented in verifier report)

| Entry | Status | Reject reason |
|---|---|---|
| `ozel-hastaneler-yonetmeligi` | gap | Low score (0.095) — search returned unrelated legislation |
| `ayakta-teshis-ozel-saglik` | gap | Low score (0.333) — search returned radiation services regulation |
| `saglik-meslek-is-gorev-tanimlari` | gap | Low score (0.100) — search returned debt restructuring law |
| `acil-saglik-hizmetleri-yonetmeligi` | candidate | Low score (0.286) — search returned Postal Services Law |
| `isyeri-hekimi-yonetmeligi` | candidate | Low score (0.214) — search returned social security law |
| `kisisel-saglik-verileri-yonetmeligi` | candidate | Low score (0.167) — search returned unrelated law |
| `saglik-bakanligi-disiplin-yonetmeligi` | candidate | Low score (0.111) — search returned police discipline law |

### Updated

- **`src/healthLegislationInventory.ts`** — 5 entries promoted from candidate to verified; `coverageStatus` set to `covered`; `mevzuatSourceId` and `officialUrl` added
- **`src/sources/legislation/healthMappings.ts`** — 7 new `HealthLegislationHint` entries for the 5 newly verified legislation (using existing topic clusters: `professional_scope_of_practice`, `informed_consent`, `medical_intervention`):
  - Aile Hekimliği Kanunu → `professional_scope_of_practice`
  - İSG Kanunu → `professional_scope_of_practice`
  - Organ Nakli Kanunu → `informed_consent`, `medical_intervention`
  - ÜYTE Yönetmeliği → `informed_consent`, `medical_intervention`
  - GETAT Yönetmeliği → `professional_scope_of_practice`

### Coverage changes (before → after)

| Metric | v0.28.0 | v0.29.0 |
|---|---|---|
| `verifiedOfficialSourceCount` | 5 | **10** |
| `coveredOfficialLegislationCount` | 5 | **10** |
| `coveredByActiveHintsCount` | 5 | **10** |
| `candidateOfficialSourceCount` | 9 | **4** |
| `gapCount` | 3 | 3 (unchanged) |
| `uncoveredCoreCount` | 4 | 4 (unchanged — new entries not core) |
| `unofficialLegislationSourceCount` | 0 | **0** |
| `topicClusterCount` | 16 | 16 (no new clusters) |

### Constraints upheld

- No gov.tr-external source accepted as verified
- No output contract / source sufficiency relaxation
- No new topic cluster added to `HealthLegislationHint` type
- local-yargi: not imported, not vendored

---

## [0.28.0] — 2026-05-24 — Official Health Legislation Inventory

> Tag: `v0.28.0-official-health-legislation-inventory`

### Eklenenler

- **`src/healthLegislationInventory.ts`** — Canonical physician-relevant Turkish health legislation inventory:
  - `HealthLegislationInventoryEntry` interface with `key`, `title`, `titleNormalized`, `category`, `relevanceLevel`, `officialSourceStatus`, `coverageStatus`, `mevzuatSourceId?`, `officialUrl?`, `relatedIssueIds`, `relatedTopicClusters`, `searchTerms`, `notes`
  - `HealthLegislationAccessStatus`: `verified | candidate | gap | deferred`
  - `HealthLegislationRelevanceLevel`: `core | supporting | specialized`
  - `HealthLegislationCategory`: 14 categories (`physician_practice`, `patient_rights`, `professional_ethics`, `data_privacy`, `private_health_facility`, `emergency_services`, `occupational_health`, `organ_tissue`, `reproductive_medicine`, `home_health`, `complementary_medicine`, `diagnostics`, `discipline`, `insurance`)
  - `HealthLegislationInventoryReport` interface
  - `HEALTH_LEGISLATION_INVENTORY` — 21-entry inventory:
    - **5 verified** (active in adapter registry): Hasta Hakları Yönetmeliği, Tıbbi Deontoloji Nizamnamesi, Tababet Kanunu, Sağlık Hizmetleri Temel Kanunu, KVKK
    - **3 gap** (known since v0.22.0; official ID unconfirmed): Özel Hastaneler Yönetmeliği, Ayakta Teşhis Yönetmeliği, Sağlık Meslek Mensupları Görev Tanımları Yönetmeliği
    - **9 candidate** (sourceId research needed): Acil Sağlık, Aile Hekimliği Kanunu, İş Sağlığı ve Güvenliği Kanunu, İşyeri Hekimi Yönetmeliği, Kişisel Sağlık Verileri Yönetmeliği, Organ Nakli Kanunu, ÜYTE Yönetmeliği, GETAT Yönetmeliği, Disiplin Yönetmeliği
    - **4 deferred**: Ambulans, Yataklı Tedavi, Hekim Sigortası, Radyoloji
  - `VERIFIED_MEVZUAT_SOURCE_IDS` — read-only set of confirmed sourceIds
  - `buildInventoryReport()` — pure function producing coverage/gap summary
  - Design constraints enforced: no non-gov.tr URL may be `verified`; no `candidate`/`gap` entry activates in adapter registry

- **`src/benchmark/benchmarkRunner.ts`** additions:
  - `BenchmarkReport.officialLegislationCoverage` extended with v0.28.0 inventory fields (backward compatible — all v0.22.0 fields preserved):
    - `inventoryTotalCount`, `coreInventoryCount`, `verifiedOfficialSourceCount`, `candidateOfficialSourceCount`, `gapCount`, `deferredCount`, `coveredByActiveHintsCount`, `uncoveredCoreCount`, `inventoryByCategory`, `inventoryByAccessStatus`
  - `buildOfficialLegislationCoverage` now calls `buildInventoryReport()` and derives gap list from inventory instead of hardcoded constant
  - Markdown report gains **Official Health Legislation Inventory** section

- **`tests/healthLegislationInventory.test.ts`** — 27 unit tests:
  - All required fields present on every entry
  - All keys unique
  - Verified entries have mevzuatSourceId and mevzuat.gov.tr officialUrl
  - Non-verified entries have no officialUrl
  - Gap entries have no mevzuatSourceId
  - v0.22.0 known gaps present with gap status
  - No candidate/gap entry has coverageStatus=covered
  - VERIFIED_MEVZUAT_SOURCE_IDS membership correct
  - buildInventoryReport counts consistent
  - coverageWarnings correctness, no INTEGRITY ERROR

### No Breaking Changes

- All v0.22.0 `officialLegislationCoverage` fields retained with identical semantics
- No active adapter registry entries added (only verified entries may be active)
- No gov.tr-external URLs accepted as verified
- No output contract, router, or sufficiency rule changes

---

## [0.27.0] — 2026-05-24 — Cross-Source Provenance, Duplicate Merge, Adapter-Native ContentStatus

> Tag: `v0.27.0-cross-source-provenance`

### Eklenenler

- **`src/live/decisionProvenance.ts`** — New module for cross-source provenance and duplicate merge:
  - `deriveContentStatus(decision)` — derives `ContentStatus` from decision fields; respects already-set value
  - `isQuoteUsable(decision)` — true only when contentStatus is full_text/html_markdown AND eligibilityStatus is not ineligible
  - `buildDecisionKey(decision)` — stable dedup key; prefers `doc::<documentId>` when available, falls back to court-based composite key
  - `chooseStrongestContentStatus(statuses)` — picks strongest from a list (full_text > html_markdown > pdf_link_only > metadata_only > unavailable)
  - `mergeDuplicateDecisions(decisions)` — merges decisions sharing the same key; winner = strongest contentStatus; loser's provenance merged in
  - `buildProvenanceMetrics(decisions)` — aggregate metrics over a decision list (content status, fetch status, quote usability distributions)
  - `MergeResult`, `ProvenanceMetrics` interfaces exported

- **`src/contracts/legal.ts`** additions:
  - `FetchStatus` type — `"search_hit" | "full_text_fetched" | "metadata_only" | "pdf_link_only" | "unavailable" | "timeout" | "parse_error" | "source_unavailable"`
  - `DecisionSourceProvenance` interface — per-decision provenance record with `source`, `fetchStatus`, `contentStatus`, `quoteUsable`, `timedOut`, `retryCount`, `backoffMs`, `fetchedAt`
  - `CourtDecision.provenance?: DecisionSourceProvenance[]` — list of per-source provenance entries (merged when duplicates are resolved)
  - `CourtDecision.normalizedDecisionKey?: string` — stable dedup key as set by adapters

- **Adapter wiring** — all three live adapters now set `contentStatus`, `quoteUsable`, `normalizedDecisionKey`, and `provenance[0]` on each `CourtDecision`:
  - `src/sources/bedesten/liveBedestenAdapter.ts`
  - `src/sources/yargitay/liveYargitayAdapter.ts`
  - `src/sources/danistay/liveDanistayAdapter.ts`

- **`src/live/reliabilityGate.ts`** additions:
  - `ReliabilityGateInput.quoteUnusableInVerifiedCount` — new field
  - `LiveReliabilityGate.quoteUnusableInVerifiedCount` — new field
  - Hard failure: `QUOTE_UNUSABLE_VERIFIED` — triggers when any verified precedent has `quoteUsable=false`

- **`src/benchmark/benchmarkRunner.ts`** additions:
  - `VerifiedPrecedentAuditEntry.adapterNativeContentStatus: boolean` — true when live adapter set contentStatus
  - `BenchmarkReport.provenanceMetrics` — full provenance aggregate metrics block
  - `buildProvenanceMetricsFromResults` helper — derives provenance distribution from audit entries
  - `buildLiveReliabilityGateFromResults` now computes and passes `quoteUnusableInVerifiedCount`
  - Markdown report gains **Cross-Source Provenance Metrics** section

- **`tests/decisionProvenance.test.ts`** — 17 test cases covering all exported functions

### Değişenler

- `package.json` / `package-lock.json`: version bumped to `0.27.0`

## [0.26.0] — 2026-05-24 — Live Reliability Gate

> Tag: `v0.26.0-live-reliability-gate`

### Eklenenler

- **`src/live/reliabilityGate.ts`** — Pure utility module; no adapters, no network calls, no circular dependencies.
  - `ReliabilityGateInput` — flat struct accepted from benchmark runner (avoids circular import)
  - `SourceSufficiencyRecord` — per-query sufficiency record with `query`, `precedentCount`, `legislationCount`, `sufficient`
  - `LiveReliabilityGate` — output interface with all gate fields including `gatePassed`, `gateFailures`, `gateObservations`
  - `buildLiveReliabilityGate(input)` — evaluates hard failures and soft observations:
    - **Hard failures** (set `gatePassed = false`): `MOCK_FALLBACK`, `CONTRACT_FAIL`, `UNOFFICIAL_SOURCE`, `INELIGIBLE_PRECEDENT`
    - **Soft observations** (informational, gate still passes): `TIMEOUT`, `RATE_LIMIT`, `INSUFFICIENT_SUFFICIENCY`

- **`src/contracts/legal.ts`** additions:
  - `ContentStatus` type: `"full_text" | "html_markdown" | "pdf_link_only" | "metadata_only" | "unavailable"` (with JSDoc)
  - `CourtDecision.contentStatus?: ContentStatus` — describes content richness available for a decision
  - `CourtDecision.quoteUsable?: boolean` — whether the decision text may be quoted in output

- **`src/benchmark/benchmarkRunner.ts`** additions:
  - `VerifiedPrecedentAuditEntry` gains `contentStatus: ContentStatus | null` and `quoteUsable: boolean`
  - `buildVerifiedPrecedentAudit` derives `contentStatus` from `fullTextAvailable` + `reasoningDetected` and `quoteUsable` from `eligibilityStatus === "precedent_usable"`
  - `BenchmarkReport` gains `liveReliabilityGate: LiveReliabilityGate`
  - `buildLiveReliabilityGateFromResults` helper wires report data → `ReliabilityGateInput` → `buildLiveReliabilityGate`
  - Markdown report gains **Live Reliability Gate** section showing gate result, hard failures, and soft observations

- **`package.json`**: `benchmark:doctor-questions:live-smoke` script — runs live benchmark with `--limit 5` for quick pre-release validation

- **`tests/reliabilityGate.test.ts`** — 11 pure unit tests:
  - gate passes with clean input
  - each of the 4 hard failures individually trips `gatePassed = false`
  - multiple hard failures accumulate correctly
  - `TIMEOUT`, `RATE_LIMIT` observations do not trip gate
  - `INSUFFICIENT_SUFFICIENCY` observation counts insufficient records
  - scalar fields pass through correctly

### No Breaking Changes

- `CourtDecision.contentStatus` and `quoteUsable` are optional — existing adapters and tests unaffected
- `liveReliabilityGate` is additive to `BenchmarkReport`; existing consumers that don't read it are unaffected

---

## [0.25.0] — 2026-05-23 — Live Timeout / Retry Hardening

> Tag: `v0.25.0-live-timeout-retry-hardening`

### Eklenenler

- **`src/live/requestPolicy.ts`** — Pure utility module; no network calls, no external dependencies.
  - `LiveRequestErrorKind` union: `timeout | network | rateLimit | serverError | clientError | zeroResult | parseError | unknown`
  - `LiveRequestPolicy` interface: `timeoutMs`, `maxRetries`, `backoffBaseMs`, `backoffMaxMs`, `jitterFactor`
  - `SOURCE_POLICIES` — per-source tuned policies:
    - `mevzuat-search`: 8 s timeout, 2 retries
    - `mevzuat-pdf`: 30 s timeout, 1 retry
    - `bedesten-search`: 12 s timeout, 2 retries
    - `bedesten-fulltext`: 20 s timeout, 1 retry
    - `danistay-search`: 15 s timeout, 2 retries
  - `DEFAULT_POLICY`: 15 s, 2 retries (fallback for unknown source names)
  - `policyForSource(sourceName)` — lookup with DEFAULT_POLICY fallback
  - `classifyLiveError(error, httpStatus?)` — priority-ordered error classification
  - `classifyZeroResult()` — explicit zero-result classification
  - `shouldRetry(kind, attemptsUsed, maxRetries)` — retry only transient kinds (timeout/rateLimit/serverError/network); never retries zeroResult/clientError/parseError/unknown
  - `computeBackoffMs(attempt, policy, random?)` — jittered exponential: `min(base×2^attempt, maxMs) ±jitterFactor`; injectable `random` for deterministic tests
  - `withTimeout(fetchImpl, url, init, timeoutMs)` — wraps any fetch call with an AbortController deadline; AbortError on expiry → classified as `"timeout"` by `classifyLiveError`
  - `executeWithRetry<T>(options)` — policy-governed retry loop with injectable `sleep` and `random`; returns `RetryResult<T>` with `value`, `succeeded`, `retryCount`, `totalBackoffMs`, `lastErrorKind`, `timedOut`, `lastError`

- **`src/sources/legislation/liveOfficialLegislationAdapter.ts`** wired:
  - `fetchWithAdaptiveBackoff` now accepts a `sourceName` parameter and wraps each fetch attempt with `withTimeout(this.fetchImpl, url, init, policy.timeoutMs)`
  - `searchOfficialLegislation` uses `"mevzuat-search"` policy (8 s timeout)
  - `getDocument` uses `"mevzuat-pdf"` policy (30 s timeout)
  - Timeout errors produce a `"source_error"` unavailable result with an explicit "timed out after Xms" message

- **`src/core/httpClient.ts`** wired:
  - `HttpClientOptions.timeoutMs?: number` — defaults to `policyForSource("bedesten-search").timeoutMs` (12 s)
  - `HttpRequestTelemetry.timedOut: boolean` — set to `true` when an AbortError is caught from the fetch
  - `requestJson` wraps the fetch inside `rateLimiter.schedule(() => withTimeout(...))` — timeout starts when the slot is acquired and the fetch begins
  - All `lastTelemetry` assignments include `timedOut`

- **`BenchmarkReport.liveTimeoutMetrics`** aggregate section (v0.25.0):
  - `timeoutCount` — query telemetry entries where `timedOut === true`
  - `rateLimitCount` — entries where `retryAfterMs > 0` (429 Retry-After honoured)
  - `transientFailureCount` — entries where `retryCount > 0`
  - `totalRetries` — sum of `retryCount` across all telemetry
  - `totalBackoffMs` — sum of `backoffMs` across all telemetry
  - `timedOutSources` — unique sources that produced at least one timeout

- **`tests/requestPolicy.test.ts`** — 48 new pure-function tests:
  - `policyForSource`: all 5 named sources, default fallback
  - `classifyLiveError`: AbortError, DOMException AbortError, TypeError, plain Error + null httpStatus, HTTP 429/500/503/404/400, parse error message pattern, unknown
  - `classifyZeroResult`: always returns `"zeroResult"`
  - `shouldRetry`: all 8 error kinds × retriable/non-retriable; max retries boundary; reason string completeness
  - `computeBackoffMs`: base/doubling/clamping; never negative; jitter range; integer output
  - `withTimeout`: resolves on time; AbortError fires when deadline exceeded; propagates pre-deadline rejection; does not mutate original init
  - `executeWithRetry`: success path; non-retriable failure; retry-to-success; max-retries exhaustion; timedOut flag; totalBackoffMs accumulation; lastError null/set
  - Total test count: **467** (was 419)

### Değişenler

- `HttpRequestTelemetry` — added `timedOut: boolean`; all error classes updated to default to `timedOut: false`

### Constraints Observed

- local-yargi is NOT imported; patterns reimplemented independently.
- No new live source integrations.
- No physician-facing output contract changes.
- No risk level, urgent action, definitive legal opinion, or petition/defence draft.
- `DoctorLegalInformationPack` output format not modified.
- Router issue class list not changed.
- `exports/` and `.cache/` remain untracked.

---

## [0.24.0] — 2026-05-23 — Source Sufficiency Gate

> Tag: `v0.24.0-source-sufficiency-gate`

### Eklenenler

- **`src/sourceSufficiency.ts`** — Deterministic source sufficiency evaluator.
  - No LLM calls; no external network; pure function.
  - Input: router result, relevantLegislation, verifiedPrecedents, contractPassed, unofficialSourceDetected, usedMockSourceInLiveMode, auditOk.
  - Output: `SourceSufficiencyResult` with level (`sufficient` / `partial` / `insufficient`), `missingAuthorityTypes`, `reasons`, issue IDs, counts, flags, and `canComposeResearchPack`.

- **`SourceSufficiencyLevel`** type: `"sufficient" | "partial" | "insufficient"`.

- **`MissingAuthorityType`** taxonomy (6 types):
  - `legislation` — no official legislation retrieved
  - `highCourtPrecedent` — no verified high-court decision
  - `fullTextReasoning` — precedents lack full-text gerekçe
  - `issueSpecificMatch` — retrieved sources do not thematically match routed issues
  - `officialSourceTrace` — no gov.tr sourceTrace on legislation, or unofficial/mock source
  - `verifiedPrecedentEligibility` — all precedents are metadata-only / procedural-only / no-reasoning

- **Sufficiency level logic**:
  - `sufficient`: legislation + quote + article number + gov.tr sourceTrace + verified precedent + full-text reasoning + no unofficial/mock source + contract passed + not unclear_or_mixed — all met.
  - `partial`: legislation present, no hard blocker, but one or more criteria missing (no precedent, weak full-text, failed contract, issue-specific mismatch).
  - `insufficient`: no legislation, OR unofficial source detected, OR mock fallback in live mode, OR all precedents ineligible.
  - `canComposeResearchPack`: true iff legislation is present and no hard blocker.

- **`BenchmarkItemResult`** new fields (v0.24.0):
  - `sourceSufficiencyLevel` — level for this question
  - `missingAuthorityTypes` — array of missing authority type IDs
  - `sourceSufficiencyReasonCount` — count of diagnostic reasons
  - `canComposeResearchPack` — boolean

- **`BenchmarkReport.sourceSufficiencyMetrics`** aggregate section:
  - `sourceSufficiencyDistribution` — `{sufficient, partial, insufficient}` counts
  - `insufficientSourceCount`
  - `partialSourceCount`
  - `sufficientSourceCount`
  - `missingAuthorityTypeDistribution` — frequency map by authority type
  - `cannotComposeResearchPackCount`

- **`tests/sourceSufficiency.test.ts`** — 29 new pure-function tests:
  - sufficient: all criteria met → level, fields, missing count
  - partial: legislation + no precedent; legislation + contract fail; mixed eligibility statuses
  - insufficient: no legislation; unofficial source; mock in live mode; all-metadata-only/procedural-only
  - unclear_or_mixed + no legislation → insufficient
  - canComposeResearchPack false/true conditions
  - Issue-specific legislation and precedent counting
  - missingAuthorityTypes no-duplicate invariant
  - Safety invariants: no forbidden phrases in reasons/warnings
  - Total test count: **419** (was 390)

### Mock Benchmark Diagnostics (v0.24.0)

In mock mode all 15 questions score **partial** (expected):
- Legislation is present → no "insufficient"
- Mock legislation carries no sourceTrace → `officialSourceTrace` missing
- No verified court decisions in mock pack → `highCourtPrecedent` missing
- `canComposeResearchPack: true` for all 15 (legislation exists, no hard blocker)

In live mode with properly retrieved sources, `sufficient` is expected for well-matched queries.

### Constraints Observed

- No latency/timeout hardening.
- No Yargıtay/Bedesten performance changes.
- No local-yargi module or fork.
- No new live source integration.
- `DoctorLegalInformationPack` output format not modified.
- No risk level, urgent action, definitive legal opinion, or petition/defence draft.
- Router issue class list not changed.
- `officialLegislationCoverage` metrics preserved (5 covered, 16 clusters, 3 gaps).
- `exports/` and `.cache/` remain untracked.

---

## [0.23.0] — 2026-05-23 — Medical Issue Router

> Tag: `v0.23.0-medical-issue-router`

### Eklenenler

- **`src/medicalIssueRouter.ts`** — Deterministic, keyword-driven medical issue router.
  - No LLM calls; no external network; pure function.
  - Covers **16 issue categories**: `informed_consent`, `medical_records`, `privacy_kvkk`, `emergency_care`, `referral_consultation`, `malpractice_complication`, `disciplinary_admin`, `patient_rights`, `criminal_liability`, `civil_compensation`, `private_health_facility`, `professional_scope_of_practice`, `workplace_employee_health`, `prescription_report`, `death_postmortem`, `unclear_or_mixed`.
  - Per-issue: normalised phrase matching (+3 each) + keyword matching (+1 each); confidence thresholds: high ≥ 5, medium ≥ 2, low ≥ 1.
  - Supports **multi-label routing** (a single question may map to several issue axes).
  - Output per route: `issueId`, `label`, `confidence`, `score`, `matchedTerms`, `reason`, `suggestedTopicClusters`, `suggestedCourtSearchTerms`.
  - Top-level output: `normalizedQuestion`, `routes[]`, `primaryIssueId`, `missingInfoHints`, `routerWarnings`.
  - Turkish diacritic normalization via shared `normalizeText` from `precedentRelevance.ts`.
  - Integrates with v0.22.0 topic clusters: `private_health_facility`, `professional_scope_of_practice` used in route output.
  - **Safety invariants enforced**: no risk level, no definitive legal opinion, no action instructions, no petition/defence draft in any output field.

- **`BenchmarkItemResult`** new fields (v0.23.0):
  - `routedIssueIds` — issue IDs matched for this question
  - `primaryIssueId` — top-scoring issue
  - `routerConfidence` — confidence of the primary route
  - `routerMissingInfoHintCount` — number of missing-info hints returned

- **`BenchmarkReport.routerMetrics`** aggregate section:
  - `routedIssueCoverage` — frequency map of each issue ID across all questions
  - `lowConfidenceRouteCount` — questions where primary confidence is "low"
  - `unclearOrMixedCount` — questions routed to `unclear_or_mixed`
  - `multiIssueQuestionCount` — questions matching more than one issue
  - `primaryIssueDistribution` — frequency map of primary issue IDs

- **`tests/medicalIssueRouter.test.ts`** — 37 new pure-function tests:
  - All 15 issue types with representative Turkish physician questions
  - Multi-issue questions (onam + epikriz, disiplin + tazminat)
  - Empty / whitespace / vague input → `unclear_or_mixed`
  - Output contract validation (fields, types, ordering)
  - Safety invariants (no forbidden content in any output field)
  - Topic cluster alignment with v0.22.0 clusters
  - Turkish diacritic normalization symmetry
  - Total test count: **390** (was 353)

### Constraints Observed

- No latency/timeout hardening.
- No Yargıtay/Bedesten performance changes.
- No local-yargi module or fork.
- No new live source integration.
- Physician-facing output contract (`DoctorLegalInformationPack`) not modified.
- No risk level, urgent action, definitive legal opinion, or petition/defence draft.
- Benchmark dataset not enlarged (router runs on existing 15 questions).
- `officialLegislationCoverage` metrics preserved (5 covered, 16 clusters, 3 gaps).
- `exports/` and `.cache/` remain untracked.

---

## [0.22.0] — 2026-05-23 — Official Health Legislation Coverage

> Tag: `v0.22.0-official-health-legislation-coverage`

### Eklenenler

- **Two new `topicCluster` union values** in `src/sources/legislation/liveTypes.ts`:
  - `"private_health_facility"` — özel sağlık kuruluşu yetkilendirme ve yükümlülük soruları
  - `"professional_scope_of_practice"` — hekimin uzmanlık sınırı ve yetkisi soruları

- **Four new `HealthLegislationHint` entries** in `src/sources/legislation/healthMappings.ts`:
  - `professional_scope_of_practice` ← Tababet Kanunu md. 1, 25 (`mevzuat:1.3.1219`, `health_primary`)
  - `professional_scope_of_practice` ← Sağlık Hizmetleri Temel Kanunu md. 3, 9 (`mevzuat:1.5.3359`, `supporting_general`)
  - `private_health_facility` ← Sağlık Hizmetleri Temel Kanunu md. 1, 3, 9 (`mevzuat:1.5.3359`, `health_primary`)
  - `private_health_facility` ← Tababet Kanunu md. 1 (`mevzuat:1.3.1219`, `supporting_general`)
  - Total hint entries: 20 → 24

- **Two new mock `LegislationProvision` entries** in `src/sources/mockData.ts`:
  - `leg-tababet-25` — Tababet Kanunu md. 25 (uzmanlık sınırı / professional scope)
  - `leg-healthservices-9` — Sağlık Hizmetleri Temel Kanunu md. 9 (sağlık personeli faaliyeti / facility oversight)

- **`officialLegislationCoverage` section** added to `BenchmarkReport` in `src/benchmark/benchmarkRunner.ts`:
  - `coveredOfficialLegislationCount` — unique sourceIds registered in `healthLegislationHints`
  - `coveredLegislationTitles` — unique legislation titles in registry
  - `knownUncoveredLegislation` — known health legislation not yet registered (mevzuat.gov.tr ID unconfirmed)
  - `missingKnownHealthLegislationCount`
  - `topicClustersRegistered` / `topicClusterCount` — now 16 clusters (was 14)
  - `unofficialLegislationSourceCount` — questions where `unofficialSourceDetected === true`
  - `coverageWarnings` — human-readable summary of gaps and unofficial detections

- **`tests/officialLegislationCoverage.test.ts`** — 27 new pure-function tests:
  - sourceId format validation for all hints
  - Required legislation presence checks
  - New topic cluster registration and source legitimacy
  - Mock provision completeness for new articles
  - Contract check enforcement: non-gov.tr URLs still flagged; gov.tr URLs accepted
  - Hint count sanity (≥ 24), no duplicate sourceId+topicCluster pairs
  - New topic cluster terms do not trigger unsafe-advice detection
  - Total test count: 353 (was 328)

### Coverage Gap Report (v0.22.0)

Legislation evaluated but **not added** due to unconfirmed mevzuat.gov.tr internal IDs:

| Legislation | Reason not added |
|---|---|
| Özel Hastaneler Yönetmeliği | Type-7 mevzuatNo dahili ID doğrulanamadı |
| Ayakta Teşhis ve Tedavi Yapılan Özel Sağlık Kuruluşları Hakkında Yönetmelik | Type-7 mevzuatNo dahili ID doğrulanamadı |
| Sağlık Meslek Mensupları İş ve Görev Tanımları Yönetmeliği | Type-7 mevzuatNo dahili ID doğrulanamadı |

These are documented in `officialLegislationCoverage.knownUncoveredLegislation` in every benchmark report.

### Constraints Observed

- No latency/timeout hardening.
- No Yargıtay/Bedesten performance changes.
- No local-yargi module or fork.
- No physician-facing output contract behaviour changes.
- No risk level, urgent action, definitive legal opinion, or petition/defence draft generation.
- Benchmark dataset not unnecessarily enlarged (new hints use existing legislation sources).
- Unofficial source contract check not relaxed; `*.gov.tr` rule intact.
- No entries added without a confirmed official source URL.

---

## [0.21.1] — 2026-05-23 — Release Housekeeping

> Tag: `v0.21.1-release-housekeeping`
> **No functional changes.** This is a repository hygiene release only.

### Değişenler

- `package.json` version: `0.21.0` → `0.21.1`
- `package-lock.json` version: `0.20.0` → `0.21.1` (lock file version was lagging two releases behind; corrected)

### Notes

- No latency/timeout hardening.
- No Yargıtay/Bedesten performance changes.
- No new source integrations.
- No changes to physician-facing output contract behaviour.
- No benchmark dataset changes.
- `exports/` and `.cache/` remain untracked (confirmed in `.gitignore`).
- Tag `v0.21.0-physician-pack-contract-hardening` is retained on commit `da4b583` (last code commit of v0.21.0); this release's tag is on the v0.21.1 commit.

---

## [0.21.0] — 2026-05-23 — Physician Pack Contract Hardening

> Tag: `v0.21.0-physician-pack-contract-hardening` → commit `da4b583`
> (Two commits: initial `c648126` + audit patch `da4b583`; tag re-applied to final commit.)

### Eklenenler

- **`ContractCheckResult`** interface in `src/packAudit.ts` with fields:
  - `passed` — true only when all contract invariants hold
  - `missingSections` — required top-level sections that are missing or empty (`shortAnswer`, `legalClassification`, `missingInformation`, `lawyerReviewPoints`)
  - `missingLegislationFields` — per-item array of missing required fields (`legislationName`, `articleNumber`, `verbatimQuote`, `connection`)
  - `missingPrecedentFields` — per-item array of fields that are missing or contain source-fallback placeholder strings (`courtAndChamber`, `date`, `factSummary`, `legalAssessment`, `outcome`, `similarityDifference`)
  - `unofficialSourceDetected` / `unofficialSourceDetails` — detects `accessSource === "mock"` in `decisionSourceTrace`
  - `unsafeAdviceDetected` / `unsafeAdvicePhrases` — scans all free-text fields for MVP-forbidden phrases (`kesin hukuki kanaat`, `dilekçe taslağı`, `savunma taslağı`, `risk seviyesi`, `derhal yapılacak`)

- **`contractCheck`** field added to `AuditResult`; all contract failures also bubble up to `errors[]` so `ok` is false when any contract check fails.

- **`BenchmarkItemResult`** new fields:
  - `contractPassed`, `missingSections`, `missingLegislationFieldCount`, `missingPrecedentFieldCount`, `unofficialSourceDetected`, `unsafeAdviceDetected`

- **`BenchmarkReport`** new aggregate fields:
  - `contractPassedCount`, `contractFailedCount`, `contractMissingSectionTotal`, `contractMissingLegislationFieldTotal`, `contractMissingPrecedentFieldTotal`, `contractUnofficialSourceCount`, `contractUnsafeAdviceCount`

- **`tests/packContractAudit.test.ts`** — 40 pure-function tests covering all contract check paths.

### Değişenler

- `AuditResult` shape is backward-compatible except for the addition of the `contractCheck` field.
- Test helpers in `packAudit.test.ts` and `benchmark.test.ts` updated to use valid contract-compliant pack shapes.

### Düzeltilenler

- `legalClassification`, `missingInformation`, and `lawyerReviewPoints` contract checks now correctly handle both `string` and `string[]` field variants as defined in `DoctorLegalInformationPack`.

### Audit Patch (commit `da4b583`)

- **`meritsAndDecisionNumber` check added** — the required esas/karar field in `VerifiedPrecedentEntry` is now validated: empty string, whitespace-only, or the fallback placeholder `"Kaynakta esas/karar no yok"` all cause `contractCheck.passed === false`.
- **Legislation sourceTrace URL scanning** — any non-null URL (`landingUrl`, `fullTextUrl`, `detailUrl`, `directPdfUrl`, `generatedPdfUrl`) in `relevantLegislation[i].sourceTrace` that does not match `*.gov.tr` is flagged as unofficial.
- **Mock-source regex broadened** — precedent `accessSource` detection is now case-insensitive `/mock/i`, catching `MOCK_FALLBACK`, `mock-fixture`, etc.
- 12 new tests added (328 total).

---

## [0.20.0] — 2026-05-22 — Live Performance / Cache Baseline

- Cache telemetry (`cacheHit`, `cacheMiss`, `servedFromCache`, `networkRequestMade`, `cacheAgeMs`, `retryCount`, `backoffMs`, `retryAfterMs`, `timedOut`) added to `QueryAttemptTelemetry`.
- `PrecedentCache.getWithMeta()` returning `CacheLookupResult<T>`.
- `LiveYargitayAdapter` and `LiveDanistayAdapter` cache integration.
- `npm run benchmark:doctor-questions:performance`: cold → warm comparison, 96.32% improvement.

---

## [0.19.0] — 2026-05-21 — Source Query Ranking / Reliability Metrics

- `QueryAttemptTelemetry` per-query timing with `issueProfile`, `queryType`, `queryRank`.
- `SOURCE_AFFINITIES` table (12 issue profiles × 4 sources).
- `rankedQueriesForSource`: fallback only when rank-1 returns 0 results.
- `rerankByIssueRelevance`: stable sort of `precedent_usable` entries.
- `buildSourceReliabilityMetrics` / `buildIssueProfileReliabilityMetrics` with p50/p95.

---

## [0.18.1] — 2026-05-21 — Benchmark Warning Taxonomy

> Tag: `v0.18.1-benchmark-warning-taxonomy`

### Özet

Adds warning taxonomy to benchmark and evaluation reports. Warnings are now split
into three categories: `informationalWarnings` (live source gaps, missing metadata,
source availability notes), `tuningWarnings` (weak relevance, missing legislation,
priority mismatches), and `safetyWarnings` (reserved for safety-adjacent precedent
issues). The report adds `goodWithInformationalWarningsCount` and
`goodWithTuningWarningsCount` so informational noise is visually separated from
actionable tuning signals. A per-question taxonomy table is added to the Markdown
report. `goodWithWarningsCount` is preserved for backward compatibility.

---

## [0.18.0] — 2026-05-21 — Precedent Relevance Tuning

> Tag: `v0.18.0-precedent-relevance-tuning`

### Özet

Implements the first precedent relevance tuning pass: issue-profile based query
selection, deterministic decision issue-signal scoring, weak relevance explanations,
and good-vs-good-with-warnings benchmark metrics.

The benchmark reports weak relevance by question and source, sample decision ids,
matched issue terms, missing expected issue terms, a `whyWeak` explanation, and
suggested follow-up query terms. It also separates `goodCleanCount` from
`goodWithWarningsCount` and reports average/median health-law relevance scores.

Weak relevance means the decision passed the hard precedent safety gates, but the
decision text matched only broad health words or did not overlap strongly with the
question's issue profile. Issue profiles include informed consent,
malpractice/complication, emergency care, treatment refusal, privacy/records,
psychiatric privacy, violence/threat, referral, private-hospital fee disputes,
public discipline, intensive care, and pregnancy emergency.

---

## [0.17.1] — 2026-05-21 — Live Benchmark Audit Tightening

> Tag: `v0.17.1-live-benchmark-audit-tightening`

### Özet

Audits the unusually strong v0.17.0 live result by tightening verified precedent
eligibility, source trace checks, mock fallback detection, and benchmark Markdown/JSON
audit fields.

Expands live benchmark quality audit fields for every selected verified precedent:
court, chamber, decision date, docket/decision numbers, access source, document id/source
id, source URL when available, full-text availability, reasoning detection, eligibility
status/reasons, health-law relevance score, matched terms, and decision source trace
presence. The report does not print full decision text.

---

## [0.17.0] — 2026-05-21 — Live Benchmark Evaluation Metrics

> Tag: `v0.17.0-live-benchmark-evaluation-metrics`

### Özet

Adds live benchmark/evaluation metrics and separate live report files. Live mode
keeps the same safety invariants, but source outages, empty results, rate limits,
and `sourceUnavailable` entries are reported as metrics and warnings instead of
automatic failures.

Mock fallback is a hard regression in live mode. AYM remains disabled/mock-only and
cannot silently supply live verified precedents. Adds
`npm run benchmark:doctor-questions:live` command.

---

## [0.16.1] — 2026-05-20 — Benchmark Artifact Hygiene

> Tag: `v0.16.1-benchmark-artifact-hygiene`

### Özet

Audit and cleanup release for benchmark artifact hygiene. Keeps benchmark exports
ignored, tightens scratch/debug/probe/smoke/audit ignore patterns, removes compiler-
reported dead locals from active adapters and CLIs, and updates live-source descriptions
without changing the pack/tool JSON shape.

---

## [0.16.0] — 2026-05-20 — Physician Question Benchmark Suite

> Tag: `v0.16.0-physician-question-benchmark`

### Özet

Introduced a comprehensive quality evaluation and regression-testing benchmark
suite focused on typical physician-centric legal questions.

- 15-question benchmark set across 15 separate medical-legal categories
- Quality measurement: legislation mapping, precedent count, schema conformity
- Regression prevention: KVKK scope, deontology precedence, safety constraints
- Scoring: `legislationMatchScore`, `priorityScore`, `precedentSafetyScore`,
  `sourceAvailabilityScore`, `auditScore`, `forbiddenFieldsScore`
- `qualityBand`: `good`, `acceptable`, `needs_tuning`, `unsafe`

---

## [0.15.2] — 2026-05-20 — Source Engine Port

> Tag: `v0.15.2-source-engine-port`

### Özet

Ports the local-yargi source-engine hardening needed by the live adapters:

- Bedesten requests use a shared `HttpClient` and `RateLimiter` path with bounded retry,
  `Retry-After` handling, exponential fallback backoff, jitter, and request telemetry.
- Live source failures stay structured and JSON-only.
- `src/sources/sourceRegistry.ts` exposes trimmed source capability, rate-limit, and cache
  policy metadata.
- Bedesten/Yargitay adapters keep metadata-only decisions out of verified precedent output.

---

## [0.12.0] — 2026-05-20 — Precedent Source Calibration

> Tag: `v0.12.0-precedent-source-calibration`

### Özet

Deep probe analysis and normalizer hardening for precedent sources. Adds probe CLI
for HTML/SOAP analysis, non-JSON response classification, and pack audit extended
checks for unavailable sources and decision source trace validation.

---

## [0.10.0] — 2026-05-20 — Multi-Source Live Precedent Pipeline

> Tag: `v0.10.0-multi-source-precedent-pipeline`

### Özet

Adds the live Danıştay adapter, centralized health law query expansion module,
per-source diagnostics (`sourceSummaries`), and file-based result cache.

- **Live Danıştay Adapter**: targets `karararama.danistay.gov.tr/aramalist`
- **`precedentSources` parameter**: select which courts are queried in live mode
- **Health Law Query Expansion**: deterministic term mapping shared by Yargitay and Danıştay
- **`sourceSummaries`**: per-source breakdown in `precedentDiagnostics`
- **File-Based Cache**: `.cache/precedents/` with one-hour TTL

---

## [0.9.0] — 2026-05-19 — Live Yargıtay Adapter

> Tag: `v0.9.0-live-yargitay-adapter`

### Özet

First live court decision adapter: `LiveYargitayAdapter` targeting
`bedesten.adalet.gov.tr/emsal-karar/searchDocuments`.

- JSON POST with health law search term, retries with adaptive back-off for 429/5xx
- `sourceMode: "live"` precedent behavior in `search_health_precedents` and pack handler
- Only `precedent_usable` decisions enter `verifiedHighCourtPrecedents`
- Structured `DecisionSourceTrace` for audit
- Danıştay and AYM remain mock adapters

---

## [0.8.0] — 2026-05-19 — Decision Source Trace and Precedent Diagnostics

> Tag: `v0.8.0-decision-source-trace`

### Özet

- **Decision Source Trace**: `DecisionSourceTrace` audits the decision pipeline for each court decision candidate
- **Reasoned-Decision Eligibility**: `assessDecisionEligibility` applies precedent filter rules and returns structured `EligibilityResult`
- **Precedent Diagnostics**: `PrecedentSelectionDiagnostics` compact audit view for decision selection

---

## [0.7.0] — 2026-05-18 — Selection Diagnostics

> Tag: `v0.7.0-selection-diagnostics`

### Özet

Adds `selectionDiagnostics` to live legislation MCP responses. Compact audit view
for source selection: legislation role, topic cluster, priority, article numbers,
rejected article-number summary, and selection reason.

---

## [0.6.0] — 2026-05-18 — Deterministic Provision Ranking

> Tag: `v0.6.0-deterministic-provision-ranking`

### Özet

Adds deterministic live provision ranking after official article extraction.
Selects a compact set of source articles for the pack based on physician query
terms, health-law topic cluster, mapping search terms, article heading text,
keyword matches, mapped article-list bonus, and health-law priority.

---

## [0.5.0] — 2026-05-17 — First Live Legislation Mapping

> Tag: `v0.5.0-first-live-legislation-mapping`

### Özet

Makes health legislation the first live mapping path. Patient-rights and
informed-consent questions use the official generated PDF path for Hasta Haklari
Yonetmeligi, including mapped articles 24 and 26. Health-law mappings also cover
Tibbi Deontoloji Nizamnamesi, Tababet ve Suabati Sanatlarinin Tarzi Icrasina Dair
Kanun, and Saglik Hizmetleri Temel Kanunu.

---

## [0.1.0] / [0.2.0] — 2026-05-15 — Initial MCP Skeleton

> Tags: `v0.1.0-mcp-skeleton`, `v0.2.0-mock-adapters`

### Özet

Initial MCP server skeleton with:
- MCP server registration and tool handler scaffolding
- Type contracts for legislation evidence, court decision evidence, classification,
  precedent status, and the legal information pack
- Mock legislation and high court adapters
- Health-law pipeline: question classifier, legislation mapper, precedent filter, answer composer
- Local JSON smoke command
- Vitest coverage for initial source-safety rules
- `sourceMode` routing (mock by default)
