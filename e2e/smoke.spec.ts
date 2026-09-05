import { test, expect } from "@playwright/test";

/**
 * 一条端到端主线：注册 → 建旅程 → 记站点 → 记花费 → 看账本 → 看地图 → 退出。
 * 这条路径覆盖了 Server Action 表单、快速记录抽屉、时区渲染与多币种折算。
 */

const unique = Date.now();
const EMAIL = `e2e-${unique}@example.com`;
const PASSWORD = "secret123";
const TRIP = `E2E 北海道 ${unique}`;

test.describe.configure({ mode: "serial" });

test("注册并创建旅程", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("昵称").fill("端到端妈妈");
  await page.getByLabel("邮箱").fill(EMAIL);
  await page.getByLabel("密码").fill(PASSWORD);
  await page.getByRole("button", { name: "注册" }).click();

  // 注册成功后进入旅程列表
  await expect(page).toHaveURL(/\/trips$/);
  await expect(page.getByRole("heading", { name: "还没有旅程" })).toBeVisible();

  await page.getByRole("link", { name: "新建旅程" }).first().click();
  await expect(page).toHaveURL(/\/trips\/new$/);

  await page.getByLabel("旅程名称").fill(TRIP);
  await page.getByLabel("开始日期").fill("2026-10-01");
  await page.getByLabel("结束日期").fill("2026-10-03");
  await page.selectOption('select[name="timezone"]', "Asia/Tokyo");
  await page.getByLabel("宝宝昵称").fill("小汤圆");
  await page.getByLabel("宝宝生日").fill("2025-06-15");
  await page.getByRole("button", { name: "创建旅程" }).click();

  await expect(page.getByRole("heading", { name: TRIP })).toBeVisible();
  await expect(page.getByText("小汤圆")).toBeVisible();
});

test("记录站点与花费，并在账本中折算", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: TRIP }).click();

  // 快速记录 → 地点
  await openQuickAdd(page, "地点");
  await page.getByPlaceholder("搜索地点，或直接输入名称").fill("羽田机场");
  await page.getByRole("button", { name: "手动填写坐标" }).click();
  await page.getByPlaceholder("纬度 lat").fill("35.5494");
  await page.getByPlaceholder("经度 lng").fill("139.7798");
  await page.getByPlaceholder("经度 lng").blur();
  await page.getByLabel("到达时间").fill("2026-10-01T14:10");
  await page.getByRole("button", { name: "添加站点" }).click();

  await expect(page.getByText("羽田机场")).toBeVisible();
  // 旅程时区为东京，应显示 14:10 而不是服务器 UTC 的 05:10
  await expect(page.getByText("14:10")).toBeVisible();

  // 快速记录 → 花费（日元）
  await openQuickAdd(page, "花费");
  await page.getByLabel("金额").fill("2800");
  await page.selectOption('select[name="currency"]', "JPY");
  await page.getByLabel("名称").fill("拉面");
  await page.getByRole("button", { name: "记一笔" }).click();

  await expect(page.getByText("拉面")).toBeVisible();

  // 账本：原币与折算并列
  await page.getByRole("link", { name: "账本" }).first().click();
  await expect(page.getByText("¥2,800 JPY")).toBeVisible();
  await expect(page.getByText(/≈\s*¥/)).toBeVisible();
});

test("地图与总结可访问", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: TRIP }).click();

  await page.getByRole("link", { name: "地图" }).first().click();
  // 境外站点走 MapLibre；国内走高德，未配 Key 时降级为路线示意图
  // 地图加载期间路线示意图与画布同时存在，取第一个即可
  await expect(
    page.locator("canvas.maplibregl-canvas").or(page.locator(".amap-container")).or(page.getByRole("img", { name: "路线示意图" })).first()
  ).toBeVisible({ timeout: 20_000 });

  await page.goBack();
  await page.getByRole("link", { name: "旅程总结" }).click();
  await expect(page.getByRole("heading", { name: "旅程总结" })).toBeVisible();
  await expect(page.getByText("个地方")).toBeVisible();
});

test("成员页可访问并能生成邀请链接", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: TRIP }).click();
  await page.getByRole("button", { name: "更多" }).click();
  await page.getByRole("menuitem", { name: "成员与邀请" }).click();
  await expect(page.getByRole("heading", { name: "成员", exact: true, level: 1 })).toBeVisible();
  await expect(page.getByText("所有者")).toBeVisible();

  await page.getByRole("button", { name: "新建邀请链接" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "生成" }).click();
  await expect(page.getByText(/\/invite\//)).toBeVisible();
});

test("退出登录后受保护页面会重定向", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "我" }).click();
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/trips");
  await expect(page).toHaveURL(/\/login/);
});

type Page = import("@playwright/test").Page;

/** 打开快速记录抽屉并进入某个子表单 */
async function openQuickAdd(page: Page, tile: string) {
  const fab = page.getByRole("button", { name: "快速记录" });
  await expect(fab).toBeVisible();
  await fab.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: tile, exact: true }).click();
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(EMAIL);
  await page.getByLabel("密码").fill(PASSWORD);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/trips$/);
}
