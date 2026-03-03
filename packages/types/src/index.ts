// ─── Org ──────────────────────────────────────────────────────────────────────

export interface Org {
  id: string;
  name: string;
  ownerUid: string;
  createdAt: string;
  status: OrgStatus;
}

export type OrgStatus = "active" | "suspended";

// ─── Slack Integration ────────────────────────────────────────────────────────

export interface SlackIntegration {
  teamId: string;
  teamName: string;
  botTokenEncrypted: string;
  installedAt: string;
}

// ─── Runtime ──────────────────────────────────────────────────────────────────

export type RuntimeStatus =
  | "not_provisioned"
  | "provisioning"
  | "booting"
  | "ready"
  | "error"
  | "deleting";

/** Stored at orgs/{orgId}/runtime/current */
export interface Runtime {
  instanceId: string;
  dropletId: number;
  hostname: string;
  region: string;
  status: RuntimeStatus;
  subdomain: string;
  createdAt: string;
  lastHeartbeatAt: string | null;
  openclawHealthy: boolean | null;
  cloudflaredHealthy: boolean | null;
  lastError: string | null;
}

/** Stored at runtimes/{instanceId} — instance-scoped metadata */
export interface RuntimeMeta {
  instanceId: string;
  orgId: string;
  dropletId: number;
  region: string;
  createdAt: string;
  agentVersion: string | null;
  openclawImage: string | null;
}

// ─── Commands ─────────────────────────────────────────────────────────────────

export type CommandType =
  | "restart_openclaw"
  | "restart_cloudflared"
  | "rebootstrap";

export type CommandStatus = "queued" | "running" | "done" | "error";

/** Stored at runtimes/{instanceId}/commands/{commandId} */
export interface RuntimeCommand {
  id: string;
  type: CommandType;
  status: CommandStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  result: string | null;
  error: string | null;
}

// ─── Inference ────────────────────────────────────────────────────────────────

export interface InferenceConfig {
  modelProvider: string;
  modelId: string;
  systemPrompt: string;
  timeoutMs: number;
  allowedTools: string[];
}

// ─── Agent Heartbeat ──────────────────────────────────────────────────────────

export interface HeartbeatPayload {
  instanceId: string;
  orgId: string;
  authToken: string;
  checks: {
    openclaw: { ok: boolean; latencyMs?: number };
    cloudflared: { ok: boolean };
  };
  metrics: {
    uptimeSec: number;
    load1: number;
    memFreeMb: number;
    diskFreeGb?: number;
  };
  version: {
    agent: string;
    openclawImage: string;
  };
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

export interface BootstrapRequest {
  bootstrapToken: string;
  orgId: string;
  instanceId: string;
  dropletMeta: {
    region: string;
    ipv4: string;
  };
}

export interface BootstrapResponse {
  instanceId: string;
  hostname: string;
  runtimeAuthToken: string;
  cloudflare: {
    tunnelToken: string;
  };
  openclaw: {
    image: string;
    env: Record<string, string>;
  };
  inference: InferenceConfig;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export interface ProvisionRequest {
  orgId: string;
}

export interface DeprovisionRequest {
  orgId: string;
}

export interface RuntimeStatusResponse {
  orgId: string;
  runtime: Runtime | null;
}

export interface CommandRequest {
  instanceId: string;
  type: CommandType;
}

export interface CommandResultPayload {
  commandId: string;
  instanceId: string;
  authToken: string;
  status: "done" | "error";
  result?: string;
  error?: string;
}

// ─── Cloud-init rendering ─────────────────────────────────────────────────────

export interface CloudInitVars {
  CONTROL_PLANE_BASE_URL: string;
  BOOTSTRAP_TOKEN: string;
  ORG_ID: string;
  INSTANCE_ID: string;
  OPENCLAW_IMAGE: string;
}
