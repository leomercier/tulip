import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyIdToken, getOrgMemberRole } from "@/lib/firebase/adminHelpers";
import { decryptToken } from "@/lib/tokenCrypto";

/**
 * GET /api/runtime/sshKey?orgId=xxx
 * Returns the decrypted PKCS#1 PEM private key as a downloadable file.
 * Requires the caller to be an org member (any role).
 */
export async function GET(request: NextRequest) {
  const uid = await verifyIdToken(request.headers.get("Authorization"));
  if (!uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = request.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const role = await getOrgMemberRole(orgId, uid);
  if (!role) {
    return NextResponse.json({ error: "Not a member of this organisation" }, { status: 403 });
  }

  const rtDoc = await adminDb.doc(`orgs/${orgId}/runtime/current`).get();
  if (!rtDoc.exists) {
    return NextResponse.json({ error: "No runtime found" }, { status: 404 });
  }

  const encrypted = rtDoc.data()?.sshPrivateKeyEncrypted as string | undefined;
  if (!encrypted) {
    return NextResponse.json(
      { error: "No SSH key available — reprovision the runtime to generate one" },
      { status: 404 }
    );
  }

  let pem: string;
  try {
    pem = decryptToken(encrypted);
  } catch {
    return NextResponse.json({ error: "Failed to decrypt SSH key" }, { status: 500 });
  }

  const instanceId = rtDoc.data()?.instanceId as string;
  const filename = `tulip-${orgId.slice(0, 8)}-${instanceId}.pem`;

  return new NextResponse(pem, {
    status: 200,
    headers: {
      "Content-Type": "application/x-pem-file",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
