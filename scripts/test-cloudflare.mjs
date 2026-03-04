#!/usr/bin/env node
/**
 * Cloudflare tunnel + DNS diagnostic script.
 *
 * Reads env vars from apps/web/.env.local (or process.env).
 * Run: node scripts/test-cloudflare.mjs [--create] [--cleanup]
 *
 *   --create   Actually create a test tunnel + CNAME, then delete them
 *   --cleanup  Delete a named test tunnel if it already exists
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── Load .env.local ───────────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(__dir, "../apps/web/.env.local");

try {
  const lines = readFileSync(envFile, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
  console.log(`Loaded env from ${envFile}\n`);
} catch {
  console.log("No .env.local found — using process.env only\n");
}

// ── Config ────────────────────────────────────────────────────────────────────

const CF_API_BASE = "https://api.cloudflare.com/client/v4";
const token = process.env.CF_API_TOKEN;
const accountId = process.env.CF_ACCOUNT_ID;
const zoneId = process.env.CF_ZONE_ID;
const hostnameZone = process.env.CF_TUNNEL_HOSTNAME_ZONE ?? "tulip.md";

const CREATE = process.argv.includes("--create");
const CLEANUP = process.argv.includes("--cleanup");
const TEST_TUNNEL_NAME = "tulip-cf-test-probe";

let passed = 0;
let failed = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(label, detail = "") {
  passed++;
  console.log(`  ✓  ${label}${detail ? `  (${detail})` : ""}`);
}

function fail(label, err) {
  failed++;
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`  ✗  ${label}`);
  console.log(`       ${msg}`);
}

async function cfRequest(path, method = "GET", body) {
  const res = await fetch(`${CF_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!data.success) {
    const errs = JSON.stringify(data.errors);
    throw new Error(`Cloudflare API error: ${errs}  [HTTP ${res.status}]`);
  }
  return data.result;
}

// ── Step 1: Env vars ──────────────────────────────────────────────────────────

console.log("=== Step 1: Environment variables ===");
const required = { CF_API_TOKEN: token, CF_ACCOUNT_ID: accountId, CF_ZONE_ID: zoneId };
for (const [k, v] of Object.entries(required)) {
  if (v) ok(k, v.slice(0, 6) + "…");
  else    fail(k, `${k} is not set`);
}
console.log();

if (!token) {
  console.error("CF_API_TOKEN missing — cannot continue.");
  process.exit(1);
}

// ── Step 2: Token verification ────────────────────────────────────────────────

console.log("=== Step 2: Token identity ===");
try {
  const me = await cfRequest(`/accounts/${accountId}/tokens/verify`);
  ok("Token is valid", `status=${me.status}`);
} catch (err) {
  fail("Token verify failed", err);
  console.error("\nToken invalid — cannot continue.");
  process.exit(1);
}
console.log();

// ── Step 3: List tokens/permissions ──────────────────────────────────────────

console.log("=== Step 3: Token permission details ===");
try {
  // /user/tokens lists all tokens; we can't inspect ours directly via API,
  // but we can infer by attempting read-only calls.
  ok("(Permissions inferred from API calls below)");
} catch {
  // no-op
}
console.log();

// ── Step 4: Account-level — list tunnels ─────────────────────────────────────

console.log("=== Step 4: Account-level — list tunnels ===");
if (!accountId) {
  fail("List tunnels", "CF_ACCOUNT_ID not set — skipping");
} else {
  try {
    const tunnels = await cfRequest(`/accounts/${accountId}/cfd_tunnel?per_page=5`);
    ok("List tunnels", `found ${Array.isArray(tunnels) ? tunnels.length : "?"} (showing up to 5)`);
  } catch (err) {
    fail("List tunnels  ← needs Account > Cloudflare Tunnel: Read", err);
  }
}
console.log();

// ── Step 5: Zone-level — list DNS records ────────────────────────────────────

console.log("=== Step 5: Zone-level — list DNS records ===");
if (!zoneId) {
  fail("List DNS records", "CF_ZONE_ID not set — skipping");
} else {
  try {
    const records = await cfRequest(`/zones/${zoneId}/dns_records?per_page=1`);
    ok("List DNS records", `zone ${zoneId.slice(0, 8)}… accessible`);
  } catch (err) {
    fail("List DNS records  ← needs Zone > DNS: Read", err);
  }
}
console.log();

// ── Step 6: Zone details ──────────────────────────────────────────────────────

console.log("=== Step 6: Zone details ===");
if (!zoneId) {
  fail("Zone details", "CF_ZONE_ID not set — skipping");
} else {
  try {
    const zone = await cfRequest(`/zones/${zoneId}`);
    ok("Zone accessible", `name=${zone.name}  status=${zone.status}`);
    if (zone.name !== hostnameZone) {
      console.log(`       ⚠  Zone name "${zone.name}" does not match CF_TUNNEL_HOSTNAME_ZONE="${hostnameZone}"`);
      console.log(`          Subdomains like test.${hostnameZone} won't be in this zone.`);
    }
  } catch (err) {
    fail("Zone lookup", err);
  }
}
console.log();

// ── Step 7: Optional live create + delete ─────────────────────────────────────

if (CREATE || CLEANUP) {
  console.log("=== Step 7: Create test tunnel + CNAME ===");

  if (!accountId) {
    fail("Create tunnel", "CF_ACCOUNT_ID not set");
  } else {
    let tunnelId = null;

    // Cleanup existing test tunnel first
    try {
      const existing = await cfRequest(
        `/accounts/${accountId}/cfd_tunnel?name=${TEST_TUNNEL_NAME}&per_page=5`
      );
      for (const t of existing ?? []) {
        console.log(`  → Deleting stale test tunnel ${t.id}…`);
        await cfRequest(`/accounts/${accountId}/cfd_tunnel/${t.id}/connections`, "DELETE").catch(() => null);
        await cfRequest(`/accounts/${accountId}/cfd_tunnel/${t.id}`, "DELETE").catch(() => null);
      }
      if ((existing ?? []).length) ok("Cleaned up stale test tunnels");
    } catch (err) {
      fail("List/clean stale tunnels", err);
    }

    if (CREATE) {
      // Create tunnel
      try {
        const tunnel = await cfRequest(
          `/accounts/${accountId}/cfd_tunnel`,
          "POST",
          { name: TEST_TUNNEL_NAME, config_src: "cloudflare" }
        );
        tunnelId = tunnel.id;
        ok("Create tunnel", `id=${tunnel.id}  token=${tunnel.token?.slice(0, 10)}…`);
      } catch (err) {
        fail("Create tunnel  ← needs Account > Cloudflare Tunnel: Edit", err);
      }

      // Configure ingress
      if (tunnelId) {
        const hostname = `cf-test-probe.${hostnameZone}`;
        try {
          await cfRequest(
            `/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
            "PUT",
            {
              config: {
                ingress: [
                  { hostname, service: "http://localhost:18791" },
                  { service: "http_status:404" },
                ],
              },
            }
          );
          ok("Configure tunnel ingress", `hostname=${hostname}`);
        } catch (err) {
          fail("Configure tunnel ingress", err);
        }

        // Create CNAME
        if (zoneId) {
          try {
            const rec = await cfRequest(`/zones/${zoneId}/dns_records`, "POST", {
              type: "CNAME",
              name: hostname,
              content: `${tunnelId}.cfargotunnel.com`,
              ttl: 1,
              proxied: true,
            });
            ok("Create CNAME DNS record", `id=${rec.id}  name=${rec.name}`);

            // Clean up CNAME
            await cfRequest(`/zones/${zoneId}/dns_records/${rec.id}`, "DELETE");
            ok("Delete CNAME DNS record (cleanup)");
          } catch (err) {
            fail("Create CNAME  ← needs Zone > DNS: Edit", err);
          }
        } else {
          console.log("  ⚠  CF_ZONE_ID not set — skipping CNAME test");
        }

        // Delete tunnel
        try {
          await cfRequest(`/accounts/${accountId}/cfd_tunnel/${tunnelId}/connections`, "DELETE").catch(() => null);
          await cfRequest(`/accounts/${accountId}/cfd_tunnel/${tunnelId}`, "DELETE");
          ok("Delete test tunnel (cleanup)");
        } catch (err) {
          fail("Delete test tunnel", err);
        }
      }
    }
  }

  console.log();
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log("=".repeat(45));
console.log(`  ${passed} passed  ${failed} failed`);
if (failed > 0) {
  console.log(`
Likely fix: your CF_API_TOKEN needs both:
  • Account > Cloudflare Tunnel: Edit   (for tunnel CRUD)
  • Zone > DNS: Edit                     (for CNAME records)

Make sure the token's Zone resource filter includes your
zone (${zoneId ?? "CF_ZONE_ID not set"}).

In Cloud Run, check that CF_API_TOKEN / CF_ZONE_ID are
set as env vars or secrets on the service.
`);
  process.exit(1);
}
console.log();
