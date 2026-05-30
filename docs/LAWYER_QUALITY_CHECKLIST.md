# Avukat Gözüyle Kalite Kontrol Listesi

> Bu doküman, doktor-mcp çıktılarının teknik doğrulamanın ötesinde,
> hukukçu perspektifinden niteliksel değerlendirmesini sağlar.
> Otomatik skor değil, yapılandırılmış kontrol listesidir.

## Genel İlkeler

- Her paket **kaynak-temelli** olmalıdır: her iddia bir mevzuat maddesine veya emsal karara dayanmalıdır.
- **Kategorik hüküm yasak**: "kesinlikle sorumludur", "tazminat ödemek zorundadır" gibi ifadeler bulunmamalıdır.
- **Boş kalıp yasak**: "işaret ettiği yönde" gibi içeriksiz ifadeler yerine somut sonuç/eğilim belirtilmelidir.

## Kontrol Listesi

### 1. Mevzuat Kalitesi

| # | Kontrol | Geçti | Not |
|---|---------|-------|-----|
| 1.1 | Seçilen mevzuat maddeleri soruyla gerçekten ilgili mi? | ☐ | |
| 1.2 | Alıntılanan madde metinleri doğru ve güncel mi? (`inForce` kontrolü) | ☐ | |
| 1.3 | Yürürlükten kalkmış (`repealed`) veya durumu belirsiz (`inForce: "unknown"`) maddeler işaretlenmiş mi? | ☐ | |
| 1.4 | Sağlık-birincil mevzuat (Hasta Hakları Yönetmeliği vb.) KVKK'dan önce mi sıralanmış? | ☐ | |
| 1.5 | Mevzuat maddeleri soru bağlamında yanıltıcı olabilir mi? | ☐ | |

### 2. Emsal Kalitesi

| # | Kontrol | Geçti | Not |
|---|---------|-------|-----|
| 2.1 | Seçilen emsal kararlar gerçekten konuyla ilgili mi? | ☐ | |
| 2.2 | Kararların sonuç/eğilim bilgisi (`outcome`) mevcut ve anlamlı mı? | ☐ | |
| 2.3 | Aynı mahkeme/daireden tekrarlayan kararlar var mı? (olmamalı) | ☐ | |
| 2.4 | Sadece metadata'sı olan (tam metinsiz) kararlar emsal olarak sunulmuş mu? (olmamalı) | ☐ | |
| 2.5 | AYM için sentetik/boş veri "verified" bölüme sızmış mı? (sızmamalı) | ☐ | |

### 3. Değerlendirme Kalitesi (`preliminaryAssessment`)

| # | Kontrol | Geçti | Not |
|---|---------|-------|-----|
| 3.1 | Her değerlendirme cümlesi bir `sourceRef` taşıyor mu? | ☐ | |
| 3.2 | Cümleler gerçek veriden mi türetilmiş? (boş kalıp değil) | ☐ | |
| 3.3 | Değerlendirme dili koşullu mu? ("değerlendirilebilir", "eğilim göstermektedir") | ☐ | |
| 3.4 | Kategorik hüküm içeren ifade var mı? (varsa → HATA) | ☐ | |
| 3.5 | Değerlendirme, hekimin kararını yanıltabilecek kesinlikte mi? | ☐ | |

### 4. Genel Paket Kalitesi

| # | Kontrol | Geçti | Not |
|---|---------|-------|-----|
| 4.1 | `shortAnswer` soruyu doğru özetliyor mu? | ☐ | |
| 4.2 | Kaynak uyarıları (`sourceWarnings`) mevcut sınırlılıkları dürüstçe yansıtıyor mu? | ☐ | |
| 4.3 | Paket, hekimin sorumluluğunu artıracak yanlış bir güvenlik hissi yaratıyor mu? | ☐ | |
| 4.4 | Eksik bilgi varsa (`missingInformation`) açıkça belirtilmiş mi? | ☐ | |
| 4.5 | Türkçe dil kullanımı tutarlı ve doğru mu? (ASCII karakter hatası yok) | ☐ | |

## Örnek Uygulama

### Soru 1: "Hekim kişisel sağlık verisini izinsiz paylaştı"

| Kontrol | Sonuç | Açıklama |
|---------|-------|----------|
| 1.4 (Sağlık-birincil öncelik) | ✅ | Hasta Hakları Yönetmeliği KVKK'dan önce sıralanıyor |
| 2.1 (Emsal ilgililiği) | ⚠️ | Mock modda sınırlı emsal seti; canlı modda daha iyi sonuç beklenir |
| 3.1 (sourceRef) | ✅ | Tüm cümleler kaynak referanslı |
| 3.4 (Kategorik hüküm) | ✅ | Kategorik hüküm yok |
| 4.2 (Sınırlılık şeffaflığı) | ✅ | Mock kaynak uyarısı mevcut |

### Soru 2: "Acil serviste hasta tedaviyi reddederse hekimin sorumluluğu"

| Kontrol | Sonuç | Açıklama |
|---------|-------|----------|
| 1.1 (Mevzuat ilgililiği) | ✅ | Hasta Hakları Yönetmeliği ve ilgili mevzuat seçilmiş |
| 2.1 (Emsal ilgililiği) | ⚠️ | Mock mod; canlı modda Yargıtay/Danıştay emsal beklenir |
| 4.3 (Yanlış güvenlik hissi) | ✅ | "Nihai hukuki kanaat değildir" uyarısı mevcut |

### Soru 3: "Özel hastanede hasta mahremiyeti ihlali"

| Kontrol | Sonuç | Açıklama |
|---------|-------|----------|
| 1.4 (Sağlık-birincil öncelik) | ⚠️ | Özel Hastaneler Yönetmeliği `needs_manual_review` — canlı doğrulama Cloudflare engeli nedeniyle yapılamadı |
| 3.2 (Gerçek veri) | ✅ | Kaynak veriden türetilmiş |
| 4.2 (Sınırlılık) | ⚠️ | Bazı çekirdek yönetmelikler doğrulanamadı; `needs_manual_review` olarak işaretli |

## Genel Değerlendirme

**Güçlü Yönler:**
- Kaynak-temelli ilke tutarlı şekilde korunuyor
- Kategorik hüküm filtresi etkin çalışıyor
- Sağlık-birincil mevzuat önceliği mock modda doğru sıralanıyor
- Değerlendirme cümleleri gerçek veriden türetiliyor (v0.44.0)

**Geliştirilecek Alanlar:**
- Canlı modda emsal karar ilgililiği daha zengin olabilir
- 6 çekirdek sağlık yönetmeliği Cloudflare nedeniyle canlı doğrulanamadı
- AYM entegrasyonu HTML-only engeli nedeniyle mümkün değil

## Kullanım

Bu kontrol listesi, her yeni sürüm öncesinde veya önemli davranış değişikliklerinde
manuel olarak uygulanır. Otomatik testlerin yakalayamadığı niteliksel sorunları
tespit etmek için tasarlanmıştır.
