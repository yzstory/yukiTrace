import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.aliyuncs.com" }],
  },
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg", "sharp", "ali-oss"],
};

export default nextConfig;
