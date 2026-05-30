# doktor-mcp — Geliştirme Roadmap'i

> Bu doküman otonom bir geliştirme döngüsü (ralph-loop / opencode orchestrator) tarafından
> tüketilmek üzere yazılmıştır. Her görev bağımsız tamamlanabilir; sırayla ilerle.
> Bir görevi bitirince: `git add -A && git commit` ile commit'le, ardından sıradakine geç.
>
> **Genel kurallar (her görevde geçerli):**
> - `npm run build` (tsc) **0 hata** vermeli.
> - `npm test` (vitest) **tamamen yeşil** kalmalı. Mevcut 986 testi kırma.
> - Yeni davranış eklediysen **yeni test** yaz. Test yoksa görev "done" sayılmaz.
> - Pakedin/araç JSON şekli (response contract) değişiyorsa README'yi güncelle.
> - Türkçe kullanıcı mesajları ve İngilizce kod/yorum karışımını koru (mevcut konvansiyon).
> - Asla gerçek uydurma mahkeme kararı / mevzuat metni üretme. Kaynak-temelli ilke korunur.

---

## Faz 0 — Hızlı Düzeltmeler (Quick Wins / Tech Debt)

### [x] T0.1 — Sürüm tutarsızlığını gider
- **Sorun**: `src/mcp/server.ts:8` `version: "0.1.0"` hardcoded, oysa `package.json` `0.43.0`.
- **Yapılacak**: Sürümü `package.json`'dan tek kaynaktan oku. Bir `src/core/version.ts` ekle;
  build sırasında `package.json`'ın `version` alanını import et (`import pkg from "../../package.json" with { type: "json" }`
  veya derleme-zamanı sabiti). Server ve MCP `serverInfo` bu değeri kullansın.
- **Kabul**: `server.ts` artık literal sürüm taşımıyor; `npm run build` geçiyor;
  yeni `tests/version.test.ts` package.json ile server sürümünün eşitliğini doğruluyor.

### [x] T0.2 — `as unknown as Record<string, unknown>` cast'lerini temizle
- **Sorun**: `src/mcp/tools.ts` (ör. `formatPackResponse`) tip güvenliğini noktasal deliyor.
- **Yapılacak**: `formatDoctorPackResponse` dönüş tipini gerçek bir `DoctorPackResponse`
  arayüzüne bağla (`src/mcp/formatDoctorPackResponse.ts` içinde export et). Çift cast'leri kaldır.
- **Kabul**: `tools.ts` içinde `as unknown as` kalmıyor; build geçiyor.

### [x] T0.3 — `benchmarkRunner.ts` dosyasını böl (2036 satır)
- **Sorun**: Tek dosya çok büyük; bakım zor.
- **Yapılacak**: Saf yardımcıları (skorlama, warning taxonomy, rapor yazımı) ayrı modüllere taşı:
  `src/benchmark/scoring.ts`, `src/benchmark/warningTaxonomy.ts`, `src/benchmark/reportWriter.ts`.
  `benchmarkRunner.ts` yalnızca orkestrasyonu tutsun. Davranış değişmesin.
- **Kabul**: Hiçbir dosya >900 satır; mevcut benchmark testleri değişmeden geçiyor.

### [x] T0.4 — `service.ts` sorumluluk ayrımı (754 satır)
- **Sorun**: Orkestrasyon + faz mantığı + rescue + telemetri tek sınıfta.
- **Yapılacak**: Minimal pack rescue ve legislation/precedent faz yürütücülerini
  ayrı modüllere çıkar (`src/app/legislationPhase.ts`, `src/app/precedentPhase.ts`,
  `src/app/minimalPackRescue.ts`). `DoktorMcpInformationService` ince koordinatör kalsın.
- **Kabul**: Davranış aynı; build + test yeşil; her yeni dosyada en az bir hedefli test.

### [x] T0.5 — Bedesten hata sınıflarını jenerikleştir
- **Sorun**: `BedestenNetworkError` / `BedestenHttpError` isimleri kaynağa sıkı bağlı,
  ama Danıştay/Mevzuat de aynı `HttpClient`'i kullanıyor.
- **Yapılacak**: Sınıfları `LiveSourceNetworkError`, `LiveSourceHttpError`,
  `LiveSourceRateLimitError`, `LiveSourceParseError` olarak yeniden adlandır; mesajlarda
  kaynak adını parametreyle ver (`source: string`). Geriye dönük alias export bırak.
