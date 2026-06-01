import { describe, expect, it } from "vitest";
import { ResearchTimeBudget, type IssueProfileForBudget } from "../src/live/timeBudget.js";

describe("T25.2 — Akıllı bütçe tahsisi", () => {
  it("public_employment → legislation-heavy budget (65/35 split)", () => {
    const budget = ResearchTimeBudget.createWithIssueProfile("public_employment");
    const legBudget = budget.sourceBudgets.legislation;
    const precBudget = budget.sourceBudgets.precedent;
    expect(legBudget).toBeGreaterThan(precBudget);
    expect(legBudget).toBeGreaterThan(0);
    expect(precBudget).toBeGreaterThan(0);
  });

  it("public_discipline → legislation-heavy budget", () => {
    const budget = ResearchTimeBudget.createWithIssueProfile("public_discipline");
    expect(budget.sourceBudgets.legislation).toBeGreaterThan(budget.sourceBudgets.precedent);
  });

  it("malpractice_complication → precedent-heavy budget (35/65 split)", () => {
    const budget = ResearchTimeBudget.createWithIssueProfile("malpractice_complication");
    const legBudget = budget.sourceBudgets.legislation;
    const precBudget = budget.sourceBudgets.precedent;
    expect(precBudget).toBeGreaterThan(legBudget);
    expect(legBudget).toBeGreaterThan(0);
    expect(precBudget).toBeGreaterThan(0);
  });

  it("civil_compensation → precedent-heavy budget", () => {
    const budget = ResearchTimeBudget.createWithIssueProfile("civil_compensation");
    expect(budget.sourceBudgets.precedent).toBeGreaterThan(budget.sourceBudgets.legislation);
  });

  it("violence_threat → precedent-heavy budget", () => {
    const budget = ResearchTimeBudget.createWithIssueProfile("violence_threat");
    expect(budget.sourceBudgets.precedent).toBeGreaterThan(budget.sourceBudgets.legislation);
  });

  it("unknown profile → balanced budget (config defaults, both non-zero)", () => {
    const budget = ResearchTimeBudget.createWithIssueProfile("unknown");
    expect(budget.sourceBudgets.legislation).toBeGreaterThan(0);
    expect(budget.sourceBudgets.precedent).toBeGreaterThan(0);
    // Balanced uses config defaults; verify neither phase starves
    expect(budget.sourceBudgets.legislation).toBeGreaterThanOrEqual(500);
    expect(budget.sourceBudgets.precedent).toBeGreaterThanOrEqual(500);
  });

  it("default constructor uses balanced budgets", () => {
    const budget = new ResearchTimeBudget();
    expect(budget.sourceBudgets.legislation).toBeGreaterThan(0);
    expect(budget.sourceBudgets.precedent).toBeGreaterThan(0);
  });

  it("custom sourceBudgets override dynamic allocation", () => {
    const budget = new ResearchTimeBudget({
      sourceBudgets: { legislation: 10000, precedent: 5000 }
    });
    expect(budget.sourceBudgets.legislation).toBe(10000);
    expect(budget.sourceBudgets.precedent).toBe(5000);
  });
});
