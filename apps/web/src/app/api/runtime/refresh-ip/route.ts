import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

const DO_API_TOKEN = process.env.DO_API_TOKEN!;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
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
    return NextResponse.json({ error: "No runtime" }, { status: 404 });
  }

  const { dropletId } = runtimeDoc.data()!;
  if (!dropletId) {
    return NextResponse.json({ error: "No droplet ID" }, { status: 404 });
  }

  // Fetch droplet info from DigitalOcean
  const doRes = await fetch(
    `https://api.digitalocean.com/v2/droplets/${dropletId}`,
    { headers: { Authorization: `Bearer ${DO_API_TOKEN}` } }
  );

  if (!doRes.ok) {
    return NextResponse.json({ error: "Droplet not found" }, { status: 404 });
  }

  const doData = await doRes.json();
  const publicNet = (doData.droplet?.networks?.v4 ?? []).find(
    (n: { type: string; ip_address: string }) => n.type === "public"
  );

  if (!publicNet?.ip_address) {
    return NextResponse.json({ error: "IP not assigned yet" }, { status: 202 });
  }

  await runtimeDoc.ref.update({ ipv4: publicNet.ip_address });

  return NextResponse.json({ ipv4: publicNet.ip_address });
}