- **Kabul**: Tüm adapter'lar yeni isimleri kullanıyor; eski isimler deprecated alias;
  testler geçiyor.

---

## Faz 1 — "Hukuki Sonuç" Tonunun Gevşetilmesi (Davranış Değişikliği)

> **Hedef**: Araç şu an her türlü hukuki önermeyi reddediyor. Bunu, **kaynağa dayalı
> ön değerlendirme** sunabilecek ama yine de nihai/kategorik sorumluluk hükmü vermeyen
> bir tona gevşet. "Sorumluluk vardır/yoktur" gibi mutlak ifadeler hâlâ yasak; ama
> "kaynaklar şu yönde eğilim gösteriyor", "bu durum şu maddeye göre değerlendirilebilir",
> "emsal kararlar benzer olaylarda şu sonuca ulaşmış" gibi **kaynak-bağlı, koşullu
> değerlendirme** serbest olmalı.

### [x] T1.1 — Yasaklı ifade listesini yeniden kalibre et
- **Dosya**: `src/mcp/formatDoctorPackResponse.ts` (`detectForbiddenOutputPhrases`).
- **Yapılacak**: Yasaklı listesini ikiye ayır:
  - **Hard-blocked** (kalır): kategorik nihai hüküm — "kesinlikle sorumludur",
    "tazminat ödemek zorundadır", "suç oluşturmaz" gibi mutlak/garantili ifadeler.
  - **İzinli** (artık engellenmez): koşullu/kaynağa atıflı değerlendirme — "bu maddeye göre
    değerlendirilebilir", "emsal kararlar benzer olaylarda ... yönünde", "risk taşıyabilir".
- **Kabul**: Yeni test dosyası `tests/forbiddenPhraseCalibration.test.ts` hem hard-blocked
  hem izinli örnekleri kapsasın. README'nin "Intentionally Out Of Scope" bölümü güncellensin.

### [x] T1.2 — `shortAnswer` ve yeni `preliminaryAssessment` alanı
- **Dosya**: `src/contracts/legal.ts`, `src/health/answerComposer.ts`.
- **Yapılacak**: Pakede opsiyonel `preliminaryAssessment` alanı ekle: kaynaklara dayalı,
  koşullu dille yazılmış, her cümlesi bir mevzuat maddesine veya emsal karara referans veren
  kısa değerlendirme. Referanssız cümle üretilmemeli (her iddia bir `sourceRef` taşımalı).
- **Kabul**: Yeni alan opsiyonel (geriye dönük uyumlu). `answerComposer` her assessment
  cümlesini bir kaynağa bağlamadan üretmiyor — test bunu doğrulasın.

### [x] T1.3 — "Disclaimer" tonunu tek noktadan yönet
- **Yapılacak**: `src/health/answerComposer.ts` içine merkezi bir `assessmentTone` ayarı koy
  (`strict` | `grounded-advisory`). Varsayılan `grounded-advisory`. `strict` modda eski
  davranış (sadece kaynak listeler, değerlendirme yok) korunur.
- **Kabul**: Tool input şemasına opsiyonel `assessmentTone` parametresi eklenir; iki mod da
  testlenir; README "Response Contract" güncellenir.

### [x] T1.4 — Rapor dilini güncelle
- **Yapılacak**: README ve `docs/` içinde "asla hukuki sonuç üretmez" ifadelerini
  "nihai/kategorik hüküm vermez; kaynağa dayalı koşullu değerlendirme sunabilir" olarak yumuşat.
- **Kabul**: Doküman tutarlı; kod davranışıyla çelişen ifade kalmıyor.

---

## Faz 2 — Eksik Özellikler / Yeni Yetenekler

### [x] T2.1 — Canlı AYM adapteri araştırması (şu an mock-only)
- **Yapılacak**: `kararlarbilgibankasi.anayasa.gov.tr` için bir probe CLI genişletmesi yaz
  (`probe:precedents --source aym`). Endpoint erişilebilirse `LiveAymAdapter` iskeletini kur;
  erişilemezse `calibrationStatus` raporuna `synthetic_only` gerekçesini yaz.
- **Kabul**: Probe çıktısı AYM için net statü veriyor; live adapter eklendiyse mock ile
  aynı `PrecedentSourceAdapter` arayüzünü uyguluyor; uydurma karar üretmiyor.

