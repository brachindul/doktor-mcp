# Canlı Kaynak Kalibrasyonu

Bu doküman, her mahkeme kararı kaynağının kalibrasyon durumunu ve bir kaynağın
`synthetic_only`'den `verified_live`'a nasıl ilerletileceğini açıklar.

## Kalibrasyon Durum Değerleri

| Durum | Anlam |
|-------|-------|
| `verified_live` | Ağ erişimi olan bir ortamda gerçek uç noktayla çalıştığı doğrulandı |
| `fixture_verified` | Kaydedilmiş gerçek bir fixture'a karşı test edildi (ham gövde `fixtures/raw/`'da) |
| `synthetic_only` | Yalnızca sentetik (elle hazırlanmış) veriyle test edildi |
| `unavailable_in_environment` | Bu ortamda DNS çözümlemesi başarısız |
| `fetch_error` | Ağ-düzeyi hata (DNS değil); uç nokta güvenlik duvarınca bloke olabilir |
| `html_shell_response` | HTTP 200 ama JSON-olmayan HTML kabuğu (SPA); gerçek API uç noktası bilinmiyor |
| `needs_browser_capture` | Uç nokta SOAP/XML döndürüyor veya tarayıcı oturumu gerektiriyor; gerçek JSON API keşfedilmeli |
| `captcha_or_block` | CAPTCHA veya bot-tespit yanıtı |
| `reachable_json` | Uç nokta JSON döndürüyor; alan eşlemesi hâlâ kalibrasyon gerektirebilir |

## Mevcut Durum (v0.12, 2026-05-22'de doğrulandı)

| Kaynak | Kalibrasyon Durumu | Uç nokta | Notlar |
|--------|--------------------|----------|--------|
| **Yargıtay** | `reachable_json` | `bedesten.adalet.gov.tr/emsal-karar/searchDocuments` | Aktif birleşik Bedesten API. |
| **Danıştay** | `reachable_json` | `karararama.danistay.gov.tr/aramalist` | Aktif Aramalist API. |
| **AYM** | `synthetic_only` | Yok | Yalnızca mock adaptör. Canlı uç nokta yok. |

## Kalibrasyon Nasıl İlerletilir

### Adım 1: Probe
```powershell
npm run probe:precedents -- "aydınlatılmış rıza" -- --source yargitay --save-fixture
npm run probe:precedents -- "hizmet kusuru tıbbi müdahale" -- --source danistay --save-fixture
```

Bu, `fixtures/live-samples/`'a sanitize edilmiş bir şekil fixture'ı (ham gövde olmadan) kaydeder.

### Adım 2: Tarayıcı DevTools yakalama (SOAP/HTML uç noktaları için)

Danıştay için:
1. Tarayıcıda `https://karararama.danistay.gov.tr`'yi açın.
2. DevTools → Network sekmesi → Fetch/XHR.
3. Bir arama sorgusu yazın (ör. `hizmet kusuru tıbbi müdahale`) ve Ara'ya tıklayın.
4. JSON karar döndüren gerçek arama isteğini bulun.
   - İstek URL'i, yöntemi, header'ları, payload'ı, yanıt content-type'ı ve yanıt önizlemesine bakın.
5. Ham yanıt gövdesini `fixtures/raw/danistay-raw.json`'a (gitignore'da) kaydedin. Bu dosyayı commit etmeyin.
6. Ham gövde YALNIZCA `fixtures/raw/`'da saklanır.

### Adım 3: Fixture'ı güncelle
Yakaladıktan sonra:
1. `fixtures/live-samples/danistay-synthetic.json`'u güncelleyin:
   - `_calibrationStatus`'u `fixture_verified` yapın
   - `_probeFindings`'i gerçek uç nokta URL'i ve alan adlarıyla güncelleyin
   - `data[]`'i sanitize edilmiş (ID'ler redakte) örnek satırlarla güncelleyin

### Adım 4: calibrationStatus sabitini güncelle
`src/sources/calibrationStatus.ts`'te güncelleyin:
```typescript
danistay: "fixture_verified"
```

## Ham Fixture Politikası

- **`fixtures/raw/`'ı asla commit etmeyin** — gerçek mahkeme kararı verisi içerebilir.
- `fixtures/raw/`, `.gitignore`'dadır.
- Commit etmeden önce sanitize edin: gerçek ID'leri değiştirin, kişisel referansları redakte edin, yalnızca alan adlarını ve şekli tutun.
- `fixtures/live-samples/`'taki sanitize edilmiş fixture'lar commit etmek için güvenlidir.

## Hata Kodu Referansı

Bir canlı adaptör bir yanıtı ayrıştıramadığında, `DecisionSourceTrace.error` şunu içerir:

| Kod | Anlam |
|------|-------|
| `non_json_response:html_shell_response` | HTTP 200 + HTML SPA kabuğu |
| `non_json_response:unexpected_html_response` | Tarayıcı gerektiren login/büyük HTML |
| `non_json_response:captcha_or_block` | CAPTCHA tespit edildi |
| `non_json_response:xml_soap_response` | SOAP/XML yanıtı |
| `non_json_response:empty_response` | Boş gövde |
| `response_read_failed` | Yanıt gövdesi hiç okunamadı |
| `fetch failed` | Ağ-düzeyi getirme hatası |
