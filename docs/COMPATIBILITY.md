# Uyumluluk ve Kararlılık Politikası

## Sürüm 0.44.0 → 1.0 Geçişi

doktor-mcp şu an **v0.44.0**'da (1.0 öncesi). `responseVersion` alanı
(`"doctor-pack-response/v1"`), kırıcı (breaking) değişiklikleri sinyallemek için kullanılacaktır.

## Kararlılık Katmanları

### 🔒 Stabil (SemVer patch düzeyi)
Bu alanların stabil olduğu garanti edilir. Değişiklikler yalnızca geriye-dönük-uyumlu eklemelerdir:

| Alan | Tip | Beri |
|------|-----|------|
| `responseVersion` | `"doctor-pack-response/v1"` | v0.42.0 |
| `ok` | `boolean` | v0.42.0 |
| `status` | `"full_pack" \| "partial_pack" \| "no_pack_diagnostic"` | v0.42.0 |
| `summary.shortAnswer` | `string` | v0.42.0 |
| `summary.sourceSufficiency` | `"sufficient" \| "partial" \| "insufficient"` | v0.42.0 |
| `summary.verifiedLegislationCount` | `number` | v0.42.0 |
| `summary.verifiedPrecedentCount` | `number` | v0.42.0 |
| `summary.coverageGapCount` | `number` | v0.42.0 |
| `summary.timeoutOrRetrievalIssue` | `boolean` | v0.42.0 |
| `diagnostics.missingAuthorityTypes` | `string[]` | v0.42.0 |
| `diagnostics.coverageGaps` | `string[]` | v0.42.0 |
| `diagnostics.retrievalTimeouts` | `string[]` | v0.42.0 |
| `diagnostics.noPackReason` | `string?` | v0.42.0 |
| `diagnostics.gateObservations` | `string[]?` | v0.43.0 |

### 🧪 Deneysel
Bu alanlar ek değer sağlar ama minor sürümlerde değişebilir:

| Alan | Tip | Durum |
|------|-----|-------|
| `pack.relevantLegislation[].preliminaryAssessment` | object? | Deneysel — yapı evrilebilir; şu an `summary` + `sentences[]` içerir (`text`, `sourceRef`, `sourceLabel`) |
| `pack.relevantLegislation[].inForce` | `boolean \| "unknown"` | Deneysel — v0.44.0'da eklendi |
| `pack.relevantLegislation[].lastAmendedDate` | `string?` | Deneysel — mevcut olduğunda ISO tarih |
| `pack.relevantLegislation[].repealed` | `boolean?` | Deneysel |
| `pack.precedentDiagnostics.dedupedCount` | `number?` | Deneysel — v0.44.0'da eklendi |

### ⚠️ Dahili / Tanılama
Bu alanlar hata ayıklama içindir. Önceden haber verilmeden değişebilir:

| Alan | Notlar |
|------|--------|
| `pack.selectionDiagnostics` | Dahili sıralama tanılaması |
| `pack.precedentDiagnostics` (`dedupedCount` hariç) | Dahili emsal seçim verisi |
| `pack.sourceTrace` | Dahili adaptör iz verisi |
| `pack.sourceWarnings` | Uyarı mesajları — format garanti edilmez |
| `diagnostics.gateObservations` | Gözlem dizeleri — format garanti edilmez |

## Kullanımdan Kaldırma (Deprecation) Politikası

1. **Duyuru**: Kullanımdan kaldırılan alanlar, kaldırılmadan en az bir minor sürüm önce
   `CHANGELOG.md`'de belgelenir.
2. **Geçiş süresi**: Hem eski hem yeni alanların mevcut olduğu en az bir minor sürüm.
3. **Kaldırma**: Kullanımdan kaldırılan alanlar, duyurudan SONRAKİ minor sürümde bir
   `CHANGELOG.md` notuyla kaldırılır.

## Kırıcı Değişiklikler

Kırıcı değişiklikler `responseVersion` artırılarak sinyallenir (ör.
`"doctor-pack-response/v1"`'den `"doctor-pack-response/v2"`'ye). MCP
`serverInfo.version`, `package.json` sürümünü izler (şu an 0.44.0).

Bir 1.0 sürümü:
- Stabil katmanı dondurur
- Herhangi bir kırıcı stabil-katman değişikliği için `responseVersion` artışı gerektirir
- Katı SemVer'i izler (major.minor.patch)

## MCP Araç Uyumluluğu

### Stabil Araçlar
Bu araç adları, girdi şemaları ve çıktı sözleşmeleri stabildir:
- `classify_medical_legal_question`
- `search_health_legislation`
- `get_legislation_provisions`
- `search_health_precedents`
- `filter_reasoned_precedents`
- `prepare_doctor_legal_information_pack`

### Deneysel Parametreler
Bu girdi parametreleri değişebilir:
- `assessmentTone` — v0.44.0'da eklendi, değerler: `"strict"` | `"grounded-advisory"` (varsayılan)

## Kaynak (Resource) URI'leri

Bu MCP kaynak URI'leri stabildir:
- `health-legislation://inventory`
- `doktor://calibration-status`

## Sorun Bildirimi

Uyumluluk sorunlarını veya beklenmeyen kırıcı değişiklikleri projenin sorun (issue)
takipçisi üzerinden bildirin.
