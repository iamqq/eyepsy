/**
 * Append-only audit trail written to stdout so systemd/journald can collect it.
 */
export async function audit(event, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...details,
  };
  console.log(JSON.stringify(entry));
}
