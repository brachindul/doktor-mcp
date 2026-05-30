/**
 * Tests for the extracted minimal pack rescue module.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MinimalPackRescueManager,
  type MinimalPackRescueContext,
  type MinimalPackRescueReason
} from "../src/app/minimalPackRescue.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePartialContext(overrides: Partial<MinimalPackRescueContext> = {}): MinimalPackRescueContext {
  return {
    rescueReason: "timeout_no_partial_state",
    failedPhase: "unknown",
    lastCompletedPhase: "none",
    provisionsAvailable: 0,
    precedentsAvailable: 0,
    classification: {
      question: "Test question",
      dimensions: ["patient_rights"],
      searchTerms: ["test"],
      missingInformation: []
    },
    provisions: [],
    decisions: [],
    reranked: [],
    sourceResults: [],
    legislationPhaseDiagnostics: null,
    timeBudgetTelemetry: null,
    queryTelemetry: [],
    rerankResult: { preRerankTopId: null, postRerankTopId: null, rerankChangedSelection: false, usableCount: 0 },
    ...overrides
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("MinimalPackRescueManager", () => {
  let manager: MinimalPackRescueManager;

  beforeEach(() => {
    manager = new MinimalPackRescueManager();
  });

  it("getLastPartialState returns null initially", () => {
    expect(manager.getLastPartialState()).toBeNull();
  });

  it("updatePartialState stores state that can be retrieved", () => {
    const ctx = makePartialContext({ provisionsAvailable: 5 });
    manager.updatePartialState(ctx);
    const retrieved = manager.getLastPartialState();
    expect(retrieved).not.toBeNull();
    expect(retrieved!.provisionsAvailable).toBe(5);
  });

  it("getLastPartialState returns null after already consumed once", () => {
    manager.updatePartialState(makePartialContext());
    manager.getLastPartialState(); // first call — returns state
    const second = manager.getLastPartialState(); // second call — consumed
    expect(second).toBeNull();
  });

  it("clearPartialState resets the state", () => {
    manager.updatePartialState(makePartialContext());
    manager.clearPartialState();
    expect(manager.getLastPartialState()).toBeNull();
  });

  it("updatePartialState applies defaults when partial update is provided", () => {
    manager.updatePartialState(makePartialContext({
      rescueReason: "timeout_with_legislation",
      failedPhase: "legislation",
      provisionsAvailable: 3
    }));

    const state = manager.getLastPartialState();
    expect(state!.rescueReason).toBe("timeout_with_legislation");
    expect(state!.failedPhase).toBe("legislation");
    expect(state!.provisionsAvailable).toBe(3);
    // Other fields should have defaults
    expect(state!.lastCompletedPhase).toBe("none");
    expect(state!.precedentsAvailable).toBe(0);
  });

  it("updatePartialState merges with previous state", () => {
    manager.updatePartialState(makePartialContext({
      provisionsAvailable: 5,
      lastCompletedPhase: "legislation"
    }));

    manager.updatePartialState({
      precedentsAvailable: 3,
      lastCompletedPhase: "precedent"
    });

    const state = manager.getLastPartialState();
    // Should preserve provisionsAvailable from first update
    expect(state!.provisionsAvailable).toBe(5);
    // Should have updated lastCompletedPhase
    expect(state!.lastCompletedPhase).toBe("precedent");
    // Should have updated precedentsAvailable
    expect(state!.precedentsAvailable).toBe(3);
  });

  it("clearPartialState resets the consumed flag", () => {
    manager.updatePartialState(makePartialContext());
    manager.getLastPartialState(); // consume
    manager.clearPartialState();
    manager.updatePartialState(makePartialContext({ provisionsAvailable: 1 }));
    const state = manager.getLastPartialState();
    expect(state).not.toBeNull();
    expect(state!.provisionsAvailable).toBe(1);
  });

  it("defaults are applied for all required fields when creating from empty state", () => {
    manager.updatePartialState({
      rescueReason: "timeout_with_both"
    });

    const state = manager.getLastPartialState();
    expect(state!.rescueReason).toBe("timeout_with_both");
    expect(state!.failedPhase).toBe("unknown");
    expect(state!.lastCompletedPhase).toBe("none");
    expect(state!.provisionsAvailable).toBe(0);
    expect(state!.precedentsAvailable).toBe(0);
    expect(state!.provisions).toEqual([]);
    expect(state!.decisions).toEqual([]);
    expect(state!.reranked).toEqual([]);
    expect(state!.sourceResults).toEqual([]);
    expect(state!.legislationPhaseDiagnostics).toBeNull();
    expect(state!.timeBudgetTelemetry).toBeNull();
    expect(state!.queryTelemetry).toEqual([]);
    expect(state!.rerankResult).toEqual({ preRerankTopId: null, postRerankTopId: null, rerankChangedSelection: false, usableCount: 0 });
  });
});

describe("MinimalPackRescueReason type", () => {
  it("all expected reason values are strings", () => {
    const reasons: MinimalPackRescueReason[] = [
      "timeout_with_legislation",
      "timeout_with_precedent",
      "timeout_with_both",
      "timeout_no_partial_state",
      "budget_exhausted_with_legislation",
      "budget_exhausted_with_precedent"
    ];
    expect(reasons).toHaveLength(6);
    for (const r of reasons) {
      expect(typeof r).toBe("string");
    }
  });
});
