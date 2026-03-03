import type { CloudInitVars } from "@tulip/types";
/**
 * Render the cloud-init YAML by substituting all {{PLACEHOLDER}} tokens.
 *
 * All values are validated to be DNS/shell-safe before injection.
 * The rendered string is passed directly as `user_data` to the DO API.
 */
export declare function renderCloudInit(vars: CloudInitVars): string;
export type { CloudInitVars };
