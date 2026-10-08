async function fetchJson(path, signal) {
  const response = await fetch(path, {
    headers: {
      Accept: "application/json"
    },
    signal
  });

  if (!response.ok) {
    throw new Error(`Request failed with HTTP ${response.status}`);
  }

  return response.json();
}

export async function loadStatusData(signal) {
  const [servicePayload, incidentPayload] = await Promise.all([
    fetchJson("/api/services", signal),
    fetchJson("/api/incidents?limit=20", signal)
  ]);

  const services = await Promise.all(
    servicePayload.services.map(async (service) => {
      const historyPayload = await fetchJson(
        `/api/services/${encodeURIComponent(service.id)}/history?limit=20`,
        signal
      );

      return {
        ...service,
        checks: historyPayload.checks
      };
    })
  );

  return {
    services,
    incidents: incidentPayload.incidents
  };
}
