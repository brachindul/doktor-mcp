# Test Denetimi — doktor-mcp v0.50.0 (Faz 36)

> Vacuous-test (içi boş test) tarama sonuçları ve düzeltme durumu.

## Bulgular

### 1. Guard'lı assertion'lar (vacuous)
**Konum:** `tests/fixtureReplayLivePipeline.test.ts` (T35.1, şimdi T36.1)

**Sorun:** 4 çekirdek eksen testi `if (result.status === "ok") { expect(...) }` desenini
kullanıyordu. `buildReplayFetch` `text/html` döndürdüğünde (`getDocument` tarafından
reddedilir), durum her zaman "unavailable" oluyordu; dolayısıyla içteki `expect()` hiç
çalışmadı. 4 test yeşildi ama hiçbir şeyi test etmiyordu.

**Düzeltme:** T36.1 cache-injection ile değiştirdi (`buildReplayCache` + `docCache`).
T36.2 tüm guard'ları hard assertion ile değiştirdi: `expect(result.status).toBe("ok")`.
Testler artık birincil mevzuat eksikse kırılıyor.

**Durum:** ✅ Düzeltildi. 3 hard-assert test geçiyor.

### 2. Probe testlerinde guard'lı assertion'lar
**Konum:** `tests/aymProbe.test.ts` (2 örnek)

**Sorun:** `if (result.status === "ok")` sarmalı. Bunlar meşru — AYM probe testleri,
meşru biçimde başarısız olabilen canlı ağ probe'larıdır. Guard yerinde.

**Durum:** ✅ Kabul edilebilir. Belgelendi.

### 3. `toBeDefined()` kullanımı
**Sayı:** Test paketinde 151 örnek.

**Değerlendirme:** Çoğu davranışsal assertion'larla takip ediliyor (ör.
`expect(x).toBeDefined(); expect(x.length).toBeGreaterThan(0)`). Bunlar vacuous değil —
davranışı test etmeden önce yapıyı doğrularlar.

**Durum:** ✅ Yalnızca-vacuous vaka bulunamadı. Tüm `toBeDefined()` kullanımlarının
takip assertion'ı var ya da yapı-doğrulama testlerinde.

### 4. Mutation sanity (T36.4)
**Kanıtlandı:** `buildReplayCache`'i bozmak (cache.set'i kaldırmak)
`fixtureReplayLivePipeline.test.ts`'i `status: "unavailable"` ile başarısız kılıyor.
Test, regresyona karşı gerçekten koruyor.

**Yöntem:** Adaptördeki `this.docCache.set(...)` geçici olarak yorum satırı yapıldı,
test çalıştırıldı, kırılma doğrulandı, geri alındı.

## Özet

| Kategori | Sayı | Vacuous | Düzeltildi |
|----------|------|---------|------------|
| Guard'lı assert | 4 | 4 | ✅ |
| Probe guard'ları | 2 | 0 | Uygulanamaz (meşru) |
| Yalnızca-toBeDefined | 0 | 0 | Uygulanamaz |
| **Toplam vacuous** | **4** | **4** | **✅** |

## Mutation-Check Sonuçları (T46 — `npm run mutation-check`)

| Invariant | Mutasyon | Korunuyor |
|-----------|----------|-----------|
| Cache yazımı (T35.2) | `cache.set` kaldır | ✅ |
| Placeholder filtresi (T35.5) | `hintHasDirectSourceId` always true | ✅ |
| Graceful degradation (T27.3) | `MIN_ARTICLE_LENGTH` bypass | ✅ |
| Malpraktis eşleme (T45.1) | "malpraktis" terimi sil | ✅ |
| **Toplam** | | **4/4** |

> `node scripts/mutation-check.mjs` çıktısı: **"4/4 invariyant testlerle korunuyor. Tüm invariyantlar korunuyor ✓"**
