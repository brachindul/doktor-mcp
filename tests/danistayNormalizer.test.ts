import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import {
  normalizeDanistaySearchResults,
  extractDanistayFullText,
  buildDanistayDecision,
  classifyNonJsonResponse
} from "../src/sources/danistay/danistayNormalizer.js";
import { assessDecisionEligibility } from "../src/health/decisionEligibility.js";

const fixturesDir = join(fileURLToPath(import.meta.url), "../../fixtures/live-samples");

describe("normalizeDanistaySearchResults", () => {
  it("returns empty array for null input", () => {
    expect(normalizeDanistaySearchResults(null)).toEqual([]);
  });

  it("returns empty array for non-object input", () => {
    expect(normalizeDanistaySearchResults("string")).toEqual([]);
  });

  it("normalizes synthetic fixture data array", () => {
    const raw = JSON.parse(
      readFileSync(join(fixturesDir, "danistay-synthetic.json"), "utf-8")
    );
    const results = normalizeDanistaySearchResults(raw);
    expect(results).toHaveLength(2);
    expect(results[0].documentId).toBe("danistay:98765");
    expect(results[0].sourceId).toBe("98765");
    expect(results[0].chamber).toBe("2. Daire");
    expect(results[0].meritsNumber).toBe("2021/9999");
    expect(results[0].decisionNumber).toBe("2022/1111");
    expect(results[0].date).toBe("2022-06-10");
    expect(results[0].sourceUrl).toContain("98765");
  });

  it("normalizes a simulated captured fixture shape", () => {
    // Tests the structure exactly as we expect from a raw browser capture
    const rawCaptured = {
      data: [{
        KARAR_ID: "445566",
        OZET: "This is a real captured summary test.",
        KARAR_TARIHI: "2026-05-22",
        DAIRESI: "15. Daire",
        ESAS_YILI: "2025",
        ESAS_SIRASI: "100",
        KARAR_YILI: "2026",
        KARAR_SIRASI: "200"
      }]
    };
    const results = normalizeDanistaySearchResults(rawCaptured);
    expect(results).toHaveLength(1);
    expect(results[0].documentId).toBe("danistay:445566");
    expect(results[0].sourceId).toBe("445566");
    expect(results[0].chamber).toBe("15. Daire");
    expect(results[0].meritsNumber).toBe("2025/100");
    expect(results[0].decisionNumber).toBe("2026/200");
    expect(results[0].summaryText).toBe("This is a real captured summary test.");
    expect(results[0].date).toBe("2026-05-22");
  });

  it("handles items without ID by skipping them", () => {
    const raw = { data: [{ OZET: "no id" }, { ID: "55", OZET: "has id" }] };
    const results = normalizeDanistaySearchResults(raw);
    expect(results).toHaveLength(1);
    expect(results[0].documentId).toBe("danistay:55");
  });

  it("handles DAIRESI field for chamber", () => {
    const raw = { data: [{ ID: "1", DAIRESI: "3. İdare Dairesi", OZET: "test" }] };
    const results = normalizeDanistaySearchResults(raw);
    expect(results[0].chamber).toBe("3. İdare Dairesi");
  });

  it("handles alternative field names", () => {
    const raw = { results: [{ id: "xyz", ozet: "test ozet" }] };
    const results = normalizeDanistaySearchResults(raw);
    expect(results).toHaveLength(1);
    expect(results[0].documentId).toBe("danistay:xyz");
    expect(results[0].summaryText).toBe("test ozet");
  });
});

describe("extractDanistayFullText", () => {
  it("strips HTML tags", () => {
    const html = "<html><body><p>Danıştay kararı</p></body></html>";
    const result = extractDanistayFullText(html);
    expect(result).toContain("Danıştay kararı");
    expect(result).not.toContain("<p>");
  });

  it("strips script and style blocks", () => {
    const html = "<script>var x=1;</script><style>div{}</style><p>Karar</p>";
    const result = extractDanistayFullText(html);
    expect(result).not.toContain("var x=1");
    expect(result).toContain("Karar");
  });

  it("decodes HTML entities", () => {
    const html = "<p>Hukuki &amp; İdari Karar</p>";
    const result = extractDanistayFullText(html);
    expect(result).toContain("Hukuki & İdari Karar");
  });
});

describe("buildDanistayDecision", () => {
  const sampleResult = {
    documentId: "danistay:98765",
    sourceId: "98765",
    title: "Test",
    date: "2022-06-10",
    chamber: "2. Daire",
    meritsNumber: "2021/9999",
    decisionNumber: "2022/1111",
    sourceUrl: "https://karararama.danistay.gov.tr/DanistayDetail.aspx?id=98765",
    documentUrl: "https://karararama.danistay.gov.tr/DownloadDanistayDoc?id=98765",
    summaryText: "Sağlık personelinin disiplin cezası"
  };

  it("builds decision with full text", () => {
    const fullText = "GEREKÇE: İdari hizmet kusuru değerlendirmesi. Sağlık personeli görevini ihmal etmiştir. SONUÇ: İptal talebinin kabulü.";
    const decision = buildDanistayDecision(sampleResult, fullText, "hizmet kusuru", "2024-01-01T00:00:00.000Z");
    expect(decision.id).toBe("danistay:98765");
    expect(decision.court).toBe("danistay");
    expect(decision.fullText).toBe(fullText);
    expect(decision.legalReasoning).toBeTruthy();
    expect(decision.evidence.official).toBe(true);
  });

  it("builds decision without full text", () => {
    const decision = buildDanistayDecision(sampleResult, null, "hizmet kusuru", "2024-01-01T00:00:00.000Z");
    expect(decision.fullText).toBeUndefined();
    expect(decision.legalReasoning).toBeUndefined();
    expect(decision.evidence.fullText).toBe(false);
  });
});

describe("classifyNonJsonResponse", () => {
  it("classifies empty string as empty_response", () => {
    expect(classifyNonJsonResponse("")).toBe("empty_response");
    expect(classifyNonJsonResponse("   ")).toBe("empty_response");
  });

  it("classifies captcha page", () => {
    expect(classifyNonJsonResponse("<html><body>Please solve the captcha</body></html>")).toBe("captcha_or_block");
    expect(classifyNonJsonResponse("<html><body>Access Denied - robot detected</body></html>")).toBe("captcha_or_block");
  });

  it("classifies small HTML login page as html_shell_response", () => {
    expect(classifyNonJsonResponse("<html><body><form><input name='password'/></form>Giriş Yapın</body></html>")).toBe("html_shell_response");
  });

  it("classifies small HTML shell", () => {
    const smallHtml = "<html><head><title>App</title></head><body><div id='root'></div></body></html>";
    expect(classifyNonJsonResponse(smallHtml)).toBe("html_shell_response");
  });

  it("classifies large HTML page as unexpected_html_response", () => {
    const largeHtml = "<html><body>" + "x".repeat(9000) + "</body></html>";
    expect(classifyNonJsonResponse(largeHtml)).toBe("unexpected_html_response");
  });
});

describe("eligibility pipeline with synthetic Danıştay fixture", () => {
  it("decisions with no full text are not precedent_usable", () => {
    const result = {
      documentId: "danistay:1",
      sourceId: "1",
      sourceUrl: "https://karararama.danistay.gov.tr/DanistayDetail.aspx?id=1",
      summaryText: ""
    };
    const decision = buildDanistayDecision(result, null, "hizmet kusuru", "2024-01-01T00:00:00.000Z");
    const { status } = assessDecisionEligibility(decision);
    expect(status).not.toBe("precedent_usable");
  });
});
