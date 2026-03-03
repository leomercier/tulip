/**
 * Tulip Firebase Cloud Functions
 *
 * All functions are v2 HTTPS callable endpoints.
 * Deploy with: firebase deploy --only functions
 */
import { initializeApp } from "firebase-admin/app";

initializeApp();

// ─── Runtime ─────────────────────────────────────────────────────────────────

export {
  bootstrap,
  heartbeat,
  status,
  provision,
  deprovision,
  command,
  commands,
  commandResult,
  commandHistory,
} from "./http/runtime";

// ─── Slack ───────────────────────────────────────────────────────────────────

export {
  install as slackInstall,
  callback as slackCallback,
  events as slackEvents,
} from "./http/slack";
