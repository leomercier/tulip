# Tulip — Claude context

## What this project is

**Tulip** is an agent control plane. It lets users provision isolated OpenClaw runtime instances on DigitalOcean droplets, connect them to Slack via Cloudflare tunnels, and manage them from a Next.js dashboard. Think "Heroku for AI agents".

## Monorepo layout

```
tulip/
├── apps/web/                     # Next.js 14 dashboard + all API routes
│   └── src/
│       ├── app/
│       │   ├── api/
│       │   │   ├── orgs/         # create, invite, members
│       │   │   ├── admin/        # superadmin billing API
│       │   │   ├── runtime/      # provision, deprovision, heartbeat, bootstrap,
│       │   │   │                 #   command, commands (GET), commandResult
│       │   │   └── slack/        # install, callback, events
│       │   ├── app/              # Protected /app/* pages
│       │   │   ├── page.tsx      # Overview
│       │   │   ├── org/          # Members + invites
│       │   │   ├── billing/      # Credit balance + ledger
│       │   │   ├── integrations/ # Slack connect
│       │   │   └── runtime/      # Provision/manage runtime
│       │   ├── admin/            # Superadmin pages (/admin/*)
│       │   │   └── orgs/
│       │   │       └── [orgId]/billing/
│       │   ├── invite/[inviteId]/ # Public invite acceptance page
│       │   └── login/            # Google sign-in
│       ├── components/
│       │   ├── layout/sidebar.tsx # Org switcher + nav
│       │   ├── runtime/          # ProvisionPanel, CommandPanel, RuntimeIframe, HealthStatus
│       │   └── ui/               # Button, Card, Badge
│       └── lib/
│           ├── context/OrgContext.tsx  # Multi-org React context
│           ├── firebase/
│           │   ├── admin.ts            # Firebase Admin SDK
│           │   ├── adminHelpers.ts     # Shared server helpers (auth, members, billing)
│           │   ├── client.ts           # Firebase client SDK
│           │   └── converters.ts       # Firestore ↔ TypeScript converters
│           ├── hooks/
│           │   ├── useAuth.ts          # Auth state + UserProfile creation on sign-in
│           │   └── useOrg.ts           # useUserOrg, useOrgMembers, useOrgInvites,
│           │                           #   useBillingAccount, useLedger, useRuntime, etc.
│           ├── middleware.ts           # Route guards (/app, /admin protected; /invite public)
│           └── utils.ts
├── packages/
│   ├── types/src/index.ts        # ALL shared TypeScript types — edit here first
│   ├── cloud-init/               # Renders cloud-init YAML for droplet bootstrap
│   └── runtime-agent/            # Node.js agent that runs on each droplet
└── functions/src/                # Firebase Cloud Functions v2
    ├── http/runtime.ts           # provision, deprovision, bootstrap, heartbeat, commands
    ├── http/slack.ts             # Slack OAuth + event handling
    ├── db/orgs.ts                # getOrg, getSlackIntegration, getInferenceConfig
    ├── db/runtime.ts             # getRuntimeDoc, enqueueCommand, resolveCommand
    └── services/
        ├── crypto.ts             # AES-256-GCM encrypt/decrypt, generateToken
        ├── digitalocean.ts       # createDroplet, deleteDroplet
        └── cloudflare.ts         # createTunnel, deleteTunnel
```

## Firestore data model

```
users/{uid}
  uid, email, displayName, photoURL, superAdmin: bool, orgIds: string[], createdAt

orgs/{orgId}
  name, ownerUid, status, memberCount, createdAt
  ├── members/{uid}               role (owner|admin|member), email, displayName, joinedAt
  ├── runtime/current             Runtime doc (instanceId, status, lastHeartbeatAt, …)
  ├── integrations/slack          botTokenEncrypted, teamId, teamName, installedAt
  ├── cloudflare/tunnel           tunnelId, tunnelToken, instanceId
  ├── inference/default           modelProvider, modelId, systemPrompt, timeoutMs
  └── billing/
      ├── account                 credits (int, 1=$0.01), status, currencyCode, updatedAt
      └── ledger/entries/{id}     type, amount, balanceAfter, description, createdByUid

orgInvites/{inviteId}
  orgId, orgName, invitedByUid, email (null=open link), role, status, expiresAt, acceptedByUid

runtimes/{instanceId}
  orgId, dropletId, region, agentVersion, openclawImage
  └── commands/{commandId}        type, status (queued→running→done|error), result, error
```

## Key invariants / things to know

- **`/runtime/current`** is the canonical path — never `/runtime/default` (fixed bug).
- **Credits** are integers: 1 credit = $0.01 USD. `addCredits()` in `adminHelpers.ts` is a Firestore transaction — always use it to modify the balance.
- **Invite acceptance** is atomic: `addMemberToOrg()` in `adminHelpers.ts` writes the member doc, appends to `users/{uid}.orgIds`, and increments `memberCount` in a single batch.
- **Org creation** (`/api/orgs/create`) now also creates the owner member record and bootstraps billing.
- **superAdmin** is checked server-side on every `/api/admin/*` route via `isSuperAdmin()` in `adminHelpers.ts`.
- **OrgContext** (`lib/context/OrgContext.tsx`) is the source of truth for multi-org state. The old `useUserOrg(uid)` hook still works as a shim for pages that haven't migrated.
- The **agent** polls `/api/runtime/commands` (GET) and posts to `/api/runtime/commandResult`. These exist in both the Next.js app AND Cloud Functions — the agent URL is configured at bootstrap time.
- `TOKEN_ENCRYPTION_KEY` must be exactly 64 hex chars (32 bytes). The bootstrap route validates this at call time via `getEncryptionKey()`.

## Roles

| Role | Permissions |
|---|---|
| `owner` | Full control — cannot be removed or demoted |
| `admin` | Can invite, remove members, change roles (not owner) |
| `member` | Read access; can leave the org |
| `superAdmin` | System-wide; managed via Firestore directly |

## Active branch

Development happens on `claude/tulip-control-plane-1Xatk`. Always push to this branch.

## Recent significant changes

- **Multi-user orgs + invite links + email invites** — `OrgContext`, `useOrg` hooks, `/app/org`, invite API routes.
- **Billing system** — credit balance + ledger; `addCredits()` transaction helper.
- **Superadmin panel** — `/admin/orgs`, `/admin/orgs/[orgId]/billing`, credit adjustment.
- **Pre-test bug fixes** — `/runtime/current` path consistency, `lastHeartbeatAt` field name, `/api/runtime/commands` + `/api/runtime/commandResult` routes added to Next.js, `OPENCLAW_IMAGE` validation, `reportResult` retry logic.

## Running locally

```bash
pnpm install
pnpm dev                   # Next.js on :3001
firebase emulators:start   # Firestore :8080, Functions :5001, UI :4000
```

See `README.md` for full setup including env vars.
