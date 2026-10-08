import test from "node:test";
import assert from "node:assert/strict";
import {
  validateIncidentCreate,
  validateIncidentUpdate
} from "../src/incident-model.js";

test("accepts a valid incident", () => {
  const errors = validateIncidentCreate({
    title: "Example Website outage",
    message: "We are investigating failed availability checks.",
    status: "investigating",
    affectedServiceIds: ["example-site"]
  });

  assert.deepEqual(errors, []);
});

test("rejects an unknown affected service", () => {
  const errors = validateIncidentCreate({
    title: "Service outage",
    message: "We are investigating.",
    status: "investigating",
    affectedServiceIds: ["not-configured"]
  });

  assert.ok(errors.includes("unknown affected service: not-configured"));
});

test("accepts a valid incident update", () => {
  const errors = validateIncidentUpdate({
    status: "resolved",
    message: "The service has recovered."
  });

  assert.deepEqual(errors, []);
});

test("rejects an invalid incident status", () => {
  const errors = validateIncidentUpdate({
    status: "broken",
    message: "Invalid status."
  });

  assert.ok(errors.some((error) => error.startsWith("status must be")));
});
