import { generateKeyPairSync } from "crypto";

/**
 * Generate an RSA-4096 SSH key pair using only Node.js built-in crypto.
 * Returns:
 *   - privateKeyPEM: PKCS#1 PEM (works with `ssh -i`)
 *   - publicKeyOpenSSH: authorized_keys format (`ssh-rsa AAAA... comment`)
 */
export function generateSSHKeyPair(comment: string): {
  privateKeyPEM: string;
  publicKeyOpenSSH: string;
} {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 4096,
  });

  const privateKeyPEM = privateKey.export({ type: "pkcs1", format: "pem" }) as string;
  const jwk = publicKey.export({ format: "jwk" }) as { n: string; e: string };
  const publicKeyOpenSSH = buildSSHRSAPublicKey(jwk.n, jwk.e, comment);

  return { privateKeyPEM, publicKeyOpenSSH };
}

/**
 * Build an OpenSSH-format RSA public key from JWK components.
 * Wire format: uint32(len) "ssh-rsa" uint32(len) e uint32(len) n
 */
function buildSSHRSAPublicKey(nB64url: string, eB64url: string, comment: string): string {
  const n = sshInt(b64urlDecode(nB64url));
  const e = sshInt(b64urlDecode(eB64url));
  const keyType = Buffer.from("ssh-rsa");

  const wire = Buffer.concat([
    uint32be(keyType.length),
    keyType,
    uint32be(e.length),
    e,
    uint32be(n.length),
    n,
  ]);

  return `ssh-rsa ${wire.toString("base64")} ${comment}`;
}

/** Decode base64url string to Buffer */
function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/** Ensure the integer is treated as a positive SSH mpint (prefix 0x00 if high bit set) */
function sshInt(buf: Buffer): Buffer {
  if (buf.length > 0 && (buf[0]! & 0x80)) {
    return Buffer.concat([Buffer.from([0x00]), buf]);
  }
  return buf;
}

function uint32be(n: number): Buffer {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32BE(n, 0);
  return b;
}
