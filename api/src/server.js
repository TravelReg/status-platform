import { createApp } from "./app.js";
import { createDynamoProbeStore } from "./dynamodb-probe-store.js";

const port = Number(process.env.PORT ?? 3000);
const tableName = process.env.PROBE_TABLE_NAME;
const region =
  process.env.AWS_REGION ??
  process.env.AWS_DEFAULT_REGION ??
  "eu-north-1";

if (process.env.NODE_ENV === "production" && !tableName) {
  throw new Error("PROBE_TABLE_NAME is required in production.");
}

const probeStore = tableName
  ? createDynamoProbeStore({
      tableName,
      region
    })
  : null;

const app = createApp({ probeStore });

app.listen(port, "0.0.0.0", () => {
  console.log(`Status API listening on port ${port}`);
});
