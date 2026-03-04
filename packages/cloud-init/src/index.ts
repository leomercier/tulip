import type { CloudInitVars } from "@tulip/types";
import { CLOUD_INIT_TEMPLATE } from "./template";

/**
 * Render the cloud-init YAML by substituting all {{PLACEHOLDER}} tokens.
 *
 * All values are validated to be DNS/shell-safe before injection.
 * The rendered string is passed directly as `user_data` to the DO API.
 */
export function renderCloudInit(vars: CloudInitVars): string {
  validateVars(vars);

  let output = CLOUD_INIT_TEMPLATE;
  for (const [key, value] of Object.entries(vars)) {
    output = output.replaceAll(`{{${key}}}`, value);
  }

  // Safety check — no unresolved placeholders should remain
  const unresolved = output.match(/\{\{[A-Z_]+\}\}/g);
  if (unresolved) {
    throw new Error(`Unresolved cloud-init placeholders: ${unresolved.join(", ")}`);
  }

  return output;
}

function validateVars(vars: CloudInitVars): void {
  if (!vars.INSTANCE_ID.match(/^tulip-[a-z0-9]+$/)) {
    throw new Error(`Invalid INSTANCE_ID: ${vars.INSTANCE_ID}`);
  }
  if (!vars.ORG_ID.match(/^[a-zA-Z0-9_-]+$/)) {
    throw new Error(`Invalid ORG_ID: ${vars.ORG_ID}`);
  }
  if (!vars.BOOTSTRAP_TOKEN.match(/^[a-f0-9]{64}$/)) {
    throw new Error("Invalid BOOTSTRAP_TOKEN: must be 32-byte hex");
  }
  if (!vars.CONTROL_PLANE_BASE_URL.startsWith("https://")) {
    throw new Error("CONTROL_PLANE_BASE_URL must be HTTPS");
  }
  if (!vars.OPENCLAW_IMAGE.match(/^[a-zA-Z0-9._\-/:@]+$/)) {
    throw new Error("Invalid OPENCLAW_IMAGE: contains disallowed characters");
  }
  if (!vars.SSH_PUBLIC_KEY.startsWith("ssh-rsa ")) {
    throw new Error("Invalid SSH_PUBLIC_KEY: must be an ssh-rsa public key");
  }
}

export type { CloudInitVars };
