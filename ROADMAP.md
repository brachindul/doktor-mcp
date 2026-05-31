# doktor-mcp — Geliştirme Roadmap'i

> Bu doküman otonom bir geliştirme döngüsü (ralph-loop / opencode orchestrator) tarafından
> tüketilmek üzere yazılmıştır. Her görev bağımsız tamamlanabilir; sırayla ilerle.
> Bir görevi bitirince: `git add -A && git commit` ile commit'le, ardından sıradakine geç.
>
> **Genel kurallar (her görevde geçerli):**
> - `npm run build` (tsc) **0 hata** vermeli.
> - `npm test` (vitest) **tamamen yeşil** kalmalı. Mevcut 1104 testi kırma.
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
- **Kabul (T7.4 ile güncellendi)**: Dört CLI (`verify:health-legislation`, `verify:discovered`,
  `verify:official-gazette`, `resolve:rg-leads`) çalıştırıldı. Sonuç: **0 terfi**. Cloudflare
  anti-bot koruması PDF'lere erişimi engelliyor; Resmî Gazete sayfaları içerik uyuşmazlığı
  veriyor. Tüm girdiler `needs_manual_review` olarak kaldı, her birine `v0.44.0 verification
  attempt` notu eklendi. `coveredOfficialLegislationCount` değişmedi. Uydurma kaynak üretilmedi.

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

#### [x] T6.8 — Hukukçu-gözüyle kalite kıyas seti
- **Yapılacak**: Mevcut teknik benchmark'a ek olarak, küçük bir "bu pakete bir avukat ne der"
  niteliksel kontrol listesi ekle (ör. seçilen emsalin gerçekten konuyla ilgili olup olmadığı,
  değerlendirme cümlelerinin yanıltıcı olmaması). Otomatik skor değil, yapılandırılmış kontrol.
- **Kabul**: `docs/` altında kontrol listesi + birkaç örnek soru üzerinde uygulanmış sonuç.

---

## Faz 7 — Faz 6 Must-Have Düzeltmeleri (Kalite Açıkları)

> Bu faz, Faz 6 sonrası canlı (`--sourceMode live`) inceleme ile tespit edilen gerçek
> açıkları kapatır. Faz 6 must-have'lerinin 3'ünden 2'si kabul kriterini karşılamadı ve
> T6.1 yeni bir HTML-hijyeni sorununu görünür kıldı. Bu faz v1 için bloklayıcıdır.

### [x] T7.1 — Karar metnindeki ham HTML'i temizle (sanitization)
- **Sorun**: `preliminaryAssessment` cümlelerinde `prec.outcome` hiç temizlenmeden
  basılıyor; hekime giden metinde ham HTML kalıyor: `<br>`, `&#39;`, `&#39;&#39;`,
  `</font></p></body></html>` vb. `answerComposer.ts`'de de `extractOutcome`/`extractLegalReasoning`
  zincirinde de HTML strip yok.
- **Dosya**: `src/sources/precedentUtils.ts` (extract noktası) + `src/health/answerComposer.ts`.
- **Yapılacak**:
  - Paylaşılan bir `stripHtmlToText(raw)` yardımcı yaz: HTML etiketlerini kaldır, HTML
    entity'lerini decode et (`&#39;`→`'`, `&amp;`→`&`, `&lt;`/`&gt;`, `&nbsp;` vb.),
    fazla boşluğu sadeleştir, baştaki/sondaki artık işaretleri at.
  - `outcome`, `legalAssessment`/`legalReasoning`, `factSummary`, `similarityDifference`
    gibi hekime dönük tüm serbest-metin alanlarını çıkış noktasında bu fonksiyondan geçir.
  - Çok uzun outcome metnini anlamlı bir cümle uzunluğuna kırp (ör. ilk cümle / ~200 char),
    sonuna `…` ekle. Ham metni `decisionSourceTrace` içinde bırakmak serbest; hekim-dönük
    alanlar temiz olmalı.
- **Kabul**: Test: HTML/entity içeren bir karar → assessment cümlesinde `<`, `>`, `&#`,
  `</` geçmiyor. Canlı smoke çıktısında ham HTML kalmıyor. Build + test yeşil.

### [x] T7.2 — T6.2 testini canlı/recorded-fixture'a çevir (mock yanıltması)
- **Sorun**: `tests/healthPrimaryLegislationPriority.test.ts` `sourceMode: "mock"` kullanıyor;
  mock veride Hasta Hakları zaten var, test geçiyor. Ama hata **canlı** modda: canlıda
  "Hekim kişisel sağlık verisini izinsiz paylaştı" sorusu **yalnızca KVKK m.6** döndürüyor,
  Hasta Hakları Yönetmeliği yüzeye çıkmıyor. Test gerçek bug'ı maskeliyor.
