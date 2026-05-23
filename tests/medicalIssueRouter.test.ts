/**
 * tests/medicalIssueRouter.test.ts
 *
 * v0.23.0 — Medical Issue Router
 *
 * Pure-function tests: no network, no file I/O.
 */

import { describe, it, expect } from "vitest";
import { routeMedicalIssue } from "../src/medicalIssueRouter.js";
import type { MedicalIssueId, RouteConfidence } from "../src/medicalIssueRouter.js";

// ─── helpers ──────────────────────────────────────────────────────────────────

function primaryId(question: string): MedicalIssueId | null {
  return routeMedicalIssue(question).primaryIssueId;
}

function topConfidence(question: string): RouteConfidence | null {
  const result = routeMedicalIssue(question);
  return result.routes[0]?.confidence ?? null;
}

function hasIssue(question: string, id: MedicalIssueId): boolean {
  return routeMedicalIssue(question).routes.some((r) => r.issueId === id);
}

function routeIds(question: string): MedicalIssueId[] {
  return routeMedicalIssue(question).routes.map((r) => r.issueId);
}

// ─── 1. Core issue routing ─────────────────────────────────────────────────────

describe("routeMedicalIssue — single issue detection", () => {
  it("routes aydınlatılmış onam question → informed_consent (high)", () => {
    const q = "Hastaya ameliyat öncesi aydınlatılmış onam belgesi imzalatmadım. Ne yapmalıyım?";
    expect(primaryId(q)).toBe("informed_consent");
    expect(topConfidence(q)).toBe("high");
  });

  it("routes epikriz / kayıt sorusu → medical_records", () => {
    const q = "Taburcu epikrizini eksik yazdım, hasta dosyası tamamlanmamış. Hukuki riski nedir?";
    expect(hasIssue(q, "medical_records")).toBe(true);
  });

  it("routes hasta verisi paylaşımı → privacy_kvkk", () => {
    const q = "Hastanın KVKK kapsamında kişisel sağlık verisini üçüncü kişiye verdim. Ne yapmalıyım?";
    expect(primaryId(q)).toBe("privacy_kvkk");
  });

  it("routes acil müdahale / rıza yok → emergency_care", () => {
    const q = "Acil serviste bilinçsiz hasta geldi, hayati tehlike var ve rıza alınamıyor.";
    expect(hasIssue(q, "emergency_care")).toBe(true);
  });

  it("routes acil + onam birlikte → hem emergency_care hem informed_consent", () => {
    const q = "Acil müdahale gerekiyor ama hasta bilinçsiz, onam alınamaması durumunda ne yapılır?";
    const ids = routeIds(q);
    expect(ids).toContain("emergency_care");
    expect(ids).toContain("informed_consent");
  });

  it("routes sevk / konsültasyon → referral_consultation", () => {
    const q = "Hastayı başka uzmana sevk etmem gerekirdi, konsültasyon istedim ama gecikmeli yanıt aldım.";
    expect(primaryId(q)).toBe("referral_consultation");
  });

  it("routes komplikasyon / malpraktis iddiası → malpractice_complication", () => {
    const q = "Ameliyat sonrası komplikasyon gelişti. Hasta tıbbi hata iddiasıyla beni şikayet etti.";
    expect(hasIssue(q, "malpractice_complication")).toBe(true);
  });

  it("routes disiplin soruşturması → disciplinary_admin", () => {
    const q = "Kamu hastanesinde görev yapıyorum. İdari soruşturma açıldı, disiplin cezası gelebilir mi?";
    expect(primaryId(q)).toBe("disciplinary_admin");
  });

  it("routes hasta hakları başvurusu → patient_rights", () => {
    const q = "Hasta, hasta hakları birimi üzerinden bana şikayet başvurusunda bulunmuş.";
    expect(primaryId(q)).toBe("patient_rights");
  });

  it("routes taksirle yaralama isnadı → criminal_liability", () => {
    const q = "Hasta yakını taksirle yaralama suçlamasıyla savcıya suç duyurusunda bulunacağını söyledi.";
    expect(primaryId(q)).toBe("criminal_liability");
  });

  it("routes tazminat davası → civil_compensation", () => {
    const q = "Hasta maddi ve manevi tazminat davası açmak istiyor. Hukuki sorumluluğum ne?";
    expect(hasIssue(q, "civil_compensation")).toBe(true);
  });

  it("routes özel hastane sorusu → private_health_facility", () => {
    const q = "Özel hastanede çalışıyorum. Kuruluşun lisans ve denetim yükümlülükleri neler?";
    expect(primaryId(q)).toBe("private_health_facility");
  });

  it("routes uzmanlık sınırı → professional_scope_of_practice", () => {
    const q = "Uzmanlık alanım dışında bir işlem yaptım. Branş dışı müdahale sayılır mı?";
    expect(primaryId(q)).toBe("professional_scope_of_practice");
  });

  it("routes işyeri hekimi sorusu → workplace_employee_health", () => {
    const q = "İşyeri hekimiyim. Çalışana iş kazası sonrası istirahat raporu düzenledim.";
    expect(primaryId(q)).toBe("workplace_employee_health");
  });

  it("routes reçete / rapor sorusu → prescription_report", () => {
    const q = "Yanlış reçete yazdım. Hastaya hatalı dozda ilaç yazıldı.";
    expect(primaryId(q)).toBe("prescription_report");
  });

  it("routes ölüm bildirimi / adli vaka → death_postmortem", () => {
    const q = "Sebebi bilinmeyen ani ölüm gerçekleşti. Adli vaka bildirimi ve defin ruhsatı nasıl düzenlenir?";
    expect(primaryId(q)).toBe("death_postmortem");
  });
});

