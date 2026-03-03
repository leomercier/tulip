import { onRequest } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type {
  BootstrapRequest,
  BootstrapResponse,
  HeartbeatPayload,
  CommandResultPayload,
  CommandType,
} from "@tulip/types";
import { renderCloudInit } from "@tulip/cloud-init";
import { createDroplet, deleteDroplet } from "../services/digitalocean";
import { createTunnel, deleteTunnel } from "../services/cloudflare";
import { decryptToken, generateToken } from "../services/crypto";
import {
  getRuntimeDoc,
  setRuntimeDoc,
  updateRuntimeDoc,
  deleteRuntimeDoc,
  setRuntimeMeta,
  findOrgByInstanceId,
  enqueueCommand,
  getQueuedCommands,
  resolveCommand,
  listCommands,
} from "../db/runtime";
import { getOrg, getOrgByOwner, getSlackIntegration, getInferenceConfig } from "../db/orgs";

const APP_URL = process.env.CONTROL_PLANE_BASE_URL ?? "https://agents.tulip.ai";
const OPENCLAW_IMAGE = process.env.OPENCLAW_IMAGE ?? "ghcr.io/tulipai/openclaw:latest";
const RUNTIME_BASE_DOMAIN = process.env.RUNTIME_BASE_DOMAIN ?? "agents.tulip.ai";
const DO_REGION = process.env.DO_REGION ?? "lon1";

// ─── helpers ─────────────────────────────────────────────────────────────────

function json(res: import("express").Response, status: number, body: unknown) {
  res.status(status).json(body);
}

async function verifyFirebaseToken(
  req: import("express").Request
): Promise<string | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const decoded = await getAuth().verifyIdToken(header.slice(7));
    return decoded.uid;
  } catch {
    return null;
  }
}

function validateRuntimeAuth(
  req: import("express").Request,
  runtimeAuthToken: string
): boolean {
  const header = req.headers.authorization;
  return header === `Bearer ${runtimeAuthToken}`;
}

function generateInstanceId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const short = Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
  return `tulip-${short}`;
}

// ─── POST /bootstrap ──────────────────────────────────────────────────────────

export const bootstrap = onRequest(async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const body = req.body as Partial<BootstrapRequest>;
  const { bootstrapToken, orgId, instanceId, dropletMeta } = body;

  if (!bootstrapToken || !orgId || !instanceId) {
    return json(res, 400, { error: "Missing required fields" });
  }

  const runtime = await getRuntimeDoc(orgId);
  if (!runtime || runtime.instanceId !== instanceId) {
    return json(res, 404, { error: "Instance not found" });
  }

  // Validate bootstrap token
  const db = getFirestore();
  const tokenDoc = await db.doc(`orgs/${orgId}/runtime/current`).get();
  const storedToken = tokenDoc.data()?.bootstrapToken;
  const expiresAt = tokenDoc.data()?.bootstrapTokenExpiresAt;

  if (storedToken !== bootstrapToken) {
    return json(res, 401, { error: "Invalid bootstrap token" });
  }
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    return json(res, 401, { error: "Bootstrap token expired" });
  }

  // Fetch dependencies
  const [slack, inference] = await Promise.all([
    getSlackIntegration(orgId),
    getInferenceConfig(orgId),
  ]);

  if (!slack) return json(res, 400, { error: "Slack not connected" });

  const slackBotToken = decryptToken(slack.botTokenEncrypted);

  // Create Cloudflare tunnel
  const tunnel = await createTunnel(instanceId);
  const runtimeAuthToken = generateToken(32);
  const hostname = `${instanceId}.${RUNTIME_BASE_DOMAIN}`;

  // Store tunnel info and clear bootstrap token (one-time use)
  await Promise.all([
    db.doc(`orgs/${orgId}/cloudflare/tunnel`).set({
      tunnelId: tunnel.id,
      tunnelToken: tunnel.token,
      instanceId,
    }),
    db.doc(`orgs/${orgId}/runtime/current`).update({
      bootstrapToken: FieldValue.delete(),
      bootstrapTokenExpiresAt: FieldValue.delete(),
      status: "booting",
      hostname,
      runtimeAuthToken,
    }),
  ]);

  // Update region from actual droplet metadata
  if (dropletMeta?.region) {
    await updateRuntimeDoc(orgId, { region: dropletMeta.region });
  }

  const response: BootstrapResponse = {
    instanceId,
    hostname,
    runtimeAuthToken,
    cloudflare: { tunnelToken: tunnel.token },
    openclaw: {
      image: OPENCLAW_IMAGE,
      env: {
        SLACK_BOT_TOKEN: slackBotToken,
        INSTANCE_ID: instanceId,
        ORG_ID: orgId,
        MODEL_ID: inference.modelId,
        SYSTEM_PROMPT: inference.systemPrompt,
      },
    },
    inference,
  };

  return json(res, 200, response);
});

