import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3101);

export default defineConfig({
  testDir: "./e2e",
  // 截图脚本需要 SHOT_TRIP，未提供时不纳入常规测试
  // 截图脚本需要 SHOT_TRIP；附件测试需要配好 AI（mock）的服务器，通过 E2E_PORT 指向它时才运行
  testIgnore: [...(process.env.SHOT_TRIP ? [] : ["**/shots.spec.ts"]), ...(process.env.E2E_PORT ? [] : ["**/attach.spec.ts"])],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    trace: "retain-on-failure",
  },
  projects: [{ name: "mobile", use: { ...devices["iPhone 14"] } }],
  webServer: {
    // 用 UTC 启动，验证时区渲染不依赖服务器时区
    command: `TZ=UTC pnpm dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
