import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // 本机以 127.0.0.1 / 局域网 IP 访问 dev server 时，允许其加载 /_next 资源（否则不会 hydrate）
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.0.0/16", "10.0.0.0/8"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.aliyuncs.com" }],
  },
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg", "sharp", "ali-oss"],
};

export default nextConfig;
