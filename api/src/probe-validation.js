import { services, probeRegions } from "./services.js";

export function validateProbe(probe, now = Date.now()) {
  if (!probe || typeof probe !== "object" || Array.isArray(probe)) {
    return ["Body must be a JSON object"];
  }

  const errors = [];

  if (!services.some((service) => service.id === probe.serviceId)) {
    errors.push("Unknown serviceId");
  }

  if (!probeRegions.includes(probe.region)) {
    errors.push("Unknown probe region");
  }

  const timestamp = Date.parse(probe.checkedAt);

  if (
    typeof probe.checkedAt !== "string" ||
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString() !== probe.checkedAt
  ) {
    errors.push(
      "checkedAt must be a UTC timestamp such as 2026-09-30T12:00:00.000Z"
    );
  } else if (timestamp > now + 30_000) {
    errors.push("checkedAt cannot be more than 30 seconds in the future");
  }

  const validHttpStatus =
    probe.httpStatus === null ||
    (Number.isInteger(probe.httpStatus) &&
      probe.httpStatus >= 100 &&
      probe.httpStatus <= 599);

  if (!validHttpStatus) {
    errors.push("httpStatus must be an integer from 100 to 599, or null");
  }

  if (!Number.isFinite(probe.responseTimeMs) || probe.responseTimeMs < 0) {
    errors.push("responseTimeMs must be a nonnegative number");
  }

  if (typeof probe.success !== "boolean") {
    errors.push("success must be a boolean");
  } else if (validHttpStatus) {
    const expectedSuccess =
      probe.httpStatus !== null &&
      probe.httpStatus >= 200 &&
      probe.httpStatus <= 399;

    if (probe.success !== expectedSuccess) {
      errors.push("success does not match httpStatus");
    }
  }

  return errors;
}