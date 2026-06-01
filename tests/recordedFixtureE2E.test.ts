import { describe, expect, it } from "vitest";
import { loadAxisFixture, loadAllAxisFixtures, validateFixture } from "../src/fixtureReplay.js";

describe("T27.1 — Recorded-fixture tabanlı eksen e2e harness'ı", () => {
  const axes = ["disiplin", "malpraktis", "tayin", "gizlilik", "riza_onam", "acil_mudahale", "ek_odeme", "mecburi_hizmet"];

  it("all 8 core axis fixtures exist and load without errors", () => {
    for (const axis of axes) {
      const fixture = loadAxisFixture(axis);
      expect(fixture).toBeDefined();
      expect(fixture.axis).toBe(axis);
    }
  });

  it("loadAllAxisFixtures returns 8 fixtures", () => {
    const all = loadAllAxisFixtures();
    expect(all).toHaveLength(8);
  });

  it("every fixture passes validation", () => {
    const all = loadAllAxisFixtures();
    for (const fixture of all) {
      const result = validateFixture(fixture);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    }
  });

  it("fixtures contain real legislation text (no fabricated content markers)", () => {
    const all = loadAllAxisFixtures();
    const fabricationMarkers = ["taslak", "placeholder", "FABRICATED", "fake", "uydurma"];
    for (const fixture of all) {
      const text = JSON.stringify(fixture).toLowerCase();
      for (const marker of fabricationMarkers) {
        expect(text).not.toContain(marker);
      }
    }
  });

  it("fixtures specify expected primary legislation names", () => {
    const all = loadAllAxisFixtures();
    for (const fixture of all) {
      expect(fixture.expectedPrimaryLegislation.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("every fixture has a sanitization note", () => {
    const all = loadAllAxisFixtures();
    for (const fixture of all) {
      expect(fixture.sanitization_note).toBeDefined();
      expect(fixture.sanitization_note.length).toBeGreaterThan(10);
    }
  });

  it("disiplin fixture contains 657 DMK provisions", () => {
    const fixture = loadAxisFixture("disiplin");
    expect(fixture.provisions.some((p) => p.legislationName.includes("657"))).toBe(true);
    expect(fixture.provisions.some((p) => p.articleNumber === "125")).toBe(true);
  });

  it("malpraktis fixture contains Deontology provision", () => {
    const fixture = loadAxisFixture("malpraktis");
    expect(fixture.provisions.some((p) => p.legislationName.includes("Deontoloji"))).toBe(true);
  });

  it("all provision verbatimQuotes are non-empty and substantive", () => {
    const all = loadAllAxisFixtures();
    for (const fixture of all) {
      for (const provision of fixture.provisions) {
        expect(provision.verbatimQuote.length).toBeGreaterThan(20);
      }
    }
  });
});
