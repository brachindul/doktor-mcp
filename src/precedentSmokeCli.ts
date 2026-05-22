import { LiveYargitayAdapter } from "./sources/yargitay/liveYargitayAdapter.js";
import { LiveDanistayAdapter } from "./sources/danistay/liveDanistayAdapter.js";
import { PrecedentCache } from "./sources/precedentCache.js";
import type { PrecedentSource } from "./contracts/legal.js";

const args = process.argv.slice(2);
const separator = args.indexOf("--");
const questionParts = separator === -1 ? args.filter((a) => !a.startsWith("--")) : args.slice(0, separator);
const optionParts = separator === -1 ? args.filter((a) => a.startsWith("--")) : args.slice(separator + 1);

const noCache = optionParts.includes("--no-cache");
const refresh = optionParts.includes("--refresh");

const sourceModeIndex = optionParts.indexOf("--sourceMode");
const sourceMode = sourceModeIndex === -1 ? "live" : optionParts[sourceModeIndex + 1];

const precedentSourcesIndex = optionParts.indexOf("--precedentSources");
const precedentSources: PrecedentSource[] =
  precedentSourcesIndex !== -1 && optionParts[precedentSourcesIndex + 1]
    ? (optionParts[precedentSourcesIndex + 1].split(",") as PrecedentSource[])
    : ["yargitay", "danistay", "bedesten" as PrecedentSource];

const query = questionParts.join(" ") || "aydınlatılmış rıza";
const cache = noCache ? PrecedentCache.disabled() : new PrecedentCache();

const PAGE_SIZE = 5;
const results: Record<string, unknown> = {};

for (const source of precedentSources) {
  if (source === "yargitay") {
    const cacheKey = refresh ? null : await cache.get("yargitay", query, PAGE_SIZE);
    if (cacheKey) {
      results.yargitay = { fromCache: true, result: cacheKey };
    } else {
      const adapter = new LiveYargitayAdapter();
      const result = await adapter.searchAndNormalize(query);
      if (!noCache && !refresh) await cache.set("yargitay", query, PAGE_SIZE, result);
      results.yargitay = result;
    }
  } else if (source === "danistay") {
    const cacheKey = refresh ? null : await cache.get("danistay", query, PAGE_SIZE);
    if (cacheKey) {
      results.danistay = { fromCache: true, result: cacheKey };
    } else {
      const adapter = new LiveDanistayAdapter();
      const result = await adapter.searchAndNormalize(query);
      if (!noCache && !refresh) await cache.set("danistay", query, PAGE_SIZE, result);
      results.danistay = result;
    }
  } else if (source === "bedesten") {
    const cacheKey = refresh ? null : await cache.get("bedesten", query, PAGE_SIZE);
    if (cacheKey) {
      results.bedesten = { fromCache: true, result: cacheKey };
    } else {
      const { LiveBedestenAdapter } = await import("./sources/bedesten/liveBedestenAdapter.js");
      const adapter = new LiveBedestenAdapter();
      const result = await adapter.searchAndNormalize(query);
      if (!noCache && !refresh) await cache.set("bedesten", query, PAGE_SIZE, result);
      results.bedesten = result;
    }
  }
}

console.log(JSON.stringify({
  tool: "search_health_precedents",
  input: { query, sourceMode, precedentSources, noCache, refresh },
  results
}, null, 2));