- **Yapılacak**:
  - Testi sanitize edilmiş **recorded-fixture** (canlı yanıt kaydı) ile yaz: gizlilik/kişisel-
    sağlık-verisi sorusunda sağlık-birincil mevzuat KVKK'dan **önce** sıralanmalı; aksi halde
    **hard-fail**.
  - Canlıda sağlık-birincil mevzuatın **neden çıkmadığını** teşhis et (mevzuat.gov.tr
    extraction fail mi, health mapping ateşlenmiyor mu, ranking mı eliyor) ve kök nedeni düzelt.
    Düzeltilemiyorsa en azından `selectionDiagnostics`/`coverageGaps`'e açık gerekçe düşür —
    sessizce KVKK'ya düşmesin.
  - Mock testi silme; canlı/recorded testi ek olarak koy.
- **Kabul**: Canlı/recorded test, KVKK'nın Hasta Hakları'nın önüne geçtiği (veya Hasta
  Hakları'nın hiç gelmediği) durumu hard-fail yapıyor; kök neden ya düzeltildi ya da
  diagnostic'te açık.

### [x] T7.3 — Emsal relevance eşiğini sıkılaştır (alakasız karar sızıntısı)
- **Sorun**: Gizlilik sorusuna gelen verified emsaller arasında konuyla **alakasız** kararlar
  var (tapu iptali/tescil — Yargıtay 1. HD; trafikte darp/suçun vasfı — Yargıtay 1. CD), ama
  hepsi "'hasta mahremiyeti' sağlık hukuku aramasıyla eşleşti" etiketiyle assessment'a giriyor.
  Relevance filtresi fazla gevşek.
- **Dosya**: `src/health/precedentRelevance.ts`, `src/health/precedentRerank.ts`,
  `src/health/answerComposer.ts`.
- **Yapılacak**:
  - `assessPrecedentRelevance` skoru düşük olan (zayıf relevance) kararlar **assessment
    cümlesi olarak üretilmesin**; verified listede kalabilir ama `preliminaryAssessment`'a
    yalnızca eşik üstü ilgili kararlar girsin.
  - Assessment cümlesinin "eşleşti" iddiası, gerçek issue-signal örtüşmesine dayansın; sadece
    geniş sağlık kelimesi yakaladıysa o cümleyi üretme (T6.1'deki "içerik yoksa üretme"
    kuralının relevance versiyonu).
  - Eşiği `runtimeConfig` üzerinden ayarlanabilir yap (varsayılan makul bir değer).
- **Kabul**: Test: bilinen alakasız karar (tapu/trafik fixture) → assessment cümlesi
  üretilmiyor; ilgili karar → üretiliyor. Canlı smoke'ta gizlilik sorusunun assessment'ında
  konu-dışı daire görünmüyor.

### [x] T7.4 — T6.3'ü çöz veya kabul kriterini dürüstçe düşür
- **Sorun**: T6.3 `[x]` işaretli ama commit'i "0 promoted" diyor; kabul kriteri "en az 3 girdi
  `covered`'a yükselsin" idi — tutturulmadı. İşaret ile gerçek uyuşmuyor.
- **Yapılacak** (ikisinden biri):
  - **(a)** Gerçekten kapat: mevcut doğrulama hattıyla en az 3 çekirdek yönetmeliği canlı
    gov.tr sourceId + RG ile doğrulayıp `covered` yap; uydurma kaynak yok. **VEYA**
  - **(b)** Kapatılamıyorsa: T6.3'ün kabul kriterini resmen "doğrulanamayan girdiler net
    gerekçeyle `needs_manual_review` kalır; coverage sayısı değişmeyebilir" olacak şekilde
    güncelle, ROADMAP'te T6.3 başlığını buna göre düzelt ve durumu CHANGELOG'a dürüstçe yansıt.
- **Kabul**: Ya `coveredOfficialLegislationCount` ≥ önceki+3, ya da T6.3 kabul kriteri ve
  işareti gerçekle tutarlı; her iki durumda da uydurma kaynak yok.

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
8. Faz 7 (Faz 6 kalite açıkları — v1 bloklayıcı) → T7.1 → T7.2 → T7.3 → T7.4

9. Faz 8 (kamu hekimi mevzuat genişlemesi) → T8.2 (önce engel) → T8.1 → T8.3 → T8.4
10. Faz 9 (kamu retrieval gerçekten çalışsın — BLOKLAYICI) → T9.1 → T9.2 → T9.3 → T9.4
11. Faz 10 (emsal ilgililik kalitesi) → T10.1 → T10.2 → T10.3
12. Faz 11 (kanun katmanı) → T11.1 → T11.2 → T11.3
13. Faz 12 (retrieval sağlamlığı) → T12.1 → T12.2 → T12.3 → T12.4
14. Faz 13 (çıktı/ürün kalitesi) → T13.1 → T13.2 → T13.3
15. Faz 14 (test/CI/kod kalitesi) → T14.1 → T14.2 → T14.3 → T14.4
16. Faz 15 (güvenlik/uyum) → T15.1 → T15.2 → T15.3
17. Faz 16 (gözlemlenebilirlik/DX) → T16.1 → T16.2 → T16.3
18. Faz 17 (klinik kapsam genişlemesi) → T17.1 → T17.2
19. Faz 18 (v1.0.0 sürüm hazırlığı) → T18.1 → T18.2 → T18.3

**Her görev sonunda**: build + test yeşil → commit. Bir görev testi kırıyorsa, görev
tamamlanmadan sıradakine geçme; önce düzelt.

---

## Faz 8 — Kamu Hekimi Mevzuat Genişlemesi

> **Hedef**: Kamuda çalışan hekimi çalışırken ilgilendiren YÖNETMELİK'leri aracın kaynak
> şemsiyesine almak. Mevcut kapsam ağırlıkla klinik/hasta ekseni; kamu hekiminin
> özlük/istihdam/disiplin/eğitim ekseni neredeyse yok. Tüm metinler resmî gov.tr
> kaynaklarından (`mevzuat.gov.tr` birincil, `resmigazete.gov.tr` ikincil) çekilir.
> Kaynak deseni: `mevzuat.gov.tr/mevzuat?MevzuatNo=<no>&MevzuatTur=7&MevzuatTertip=5`
> → sourceId **`mevzuat:7.5.<no>`**, tam metin `mevzuat.gov.tr/mevzuatmetin/7.5.<no>.pdf`.
> **Uydurma kaynak/metin yasak**; doğrulanamayan girdi dürüstçe `needs_manual_review` kalır.

### [x] T8.2 — Cloudflare/bot-koruması PDF fetch engelini çöz (ÖNCE bu)
- **Sorun**: T7.4'te `mevzuat.gov.tr/mevzuatmetin/*.pdf` otomatik fetch Cloudflare/bot
  korumasına takıldı; 6 girdi bu yüzden doğrulanamadı. Bu engel çözülmeden yeni girdiler de
  doğrulanamaz. Bu yüzden Faz 8'in ilk adımı budur.
- **Dosya**: `src/sources/legislation/liveOfficialLegislationAdapter.ts` (`fetchOfficialDocument`),
  `src/core/httpClient.ts`.
- **Yapılacak**:
  - Gerçekçi tarayıcı header'ları gönder (`User-Agent`, `Accept`, `Accept-Language`,
    `Referer: https://www.mevzuat.gov.tr/`).
  - PDF doğrudan 403/Cloudflare dönerse, önce landing sayfasını (`?MevzuatNo=...`) çek,
    içinden gerçek PDF/metin linkini ayrıştır, sonra onu indir (fallback yolu).
  - Engel kalıcıysa, hatayı `errorCode: "source_blocked_cloudflare"` olarak yapılandır;
    sessiz timeout değil, açık teşhis üret.
