import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { deleteTunnel } from "@/lib/cloudflare";

const DO_API_TOKEN = process.env.DO_API_TOKEN!;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let uid: string;
  try {
    const token = authHeader.slice(7);
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const orgsSnap = await adminDb
    .collection("orgs")
    .where("ownerUid", "==", uid)
    .limit(1)
    .get();

  if (orgsSnap.empty) {
    return NextResponse.json({ error: "No org found" }, { status: 404 });
  }

  const orgId = orgsSnap.docs[0]!.id;
  const runtimeDoc = await adminDb.doc(`orgs/${orgId}/runtime/current`).get();

  if (!runtimeDoc.exists) {
    return NextResponse.json({ error: "No runtime to deprovision" }, { status: 404 });
  }

  const runtime = runtimeDoc.data()!;
  const { dropletId, instanceId } = runtime;

  // Mark as deleting
  await adminDb.doc(`orgs/${orgId}/runtime/current`).update({ status: "deleting" });

  // Delete DigitalOcean droplet
  if (dropletId) {
    const doRes = await fetch(
      `https://api.digitalocean.com/v2/droplets/${dropletId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${DO_API_TOKEN}` },
      }
    );
    if (!doRes.ok && doRes.status !== 404) {
      console.error("Failed to delete droplet", dropletId);
    }
  }

  // Delete Cloudflare tunnel and DNS record
  const cfDoc = await adminDb.doc(`orgs/${orgId}/cloudflare/tunnel`).get();
  if (cfDoc.exists) {
    const { tunnelId } = cfDoc.data()!;
    await deleteTunnel(tunnelId, instanceId).catch((err: unknown) =>
      console.error("Tunnel delete error:", err)
    );
    await cfDoc.ref.delete();
  }

  // Remove Firestore records
  await adminDb.doc(`orgs/${orgId}/runtime/current`).delete();
  if (instanceId) {
    await adminDb.doc(`runtimes/${instanceId}`).delete().catch(() => null);
  }

  return NextResponse.json({ ok: true });
}
