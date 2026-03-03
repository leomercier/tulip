import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import type { Runtime, RuntimeMeta, RuntimeCommand, CommandStatus, RuntimeStatus } from "@tulip/types";

function db() {
  return getFirestore();
}

function fromTs(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

// ─── orgs/{orgId}/runtime/current ────────────────────────────────────────────

export async function getRuntimeDoc(orgId: string): Promise<Runtime | null> {
  const snap = await db().doc(`orgs/${orgId}/runtime/current`).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return {
    instanceId: d.instanceId,
    dropletId: d.dropletId,
    hostname: d.hostname ?? "",
    region: d.region ?? "",
    status: d.status,
    subdomain: d.subdomain ?? "",
    createdAt: fromTs(d.createdAt),
    lastHeartbeatAt: d.lastHeartbeatAt ? fromTs(d.lastHeartbeatAt) : null,
    openclawHealthy: d.openclawHealthy ?? null,
    cloudflaredHealthy: d.cloudflaredHealthy ?? null,
    lastError: d.lastError ?? null,
  };
}

export async function setRuntimeDoc(
  orgId: string,
  data: Omit<Runtime, "createdAt" | "lastHeartbeatAt"> & {
    createdAt?: unknown;
    lastHeartbeatAt?: unknown;
  }
): Promise<void> {
  await db()
    .doc(`orgs/${orgId}/runtime/current`)
    .set({ ...data, createdAt: FieldValue.serverTimestamp() });
}

export async function updateRuntimeDoc(
  orgId: string,
  data: Partial<Runtime>
): Promise<void> {
  await db().doc(`orgs/${orgId}/runtime/current`).update(data);
}

export async function deleteRuntimeDoc(orgId: string): Promise<void> {
  await db().doc(`orgs/${orgId}/runtime/current`).delete();
}

// ─── runtimes/{instanceId} ───────────────────────────────────────────────────

export async function setRuntimeMeta(meta: Omit<RuntimeMeta, "createdAt">): Promise<void> {
  await db()
    .doc(`runtimes/${meta.instanceId}`)
    .set({ ...meta, createdAt: FieldValue.serverTimestamp() });
}

export async function findOrgByInstanceId(instanceId: string): Promise<string | null> {
  const snap = await db().doc(`runtimes/${instanceId}`).get();
  if (!snap.exists) return null;
  return snap.data()?.orgId ?? null;
}

// ─── runtimes/{instanceId}/commands/{commandId} ───────────────────────────────

export async function enqueueCommand(
  instanceId: string,
  type: RuntimeCommand["type"]
): Promise<string> {
  const ref = db().collection(`runtimes/${instanceId}/commands`).doc();
  await ref.set({
    type,
    status: "queued" as CommandStatus,
    createdAt: FieldValue.serverTimestamp(),
    startedAt: null,
    completedAt: null,
    result: null,
    error: null,
  });
  return ref.id;
}

export async function getQueuedCommands(
  instanceId: string
): Promise<Array<{ id: string; type: RuntimeCommand["type"] }>> {
  const snap = await db()
    .collection(`runtimes/${instanceId}/commands`)
    .where("status", "==", "queued")
    .orderBy("createdAt", "asc")
    .limit(10)
    .get();

  // Mark as running so they aren't polled twice
  const batch = db().batch();
  for (const doc of snap.docs) {
    batch.update(doc.ref, { status: "running", startedAt: FieldValue.serverTimestamp() });
  }
  await batch.commit();

  return snap.docs.map((d) => ({ id: d.id, type: d.data().type as RuntimeCommand["type"] }));
}

export async function resolveCommand(
  instanceId: string,
  commandId: string,
  status: "done" | "error",
  result?: string,
  error?: string
): Promise<void> {
  await db()
    .doc(`runtimes/${instanceId}/commands/${commandId}`)
    .update({
      status,
      completedAt: FieldValue.serverTimestamp(),
      ...(result !== undefined ? { result } : {}),
      ...(error !== undefined ? { error } : {}),
    });
}

export async function listCommands(instanceId: string): Promise<RuntimeCommand[]> {
  const snap = await db()
    .collection(`runtimes/${instanceId}/commands`)
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      type: data.type,
      status: data.status,
      createdAt: fromTs(data.createdAt),
      startedAt: data.startedAt ? fromTs(data.startedAt) : null,
      completedAt: data.completedAt ? fromTs(data.completedAt) : null,
      result: data.result ?? null,
      error: data.error ?? null,
    };
  });
}
