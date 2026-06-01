/**
 * T27.1 — Recorded-fixture Replay Harness
 *
 * Loads sanitized axis fixture files and replays them without network access.
 * Used for deterministic e2e regression testing.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

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
