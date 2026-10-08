import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import { incidentStatuses } from "./incident-model.js";

function utcTimestamp() {
  return new Date().toISOString();
}

function mapIncident(item) {
  return {
    incidentId: item.IncidentID,
    title: item.Title,
    message: item.Message,
    status: item.Status,
    affectedServiceIds: item.AffectedServiceIDs,
    createdAt: item.CreatedAt,
    updatedAt: item.UpdatedAt,
    resolvedAt: item.ResolvedAt ?? null,
    updates: (item.Updates ?? []).map((update) => ({
      updateId: update.UpdateID,
      status: update.Status,
      message: update.Message,
      createdAt: update.CreatedAt
    }))
  };
}

export function createDynamoIncidentStore({
  tableName,
  region,
  documentClient,
  idFactory = randomUUID,
  timestampFactory = utcTimestamp
}) {
  if (!tableName) {
    throw new Error("A DynamoDB incident table name is required.");
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

  async function queryStatus(status, limit) {
    const response = await client.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "StatusCreatedAtIndex",
        KeyConditionExpression: "#status = :status",
        ExpressionAttributeNames: {
          "#status": "Status"
        },
        ExpressionAttributeValues: {
          ":status": status
        },
        ScanIndexForward: false,
        Limit: limit
      })
    );

    return (response.Items ?? []).map(mapIncident);
  }

  return {
    async create({
      title,
      message,
      status,
      affectedServiceIds
    }) {
      const incidentId = idFactory();
      const updateId = idFactory();
      const now = timestampFactory();

      const item = {
        IncidentID: incidentId,
        Title: title.trim(),
        Message: message.trim(),
        Status: status,
        AffectedServiceIDs: [...affectedServiceIds],
        CreatedAt: now,
        UpdatedAt: now,
        ResolvedAt: status === "resolved" ? now : null,
        Updates: [
          {
            UpdateID: updateId,
            Status: status,
            Message: message.trim(),
            CreatedAt: now
          }
        ]
      };

      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: item,
          ConditionExpression: "attribute_not_exists(IncidentID)"
        })
      );

      return mapIncident(item);
    },

    async get(incidentId) {
      const response = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: {
            IncidentID: incidentId
          }
        })
      );

      return response.Item ? mapIncident(response.Item) : null;
    },

    async update(incidentId, { status, message }) {
      const existingResponse = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: {
            IncidentID: incidentId
          }
        })
      );

      if (!existingResponse.Item) {
        return null;
      }

      const now = timestampFactory();
      const update = {
        UpdateID: idFactory(),
        Status: status,
        Message: message.trim(),
        CreatedAt: now
      };

      const resolvedAt =
        status === "resolved"
          ? existingResponse.Item.ResolvedAt ?? now
          : null;

      const response = await client.send(
        new UpdateCommand({
          TableName: tableName,
          Key: {
            IncidentID: incidentId
          },
          UpdateExpression:
            "SET #status = :status, #message = :message, " +
            "UpdatedAt = :updatedAt, ResolvedAt = :resolvedAt, " +
            "Updates = list_append(if_not_exists(Updates, :empty), :updates)",
          ExpressionAttributeNames: {
            "#status": "Status",
            "#message": "Message"
          },
          ExpressionAttributeValues: {
            ":status": status,
            ":message": message.trim(),
            ":updatedAt": now,
            ":resolvedAt": resolvedAt,
            ":empty": [],
            ":updates": [update]
          },
          ConditionExpression: "attribute_exists(IncidentID)",
          ReturnValues: "ALL_NEW"
        })
      );

      return mapIncident(response.Attributes);
    },

    async list({ status = null, limit = 50 } = {}) {
      if (status) {
        return queryStatus(status, limit);
      }

      const results = await Promise.all(
        incidentStatuses.map((incidentStatus) =>
          queryStatus(incidentStatus, limit)
        )
      );

      return results
        .flat()
        .sort(
          (first, second) =>
            Date.parse(second.createdAt) -
            Date.parse(first.createdAt)
        )
        .slice(0, limit);
    }
  };
}
