import { services } from "./services.js";

export const incidentStatuses = [
  "investigating",
  "identified",
  "monitoring",
  "resolved"
];

const configuredServiceIds = new Set(
  services.map((service) => service.id)
);

function isNonEmptyString(value, maximumLength) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= maximumLength
  );
}

export function validateIncidentCreate(body) {
  const errors = [];

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return ["body must be a JSON object"];
  }

  if (!isNonEmptyString(body.title, 120)) {
    errors.push("title must contain between 1 and 120 characters");
  }

  if (!isNonEmptyString(body.message, 2000)) {
    errors.push("message must contain between 1 and 2000 characters");
  }

  if (!incidentStatuses.includes(body.status)) {
    errors.push(
      `status must be one of: ${incidentStatuses.join(", ")}`
    );
  }

  if (
    !Array.isArray(body.affectedServiceIds) ||
    body.affectedServiceIds.length === 0
  ) {
    errors.push("affectedServiceIds must contain at least one service");
  } else {
    const uniqueServiceIds = new Set(body.affectedServiceIds);

    if (uniqueServiceIds.size !== body.affectedServiceIds.length) {
      errors.push("affectedServiceIds must not contain duplicates");
    }

    for (const serviceId of body.affectedServiceIds) {
      if (!configuredServiceIds.has(serviceId)) {
        errors.push(`unknown affected service: ${serviceId}`);
      }
    }
  }

  return errors;
}

export function validateIncidentUpdate(body) {
  const errors = [];

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return ["body must be a JSON object"];
  }

  if (!incidentStatuses.includes(body.status)) {
    errors.push(
      `status must be one of: ${incidentStatuses.join(", ")}`
    );
  }

  if (!isNonEmptyString(body.message, 2000)) {
    errors.push("message must contain between 1 and 2000 characters");
  }

  return errors;
}
