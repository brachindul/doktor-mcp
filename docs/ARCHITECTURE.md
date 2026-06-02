# doktor-mcp Mimarisi

## Genel Bakış

doktor-mcp, hekimlere kaynak-temelli hukuki bilgilendirme paketleri sağlayan bir Model
Context Protocol (MCP) sunucusudur. Resmî Türk mevzuatını ve yüksek mahkeme kararlarını
arar, bunları güvenlik kapılarıyla yapılandırılmış paketler halinde birleştirir.

## Katman Diyagramı

```mermaid
graph TD
    A[MCP İstemcisi / LLM] --> B[MCP Sunucu Katmanı]
    B --> C[Servis Katmanı]
    C --> D[Health Katmanı]
    C --> E[Kaynak Adaptörleri]
    E --> F[Canlı Kaynaklar]
    E --> G[Mock Veri]
    D --> H[Paket Çıktısı]

    subgraph "MCP Katmanı (src/mcp/)"
        B1[server.ts — STDIO Transport]
        B2[tools.ts — Araç Kaydı]
        B3[formatDoctorPackResponse.ts — Güvenlik Kapıları]
    end

    subgraph "Servis Katmanı (src/app/)"
        C1[service.ts — Koordinatör]
        C2[legislationPhase.ts — Bütçe-sınırlı]
        C3[precedentPhase.ts — Çok-kaynaklı]
        C4[minimalPackRescue.ts — Düşürülmüş Geri-dönüş]
    end

    subgraph "Health Katmanı (src/health/)"
        D1[answerComposer.ts — Paket Birleştirme]
        D2[precedentFilter.ts — Uygunluk]
        D3[decisionDedup.ts — Çapraz-kaynak Dedup]
        D4[linkHealthChecker.ts — URL Doğrulama]
        D5[questionClassifier.ts — Boyut Etiketleme]
        D6[precedentRelevance.ts — Konu Profilleme]
        D7[precedentRerank.ts — İlgililik Yeniden-sıralama]
    end

    subgraph "Kaynak Katmanı (src/sources/)"
        E1[Yargitay — emsal.yargitay.gov.tr]
        E2[Danistay — karararama.danistay.gov.tr]
        E3[Legislation — mevzuat.gov.tr]
        E4[Bedesten — bedesten.adalet.gov.tr]
        E5[AYM — Yalnızca Sentetik]
    end

    subgraph "Live Katmanı (src/live/)"
        F1[timeBudget.ts — 30s Deadline]
        F2[reliabilityGate.ts — Kaynak Sağlığı]
        F3[requestPolicy.ts — Zaman Aşımı Kontrolü]
        F4[decisionProvenance.ts — İçerik Durumu]
    end

    subgraph "Core (src/core/)"
        G1[runtimeConfig.ts — Env Override'ları]
        G2[httpClient.ts — Retry + Timeout]
        G3[rateLimiter.ts — Bedesten Throttle]
    end
```

## Veri Akışı

```mermaid
sequenceDiagram
    participant Client as MCP İstemcisi
    participant Server as MCP Sunucusu
    participant Service as DoktorMcpInformationService
    participant Health as Health Katmanı
    participant Sources as Kaynak Adaptörleri
    participant Budget as ResearchTimeBudget

    Client->>Server: prepare_doctor_legal_information_pack(question, sourceMode)
    Server->>Service: prepareInformationPack(input)
    Service->>Budget: new ResearchTimeBudget() (yalnızca canlı)

    alt Canlı Mod
        Service->>Budget: markPhaseStart("legislation")
        Service->>Sources: executeLegislationPhase(phaseBudget: 8s)
        Sources-->>Service: Mevzuat hükümleri (veya timeout)
        Service->>Budget: markPhaseEnd("legislation")

        Service->>Budget: markPhaseStart("precedent")
        Service->>Sources: searchPrecedents(live, önceliklendirilmiş)
        Sources-->>Service: Kaynak-başına mahkeme kararları
        Service->>Budget: markPhaseEnd("precedent")

        Service->>Service: filterReasonedPrecedents + rerankByIssueRelevance
    else Mock Mod
        Service->>Sources: searchLegislation(mock) || searchPrecedents(mock)
        Sources-->>Service: Mevzuat + Emsaller (paralel)
    end

    Service->>Health: composeDoctorLegalInformationPack(classification, provisions, precedents)
    Health->>Health: deduplicateDecisions (çapraz-kaynak)
    Health->>Health: buildPreliminaryAssessment (grounded-advisory ise)
    Health-->>Service: DoctorLegalInformationPack

    Service-->>Server: Paket + tanılama + telemetri
    Server->>Server: formatDoctorPackResponse + detectForbiddenOutputPhrases
    Server-->>Client: DoctorPackResponse (yapılandırılmış)
```

## Mock vs Canlı Mod

