import { describe, it, expect } from "vitest";
import {
  tokenizeTr,
  foldTr,
  matchesTermTr,
} from "../src/health/turkishTokenMatcher.js";
import type { TermRule } from "../src/health/turkishTokenMatcher.js";

// ── Helper: run a TermRule against text ──────────────────────────────────────

function runRule(text: string, rule: TermRule): boolean {
  if (rule.matchMode === "substring") {
    // For substring mode the full folded text is passed as the single element
    return matchesTermTr(
      [foldTr(text.toLocaleLowerCase("tr-TR"))],
      rule.term,
      rule.matchMode,
      rule.blockedPrefixes,
      rule.allowedTokens,
    );
  }
  const tokens = tokenizeTr(text).map(foldTr);
  return matchesTermTr(
    tokens,
    rule.term,
    rule.matchMode,
    rule.blockedPrefixes,
    rule.allowedTokens,
  );
}

// ── foldTr ───────────────────────────────────────────────────────────────────

describe("foldTr", () => {
  it("folds Turkish lowercase characters", () => {
    expect(foldTr("ışık")).toBe("isik");
    expect(foldTr("çöğüşü")).toBe("cogusu");
    expect(foldTr("şölen")).toBe("solen");
    expect(foldTr("ğüş")).toBe("gus");
  });

  it("folds Turkish uppercase characters", () => {
    expect(foldTr("İSTANBUL")).toBe("istanbul");
    expect(foldTr("IŞIK")).toBe("isik");
    expect(foldTr("ÇÖĞÜŞ")).toBe("cogus");
    expect(foldTr("ŞÖLEN")).toBe("solen");
  });

  it("normalises İ/I to lowercase i", () => {
    expect(foldTr("İ")).toBe("i");
    expect(foldTr("I")).toBe("i");
  });

  it("leaves ASCII unchanged", () => {
    expect(foldTr("hello")).toBe("hello");
    expect(foldTr("123")).toBe("123");
  });

  it("is case-insensitive for riza/rıza/RIZA", () => {
    const a = foldTr("rıza");
    const b = foldTr("riza");
    const c = foldTr("RIZA");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});

// ── tokenizeTr ───────────────────────────────────────────────────────────────

describe("tokenizeTr", () => {
  it("splits by non-letter characters", () => {
    expect(tokenizeTr("Hasta, tedaviyi reddederse!")).toEqual([
      "hasta",
      "tedaviyi",
      "reddederse",
    ]);
  });

  it("handles multiple separators", () => {
    expect(tokenizeTr("bir--iki...üç;")).toEqual(["bir", "iki", "üç"]);
  });

  it("returns empty array for empty/whitespace", () => {
    expect(tokenizeTr("")).toEqual([]);
    expect(tokenizeTr("   ")).toEqual([]);
  });

  it("lowercases with Turkish locale", () => {
    expect(tokenizeTr("İSTANBUL")).toEqual(["istanbul"]);
  });
});

// ── matchesTermTr — token mode ──────────────────────────────────────────────

describe("matchesTermTr — token mode", () => {
  const VERI_RULE: TermRule = {
    term: "veri",
    matchMode: "token",
    blockedPrefixes: ["veril"],
    allowedTokens: ["veriler", "verileri", "verilerin", "verisi", "verisini"],
  };

  it('"verilen" does NOT match "veri" (critical regression)', () => {
    expect(runRule("hastaya ilaç verildi", VERI_RULE)).toBe(false);
  });

  it('"verildi" does NOT match "veri"', () => {
    expect(runRule("hastaya ilaç verildi", VERI_RULE)).toBe(false);
  });

  it('"verilen" does NOT match "veri" (isolated token)', () => {
    expect(runRule("hasta verilen bilgiler", VERI_RULE)).toBe(false);
  });

  it('"verisi" matches "veri" (allowedTokens)', () => {
    expect(runRule("hastanın verisi", VERI_RULE)).toBe(true);
  });

  it('"verileri" matches "veri" (allowedTokens)', () => {
    expect(runRule("hasta verileri kimlerle paylaşılabilir", VERI_RULE)).toBe(true);
  });

  it('"veriler" matches "veri" (allowedTokens)', () => {
    expect(runRule("veriler gizlidir", VERI_RULE)).toBe(true);
  });

  it('"verilerin" matches "veri" (allowedTokens)', () => {
    expect(runRule("verilerin korunması", VERI_RULE)).toBe(true);
  });

  it('"verisini" matches "veri" (allowedTokens)', () => {
    expect(runRule("hasta verisini paylaştı", VERI_RULE)).toBe(true);
  });

  it('"veri" exact match works', () => {
    expect(runRule("kişisel sağlık verisi paylaşımı", VERI_RULE)).toBe(true);
  });

  it('"veri" with valid suffix matches', () => {
    // "verim" — suffix "m" is 1 char, starts with valid suffix consonant
    expect(matchesTermTr(["verim"], "veri", "token")).toBe(true);
  });

  it('"veri" with too-long suffix does NOT match', () => {
    // "verixxxxx" — suffix is 5 chars but not a valid continuation
    // Actually let's test: "veri" + "cles" = "vericles" — suffix "cles" starts with 'c' which is NOT in the set
    expect(matchesTermTr(["vericles"], "veri", "token")).toBe(false);
  });

  it("basic token match works", () => {
    expect(matchesTermTr(["hasta"], "hasta", "token")).toBe(true);
  });

  it("non-matching token returns false", () => {
    expect(matchesTermTr(["doktor"], "hasta", "token")).toBe(false);
  });
});

// ── matchesTermTr — prefix mode ─────────────────────────────────────────────

describe("matchesTermTr — prefix mode", () => {
  const AYDINLAT_RULE: TermRule = {
    term: "aydinlat",
    matchMode: "prefix",
  };

  it('"aydınlatılmış" matches "aydinlat" prefix', () => {
    expect(runRule("aydınlatılmış onam alınmadı", AYDINLAT_RULE)).toBe(true);
  });

  it('"aydınlatma" matches "aydinlat" prefix', () => {
    expect(matchesTermTr(["aydinlatma"], "aydinlat", "prefix")).toBe(true);
  });

  it('"aydınlat" exact match works', () => {
    expect(matchesTermTr(["aydinlat"], "aydinlat", "prefix")).toBe(true);
  });

  it("non-matching prefix returns false", () => {
    expect(matchesTermTr(["diger"], "aydinlat", "prefix")).toBe(false);
  });
});

// ── matchesTermTr — substring mode ──────────────────────────────────────────

describe("matchesTermTr — substring mode", () => {
  const MECBURI_RULE: TermRule = {
    term: "mecburi hizmet",
    matchMode: "substring",
  };

  it('"mecburi hizmet ataması" matches substring', () => {
    expect(runRule("mecburi hizmet ataması", MECBURI_RULE)).toBe(true);
  });

  it('"mecburi hizmet" exact match works', () => {
    expect(
      matchesTermTr(
        [foldTr("mecburi hizmet")],
        "mecburi hizmet",
        "substring",
      ),
    ).toBe(true);
  });

  it("non-matching substring returns false", () => {
    expect(
      matchesTermTr(
        [foldTr("mecburi degil")],
        "mecburi hizmet",
        "substring",
      ),
    ).toBe(false);
  });
});

// ── Integration: full TermRule objects ───────────────────────────────────────

describe("TermRule integration", () => {
  it("privacy_kvkk term: veri matches health data question", () => {
    const rule: TermRule = {
      term: "veri",
      matchMode: "token",
      blockedPrefixes: ["veril"],
      allowedTokens: ["veriler", "verileri", "verilerin", "verisi", "verisini"],
    };
    expect(runRule("kişisel sağlık verisi paylaşımı", rule)).toBe(true);
  });

  it("privacy_kvkk term: veri does NOT match medication given", () => {
    const rule: TermRule = {
      term: "veri",
      matchMode: "token",
      blockedPrefixes: ["veril"],
      allowedTokens: ["veriler", "verileri", "verilerin", "verisi", "verisini"],
    };
    expect(runRule("hastaya ilaç verildi", rule)).toBe(false);
  });

  it("privacy_kvkk term: veri matches plural form via allowedTokens", () => {
    const rule: TermRule = {
      term: "veri",
      matchMode: "token",
      blockedPrefixes: ["veril"],
      allowedTokens: ["veriler", "verileri", "verilerin", "verisi", "verisini"],
    };
    expect(runRule("hasta verileri kimlerle paylaşılabilir", rule)).toBe(true);
  });

  it("patient_rights: aydinlat prefix matches aydınlatılmış", () => {
    const rule: TermRule = {
      term: "aydinlat",
      matchMode: "prefix",
    };
    expect(runRule("aydınlatılmış onam alınmadı", rule)).toBe(true);
  });

  it("fold consistency: riza / rıza / RIZA all give same result", () => {
    const rule: TermRule = { term: "rıza", matchMode: "token" };
    const r1 = runRule("rıza verildi", rule);
    const r2 = runRule("riza verildi", rule);
    const r3 = runRule("RIZA verildi", rule);
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
  });

  it("disciplinary: mecburi hizmet substring match", () => {
    const rule: TermRule = {
      term: "mecburi hizmet",
      matchMode: "substring",
    };
    expect(runRule("mecburi hizmet ataması", rule)).toBe(true);
  });
});

// ── Edge cases ───────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("empty tokens array returns false for all modes", () => {
    expect(matchesTermTr([], "test", "token")).toBe(false);
    expect(matchesTermTr([], "test", "prefix")).toBe(false);
    expect(matchesTermTr([], "test", "substring")).toBe(false);
  });

  it("blockedPrefixes without allowedTokens still blocks", () => {
    const tokens = tokenizeTr("verilen bilgi").map(foldTr);
    const result = matchesTermTr(tokens, "veri", "token", ["veril"]);
    expect(result).toBe(false);
  });

  it("allowedTokens without blockedPrefixes still allows", () => {
    const tokens = tokenizeTr("verileri paylaştı").map(foldTr);
    const result = matchesTermTr(tokens, "veri", "token", undefined, [
      "verileri",
    ]);
    expect(result).toBe(true);
  });

  it("folded tokens are used for comparison", () => {
    const tokens = tokenizeTr("IŞIK ÇÖĞÜŞÜ").map(foldTr);
    expect(tokens).toEqual(["isik", "cogusu"]);
    expect(matchesTermTr(tokens, "ışık", "token")).toBe(true);
    expect(matchesTermTr(tokens, "cogus", "prefix")).toBe(true);
  });
});
