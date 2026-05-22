import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import {
  normalizeYargitaySearchResults,
  extractYargitayFullText,
  buildYargitayDecision
} from "../src/sources/yargitay/yargitayNormalizer.js";
import { assessDecisionEligibility } from "../src/health/decisionEligibility.js";

const fixturesDir = join(fileURLToPath(import.meta.url), "../../fixtures/live-samples");

describe("normalizeYargitaySearchResults", () => {
  it("returns empty array for null input", () => {
    expect(normalizeYargitaySearchResults(null)).toEqual([]);
  });

  it("returns empty array for non-object input", () => {
    expect(normalizeYargitaySearchResults("string")).toEqual([]);
    expect(normalizeYargitaySearchResults(42)).toEqual([]);
  });

  it("returns empty array when no array found", () => {
    expect(normalizeYargitaySearchResults({ foo: "bar" })).toEqual([]);
  });

  it("normalizes synthetic fixture data array", () => {
    const raw = JSON.parse(
      readFileSync(join(fixturesDir, "yargitay-synthetic.json"), "utf-8")
    );
    const results = normalizeYargitaySearchResults(raw);
    expect(results).toHaveLength(2);
    expect(results[0].documentId).toBe("yargitay:12345");
    expect(results[0].sourceId).toBe("12345");
    expect(results[0].chamber).toBe("4. Hukuk Dairesi");
    expect(results[0].meritsNumber).toBe("2022/1234");
    expect(results[0].decisionNumber).toBe("2023/5678");
    expect(results[0].date).toBe("2023-03-15");
    expect(results[0].sourceUrl).toContain("12345");
  });

  it("handles items without ID by skipping them", () => {
    const raw = { data: [{ OZET: "no id here" }, { ID: "999", OZET: "has id" }] };
    const results = normalizeYargitaySearchResults(raw);
    expect(results).toHaveLength(1);
    expect(results[0].documentId).toBe("yargitay:999");
  });

  it("handles data as a direct array", () => {
    const raw = [{ ID: "1", OZET: "test" }];
    const results = normalizeYargitaySearchResults(raw);
    expect(results).toHaveLength(1);
    expect(results[0].documentId).toBe("yargitay:1");
  });

  it("normalizes alternative field names", () => {
    const raw = { results: [{ id: "abc", ozet: "summary" }] };
    const results = normalizeYargitaySearchResults(raw);
    expect(results).toHaveLength(1);
    expect(results[0].documentId).toBe("yargitay:abc");
    expect(results[0].summaryText).toBe("summary");
  });
});

describe("extractYargitayFullText", () => {
  it("strips HTML tags", () => {
    const html = "<html><body><p>Test içerik</p></body></html>";
    const result = extractYargitayFullText(html);
    expect(result).toContain("Test içerik");
    expect(result).not.toContain("<p>");
  });

  it("strips script and style blocks", () => {
    const html = "<html><head><script>alert(1)</script><style>.a{}</style></head><body>Karar metni</body></html>";
    const result = extractYargitayFullText(html);
    expect(result).not.toContain("alert");
    expect(result).toContain("Karar metni");
  });

  it("decodes HTML entities", () => {
    const html = "<p>Hukuki &amp; Teknik Değerlendirme &lt;not a tag&gt;</p>";
    const result = extractYargitayFullText(html);
    expect(result).toContain("Hukuki & Teknik");
    expect(result).toContain("<not a tag>");
  });

  it("collapses whitespace", () => {
    const html = "<p>Word1</p>   <p>Word2</p>";
    const result = extractYargitayFullText(html);
    expect(result).toBe("Word1 Word2");
  });
});

describe("buildYargitayDecision", () => {
  const sampleResult = {
    documentId: "yargitay:12345",
    sourceId: "12345",
    title: "Test title",
    date: "2023-03-15",
    chamber: "4. Hukuk Dairesi",
    meritsNumber: "2022/1234",
    decisionNumber: "2023/5678",
    sourceUrl: "https://emsal.yargitay.gov.tr/DetailMain.aspx?id=12345",
    documentUrl: "https://emsal.yargitay.gov.tr/DownloadYargitayDoc?id=12345",
    summaryText: "Aydınlatılmış rıza alınmadan yapılan müdahale."
  };

  it("builds decision with full text", () => {
    const fullText = "GEREKÇE: Davacı aydınlatılmış rızası olmadan ameliyat edilmiştir. Doktor bilgilendirme yükümlülüğünü yerine getirmemiştir. SONUÇ: Davanın kabulüne.";
    const decision = buildYargitayDecision(sampleResult, fullText, "aydınlatılmış rıza", "2024-01-01T00:00:00.000Z");

    expect(decision.id).toBe("yargitay:12345");
    expect(decision.court).toBe("yargitay");
    expect(decision.chamber).toBe("4. Hukuk Dairesi");
    expect(decision.fullText).toBe(fullText);
    expect(decision.legalReasoning).toBeTruthy();
    expect(decision.evidence.official).toBe(true);
    expect(decision.evidence.fullText).toBe(true);
  });

  it("builds decision without full text", () => {
    const decision = buildYargitayDecision(sampleResult, null, "aydınlatılmış rıza", "2024-01-01T00:00:00.000Z");
    expect(decision.fullText).toBeUndefined();
    expect(decision.legalReasoning).toBeUndefined();
    expect(decision.evidence.fullText).toBe(false);
  });

  it("sets relevanceNote when fullText and legalReasoning both present", () => {
    const fullText = "GEREKÇE: Uzun bir gerekçe metni. ".repeat(10);
    const decision = buildYargitayDecision(sampleResult, fullText, "aydınlatılmış rıza", "2024-01-01T00:00:00.000Z");
    expect(decision.relevanceNote).toContain("aydınlatılmış rıza");
  });
});

describe("eligibility pipeline with synthetic Yargıtay fixture", () => {
  it("decisions with no full text are metadata_only", () => {
    const result = {
      documentId: "yargitay:1",
      sourceId: "1",
      sourceUrl: "https://emsal.yargitay.gov.tr/DetailMain.aspx?id=1",
      summaryText: ""
    };
    const decision = buildYargitayDecision(result, null, "test", "2024-01-01T00:00:00.000Z");
    const { status } = assessDecisionEligibility(decision);
    expect(["metadata_only", "limited_value", "procedural_only", "no_reasoning"]).toContain(status);
  });

  it("decisions with full text and reasoning can be precedent_usable", () => {
    const result = {
      documentId: "yargitay:2",
      sourceId: "2",
      sourceUrl: "https://emsal.yargitay.gov.tr/DetailMain.aspx?id=2",
      summaryText: "Aydınlatılmış rıza ihlali"
    };
    const fullText = "GEREKÇE: Davacı ameliyat öncesi aydınlatılmış rızası olmadan müdahaleye maruz kalmıştır. " +
      "Türk Medeni Kanunu ve Hasta Hakları Yönetmeliği kapsamında değerlendirildiğinde doktorun bilgilendirme " +
      "yükümlülüğünü yerine getirmediği anlaşılmaktadır. Tazminat talebinin kabulü gerekir. ".repeat(3) +
      "SONUÇ: Davanın kabulüne karar verildi.";
    const decision = buildYargitayDecision(result, fullText, "aydınlatılmış rıza", "2024-01-01T00:00:00.000Z");
    const { status } = assessDecisionEligibility(decision);
    // With full text and reasoning it should at least not be metadata_only
    expect(status).not.toBe("metadata_only");
  });
});
