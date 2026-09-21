import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import { writeFile, mkdir, rm, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const TEMP_DIR = join(process.cwd(), "temp-test-fixtures");
const RAW_PATH = join(TEMP_DIR, "danistay-raw.json");

describe("Ingest Fixture CLI", () => {
  beforeAll(async () => {
    await mkdir(TEMP_DIR, { recursive: true });
    // Write a mock raw fixture
    const mockRaw = {
      data: [
        {
          ID: "12345",
          OZET: "This is a summary of the decision containing PII like a party's name.",
          KARAR_TARIHI: "2026-05-22",
          DAIRESI: "15. Daire",
          ESAS_YILI: "2025",
          ESAS_SIRASI: "100",
          KARAR_YILI: "2026",
          KARAR_SIRASI: "200"
        }
      ]
    };
    await writeFile(RAW_PATH, JSON.stringify(mockRaw), "utf-8");
  });

  afterAll(async () => {
    await rm(TEMP_DIR, { recursive: true, force: true });
    // Note: this test writes to fixtures/live-samples. Let's verify and then remove the created file.
  });

  it("should fail gracefully if raw file does not exist", () => {
    try {
      execSync(`npx tsx src/ingestFixtureCli.ts --source danistay --raw ${join(TEMP_DIR, "non-existent.json")} --query test`, { encoding: "utf-8", stdio: "pipe" });
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      const output = (error.stdout ?? "") + (error.stderr ?? "");
      expect(output).toContain("Failed to read raw fixture");
      expect(error.status).toBe(1);
    }
  });

  it("should ingest and sanitize the raw fixture", async () => {
    const output = execSync(`npx tsx src/ingestFixtureCli.ts --source danistay --raw ${RAW_PATH} --query "test query"`, { encoding: "utf-8" });
    expect(output).toContain("Successfully ingested and sanitized fixture");

    // Read the latest captured file from fixtures/live-samples
    const liveSamplesDir = join(process.cwd(), "fixtures/live-samples");
    const { readdirSync } = await import("fs");
    const files = readdirSync(liveSamplesDir).filter(f => f.startsWith("danistay-captured-"));
    expect(files.length).toBeGreaterThan(0);
    
    // Sort by modification time to get the latest
    files.sort();
    const latestFile = files[files.length - 1];
    const content = await readFile(join(liveSamplesDir, latestFile), "utf-8");
    const json = JSON.parse(content);
    
    expect(json.calibrationStatus).toBe("fixture_verified");
    expect(json.responseShape.hasDataField).toBe(true);
    expect(json.normalizedResultPreview[0].sourceId).toBe("REDACTED");
    expect(json.normalizedResultPreview[0].title).toBe("REDACTED SUMMARY / TITLE");
    expect(json.normalizedResultPreview[0].summaryText).toBe("REDACTED SUMMARY");
    
    // Cleanup generated file
    await rm(join(liveSamplesDir, latestFile));
  });
});
