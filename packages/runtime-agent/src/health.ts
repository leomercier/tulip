import { execSync } from "child_process";
import { config } from "./config";

export interface HealthChecks {
  openclaw: { ok: boolean; latencyMs?: number };
  cloudflared: { ok: boolean };
}

export interface Metrics {
  uptimeSec: number;
  load1: number;
  memFreeMb: number;
  diskFreeGb: number;
}

function isServiceActive(name: string): boolean {
  try {
    const out = execSync(`systemctl is-active ${name}`, {
      encoding: "utf8",
      timeout: 3000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out === "active";
  } catch {
    return false;
  }
}

async function httpGet(url: string, timeoutMs = 3000): Promise<{ ok: boolean; latencyMs: number }> {
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

export async function runHealthChecks(): Promise<HealthChecks> {
  const [openclawHttp] = await Promise.all([
    httpGet(config.openclawHealthUrl),
  ]);

  const cloudflaredActive = isServiceActive("cloudflared");

  return {
    openclaw: {
      ok: openclawHttp.ok,
      latencyMs: openclawHttp.latencyMs,
    },
    cloudflared: { ok: cloudflaredActive },
  };
}

export function collectMetrics(): Metrics {
  // /proc/uptime — first field is uptime in seconds
  let uptimeSec = 0;
  try {
    const raw = execSync("cat /proc/uptime", { encoding: "utf8" }).trim();
    uptimeSec = Math.floor(parseFloat(raw.split(" ")[0] ?? "0"));
  } catch {
    // ignore
  }

  // load average from /proc/loadavg
  let load1 = 0;
  try {
    const raw = execSync("cat /proc/loadavg", { encoding: "utf8" }).trim();
    load1 = parseFloat(raw.split(" ")[0] ?? "0");
  } catch {
    // ignore
  }

  // free memory from /proc/meminfo
  let memFreeMb = 0;
  try {
    const raw = execSync("grep MemAvailable /proc/meminfo", { encoding: "utf8" });
    const kb = parseInt(raw.match(/(\d+)/)?.[1] ?? "0", 10);
    memFreeMb = Math.floor(kb / 1024);
  } catch {
    // ignore
  }

  // disk free on root partition
  let diskFreeGb = 0;
  try {
    const raw = execSync("df -BG / | tail -1", { encoding: "utf8" }).trim();
    const parts = raw.split(/\s+/);
    diskFreeGb = parseInt(parts[3]?.replace("G", "") ?? "0", 10);
  } catch {
    // ignore
  }

  return { uptimeSec, load1, memFreeMb, diskFreeGb };
}
