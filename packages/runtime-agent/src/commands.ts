import { execSync } from "child_process";
import type { CommandType, CommandResultPayload } from "@tulip/types";
import { config } from "./config";

// ─── Allowlist ────────────────────────────────────────────────────────────────

const COMMAND_HANDLERS: Record<CommandType, () => string> = {
  restart_openclaw() {
    execSync("systemctl restart openclaw", { timeout: 30_000, stdio: "pipe" });
    return "openclaw restarted";
  },
  restart_cloudflared() {
    execSync("systemctl restart cloudflared", { timeout: 30_000, stdio: "pipe" });
    return "cloudflared restarted";
  },
  rebootstrap() {
    // Re-run bootstrap script — useful for token rotation
    execSync("bash /opt/tulip/bootstrap.sh >> /var/log/tulip-bootstrap.log 2>&1", {
      timeout: 120_000,
      stdio: "pipe",
    });
    return "rebootstrap complete";
  },
};

const ALLOWED_COMMANDS = new Set<CommandType>(
  Object.keys(COMMAND_HANDLERS) as CommandType[]
);

// ─── Poll + execute ───────────────────────────────────────────────────────────

interface QueuedCommand {
  id: string;
  type: CommandType;
}

async function pollCommands(): Promise<QueuedCommand[]> {
  const url = `${config.controlPlaneBaseUrl}/api/runtime/commands?instanceId=${encodeURIComponent(config.instanceId)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.runtimeAuthToken}`,
    },
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) return [];

  const data = (await res.json()) as { commands: QueuedCommand[] };
  return data.commands ?? [];
}

async function reportResult(payload: CommandResultPayload): Promise<void> {
  // Retry up to 3 times — a failed report would leave the command stuck in "running"
  const delays = [0, 3000, 8000];
  for (const delay of delays) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    try {
      const res = await fetch(`${config.controlPlaneBaseUrl}/api/runtime/commandResult`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) return;
      console.error(`[commands] reportResult HTTP ${res.status}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[commands] reportResult attempt failed: ${msg}`);
    }
  }
  console.error(`[commands] reportResult gave up for command ${payload.commandId}`);
}

async function executeCommand(cmd: QueuedCommand): Promise<void> {
  if (!ALLOWED_COMMANDS.has(cmd.type)) {
    console.warn(`[commands] refusing unknown command type: ${cmd.type}`);
    await reportResult({
      commandId: cmd.id,
      instanceId: config.instanceId,
      authToken: config.runtimeAuthToken,
      status: "error",
      error: `Command type not allowed: ${cmd.type}`,
    });
    return;
  }

  console.log(`[commands] executing: ${cmd.type} (${cmd.id})`);

  try {
    const handler = COMMAND_HANDLERS[cmd.type];
    const result = handler();
    console.log(`[commands] done: ${cmd.type} — ${result}`);
    await reportResult({
      commandId: cmd.id,
      instanceId: config.instanceId,
      authToken: config.runtimeAuthToken,
      status: "done",
      result,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[commands] error: ${cmd.type} — ${error}`);
    await reportResult({
      commandId: cmd.id,
      instanceId: config.instanceId,
      authToken: config.runtimeAuthToken,
      status: "error",
      error,
    });
  }
}

// ─── Loop ─────────────────────────────────────────────────────────────────────

let polling = false;

async function doPoll(): Promise<void> {
  if (polling) return; // prevent overlap
  polling = true;
  try {
    const commands = await pollCommands();
    for (const cmd of commands) {
      await executeCommand(cmd);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[commands] poll error: ${msg}`);
  } finally {
    polling = false;
  }
}

export function startCommandLoop(): void {
  setInterval(() => {
    doPoll().catch(() => null);
  }, config.commandPollIntervalSec * 1000);

  console.log(`[commands] loop started — interval ${config.commandPollIntervalSec}s`);
}
