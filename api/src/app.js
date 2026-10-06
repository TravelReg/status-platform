import express from "express";
import { services } from "./services.js";
import { requireProbeToken } from "./auth.js";
import { validateProbe } from "./probe-validation.js";
import { calculateStatus } from "./status.js";

export function createApp({ probeStore = null } = {}) {
  const app = express();

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "status-api"
    });
  });

  app.get("/api/services", async (_req, res) => {
    if (!probeStore) {
      return res.json({
        services: services.map((service) => ({
          ...service,
          status: "unknown",
          lastCheckedAt: null
        }))
      });
    }

    try {
      const serviceStatuses = await Promise.all(
        services.map(async (service) => {
          const checks = await probeStore.listRecent(service.id, 100);

          return {
            ...service,
            status: calculateStatus(checks),
            lastCheckedAt: checks[0]?.checkedAt ?? null
          };
        })
      );

      return res.json({
        services: serviceStatuses
      });
    } catch (error) {
      console.error("Failed to retrieve service status.", error);

      return res.status(503).json({
        error: "service_status_unavailable"
      });
    }
  });

  app.get("/api/services/:serviceId/history", async (req, res) => {
    const service = services.find(
      (candidate) => candidate.id === req.params.serviceId
    );

    if (!service) {
      return res.status(404).json({
        error: "service_not_found"
      });
    }

    const requestedLimit =
      req.query.limit === undefined ? 50 : Number(req.query.limit);

    if (
      !Number.isInteger(requestedLimit) ||
      requestedLimit < 1 ||
      requestedLimit > 100
    ) {
      return res.status(400).json({
        error: "invalid_limit",
        message: "The history limit must be an integer from 1 to 100."
      });
    }

    if (!probeStore) {
      return res.status(503).json({
        error: "probe_storage_not_configured"
      });
    }

    try {
      const checks = await probeStore.listRecent(
        service.id,
        requestedLimit
      );

      return res.json({
        service,
        checks
      });
    } catch (error) {
      console.error("Failed to retrieve probe history.", error);

      return res.status(503).json({
        error: "probe_history_unavailable"
      });
    }
  });

  app.post(
    "/api/probes",
    requireProbeToken,
    express.json({ limit: "16kb" }),
    async (req, res) => {
      const errors = validateProbe(req.body);

      if (errors.length > 0) {
        return res.status(400).json({
          error: "invalid_probe",
          errors
        });
      }

      if (!probeStore) {
        return res.status(503).json({
          error: "probe_storage_not_configured"
        });
      }

      try {
        const storedProbe = await probeStore.save(req.body);

        return res.status(201).json({
          probe: storedProbe
        });
      } catch (error) {
        console.error("Failed to store probe result.", error);

        return res.status(503).json({
          error: "probe_storage_unavailable"
        });
      }
    }
  );

  return app;
}

const app = createApp();

export default app;
