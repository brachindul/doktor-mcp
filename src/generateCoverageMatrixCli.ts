#!/usr/bin/env node
import { buildInventoryReport } from "./healthLegislationInventory.js";
const r = buildInventoryReport();
console.log("| Legislation | Type | Status | SourceId |");
console.log("|---|---|---|---|");
for (const e of r.verifiedEntries) {
  console.log(`| ${e.title} | ${e.legislationType || "?"} | ${e.officialSourceStatus} | ${e.mevzuatSourceId || "N/A"} |`);
}
