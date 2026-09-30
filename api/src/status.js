export function calculateStatus(checks, now = Date.now()) {
  if (checks.length === 0) {
    return "unknown";
  }

  const ordered = [...checks].sort(
    (a, b) => Date.parse(a.checkedAt) - Date.parse(b.checkedAt)
  );

  const latest = ordered[ordered.length - 1];

  if (now - Date.parse(latest.checkedAt) >= 180_000) {
    return "unknown";
  }

  let status = "unknown";
  let successStreak = 0;
  let failureStreak = 0;

  for (const check of ordered) {
    if (check.success) {
      successStreak += 1;
      failureStreak = 0;

      if (successStreak >= 2) {
        status = "operational";
      }
    } else {
      failureStreak += 1;
      successStreak = 0;

      if (failureStreak >= 2) {
        status = "down";
      }
    }
  }

  return status;
}