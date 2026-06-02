# Dil Politikası (i18n Policy) — doktor-mcp

> Hangi içerik Türkçe, hangisi İngilizce/teknik kalır.

## Türkçe (hedef kitle: Türk hekimleri)

| Alan | Açıklama |
|------|----------|
| `README.md` | Proje açıklaması, kurulum, kullanım |
| `docs/USAGE.md` | Kullanım rehberi |
| `docs/EXAMPLES.md` | Örnek soru kataloğu |
| `docs/COVERAGE_MATRIX.md` | Kapsam matrisi başlıkları ve mevzuat isimleri |
| `docs/SECURITY_REVIEW.md` | Güvenlik denetim raporu başlıkları |
| `docs/TEST_AUDIT.md` | Test denetim raporu |
| `ROADMAP.md` | Geliştirme planı |
| `CHANGELOG.md` | Bölüm başlıkları ve açıklamalar |
| `answerComposer.shortAnswer` | Hekime dönük kısa yanıt |
| `pack.relevantLegislation.connection` | Madde bağlantı açıklaması |
| Test açıklamaları (`describe`/`it` stringleri) | Test neyi doğruluyor |

## İngilizce / Teknik (değişmez)

| Alan | Açıklama |
|------|----------|
| Kod (`.ts` dosyaları) | Tüm TypeScript kodu |
| Identifier'lar | Değişken, fonksiyon, sınıf, interface adları |
| JSON alan adları | `sourceId`, `legislationName`, `errorCode` vb. |
| `sourceId` değerleri | `mevzuat:1.5.657` |
| `errorCode` değerleri | `source_error`, `document_not_found` |
| MCP araç adları | `classify_medical_legal_question` |
| Git commit mesajları | İngilizce veya Türkçe (serbest) |
| `package.json` alanları | `name`, `version`, `scripts` |

## Dil-Nötr Terimler (testlerde kullanılabilir)

| Terim | Açıklama |
|-------|----------|
| `SSRF` | Güvenlik denetim terimi |
| `mevzuat.gov.tr` | Alan adı |
| `sourceId` pattern'leri | `mevzuat:`, `leg-` |
| Sayısal değerler | `1.5.657`, `125` |
