import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
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
