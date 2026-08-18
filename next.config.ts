import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * An honest note on the Content Security Policy: `script-src` includes
 * 'unsafe-inline' because Next.js ships an inline bootstrap and Tailwind
 * injects styles. Removing it needs a per-request nonce threaded through the
 * proxy, which is worth doing later but is not a small change. Everything that
 * can be locked down without that is locked down: no framing, no plugins, no
 * arbitrary form targets, no base tag hijacking.
 */
const isDev = process.env.NODE_ENV !== "production";

/*
 * React's development build uses eval() to reconstruct callstacks, so dev needs
 * 'unsafe-eval' or every page throws. Production never gets it: React does not
 * use eval() there, and allowing it would undo most of the policy's value.
 */
const SCRIPT_SRC = [
  "script-src 'self' 'unsafe-inline'",
  isDev ? "'unsafe-eval'" : "",
  "https://www.youtube.com https://s.ytimg.com",
]
  .filter(Boolean)
  .join(" ");

const CSP = [
  "default-src 'self'",
  SCRIPT_SRC,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://i.ytimg.com https://yt3.ggpht.com",
  "font-src 'self' data:",
  // The API calls the app makes on your behalf, plus the dev server's own
  // websocket for hot reload.
  `connect-src 'self' https://www.googleapis.com https://api.resend.com${
    isDev ? " ws: wss:" : ""
  }`,
  // The embedded player, and nothing else, may be framed.
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // This app is never legitimately displayed inside someone else's page.
  "frame-ancestors 'none'",
  // Pointless on http, and it would force the dev server to https.
  isDev ? "" : "upgrade-insecure-requests",
]
  .filter(Boolean)
  .join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  // Clickjacking protection for browsers that predate frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Two years, subdomains included. Ignored on http, so it costs nothing local.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Advertising the framework and version only helps someone targeting it.
  poweredByHeader: false,

  experimental: {
    serverActions: { bodySizeLimit: "1mb" },
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
      {
        // Nothing here should ever be cached by a shared proxy.
        source: "/api/:path*",
        headers: [
          ...SECURITY_HEADERS,
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
    ];
  },
};

export default nextConfig;
