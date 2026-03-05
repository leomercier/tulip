import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { readFileSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let buildHash = "dev";
try {
  buildHash = execSync("git rev-parse --short HEAD", { stdio: ["pipe", "pipe", "pipe"] })
    .toString()
    .trim();
} catch {}

let buildNumber = 0;
try {
  const versionData = JSON.parse(
    readFileSync(path.join(__dirname, "../../build-number.json"), "utf8")
  );
  buildNumber = versionData.buildNumber;
} catch {}

const nextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_HASH: buildHash,
    NEXT_PUBLIC_BUILD_NUMBER: String(buildNumber),
  },
  output: "standalone",
  experimental: {
    // Set tracing root to the monorepo root so standalone output mirrors the
    // workspace directory structure (server.js lands at apps/web/server.js)
    outputFileTracingRoot: path.join(__dirname, "../../"),
  },
  // Allow embedding OpenClaw runtime iframes
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN"
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          }
        ]
      }
    ];
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  // Transpile workspace packages
  transpilePackages: ["@tulip/types", "@tulip/cloud-init"]
};

export default nextConfig;
