import type { HealthLegislationHint } from "./liveTypes.js";

export const healthLegislationHints: HealthLegislationHint[] = [
  {
    terms: ["riza", "rıza", "onam", "aydinlat", "aydınlat", "hasta haklari", "hasta hakları", "tibbi mudahale", "tıbbi müdahale"],
    query: "Hasta Haklari Yonetmeligi",
    title: "Hasta Haklari Yonetmeligi",
    sourceId: "mevzuat:7.5.4847",
    legislationNumber: "4847",
    legislationType: "7",
    legislationArrangement: "5",
    articleNumbers: ["24", "26"],
    dimensions: ["patient_rights", "civil_compensation", "disciplinary_administrative"]
  },
  {
    terms: ["saglik verisi", "sağlık verisi", "mahrem", "kvkk", "kisisel", "kişisel", "veri"],
    query: "Kisisel Verilerin Korunmasi Kanunu",
    title: "Kisisel Verilerin Korunmasi Kanunu",
    sourceId: "mevzuat:1.5.6698",
    legislationNumber: "6698",
    legislationType: "1",
    legislationArrangement: "5",
    articleNumbers: ["6"],
    dimensions: ["privacy_kvkk", "patient_rights"]
  },
  {
    terms: ["hekim", "yukumluluk", "yükümlülük"],
    query: "Hasta Haklari Yonetmeligi",
    title: "Hasta Haklari Yonetmeligi",
    sourceId: "mevzuat:7.5.4847",
    legislationNumber: "4847",
    legislationType: "7",
    legislationArrangement: "5",
    articleNumbers: ["15", "24"],
    dimensions: ["patient_rights", "professional_ethics"]
  }
];
