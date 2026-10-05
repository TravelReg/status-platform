import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../src/app.js";

const testToken = "ci-only-storage-token";
const previousToken = process.env.PROBE_TOKEN;

const storedProbes = [];
let server;
let baseUrl;

before(async () => {
  process.env.PROBE_TOKEN = testToken;

  const probeStore = {
    async save(probe) {
      storedProbes.push(probe);
      return probe;
    }
  };

  const app = createApp({ probeStore });

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

  await new Promise((resolve) => server.close(resolve));
});

test("stores an authenticated valid probe", async () => {
  const probe = {
    serviceId: "example-site",
    region: "eu-north-1",
    checkedAt: new Date().toISOString(),
    httpStatus: 200,
    responseTimeMs: 120,
    success: true
  };

  const response = await fetch(`${baseUrl}/api/probes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${testToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(probe)
  });

  assert.equal(response.status, 201);
  assert.deepEqual((await response.json()).probe, probe);
  assert.deepEqual(storedProbes, [probe]);
});
