/**
 * Pack audit CLI
 * Usage: npm run audit:pack -- <path-to-pack.json>
 */

import { readFile } from "fs/promises";
import { auditPack } from "./packAudit.js";

const args = process.argv.slice(2);
const filePath = args.find((a) => !a.startsWith("--"));

if (!filePath) {
  console.error(JSON.stringify({ error: "Usage: npm run audit:pack -- <pack-json-file>" }));
  process.exit(1);
}

let raw: string;
try {
  raw = await readFile(filePath, "utf-8");
} catch (err) {
  console.error(JSON.stringify({ error: `Could not read file: ${filePath}`, detail: String(err) }));
  process.exit(1);
}

let pack: unknown;
try {
  pack = JSON.parse(raw);
} catch (err) {
  console.error(JSON.stringify({ error: "File is not valid JSON.", detail: String(err) }));
  process.exit(1);
}

const result = auditPack(pack);

console.log(JSON.stringify({
  tool: "audit_pack",
  file: filePath,
  result
}, null, 2));

if (!result.ok) {
  process.exit(1);
}
