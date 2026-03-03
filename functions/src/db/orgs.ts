import { getFirestore, Timestamp } from "firebase-admin/firestore";
import type { Org, SlackIntegration, InferenceConfig } from "@tulip/types";

function db() {
  return getFirestore();
}

function fromTs(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

export async function getOrg(orgId: string): Promise<Org | null> {
  const snap = await db().doc(`orgs/${orgId}`).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return {
    id: snap.id,
    name: d.name,
    ownerUid: d.ownerUid,
    createdAt: fromTs(d.createdAt),
    status: d.status ?? "active",
  };
}

export async function getOrgByOwner(uid: string): Promise<Org | null> {
  const snap = await db().collection("orgs").where("ownerUid", "==", uid).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0]!.data();
  return {
    id: snap.docs[0]!.id,
    name: d.name,
    ownerUid: d.ownerUid,
    createdAt: fromTs(d.createdAt),
    status: d.status ?? "active",
  };
}

export async function getSlackIntegration(orgId: string): Promise<SlackIntegration | null> {
  const snap = await db().doc(`orgs/${orgId}/integrations/slack`).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return {
    teamId: d.teamId,
    teamName: d.teamName ?? "",
    botTokenEncrypted: d.botTokenEncrypted,
    installedAt: fromTs(d.installedAt),
  };
}

export async function getInferenceConfig(orgId: string): Promise<InferenceConfig> {
  const snap = await db().doc(`orgs/${orgId}/inference/default`).get();
  if (snap.exists) {
    const d = snap.data()!;
    return {
      modelProvider: d.modelProvider ?? "anthropic",
      modelId: d.modelId ?? "claude-sonnet-4-6",
      systemPrompt: d.systemPrompt ?? "",
      timeoutMs: d.timeoutMs ?? 30000,
      allowedTools: d.allowedTools ?? [],
    };
  }
  // Default inference config
  return {
    modelProvider: "anthropic",
    modelId: "claude-sonnet-4-6",
    systemPrompt: "You are a helpful AI assistant. Be concise, accurate, and friendly.",
    timeoutMs: 30000,
    allowedTools: ["web_search", "code_execution"],
  };
}
