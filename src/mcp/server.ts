#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerMedicalLegalTools } from "./tools.js";
import { VERSION } from "../core/version.js";
import { buildInventoryReport } from "../healthLegislationInventory.js";
import { isAllowedUrl } from "../health/linkHealthChecker.js";

// ─── E6.1: Cached source health check ──────────────────────────────────────

interface HealthCacheEntry {
  report: Record<string, unknown>;
  checkedAt: number;
}

let healthCache: HealthCacheEntry | null = null;
const HEALTH_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const PROBE_ENDPOINTS: Record<string, { url: string; desc: string }> = {
  yargitay: { url: "https://karararama.yargitay.gov.tr/", desc: "Yargitay Karar Arama" },
  danistay: { url: "https://karararama.danistay.gov.tr/", desc: "Danistay Karar Arama" },
  legislation: { url: "https://www.mevzuat.gov.tr/", desc: "Mevzuat Bilgi Sistemi" },
};

async function probeEndpoint(url: string, timeoutMs: number): Promise<{ reachable: boolean; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    if (!isAllowedUrl(url)) return { reachable: false, error: "URL not in allowlist" };
    const response = await fetch(url, { method: "HEAD", signal: controller.signal });
    return { reachable: response.ok };
  } catch (err) {
    return { reachable: false, error: String(err) };
  } finally {
    clearTimeout(timer);
  }
}

async function buildCalibrationReport(): Promise<Record<string, unknown>> {
  if (healthCache && Date.now() - healthCache.checkedAt < HEALTH_CACHE_TTL_MS) {
    return {
      ...healthCache.report,
      checkMethod: "cached-probe",
      cacheAgeMs: Date.now() - healthCache.checkedAt
    };
  }

  const probes = Object.entries(PROBE_ENDPOINTS).map(async ([key, { url }]) => {
    const result = await probeEndpoint(url, 5000);
    return [key, result] as const;
  });

  const results = await Promise.allSettled(probes);
  const sources: Record<string, unknown> = {};

  for (const result of results) {
    if (result.status === "fulfilled") {
      const [key, probe] = result.value;
      sources[key] = probe.reachable ? "reachable_json" : { status: "unreachable", error: probe.error };
    } else {
      // If the probe itself failed (unlikely), mark as unknown
    }
  }
  // Fill in keys that might not have run
  for (const key of Object.keys(PROBE_ENDPOINTS)) {
    if (!(key in sources)) sources[key] = { status: "unknown", error: "probe not started" };
  }

  // AYM is always synthetic
  sources.aym = {
    status: "synthetic_only",
    checkMethod: "static-architecture-note",
    reason: "AYM kararlar bilgi bankası (kararlarbilgibankasi.anayasa.gov.tr) HTML tabanlı arayüzdür, JSON API sunmaz. Canlı arama mümkün değildir.",
    fallback: "Sentetik (boş) — uydurma karar döndürülmez",
    supportsSearch: false,
    supportsFullText: false
  };

  const report = {
    sources,
    lastChecked: new Date().toISOString(),
    checkMethod: "live-probe"
  };

  healthCache = { report, checkedAt: Date.now() };
  return report;
}

const server = new McpServer({
  name: "doktor-mcp",
  version: VERSION
});

registerMedicalLegalTools(server);

// ── Read-only MCP resources ────────────────────────────────────────────────

server.registerResource(
  "health-legislation-inventory",
  "health-legislation://inventory",
  {
    description: "Anayasal sağlık mevzuatı envanteri — health legislation inventory with access status, last verified dates, and official gazette issue details.",
    mimeType: "application/json",
  },
  async () => ({
    contents: [{
      uri: "health-legislation://inventory",
      mimeType: "application/json",
      text: JSON.stringify(buildInventoryReport(), null, 2),
    }],
  })
);

server.registerResource(
  "source-calibration-status",
  "doktor://calibration-status",
  {
    description: "Kaynak kalibrasyon statüsü — canlı kaynakların erişilebilirlik durumu (önbellekli, 10 dk TTL).",
    mimeType: "application/json",
  },
  async () => ({
    contents: [{
      uri: "doktor://calibration-status",
      mimeType: "application/json",
      text: JSON.stringify(await buildCalibrationReport(), null, 2),
    }],
  })
);

// ── Prompt templates ───────────────────────────────────────────────────────

server.registerPrompt(
  "hekim-hukuki-soru",
  {
    description: "Hekimler için yapılandırılmış hukuki soru formatı şablonu. Bu şablonu kullanarak sorunuzu daha iyi yapılandırabilirsiniz.",
  },
  async () => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Lütfen hekim olarak aşağıdaki formatta hukuki sorunuzu yazın:

1. Tıbbi Durum: [Kısaca tıbbi bağlamı açıklayın]
2. Hukuki Soru: [Spesifik hukuki sorunuzu yazın]
3. İlgili Mevzuat Alanı (biliniyorsa): [Örn: hasta hakları, malpraktis, aydınlatılmış onam]
4. Aciliyet: [Acil / Rutin]

Örnek: "Tıbbi Durum: Acil serviste hasta tedaviyi reddediyor. Hukuki Soru: Hekim olarak hukuki sorumluluğum nedir? İlgili Mevzuat: Hasta hakları, tıbbi müdahalenin hukuka uygunluğu. Aciliyet: Acil"`,
      },
    }],
  })
);

try {
  await server.connect(new StdioServerTransport());
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