### [x] T2.2 — Mevzuat değişiklik/yürürlük tarihi doğrulaması
- **Sorun**: Mevzuat maddesi alıntılanırken yürürlükten kalkmış olabilir.
- **Yapılacak**: `LiveOfficialLegislationAdapter` çıktısına madde için `inForce` /
  `lastAmendedDate` / `repealed` metadata ekle (mevzuat.gov.tr metadata'sından çıkarılabildiğince).
  Çıkarılamıyorsa `inForce: "unknown"` döndür — asla "yürürlükte" varsayma.
- **Kabul**: Provision tipi yeni alanları taşıyor; pack audit yürürlük bilinmiyorsa uyarı veriyor.

### [x] T2.3 — Provision/karar deduplication ve çapraz-kaynak birleştirme
- **Yapılacak**: Aynı kararın hem Yargıtay hem Bedesten yolundan gelmesi durumunda
  `buildDecisionKey` ile dedupe et; çakışan metinlerde en zengin (tam metin + gerekçeli)
  olanı seç. Diagnostics'e `dedupedCount` ekle.
- **Kabul**: Test: aynı doc id farklı kaynaklardan → tek kayıt; en zengin metin seçiliyor.

### [x] T2.4 — Çıktı için resmî kaynak URL doğrulaması (link-rot guard)
- **Yapılacak**: `officialGazetteDocumentVerifier.ts` mantığını pack çıktısındaki her
  `sourceUrl` için opsiyonel HEAD-check ile genişlet (live mod, time-budget içinde).
  Erişilemeyen link `linkStatus: "unreachable"` işaretlensin, paket bloklanmasın.
- **Kabul**: Time-budget aşılmıyor; başarısız link paketi düşürmüyor; test mock fetch ile yazılı.

### [x] T2.5 — MCP `resources` ve `prompts` desteği
- **Yapılacak**: MCP server'a salt-okunur `resources` ekle: mevcut sağlık-mevzuatı envanteri
  (`HEALTH_LEGISLATION_INVENTORY`) ve kaynak kalibrasyon statüsü resource olarak sunulsun.
  İsteğe bağlı bir `prompts` girişi: "hekim hukuki soru formatı" şablonu.
- **Kabul**: `resources/list` ve `resources/read` çalışıyor; envanter doğru dönüyor; test yazılı.

### [x] T2.6 — Yapılandırma katmanı (env / runtime config) sağlamlaştırma
- **Dosya**: `src/core/runtimeConfig.ts`.
- **Yapılacak**: Time-budget, retry sayısı, cache TTL, `assessmentTone`, `sourceMode`
  varsayılanlarını tek config nesnesinde topla; env değişkenleriyle override edilebilsin
  (`DOKTOR_MCP_*`). Zod ile doğrula, geçersiz değerde anlaşılır hata ver.
- **Kabul**: Geçersiz env → yapılandırılmış hata; varsayılanlar değişmeden çalışıyor; test yazılı.

---

## Faz 3 — Test ve Kalite Sağlamlaştırma

### [x] T3.1 — Test sırasındaki gürültüyü temizle
- **Sorun**: Test çıktısında `Failed to read raw fixture ... non-existent.json` ENOENT log'u var.
- **Yapılacak**: İlgili testte beklenen hata yolunu sustur (logger mock / beklenen hata olarak
  yakala). Test çıktısı temiz olsun.
- **Kabul**: `npm test` çıktısında beklenmedik stderr satırı kalmıyor.

### [x] T3.2 — Live adapter'lar için kayıtlı-yanıt (recorded fixture) entegrasyon testleri
- **Yapılacak**: `fixtures/live-samples/` sanitize edilmiş yanıtlarla Yargıtay/Danıştay/Mevzuat
  adapter'larının `searchAndNormalize` yolunu uçtan uca testle (fetch mock'lanır). Network'e
  çıkmadan gerçek parse yollarını kapsa.
- **Kabul**: Her live adapter için en az 1 happy-path + 1 non-JSON/hata-path testi.