| Açı | Mock Mod | Canlı Mod |
|-----|----------|-----------|
| Mevzuat | Statik `MockLegislationAdapter` | `LiveOfficialLegislationAdapter` → mevzuat.gov.tr |
| Emsaller | Statik `MockYargitayAdapter`, `MockDanistayAdapter`, `MockAymAdapter` | `LiveYargitayAdapter`, `LiveDanistayAdapter`, `LiveBedestenAdapter` |
| AYM | Yalnızca mock veri | Yalnızca sentetik (API ile erişilemez) |
| Zaman Bütçesi | Yok — paralel, sınırsız | 30s deadline, 8s mevzuat / 15s emsal faz sınırları |
| Ağ | Yok | Retry + hız limiti ile gerçek HTTP çağrıları |
| Telemetri | Boş `queryTelemetry` | Tam sorgu-başına telemetri (cache hit/miss, retry, timeout) |
| Hatada geri-dönüş | Uygulanamaz | Minimal pack rescue (tamamlanmış fazlardan kısmi veri) |
| Emsal dedup | Canlıyla aynı çapraz-kaynak dedup | Çapraz-kaynak dedup (Yargitay + Bedesten örtüşmesi) |

## Güvenlik Kapıları

### 1. Yasak Çıktı İfadeleri — `src/mcp/formatDoctorPackResponse.ts`

Paket çıktısında **bulunmaması gereken** hard-blocked ifadeler. Bunlar hukuki tavsiye
alanına geçen kategorik hükümlerdir:

- `kesin olarak sorumlusunuz`, `kesin beraat eder`, `derhal şunu yapın`
- `savunma dilekçesi şöyle olmalı`, `şu cezayı alırsınız`, `şunu yapmanız gerekir`
- `kesin hukuki kanaat`, `dilekçe taslağı`, `savunma taslağı`, `derhal yapılacak`

