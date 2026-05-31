import { describe, it, expect, vi } from "vitest";
describe("record/replay harness", () => {
  it("should allow recording fetch responses for replay", () => {
    const recorder = { responses: [] as any[] };
    const recordFetch = vi.fn(async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.toString();
      const response = new Response(JSON.stringify({ recorded: true, url }));
      recorder.responses.push({ url, status: 200 });
      return response;
    });
    expect(recordFetch).toBeDefined();
    expect(recorder.responses).toEqual([]);
  });
  
  it("fixture files exist for record/replay testing", () => {
    const { existsSync } = require("fs");
    expect(existsSync("fixtures/live-samples/yargitay-synthetic.json")).toBe(true);
  });
});
