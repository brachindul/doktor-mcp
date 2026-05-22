import { createMedicalLegalToolHandlers } from "./mcp/tools.js";

const args = process.argv.slice(2);
const separator = args.indexOf("--");
const directSourceModeIndex = args.indexOf("--sourceMode");
const questionParts = separator === -1
  ? args.slice(0, directSourceModeIndex === -1 ? args.length : directSourceModeIndex)
  : args.slice(0, separator);
const optionParts = separator === -1
  ? (directSourceModeIndex === -1 ? [] : args.slice(directSourceModeIndex))
  : args.slice(separator + 1);
const sourceModeIndex = optionParts.indexOf("--sourceMode");
const sourceMode = sourceModeIndex === -1 ? undefined : optionParts[sourceModeIndex + 1];
const question = questionParts.join(" ") || "kisisel saglik verisi mahremiyet";

const handlers = createMedicalLegalToolHandlers();
const pack = await handlers.prepare_doctor_legal_information_pack({
  question,
  ...(sourceMode ? { sourceMode } : {})
});

console.log(JSON.stringify({
  tool: "prepare_doctor_legal_information_pack",
  input: { question, sourceMode: sourceMode ?? "mock" },
  result: pack
}, null, 2));
