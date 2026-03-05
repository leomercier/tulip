// ─── Org ──────────────────────────────────────────────────────────────────────

export interface Org {
  id: string;
  name: string;
  ownerUid: string;
  createdAt: string;
  status: OrgStatus;
  memberCount: number;
}

export type OrgStatus = "active" | "suspended";

// ─── Org Membership ───────────────────────────────────────────────────────────

export type OrgRole = "owner" | "admin" | "member";

/** Stored at orgs/{orgId}/members/{uid} */
export interface OrgMember {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: OrgRole;
  joinedAt: string;
}

// ─── Org Invite ───────────────────────────────────────────────────────────────

export type InviteStatus = "pending" | "accepted" | "expired" | "cancelled";

/**
 * Stored at orgInvites/{inviteId}.
 * email is null for open link invites (anyone with the link can accept).
 */
export interface OrgInvite {
  id: string;
  orgId: string;
  orgName: string;
  invitedByUid: string;
  invitedByName: string | null;
  /** null = open link invite */
  email: string | null;
  role: OrgRole;
  status: InviteStatus;
  createdAt: string;
  expiresAt: string;
  acceptedByUid: string | null;
  acceptedAt: string | null;
}

// ─── User Profile ─────────────────────────────────────────────────────────────

/** Stored at users/{uid} — created on first sign-in */
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  superAdmin: boolean;
  /** Org IDs this user is a member of */
  orgIds: string[];
  createdAt: string;
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export type BillingStatus = "active" | "suspended" | "grace";

/**
 * Stored at orgs/{orgId}/billing/account.
 * Credits are integer units: 1 credit = $0.01 USD.
 * e.g. 10000 credits = $100.
 */
export interface BillingAccount {
  orgId: string;
  credits: number;
  currencyCode: string;
  status: BillingStatus;
  createdAt: string;
  updatedAt: string;
  // stripeCustomerId: string | null;   // reserved for future Stripe integration
  // stripeSubscriptionId: string | null;
}

export type LedgerEntryType =
  | "credit_grant"    // admin manually adds credits
  | "credit_purchase" // future: Stripe checkout
  | "runtime_usage"   // per-hour runtime charge
  | "api_usage"       // per-token AI inference charge
  | "adjustment";     // manual correction

/**
 * Stored at orgs/{orgId}/billing/ledger/entries/{entryId}.
 * Positive amount = credits added; negative = credits consumed.
 */
export interface LedgerEntry {
  id: string;
  orgId: string;
  type: LedgerEntryType;
  /** Positive = credit in, negative = debit out */
  amount: number;
  /** Running balance after this entry */
  balanceAfter: number;
  description: string;
  createdAt: string;
  /** null for automated/system entries */
  createdByUid: string | null;
  metadata: Record<string, unknown>;
}

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
  ipv4: string | null;
  status: RuntimeStatus;
  subdomain: string;
  createdAt: string;
  lastHeartbeatAt: string | null;
  openclawHealthy: boolean | null;
  cloudflaredHealthy: boolean | null;
  openclawLatencyMs: number | null;
  lastError: string | null;
  agentVersion: string | null;
  openclawImage: string | null;
  metrics: {
    uptimeSec: number;
    load1: number;
    memFreeMb: number;
    diskFreeGb: number;
  } | null;
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
  /** Optional API key for the inference provider (e.g. Fireworks) */
  apiKey?: string;
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
    /** JSON string for /root/.openclaw/openclaw.json inside the container */
    config?: string;
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
  /** 32-byte hex token used to authenticate with the OpenClaw gateway */
  OPENCLAW_GATEWAY_TOKEN: string;
}
