import {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  Timestamp,
} from "firebase/firestore";
import type { Org, Runtime, SlackIntegration, InferenceConfig, RuntimeCommand } from "@tulip/types";

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
      status: d.status,
      subdomain: d.subdomain ?? "",
      createdAt: fromTs(d.createdAt),
      // Support both old (lastHeartbeat) and new (lastHeartbeatAt) field names
      lastHeartbeatAt: fromTsOrNull(d.lastHeartbeatAt ?? d.lastHeartbeat ?? null),
      openclawHealthy: d.openclawHealthy ?? null,
      cloudflaredHealthy: d.cloudflaredHealthy ?? null,
      lastError: d.lastError ?? null,
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