- **Kabul**: En az bir bilinen yönetmelik (ör. `mevzuat:7.5.17232`) canlı olarak çekilip
  metni çıkarılabiliyor; engel sürerse yapılandırılmış `source_blocked_cloudflare` hatası
  dönüyor (uydurma metin yok). Test: header'ların gönderildiğini ve fallback yolunu doğrulayan
  birim testi.

### [x] T8.1 — Kamu özlük/disiplin yönetmeliklerini envantere ekle (A grubu)
- **Yapılacak**: Aşağıdaki girdileri `healthLegislationInventory.ts`'e ekle. SourceId verilenleri
  doğrudan kullan; verilmeyenleri `mevzuat.gov.tr` başlık aramasıyla (mevcut search hattı) çöz.
  Her birine uygun `markerTerms`/`aliases`/`searchTerms` ver. Doğrulananı `candidate`/`covered`,
  doğrulanamayanı gerekçeyle `needs_manual_review` yap.
  1. **Sağlık Bakanlığı ve Bağlı Kuruluşları Atama ve Yer Değiştirme Yönetmeliği** —
     `mevzuat:7.5.17232` (RG 26.03.2013 / 28599)
  2. **Sağlık Bakanlığı Personeli Görevde Yükselme ve Unvan Değişikliği Yönetmeliği** —
     sourceId aramayla
  3. **Sağlık Bakanlığı Disiplin Amirleri Yönetmeliği** — mevcut "disiplin" aday girdisini
     bununla netleştir (2026 güncel metin)
  4. **Sözleşmeli Sağlık Personeli Disiplin ile Disiplin Kurulları Hakkında Yönetmelik** —
     sourceId aramayla
  5. **4924 sayılı Kanuna Tabi Sözleşmeli Sağlık Personeli Atama ve Yer Değiştirme Yönetmeliği** —
     sourceId aramayla
  6. **Kamu Kurum ve Kuruluşlarına Açıktan Kura ile Atanacak Bazı Sağlık Personelinin Atama
     Esas ve Usulleri Yönetmeliği** — sourceId aramayla