// ─── 2. Unclear / mixed ───────────────────────────────────────────────────────

describe("routeMedicalIssue — unclear / low signal", () => {
  it("very short vague question → unclear_or_mixed or low confidence", () => {
    const result = routeMedicalIssue("Ne yapmalıyım?");
    const isUnclear = result.primaryIssueId === "unclear_or_mixed";
    const isLow = result.routes[0]?.confidence === "low";
    expect(isUnclear || isLow).toBe(true);
  });

  it("empty input → unclear_or_mixed", () => {
    expect(primaryId("")).toBe("unclear_or_mixed");
  });

  it("empty input → routerWarnings not empty", () => {
    const result = routeMedicalIssue("");
    expect(result.routerWarnings.length).toBeGreaterThan(0);
  });

  it("whitespace-only input → unclear_or_mixed", () => {
    expect(primaryId("   ")).toBe("unclear_or_mixed");
  });
});

// ─── 3. Multi-issue questions ─────────────────────────────────────────────────

describe("routeMedicalIssue — multi-issue questions", () => {
  it("onam + epikriz question → both informed_consent and medical_records", () => {
    const q = "Hastanın onam belgesi yok ve hasta dosyası da epikriz içermiyor. Ne yapmalıyım?";
    const ids = routeIds(q);
    expect(ids).toContain("informed_consent");
    expect(ids).toContain("medical_records");
  });

  it("disiplin + tazminat birlikte → disciplinary_admin ve civil_compensation", () => {
    const q = "İdari soruşturma açıldı ve hasta maddi tazminat davası açacak.";
    const ids = routeIds(q);
    expect(ids).toContain("disciplinary_admin");
    expect(ids).toContain("civil_compensation");
  });

  it("multi-issue returns routes sorted by score (first ≥ second)", () => {
    const q = "Acil serviste bilinçsiz hastaya müdahale ettim, onam yoktu ve hasta dosyası eksik kaldı.";
    const result = routeMedicalIssue(q);
    if (result.routes.length >= 2) {
      expect(result.routes[0].score).toBeGreaterThanOrEqual(result.routes[1].score);
    }
  });
});

// ─── 4. Router output contract ────────────────────────────────────────────────

describe("routeMedicalIssue — output contract", () => {
  const SAMPLE_Q = "Ameliyat öncesi hastaya aydınlatılmış onam aldım mı almadım mı bilmiyorum.";

  it("returns normalizedQuestion as non-empty string", () => {
    const result = routeMedicalIssue(SAMPLE_Q);
    expect(typeof result.normalizedQuestion).toBe("string");
    expect(result.normalizedQuestion.length).toBeGreaterThan(0);
  });

  it("routes array is non-empty for a valid question", () => {
    const result = routeMedicalIssue(SAMPLE_Q);
    expect(result.routes.length).toBeGreaterThan(0);
  });

  it("each route has required fields", () => {
    const result = routeMedicalIssue(SAMPLE_Q);
    for (const route of result.routes) {
      expect(typeof route.issueId).toBe("string");
      expect(typeof route.label).toBe("string");
      expect(["high", "medium", "low"]).toContain(route.confidence);
      expect(typeof route.score).toBe("number");
      expect(route.score).toBeGreaterThan(0);
      expect(Array.isArray(route.matchedTerms)).toBe(true);
      expect(typeof route.reason).toBe("string");
      expect(Array.isArray(route.suggestedTopicClusters)).toBe(true);
      expect(Array.isArray(route.suggestedCourtSearchTerms)).toBe(true);
    }
  });

  it("primaryIssueId matches first route issueId", () => {
    const result = routeMedicalIssue(SAMPLE_Q);
    if (result.routes.length > 0) {
      expect(result.primaryIssueId).toBe(result.routes[0].issueId);
    }
  });

  it("missingInfoHints is an array", () => {
    const result = routeMedicalIssue(SAMPLE_Q);
    expect(Array.isArray(result.missingInfoHints)).toBe(true);
  });

  it("routerWarnings is an array", () => {
    const result = routeMedicalIssue(SAMPLE_Q);
    expect(Array.isArray(result.routerWarnings)).toBe(true);
  });
});

