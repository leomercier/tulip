const CF_API_BASE = "https://api.cloudflare.com/client/v4";

function cfToken(): string {
  const t = process.env.CF_API_TOKEN;
  if (!t) throw new Error("CF_API_TOKEN not set");
  return t;
}

function cfAccountId(): string {
  const id = process.env.CF_ACCOUNT_ID;
  if (!id) throw new Error("CF_ACCOUNT_ID not set");
  return id;
}

async function cfRequest<T>(
  path: string,
  method: "GET" | "POST" | "DELETE" | "PUT" = "GET",
  body?: unknown
): Promise<T> {
  const res = await fetch(`${CF_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${cfToken()}`,
      "Content-Type": "application/json"
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const data = (await res.json()) as {
    success: boolean;
    result: T;
    errors: unknown[];
  };
  if (!data.success) {
    throw new Error(`Cloudflare API error: ${JSON.stringify(data.errors)}`);
  }
  return data.result;
}

export interface TunnelResult {
  id: string;
  name: string;
  token: string;
}

/**
 * Create a named Cloudflare Tunnel for a given instance.
 * Configures ingress to localhost:3000 (OpenClaw) and creates a CNAME DNS record.
 * Returns the tunnel token that cloudflared uses to authenticate.
 */
export async function createTunnel(instanceId: string): Promise<TunnelResult> {
  const accountId = cfAccountId();
  const tunnel = await cfRequest<TunnelResult>(
    `/accounts/${accountId}/cfd_tunnel`,
    "POST",
    { name: instanceId, config_src: "cloudflare" }
  );

  const hostname = `${instanceId}.${process.env.CF_TUNNEL_HOSTNAME_ZONE ?? "tulip.md"}`;

  // Configure tunnel ingress: route hostname → localhost:3000, 404 everything else
  await cfRequest(
    `/accounts/${accountId}/cfd_tunnel/${tunnel.id}/configurations`,
    "PUT",
    {
      config: {
        ingress: [
          { hostname, service: "http://localhost:18789" },
          { service: "http_status:404" }
        ]
      }
    }
  );

  // Create CNAME pointing the subdomain to the tunnel
  const zoneId = process.env.CF_ZONE_ID;
  if (zoneId) {
    await cfRequest(`/zones/${zoneId}/dns_records`, "POST", {
      type: "CNAME",
      name: hostname,
      content: `${tunnel.id}.cfargotunnel.com`,
      ttl: 1,
      proxied: true
    }).catch((err: unknown) => {
      // CNAME may already exist on re-bootstrap — non-fatal
      console.warn("DNS CNAME creation warning:", err);
    });
  }

  return tunnel;
}

/**
 * Delete a Cloudflare Tunnel and its CNAME DNS record.
 */
export async function deleteTunnel(
  tunnelId: string,
  instanceId: string
): Promise<void> {
  const accountId = cfAccountId();
  const zoneId = process.env.CF_ZONE_ID;

  // Delete the CNAME DNS record first
  if (zoneId) {
    const hostname = `${instanceId}.${process.env.CF_TUNNEL_HOSTNAME_ZONE ?? "tulip.md"}`;
    const records = await cfRequest<Array<{ id: string; name: string }>>(
      `/zones/${zoneId}/dns_records?name=${hostname}`
    );
    for (const record of records) {
      await cfRequest(
        `/zones/${zoneId}/dns_records/${record.id}`,
        "DELETE"
      ).catch(() => null);
    }
  }

  // Drain active connections then delete tunnel
  await cfRequest(
    `/accounts/${accountId}/cfd_tunnel/${tunnelId}/connections`,
    "DELETE"
  ).catch(() => null);

  await cfRequest(
    `/accounts/${accountId}/cfd_tunnel/${tunnelId}`,
    "DELETE"
  ).catch(() => null);
}
