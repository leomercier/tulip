const nextConfig = {
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
  // Transpile workspace packages
  transpilePackages: ["@tulip/types", "@tulip/cloud-init"]
};

export default nextConfig;