### [x] T3.3 — Coverage ölçümü ve eşik
- **Yapılacak**: `vitest --coverage` ekle (`@vitest/coverage-v8`). `npm run test:coverage`
  script'i. Kritik modüller (`health/`, `live/`, `sources/`) için bilgi amaçlı rapor üret;
  hard eşik koyma (CI'yi kırma), sadece raporla.
- **Kabul**: Coverage raporu üretiliyor; `.gitignore`'a `coverage/` zaten ekli (doğrula).

### [x] T3.4 — Determinizm/güvenlik regresyon testi
- **Yapılacak**: "KVKK gizlilik-dışı pakette görünmemeli", "live modda mock fallback olmamalı",
  "yasaklı hard-blocked ifade çıktıda olmamalı" invariyantlarını tek bir
  `tests/safetyInvariants.test.ts` altında toparla; benchmark'tan bağımsız hızlı koşsun.
- **Kabul**: Güvenlik invariyantları benchmark çalıştırmadan da test ediliyor.

---

## Faz 4 — Dokümantasyon ve DX

### [x] T4.1 — README'yi sürümler ve kullanım olarak ayır
- **Sorun**: README çok uzun; sürüm notları ile kullanım iç içe.
- **Yapılacak**: Sürüm geçmişini `CHANGELOG.md`'ye taşı (zaten var, oraya konsolide et);
  README sadece güncel mimari + kullanım + araç sözleşmesini tutsun.
- **Kabul**: README belirgin kısalıyor; CHANGELOG tüm sürüm notlarını içeriyor; link'ler kırık değil.

### [x] T4.2 — Mimari diyagram ve veri akışı
- **Yapılacak**: `docs/ARCHITECTURE.md` ekle: katmanlar (mcp → service → health → sources →
  core/live), mock/live ayrımı, time-budget akışı, güvenlik kapıları. Mermaid diyagramı kullan.
- **Kabul**: Yeni doküman kod gerçeğiyle uyumlu; dosya/satır referansları doğru.

### [x] T4.3 — Commit author/metadata düzeltme rehberi
- **Sorun**: `git shortlog -sne` boş — author metadata tutarsız.
- **Yapılacak**: `CONTRIBUTING.md` ekle; commit konvansiyonu, author ayarı, build/test
  ön-koşulları yazılsın. (Geçmişi rewrite etme — sadece ileriye dönük kural.)
- **Kabul**: CONTRIBUTING.md mevcut; yeni commit'ler doğru author taşıyor.

---

## Faz 5 — Sürüm & Changelog Tutarlılığı

### [x] T5.1 — `package.json` sürümünü 0.44.0'a bump'la
- **Sorun**: `CHANGELOG.md` `## [0.44.0]` girdisini ekledi ama `package.json` hâlâ `0.43.0`.
  T0.1 sonrası sürüm tek kaynaktan (`package.json`) okunduğu için MCP server kendini
  yanlış sürümle (`0.43.0`) tanıtıyor; changelog ile çelişiyor.
- **Yapılacak**: `package.json` `version` alanını `0.44.0` yap. `package-lock.json` içindeki
  sürümü de (root `version` ve varsa kendine-referans veren paket girdisi) `0.44.0`'a güncelle.
  Başka davranış değiştirme.
- **Kabul**: `package.json` ve `package-lock.json` `0.44.0`; `npm run build` geçiyor;
  `tests/version.test.ts` (T0.1'den) changelog'un en üst sürümüyle uyumlu olarak geçiyor.
  Mümkünse bu testi, "package.json sürümü CHANGELOG.md'deki en üst `## [x.y.z]` ile eşleşmeli"
  invariyantını da kontrol edecek şekilde genişlet.

### [x] T5.2 — Changelog'daki tekrarlı başlığı düzelt
- **Sorun**: `CHANGELOG.md` içinde 0.35.0 başlığı ikilenmiş:
  `## [0.35.0] — 2026-05-24 — RG Lead SourceId Resolver — 2026-05-24 — RG Lead SourceId Resolver`
- **Yapılacak**: Başlığı tek forma indir:
  `## [0.35.0] — 2026-05-24 — RG Lead SourceId Resolver`. İçeriğe dokunma.
- **Kabul**: Başlık tek; changelog'da `— 2026` ifadesi aynı satırda yalnızca bir kez geçen
  her başlık tutarlı.

---

## Faz 6 — v1 Release Readiness

> Bu faz, canlı (`--sourceMode live`) çalıştırmalarda gözlenen gerçek davranışa dayanır.
> Hedef: altyapı olgunluğunu (build/test yeşil) **içerik kalitesiyle** eşitlemek.
> v1 etiketi ancak T6.1–T6.3 (must-have) tamamlanınca anlamlıdır.

### Must-have (v1 bloklayıcı)

#### [x] T6.1 — `preliminaryAssessment`'i anlamlı kıl (şu an boş kalıp)
- **Sorun**: Canlı çıktıda her değerlendirme cümlesi aynı içeriksiz şablon:
  "Emsal kararlar benzer olaylarda DANİSTAY / 12. Daire kararının işaret ettiği yönde
  eğilim göstermektedir." — hangi yönde olduğunu söylemiyor; aynı daire 4 kez tekrar
  ediyor; hekime bilgi vermiyor. Ton gevşetmesinin (T1.2) asıl değeri burada kayboluyor.
- **Dosya**: `src/health/answerComposer.ts` (assessment üretimi), ilgili emsal/mevzuat tipleri.
- **Yapılacak**:
  - Her emsal cümlesi kararın **gerçek sonucunu/eğilimini** (lehte / aleyhte / usul / karma)
    `extractOutcome` + `extractLegalReasoning` çıktısından türetsin; "işaret ettiği yönde"
    gibi içeriksiz ifadeyi kaldır.
  - Her cümle olayla **benzerlik notunu** (relevanceNote / matched issue terms) içersin.
  - Her mevzuat cümlesi maddenin **somut yükümlülüğünü** (madde başlığı/özeti) yansıtsın.
  - **Aynı daire/karar için tekrarı dedupe et**; en güçlü ilgili karar bir kez geçsin.
  - İçerik türetilemiyorsa (outcome/reasoning yoksa) o cümleyi **hiç üretme** — boş kalıp
    üretmek yasak. Her cümle hâlâ bir `sourceRef` taşımalı (mevcut güvenlik kuralı korunur).
- **Kabul**: `tests/` altında yeni test: (a) iki farklı sonuçlu karar → iki farklı cümle;
  (b) aynı daireden iki karar → tek cümle (dedupe); (c) outcome/reasoning'i olmayan karar →
  cümle üretilmez; (d) her üretilen cümlenin `sourceRef`'i dolu. Build + test yeşil.

#### [x] T6.2 — Canlı sağlık-birincil mevzuat önceliği regresyon testi
- **Sorun**: "Hekim kişisel sağlık verisini izinsiz paylaştı" canlı sorusunda **yalnızca
  KVKK m.6** döndü; Hasta Hakları Yönetmeliği'nin mahremiyet maddesi yüzeye çıkmadı. Bu,
  README'nin "kişisel-sağlık-verisi sorularında Hasta Hakları Yönetmeliği KVKK'dan ÖNCE
  gelir; KVKK fallback değildir" invariyantının canlıda sessiz ihlali olabilir. Mevcut
  mock invariyant testi bunu yakalamıyor.
- **Yapılacak**:
  - `tests/` altına recorded-fixture (canlı yanıt sanitize) tabanlı bir test ekle:
    gizlilik/kişisel-sağlık-verisi sorusunda sağlık-birincil mevzuat KVKK'dan **önce**
    sıralanmalı.
  - Sağlık-birincil mevzuat yüzeye çıkmıyorsa **nedeni görünür** olsun (extraction fail mi,
    mapping mi ateşlenmedi mi) ve `coverageGaps`/`selectionDiagnostics`'e işlensin —
    sessizce KVKK'ya düşmesin.
- **Kabul**: Test, KVKK'nın sağlık-birincil mevzuatın önüne geçtiği durumu **hard fail**
  yapıyor; sağlık-birincil çıkarılamadığında diagnostic'te açık gerekçe var.

#### [x] T6.3 — Çekirdek sağlık yönetmeliklerinin kapsama boşluklarını kapat
- **Sorun**: 6 `needs_manual_review` girdi hâlâ doğrulanmamış: Özel Hastaneler, Acil Sağlık
  Hizmetleri, Ayakta Teşhis, İşyeri Hekimi, Kişisel Sağlık Verileri Yönetmeliği, Sağlık
  Bakanlığı Disiplin. "Hekim aracı" iddiası için bu çekirdek yönetmelikler önemli.
- **Yapılacak**: Mevcut doğrulama hattını (`verify:official-gazette-health-legislation`,
  `verifyBySourceIdDirect`, RG resolver) kullanarak bu girdiler için canlı mevzuat.gov.tr
  sourceId + RG doğrulamasını tamamla; doğrulananları `covered` yap ve aktif mapping'e bağla.
  Doğrulanamayan kalırsa **net gerekçeyle** `needs_manual_review` bırak (uydurma kaynak yok).
- **Kabul**: En az 3 girdi `covered`'a yükseliyor; `coveredOfficialLegislationCount` artıyor;
  doğrulanan her girdi gerçek gov.tr sourceId taşıyor; ilgili testler güncel.

### Should-have

#### [x] T6.4 — Çıktı sözleşmesini dondur + SemVer 1.0 disiplini
- **Yapılacak**: `responseVersion` üzerinden v1 breaking-change politikası tanımla; bir
  `docs/COMPATIBILITY.md` ekle (hangi alanlar stabil, hangi alanlar deneysel, deprecation
  yolu nasıl). Deneysel alanları (`preliminaryAssessment` vb.) açıkça işaretle.
- **Kabul**: Politika dokümante; deneysel/stabil alanlar ayrımı net.

#### [x] T6.5 — AYM'yi netleştir (iskelet/mock belirsizliğini gider)
- **Yapılacak**: Ya gerçek canlı AYM adapterini tamamla, ya da pakede AYM için **açık
  "kapsam dışı / sentetik" işareti** koy ki kullanıcı belirsiz kalmasın. Mevcut
  `LiveAymAdapter` iskeleti uydurma karar üretmemeli.
- **Kabul**: AYM çıktısı her zaman net statü taşıyor; sentetik veri verified bölüme sızmıyor.

#### [x] T6.6 — Çıktı boyunca tek dil/aksan politikası
- **Sorun**: `shortAnswer` ASCII'leştirilmiş ("eslestirildi", "degildir") ama
  `preliminaryAssessment` tam Türkçe ("değerlendirilmelidir"). Tutarsız.
- **Yapılacak**: Hekime dönük tüm metinlerde tek politika seç (tercihen tam Türkçe,
  doğru diakritiklerle) ve uygula.
- **Kabul**: Çıktıdaki hekim-dönük alanlar tek aksan politikasına uyuyor; test bunu doğruluyor.

#### [x] T6.7 — README'yi gerçek canlı davranışla hizala
- **Yapılacak**: Özellikle mevzuat-önceliği ve kapsam iddialarını T6.2/T6.3 sonrası
  doğrulanmış gerçeklerle eşitle. Test edilmemiş iddia bırakma.
- **Kabul**: README'deki davranış iddiaları canlı/recorded testlerle örtüşüyor.

### Nice-to-have

#### [ ] T6.8 — Hukukçu-gözüyle kalite kıyas seti
- **Yapılacak**: Mevcut teknik benchmark'a ek olarak, küçük bir "bu pakete bir avukat ne der"
  niteliksel kontrol listesi ekle (ör. seçilen emsalin gerçekten konuyla ilgili olup olmadığı,
  değerlendirme cümlelerinin yanıltıcı olmaması). Otomatik skor değil, yapılandırılmış kontrol.
- **Kabul**: `docs/` altında kontrol listesi + birkaç örnek soru üzerinde uygulanmış sonuç.

---

## Öncelik Sırası (loop için önerilen yürütme sırası)

1. Faz 0 (tech debt — düşük risk, hızlı kazanç) → T0.1, T0.2, T0.5, T0.3, T0.4
2. Faz 1 (ton gevşetme — kullanıcının ana isteği) → T1.1 → T1.2 → T1.3 → T1.4
3. Faz 3.1 + 3.4 (test hijyeni ve güvenlik invariyantları — gevşetmeden sonra şart)
4. Faz 2 (yeni özellikler) → T2.6, T2.2, T2.3, T2.1, T2.4, T2.5
5. Faz 3.2, 3.3 (derin test) → Faz 4 (doküman)
6. Faz 5 (sürüm/changelog tutarlılığı) → T5.1 → T5.2
7. Faz 6 (v1 release readiness) → **önce must-have**: T6.1 → T6.2 → T6.3;
   sonra should-have: T6.4 → T6.5 → T6.6 → T6.7; en son nice-to-have: T6.8

**Her görev sonunda**: build + test yeşil → commit. Bir görev testi kırıyorsa, görev
tamamlanmadan sıradakine geçme; önce düzelt.
