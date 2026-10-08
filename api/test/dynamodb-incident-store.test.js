import test from "node:test";
import assert from "node:assert/strict";
import { createDynamoIncidentStore } from "../src/dynamodb-incident-store.js";

test("creates an incident with its initial update", async () => {
  const commands = [];
  const ids = ["incident-1", "update-1"];

  const store = createDynamoIncidentStore({
    tableName: "test-incidents",
    region: "eu-north-1",
    documentClient: {
      async send(command) {
        commands.push(command);
        return {};
      }
    },
    idFactory: () => ids.shift(),
    timestampFactory: () => "2026-10-08T07:00:00.000Z"
  });

  const incident = await store.create({
    title: "Example Website outage",
    message: "We are investigating.",
    status: "investigating",
    affectedServiceIds: ["example-site"]
  });

  assert.equal(commands.length, 1);
  assert.equal(commands[0].input.TableName, "test-incidents");
  assert.equal(commands[0].input.Item.IncidentID, "incident-1");
  assert.equal(commands[0].input.Item.Updates[0].UpdateID, "update-1");

  assert.equal(incident.incidentId, "incident-1");
  assert.equal(incident.status, "investigating");
  assert.equal(incident.updates.length, 1);
});

test("lists incidents through the status index", async () => {
  const commands = [];

  const store = createDynamoIncidentStore({
    tableName: "test-incidents",
    region: "eu-north-1",
    documentClient: {
      async send(command) {
        commands.push(command);

        return {
          Items: [
            {
              IncidentID: "incident-1",
              Title: "Example outage",
              Message: "Investigating.",
              Status: "investigating",
              AffectedServiceIDs: ["example-site"],
              CreatedAt: "2026-10-08T07:00:00.000Z",
              UpdatedAt: "2026-10-08T07:00:00.000Z",
              ResolvedAt: null,
              Updates: []
            }
          ]
        };
      }
    }
  });

  const incidents = await store.list({
    status: "investigating",
    limit: 10
  });

  assert.equal(commands.length, 1);
  assert.equal(
    commands[0].input.IndexName,
    "StatusCreatedAtIndex"
  );
  assert.equal(commands[0].input.ScanIndexForward, false);
  assert.equal(incidents[0].incidentId, "incident-1");
});
