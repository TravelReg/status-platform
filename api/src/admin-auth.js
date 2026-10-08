import { timingSafeEqual } from "node:crypto";

function tokensMatch(receivedToken, expectedToken) {
  const received = Buffer.from(receivedToken);
  const expected = Buffer.from(expectedToken);

  return (
    received.length === expected.length &&
    timingSafeEqual(received, expected)
  );
}

export function requireAdminToken(req, res, next) {
  const configuredToken = process.env.ADMIN_TOKEN;

  if (!configuredToken) {
    return res.status(503).json({
      error: "admin_auth_not_configured"
    });
  }

  const authorization = req.get("authorization");
  const prefix = "Bearer ";

  if (
    !authorization ||
    !authorization.startsWith(prefix) ||
    !tokensMatch(authorization.slice(prefix.length), configuredToken)
  ) {
    return res.status(401).json({
      error: "unauthorized"
    });
  }

  next();
}
