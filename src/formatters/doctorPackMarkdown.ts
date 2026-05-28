/**
 * Deterministic Doctor Pack Markdown Renderer (v0.43.0)
 *
 * Renders a DoctorLegalInformationPack into stable, human-readable Markdown.
 * Section order is deterministic. Content is not truncated but the renderer
 * enforces a safe, physician-appropriate tone.
 */

import type { DoctorLegalInformationPack } from "../contracts/legal.js";

const SAFE_OPENING = "Bu paket, aşağıdaki resmi kaynaklarla sınırlı hukuki bilgilendirme sağlar.";
const LAWYER_REVIEW_PROMPT = "Somut olay belgeleri ile resmi kaynak esleştirmesinin avukat tarafindan kontrolu gerekir.";

/**
 * Render a DoctorLegalInformationPack to deterministic Markdown.
 *
 * Section order:
 * 1. Hekim Hukuki Bilgilendirme Paketi (title)
 * 2. Kısa Cevap
 * 3. Hukuki Sınıflandırma
 * 4. İlgili Resmi Mevzuat
 * 5. Doğrulanmış Yüksek Mahkeme Emsalleri
 * 6. Kaynak Sınırlılığı ve Eksik Bilgiler
 * 7. Avukat İncelemesi Gerektiren Noktalar
 * 8. Teknik Doğrulama Özeti
 */
export function renderDoctorPackMarkdown(pack: DoctorLegalInformationPack): string {
  const sections: string[] = [];

  // 1. Title
  sections.push("# Hekim Hukuki Bilgilendirme Paketi");
  sections.push("");

  // 2. Short answer
  sections.push("## Kısa Cevap");
  sections.push("");
  sections.push(pack.shortAnswer);
  sections.push("");
  sections.push(SAFE_OPENING);
  sections.push("");

  // 3. Legal classification
  sections.push("## Hukuki Sınıflandırma");
  sections.push("");
  sections.push(renderLegalClassification(pack));
  sections.push("");

  // 4. Relevant legislation
  sections.push("## İlgili Resmi Mevzuat");
  sections.push("");
  if (pack.relevantLegislation.length === 0) {
    sections.push("Doğrulanmış resmi mevzuat maddesi bulunamadı.");
  } else {
    for (const leg of pack.relevantLegislation) {
      sections.push(`### ${leg.legislationName} — Madde ${leg.articleNumber}`);
      sections.push("");
      sections.push(`> ${leg.verbatimQuote}`);
      sections.push("");
      sections.push(`**Bağlantı:** ${leg.connection}`);
      if (leg.sourceTrace) {
        sections.push(`**Kaynak:** ${leg.sourceTrace.fullTextUrl ?? leg.sourceTrace.landingUrl ?? leg.sourceDocumentId}`);
      }
      sections.push("");
    }
  }

  // 5. Verified precedents
  sections.push("## Doğrulanmış Yüksek Mahkeme Emsalleri");
  sections.push("");
  if (pack.verifiedHighCourtPrecedents.length === 0) {
    sections.push("Doğrulanmış emsal karar bulunamadı.");
  } else {
    for (const prec of pack.verifiedHighCourtPrecedents) {
      sections.push(`### ${prec.courtAndChamber} — ${prec.date}`);
      sections.push("");
      sections.push(`**E/K:** ${prec.meritsAndDecisionNumber}`);
      sections.push("");
      sections.push(`**Olay Özeti:** ${prec.factSummary}`);
      sections.push("");
      sections.push(`**Hukuki Değerlendirme:** ${prec.legalAssessment}`);
      sections.push("");
      sections.push(`**Sonuç:** ${prec.outcome}`);
      sections.push("");
      sections.push(`**Benzerlik/Fark:** ${prec.similarityDifference}`);
      sections.push("");
    }
  }

  // 6. Source limitations and missing information
  sections.push("## Kaynak Sınırlılığı ve Eksik Bilgiler");
  sections.push("");
  if (pack.missingInformation.length > 0) {
    sections.push("### Eksik Bilgiler");
    for (const mi of pack.missingInformation) {
      sections.push(`- ${mi}`);
    }
    sections.push("");
  }
  if (pack.sourceWarnings.length > 0) {
    sections.push("### Kaynak Uyarıları");
    for (const sw of pack.sourceWarnings) {
      sections.push(`- ${sw}`);
    }
    sections.push("");
  }
  if (pack.sourceUnavailable && pack.sourceUnavailable.length > 0) {
    sections.push("### Ulaşılamayan Kaynaklar");
    for (const su of pack.sourceUnavailable) {
      sections.push(`- ${su.source}: ${su.message}`);
    }
    sections.push("");
  }

  // 7. Lawyer review points
  sections.push("## Avukat İncelemesi Gerektiren Noktalar");
  sections.push("");
  for (const point of pack.lawyerReviewPoints) {
    sections.push(`- ${point}`);
  }
  sections.push("");

  // 8. Technical verification summary
  sections.push("## Teknik Doğrulama Özeti");
  sections.push("");
  sections.push(`- Mevzuat kaynağı: ${pack.relevantLegislation.length} madde`);
  sections.push(`- Doğrulanmış emsal: ${pack.verifiedHighCourtPrecedents.length} karar`);
  if (pack.sourceUnavailable && pack.sourceUnavailable.length > 0) {
    sections.push(`- Ulaşılamayan kaynak: ${pack.sourceUnavailable.length}`);
  }
  sections.push("");
  sections.push(LAWYER_REVIEW_PROMPT);

  return sections.join("\n");
}

