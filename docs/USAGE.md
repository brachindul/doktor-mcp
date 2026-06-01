# Kullanım Rehberi — doktor-mcp v0.48.0

## SourceMode'lar

| Mod | Açıklama | Ne Zaman? |
|-----|----------|-----------|
| `mock` | Önceden tanımlı mevzuat/emsal döndürür | Geliştirme, CI, demo |
| `live` | Gerçek mevzuat.gov.tr + yargıtay/danıştay/bedesten | Canlı kullanım |
| `snapshot` | Kayıtlı canlı yanıtları replay eder | Ağsız canlı benzeri test |

## assessmentTone

| Ton | Açıklama |
|-----|----------|
| `grounded-advisory` (varsayılan) | Kaynak-temelli koşullu değerlendirme |
| `strict` | Sadece kaynak metni, yorum yok |

## MCP Araçları

1. **classify_medical_legal_question** — Soruyu hukuki eksenlere sınıflandırır
2. **search_health_legislation** — Mevzuat adaptörü üzerinden resmi hüküm arar
3. **get_legislation_provisions** — Document ID ile madde metni getirir
4. **search_health_precedents** — Yargıtay/Danıştay emsal adayları arar
5. **filter_reasoned_precedents** — Emsalleri tam metin/gerekçe bazında filtreler
6. **prepare_doctor_legal_information_pack** — Kaynak-temelli hukuki bilgi paketi hazırlar
7. **drill_down_pack_item** — Paketteki spesifik bir madde/karara odaklanır

## Environment Variables

| Değişken | Açıklama | Varsayılan |
|-----------|----------|------------|
| `DOKTOR_SOURCE_MODE` | `mock`, `live`, `snapshot` | `mock` |
| `DOKTOR_TIME_BUDGET_MS` | Toplam zaman bütçesi (ms) | `45000` |
| `DOKTOR_LEGISLATION_BUDGET_MS` | Mevzuat fazı bütçesi | `25000` |
| `DOKTOR_PRECEDENT_BUDGET_MS` | Emsal fazı bütçesi | `15000` |

## Drill-Down Kullanımı

```json
{
  "tool": "drill_down_pack_item",
  "input": {
    "pack": { "...önceki prepare_pack çıktısı..." },
    "followUpQuestion": "125. madde tam olarak ne diyor?"
  }
}
```

## CLI Komutları

```
npm run build              # TypeScript derlemesi
npm test                   # Tüm testleri çalıştır
npm run cache:warm         # Önbellek ısıtma (demo öncesi)
npm run ci:axis-e2e        # CI eksen E2E smoke testi
npm run benchmark:doctor-questions  # Benchmark çalıştır
```

## Güvenlik Notları

- Paket **nihai hukuki kanaat değildir**
- `kesinlikle`, `suçlusunuz`, `tazminat ödersiniz` gibi ifadeler hard-blocked
- `riskLevel`, `immediateActions`, `finalLegalOpinion` alanları yasak
- Detaylı güvenlik raporu: `docs/SECURITY_REVIEW.md`
