import { LiveYargitayAdapter } from "./sources/yargitay/liveYargitayAdapter.js";

const args = process.argv.slice(2);
const separator = args.indexOf("--");
const questionParts = separator === -1 ? args : args.slice(0, separator);
const optionParts = separator === -1 ? [] : args.slice(separator + 1);
const sourceModeIndex = optionParts.indexOf("--sourceMode");
const sourceMode = sourceModeIndex === -1 ? "live" : optionParts[sourceModeIndex + 1];
const query = questionParts.join(" ") || "aydınlatılmış rıza";

const adapter = new LiveYargitayAdapter();
const result = await adapter.searchAndNormalize(query);

console.log(JSON.stringify({
  tool: "search_health_precedents",
  input: { query, sourceMode },
  result
}, null, 2));
