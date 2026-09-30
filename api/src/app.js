import express from "express";

const app = express();

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "status-api"
  });
});

export default app;
