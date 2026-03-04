#!/usr/bin/env node
"use strict";

// packages/runtime-agent/src/config.ts
function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}
function optional(name, defaultValue) {
  return process.env[name] ?? defaultValue;
}
var config = {
  controlPlaneBaseUrl: required("CONTROL_PLANE_BASE_URL"),
  instanceId: required("INSTANCE_ID"),
  orgId: required("ORG_ID"),
  runtimeAuthToken: required("RUNTIME_AUTH_TOKEN"),
  openclawHealthUrl: optional("OPENCLAW_HEALTH_URL", "http://127.0.0.1:3000/health"),
  heartbeatIntervalSec: parseInt(optional("HEARTBEAT_INTERVAL_SEC", "30"), 10),
  commandPollIntervalSec: parseInt(optional("COMMAND_POLL_INTERVAL_SEC", "15"), 10),
  agentVersion: "0.1.0",
  openclawImage: optional("OPENCLAW_IMAGE", "ghcr.io/tulipai/openclaw:latest")
};

// packages/runtime-agent/src/health.ts
var import_child_process = require("child_process");
function isServiceActive(name) {
  try {
    const out = (0, import_child_process.execSync)(`systemctl is-active ${name}`, {
      encoding: "utf8",
      timeout: 3e3,
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    return out === "active";
  } catch {
    return false;
  }
}
async function httpGet(url, timeoutMs = 3e3) {
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    return { ok: res.ok, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}
async function runHealthChecks() {
  const [openclawHttp] = await Promise.all([
    httpGet(config.openclawHealthUrl)
  ]);
  const cloudflaredActive = isServiceActive("cloudflared");
  return {
    openclaw: {
      ok: openclawHttp.ok,
      latencyMs: openclawHttp.latencyMs
    },
    cloudflared: { ok: cloudflaredActive }
  };
}
function collectMetrics() {
  let uptimeSec = 0;
  try {
    const raw = (0, import_child_process.execSync)("cat /proc/uptime", { encoding: "utf8" }).trim();
    uptimeSec = Math.floor(parseFloat(raw.split(" ")[0] ?? "0"));
  } catch {
  }
  let load1 = 0;
  try {
    const raw = (0, import_child_process.execSync)("cat /proc/loadavg", { encoding: "utf8" }).trim();
    load1 = parseFloat(raw.split(" ")[0] ?? "0");
  } catch {
  }
  let memFreeMb = 0;
  try {
    const raw = (0, import_child_process.execSync)("grep MemAvailable /proc/meminfo", { encoding: "utf8" });
    const kb = parseInt(raw.match(/(\d+)/)?.[1] ?? "0", 10);
    memFreeMb = Math.floor(kb / 1024);
  } catch {
  }
  let diskFreeGb = 0;
  try {
    const raw = (0, import_child_process.execSync)("df -BG / | tail -1", { encoding: "utf8" }).trim();
    const parts = raw.split(/\s+/);
    diskFreeGb = parseInt(parts[3]?.replace("G", "") ?? "0", 10);
  } catch {
  }
  return { uptimeSec, load1, memFreeMb, diskFreeGb };
}

// packages/runtime-agent/src/heartbeat.ts
async function sendHeartbeat() {
  const [checks, metrics] = await Promise.all([
    runHealthChecks(),
    Promise.resolve(collectMetrics())
  ]);
  const payload = {
    instanceId: config.instanceId,
    orgId: config.orgId,
    authToken: config.runtimeAuthToken,
    checks,
    metrics,
    version: {
      agent: config.agentVersion,
      openclawImage: config.openclawImage
    }
  };
  const url = `${config.controlPlaneBaseUrl}/api/runtime/heartbeat`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[heartbeat] HTTP ${res.status}: ${text}`);
    } else {
      console.log(
        `[heartbeat] ok \u2014 openclaw:${checks.openclaw.ok} cloudflared:${checks.cloudflared.ok}`
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[heartbeat] failed: ${msg}`);
  }
}
function startHeartbeatLoop() {
  sendHeartbeat().catch(() => null);
  setInterval(() => {
    sendHeartbeat().catch(() => null);
  }, config.heartbeatIntervalSec * 1e3);
  console.log(`[heartbeat] loop started \u2014 interval ${config.heartbeatIntervalSec}s`);
}

// packages/runtime-agent/src/commands.ts
var import_child_process2 = require("child_process");
var COMMAND_HANDLERS = {
  restart_openclaw() {
    (0, import_child_process2.execSync)("systemctl restart openclaw", { timeout: 3e4, stdio: "pipe" });
    return "openclaw restarted";
  },
  restart_cloudflared() {
    (0, import_child_process2.execSync)("systemctl restart cloudflared", { timeout: 3e4, stdio: "pipe" });
    return "cloudflared restarted";
  },
  rebootstrap() {
    (0, import_child_process2.execSync)("bash /opt/tulip/bootstrap.sh >> /var/log/tulip-bootstrap.log 2>&1", {
      timeout: 12e4,
      stdio: "pipe"
    });
    return "rebootstrap complete";
  }
};
var ALLOWED_COMMANDS = new Set(
  Object.keys(COMMAND_HANDLERS)
);
async function pollCommands() {
  const url = `${config.controlPlaneBaseUrl}/api/runtime/commands?instanceId=${encodeURIComponent(config.instanceId)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.runtimeAuthToken}`
    },
    signal: AbortSignal.timeout(8e3)
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.commands ?? [];
}
async function reportResult(payload) {
  const delays = [0, 3e3, 8e3];
  for (const delay of delays) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    try {
      const res = await fetch(`${config.controlPlaneBaseUrl}/api/runtime/commandResult`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8e3)
      });
      if (res.ok) return;
      console.error(`[commands] reportResult HTTP ${res.status}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[commands] reportResult attempt failed: ${msg}`);
    }
  }
  console.error(`[commands] reportResult gave up for command ${payload.commandId}`);
}
async function executeCommand(cmd) {
  if (!ALLOWED_COMMANDS.has(cmd.type)) {
    console.warn(`[commands] refusing unknown command type: ${cmd.type}`);
    await reportResult({
      commandId: cmd.id,
      instanceId: config.instanceId,
      authToken: config.runtimeAuthToken,
      status: "error",
      error: `Command type not allowed: ${cmd.type}`
    });
    return;
  }
  console.log(`[commands] executing: ${cmd.type} (${cmd.id})`);
  try {
    const handler = COMMAND_HANDLERS[cmd.type];
    const result = handler();
    console.log(`[commands] done: ${cmd.type} \u2014 ${result}`);
    await reportResult({
      commandId: cmd.id,
      instanceId: config.instanceId,
      authToken: config.runtimeAuthToken,
      status: "done",
      result
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[commands] error: ${cmd.type} \u2014 ${error}`);
    await reportResult({
      commandId: cmd.id,
      instanceId: config.instanceId,
      authToken: config.runtimeAuthToken,
      status: "error",
      error
    });
  }
}
var polling = false;
async function doPoll() {
  if (polling) return;
  polling = true;
  try {
    const commands = await pollCommands();
    for (const cmd of commands) {
      await executeCommand(cmd);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[commands] poll error: ${msg}`);
  } finally {
    polling = false;
  }
}
function startCommandLoop() {
  setInterval(() => {
    doPoll().catch(() => null);
  }, config.commandPollIntervalSec * 1e3);
  console.log(`[commands] loop started \u2014 interval ${config.commandPollIntervalSec}s`);
}

// packages/runtime-agent/src/index.ts
function main() {
  console.log(`[agent] Tulip Runtime Agent v${config.agentVersion} starting`);
  console.log(`[agent] instance: ${config.instanceId}`);
  console.log(`[agent] org:      ${config.orgId}`);
  console.log(`[agent] plane:    ${config.controlPlaneBaseUrl}`);
  startHeartbeatLoop();
  startCommandLoop();
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
  });
  console.log("[agent] ready");
}
main();
