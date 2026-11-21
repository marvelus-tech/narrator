import type { NextConfig } from "next";

// GitHub Pages is a static host at /narrator. The server build stays standalone.
const pagesExport = process.env.NARRATOR_PAGES === "1";

const nextConfig: NextConfig = {
  output: pagesExport ? "export" : "standalone",
  poweredByHeader: false,
  ...(pagesExport
    ? {
        basePath: "/narrator",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        serverExternalPackages: ["better-sqlite3", "pg"],
        // Schema SQL, the Postgres worker, and the bundled font are read from disk at runtime.
        outputFileTracingIncludes: {
          "/*": ["./src/server/schema/**/*", "./src/server/pg-worker.cjs", "./src/fonts/**/*", "./migrations/**/*"],
          "/api/*": ["./src/server/schema/**/*", "./src/server/pg-worker.cjs", "./src/fonts/**/*", "./migrations/**/*"],
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
