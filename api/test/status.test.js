import test from "node:test";
import assert from "node:assert/strict";
import { calculateStatus } from "../src/status.js";

const now = Date.parse("2026-09-30T12:00:00Z");

function makeChecks(results) {
  return results.map((success, index) => ({
    success,
    checkedAt: new Date(
      now - (results.length - index) * 60_000
    ).toISOString()
  }));
}

const scenarios = [
  ["no results", [], "unknown"],
  ["one initial success", [true], "unknown"],
  ["one initial failure", [false], "unknown"],
  ["two successes", [true, true], "operational"],
  ["one failure after recovery", [true, true, false], "operational"],
  ["two failures", [false, false], "down"],
  ["one success during outage", [false, false, true], "down"],
  ["two successes during outage", [false, false, true, true], "operational"],
  ["two failures after recovery", [true, true, false, false], "down"]
];

for (const [name, results, expected] of scenarios) {
  test(name, () => {
    assert.equal(calculateStatus(makeChecks(results), now), expected);
  });
}

test("status stays operational just before the stale threshold", () => {
  const checks = makeChecks([true, true]);

  assert.equal(calculateStatus(checks, now + 119_999), "operational");
});

test("status becomes unknown at the stale threshold", () => {
  const checks = makeChecks([true, true]);

  assert.equal(calculateStatus(checks, now + 120_000), "unknown");
});