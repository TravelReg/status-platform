export function getOverallState(services, incidents) {
  const activeIncidents = incidents.filter(
    (incident) => incident.status !== "resolved"
  );

  if (
    services.some((service) => service.status === "down") ||
    activeIncidents.length > 0
  ) {
    return {
      status: "down",
      heading: "Service disruption",
      message: "One or more services are currently experiencing issues."
    };
  }

  if (
    services.length > 0 &&
    services.every((service) => service.status === "operational")
  ) {
    return {
      status: "operational",
      heading: "All systems operational",
      message: "All monitored services are operating normally."
    };
  }

  return {
    status: "unknown",
    heading: "Status is being established",
    message: "We are waiting for enough recent monitoring data."
  };
}

export function statusLabel(status) {
  const labels = {
    operational: "Operational",
    down: "Down",
    unknown: "Unknown",
    investigating: "Investigating",
    identified: "Identified",
    monitoring: "Monitoring",
    resolved: "Resolved"
  };

  return labels[status] ?? status;
}

export function formatTimestamp(value) {
  if (!value) {
    return "No checks received";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
