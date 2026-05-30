import { DoktorMcpInformationService } from "./app/service.js";

const question =
  process.argv.slice(2).join(" ") ||
  "Aydinlatilmis riza kaydi eksikse hekim icin hangi resmi kaynaklar eslesir?";

const service = new DoktorMcpInformationService();
const pack = await service.prepareInformationPack({ question });

console.log(JSON.stringify(pack, null, 2));