// ─── 5. Safety invariants ─────────────────────────────────────────────────────

describe("routeMedicalIssue — safety invariants (no forbidden content)", () => {
  const FORBIDDEN_PATTERNS = [
    "risk seviyesi",
    "risk yuksek",
    "risk dusuk",
    "derhal yapilacak",
    "kesin hukuki kanaat",
    "dilekce taslagi",
    "savunma taslagi"
  ];

  it("reason field never contains forbidden patterns", () => {
    const questions = [
      "Hastaya komplikasyon hakkında bilgilendirme yapmadım. Tazminat davası açılacak mı?",
      "Yanlış reçete yazdım. Ceza davası açılabilir mi?",
      "Acil müdahalede onam alamadım.",
      "Disiplin soruşturması açıldı."
    ];
    for (const q of questions) {
      const result = routeMedicalIssue(q);
      for (const route of result.routes) {
        const lowerReason = route.reason.toLocaleLowerCase("tr-TR");
        for (const forbidden of FORBIDDEN_PATTERNS) {
          expect(lowerReason, `Route reason for "${q}" contains "${forbidden}"`).not.toContain(forbidden);
        }
      }
    }
  });

  it("suggestedCourtSearchTerms never contains forbidden patterns", () => {
    const result = routeMedicalIssue("Malpraktis iddiası var, onam belgesi de yok.");
    for (const route of result.routes) {
      for (const term of route.suggestedCourtSearchTerms) {
        const lower = term.toLocaleLowerCase("tr-TR");
        for (const forbidden of FORBIDDEN_PATTERNS) {
          expect(lower, `suggestedCourtSearchTerms contains "${forbidden}"`).not.toContain(forbidden);
        }
      }
    }
  });

  it("router does not return a risk level assessment", () => {
    const result = routeMedicalIssue("Komplikasyon gelişti. Risk durumum nedir?");
    const full = JSON.stringify(result).toLocaleLowerCase("tr-TR");
    expect(full).not.toContain("risk seviyesi");
    expect(full).not.toContain("risk yuksek");
    expect(full).not.toContain("risk dusuk");
  });
});

// ─── 6. Topic cluster alignment ───────────────────────────────────────────────

describe("routeMedicalIssue — topic cluster alignment with v0.22.0", () => {
  it("informed_consent route includes informed_consent or patient_rights cluster", () => {
    const result = routeMedicalIssue("Ameliyat öncesi aydınlatılmış onam alınmadı.");
    const consentRoute = result.routes.find((r) => r.issueId === "informed_consent");
    expect(consentRoute).toBeDefined();
    const clusters = consentRoute!.suggestedTopicClusters;
    expect(clusters.some((c) => c === "informed_consent" || c === "patient_rights")).toBe(true);
  });

  it("private_health_facility route uses private_health_facility cluster", () => {
    const result = routeMedicalIssue("Özel hastanede lisans ve denetim yükümlülükleri nelerdir?");
    const facilityRoute = result.routes.find((r) => r.issueId === "private_health_facility");
    expect(facilityRoute).toBeDefined();
    expect(facilityRoute!.suggestedTopicClusters).toContain("private_health_facility");
  });

  it("professional_scope_of_practice route uses professional_scope_of_practice cluster", () => {
    const result = routeMedicalIssue("Uzmanlık sınırı dışında işlem yaptım.");
    const scopeRoute = result.routes.find((r) => r.issueId === "professional_scope_of_practice");
    expect(scopeRoute).toBeDefined();
    expect(scopeRoute!.suggestedTopicClusters).toContain("professional_scope_of_practice");
  });
});

// ─── 7. Turkish diacritic normalization ──────────────────────────────────────

describe("routeMedicalIssue — Turkish normalization", () => {
  it("matches with and without diacritics (rıza vs riza)", () => {
    const withDiac = routeMedicalIssue("Hastadan rıza alınmadan ameliyat yapıldı.");
    const withoutDiac = routeMedicalIssue("Hastadan riza alinmadan ameliyat yapildi.");
    expect(withDiac.primaryIssueId).toBe(withoutDiac.primaryIssueId);
  });

  it("matches özel hastane (with ö) and ozel hastane (without ö)", () => {
    const with_ = routeMedicalIssue("Özel hastanede çalışıyorum.");
    const without_ = routeMedicalIssue("Ozel hastanede calisiyorum.");
    expect(with_.primaryIssueId).toBe(without_.primaryIssueId);
  });
});
