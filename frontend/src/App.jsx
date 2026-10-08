import { useCallback, useEffect, useMemo, useState } from "react";
import { loadStatusData } from "./api.js";
import {
  formatTimestamp,
  getOverallState,
  statusLabel
} from "./status-utils.js";

function IncidentCard({ incident }) {
  return (
    <article className="incident-card">
      <div className="incident-heading">
        <div>
          <h3>{incident.title}</h3>
          <p>{incident.message}</p>
        </div>

        <span className={`status-badge ${incident.status}`}>
          {statusLabel(incident.status)}
        </span>
      </div>

      <div className="incident-meta">
        <span>Started {formatTimestamp(incident.createdAt)}</span>
        <span>
          Updated {formatTimestamp(incident.updatedAt)}
        </span>
      </div>

      {incident.updates.length > 0 && (
        <div className="incident-updates">
          {incident.updates
            .slice()
            .reverse()
            .map((update) => (
              <div className="incident-update" key={update.updateId}>
                <div>
                  <strong>{statusLabel(update.status)}</strong>
                  <time>{formatTimestamp(update.createdAt)}</time>
                </div>
                <p>{update.message}</p>
              </div>
            ))}
        </div>
      )}
    </article>
  );
}

function ServiceCard({ service }) {
  const checks = service.checks ?? [];

  return (
    <article className="service-card">
      <div className="service-heading">
        <div>
          <h3>{service.name}</h3>
          <a href={service.url} target="_blank" rel="noreferrer">
            {service.url}
          </a>
        </div>

        <span className={`status-badge ${service.status}`}>
          {statusLabel(service.status)}
        </span>
      </div>

      <div className="check-strip" aria-label="Recent monitoring checks">
        {checks
          .slice()
          .reverse()
          .map((check) => (
            <span
              key={`${check.region}-${check.checkedAt}`}
              className={`check ${check.success ? "success" : "failure"}`}
              title={`${formatTimestamp(check.checkedAt)} · ${
                check.responseTimeMs
              } ms`}
            />
          ))}
      </div>

      <div className="service-meta">
        <span>Last checked</span>
        <strong>{formatTimestamp(service.lastCheckedAt)}</strong>
      </div>

      {checks[0] && (
        <div className="service-meta">
          <span>Latest response</span>
          <strong>{checks[0].responseTimeMs} ms</strong>
        </div>
      )}
    </article>
  );
}

export default function App() {
  const [services, setServices] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async (signal, background = false) => {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await loadStatusData(signal);

      setServices(data.services);
      setIncidents(data.incidents);
      setLastUpdated(new Date());
      setError("");
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError("Status information could not be loaded.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    refresh(controller.signal);

    const interval = window.setInterval(() => {
      refresh(controller.signal, true);
    }, 30_000);

    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [refresh]);

  const activeIncidents = useMemo(
    () =>
      incidents.filter((incident) => incident.status !== "resolved"),
    [incidents]
  );

  const resolvedIncidents = useMemo(
    () =>
      incidents.filter((incident) => incident.status === "resolved"),
    [incidents]
  );

  const overall = useMemo(
    () => getOverallState(services, incidents),
    [services, incidents]
  );

  return (
    <main>
      <header className="site-header">
        <div>
          <p className="eyebrow">Status platform</p>
          <h1>System status</h1>
          <p className="header-description">
            Current availability, performance and incident information.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refresh(undefined, true)}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <section className={`overall-banner ${overall.status}`}>
        <span className="overall-indicator" />
        <div>
          <h2>{loading ? "Loading system status…" : overall.heading}</h2>
          {!loading && <p>{overall.message}</p>}
        </div>
      </section>

      {activeIncidents.length > 0 && (
        <section>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Current events</p>
              <h2>Active incidents</h2>
            </div>
          </div>

          <div className="incident-list">
            {activeIncidents.map((incident) => (
              <IncidentCard
                incident={incident}
                key={incident.incidentId}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Infrastructure</p>
            <h2>Services</h2>
          </div>

          <p>
            {lastUpdated
              ? `Updated ${formatTimestamp(lastUpdated)}`
              : "Waiting for data"}
          </p>
        </div>

        <div className="service-list">
          {services.map((service) => (
            <ServiceCard service={service} key={service.id} />
          ))}
        </div>
      </section>

      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Historical information</p>
            <h2>Recent incidents</h2>
          </div>
        </div>

        {resolvedIncidents.length > 0 ? (
          <div className="incident-list">
            {resolvedIncidents.map((incident) => (
              <IncidentCard
                incident={incident}
                key={incident.incidentId}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            No resolved incidents have been recorded.
          </div>
        )}
      </section>

      <footer>
        Monitoring checks run every 60 seconds.
      </footer>
    </main>
  );
}
