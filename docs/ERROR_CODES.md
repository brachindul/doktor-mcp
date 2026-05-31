# Error Codes

## mevzuat.gov.tr (Legislation)

| code | meaning | retryable | recommendedNextStep |
|------|---------|-----------|---------------------|
| `source_blocked` | HTTP 403/429 | true | Bekleyip tekrar dene |
| `source_blocked_cloudflare` | Cloudflare bot koruması | true | Tarayıcıdan Cloudflare challenge'ı geçip tekrar dene veya recorded fixture kullan |
| `source_error` | 5xx / network hatası | true | Daha sonra tekrar dene |
| `document_not_found` | 404 / geçersiz sourceId | false | sourceId'yi doğrula |
| `parse_failed` | PDF metin çıkarılamadı | false | Doküman formatını kontrol et |
| `unsupported_content_type` | PDF değil | true | İçerik tipini kontrol et |

## Yargıtay

| code | meaning | retryable |
|------|---------|-----------|
| `source_blocked` | 403/429 | true |
| `source_error` | 5xx / network | true |
| `search_failed` | Arama sonucu parse edilemedi | true |
| `timeout` | İstek zaman aşımı | true |

## Danıştay

| code | meaning | retryable |
|------|---------|-----------|
| `source_blocked` | 403/429 | true |
| `source_error` | 5xx / network | true |
| `search_failed` | Arama sonucu parse edilemedi | true |

## AYM

| code | meaning | retryable |
|------|---------|-----------|
| `synthetic_only` | API yok, HTML-only | n/a |

## Bedesten

| code | meaning | retryable |
|------|---------|-----------|
| `source_blocked` | 403/429 | true |
| `source_error` | 5xx / network | true |
