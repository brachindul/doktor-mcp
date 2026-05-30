import { describe, it, expect } from "vitest";
import { stripHtmlToText, truncateForDisplay } from "../src/util/textSanitizer.js";

describe("stripHtmlToText", () => {
  it("should strip HTML tags", () => {
    const result = stripHtmlToText("<p>Hello <b>World</b></p>");
    expect(result).toBe("Hello World");
  });

  it("should decode &#39; entities", () => {
    const result = stripHtmlToText("It&#39;s a test");
    expect(result).toBe("It's a test");
  });

  it("should decode &#039; entities", () => {
    const result = stripHtmlToText("It&#039;s a test");
    expect(result).toBe("It's a test");
  });

  it("should decode &amp; entities", () => {
    const result = stripHtmlToText("A &amp; B");
    expect(result).toBe("A & B");
  });

  it("should decode &lt; and &gt; then strip resulting tags", () => {
    const result = stripHtmlToText("&lt;tag&gt;");
    // After decoding, "<tag>" is formed and stripped as an HTML tag
    expect(result).not.toContain("&lt;");
    expect(result).not.toContain("&gt;");
    expect(result).not.toContain("<");
  });

  it("should decode &nbsp;", () => {
    const result = stripHtmlToText("hello&nbsp;world");
    expect(result).toBe("hello world");
  });

  it("should handle real-world HTML from court decisions", () => {
    const raw = `<font size="2"></p></font><br>Karar: Davacının talebinin kabulüne.<br>`;
    const result = stripHtmlToText(raw);
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
    expect(result).toContain("Karar:");
    expect(result).toContain("kabulüne");
  });

  it("should handle multiple HTML entities", () => {
    const raw = `Davalı&#39;nın &#039;itirazı&#039; reddedilmiştir.`;
    const result = stripHtmlToText(raw);
    expect(result).toBe("Davalı'nın 'itirazı' reddedilmiştir.");
  });

  it("should collapse whitespace", () => {
    const result = stripHtmlToText("  hello   \n\n  world  ");
    expect(result).toBe("hello world");
  });

  it("should handle empty string", () => {
    expect(stripHtmlToText("")).toBe("");
  });

  it("should handle whitespace-only string", () => {
    expect(stripHtmlToText("   ")).toBe("");
  });

  it("should not alter plain text", () => {
    const plain = "Mahkeme davayı kabul etmiştir.";
    expect(stripHtmlToText(plain)).toBe(plain);
  });
});

describe("truncateForDisplay", () => {
  it("should not truncate short text", () => {
    const text = "Short text";
    expect(truncateForDisplay(text, 200)).toBe(text);
  });

  it("should truncate long text and add ellipsis", () => {
    const text = "A".repeat(250);
    const result = truncateForDisplay(text, 200);
    expect(result.length).toBeLessThanOrEqual(203); // allow for ellipsis
  });

  it("should break at sentence boundary", () => {
    const text = "First sentence that is moderately long enough. Second sentence that continues.";
    const result = truncateForDisplay(text, 50);
    expect(result).toContain("First sentence");
    expect(result).not.toContain("Second");
    expect(result.length).toBeLessThanOrEqual(55);
  });
});
