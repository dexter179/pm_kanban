import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  // Static export for production (served by FastAPI); full dev server otherwise.
  ...(process.env.NODE_ENV === "production"
    ? { output: "export" as const }
    : {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: "http://localhost:8000/api/:path*",
            },
          ];
        },
      }),
};

export default nextConfig;
