import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import app from "../src/app.js";

const testToken = "ci-only-probe-token";
const previousToken = process.env.PROBE_TOKEN;

let server;
let baseUrl;

before(async () => {
  process.env.PROBE_TOKEN = testToken;

  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (previousToken === undefined) {
    delete process.env.PROBE_TOKEN;
  } else {
    process.env.PROBE_TOKEN = previousToken;
  }

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("public endpoints do not require authentication", async () => {
  for (const path of ["/api/health", "/api/services"]) {
    const response = await fetch(`${baseUrl}${path}`);

    assert.equal(response.status, 200);
    await response.text();
  }
});

test("probe submissions without a token are rejected", async () => {
  const response = await fetch(`${baseUrl}/api/probes`, {
    method: "POST"
  });

  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "unauthorized");
});

test("probe submissions with an incorrect token are rejected", async () => {
  const response = await fetch(`${baseUrl}/api/probes`, {
    method: "POST",
    headers: {
      Authorization: "Bearer wrong-token"
    }
  });

  assert.equal(response.status, 401);
  await response.text();
});

test("a correct token reaches the protected route", async () => {
  const response = await fetch(`${baseUrl}/api/probes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${testToken}`
    }
  });

  assert.equal(response.status, 503);
  assert.equal(
    (await response.json()).error,
    "probe_storage_not_configured"
  );
});