import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Pages read the content library and licensing documents from disk at
   * request time. Vercel only ships files its tracer can see an import for, so
   * anything read by path has to be declared here or it is simply absent in
   * production - the page renders, but with the file "missing".
   */
  outputFileTracingIncludes: {
    "/**": ["./content/**/*"],
    "/legal": ["./content/**/*", "./LICENSE.md", "./COMMERCIAL-LICENSE.md", "./NOTICE"],
  },
};

export default nextConfig;