- **Health mapping**: `medicalIssueRouter` + `healthMappings`'e yeni konu kümeleri ekle:
  `public_employment` (tayin/atama), `transfer_assignment` (yer değiştirme/eş-mazeret),
  `disciplinary_administrative` (disiplin soruşturması — mevcut, terimleri genişlet).
- **Kabul (T9.4 ile güncellendi)**: 6 girdi envanterde. Atama Yönetmeliği (`mevzuat:7.5.17232`) canlı doğrulandı — status `covered`. Diğer 5 girdi `candidate`/`needs_manual_review` (canlı search empty — Cloudflare). Router kamu-özlük sorgularını doğru kümeye yönlendiriyor (E2E testler yeşil).

### [x] T8.3 — Eğitim / hizmet / mali / klinik-adli yönetmelikleri ekle (B–E grupları)
- **Yapılacak**: Aşağıdakileri ekle ve canlı gov.tr ile doğrula; doğrulanamayanı dürüstçe
  `needs_manual_review` bırak (uydurma yok):
  - **Tıpta ve Diş Hekimliğinde Uzmanlık Eğitimi Yönetmeliği (TUEY)** — `mevzuat:7.5.39700`
  - **Sağlık Uzmanlığı Yönetmeliği** — sourceId aramayla
  - **Hasta ve Çalışan Güvenliğinin Sağlanmasına Dair Yönetmelik** — RG 06.04.2011 / 27897
    (RG lead'den sourceId çöz)
  - **Sağlık Hizmeti Kalitesinin Geliştirilmesi ve Değerlendirilmesine Dair Yönetmelik**
  - **Yataklı Tedavi Kurumları İşletme Yönetmeliği** — mevcut `deferred` girdiyi aktive et
  - **Tıbbi Kötü Uygulamaya İlişkin Zorunlu Mali Sorumluluk Sigortası** — mevcut deferred
    "mali sorumluluk" girdisini bununla netleştir
  - **Sağlık Bakanlığına Bağlı Sağlık Tesislerinde Görevli Personele Ek Ödeme Yönetmeliği**
  - **Aile Hekimliği Uygulama Yönetmeliği** (ölü muayene/adli olgu görevleri)
  - **Mezarlık Yerlerinin İnşaası ile Cenaze Nakil ve Defin İşlemleri Hakkında Yönetmelik**
  - Not: **Devlet Hizmeti Yükümlülüğü (mecburi hizmet)** ve **Umumi Hıfzıssıhha** *kanun*
    düzeyindedir; yönetmelik değildir — bunları "kanun" katmanına ekle, yönetmelik envanterine değil.
- **Kabul**: Girdiler envanterde uygun `coverageStatus` ile; canlı doğrulanabilenler `covered`;
  her yeni girdinin health mapping'i var; testler yeşil.

### [x] T8.4 — Kamu hekimi sorgu yönlendirme + canlı regresyon testi
- **Yapılacak**: `medicalIssueRouter`'a kamu hekimi sorgu kümelerini ekle (tayin, mecburi
  hizmet, disiplin soruşturması, ek ödeme/performans, nöbet/icap, görevde yükselme) ve
  bunları doğru yönetmeliğe map et. Canlı/recorded-fixture regresyon testi yaz: ör.
  "tayin talebim reddedildi" → Atama ve Yer Değiştirme Yönetmeliği birincil; "hakkımda
  disiplin soruşturması açıldı" → Disiplin Amirleri Yönetmeliği birincil.
- **Kabul**: En az 4 kamu-hekimi sorgu profili için doğru birincil yönetmelik dönüyor;
  test hard-fail invariyantı içeriyor; build + test yeşil. README/CHANGELOG güncel.

---