// ─── POST /runtime/heartbeat ──────────────────────────────────────────────────

export const heartbeat = onRequest(async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const body = req.body as Partial<HeartbeatPayload>;
  const { instanceId, orgId, authToken, checks, metrics, version } = body;

  if (!instanceId || !orgId || !authToken) {
    return json(res, 400, { error: "Missing required fields" });
  }

  const runtime = await getRuntimeDoc(orgId);
  if (!runtime || runtime.instanceId !== instanceId) {
    return json(res, 404, { error: "Instance not found" });
  }

  // Validate runtime auth token
  const db = getFirestore();
  const rtData = (await db.doc(`orgs/${orgId}/runtime/current`).get()).data();
  if (rtData?.runtimeAuthToken !== authToken) {
    return json(res, 401, { error: "Invalid auth token" });
  }

  const update: Partial<import("@tulip/types").Runtime> & Record<string, unknown> = {
    lastHeartbeatAt: FieldValue.serverTimestamp() as unknown as string,
    openclawHealthy: checks?.openclaw?.ok ?? null,
    cloudflaredHealthy: checks?.cloudflared?.ok ?? null,
  };

  // Transition to ready on first healthy heartbeat after booting
  if (runtime.status === "booting" && checks?.openclaw?.ok && checks?.cloudflared?.ok) {
    update.status = "ready";
  }

  await updateRuntimeDoc(orgId, update);

  // Update agent/openclaw version in instance metadata
  if (version) {
    await setRuntimeMeta({
      instanceId,
      orgId,
      dropletId: runtime.dropletId,
      region: runtime.region,
      agentVersion: version.agent ?? null,
      openclawImage: version.openclawImage ?? null,
    });
  }

  return json(res, 200, { ok: true });
});

// ─── GET /runtime/status ─────────────────────────────────────────────────────

export const status = onRequest(async (req, res) => {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  const uid = await verifyFirebaseToken(req);
  if (!uid) return json(res, 401, { error: "Unauthorized" });

  const org = await getOrgByOwner(uid);
  if (!org) return json(res, 200, { orgId: null, runtime: null });

  const runtime = await getRuntimeDoc(org.id);
  return json(res, 200, { orgId: org.id, runtime });
});

// ─── POST /runtime/provision ─────────────────────────────────────────────────