function renderLegalClassification(pack: DoctorLegalInformationPack): string {
  const lines: string[] = [];
  const lc = pack.legalClassification;
  const dimensionLabels: Record<string, string> = {
    criminal: "Ceza",
    civilCompensation: "Tazminat",
    disciplinaryAdministrative: "Disiplin/İdari Soruşturma",
    patientRights: "Hasta Hakları",
    privacyKvkk: "KVKK/Mahremiyet",
    professionalEthics: "Meslek Etiği"
  };

  for (const [key, label] of Object.entries(dimensionLabels)) {
    const values = lc[key as keyof typeof lc] as unknown;
    if (Array.isArray(values) && values.length > 0) {
      lines.push(`**${label}:**`);
      for (const v of values) {
        if (typeof v === "string") lines.push(`- ${v}`);
      }
      lines.push("");
    } else if (typeof values === "string" && values.trim()) {
      lines.push(`**${label}:** ${values}`);
      lines.push("");
    }
  }

  return lines.join("\n").trim();
}

/**
 * Render a no-pack diagnostic to Markdown.
 */
export function renderNoPackDiagnosticMarkdown(options: {
  noPackReason: string;
  coverageGaps?: string[];
  retrievalTimeouts?: string[];
  missingAuthorityTypes?: string[];
}): string {
  const sections: string[] = [];

  sections.push("# Hekim Hukuki Bilgilendirme Paketi");
  sections.push("");
  sections.push("## Durum");
  sections.push("");
  sections.push("**Bu soru için güvenli research pack üretilemedi.**");
  sections.push("");
  sections.push("Aşağıdaki resmi kaynaklar sınırlı bilgi sağlamaktadır. Kesin hukuki değerlendirme yapılmaz.");
  sections.push("");

  sections.push("## Neden Üretilmedi");
  sections.push("");
  sections.push(options.noPackReason);
  sections.push("");

  if (options.retrievalTimeouts && options.retrievalTimeouts.length > 0) {
    sections.push("## Ulaşılamayan Kaynaklar");
    for (const rt of options.retrievalTimeouts) {
      sections.push(`- ${rt}`);
    }
    sections.push("");
  }

  if (options.coverageGaps && options.coverageGaps.length > 0) {
    sections.push("## Tespit Edilen Kaynak Boşlukları");
    for (const gap of options.coverageGaps) {
      sections.push(`- ${gap}`);
    }
    sections.push("");
  }

  sections.push("## Avukat İncelemesi İçin Gereken Bilgiler");
  sections.push("");
  sections.push("- Somut olaya ilişkin resmi belgeler");
  sections.push("- İlgili mevzuat maddelerinin güncel metinleri");
  sections.push("- Varsa emsal kararların tam metinleri");
  sections.push("");

  sections.push("## Teknik Doğrulama Özeti");
  sections.push("");
  sections.push("- Mevzuat kaynağı: 0 madde");
  sections.push("- Doğrulanmış emsal: 0 karar");
  if (options.missingAuthorityTypes && options.missingAuthorityTypes.length > 0) {
    sections.push(`- Eksik yetki türü: ${options.missingAuthorityTypes.join(", ")}`);
  }
  sections.push("");
  sections.push(LAWYER_REVIEW_PROMPT);

  return sections.join("\n");
}
