# doktor-mcp — Geliştirme Roadmap'i

> Bu doküman otonom bir geliştirme döngüsü (ralph-loop / opencode orchestrator) tarafından
> tüketilmek üzere yazılmıştır. Her görev bağımsız tamamlanabilir; sırayla ilerle.
> Bir görevi bitirince: `git add -A && git commit` ile commit'le, ardından sıradakine geç.
>
> **Genel kurallar (her görevde geçerli):**
> - `npm run build` (tsc) **0 hata** vermeli.
> - `npm test` (vitest) **tamamen yeşil** kalmalı. Mevcut 1020 testi kırma.
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

### [ ] T8.2 — Cloudflare/bot-koruması PDF fetch engelini çöz (ÖNCE bu)
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

### [ ] T8.1 — Kamu özlük/disiplin yönetmeliklerini envantere ekle (A grubu)
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
- **Kabul**: 6 girdi envanterde; en az atama/disiplin ikilisi canlı doğrulanmış (`covered`);
  router kamu-özlük sorgularını (tayin, yer değiştirme, disiplin soruşturması) doğru kümeye
  yönlendiriyor; testler yeşil.

### [ ] T8.3 — Eğitim / hizmet / mali / klinik-adli yönetmelikleri ekle (B–E grupları)
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

### [ ] T8.4 — Kamu hekimi sorgu yönlendirme + canlı regresyon testi
- **Yapılacak**: `medicalIssueRouter`'a kamu hekimi sorgu kümelerini ekle (tayin, mecburi
  hizmet, disiplin soruşturması, ek ödeme/performans, nöbet/icap, görevde yükselme) ve
  bunları doğru yönetmeliğe map et. Canlı/recorded-fixture regresyon testi yaz: ör.
  "tayin talebim reddedildi" → Atama ve Yer Değiştirme Yönetmeliği birincil; "hakkımda
  disiplin soruşturması açıldı" → Disiplin Amirleri Yönetmeliği birincil.
- **Kabul**: En az 4 kamu-hekimi sorgu profili için doğru birincil yönetmelik dönüyor;
  test hard-fail invariyantı içeriyor; build + test yeşil. README/CHANGELOG güncel.
