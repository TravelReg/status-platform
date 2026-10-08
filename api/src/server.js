import { createApp } from "./app.js";
import { createDynamoProbeStore } from "./dynamodb-probe-store.js";
import { createDynamoIncidentStore } from "./dynamodb-incident-store.js";

const port = Number(process.env.PORT ?? 3000);
const probeTableName = process.env.PROBE_TABLE_NAME;
const incidentTableName = process.env.INCIDENT_TABLE_NAME;
const region =
  process.env.AWS_REGION ??
  process.env.AWS_DEFAULT_REGION ??
  "eu-north-1";

if (process.env.NODE_ENV === "production" && !probeTableName) {
  throw new Error("PROBE_TABLE_NAME is required in production.");
}

const probeStore = probeTableName
  ? createDynamoProbeStore({
      tableName: probeTableName,
      region
    })
  : null;

const incidentStore = incidentTableName
  ? createDynamoIncidentStore({
      tableName: incidentTableName,
      region
    })
  : null;

const app = createApp({
  probeStore,
  incidentStore
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Status API listening on port ${port}`);
});
