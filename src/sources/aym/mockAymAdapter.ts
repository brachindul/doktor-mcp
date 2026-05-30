import type { ClassifiedMedicalLegalQuestion, CourtDecision } from "../../contracts/legal.js";
import type { PrecedentSourceAdapter } from "../types.js";

/**
 * Mock AYM adapter — AYM API is HTML-only, no JSON search available.
 * Returns empty results with explicit synthetic_only marker.
 * NEVER returns fabricated decisions.
 */
export class MockAymAdapter implements PrecedentSourceAdapter {
  readonly sourceId = "aym";
  readonly calibrationStatus = "synthetic_only";
  readonly calibrationReason =
    "AYM kararlar bilgi bankası (kararlarbilgibankasi.anayasa.gov.tr) HTML tabanlı bir arayüzdür. " +
    "Herhangi bir JSON API sunmamaktadır. Canlı arama şu an mümkün değildir. " +
    "Sentetik (boş) sonuç döndürülüyor — uydurma karar yok.";

  async searchHealthPrecedents(
    _classification: ClassifiedMedicalLegalQuestion
  ): Promise<CourtDecision[]> {
    // AYM cannot be searched via JSON API — return empty, never fabricate
    return [];
  }
}
