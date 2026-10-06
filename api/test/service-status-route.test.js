import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../src/app.js";

let server;
let baseUrl;
let recentChecks;

before(async () => {
  const now = Date.now();

  recentChecks = [
    {
      serviceId: "example-site",
      region: "eu-north-1",
      checkedAt: new Date(now - 30_000).toISOString(),
      httpStatus: 200,
      responseTimeMs: 105,
      success: true
    },
    {
      serviceId: "example-site",
      region: "eu-north-1",
      checkedAt: new Date(now - 90_000).toISOString(),
      httpStatus: 200,
      responseTimeMs: 115,
      success: true
    }
  ];

  const probeStore = {
    async listRecent(serviceId, limit) {
      assert.equal(serviceId, "example-site");
      return recentChecks.slice(0, limit);
    }
  };

  const app = createApp({ probeStore });

  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test("returns current service status from probe history", async () => {
  const response = await fetch(`${baseUrl}/api/services`);

  assert.equal(response.status, 200);

  const body = await response.json();

  assert.equal(body.services.length, 1);
  assert.equal(body.services[0].id, "example-site");
  assert.equal(body.services[0].status, "operational");
  assert.equal(
    body.services[0].lastCheckedAt,
    recentChecks[0].checkedAt
  );
});

test("returns public service history", async () => {
  const response = await fetch(
    `${baseUrl}/api/services/example-site/history?limit=10`
  );

  assert.equal(response.status, 200);

  const body = await response.json();

  assert.equal(body.service.id, "example-site");
  assert.deepEqual(body.checks, recentChecks);
});

test("rejects an invalid history limit", async () => {
  const response = await fetch(
    `${baseUrl}/api/services/example-site/history?limit=101`
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "invalid_limit");
});

test("returns 404 for unknown services", async () => {
  const response = await fetch(
    `${baseUrl}/api/services/not-configured/history`
  );

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "service_not_found");
});
