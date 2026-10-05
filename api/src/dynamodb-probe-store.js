import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand
} from "@aws-sdk/lib-dynamodb";

const DEFAULT_RETENTION_DAYS = 30;
const SECONDS_PER_DAY = 86400;

export function createDynamoProbeStore({
  tableName,
  region,
  documentClient,
  retentionDays = DEFAULT_RETENTION_DAYS
}) {
  if (!tableName) {
    throw new Error("A DynamoDB table name is required.");
  }

  if (!Number.isInteger(retentionDays) || retentionDays <= 0) {
    throw new Error("Probe retention days must be a positive integer.");
  }

  const client =
    documentClient ??
    DynamoDBDocumentClient.from(
      new DynamoDBClient({
        region
      }),
      {
        marshallOptions: {
          removeUndefinedValues: true
        }
      }
    );

  return {
    async save(probe) {
      const expiresAt =
        Math.floor(Date.parse(probe.checkedAt) / 1000) +
        retentionDays * SECONDS_PER_DAY;

      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            ServiceID: probe.serviceId,
            Timestamp: probe.checkedAt,
            Region: probe.region,
            HTTPStatus: probe.httpStatus,
            ResponseTimeMs: probe.responseTimeMs,
            Success: probe.success,
            ExpiresAt: expiresAt
          }
        })
      );

      return {
        serviceId: probe.serviceId,
        region: probe.region,
        checkedAt: probe.checkedAt,
        httpStatus: probe.httpStatus,
        responseTimeMs: probe.responseTimeMs,
        success: probe.success
      };
    }
  };
}
