function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

export const config = {
  controlPlaneBaseUrl: required("CONTROL_PLANE_BASE_URL"),
  instanceId: required("INSTANCE_ID"),
  orgId: required("ORG_ID"),
  runtimeAuthToken: required("RUNTIME_AUTH_TOKEN"),
  openclawHealthUrl: optional("OPENCLAW_HEALTH_URL", "http://127.0.0.1:3000/health"),
  heartbeatIntervalSec: parseInt(optional("HEARTBEAT_INTERVAL_SEC", "30"), 10),
  commandPollIntervalSec: parseInt(optional("COMMAND_POLL_INTERVAL_SEC", "15"), 10),
  agentVersion: "0.1.0",
  openclawImage: optional("OPENCLAW_IMAGE", "ghcr.io/tulipai/openclaw:latest"),
} as const;
