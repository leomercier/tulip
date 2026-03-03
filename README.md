# Tulip

Agent control plane for spinning up and managing isolated OpenClaw runtimes on DigitalOcean, connected to Slack through Cloudflare tunnels.

## Architecture

```
tulip/
├── apps/web/          # Next.js 14 control-plane dashboard + API routes
├── packages/
│   ├── types/         # Shared TypeScript types (Org, User, Billing, Runtime…)
│   ├── cloud-init/    # DigitalOcean cloud-init YAML renderer
│   └── runtime-agent/ # Node.js agent deployed on each droplet
└── functions/         # Firebase Cloud Functions v2 (provision, heartbeat, Slack OAuth…)
```

**Stack:** pnpm 9 · Turbo · Next.js 14 · Firebase (Auth, Firestore, Functions) · DigitalOcean · Cloudflare

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20+ |
| pnpm | 9.x — `npm i -g pnpm@9` |
| Firebase CLI | latest — `npm i -g firebase-tools` |

---

## 1. Clone and install

```bash
git clone <repo-url> tulip
cd tulip
pnpm install
```

---

## 2. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a project.
2. Enable **Authentication** → Sign-in method → **Google**.
3. Enable **Firestore** (Production mode).
4. Go to **Project settings → Service accounts** → Generate a new private key. Save the JSON file — you will need it as `FIREBASE_SERVICE_ACCOUNT_JSON`.
5. From **Project settings → General → Your apps**, register a **Web app** to get the client SDK config values.

---

## 3. Configure environment variables

### Web app

```bash
cp apps/web/.env.example apps/web/.env.local
```

Fill in `apps/web/.env.local`:

```dotenv
# ── Firebase client SDK (safe for browser) ────────────────────────────────────
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=          # e.g. your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# ── Firebase Admin SDK (server only — never expose) ───────────────────────────
# Paste the entire service account JSON as a single-line string
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# ── Slack OAuth ───────────────────────────────────────────────────────────────
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=

# ── DigitalOcean ──────────────────────────────────────────────────────────────
DO_API_TOKEN=
DO_REGION=lon1                             # lon1 · nyc3 · ams3 · sgp1 etc.

# ── Cloudflare ────────────────────────────────────────────────────────────────
CF_API_TOKEN=
CF_ACCOUNT_ID=
CF_ZONE_ID=                                # optional — needed for DNS records
CF_TUNNEL_HOSTNAME_ZONE=agents.tulip.ai

# ── App ───────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3001  # change to your deployed URL in prod
NEXT_PUBLIC_RUNTIME_BASE_DOMAIN=agents.tulip.ai
OPENCLAW_IMAGE=ghcr.io/tulipai/openclaw:latest

# ── Encryption ────────────────────────────────────────────────────────────────
# Generate with: openssl rand -hex 32
TOKEN_ENCRYPTION_KEY=
```

### Firebase Functions

```bash
cp functions/.env.example functions/.env
```

Fill in `functions/.env` with the same `TOKEN_ENCRYPTION_KEY`, Slack, DigitalOcean, and Cloudflare values as above plus:

```dotenv
CONTROL_PLANE_BASE_URL=http://localhost:3001  # or your deployed URL
```

> **Note:** For production, set Functions config via Firebase Secrets:
> `firebase functions:secrets:set TOKEN_ENCRYPTION_KEY`

---

## 4. Set up Firestore indexes

```bash
firebase deploy --only firestore:indexes
```

Or just start the emulator (it applies indexes automatically):

```bash
firebase emulators:start --only firestore
```

---

## 5. Run in development

### Start everything (recommended)

```bash
pnpm dev
```

Turbo starts both the web app and watches workspace packages. The web app runs on **http://localhost:3001**.

### Start services individually

```bash
# Web app only
cd apps/web && pnpm dev

# Firebase emulators (Firestore + Functions)
firebase emulators:start
# Firestore UI:  http://localhost:4000
# Functions:     http://localhost:5001
# Firestore:     http://localhost:8080

# Runtime agent (for local testing)
cd packages/runtime-agent && pnpm dev
```

