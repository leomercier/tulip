/**
 * Tulip Firebase Cloud Functions
 *
 * All HTTP endpoints are served by a single v2 HTTPS function (`api`).
 * Deploy with: firebase deploy --only functions
 */
import express = require("express");
import { initializeApp } from "firebase-admin/app";
import { onRequest } from "firebase-functions/v2/https";
import * as runtime from "./http/runtime";
import * as slack from "./http/slack";

initializeApp();

const app = express();

function route(
  method: "get" | "post",
  path: string,
  handler: (req: express.Request, res: express.Response) => unknown
) {
  app[method](path, handler);
  app[method](`/api${path}`, handler);
}

// Runtime endpoints
route("post", "/runtime/bootstrap", (req, res) => runtime.bootstrap(req, res));
route("post", "/runtime/heartbeat", (req, res) => runtime.heartbeat(req, res));
route("get", "/runtime/status", (req, res) => runtime.status(req, res));
route("post", "/runtime/provision", (req, res) => runtime.provision(req, res));
route("post", "/runtime/deprovision", (req, res) => runtime.deprovision(req, res));
route("post", "/runtime/command", (req, res) => runtime.command(req, res));
route("get", "/runtime/commands", (req, res) => runtime.commands(req, res));
route("post", "/runtime/commandResult", (req, res) => runtime.commandResult(req, res));
route("get", "/runtime/commandHistory", (req, res) => runtime.commandHistory(req, res));

// Slack endpoints
route("get", "/slack/install", (req, res) => slack.install(req, res));
route("get", "/slack/callback", (req, res) => slack.callback(req, res));
route("post", "/slack/events", (req, res) => slack.events(req, res));

app.all("*", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

export const api = onRequest(app);
