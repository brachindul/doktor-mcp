import type { ClassifiedMedicalLegalQuestion } from "../../contracts/legal.js";
import type { LegislationSourceAdapter } from "../types.js";
import { mockLegislationProvisions } from "../mockData.js";

const ethicsPriorityMap: Record<string, number> = {
  "Tibbi Deontoloji Nizamnamesi": 10,
  "Tababet ve Suabati Sanatlarinin Tarzi Icrasina Dair Kanun": 20,
  "Hasta Haklari Yonetmeligi": 40,
  "Kisisel Verilerin Korunmasi Kanunu": 90
};

const standardPriorityMap: Record<string, number> = {
  "Hasta Haklari Yonetmeligi": 10,
  "Kisisel Verilerin Korunmasi Kanunu": 20,
  "Tibbi Deontoloji Nizamnamesi": 40,
  "Tababet ve Suabati Sanatlarinin Tarzi Icrasina Dair Kanun": 50
};

export class MockLegislationAdapter implements LegislationSourceAdapter {
  async searchHealthLegislation(classification: ClassifiedMedicalLegalQuestion) {
    const filtered = mockLegislationProvisions.filter((provision) =>
      provision.dimensions.some((dimension) => classification.dimensions.includes(dimension))
    );

    const hasEthics = classification.dimensions.includes("professional_ethics");
    const priorityMap = hasEthics ? ethicsPriorityMap : standardPriorityMap;

    return filtered.sort((left, right) => {
      const leftPriority = priorityMap[left.legislationName] ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = priorityMap[right.legislationName] ?? Number.MAX_SAFE_INTEGER;
      return leftPriority - rightPriority;
    });
  }

  async getLegislationProvisions(documentIds: string[]) {
    return mockLegislationProvisions.filter((provision) => documentIds.includes(provision.documentId));
  }
}
