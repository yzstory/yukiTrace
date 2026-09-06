import "server-only";

export type AmapClientConfig = { key: string; securityCode: string };

/**
 * 高德 JS API 的 Key 与安全密钥在**运行时**由服务端读取后传给客户端组件。
 * 不要依赖 NEXT_PUBLIC_*：那类变量是构建时内联进前端代码的，镜像在别处构建时值为空，
 * 部署后再改 .env 也不会生效。这里两种命名都兼容，优先运行时变量。
 */
export function getAmapClientConfig(): AmapClientConfig {
  return {
    key: process.env.AMAP_JS_KEY || process.env.NEXT_PUBLIC_AMAP_JS_KEY || "",
    securityCode: process.env.AMAP_SECURITY_CODE || process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE || "",
  };
}
