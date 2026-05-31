#!/usr/bin/env node
import { readConfig } from "./core/runtimeConfig.js";

async function checkSource(name: string, url: string): Promise<{ name: string; url: string; reachable: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10000) });
    return { name, url, reachable: res.ok, latencyMs: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e: any) {
    return { name, url, reachable: false, latencyMs: Date.now() - start, error: e?.message ?? String(e) };
  }
}

async function main() {
  console.log("doktor-mcp source health check");
  console.log("=".repeat(40));
  
  const sources = [
    { name: "mevzuat.gov.tr", url: "https://www.mevzuat.gov.tr/" },
    { name: "bedesten", url: "https://bedesten.adalet.gov.tr/" },
    { name: "danistay", url: "https://karararama.danistay.gov.tr/" },
    { name: "aym", url: "https://kararlarbilgibankasi.anayasa.gov.tr/" },
  ];
  
  const results = await Promise.all(sources.map(s => checkSource(s.name, s.url)));
  
  for (const r of results) {
    const status = r.reachable ? "✅ reachable" : "❌ unreachable";
    console.log(`${status} ${r.name} (${r.latencyMs}ms)${r.error ? ` — ${r.error}` : ""}`);
  }
}

main().catch(console.error);