> ## ⚙️ Faz 9+ için genel yürütme notu (otonom gece koşusu)
>
> Bundan sonraki tüm fazlar **uçtan uca (end-to-end) doğrulama** ilkesine tabidir:
> - **İzole test maskelemesi YASAK.** Bir özelliği yalnızca alt-fonksiyon (router, mapper)
>   seviyesinde test etme; **tam pakette** (`prepareInformationPack`) doğrula. Kullanıcının
>   gerçekte aldığı çıktı neyse onu test et.
> - **Dürüst işaretleme.** Bir görevi ancak "Kabul"un TAMAMI gerçekten karşılanıyorsa `[x]`
>   yap. Kısmense `[ ]` bırak + commit mesajında nedenini yaz.
> - **Uydurma yok.** Mevzuat/karar/sourceId/metin asla uydurma. Doğrulanamayan girdi
>   gerekçeyle `needs_manual_review`/`candidate` kalır.
> - **Her görev = ayrı commit**, build + test yeşil olmadan commit etme.

---

## Faz 9 — Kamu Mevzuat Retrieval'i Gerçekten Çalıştır (Faz 8 kapanışı, BLOKLAYICI)

> Faz 8 metadata/iskele kurdu ama canlı incelemede kamu sorgusu hiç yönetmelik döndürmedi
> (canlı: `mevzuat.gov.tr source_error`; mock: provision yok). Bu faz özelliği gerçekten
> kullanılabilir yapar.

### [x] T9.1 — mevzuat.gov.tr canlı fetch'i gerçekten çöz
- **Sorun**: T8.2 header/fallback ekledi ama canlı hâlâ `source_error`; yeni girdiler
  `covered` olamadı.
- **Yapılacak**: `mevzuat:7.5.17232` (Atama) canlı çekilip metni çıkana kadar fetch yolunu
  düzelt. Sırasıyla dene: (a) doğru başlıklarla doğrudan PDF; (b) landing sayfasından gerçek
  PDF/doc linki ayrıştırıp indirme; (c) `resmigazete.gov.tr` ikincil yolu. Gerçek engel varsa
  `source_blocked_cloudflare` ile net raporla — ama önce (b) ve (c) tüketilsin.
- **Kabul**: En az Atama Yönetmeliği'nin metni canlı olarak çıkarılıp en az 1 madde
  döndürülüyor; smoke `npm run verify:health-legislation` ile gösteriliyor. Build+test yeşil.

### [x] T9.2 — Yeni kamu/eğitim yönetmelikleri için mock provision ekle
- **Sorun**: `mockLegislationAdapter`/`mockData`'da yeni yönetmelikler için hüküm yok; mock
  modda hiç görünmüyorlar, offline demo/test imkânsız.
- **Yapılacak**: En az şu girdiler için gerçek madde metniyle (resmî kaynaktan birebir alıntı,
  uydurma değil) mock provision ekle: Atama ve Yer Değiştirme (eş/mazeret/2 yıl maddeleri),
  Disiplin Amirleri, Hasta ve Çalışan Güvenliği, TUEY. Mock fixture'a kaydet.
- **Kabul**: Mock modda kamu sorgusu bu yönetmelikleri provision olarak döndürüyor; metinler
  resmî kaynakla birebir; test var.

### [x] T9.3 — Uçtan uca pack testi (router değil, tam paket)
- **Yapılacak**: `prepareInformationPack` üzerinden hard-fail testler:
  - mock: "tayin talebim reddedildi" → `relevantLegislation`'da Atama Yönetmeliği **birincil**.
  - mock: "hakkımda disiplin soruşturması açıldı" → Disiplin Amirleri Yönetmeliği birincil.
  - canlı/recorded: aynı sorgular için en az birincil yönetmelik geliyor.
- **Kabul**: Testler tam pakette doğruluyor (izole router değil); birincil yanlışsa hard-fail.

### [x] T9.4 — Faz 8 işaretlerini ve coverage durumunu dürüstçe düzelt
- **Yapılacak**: T8.1/T8.4 kabul gerçeğe göre güncellensin; `coverageStatus` gerçek
  doğrulama durumunu yansıtsın; CHANGELOG'a "kamu retrieval Faz 9'da tamamlandı" düzeltmesi.
- **Kabul**: İşaret ↔ gerçek tutarlı; covered sayısı gerçek doğrulananları yansıtıyor.

---

## Faz 10 — Emsal (Precedent) İlgililik Kalitesi

> Canlı incelemede gizlilik sorusunda assessment'a 0 emsal cümlesi girdi (hiçbiri eşik üstü
> ilgili değildi) ve kamu sorgusunda Danıştay idari kararları konuyla zayıf eşleşti. Emsal
> arama/sıralama kalitesi v1 sonrası en büyük ürün açığı.

