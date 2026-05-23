import type { ClassifiedMedicalLegalQuestion } from "../contracts/legal.js";
import { suggestedQueriesForQuestion } from "./precedentRelevance.js";

interface HealthLawQuery {
  searchTerm: string;
  topicCluster: string;
  priority: number;
}

const QUERY_EXPANSION: Record<string, HealthLawQuery> = {
  riza:          { searchTerm: "aydınlatılmış rıza",           topicCluster: "informed_consent",        priority: 2 },
  "rıza":        { searchTerm: "aydınlatılmış rıza",           topicCluster: "informed_consent",        priority: 2 },
  onam:          { searchTerm: "aydınlatılmış onam",           topicCluster: "informed_consent",        priority: 2 },
  aydinlat:      { searchTerm: "aydınlatılmış rıza",           topicCluster: "informed_consent",        priority: 2 },
  "aydınlat":    { searchTerm: "aydınlatılmış rıza",           topicCluster: "informed_consent",        priority: 2 },
  komplikasyon:  { searchTerm: "komplikasyon tıbbi müdahale",  topicCluster: "medical_intervention",    priority: 3 },
  malpraktis:    { searchTerm: "malpraktis hekim kusur",        topicCluster: "medical_intervention",    priority: 3 },
  tibbi:         { searchTerm: "tıbbi müdahale",               topicCluster: "medical_intervention",    priority: 4 },
  "tıbbi":       { searchTerm: "tıbbi müdahale",               topicCluster: "medical_intervention",    priority: 4 },
  mudahale:      { searchTerm: "tıbbi müdahale",               topicCluster: "medical_intervention",    priority: 4 },
  "müdahale":    { searchTerm: "tıbbi müdahale",               topicCluster: "medical_intervention",    priority: 4 },
  hekim:         { searchTerm: "hekimin özen yükümlülüğü",     topicCluster: "physician_duty_of_care",  priority: 5 },
  hasta:         { searchTerm: "hasta hakları",                topicCluster: "patient_rights",          priority: 6 },
  veri:          { searchTerm: "sağlık verisi mahremiyet",     topicCluster: "personal_health_data",   priority: 7 },
  mahrem:        { searchTerm: "sağlık verisi mahremiyet",     topicCluster: "personal_health_data",   priority: 7 },
  kusur:         { searchTerm: "hizmet kusuru tıbbi müdahale", topicCluster: "physician_duty_of_care",  priority: 8 },
  acil:          { searchTerm: "acil müdahale hekim yükümlülüğü", topicCluster: "emergency_intervention", priority: 9 },
  "redde":         { searchTerm: "hekimin hastayı reddetmesi",   topicCluster: "physician_refusal_or_withdrawal", priority: 1 },
  "reddet":        { searchTerm: "hekimin hastayı reddetmesi",   topicCluster: "physician_refusal_or_withdrawal", priority: 1 },
  "kabul etme":    { searchTerm: "hekimin hastayı reddetmesi",   topicCluster: "physician_refusal_or_withdrawal", priority: 1 },
  "iliskisini sonlandir": { searchTerm: "hasta-hekim ilişkisinin sonlandırılması", topicCluster: "physician_patient_relationship_termination", priority: 1 },
  "ilişkisini sonlandır": { searchTerm: "hasta-hekim ilişkisinin sonlandırılması", topicCluster: "physician_patient_relationship_termination", priority: 1 },
  "tedaviyi birak":       { searchTerm: "hekimin tedaviyi bırakması",              topicCluster: "physician_patient_relationship_termination", priority: 1 },
  "tedaviyi bırak":       { searchTerm: "hekimin tedaviyi bırakması",              topicCluster: "physician_patient_relationship_termination", priority: 1 },
  "tedaviyi sonlandir":   { searchTerm: "hekimin tedaviyi bırakması",              topicCluster: "physician_patient_relationship_termination", priority: 1 },
  "kacinma":              { searchTerm: "sağlık hizmetinden kaçınma",              topicCluster: "physician_refusal_or_withdrawal", priority: 1 },
  "kaçınma":              { searchTerm: "sağlık hizmetinden kaçınma",              topicCluster: "physician_refusal_or_withdrawal", priority: 1 },
  "bakmama":              { searchTerm: "sağlık hizmetinden kaçınma",              topicCluster: "physician_refusal_or_withdrawal", priority: 1 },
  "uymuyor":              { searchTerm: "hasta tedaviye uymuyor",                  topicCluster: "patient_noncompliance", priority: 1 },
  "uyumsu":               { searchTerm: "tedaviye uyumsuz hasta",                  topicCluster: "patient_noncompliance", priority: 1 },
  "uygulamıyor":          { searchTerm: "tedaviyi uygulamayan hasta",              topicCluster: "patient_noncompliance", priority: 1 },
  "uygulamiyor":          { searchTerm: "tedaviyi uygulamayan hasta",              topicCluster: "patient_noncompliance", priority: 1 },
  "talimatlara uyma":     { searchTerm: "hasta talimatlara uymama",                topicCluster: "patient_noncompliance", priority: 1 },
  "talimatlara uyulma":   { searchTerm: "hasta talimatlara uymama",                topicCluster: "patient_noncompliance", priority: 1 },
  "acil durum":           { searchTerm: "acil durum müdahale istisnası",           topicCluster: "emergency_exception", priority: 1 },
  "acil degil":           { searchTerm: "acil olmayan durum tedaviyi sonlandırma", topicCluster: "emergency_exception", priority: 1 },
  "acil değil":           { searchTerm: "acil olmayan durum tedaviyi sonlandırma", topicCluster: "emergency_exception", priority: 1 },
  "acil mudehale":        { searchTerm: "acil müdahale",                           topicCluster: "emergency_intervention", priority: 1 }
};

export function pickHealthLawQuery(classification: ClassifiedMedicalLegalQuestion): string {
  const issueQuery = suggestedQueriesForQuestion(classification.question, 1)[0];
  if (issueQuery) return issueQuery;
  let best: HealthLawQuery | null = null;
  for (const term of classification.searchTerms) {
    const mapped = QUERY_EXPANSION[term];
    if (mapped && (!best || mapped.priority < best.priority)) best = mapped;
  }
  return best?.searchTerm ?? classification.question;
}

export function pickHealthLawQueries(classification: ClassifiedMedicalLegalQuestion, maxQueries = 2): string[] {
  const seen = new Set<string>();
  const issueQueries = suggestedQueriesForQuestion(classification.question, maxQueries);
  for (const query of issueQueries) seen.add(query);
  const queries: HealthLawQuery[] = [];
  for (const term of classification.searchTerms) {
    const mapped = QUERY_EXPANSION[term];
    if (mapped && !seen.has(mapped.searchTerm)) {
      seen.add(mapped.searchTerm);
      queries.push(mapped);
    }
  }
  queries.sort((a, b) => a.priority - b.priority);
  const result = [...issueQueries, ...queries.slice(0, maxQueries).map((q) => q.searchTerm)]
    .filter((query, index, all) => all.indexOf(query) === index)
    .slice(0, maxQueries);
  return result.length > 0 ? result : [classification.question];
}
