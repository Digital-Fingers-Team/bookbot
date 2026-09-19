import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Without this Next traces up to /home/opc and emits the bundle at
  // .next/standalone/aradobot/apps/web. Pinning the workspace root keeps it at
  // .next/standalone/apps/web, which is what pm2's cwd and the postbuild
  // asset copy both expect.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  reactStrictMode: true
};

export default nextConfig;
