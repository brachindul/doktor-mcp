#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerMedicalLegalTools } from "./tools.js";
import { VERSION } from "../core/version.js";
import { buildInventoryReport } from "../healthLegislationInventory.js";

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
    description: "Kaynak kalibrasyon statüsü — hangi canlı kaynakların erişilebilir olduğu bilgisi.",
    mimeType: "application/json",
  },
  async () => ({
    contents: [{
      uri: "doktor://calibration-status",
      mimeType: "application/json",
      text: JSON.stringify({
        sources: {
          yargitay: "reachable_json",
          danistay: "reachable_json",
          aym: {
            status: "synthetic_only",
            reason: "AYM kararlar bilgi bankası (kararlarbilgibankasi.anayasa.gov.tr) HTML tabanlı arayüzdür, JSON API sunmaz. Canlı arama mümkün değildir.",
            fallback: "Sentetik (boş) — uydurma karar döndürülmez",
            supportsSearch: false,
            supportsFullText: false
          },
          legislation: "reachable_json",
        },
        lastChecked: new Date().toISOString(),
      }, null, 2),
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
