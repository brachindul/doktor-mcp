# Hata Kodları

## mevzuat.gov.tr (Mevzuat)

| kod | anlam | yeniden denenebilir | recommendedNextStep |
|------|-------|---------------------|---------------------|
| `source_blocked` | HTTP 403/429 | true | Bekleyip tekrar dene |
| `source_blocked_cloudflare` | Cloudflare bot koruması | true | Tarayıcıdan Cloudflare challenge'ı geçip tekrar dene veya recorded fixture kullan |
| `source_error` | 5xx / ağ hatası | true | Daha sonra tekrar dene |
| `document_not_found` | 404 / geçersiz sourceId | false | sourceId'yi doğrula |
| `parse_failed` | PDF metni çıkarılamadı | false | Doküman formatını kontrol et |
| `unsupported_content_type` | PDF değil | true | İçerik tipini kontrol et |

## Yargıtay

| kod | anlam | yeniden denenebilir |
|------|-------|---------------------|
| `source_blocked` | 403/429 | true |
| `source_error` | 5xx / ağ | true |
| `search_failed` | Arama sonucu ayrıştırılamadı | true |
| `timeout` | İstek zaman aşımı | true |

## Danıştay

| kod | anlam | yeniden denenebilir |
|------|-------|---------------------|
| `source_blocked` | 403/429 | true |
| `source_error` | 5xx / ağ | true |
| `search_failed` | Arama sonucu ayrıştırılamadı | true |

## AYM

| kod | anlam | yeniden denenebilir |
|------|-------|---------------------|
| `synthetic_only` | API yok, yalnızca-HTML | uygulanamaz |

## Bedesten

| kod | anlam | yeniden denenebilir |
|------|-------|---------------------|
| `source_blocked` | 403/429 | true |
| `source_error` | 5xx / ağ | true |
