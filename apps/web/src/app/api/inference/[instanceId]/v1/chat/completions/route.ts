/**
 * Inference proxy — /api/inference/[instanceId]/v1/chat/completions
 *
 * OpenClaw on each droplet is configured to call this endpoint instead of
 * Fireworks directly. We:
 *   1. Authenticate the request via runtimeAuthToken (Bearer header)
 *   2. Check the org has a positive credit balance
 *   3. Forward the request to Fireworks using the openai SDK
 *   4. Read exact token counts from the response's `usage` field
 *   5. Deduct credits from the org's billing account via a Firestore transaction
 *
 * Auth: Authorization: Bearer <runtimeAuthToken>
 * The instanceId in the URL path is used to look up the org.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { adminDb } from "@/lib/firebase/admin";
import { addCredits } from "@/lib/firebase/adminHelpers";
import { calculateCost } from "@/lib/inference/pricing";

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY ?? "";
const FIREWORKS_BASE_URL = "https://api.fireworks.ai/inference/v1";

const fireworks = new OpenAI({
  apiKey: FIREWORKS_API_KEY,
  baseURL: FIREWORKS_BASE_URL,
});

/** Resolve orgId from instanceId via the runtimes/{instanceId} doc. */
async function resolveOrg(
  instanceId: string,
  authToken: string
): Promise<{ orgId: string } | null> {
  // Look up runtime metadata
  const runtimeDoc = await adminDb.doc(`runtimes/${instanceId}`).get();
  if (!runtimeDoc.exists) return null;
  const orgId: string = runtimeDoc.data()!.orgId;

  // Validate runtimeAuthToken against the live runtime doc
  const rtDoc = await adminDb.doc(`orgs/${orgId}/runtime/current`).get();
  if (!rtDoc.exists) return null;
  if (rtDoc.data()!.runtimeAuthToken !== authToken) return null;

  return { orgId };
}

/** Return current credit balance for an org, or 0 if no account exists. */
async function getBalance(orgId: string): Promise<number> {
  const snap = await adminDb.doc(`orgs/${orgId}/billing/account`).get();
  return snap.exists ? (snap.data()?.credits ?? 0) : 0;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { instanceId: string } }
) {
  const { instanceId } = params;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authToken = authHeader.slice(7);

  const identity = await resolveOrg(instanceId, authToken);
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { orgId } = identity;

  // ── Balance check ─────────────────────────────────────────────────────────
  const balance = await getBalance(orgId);
  if (balance <= 0) {
    return NextResponse.json(
      { error: "Insufficient credits", code: "insufficient_credits" },
      { status: 402 }
    );
  }

  // ── Parse request body ────────────────────────────────────────────────────
  const body = await request.json();
  const { model, messages, stream, ...rest } = body;

  if (!model || !messages) {
    return NextResponse.json({ error: "model and messages are required" }, { status: 400 });
  }

  // ── Forward to Fireworks ──────────────────────────────────────────────────
  // Streaming is not yet supported in the billing proxy — OpenClaw should
  // send non-streaming requests. If stream is requested, we reject it so the
  // caller can retry without streaming.
  if (stream) {
    return NextResponse.json(
      { error: "Streaming is not supported through the billing proxy" },
      { status: 422 }
    );
  }

  let completion: OpenAI.Chat.ChatCompletion;
  try {
    completion = await fireworks.chat.completions.create({
      model,
      messages,
      stream: false,
      ...rest,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream inference error";
    console.error(`[inference-proxy] Fireworks error for ${instanceId}:`, err);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // ── Bill the org ──────────────────────────────────────────────────────────
  const usage = completion.usage;
  if (usage) {
    const cost = calculateCost(model, usage.prompt_tokens, usage.completion_tokens);

    if (cost.credits > 0) {
      try {
        await addCredits(
          orgId,
          -cost.credits,
          `Inference: ${model} — ${cost.inputTokens} in / ${cost.outputTokens} out tokens`,
          null,
          "api_usage",
          {
            instanceId,
            model,
            inputTokens: cost.inputTokens,
            outputTokens: cost.outputTokens,
            totalTokens: cost.totalTokens,
            costUsd: cost.costUsd,
          }
        );
      } catch (billingErr) {
        // Log but don't fail the request — inference already happened
        console.error(`[inference-proxy] Billing error for org ${orgId}:`, billingErr);
      }
    }
  }

  return NextResponse.json(completion);
}
