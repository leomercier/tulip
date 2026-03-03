import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { instanceId, status } = body as {
    instanceId?: string;
    status?: string;
  };

  if (!instanceId) {
    return NextResponse.json({ error: "instanceId required" }, { status: 400 });
  }

  // Find runtime by instanceId
  const orgsSnap = await adminDb.collection("orgs").get();

  for (const orgDoc of orgsSnap.docs) {
    const rtDoc = await adminDb.doc(`orgs/${orgDoc.id}/runtime/default`).get();
    if (rtDoc.exists && rtDoc.data()?.instanceId === instanceId) {
      await rtDoc.ref.update({
        lastHeartbeat: FieldValue.serverTimestamp(),
        ...(status ? { status } : {}),
      });
      return NextResponse.json({ ok: true });
    }
  }

  return NextResponse.json({ error: "Instance not found" }, { status: 404 });
}