export const provision = onRequest(async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const uid = await verifyFirebaseToken(req);
  if (!uid) return json(res, 401, { error: "Unauthorized" });

  const org = await getOrgByOwner(uid);
  if (!org) return json(res, 404, { error: "No org found" });

  const slack = await getSlackIntegration(org.id);
  if (!slack) {
    return json(res, 400, { error: "Connect Slack before provisioning" });
  }

  const existing = await getRuntimeDoc(org.id);
  if (existing && existing.status !== "error") {
    return json(res, 409, { error: "Runtime already exists" });
  }

  const instanceId = generateInstanceId();
  const bootstrapToken = generateToken(32);
  const subdomain = `${instanceId}.${RUNTIME_BASE_DOMAIN}`;

  // Write provisioning record
  await setRuntimeDoc(org.id, {
    instanceId,
    dropletId: 0, // updated after DO responds
    hostname: subdomain,
    region: DO_REGION,
    status: "provisioning",
    subdomain,
    lastHeartbeatAt: null,
    openclawHealthy: null,
    cloudflaredHealthy: null,
    lastError: null,
  });

  // Store bootstrap token with expiry
  await getFirestore().doc(`orgs/${org.id}/runtime/current`).update({
    bootstrapToken,
    bootstrapTokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  // Render cloud-init
  const userData = renderCloudInit({
    CONTROL_PLANE_BASE_URL: APP_URL,
    BOOTSTRAP_TOKEN: bootstrapToken,
    ORG_ID: org.id,
    INSTANCE_ID: instanceId,
    OPENCLAW_IMAGE,
  });

  // Create droplet
  let droplet;
  try {
    droplet = await createDroplet({
      name: `tulip-${org.id.slice(0, 8)}-${instanceId}`,
      orgId: org.id,
      instanceId,
      region: DO_REGION,
      userData,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Droplet creation failed";
    await updateRuntimeDoc(org.id, { status: "error", lastError: msg });
    return json(res, 502, { error: msg });
  }

  await updateRuntimeDoc(org.id, {
    dropletId: droplet.id,
    status: "booting",
  });

  // Write instance-level metadata
  await setRuntimeMeta({
    instanceId,
    orgId: org.id,
    dropletId: droplet.id,
    region: DO_REGION,
    agentVersion: null,
    openclawImage: OPENCLAW_IMAGE,
  });

  return json(res, 200, { instanceId, subdomain, status: "booting" });
});

// ─── POST /runtime/deprovision ────────────────────────────────────────────────

export const deprovision = onRequest(async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const uid = await verifyFirebaseToken(req);
  if (!uid) return json(res, 401, { error: "Unauthorized" });

  const org = await getOrgByOwner(uid);
  if (!org) return json(res, 404, { error: "No org found" });

  const runtime = await getRuntimeDoc(org.id);
  if (!runtime) return json(res, 404, { error: "No runtime to deprovision" });

  await updateRuntimeDoc(org.id, { status: "deleting" });

  // Delete droplet
  if (runtime.dropletId) {
    await deleteDroplet(runtime.dropletId).catch((err: unknown) =>
      console.error("Droplet delete error:", err)
    );
  }

  // Delete Cloudflare tunnel
  const db = getFirestore();
  const cfDoc = await db.doc(`orgs/${org.id}/cloudflare/tunnel`).get();
  if (cfDoc.exists) {
    const { tunnelId } = cfDoc.data()!;
    await deleteTunnel(tunnelId, runtime.instanceId).catch((err: unknown) =>
      console.error("Tunnel delete error:", err)
    );
    await cfDoc.ref.delete();
  }

  await deleteRuntimeDoc(org.id);

  return json(res, 200, { ok: true });
});

// ─── POST /runtime/command ────────────────────────────────────────────────────

export const command = onRequest(async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const uid = await verifyFirebaseToken(req);
  if (!uid) return json(res, 401, { error: "Unauthorized" });

  const org = await getOrgByOwner(uid);
  if (!org) return json(res, 404, { error: "No org found" });

  const runtime = await getRuntimeDoc(org.id);
  if (!runtime) return json(res, 404, { error: "No runtime" });

  const { type } = req.body as { type?: CommandType };
  const allowed: CommandType[] = ["restart_openclaw", "restart_cloudflared", "rebootstrap"];
  if (!type || !allowed.includes(type)) {
    return json(res, 400, { error: `Invalid command type. Allowed: ${allowed.join(", ")}` });
  }

  const commandId = await enqueueCommand(runtime.instanceId, type);
  return json(res, 200, { commandId });
});

// ─── GET /runtime/commands ────────────────────────────────────────────────────

export const commands = onRequest(async (req, res) => {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  const { instanceId } = req.query as { instanceId?: string };
  if (!instanceId) return json(res, 400, { error: "instanceId required" });

  // Validate agent auth
  const orgId = await findOrgByInstanceId(instanceId);
  if (!orgId) return json(res, 404, { error: "Instance not found" });

  const runtime = await getRuntimeDoc(orgId);
  const db = getFirestore();
  const rtData = (await db.doc(`orgs/${orgId}/runtime/current`).get()).data();

  if (!validateRuntimeAuth(req, rtData?.runtimeAuthToken ?? "")) {
    return json(res, 401, { error: "Unauthorized" });
  }

  const queued = await getQueuedCommands(instanceId);
  return json(res, 200, { commands: queued });
});

// ─── POST /runtime/commandResult ─────────────────────────────────────────────

export const commandResult = onRequest(async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const body = req.body as Partial<CommandResultPayload>;
  const { commandId, instanceId, authToken, status: cmdStatus, result, error } = body;

  if (!commandId || !instanceId || !authToken) {
    return json(res, 400, { error: "Missing required fields" });
  }

  const orgId = await findOrgByInstanceId(instanceId);
  if (!orgId) return json(res, 404, { error: "Instance not found" });

  const db = getFirestore();
  const rtData = (await db.doc(`orgs/${orgId}/runtime/current`).get()).data();
  if (rtData?.runtimeAuthToken !== authToken) {
    return json(res, 401, { error: "Unauthorized" });
  }

  await resolveCommand(instanceId, commandId, cmdStatus ?? "done", result, error);
  return json(res, 200, { ok: true });
});

// ─── GET /runtime/commandHistory (UI use) ─────────────────────────────────────

export const commandHistory = onRequest(async (req, res) => {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  const uid = await verifyFirebaseToken(req);
  if (!uid) return json(res, 401, { error: "Unauthorized" });

  const org = await getOrgByOwner(uid);
  if (!org) return json(res, 404, { error: "No org found" });

  const runtime = await getRuntimeDoc(org.id);
  if (!runtime) return json(res, 200, { commands: [] });

  const cmds = await listCommands(runtime.instanceId);
  return json(res, 200, { commands: cmds });
});
