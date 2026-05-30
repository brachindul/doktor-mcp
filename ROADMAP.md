# doktor-mcp — Geliştirme Roadmap'i

> Bu doküman otonom bir geliştirme döngüsü (ralph-loop / opencode orchestrator) tarafından
> tüketilmek üzere yazılmıştır. Her görev bağımsız tamamlanabilir; sırayla ilerle.
> Bir görevi bitirince: `git add -A && git commit` ile commit'le, ardından sıradakine geç.
>
> **Genel kurallar (her görevde geçerli):**
> - `npm run build` (tsc) **0 hata** vermeli.
> - `npm test` (vitest) **tamamen yeşil** kalmalı. Mevcut 889 testi kırma.
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

### T2.1 — Canlı AYM adapteri araştırması (şu an mock-only)
- **Yapılacak**: `kararlarbilgibankasi.anayasa.gov.tr` için bir probe CLI genişletmesi yaz
  (`probe:precedents --source aym`). Endpoint erişilebilirse `LiveAymAdapter` iskeletini kur;
  erişilemezse `calibrationStatus` raporuna `synthetic_only` gerekçesini yaz.
- **Kabul**: Probe çıktısı AYM için net statü veriyor; live adapter eklendiyse mock ile
  aynı `PrecedentSourceAdapter` arayüzünü uyguluyor; uydurma karar üretmiyor.

### T2.2 — Mevzuat değişiklik/yürürlük tarihi doğrulaması
- **Sorun**: Mevzuat maddesi alıntılanırken yürürlükten kalkmış olabilir.
- **Yapılacak**: `LiveOfficialLegislationAdapter` çıktısına madde için `inForce` /
  `lastAmendedDate` / `repealed` metadata ekle (mevzuat.gov.tr metadata'sından çıkarılabildiğince).
  Çıkarılamıyorsa `inForce: "unknown"` döndür — asla "yürürlükte" varsayma.
- **Kabul**: Provision tipi yeni alanları taşıyor; pack audit yürürlük bilinmiyorsa uyarı veriyor.

### T2.3 — Provision/karar deduplication ve çapraz-kaynak birleştirme
- **Yapılacak**: Aynı kararın hem Yargıtay hem Bedesten yolundan gelmesi durumunda
  `buildDecisionKey` ile dedupe et; çakışan metinlerde en zengin (tam metin + gerekçeli)
  olanı seç. Diagnostics'e `dedupedCount` ekle.
- **Kabul**: Test: aynı doc id farklı kaynaklardan → tek kayıt; en zengin metin seçiliyor.

### T2.4 — Çıktı için resmî kaynak URL doğrulaması (link-rot guard)
- **Yapılacak**: `officialGazetteDocumentVerifier.ts` mantığını pack çıktısındaki her
  `sourceUrl` için opsiyonel HEAD-check ile genişlet (live mod, time-budget içinde).
  Erişilemeyen link `linkStatus: "unreachable"` işaretlensin, paket bloklanmasın.
- **Kabul**: Time-budget aşılmıyor; başarısız link paketi düşürmüyor; test mock fetch ile yazılı.

### T2.5 — MCP `resources` ve `prompts` desteği
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

### T3.2 — Live adapter'lar için kayıtlı-yanıt (recorded fixture) entegrasyon testleri
- **Yapılacak**: `fixtures/live-samples/` sanitize edilmiş yanıtlarla Yargıtay/Danıştay/Mevzuat
  adapter'larının `searchAndNormalize` yolunu uçtan uca testle (fetch mock'lanır). Network'e
  çıkmadan gerçek parse yollarını kapsa.
- **Kabul**: Her live adapter için en az 1 happy-path + 1 non-JSON/hata-path testi.

### T3.3 — Coverage ölçümü ve eşik
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

### T4.1 — README'yi sürümler ve kullanım olarak ayır
- **Sorun**: README çok uzun; sürüm notları ile kullanım iç içe.
- **Yapılacak**: Sürüm geçmişini `CHANGELOG.md`'ye taşı (zaten var, oraya konsolide et);
  README sadece güncel mimari + kullanım + araç sözleşmesini tutsun.
- **Kabul**: README belirgin kısalıyor; CHANGELOG tüm sürüm notlarını içeriyor; link'ler kırık değil.

### T4.2 — Mimari diyagram ve veri akışı
- **Yapılacak**: `docs/ARCHITECTURE.md` ekle: katmanlar (mcp → service → health → sources →
  core/live), mock/live ayrımı, time-budget akışı, güvenlik kapıları. Mermaid diyagramı kullan.
- **Kabul**: Yeni doküman kod gerçeğiyle uyumlu; dosya/satır referansları doğru.

### T4.3 — Commit author/metadata düzeltme rehberi
- **Sorun**: `git shortlog -sne` boş — author metadata tutarsız.
- **Yapılacak**: `CONTRIBUTING.md` ekle; commit konvansiyonu, author ayarı, build/test
  ön-koşulları yazılsın. (Geçmişi rewrite etme — sadece ileriye dönük kural.)
- **Kabul**: CONTRIBUTING.md mevcut; yeni commit'ler doğru author taşıyor.

---

## Öncelik Sırası (loop için önerilen yürütme sırası)

1. Faz 0 (tech debt — düşük risk, hızlı kazanç) → T0.1, T0.2, T0.5, T0.3, T0.4
2. Faz 1 (ton gevşetme — kullanıcının ana isteği) → T1.1 → T1.2 → T1.3 → T1.4
3. Faz 3.1 + 3.4 (test hijyeni ve güvenlik invariyantları — gevşetmeden sonra şart)
4. Faz 2 (yeni özellikler) → T2.6, T2.2, T2.3, T2.1, T2.4, T2.5
5. Faz 3.2, 3.3 (derin test) → Faz 4 (doküman)

**Her görev sonunda**: build + test yeşil → commit. Bir görev testi kırıyorsa, görev
tamamlanmadan sıradakine geçme; önce düzelt.