---

## 6. First sign-in

1. Open **http://localhost:3001**.
2. Sign in with Google — a `users/{uid}` profile document is created automatically.
3. Go to **Integrations** to connect Slack (creates an org on first connect).
4. Go to **Runtime** to provision a DigitalOcean droplet.

---

## 7. Invite team members

From **Members** (`/app/org`) you can:

- **Copy invite link** — anyone with the link can join (7-day expiry).
- **Invite by email** — they're added automatically when they sign in with that address.

Invited users are added to `orgs/{orgId}/members/{uid}` with their assigned role (`admin` or `member`). The org owner cannot be changed via the UI.

---

## 8. Billing credits

Credits are the unit of account: **1 credit = $0.01 USD**.

Every org gets a billing account at `orgs/{orgId}/billing/account`. An append-only ledger at `orgs/{orgId}/billing/ledger/entries` records every transaction.

To seed credits locally, use the superadmin panel (see below) or write directly to Firestore via the emulator UI.

---

## 9. Superadmin access

Grant superadmin to a user by setting `superAdmin: true` on their `users/{uid}` document in Firestore:

```
# Emulator UI → Firestore → users → {uid} → Edit → superAdmin: true
```

Once set, the **Admin** link appears in the sidebar. The admin panel is at `/admin/orgs` and lets you:

- View all organisations, member counts, and credit balances.
- Drill into any org's billing history.
- Add or deduct credits manually.

---

## 10. Build for production

```bash
pnpm build
```

Deploy the web app to any Node.js host (Vercel, Railway, etc.) and deploy Functions:

```bash
firebase deploy --only functions
```

---

## 11. Deploy the runtime agent

The agent is built and deployed automatically as part of the droplet cloud-init script when you provision a runtime from the dashboard. To build it manually:

```bash
cd packages/runtime-agent
pnpm build
# Outputs: packages/runtime-agent/dist/index.js
```

On the droplet it runs as a systemd service (`tulip-agent.service`) with config injected from `/opt/tulip/agent/.env`.

---

## Environment variable reference

| Variable | Where | Description |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | web | Firebase client SDK config |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | web | Firebase Admin service account (JSON string) |
| `TOKEN_ENCRYPTION_KEY` | web + functions | 32-byte hex key for AES-256-GCM — `openssl rand -hex 32` |
| `SLACK_CLIENT_ID` | web + functions | Slack app client ID |
| `SLACK_CLIENT_SECRET` | web + functions | Slack app client secret |
| `SLACK_SIGNING_SECRET` | web + functions | Slack request signing secret |
| `DO_API_TOKEN` | web + functions | DigitalOcean personal access token |
| `DO_REGION` | web + functions | DigitalOcean region (default: `lon1`) |
| `CF_API_TOKEN` | web + functions | Cloudflare API token |
| `CF_ACCOUNT_ID` | web + functions | Cloudflare account ID |
| `CF_ZONE_ID` | web + functions | Cloudflare DNS zone ID (optional) |
| `CF_TUNNEL_HOSTNAME_ZONE` | web + functions | Base domain for tunnels (default: `agents.tulip.ai`) |
| `OPENCLAW_IMAGE` | web + functions | Docker image for the agent runtime |
| `CONTROL_PLANE_BASE_URL` | functions | Publicly reachable URL of the web app |
| `NEXT_PUBLIC_APP_URL` | web | Same URL, used for invite links |

---

## Common commands

```bash
pnpm dev                         # Start all services in dev mode
pnpm build                       # Build entire monorepo
pnpm lint                        # Lint all packages
pnpm type-check                  # TypeScript check across all packages

firebase emulators:start         # Local Firestore + Functions
firebase deploy --only functions # Deploy Cloud Functions
firebase deploy --only firestore # Deploy Firestore rules + indexes
```
