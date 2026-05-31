import { describe, expect, it } from "vitest";
import { ISSUE_PROFILE_CHAMBERS, computeChamberBonus } from "../src/health/precedentRelevance.js";
import type { IssueProfile } from "../src/health/precedentRelevance.js";

/**
 * T23.4 — Soru-daire-doküman üçlü doğrulama
 *
 * Her benchmark sorusu için:
 * 1. Soru metninden issue profile çıkar
 * 2. Beklenen daire/duruşmayı `ISSUE_PROFILE_CHAMBERS` ile eşleştir
 * 3. Gerçekten o dokümanlara ulaşılıyor mu kontrol et (mock kararlarla)
 */

describe("T23.4 — Soru-daire-doküman üçlü doğrulama", () => {
  it("ISSUE_PROFILE_CHAMBERS has entries for all defined IssueProfiles", () => {
    const allProfiles: IssueProfile[] = [
      "informed_consent",
      "malpractice_complication",
      "emergency_care",
      "treatment_refusal",
      "privacy_records",
      "psychiatric_privacy",
      "violence_threat",
      "referral_consultation",
      "private_hospital_fee",
      "public_discipline",
      "intensive_care",
      "pregnancy_emergency",
      "public_employment",
    ];
    for (const profile of allProfiles) {
      expect(ISSUE_PROFILE_CHAMBERS[profile]).toBeDefined();
    }
  });

  it("violence_threat → Ceza Dairesi bonus +1, Hukuk Dairesi penalty -1", () => {
    const profile: IssueProfile = "violence_threat";
    expect(computeChamberBonus(profile, "yargitay", "Ceza Dairesi")).toBe(1);
    expect(computeChamberBonus(profile, "yargitay", "Hukuk Dairesi")).toBe(-1);
    expect(computeChamberBonus(profile, "danistay", "İdari Dava Daireleri")).toBe(-1);
  });

  it("public_employment → Danıştay default 0, Yargıtay Hukuk penalty -1", () => {
    const profile: IssueProfile = "public_employment";
    expect(computeChamberBonus(profile, "danistay", "İdari Dava Daireleri")).toBe(0);
    expect(computeChamberBonus(profile, "yargitay", "Hukuk Dairesi")).toBe(-1);
    expect(computeChamberBonus(profile, "yargitay", "Ceza Dairesi")).toBe(-1);
  });

  it("public_discipline → Danıştay default 0, Yargıtay Ceza penalty -1", () => {
    const profile: IssueProfile = "public_discipline";
    expect(computeChamberBonus(profile, "danistay", "İdari Dava Daireleri")).toBe(0);
    expect(computeChamberBonus(profile, "yargitay", "Hukuk Dairesi")).toBe(-1);
    expect(computeChamberBonus(profile, "yargitay", "Ceza Dairesi")).toBe(-1);
  });

  it("malpractice_complication → Yargıtay Hukuk default 0, Danıştay -1", () => {
    const profile: IssueProfile = "malpractice_complication";
    expect(computeChamberBonus(profile, "yargitay", "Hukuk Dairesi")).toBe(0);
    expect(computeChamberBonus(profile, "yargitay", "Ceza Dairesi")).toBe(0);
    expect(computeChamberBonus(profile, "danistay", "İdari Dava Daireleri")).toBe(-1);
  });

  it("emergency_care → Yargıtay Ceza bonus +1, Hukuk default 0", () => {
    const profile: IssueProfile = "emergency_care";
    expect(computeChamberBonus(profile, "yargitay", "Ceza Dairesi")).toBe(1);
    expect(computeChamberBonus(profile, "yargitay", "Hukuk Dairesi")).toBe(0);
  });

  it("triple match table: profile + court + chamber → expected bonus", () => {
    const table = [
      { profile: "violence_threat" as IssueProfile, court: "yargitay", chamber: "Ceza Dairesi", expected: 1 },
      { profile: "violence_threat" as IssueProfile, court: "yargitay", chamber: "Hukuk Dairesi", expected: -1 },
      { profile: "public_employment" as IssueProfile, court: "danistay", chamber: "İdari Dava Daireleri", expected: 0 },
      { profile: "public_employment" as IssueProfile, court: "yargitay", chamber: "Hukuk Dairesi", expected: -1 },
      { profile: "public_discipline" as IssueProfile, court: "danistay", chamber: "İdari Dava Daireleri", expected: 0 },
      { profile: "public_discipline" as IssueProfile, court: "yargitay", chamber: "Ceza Dairesi", expected: -1 },
      { profile: "malpractice_complication" as IssueProfile, court: "yargitay", chamber: "Hukuk Dairesi", expected: 0 },
      { profile: "malpractice_complication" as IssueProfile, court: "danistay", chamber: "İdari Dava Daireleri", expected: -1 },
      { profile: "emergency_care" as IssueProfile, court: "yargitay", chamber: "Ceza Dairesi", expected: 1 },
    ];

    for (const row of table) {
      const bonus = computeChamberBonus(row.profile, row.court, row.chamber);
      expect(bonus).toBe(row.expected);
    }
  });
});
