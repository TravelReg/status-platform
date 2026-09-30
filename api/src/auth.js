import { timingSafeEqual } from "node:crypto";

export function requireProbeToken(req, res, next) {
  const token = process.env.PROBE_TOKEN;

  if (!token) {
    return res.status(503).json({
      error: "probe_auth_not_configured"
    });
  }

  const received = Buffer.from(req.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${token}`);

  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    return res.status(401).json({
      error: "unauthorized"
    });
  }

  next();
}