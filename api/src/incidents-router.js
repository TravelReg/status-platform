import express from "express";
import { requireAdminToken } from "./admin-auth.js";
import {
  incidentStatuses,
  validateIncidentCreate,
  validateIncidentUpdate
} from "./incident-model.js";

export function createIncidentRouter({ incidentStore = null } = {}) {
  const router = express.Router();

  router.get("/incidents", async (req, res) => {
    const status = req.query.status ?? null;
    const limit =
      req.query.limit === undefined ? 50 : Number(req.query.limit);

    if (status !== null && !incidentStatuses.includes(status)) {
      return res.status(400).json({
        error: "invalid_incident_status"
      });
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({
        error: "invalid_limit",
        message: "The incident limit must be an integer from 1 to 100."
      });
    }

    if (!incidentStore) {
      return res.status(503).json({
        error: "incident_storage_not_configured"
      });
    }

    try {
      const incidents = await incidentStore.list({
        status,
        limit
      });

      return res.json({ incidents });
    } catch (error) {
      console.error("Failed to retrieve incidents.", error);

      return res.status(503).json({
        error: "incident_storage_unavailable"
      });
    }
  });

  router.post(
    "/admin/incidents",
    requireAdminToken,
    express.json({ limit: "32kb" }),
    async (req, res) => {
      const errors = validateIncidentCreate(req.body);

      if (errors.length > 0) {
        return res.status(400).json({
          error: "invalid_incident",
          errors
        });
      }

      if (!incidentStore) {
        return res.status(503).json({
          error: "incident_storage_not_configured"
        });
      }

      try {
        const incident = await incidentStore.create({
          title: req.body.title,
          message: req.body.message,
          status: req.body.status,
          affectedServiceIds: req.body.affectedServiceIds
        });

        return res.status(201).json({ incident });
      } catch (error) {
        console.error("Failed to create incident.", error);

        return res.status(503).json({
          error: "incident_storage_unavailable"
        });
      }
    }
  );

  router.patch(
    "/admin/incidents/:incidentId",
    requireAdminToken,
    express.json({ limit: "32kb" }),
    async (req, res) => {
      const errors = validateIncidentUpdate(req.body);

      if (errors.length > 0) {
        return res.status(400).json({
          error: "invalid_incident_update",
          errors
        });
      }

      if (!incidentStore) {
        return res.status(503).json({
          error: "incident_storage_not_configured"
        });
      }

      try {
        const incident = await incidentStore.update(
          req.params.incidentId,
          {
            status: req.body.status,
            message: req.body.message
          }
        );

        if (!incident) {
          return res.status(404).json({
            error: "incident_not_found"
          });
        }

        return res.json({ incident });
      } catch (error) {
        console.error("Failed to update incident.", error);

        return res.status(503).json({
          error: "incident_storage_unavailable"
        });
      }
    }
  );

  return router;
}
