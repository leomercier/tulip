#!/usr/bin/env node
/**
 * Tulip Runtime Agent
 *
 * Runs on each DigitalOcean droplet. Responsibilities:
 *   - Send heartbeat every HEARTBEAT_INTERVAL_SEC seconds
 *   - Poll for queued commands every COMMAND_POLL_INTERVAL_SEC seconds
 *   - Execute only allowlisted command types
 *
 * Started by systemd as tulip-agent.service.
 * Reads config from environment (injected via EnvironmentFile=/opt/tulip/agent/.env).
 */
import { config } from "./config";
import { startHeartbeatLoop } from "./heartbeat";
import { startCommandLoop } from "./commands";

function main(): void {
  console.log(`[agent] Tulip Runtime Agent v${config.agentVersion} starting`);
  console.log(`[agent] instance: ${config.instanceId}`);
  console.log(`[agent] org:      ${config.orgId}`);
  console.log(`[agent] plane:    ${config.controlPlaneBaseUrl}`);

  startHeartbeatLoop();
  startCommandLoop();

  // Keep the process alive
  process.on("SIGTERM", () => {
    console.log("[agent] received SIGTERM, shutting down gracefully");
    process.exit(0);
  });

  process.on("SIGINT", () => {
    console.log("[agent] received SIGINT, shutting down");
    process.exit(0);
  });

  process.on("uncaughtException", (err) => {
    console.error("[agent] uncaughtException:", err);
    // Don't exit — systemd will restart us anyway
  });

  console.log("[agent] ready");
}

main();
