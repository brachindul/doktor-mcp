export const logger = {
  debug: (...args: any[]) => { if (process.env.DOKTOR_MCP_LOG === "debug") console.error(JSON.stringify({ level: "debug", ts: new Date().toISOString(), msg: args.map(String).join(" ") })); },
  info: (...args: any[]) => { if (process.env.DOKTOR_MCP_LOG) console.error(JSON.stringify({ level: "info", ts: new Date().toISOString(), msg: args.map(String).join(" ") })); },
  error: (...args: any[]) => { console.error(JSON.stringify({ level: "error", ts: new Date().toISOString(), msg: args.map(String).join(" ") })); },
};
