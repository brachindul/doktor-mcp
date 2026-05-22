import type { ClassifiedMedicalLegalQuestion } from "../contracts/legal.js";

interface HealthLawQuery {
  searchTerm: string;
  topicCluster: string;
  priority: number;
}

const QUERY_EXPANSION: Record<string, HealthLawQuery> = {
  riza:          { searchTerm: "aydınlatılmış rıza",           topicCluster: "informed_consent",        priority: 1 },
  "rıza":        { searchTerm: "aydınlatılmış rıza",           topicCluster: "informed_consent",        priority: 1 },
  onam:          { searchTerm: "aydınlatılmış onam",           topicCluster: "informed_consent",        priority: 1 },
  aydinlat:      { searchTerm: "aydınlatılmış rıza",           topicCluster: "informed_consent",        priority: 1 },
  "aydınlat":    { searchTerm: "aydınlatılmış rıza",           topicCluster: "informed_consent",        priority: 1 },
  komplikasyon:  { searchTerm: "komplikasyon tıbbi müdahale",  topicCluster: "medical_intervention",    priority: 2 },
  malpraktis:    { searchTerm: "malpraktis hekim kusur",        topicCluster: "medical_intervention",    priority: 2 },
  tibbi:         { searchTerm: "tıbbi müdahale",               topicCluster: "medical_intervention",    priority: 3 },
  "tıbbi":       { searchTerm: "tıbbi müdahale",               topicCluster: "medical_intervention",    priority: 3 },
  mudahale:      { searchTerm: "tıbbi müdahale",               topicCluster: "medical_intervention",    priority: 3 },
  "müdahale":    { searchTerm: "tıbbi müdahale",               topicCluster: "medical_intervention",    priority: 3 },
  hekim:         { searchTerm: "hekimin özen yükümlülüğü",     topicCluster: "physician_duty_of_care",  priority: 4 },
  hasta:         { searchTerm: "hasta hakları",                topicCluster: "patient_rights",          priority: 5 },
  veri:          { searchTerm: "sağlık verisi mahremiyet",     topicCluster: "personal_health_data",   priority: 6 },
  mahrem:        { searchTerm: "sağlık verisi mahremiyet",     topicCluster: "personal_health_data",   priority: 6 },
  kusur:         { searchTerm: "hizmet kusuru tıbbi müdahale", topicCluster: "physician_duty_of_care",  priority: 7 },
  acil:          { searchTerm: "acil müdahale hekim yükümlülüğü", topicCluster: "emergency_intervention", priority: 8 },
};

export function pickHealthLawQuery(classification: ClassifiedMedicalLegalQuestion): string {
  let best: HealthLawQuery | null = null;
  for (const term of classification.searchTerms) {
    const mapped = QUERY_EXPANSION[term];
    if (mapped && (!best || mapped.priority < best.priority)) best = mapped;
  }
  return best?.searchTerm ?? classification.question;
}

export function pickHealthLawQueries(classification: ClassifiedMedicalLegalQuestion, maxQueries = 2): string[] {
  const seen = new Set<string>();
  const queries: HealthLawQuery[] = [];
  for (const term of classification.searchTerms) {
    const mapped = QUERY_EXPANSION[term];
    if (mapped && !seen.has(mapped.searchTerm)) {
      seen.add(mapped.searchTerm);
      queries.push(mapped);
    }
  }
  queries.sort((a, b) => a.priority - b.priority);
  const result = queries.slice(0, maxQueries).map((q) => q.searchTerm);
  return result.length > 0 ? result : [classification.question];
}
