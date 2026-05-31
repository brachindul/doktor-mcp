import { describe, it, expect } from "vitest";
import { classifyMedicalLegalQuestion } from "../src/health/questionClassifier.js";

/**
 * T17.2: Branch-specific term mappings.
 *
 * Verifies that clinical specialty terms map to the correct legal dimensions:
 * - "acil servis" / "acil tıp" → emergency_services
 * - "anestezi" / "anestezist" → professional_ethics
 * - "radyoloji" / "radyolog" / "radyasyon" → patient_rights (radiation context)
 */

describe("T17.2: branch-specific term mappings", () => {
  // ── Emergency services ──────────────────────────────────────────────────

  it("maps 'acil servis' to emergency_services dimension", () => {
    const result = classifyMedicalLegalQuestion("Acil serviste hekim görevi nedir?");
    expect(result.dimensions).toContain("emergency_services");
  });

  it("maps 'acil tip' to emergency_services dimension", () => {
    const result = classifyMedicalLegalQuestion("Acil tıp uzmanı ne yapar?");
    expect(result.dimensions).toContain("emergency_services");
  });

  it("maps 'acil tıp' (with Turkish chars) to emergency_services dimension", () => {
    const result = classifyMedicalLegalQuestion("Acil tıp asistanı nöbet tutabilir mi?");
    expect(result.dimensions).toContain("emergency_services");
  });

  // ── Anesthesia / professional ethics ────────────────────────────────────

  it("maps 'anestezi' to professional_ethics dimension", () => {
    const result = classifyMedicalLegalQuestion("Anestezi öncesi hasta aydınlatılmalı mı?");
    expect(result.dimensions).toContain("professional_ethics");
  });

  it("maps 'anestezist' to professional_ethics dimension", () => {
    const result = classifyMedicalLegalQuestion("Anestezist bağımsız müdahale yapabilir mi?");
    expect(result.dimensions).toContain("professional_ethics");
  });

  // ── Radiology / patient_rights ──────────────────────────────────────────

  it("maps 'radyoloji' to patient_rights dimension", () => {
    const result = classifyMedicalLegalQuestion("Radyoloji bölümünde hasta rızası gerekir mi?");
    expect(result.dimensions).toContain("patient_rights");
  });

  it("maps 'radyolog' to patient_rights dimension", () => {
    const result = classifyMedicalLegalQuestion("Radyolog kimseye rapor verebilir mi?");
    expect(result.dimensions).toContain("patient_rights");
  });

  it("maps 'radyasyon' to patient_rights dimension", () => {
    const result = classifyMedicalLegalQuestion("Radyasyon maruziyeti hasta bilgilendirmesi gerektirir mi?");
    expect(result.dimensions).toContain("patient_rights");
  });

  // ── Fallback: unknown terms still produce at least one dimension ────────

  it("always returns at least one dimension for any input", () => {
    const result = classifyMedicalLegalQuestion("Genel bir sağlık sorusu");
    expect(result.dimensions.length).toBeGreaterThan(0);
  });
});
