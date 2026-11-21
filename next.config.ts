import type { NextConfig } from "next";

// GitHub Pages is static. GITHUB_PAGES=1 exports the site. A normal build stays standalone.
const pagesExport = process.env.GITHUB_PAGES === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: pagesExport ? "export" : "standalone",
  poweredByHeader: false,
  ...(pagesExport
    ? {
        basePath,
        assetPrefix: basePath,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        serverExternalPackages: ["better-sqlite3"],
        // Schema SQL is read from disk at runtime. Trace it into the standalone bundle.
        outputFileTracingIncludes: {
          "/*": ["./src/server/schema/**/*"],
          "/api/*": ["./src/server/schema/**/*"],
        },
        images: {
          formats: ["image/avif", "image/webp"],
        },
        async headers() {
          return [
            {
              source: "/:path*",
              headers: [
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                { key: "X-Frame-Options", value: "DENY" },
                { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
