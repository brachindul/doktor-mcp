export function extractLegalReasoning(fullText: string): string | undefined {
  const markers = ["gerekçe", "hukuki değerlendirme", "değerlendirme", "inceleme", "gerekce", "degerlendirme"];
  const lower = fullText.toLocaleLowerCase("tr-TR");

  for (const marker of markers) {
    const idx = lower.indexOf(marker);
    if (idx !== -1) {
      return fullText.slice(idx, idx + 3000).trim();
    }
  }

  return fullText.length > 200 ? fullText.slice(0, 3000).trim() : undefined;
}

export function extractOutcome(fullText: string): string | undefined {
  const markers = ["sonuç", "hüküm", "karar", "sonuc", "huküm"];
  const lower = fullText.toLocaleLowerCase("tr-TR");

  for (const marker of markers) {
    const idx = lower.lastIndexOf(marker);
    if (idx !== -1 && idx > fullText.length / 2) {
      return fullText.slice(idx, idx + 500).trim();
    }
  }
  return undefined;
}
