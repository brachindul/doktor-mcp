import type { ClassifiedMedicalLegalQuestion } from "../../contracts/legal.js";
import type { LegislationSourceAdapter } from "../types.js";
import { mockLegislationProvisions } from "../mockData.js";

const ethicsPriorityMap: Record<string, number> = {
  "Tibbi Deontoloji Nizamnamesi": 10,
  "Tababet ve Suabati Sanatlarinin Tarzi Icrasina Dair Kanun": 20,
  "Hasta Haklari Yonetmeligi": 40,
  "Kisisel Verilerin Korunmasi Kanunu": 90,
  "Sağlık Meslek Mensupları ile Sağlık Hizmetlerinde Çalışan Diğer Meslek Mensuplarının İş ve Görev Tanımlarına Dair Yönetmelik": 5,
  "Is Sagligi ve Guvenligi Kanunu": 65,
  "Organ ve Doku Nakli Kanunu": 70,
  "Uremeye Yardimci Tedavi Yonetmeligi": 80,
  "Geleneksel ve Tamamlayici Tip Uygulamalari Yonetmeligi": 90,
  "Sağlık Bakanlığı Atama ve Yer Değiştirme Yönetmeliği": 30,
  "Tıpta ve Diş Hekimliğinde Uzmanlık Eğitimi Yönetmeliği": 25,
  "657 Sayılı Devlet Memurları Kanunu": 60,
  "Ek Ödeme Yönetmeliği": 55
};

const standardPriorityMap: Record<string, number> = {
  "Hasta Haklari Yonetmeligi": 10,
  "Kisisel Verilerin Korunmasi Kanunu": 20,
  "Tibbi Deontoloji Nizamnamesi": 40,
  "Tababet ve Suabati Sanatlarinin Tarzi Icrasina Dair Kanun": 50,
  "Sağlık Meslek Mensupları ile Sağlık Hizmetlerinde Çalışan Diğer Meslek Mensuplarının İş ve Görev Tanımlarına Dair Yönetmelik": 5,
  "Is Sagligi ve Guvenligi Kanunu": 65,
  "Organ ve Doku Nakli Kanunu": 70,
  "Uremeye Yardimci Tedavi Yonetmeligi": 80,
  "Geleneksel ve Tamamlayici Tip Uygulamalari Yonetmeligi": 90,
  "Sağlık Bakanlığı Atama ve Yer Değiştirme Yönetmeliği": 15,
  "Tıpta ve Diş Hekimliğinde Uzmanlık Eğitimi Yönetmeliği": 12,
  "657 Sayılı Devlet Memurları Kanunu": 8,
  "Ek Ödeme Yönetmeliği": 9
};

/** Priority map used when the query targets public-employment / assignment topics. */
const publicEmploymentPriorityMap: Record<string, number> = {
  "Sağlık Bakanlığı Atama ve Yer Değiştirme Yönetmeliği": 1,
  "Sağlık Bakanlığı Disiplin Amirleri Yönetmeliği": 2,
  "657 Sayılı Devlet Memurları Kanunu": 3,
  "Ek Ödeme Yönetmeliği": 4,
  "Tıpta ve Diş Hekimliğinde Uzmanlık Eğitimi Yönetmeliği": 4,
  "Sağlık Meslek Mensupları ile Sağlık Hizmetlerinde Çalışan Diğer Meslek Mensuplarının İş ve Görev Tanımlarına Dair Yönetmelik": 5,
  "Hasta Haklari Yonetmeligi": 10,
  "Kisisel Verilerin Korunmasi Kanunu": 20,
  "Tibbi Deontoloji Nizamnamesi": 40,
  "Tababet ve Suabati Sanatlarinin Tarzi Icrasina Dair Kanun": 50,
  "Is Sagligi ve Guvenligi Kanunu": 65,
  "Organ ve Doku Nakli Kanunu": 70,
  "Uremeye Yardimci Tedavi Yonetmeligi": 80,
  "Geleneksel ve Tamamlayici Tip Uygulamalari Yonetmeligi": 90
};

/** Terms that signal a public-employment / assignment query. */
const PUBLIC_EMPLOYMENT_TERMS = [
  "tayin", "atama", "yer değiştirme", "yer degistirme", "nakil",
  "mecburi hizmet", "ek ödeme", "ek odeme", "döner sermaye", "doner sermaye",
  "disiplin", "sorusturma"
];

export class MockLegislationAdapter implements LegislationSourceAdapter {
  async searchHealthLegislation(classification: ClassifiedMedicalLegalQuestion) {
    const filtered = mockLegislationProvisions.filter((provision) =>
      provision.dimensions.some((dimension) => classification.dimensions.includes(dimension))
    );

    const hasEthics = classification.dimensions.includes("professional_ethics");
    const isPublicEmploymentQuery = classification.searchTerms.some((t) =>
      PUBLIC_EMPLOYMENT_TERMS.includes(t)
    );

    const priorityMap = isPublicEmploymentQuery
      ? publicEmploymentPriorityMap
      : hasEthics
        ? ethicsPriorityMap
        : standardPriorityMap;

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
