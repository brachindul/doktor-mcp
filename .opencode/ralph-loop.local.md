---
active: true
iteration: 0
maxIterations: 100
---

# Ralph Loop Görevi: ROADMAP.md'deki TÜM tamamlanmamış görevleri bu oturumda sırayla bitir.

"Öncelik Sırası"nı takip et; [ ] görev kalmayana kadar durma.

Her görev için:
1. Sıradaki [ ] görevi seç (şu an: Faz 20 → T20.1...).
2. "Yapılacak" + "Kabul"u uygula. Her kabul maddesi için gerçekten test yaz.
3. ÖNEMLİ: Özelliği TAM PAKETTE (prepareInformationPack) doğrula —
   sadece router/alt-fonksiyon testi yetmez (izole-test maskelemesi yasak).
4. `npm run build` 0 hata + `npm test` tamamen yeşil olmadan commit etme.
5. Görev başlığına [x] koy. Ayrı, göreve özel commit at.
6. Sıradakine geç. Görev kalmadıysa dur.

DÜRÜSTLÜK (zorunlu):
- "Kabul"un TAMAMI gerçekten karşılanmıyorsa [x] yapma; [ ] bırak,
  nedenini commit mesajına yaz.
- Bug canlı modda ise canlı/recorded-fixture ile test et, mock'la maskeleme.
- Uydurma mevzuat/karar/sourceId/metin YASAK. Doğrulanamayan girdi
  gerekçeyle needs_manual_review/candidate kalır.
- "Yaptım" demeden önce komutu çalıştırıp çıktıyı gör. Halüsinasyon yok.

Her faz bittikçe ilgili işi CHANGELOG'a ekle.
EN SONDA: tüm [ ] biterse → sürümü bump'la (package.json + lock + CHANGELOG
en üst sürüm eşit olmalı; tests/version.test.ts geçmeli), son build+test+lint,
commit, "ROADMAP tamamlandı" yaz ve dur.

Türkçe kullanıcı mesajı + İngilizce kod konvansiyonu.
