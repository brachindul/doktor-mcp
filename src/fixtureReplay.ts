/**
 * T27.1 — Recorded-fixture Replay Harness
 *
 * Loads sanitized axis fixture files and replays them without network access.
 * Used for deterministic e2e regression testing.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { LegislationDocCache } from "./sources/legislationDocCache.js";

export interface AxisFixtureProvision {
  legislationName: string;
  articleNumber: string;
  verbatimQuote: string;
  connection: string;
  sourceDocumentId: string;
  articleStatus?: string;
}

export interface AxisFixture {
  axis: string;
  description: string;
  question: string;
  expectedPrimaryLegislation: string[];
  provisions: AxisFixtureProvision[];
  precedents: unknown[];
  legalClassification: Record<string, string>;
  sanitization_note: string;
}

const FIXTURE_DIR = join(process.cwd(), "tests", "fixtures", "axes");

export const AXIS_FIXTURE_NAMES: Record<string, string> = {
  disiplin: "disiplin.json",
  malpraktis: "malpraktis.json",
  tayin: "tayin.json",
  gizlilik: "gizlilik.json",
  "riza_onam": "riza-onam.json",
  acil_mudahale: "acil-mudahale.json",
  ek_odeme: "ek-odeme.json",
  mecburi_hizmet: "mecburi-hizmet.json"
};

export function loadAxisFixture(axis: string): AxisFixture {
  const fileName = AXIS_FIXTURE_NAMES[axis];
  if (!fileName) throw new Error(`Unknown axis: ${axis}`);
  const path = join(FIXTURE_DIR, fileName);
  if (!existsSync(path)) throw new Error(`Fixture not found: ${path}`);
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as AxisFixture;
}

export function loadAllAxisFixtures(): AxisFixture[] {
  return Object.keys(AXIS_FIXTURE_NAMES).map((axis) => loadAxisFixture(axis));
}

/**
 * Verifies that a fixture contains the required minimal structure.
 */
export function validateFixture(fixture: AxisFixture): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!fixture.axis) errors.push("Missing axis");
  if (!fixture.question) errors.push("Missing question");
  if (!fixture.expectedPrimaryLegislation?.length) errors.push("Missing expectedPrimaryLegislation");
  if (!fixture.provisions?.length) errors.push("Missing provisions");
  if (!fixture.provisions?.every((p) => p.legislationName && p.articleNumber && p.verbatimQuote)) {
    errors.push("Provision missing required fields");
  }
  if (!fixture.sanitization_note) errors.push("Missing sanitization_note");
  return { valid: errors.length === 0, errors };
}

/**
 * T36.1 — Build a `LegislationDocCache` pre-populated with fixture text.
 * When injected into LiveOfficialLegislationAdapter, getDocument retrieves
 * directly from cache, bypassing PDF fetch/parse entirely.
 */
export function buildReplayCache(fixture: AxisFixture): LegislationDocCache {
  const cache = new LegislationDocCache({ enabled: true });

  // For each provision, cache its text under the provision's sourceDocumentId
  // This simulates what would happen after a successful live fetch
  const fullText = fixture.provisions.map((p) =>
    `MADDE ${p.articleNumber} –\n${p.verbatimQuote}`
  ).join("\n\n");

  // Use the first provision's sourceDocumentId as the cache key
  // The adapter's getDocument uses result.sourceId which is the mevzuat sourceId
  // We pre-populate for all sourceIds in the fixture
  for (const provision of fixture.provisions) {
    cache.set(provision.sourceDocumentId, fullText);
  }

  return cache;
}

/**
 * T36.1 — Build a fake `fetchImpl` that replays fixture data through the
 * live adapter pipeline without network access.
 *
 * Prefer `buildReplayCache` for cleaner injection. This function exists
 * as fallback for direct fetch injection.
 */
export function buildReplayFetch(fixture: AxisFixture): typeof fetch {
  const cache = buildReplayCache(fixture);

  return async (input: string | URL | Request, _init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : (input instanceof URL ? input.href : (input as Request).url);
    if (url && url.includes("mevzuat.gov.tr")) {
      // Return a minimal valid PDF — cache-first in adapter handles this
      const pdf = new TextEncoder().encode("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>>endobj\n4 0 obj<</Length 26>>stream\nBT /F1 12 Tf 72 720 Td (.) Tj ET\nendstream endobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000271 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n368\n%%EOF");
      return new Response(pdf, {
        status: 200,
        headers: new Headers({ "content-type": "application/pdf" })
      });
    }
    return new Response("Not mocked", { status: 404 });
  };
}
