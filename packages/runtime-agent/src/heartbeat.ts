import type { HeartbeatPayload } from "@tulip/types";
import { config } from "./config";
import { runHealthChecks, collectMetrics } from "./health";

export async function sendHeartbeat(): Promise<void> {
  const [checks, metrics] = await Promise.all([
    runHealthChecks(),
    Promise.resolve(collectMetrics()),
  ]);

  const payload: HeartbeatPayload = {
    instanceId: config.instanceId,
    orgId: config.orgId,
    authToken: config.runtimeAuthToken,
    checks,
    metrics,
    version: {
      agent: config.agentVersion,
      openclawImage: config.openclawImage,
    },
  };

  const url = `${config.controlPlaneBaseUrl}/api/runtime/heartbeat`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[heartbeat] HTTP ${res.status}: ${text}`);
    } else {
      console.log(
        `[heartbeat] ok — openclaw:${checks.openclaw.ok} cloudflared:${checks.cloudflared.ok}`
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[heartbeat] failed: ${msg}`);
  }
}

export function startHeartbeatLoop(): void {
  // Send immediately on start, then on interval
  sendHeartbeat().catch(() => null);

  setInterval(() => {
    sendHeartbeat().catch(() => null);
  }, config.heartbeatIntervalSec * 1000);

  console.log(`[heartbeat] loop started — interval ${config.heartbeatIntervalSec}s`);
}
