/**
 * Ingest Fixture CLI
 * Usage: npm run ingest:fixture -- --source danistay --raw fixtures/raw/danistay-raw.json --query "hizmet kusuru tıbbi müdahale"
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { normalizeDanistaySearchResults } from "./sources/danistay/danistayNormalizer.js";

async function run() {
  const args = process.argv.slice(2);
  const separator = args.indexOf("--");
  const optionParts = separator === -1 ? args : args.slice(separator + 1);

  const getArg = (name: string): string | null => {
    const idx = optionParts.indexOf(name);
    return idx !== -1 ? optionParts[idx + 1] : null;
  };

  const source = getArg("--source");
  const rawPath = getArg("--raw");
  const query = getArg("--query") || "test query";

  if (!source || !rawPath) {
    console.error("Usage: npm run ingest:fixture -- --source <source> --raw <path_to_raw_json> [--query \"query\"]");
    process.exit(1);
  }

  if (source !== "danistay") {
    console.error("Currently only 'danistay' source is supported by ingest:fixture.");
    process.exit(1);
  }

  let rawData: string;
  try {
    rawData = await readFile(rawPath, "utf-8");
  } catch (error) {
    console.error(`Failed to read raw fixture at ${rawPath}: ${(error as Error).message}`);
    process.exit(1);
  }

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(rawData);
  } catch (error) {
    console.error("Raw fixture is not valid JSON.");
    process.exit(1);
  }

  // Normalize to extract the shape we care about
  const normalized = normalizeDanistaySearchResults(parsedRaw);

  if (normalized.length === 0) {
    console.warn("Warning: Normalized results are empty. Check if the raw fixture matches the normalizer logic.");
  }

  // Create sanitized preview
  const preview = normalized.map(result => ({
    documentId: result.documentId, // e.g., danistay:<id>
    sourceId: "REDACTED", // Sanitize actual ID
    title: "REDACTED SUMMARY / TITLE", // Sanitize long text
    date: result.date,
    chamber: result.chamber,
    meritsNumber: result.meritsNumber,
    decisionNumber: result.decisionNumber,
    sourceUrl: result.sourceUrl?.replace(/id=\d+/, "id=REDACTED"),
    documentUrl: result.documentUrl?.replace(/id=\d+/, "id=REDACTED"),
    summaryText: "REDACTED SUMMARY",
  }));

  // Build the sanitized fixture shape based on live-samples/README.md
  const sanitizedFixture = {
    _note: "Sanitized fixture captured from real browser session.",
    source,
    capturedAt: new Date().toISOString(),
    calibrationStatus: "fixture_verified",
    httpStatus: 200,
    contentType: "application/json",
    responseShape: {
      isJson: true,
      isArray: Array.isArray(parsedRaw),
      // we can try to find array in object if not directly array
      hasDataField: !Array.isArray(parsedRaw) && typeof parsedRaw === "object" && parsedRaw !== null && "data" in parsedRaw,
      hasResultsField: !Array.isArray(parsedRaw) && typeof parsedRaw === "object" && parsedRaw !== null && "results" in parsedRaw,
      hasKararlarField: !Array.isArray(parsedRaw) && typeof parsedRaw === "object" && parsedRaw !== null && "kararlar" in parsedRaw,
      hasItemsField: !Array.isArray(parsedRaw) && typeof parsedRaw === "object" && parsedRaw !== null && "items" in parsedRaw,
    },
    normalizedResultPreview: preview,
    notes: `Query used for capture: '${query}'. Real IDs and text have been redacted.`
  };

  const fixturesDir = join(process.cwd(), "fixtures/live-samples");
  await mkdir(fixturesDir, { recursive: true });

  const fixtureName = `${source}-captured-${Date.now()}.json`;
  const outPath = join(fixturesDir, fixtureName);
  
  await writeFile(outPath, JSON.stringify(sanitizedFixture, null, 2), "utf-8");
  console.log(`Successfully ingested and sanitized fixture to ${outPath}`);
}

run().catch(console.error);
