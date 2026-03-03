import type { CloudInitVars } from "@tulip/types";

const DO_API_BASE = "https://api.digitalocean.com/v2";

function doToken(): string {
  const t = process.env.DO_API_TOKEN;
  if (!t) throw new Error("DO_API_TOKEN not set");
  return t;
}

async function doRequest<T>(
  path: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: unknown
): Promise<T> {
  const res = await fetch(`${DO_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${doToken()}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (method === "DELETE" && (res.status === 204 || res.status === 404)) {
    return undefined as T;
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`DigitalOcean API error ${res.status}: ${JSON.stringify(data)}`);
  }
  return data as T;
}

export interface CreateDropletOptions {
  name: string;
  orgId: string;
  instanceId: string;
  region: string;
  userData: string;
}

export interface DropletResult {
  id: number;
  name: string;
  status: string;
}

export async function createDroplet(opts: CreateDropletOptions): Promise<DropletResult> {
  const body = {
    name: opts.name,
    region: opts.region,
    size: "s-1vcpu-1gb",
    image: "ubuntu-22-04-x64",
    monitoring: true,
    ipv6: false,
    backups: false,
    tags: ["tulip", `org:${opts.orgId}`, `instance:${opts.instanceId}`],
    user_data: opts.userData,
  };

  const data = await doRequest<{ droplet: DropletResult }>("/droplets", "POST", body);
  return data.droplet;
}

export async function deleteDroplet(dropletId: number): Promise<void> {
  await doRequest(`/droplets/${dropletId}`, "DELETE");
}

export async function getDroplet(dropletId: number): Promise<DropletResult | null> {
  try {
    const data = await doRequest<{ droplet: DropletResult }>(`/droplets/${dropletId}`);
    return data.droplet;
  } catch {
    return null;
  }
}
