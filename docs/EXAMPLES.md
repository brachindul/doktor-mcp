# Örnek Soru Kataloğu — doktor-mcp v0.48.0

> 15+ temsili hekim sorusu, beklenen mevzuat/emsal özetleriyle birlikte.
> Tüm örnekler mock modda doğrulanmıştır.

## Klinik / Malpraktis

### 1. Hekim hatası iddiası
**Soru:** "Hekim hatası iddiasıyla karşı karşıyayım, hukuki durumum nedir?"
**Beklenen Mevzuat:** Tıbbi Deontoloji Nizamnamesi, TCK m.86
**Beklenen Emsal:** Yargıtay Hukuk/Ceza Dairesi kararları

### 2. Aydınlatılmış rıza
**Soru:** "Hasta ameliyata rıza göstermedi, ne yapmalıyım?"
**Beklenen Mevzuat:** Hasta Hakları Yönetmeliği
**Eksen:** informed_consent, patient_rights

## Acil Müdahale

### 3. Acilde hasta reddi
**Soru:** "Acil serviste hasta yakını müdahaleye izin vermiyor, ne yapabilirim?"
**Beklenen Mevzuat:** Tıbbi Deontoloji Nizamnamesi m.18
**Eksen:** emergency_care

## Kamu / Özlük

### 4. Tayin / Nakil
**Soru:** "Kamu hastanesinde tayinim çıktı, itiraz edebilir miyim?"
**Beklenen Mevzuat:** 657 sayılı DMK, Sağlık Meslek Mensupları Yönetmeliği

### 5. Disiplin soruşturması
**Soru:** "Hekim olarak disiplin soruşturması geçiriyorum, haklarım nelerdir?"
**Beklenen Mevzuat:** 657 sayılı DMK m.125, m.127

### 6. Ek ödeme
**Soru:** "Ek ödeme miktarım eksik yatırıldı, ne yapabilirim?"
**Beklenen Mevzuat:** Sağlık Meslek Mensupları Yönetmeliği

### 7. Mecburi hizmet
**Soru:** "Mecburi hizmet yükümlülüğüm ne kadar ve nerede geçerli?"
**Beklenen Mevzuat:** Umumi Hıfzıssıhha Kanunu

## Gizlilik / KVKK

### 8. Hasta bilgisi paylaşımı
**Soru:** "Hasta bilgilerini başka bir hekimle paylaşabilir miyim?"
**Beklenen Mevzuat:** Hasta Hakları Yönetmeliği
**Eksen:** privacy_kvkk, patient_rights

## Tazminat / Hukuki Sorumluluk

### 9. Tıbbi tazminat
**Soru:** "Tıbbi hata nedeniyle tazminat davası açmak istiyorum"
**Beklenen Mevzuat:** TCK, Deontoloji Nizamnamesi
**Eksen:** civil_compensation

## Çok Eksenli

### 10. Disiplin + Tazminat
**Soru:** "Hem disiplin soruşturması geçiriyorum hem tazminat davası açıldı"
**Beklenen Mevzuat:** 657 DMK + TCK

## Kenar Durumlar

### 11. Belirsiz soru
**Soru:** "Ne yapmalıyım?" (belirsiz)
**Beklenen:** Dürüst diagnostic, boş/uydurma pack yok

### 12. Olumsuz koşul
**Soru:** "Acil değilse tedaviyi reddedebilir miyim?"
**Beklenen:** Koşul doğru yönlenmeli

---

*Son güncelleme: 2026-06-01. Fixture'lar `tests/fixtures/axes/` altında.*
