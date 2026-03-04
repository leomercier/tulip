import {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  Timestamp,
} from "firebase/firestore";
import type {
  Org,
  Runtime,
  SlackIntegration,
  InferenceConfig,
  RuntimeCommand,
  OrgMember,
  OrgInvite,
  UserProfile,
  BillingAccount,
  LedgerEntry,
} from "@tulip/types";

function fromTs(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function fromTsOrNull(value: unknown): string | null {
  if (!value) return null;
  return fromTs(value);
}

export const orgConverter: FirestoreDataConverter<Org> = {
  toFirestore(org: Org): DocumentData {
    return { name: org.name, ownerUid: org.ownerUid, createdAt: org.createdAt, status: org.status };
  },
  fromFirestore(snap: QueryDocumentSnapshot, opts?: SnapshotOptions): Org {
    const d = snap.data(opts);
    return {
      id: snap.id,
      name: d.name,
      ownerUid: d.ownerUid,
      createdAt: fromTs(d.createdAt),
      status: d.status ?? "active",
      memberCount: d.memberCount ?? 1,
    };
  },
};

export const orgMemberConverter: FirestoreDataConverter<OrgMember> = {
  toFirestore(m: OrgMember): DocumentData {
    return { ...m };
  },
  fromFirestore(snap: QueryDocumentSnapshot, opts?: SnapshotOptions): OrgMember {
    const d = snap.data(opts);
    return {
      uid: d.uid ?? snap.id,
      email: d.email ?? "",
      displayName: d.displayName ?? null,
      photoURL: d.photoURL ?? null,
      role: d.role ?? "member",
      joinedAt: fromTs(d.joinedAt),
    };
  },
};

export const orgInviteConverter: FirestoreDataConverter<OrgInvite> = {
  toFirestore(inv: OrgInvite): DocumentData {
    return { ...inv };
  },
  fromFirestore(snap: QueryDocumentSnapshot, opts?: SnapshotOptions): OrgInvite {
    const d = snap.data(opts);
    return {
      id: snap.id,
      orgId: d.orgId,
      orgName: d.orgName ?? "",
      invitedByUid: d.invitedByUid,
      invitedByName: d.invitedByName ?? null,
      email: d.email ?? null,
      role: d.role ?? "member",
      status: d.status ?? "pending",
      createdAt: fromTs(d.createdAt),
      expiresAt: fromTs(d.expiresAt),
      acceptedByUid: d.acceptedByUid ?? null,
      acceptedAt: fromTsOrNull(d.acceptedAt),
    };
  },
};

export const userProfileConverter: FirestoreDataConverter<UserProfile> = {
  toFirestore(p: UserProfile): DocumentData {
    return { ...p };
  },
  fromFirestore(snap: QueryDocumentSnapshot, opts?: SnapshotOptions): UserProfile {
    const d = snap.data(opts);
    return {
      uid: snap.id,
      email: d.email ?? "",
      displayName: d.displayName ?? null,
      photoURL: d.photoURL ?? null,
      superAdmin: d.superAdmin ?? false,
      orgIds: d.orgIds ?? [],
      createdAt: fromTs(d.createdAt),
    };
  },
};

export const billingAccountConverter: FirestoreDataConverter<BillingAccount> = {
  toFirestore(b: BillingAccount): DocumentData {
    return { ...b };
  },
  fromFirestore(snap: QueryDocumentSnapshot, opts?: SnapshotOptions): BillingAccount {
    const d = snap.data(opts);
    return {
      orgId: d.orgId ?? snap.ref.parent.parent?.id ?? "",
      credits: d.credits ?? 0,
      currencyCode: d.currencyCode ?? "USD",
      status: d.status ?? "active",
      createdAt: fromTs(d.createdAt),
      updatedAt: fromTs(d.updatedAt),
    };
  },
};

export const ledgerEntryConverter: FirestoreDataConverter<LedgerEntry> = {
  toFirestore(e: LedgerEntry): DocumentData {
    return { ...e };
  },
  fromFirestore(snap: QueryDocumentSnapshot, opts?: SnapshotOptions): LedgerEntry {
    const d = snap.data(opts);
    return {
      id: snap.id,
      orgId: d.orgId ?? "",
      type: d.type,
      amount: d.amount ?? 0,
      balanceAfter: d.balanceAfter ?? 0,
      description: d.description ?? "",
      createdAt: fromTs(d.createdAt),
      createdByUid: d.createdByUid ?? null,
      metadata: d.metadata ?? {},
    };
  },
};

export const runtimeConverter: FirestoreDataConverter<Runtime> = {
  toFirestore(rt: Runtime): DocumentData {
    return { ...rt };
  },
  fromFirestore(snap: QueryDocumentSnapshot, opts?: SnapshotOptions): Runtime {
    const d = snap.data(opts);
    return {
      instanceId: d.instanceId,
      dropletId: d.dropletId ?? 0,
      hostname: d.hostname ?? d.subdomain ?? "",
      region: d.region ?? "",
      ipv4: d.ipv4 ?? null,
      status: d.status,
      subdomain: d.subdomain ?? "",
      createdAt: fromTs(d.createdAt),
      agentConnectedAt: fromTsOrNull(d.agentConnectedAt ?? null),
      // Support both old (lastHeartbeat) and new (lastHeartbeatAt) field names
      lastHeartbeatAt: fromTsOrNull(d.lastHeartbeatAt ?? d.lastHeartbeat ?? null),
      openclawHealthy: d.openclawHealthy ?? null,
      cloudflaredHealthy: d.cloudflaredHealthy ?? null,
      lastError: d.lastError ?? null,
      metrics: d.metrics ?? null,
    };
  },
};

export const slackConverter: FirestoreDataConverter<SlackIntegration> = {
  toFirestore(s: SlackIntegration): DocumentData {
    return { ...s };
  },
  fromFirestore(snap: QueryDocumentSnapshot, opts?: SnapshotOptions): SlackIntegration {
    const d = snap.data(opts);
    return {
      teamId: d.teamId,
      teamName: d.teamName ?? "",
      botTokenEncrypted: d.botTokenEncrypted,
      installedAt: fromTs(d.installedAt),
    };
  },
};

export const inferenceConverter: FirestoreDataConverter<InferenceConfig> = {
  toFirestore(c: InferenceConfig): DocumentData {
    return { ...c };
  },
  fromFirestore(snap: QueryDocumentSnapshot, opts?: SnapshotOptions): InferenceConfig {
    const d = snap.data(opts);
    return {
      modelProvider: d.modelProvider ?? "anthropic",
      modelId: d.modelId ?? "claude-sonnet-4-6",
      systemPrompt: d.systemPrompt ?? "",
      timeoutMs: d.timeoutMs ?? 30000,
      allowedTools: d.allowedTools ?? [],
    };
  },
};

export const commandConverter: FirestoreDataConverter<RuntimeCommand> = {
  toFirestore(c: RuntimeCommand): DocumentData {
    return { ...c };
  },
  fromFirestore(snap: QueryDocumentSnapshot, opts?: SnapshotOptions): RuntimeCommand {
    const d = snap.data(opts);
    return {
      id: snap.id,
      type: d.type,
      status: d.status,
      createdAt: fromTs(d.createdAt),
      startedAt: fromTsOrNull(d.startedAt),
      completedAt: fromTsOrNull(d.completedAt),
      result: d.result ?? null,
      error: d.error ?? null,
    };
  },
};
