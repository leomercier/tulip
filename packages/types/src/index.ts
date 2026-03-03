// ─── Org ──────────────────────────────────────────────────────────────────────

export interface Org {
  id: string;
  name: string;
  ownerUid: string;
  createdAt: string; // ISO timestamp
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

export interface Runtime {
  instanceId: string;
  dropletId: number;
  region: string;
  status: RuntimeStatus;
  subdomain: string; // e.g. tulip-abc123.agents.tulip.ai
  createdAt: string;
  lastHeartbeat: string | null;
}

// ─── Inference ────────────────────────────────────────────────────────────────

export interface InferenceConfig {
  modelProvider: string;
  modelId: string;
  systemPrompt: string;
  timeoutMs: number;
  allowedTools: string[];
}

// ─── API Payloads ─────────────────────────────────────────────────────────────

export interface ProvisionRequest {
  orgId: string;
}

export interface DeprovisionRequest {
  orgId: string;
}

export interface BootstrapRequest {
  orgId: string;
  instanceId: string;
  bootstrapToken: string;
}

export interface BootstrapResponse {
  instanceId: string;
  slackBotToken: string;
  inference: InferenceConfig;
  cloudflareTunnelToken: string;
}

export interface RuntimeStatusResponse {
  orgId: string;
  runtime: Runtime | null;
}
