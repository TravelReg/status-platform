import test from "node:test";
import assert from "node:assert/strict";
import { createDynamoProbeStore } from "../src/dynamodb-probe-store.js";

test("stores a validated probe using the DynamoDB table schema", async () => {
  const commands = [];

  const documentClient = {
    async send(command) {
      commands.push(command);
      return {};
    }
  };

  const store = createDynamoProbeStore({
    tableName: "test-probes",
    region: "eu-north-1",
    documentClient,
    retentionDays: 30
  });

  const probe = {
    serviceId: "example-site",
    region: "eu-north-1",
    checkedAt: "2026-10-06T00:00:00.000Z",
    httpStatus: 200,
    responseTimeMs: 120,
    success: true
  };

  const result = await store.save(probe);

  assert.equal(commands.length, 1);
  assert.equal(commands[0].input.TableName, "test-probes");

  assert.deepEqual(commands[0].input.Item, {
    ServiceID: "example-site",
    Timestamp: "2026-10-06T00:00:00.000Z",
    Region: "eu-north-1",
    HTTPStatus: 200,
    ResponseTimeMs: 120,
    Success: true,
    ExpiresAt: 1793836800
  });

  assert.deepEqual(result, probe);
});
