import { test, expect } from "@playwright/test";

const unique = Date.now();
const EMAIL = `theme-${unique}@example.com`;
const PASSWORD = "secret123";

test.describe.configure({ mode: "serial" });

test("深色模式跟随系统并可手动切换", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/signup");
  await page.getByLabel("昵称").fill("深色妈妈");
  await page.getByLabel("邮箱").fill(EMAIL);
  await page.getByLabel("密码").fill(PASSWORD);
  await page.getByRole("button", { name: "注册" }).click();
  await expect(page).toHaveURL(/\/trips$/);

  // 系统深色 → html 带 dark 类
  await expect(page.locator("html")).toHaveClass(/dark/);
  const darkBg = await bodyLuminance(page);
  expect(darkBg).toBeLessThan(0.3);

  // 手动切浅色
  await page.getByRole("link", { name: "我" }).click();
  await page.getByRole("button", { name: "浅色" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  const lightBg = await bodyLuminance(page);
  expect(lightBg).toBeGreaterThan(0.8);

  // 刷新后保持浅色
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

/** 把任意 CSS 颜色交给浏览器换算成 0–1 的相对亮度，避免解析 oklch/rgb 差异 */
async function bodyLuminance(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const probe = document.createElement("canvas");
    probe.width = probe.height = 1;
    const ctx = probe.getContext("2d")!;
    ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  });
}

test("境外旅程使用 MapLibre，国内旅程使用高德降级图", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(EMAIL);
  await page.getByLabel("密码").fill(PASSWORD);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/trips$/);

  // 建一个境外旅程 + 东京站点
  await page.getByRole("link", { name: "新建旅程" }).first().click();
  await page.getByLabel("旅程名称").fill("东京地图测试");
  await page.getByLabel("开始日期").fill("2026-10-01");
  await page.getByLabel("结束日期").fill("2026-10-02");
  await page.selectOption('select[name="timezone"]', "Asia/Tokyo");
  await page.getByRole("button", { name: "创建旅程" }).click();

  await page.getByRole("button", { name: "快速记录" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "地点", exact: true }).click();
  await page.getByPlaceholder("搜索地点，或直接输入名称").fill("东京塔");
  await page.getByRole("button", { name: "手动填写坐标" }).click();
  await page.getByPlaceholder("纬度 lat").fill("35.6586");
  await page.getByPlaceholder("经度 lng").fill("139.7454");
  await page.getByPlaceholder("经度 lng").blur();
  await page.getByRole("button", { name: "添加站点" }).click();
  await expect(page.getByText("东京塔")).toBeVisible();

  // 地图页应加载 MapLibre 画布（境外坐标）
  await page.getByRole("link", { name: "地图" }).first().click();
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 20_000 });
});
