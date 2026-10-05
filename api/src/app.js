import express from "express";
import { services } from "./services.js";
import { requireProbeToken } from "./auth.js";
import { validateProbe } from "./probe-validation.js";

export function createApp({ probeStore = null } = {}) {
  const app = express();

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "status-api"
    });
  });

  app.get("/api/services", (_req, res) => {
    res.json({
      services: services.map((service) => ({
        ...service,
        status: "unknown",
        lastCheckedAt: null
      }))
    });
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