**İzinli** (v0.44.0'dan beri): `risk seviyesi yüksek` gibi koşullu değerlendirmeler — bunlar
kategorik hüküm değil, kaynağa dayalı değerlendirme ifade eder.

### 2. Pack Audit — `src/packAudit.ts`

Şunları doğrulayan kapsamlı denetim:

- **MVP-kapsam-dışı alanlar** — `riskLevel`, `immediateActions`, `finalLegalOpinion` vb.
- **Mevzuat meta verisi** — `inForce` durumu, `repealed` bayrağı, `sourceDocumentId` varlığı
- **Emsal alan eksiksizliği** — mahkeme, tarih, olay özeti, hukuki değerlendirme, sonuç
- **Resmî-olmayan kaynak tespiti** — canlı paketlerde mock accessSource, .gov.tr-olmayan URL'ler
- **Yasak ifade taraması** — tüm serbest-metin alanlarında 22+ ifade
- **Sözleşme uyumu** — gerekli bölümler (shortAnswer, legalClassification, vb.)

### 3. Yanıt Formatı — `src/mcp/formatDoctorPackResponse.ts`

`DoctorPackResponse`, ham paketi şunlarla sarar:

- `status`: `full_pack` | `partial_pack` | `no_pack_diagnostic`
- `summary`: kaynak yeterliliği, sayılar, timeout göstergeleri
- `diagnostics`: kapsama boşlukları, eksik otorite tipleri, kapı gözlemleri
- `_forbiddenPhraseWarning`: tespit edilen yasak ifadeler dizisi (bloke etmeyen uyarı)

### 4. Güvenlik İnvariyantları — `tests/safetyInvariants.test.ts`

Şunları doğrulayan hızlı mock-mod kontrolleri:

1. KVKK özel verisi mahremiyet-olmayan paketlerde bulunmamalı
2. Canlı mod sessizce mock veriye geri dönmemeli
3. Hard-blocked ifadeler çıktıda bulunmamalı
4. Genel tıbbi sorular mahremiyet-hukuku içeriği barındırmamalı
5. `shortAnswer` asla boş olmamalı
6. Yasak alan adları (`riskLevel`, `immediateActions`, vb.) bulunmamalı
7. `preliminaryAssessment` kategorik hüküm dili içermemeli
8. Strict mod `preliminaryAssessment` üretmemeli

## Zaman Bütçesi Akışı

Canlı mod, kontrolsüz araştırmayı önlemek için katı bir zaman bütçesi uygular. Yapılandırma
`src/core/runtimeConfig.ts`'te yaşar; `DOKTOR_MCP_*` değişkenleriyle env override'ları yapılabilir.

```
Toplam Bütçe: 30,000 ms
Rezerv:        3,000 ms (paket birleştirme için)
Kullanılabilir: 27,000 ms

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Mevzuat Fazı                   Emsal Fazı            Rezerv     │
│  Bütçe: 8,000 ms (sert sınır)   Bütçe: 15,000 ms     3,000 ms  │
│  ┌──────────────────┐          ┌──────────────────┐            │
│  │ Promise.race     │          │ Kaynak-başına     │            │
│  │ arama + timeout  │          │ paralel arama     │            │
│  │                  │          │                   │            │
│  │ Timeout'ta:      │          │ Yargitay (1.)     │            │
│  │ → unavailable    │          │ Danistay (2.)     │            │
│  │ → emsal fazına   │          │ Bedesten (ayarlıysa)│          │
│  │   geç            │          │                   │            │
│  └──────────────────┘          └──────────────────┘            │
│           │                            │                        │
│           └──────── Bütçe tükendi ─────┘                        │
│                          │                                      │
│                  Minimal Pack Rescue                            │
│                  (yalnızca kısmi mevzuat)                       │
└─────────────────────────────────────────────────────────────────┘
```

**Temel davranışlar:**
- Mevzuat fazı bir timeout ile `Promise.race` kullanır — bütçeyi aşarsa faz `timedOut`
  işaretlenir ama emsal araması yine de devam eder
- Emsal fazı kaynakları paralel çalıştırır; bütçe arama ortasında tükenirse kısmi sonuçlar
  `MinimalPackRescueManager` aracılığıyla korunur
- `effectivePhaseBudgetMs()` her fazı `min(phaseBudget, remainingMs)` ile sınırlar
- Etkin bütçe < 500ms ise faz başlamaz (`shouldStartPhase()`)

## Kaynak Adaptörleri

| Kaynak | Adaptör | Arama | Tam Metin | Hız Limiti | Kalibrasyon |
|--------|---------|-------|-----------|------------|-------------|
| mevzuat.gov.tr | `LiveOfficialLegislationAdapter` | Evet | Evet | 30 istek/dk | stable |
| emsal.yargitay.gov.tr | `LiveYargitayAdapter` (Bedesten üzerinden) | Evet | Evet | 30 istek/dk, 60s soğuma | via_bedesten |
| karararama.danistay.gov.tr | `LiveDanistayAdapter` | Evet | Evet | 20 istek/dk, 30s soğuma | stable |
| bedesten.adalet.gov.tr | `LiveBedestenAdapter` | Evet | Evet | 30 istek/dk, 60s soğuma | stable |
| AYM | Yalnızca `MockAymAdapter` | Hayır | Hayır | Uygulanamaz | synthetic_only |

Kaynak yetenekleri, araç ve MCP yetenek raporlaması için `src/sources/sourceRegistry.ts`'te
kaydedilir. Adaptörler registry'ye göre dallanmaz — o yalnızca bilgilendiricidir.

## Anahtar Dosyalar

| Dosya | Amaç | Satır |
|-------|------|-------|
| `src/mcp/server.ts` | MCP STDIO sunucusu, resources, prompts | 87 |
| `src/mcp/tools.ts` | Araç kaydı ve işleyiciler | 136 |
| `src/mcp/formatDoctorPackResponse.ts` | Güvenlik kapıları, yanıt formatlama | 205 |
| `src/app/service.ts` | Servis koordinatörü (canlı + mock yollar) | 403 |
| `src/app/legislationPhase.ts` | Bütçe-sınırlı mevzuat yürütücüsü | 162 |
| `src/app/precedentPhase.ts` | Çok-kaynaklı emsal orkestratörü | 252 |
| `src/app/minimalPackRescue.ts` | Timeout'ta kısmi durum kurtarma | 121 |
| `src/health/answerComposer.ts` | Paket birleştirme + ön değerlendirme | 222 |
| `src/health/precedentFilter.ts` | Emsal uygunluğu + tanılama | 108 |
| `src/health/decisionDedup.ts` | Çapraz-kaynak karar deduplikasyonu | 74 |
| `src/health/linkHealthChecker.ts` | URL erişilebilirlik doğrulaması | 174 |
| `src/health/precedentRelevance.ts` | Konu profili + ilgililik puanlaması | 175 |
| `src/health/precedentRerank.ts` | İlgililik-tabanlı yeniden sıralama | 69 |
| `src/sources/yargitay/liveYargitayAdapter.ts` | Canlı Yargitay adaptörü (Bedesten) | 303 |
| `src/live/timeBudget.ts` | Araştırma zaman bütçesi (30s deadline) | 112 |
| `src/packAudit.ts` | Kapsamlı paket uyum denetimi | 489 |
| `src/core/runtimeConfig.ts` | Config şeması + env override'ları | 179 |
| `src/core/httpClient.ts` | Retry + timeout ile HTTP istemcisi | 273 |
| `src/benchmark/benchmarkRunner.ts` | Benchmark runner (mock + canlı) | 899 |
| `tests/safetyInvariants.test.ts` | Güvenlik invariyant kontrolleri | 111 |

## Test

- **Birim testleri**: `tests/*.test.ts` — 55+ dosyada
- **Kapsam (coverage)**: `npm run test:coverage` (v8 sağlayıcı, HTML + text-summary)
- **Benchmark**: `npm run benchmark:doctor-questions` (mock) / `npm run benchmark:doctor-questions:live`
- **Güvenlik invariyantları**: `tests/safetyInvariants.test.ts` — hızlı mock-mod güvenlik kontrolleri
- **Pack audit**: `npm run pack:audit` — paketi MVP kısıtlarına karşı doğrular
