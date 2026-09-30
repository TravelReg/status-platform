import express from "express";
import { services } from "./services.js";
import { requireProbeToken } from "./auth.js";
import { validateProbe } from "./probe-validation.js";

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
  (req, res) => {
    const errors = validateProbe(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        error: "invalid_probe",
        errors
      });
    }

    res.status(503).json({
      error: "probe_storage_not_configured"
    });
  }
);

export default app;