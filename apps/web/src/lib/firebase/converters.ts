import {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  Timestamp,
} from "firebase/firestore";
import type { Org, Runtime, SlackIntegration, InferenceConfig } from "@tulip/types";

function fromTimestamp(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

export const orgConverter: FirestoreDataConverter<Org> = {
  toFirestore(org: Org): DocumentData {
    return {
      name: org.name,
      ownerUid: org.ownerUid,
      createdAt: org.createdAt,
      status: org.status,
    };
  },
  fromFirestore(snap: QueryDocumentSnapshot, opts?: SnapshotOptions): Org {
    const data = snap.data(opts);
    return {
      id: snap.id,
      name: data.name,
      ownerUid: data.ownerUid,
      createdAt: fromTimestamp(data.createdAt),
      status: data.status ?? "active",
    };
  },
};

export const runtimeConverter: FirestoreDataConverter<Runtime> = {
  toFirestore(rt: Runtime): DocumentData {
    return { ...rt };
  },
  fromFirestore(snap: QueryDocumentSnapshot, opts?: SnapshotOptions): Runtime {
    const data = snap.data(opts);
    return {
      instanceId: data.instanceId,
      dropletId: data.dropletId,
      region: data.region,
      status: data.status,
      subdomain: data.subdomain,
      createdAt: fromTimestamp(data.createdAt),
      lastHeartbeat: data.lastHeartbeat
        ? fromTimestamp(data.lastHeartbeat)
        : null,
    };
  },
};

export const slackConverter: FirestoreDataConverter<SlackIntegration> = {
  toFirestore(s: SlackIntegration): DocumentData {
    return { ...s };
  },
  fromFirestore(
    snap: QueryDocumentSnapshot,
    opts?: SnapshotOptions
  ): SlackIntegration {
    const data = snap.data(opts);
    return {
      teamId: data.teamId,
      teamName: data.teamName ?? "",
      botTokenEncrypted: data.botTokenEncrypted,
      installedAt: fromTimestamp(data.installedAt),
    };
  },
};

export const inferenceConverter: FirestoreDataConverter<InferenceConfig> = {
  toFirestore(c: InferenceConfig): DocumentData {
    return { ...c };
  },
  fromFirestore(
    snap: QueryDocumentSnapshot,
    opts?: SnapshotOptions
  ): InferenceConfig {
    const data = snap.data(opts);
    return {
      modelProvider: data.modelProvider ?? "anthropic",
      modelId: data.modelId ?? "claude-sonnet-4-6",
      systemPrompt: data.systemPrompt ?? "",
      timeoutMs: data.timeoutMs ?? 30000,
      allowedTools: data.allowedTools ?? [],
    };
  },
};
