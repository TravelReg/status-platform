import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand
} from "@aws-sdk/lib-dynamodb";

const DEFAULT_RETENTION_DAYS = 30;
const SECONDS_PER_DAY = 86400;

function mapProbeItem(item) {
  return {
    serviceId: item.ServiceID,
    region: item.Region,
    checkedAt: item.Timestamp,
    httpStatus: item.HTTPStatus ?? null,
    responseTimeMs: item.ResponseTimeMs,
    success: item.Success
  };
}

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
      new DynamoDBClient({ region }),
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

      return { ...probe };
    },

    async listRecent(serviceId, limit = 100) {
      const response = await client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "#serviceId = :serviceId",
          ExpressionAttributeNames: {
            "#serviceId": "ServiceID"
          },
          ExpressionAttributeValues: {
            ":serviceId": serviceId
          },
          ScanIndexForward: false,
          Limit: limit
        })
      );

      return (response.Items ?? []).map(mapProbeItem);
    }
  };
}