### [x] T10.1 — Konu-bazlı emsal sorgu genişlemesi (kamu + gizlilik)
- **Yapılacak**: `healthLawQueryExpansion`'a kamu hekimi ve gizlilik eksenleri ekle:
  tayin/yer değiştirme → idari dava terimleri; disiplin → "disiplin cezası iptali";
  gizlilik → "özel hayatın gizliliği sağlık verisi". Danıştay'ı idari uyuşmazlıklarda
  birincil kaynağa al (mevcut `prioritizeSourcesByIssue`'yu genişlet).
- **Kabul**: Recorded-fixture testi: kamu/gizlilik sorgularında ilgili daire kararları
  zayıf-ilgili olanların önüne geçiyor.

### [x] T10.2 — İlgililik skorlamasını iyileştir (issue-signal ağırlıkları)
- **Yapılacak**: `precedentRelevance` issue-signal sözlüğünü genişlet; gövde metninde konu
  terimlerinin yoğunluğuna göre ağırlık ver; sadece geniş "sağlık" kelimesi yakalayan kararın
  skorunu düşür. Eşik (`assessment.minRelevanceScore`) ve sıralama bu sinyale dayansın.
- **Kabul**: Bilinen alakasız fixture (tapu/trafik) skoru eşik altında; ilgili fixture üstünde.

### [x] T10.3 — "Neden bu emsal" şeffaflığı çıktıya
- **Yapılacak**: Her verified emsal için `relevanceExplanation` (eşleşen issue terimleri +
  kısa gerekçe) hekim-dönük çıktıya eklensin; Markdown renderer göstersin.
- **Kabul**: Çıktıda her emsal neden seçildiğini taşıyor; test var.

---

## Faz 11 — Kanun (Statute) Katmanı

> Envanter şu an kanun ile yönetmeliği karıştırıyor (DHY, Umumi Hıfzıssıhha, 657 aslında
> kanun). Kamu hekimi için 657 kritik. Düzgün bir kanun katmanı gerekli.

### [x] T11.1 — Kanun/yönetmelik tip ayrımı
- **Yapılacak**: Envantere `legislationType: "kanun" | "yonetmelik" | "nizamname" | "teblig"`
  alanı ekle; sourceId tertip kodundan (1=kanun, 7=yönetmelik) türet/teyit et; çıktı ve
  diagnostics tipi göstersin.
- **Kabul**: Her girdi doğru tiplenmiş; test var.

### [x] T11.2 — Çekirdek kanunları ekle/doğrula
- **Yapılacak**: **657 Devlet Memurları Kanunu** (`mevzuat:1.5.657` — kamu hekimi için temel,
  disiplin/özlük), **Umumi Hıfzıssıhha Kanunu 1593** (`mevzuat:1.3.1593`), **5237 TCK**'nın
  hekimi ilgilendiren maddeleri (taksirle yaralama/öldürme, görevi kötüye kullanma — madde
  bazlı), **DHY** (3359 Ek Madde 3–6). Canlı doğrula; doğrulanamayanı dürüstçe işaretle.
- **Kabul**: En az 657 + 1593 canlı doğrulanmış; TCK madde-bazlı eşleşme çalışıyor; test var.

### [x] T11.3 — Kanun + yönetmelik birlikte sıralama
- **Yapılacak**: Pack ordering: konuya göre birincil yönetmelik → ilgili kanun → destekleyici
  genel kanun. Disiplin sorgusunda Disiplin Amirleri Yön. + 657 disiplin maddeleri birlikte.
- **Kabul**: Uçtan uca test: disiplin sorgusu hem yönetmeliği hem 657'yi doğru sırada döndürüyor.

---

## Faz 12 — Retrieval Sağlamlığı ve Canlı Kaynak Dayanıklılığı

### [ ] T12.1 — Mevzuat sonuç önbelleği (legislation cache)
- **Yapılacak**: `PrecedentCache` mantığını mevzuat tarafına da getir: doğrulanmış sourceId →
  çıkarılmış madde metni dosya önbelleği (TTL'li, `.cache/legislation/`). Canlı çağrı öncesi
  önbelleği kontrol et.
- **Kabul**: İkinci çağrı önbellekten geliyor; telemetri hit/miss gösteriyor; test var.

### [ ] T12.2 — Yapılandırılmış hata taksonomisini tamamla
- **Yapılacak**: Tüm canlı kaynaklar için tutarlı `errorCode` seti (network, timeout,
  blocked_cloudflare, non_json, parse, not_found, empty). Her kod için `recommendedNextStep`.
- **Kabul**: Hata kodları dokümante (`docs/ERROR_CODES.md`); test her kodu üretebiliyor.

### [ ] T12.3 — Offline snapshot/demo modu
- **Yapılacak**: Kaydedilmiş gerçek yanıtlardan (`fixtures/live-samples/`) beslenen bir
  `sourceMode: "snapshot"` ekle: ağ olmadan gerçekçi çıktı üretir (demo/sunum/test için).
  Mock'tan farkı: gerçek sanitize edilmiş kaynak metinleri.
- **Kabul**: `smoke:mcp --sourceMode snapshot` ağsız çalışıyor, gerçek metin döndürüyor; test var.

### [ ] T12.4 — Canlı kaynak sağlık kontrolü CLI
- **Yapılacak**: `npm run health:sources` — tüm canlı kaynakları (mevzuat, bedesten,
  danistay) yoklayıp erişilebilirlik + gecikme + engel durumu raporlar.
- **Kabul**: Tek komut tüm kaynakların güncel statüsünü yazıyor; uydurma yok.

---

## Faz 13 — Çıktı / Ürün Kalitesi

### [ ] T13.1 — `preliminaryAssessment`'i madde-atıflı zenginleştir
- **Yapılacak**: Mevzuat cümleleri madde numarasını ve somut yükümlülüğü (alıntıdan
  türetilmiş, uydurma değil) belirtsin; emsal cümleleri daire + tarih + kısa sonuç içersin.
- **Kabul**: Cümleler madde/karar künyesi taşıyor; her cümlede `sourceRef`; test var.

### [ ] T13.2 — `missingInformation` ve `lawyerReviewPoints` otomatik kalitesi
- **Yapılacak**: Konuya göre anlamlı eksik-bilgi ve avukat-inceleme noktaları üret (ör. kamu
  disiplininde: savunma süresi, zamanaşımı, yetkili kurul). Şablon değil, konu-duyarlı.
- **Kabul**: Farklı konularda farklı, isabetli noktalar; test konu-duyarlılığı doğruluyor.

### [ ] T13.3 — Markdown renderer'ı çok-eksenli pakete uyarla
- **Yapılacak**: Klinik + idari/özlük eksenlerini ayrı başlıklarla göster; kanun/yönetmelik
  ayrımını işaretle; emsal ilgililik notunu ekle.
- **Kabul**: Render deterministik, yeni alanları gösteriyor; test güncel.

---

## Faz 14 — Test, CI ve Kod Kalitesi Altyapısı

### [ ] T14.1 — GitHub Actions CI
- **Yapılacak**: `.github/workflows/ci.yml` — push/PR'da `npm ci`, `npm run build`,
  `npm test`, `npm run test:coverage`. Canlı testleri ağ gerektirmeyecek şekilde ayır
  (live testler `describe.skipIf(!process.env.LIVE)` ile koşullu).
- **Kabul**: CI workflow var; mock/offline testler CI'da yeşil; canlı testler opt-in.

### [ ] T14.2 — Lint + format (ESLint + Prettier)
- **Yapılacak**: ESLint (typescript-eslint) + Prettier ekle; `npm run lint`, `npm run format`;
  mevcut kodu uyumlu hale getir (davranış değişmeden). CI'a lint adımı ekle.
- **Kabul**: `npm run lint` 0 hata; format tutarlı; build+test yeşil.

### [ ] T14.3 — Record/replay test harness'ı (canlı adapterler)
- **Yapılacak**: Canlı adapter yanıtlarını kaydedip (sanitize) replay eden ortak bir harness;
  böylece canlı yollar ağsız, deterministik test edilir. Mevcut fixture testlerini buna taşı.
- **Kabul**: Her canlı adapter için record/replay testi var; ağsız çalışıyor.

### [ ] T14.4 — "İzole-test maskelemesi" koruması (e2e smoke gate)
- **Yapılacak**: Her büyük özellik için en az bir `prepareInformationPack` seviyesinde e2e
  smoke testi zorunlu; bir kontrol listesi/CI adımı bunu hatırlatsın. Geçmiş izole-test
  maskelemelerini (T6.2, T8.4) e2e ile kapat.
- **Kabul**: Kamu + klinik + gizlilik için e2e smoke testleri mevcut ve yeşil.

---

## Faz 15 — Güvenlik ve Uyum

### [ ] T15.1 — SSRF / URL güvenliği
- **Yapılacak**: Link checker ve resmî doc verifier yalnızca izinli gov.tr host'larına istek
  atsın (allowlist); redirect'leri host bazında doğrula; iç ağ/localhost adreslerini reddet.
- **Kabul**: Allowlist dışı/iç-ağ URL reddediliyor; test kötü URL'leri kapsıyor.

### [ ] T15.2 — PII/gizlilik hijyeni
- **Yapılacak**: Hiçbir hasta/kişisel veri log'a veya cache anahtarına sızmasın; soru metni
  cache key'inde hash'lensin; telemetri PII içermesin.
- **Kabul**: Test: PII içeren soru → cache key/log'da ham metin yok.

### [ ] T15.3 — Bağımlılık denetimi ve sabitleme
- **Yapılacak**: `npm audit` temizliği; sürümleri makul sabitle; gereksiz bağımlılıkları at;
  `package.json` `engines` ekle.
- **Kabul**: `npm audit` kritik/yüksek 0; build+test yeşil.

---

## Faz 16 — Gözlemlenebilirlik ve Geliştirici Deneyimi

### [ ] T16.1 — Tek-komut teşhis CLI'ı
- **Yapılacak**: `npm run doctor:diagnose -- "<soru>" --sourceMode live` — soruyu tüm
  katmanlardan geçirip sınıflandırma, yönlendirme, mevzuat seçimi, emsal seçimi ve tüm
  trace'leri okunaklı tek raporda gösterir (debug için).
- **Kabul**: Komut tüm hattı tek çıktıda gösteriyor; JSON + okunaklı özet.

### [ ] T16.2 — Bayrak-arkası yapılandırılmış log
- **Yapılacak**: `DOKTOR_MCP_LOG=debug` ile yapılandırılmış (JSON) log; MCP stdio çıktısını
  kirletmeyecek şekilde stderr'e; varsayılan kapalı.
- **Kabul**: Log açık/kapalı çalışıyor; MCP JSON çıktısı kirlenmiyor; test var.

### [ ] T16.3 — Kapsam matrisi otomatik üretimi
- **Yapılacak**: Envanterden `docs/COVERAGE_MATRIX.md` üreten bir script: her mevzuat, tipi,
  kaynak statüsü, coverageStatus, sourceId/RG. CI'da güncelliğini kontrol et.
- **Kabul**: Matris script'le üretiliyor; CHANGELOG/README ile tutarlı.

---

## Faz 17 — Klinik Mevzuat Kapsam Genişlemesi

### [ ] T17.1 — Eksik klinik yönetmelikleri ekle (canlı doğrulamalı)
- **Yapılacak**: Kan ve Kan Ürünleri Yön., Diyaliz Merkezleri Yön., Yoğun Bakım/Enfeksiyon
  Kontrol düzenlemeleri, Radyasyon Güvenliği Yön., Beşeri Tıbbi Ürünler/Reçete düzenlemeleri,
  Bağışıklama/aşı düzenlemeleri. Her birini gov.tr ile doğrula; doğrulanamayanı dürüstçe işaretle.
- **Kabul**: Her yeni girdi health mapping + (mümkünse) canlı `covered`; uçtan uca test örnekleri.

### [ ] T17.2 — Branş-özel görev/sorumluluk eşlemeleri
- **Yapılacak**: Sık branşlar için (acil, aile hekimliği, anestezi, radyoloji, psikiyatri)
  konu kümeleri ve birincil mevzuat eşlemeleri; soru sınıflandırıcıya branş ipuçları.
- **Kabul**: Branş sorguları doğru birincil mevzuata gidiyor; uçtan uca test.

---

## Faz 18 — v1.0.0 Sürüm Hazırlığı

### [ ] T18.1 — v1.0.0 release checklist ve dondurma
- **Yapılacak**: `docs/RELEASE_v1.md` — stable/experimental alan listesi kesinleşmiş,
  tüm e2e smoke'lar yeşil, coverage matrisi güncel, error kodları dokümante. Sürümü
  `1.0.0`'a hazırla (CHANGELOG + package.json + lock + version testi).
- **Kabul**: Checklist'teki her madde işaretli ve doğrulanmış; build+test yeşil.

### [ ] T18.2 — README'yi v1 ürün anlatısına çek
- **Yapılacak**: Kullanım, kapsam matrisi linki, sınırlılıklar (emsal ilgililiği, canlı kaynak
  engelleri), güvenlik notları. Test edilmemiş iddia bırakma.
- **Kabul**: README iddiaları e2e testlerle örtüşüyor; sürüm tutarlı.

### [ ] T18.3 — Son bütünsel canlı doğrulama turu
- **Yapılacak**: Temsili 10 soruluk set (klinik + kamu/özlük + gizlilik + adli) üzerinde canlı
  benchmark; sonuçları `exports/` + bir özet rapora yaz; regresyon/güvenlik invariyantları yeşil.
- **Kabul**: 10 sorunun her biri için pack üretiliyor veya dürüst no-pack diagnostic'i var;
  unsafe/uydurma yok.
