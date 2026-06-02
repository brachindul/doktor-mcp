# Güvenlik İncelemesi — doktor-mcp v0.47.1 (Faz 26)

> Son güncelleme: 2026-06-01
> Kapsam: SSRF, PII (kişisel veri), çıktı güvenliği, bağımlılık denetimi

## 1. SSRF (Sunucu-Taraflı İstek Sahteciliği)

### Dış Çağrılar
- `LiveOfficialLegislationAdapter` → `mevzuat.gov.tr` (yalnızca HTTPS, resmî Türk mevzuat portalı)
- `LiveYargitayAdapter` → `yargitay.gov.tr` (yalnızca HTTPS)
- `LiveDanistayAdapter` → `danistay.gov.tr` (yalnızca HTTPS)
- `LiveBedestenAdapter` → `bedesten.adalet.gov.tr` (yalnızca HTTPS)

### Önlemler
- Tüm URL'ler sabit (hardcoded) constant'lardır (`BEDESTEN_BASE_URL`, `YARGITAY_BASE_URL`, vb.) — kullanıcı-kontrollü URL enjeksiyonu yok.
- `HttpClient` sabit bir `baseUrl` kullanır, yalnızca path ekler; açık yönlendirme (open redirect) yok.
- Cloudflare geri-dönüşü, PDF istekleri için tarayıcı-benzeri header'lar kullanır.
- `requestPolicy.ts`, kaynak-başına zaman aşımlarını zorlar (ör. `legislation-direct` 25s, `bedesten-search` 10s).

### Durum: ✅ Düşük risk — kullanıcı-kontrollü URL yok, tümü sabit güvenilir uç noktalar.

---

## 2. PII (Kişisel Tanımlanabilir Bilgi)

### Paketteki Veri
- `DoctorLegalInformationPack` yapısı: mevzuat hükümleri, doğrulanmış emsaller, hukuki sınıflandırma.
- Hiçbir paket sözleşmesinde kişisel veri alanı yoktur.
- `shortAnswer` kaynağa dayalıdır, asla hastaya-özel veri içermez.

### KVKK Kapsamı
- `privacy_kvkk` sınıflandırma boyutu yalnızca sorular mahremiyetten bahsettiğinde uygulanır (KVKK 6698, kişisel veri, hasta mahremiyeti).
- Testler, KVKK içeriğinin KVKK-olmayan paketlere sızmadığını doğrular (`safetyInvariants.test.ts`).

### Loglama
- Konsola veya dosyalara hiç PII loglanmaz.
- Önbellek dosyaları (`.cache/`) mevzuat sorgularını ve emsal yanıtlarını saklar — kullanıcı verisi yok.

### Durum: ✅ Düşük risk — PII toplama, saklama veya iletim yok.

---

## 3. Çıktı Güvenliği

### Hard-Blocked İfadeler
`src/mcp/formatDoctorPackResponse.ts`'te tanımlı:
- `kesin olarak sorumlusunuz`, `kesin beraat eder`, `kesin hukuki kanaat`
- `derhal şunu yapın`, `şu cezayı alırsınız`, `dilekçe taslağı`
- Ek olarak 7 kategorik hukuki tavsiye deseni daha

### Yasak Alanlar
`src/benchmark/doctorQuestions.ts`'te tanımlı:
- `riskLevel`, `immediateActions`, `finalLegalOpinion`, `riskSeviyesi`
- `derhalYapilacaklar`, `kesinHukukiKanaat`, `dilekseTaslagi`

### Testler
- `tests/forbiddenPhraseCalibration.test.ts` (13 test) — birim-düzeyi ifade tespiti
- `tests/safetyInvariants.test.ts` (9 test) — pakete-düzey güvenlik invariyantları
- `tests/adversarialSafety.test.ts` (17 test) — adversarial baskı soruları
- `tests/packContractAudit.test.ts` (57 test) — sözleşme alanı doğrulaması
- `tests/mvpSafety.test.ts` (5 test) — MVP güvenlik kontrolleri
- `tests/v1FinalChecklist.test.ts` (5 test) — nihai kontrol listesi doğrulaması

### Sorumluluk Reddi (Disclaimer)
- Her paket şunu içerir: `"Bu paket nihai hukuki kanaat değildir"`

### Durum: ✅ Güçlü — adversarial testle birlikte çok-katmanlı ifade/alan blokajı.

---

## 4. Bağımlılık Denetimi

### Çalışma-Zamanı Bağımlılıkları
- `@modelcontextprotocol/sdk` — MCP protokol uygulaması (MIT lisansı)
- `zod` — Şema doğrulaması (MIT lisansı)
- `commander` — CLI çerçevesi (MIT lisansı)

### Geliştirme Bağımlılıkları
- `vitest` — Test koşucusu
- `typescript` — Tip derleyici
- `tsx` — TypeScript yürütücü

### Notlar
- Kullanımdan kaldırılmış/terk edilmiş paket yok.
- İnceleme anında bilinen kritik CVE'ye sahip paket yok.
- CI adımı olarak düzenli `npm audit` önerilir.

### Durum: ✅ Düşük risk — küçük bağımlılık yüzeyi, tümü bakımlı.

---

## 5. Özet

| Alan | Risk | Durum |
|------|------|-------|
| SSRF | Düşük | ✅ Sabit güvenilir uç noktalar |
| PII | Düşük | ✅ PII toplama yok |
| Çıktı Güvenliği | Düşük | ✅ Çok-katmanlı blokaj + disclaimer |
| Bağımlılıklar | Düşük | ✅ Küçük yüzey, bakımlı |
| **Genel** | **Düşük** | **✅ Kritik bulgu yok** |

## 6. Öneriler

1. **CI**: CI hattına `npm audit --audit-level=moderate` ekle.
2. **Hız Limiti**: Danıştay ara sıra 429 döndürür; üstel backoff uygula (`requestPolicy.ts` ile kısmen yapıldı).
3. **Bağımlılık Güncellemesi**: Protokol değişiklikleri için `@modelcontextprotocol/sdk`'yı periyodik güncelle.
4. **Canlı Mod**: Beklenmeyen yanıt şekillerini yakalamak için canlı modda mock yanıt doğrulaması eklemeyi değerlendir.
