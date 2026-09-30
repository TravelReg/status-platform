import test from "node:test";
import assert from "node:assert/strict";
import { validateProbe } from "../src/probe-validation.js";

const now = Date.parse("2026-09-30T12:00:00.000Z");

const validProbe = {
  serviceId: "example-site",
  region: "eu-north-1",
  checkedAt: new Date(now).toISOString(),
  httpStatus: 200,
  responseTimeMs: 120,
  success: true
};

const validCases = [
  ["HTTP success", {}],
  ["HTTP redirect", { httpStatus: 302 }],
  ["HTTP failure", { httpStatus: 503, success: false }],
  ["connection failure", { httpStatus: null, success: false }]
];

for (const [name, changes] of validCases) {
  test(`accepts ${name}`, () => {
    assert.deepEqual(
      validateProbe({ ...validProbe, ...changes }, now),
      []
    );
  });
}

const invalidCases = [
  ["unknown service", { serviceId: "missing" }],
  ["unknown region", { region: "missing" }],
  ["invalid timestamp", { checkedAt: "not-a-date" }],
  ["future timestamp", { checkedAt: new Date(now + 31_000).toISOString() }],
  ["text HTTP status", { httpStatus: "200" }],
  ["out-of-range HTTP status", { httpStatus: 600 }],
  ["negative response time", { responseTimeMs: -1 }],
  ["text response time", { responseTimeMs: "120" }],
  ["non-boolean success", { success: "true" }],
  ["inconsistent success", { success: false }],
  ["missing HTTP status", { httpStatus: undefined }],
  ["missing response time", { responseTimeMs: undefined }]
];

for (const [name, changes] of invalidCases) {
  test(`rejects ${name}`, () => {
    assert.ok(
      validateProbe({ ...validProbe, ...changes }, now).length > 0
    );
  });
}

test("rejects a null body", () => {
  assert.ok(validateProbe(null, now).length > 0);
});

test("rejects an array body", () => {
  assert.ok(validateProbe([], now).length > 0);
});