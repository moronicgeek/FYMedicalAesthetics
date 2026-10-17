import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Pages get a per-request Content Security Policy with a script nonce from
// src/middleware.ts. API responses get this strict one, since they never run
// script.
const noScriptPolicy = { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" };

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Signatures and ID photos are sent as images inside form posts.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: [noScriptPolicy] },
      // Patient pages must never be cached by browsers or shared proxies.
      { source: "/(dashboard|checkin|patients|appointments|intake|staff|cases|kiosk|d|settings|audit)/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
