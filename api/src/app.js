import express from "express";
import { services } from "./services.js";
import { requireProbeToken } from "./auth.js";

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

app.post("/api/probes", requireProbeToken, (_req, res) => {
  res.status(503).json({
    error: "probe_storage_not_configured"
  });
});

export default app;