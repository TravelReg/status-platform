import express from "express";
import { services } from "./services.js";

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

export default app;