# Pack Audit (Paket Denetimi)

Paket denetim aracı, bir `DoctorLegalInformationPack` JSON'unu avukat incelemesine
gönderilmeden önce MVP güvenlik kısıtlarına uygunluk açısından doğrular.

## Kullanım

```powershell
# Bir paket üret (mock mod)
npx tsx -e "
import { DoktorMcpInformationService } from './src/app/service.js';
import { writeFile } from 'node:fs/promises';
const svc = new DoktorMcpInformationService();
const pack = await svc.prepareInformationPack({ question: 'aydınlatılmış rıza' });
await writeFile('fixtures/sample-pack.json', JSON.stringify(pack, null, 2));
"

# Paketi denetle
npm run audit:pack -- fixtures/sample-pack.json
```

## Kontroller

### Hatalar (avukat incelemesini bloke eder)

| Kontrol | Açıklama |
|---------|----------|
| MVP-kapsam-dışı alanlar | `riskLevel`, `immediateActions`, `finalLegalOpinion`, `riskSeviyesi`, `derhalYapilacaklar`, `kesinHukukiKanaat`, `dilekseTaslagi` görünmemeli |
| Eksik `sourceDocumentId` | Her `relevantLegislation` öğesinin bir `sourceDocumentId`'si olmalı |
| selectedPrecedents'te dışlanmış durum | `precedentDiagnostics.selectedPrecedents`'teki hiçbir girdi `metadata_only`, `procedural_only` veya `no_reasoning` durumunda olamaz |
| Doğrulanmış emsalde `fullTextAvailable: false` | Doğrulanmış bir emsalin `decisionSourceTrace`'i varsa, `fullTextAvailable: true` olmalı |
| Doğrulanmış emsalde yanlış `eligibilityStatus` | Doğrulanmış bir emsalin `decisionSourceTrace`'i varsa, `eligibilityStatus`'u `precedent_usable` olmalı |

### Uyarılar (incelemeden önce ele alınmalı)

| Uyarı | Açıklama |
|-------|----------|
| Eksik `selectionDiagnostics` | Yalnızca canlı mevzuat modunda bulunur |
| Eksik `precedentDiagnostics` | Her zaman bulunmalı |
| Eksik `sourceSummaries` | `precedentDiagnostics` içinde olmalı |
| `sourceSummaries`'te erişilemez kaynak | Bir veya daha fazla mahkeme adaptörü başarısız; o kaynaktan 0 canlı emsal |
| `sourceWarnings` mevcut | Pakete-düzey kaynak uyarıları var |

## Çıktı Formatı

```json
{
  "tool": "audit_pack",
  "file": "fixtures/sample-pack.json",
  "result": {
    "ok": true,
    "errors": [],
    "warnings": [
      "selectionDiagnostics is missing. Run in live sourceMode to populate it.",
      "Source \"yargitay\" is unavailable in precedentDiagnostics.sourceSummaries (errorCodes: [\"source_error\"])."
    ],
    "checkedCounts": {
      "legislationItems": 2,
      "legislationWithSourceTrace": 2,
      "precedents": 0,
      "excludedDecisions": 0,
      "sourceSummaries": 3,
      "unavailableSources": 2
    },
    "recommendedNextStep": "Pack has 2 warning(s) but no errors. Address warnings before lawyer review."
  }
}
```

- Uyarılarla `ok: true` = inceleme için hazır (mümkünse uyarıları ele al)
- `ok: false` = avukata göndermeden önce hatalar düzeltilmeli

## Güvenlik Kısıtları

Denetim, kalıcı proje kısıtlarını zorlar:

- Risk seviyesi puanlaması yok
- Acil eylem talimatı yok
- Kategorik nihai hukuki sonuç yok (kaynağa dayalı koşullu değerlendirme izinlidir)
- Dilekçe veya savunma taslağı yok
- Modelin uydurduğu mahkeme kararı yok
- `verifiedHighCourtPrecedents`'te yalnızca `precedent_usable` kararlar
- Tüm doğrulanmış emsaller için tam metin gerekli

## CI Entegrasyonu

Denetim, `ok: true` olduğunda 0 koduyla, `ok: false` olduğunda 1 koduyla çıkar.
Deterministik olacak şekilde tasarlanmıştır — aynı girdi her zaman aynı çıktıyı üretir.

```powershell
npm run audit:pack -- fixtures/sample-pack.json
# Çıkış kodu 0 = ok, Çıkış kodu 1 = hata bulundu
```
