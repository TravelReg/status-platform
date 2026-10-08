import test from "node:test";
import assert from "node:assert/strict";
import { getOverallState, statusLabel } from "../src/status-utils.js";

test("reports operational when every service is operational", () => {
  const state = getOverallState(
    [{ status: "operational" }, { status: "operational" }],
    []
  );

  assert.equal(state.status, "operational");
});

test("reports disruption when a service is down", () => {
  const state = getOverallState(
    [{ status: "operational" }, { status: "down" }],
    []
  );

  assert.equal(state.status, "down");
});

test("reports disruption while an incident is active", () => {
  const state = getOverallState(
    [{ status: "operational" }],
    [{ status: "investigating" }]
  );

  assert.equal(state.status, "down");
});

test("ignores resolved incidents for overall status", () => {
  const state = getOverallState(
    [{ status: "operational" }],
    [{ status: "resolved" }]
  );

  assert.equal(state.status, "operational");
});

test("formats known status labels", () => {
  assert.equal(statusLabel("investigating"), "Investigating");
  assert.equal(statusLabel("operational"), "Operational");
});
