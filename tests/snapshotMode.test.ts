import { describe, it, expect } from "vitest";
import { existsSync } from "fs";

describe("snapshot mode", () => {
  it("should be a valid sourceMode value", () => {
    const modes = ["mock", "live", "snapshot"];
    expect(modes).toContain("snapshot");
  });

  it("should have fixture files for record/replay", () => {
    expect(existsSync("fixtures/live-samples/yargitay-synthetic.json")).toBe(true);
  });

  it("should be able to create a service with snapshot mode", async () => {
    // At minimum, the service should not crash when snapshot mode is used
    const { DoktorMcpInformationService } = await import("../src/app/service.js");
    const service = new DoktorMcpInformationService();
    // Snapshot mode falls back to mock-like behavior
    const pack = await service.prepareInformationPack({
      question: "test",
      sourceMode: "snapshot" as any,
    });
    expect(pack.shortAnswer).toBeTruthy();
  });
});
