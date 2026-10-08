import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../src/app.js";

const previousToken = process.env.ADMIN_TOKEN;
const adminToken = "ci-only-admin-token";

let server;
let baseUrl;
let incident;

before(async () => {
  process.env.ADMIN_TOKEN = adminToken;

  const incidentStore = {
    async list() {
      return incident ? [incident] : [];
    },

    async create(input) {
      incident = {
        incidentId: "incident-1",
        ...input,
        createdAt: "2026-10-08T07:00:00.000Z",
        updatedAt: "2026-10-08T07:00:00.000Z",
        resolvedAt: null,
        updates: []
      };

      return incident;
    },

    async update(incidentId, input) {
      if (!incident || incidentId !== incident.incidentId) {
        return null;
      }

      incident = {
        ...incident,
        ...input,
        updatedAt: "2026-10-08T07:05:00.000Z",
        resolvedAt:
          input.status === "resolved"
            ? "2026-10-08T07:05:00.000Z"
            : null
      };

      return incident;
    }
  };

  const app = createApp({ incidentStore });

  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (previousToken === undefined) {
    delete process.env.ADMIN_TOKEN;
  } else {
    process.env.ADMIN_TOKEN = previousToken;
  }

  await new Promise((resolve) => server.close(resolve));
});

test("public users can list incidents", async () => {
  const response = await fetch(`${baseUrl}/api/incidents`);

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).incidents, []);
});

test("unauthenticated users cannot create incidents", async () => {
  const response = await fetch(`${baseUrl}/api/admin/incidents`, {
    method: "POST"
  });

  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "unauthorized");
});

test("an administrator can create an incident", async () => {
  const response = await fetch(`${baseUrl}/api/admin/incidents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: "Example Website outage",
      message: "We are investigating.",
      status: "investigating",
      affectedServiceIds: ["example-site"]
    })
  });

  assert.equal(response.status, 201);

  const body = await response.json();

  assert.equal(body.incident.incidentId, "incident-1");
  assert.equal(body.incident.status, "investigating");
});

test("an administrator can resolve an incident", async () => {
  const response = await fetch(
    `${baseUrl}/api/admin/incidents/incident-1`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status: "resolved",
        message: "The service has recovered."
      })
    }
  );

  assert.equal(response.status, 200);

  const body = await response.json();

  assert.equal(body.incident.status, "resolved");
  assert.equal(
    body.incident.resolvedAt,
    "2026-10-08T07:05:00.000Z"
  );
});
