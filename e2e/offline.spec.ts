import { test, expect } from "@playwright/test";

/**
 * 断网时记录 → 队列 → 恢复网络 → 自动回放。
 * 这条路径最贴近真实场景：飞机上、山里、境外没网。
 */

const unique = Date.now();
const EMAIL = `offline-${unique}@example.com`;
const PASSWORD = "secret123";
const TRIP = `离线测试 ${unique}`;

test.describe.configure({ mode: "serial" });

test("断网后仍可记账，联网后自动同步", async ({ page, context }) => {
  // 准备账号与旅程
  await page.goto("/signup");
  await page.getByLabel("昵称").fill("离线妈妈");
  await page.getByLabel("邮箱").fill(EMAIL);
  await page.getByLabel("密码").fill(PASSWORD);
  await page.getByRole("button", { name: "注册" }).click();
  await expect(page).toHaveURL(/\/trips$/);

  await page.getByRole("link", { name: "新建旅程" }).first().click();
  await page.getByLabel("旅程名称").fill(TRIP);
  await page.getByLabel("开始日期").fill("2026-10-01");
  await page.getByLabel("结束日期").fill("2026-10-02");
  await page.getByRole("button", { name: "创建旅程" }).click();
  await expect(page.getByRole("heading", { name: TRIP })).toBeVisible();

  // 断网
  await context.setOffline(true);
  await expect(page.getByText(/离线中/)).toBeVisible();

  // 离线记一笔
  await page.getByRole("button", { name: "快速记录" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "花费", exact: true }).click();
  await page.getByLabel("金额").fill("58");
  await page.getByLabel("名称").fill("离线拉面");
  await page.getByRole("button", { name: "离线记一笔" }).click();

  // 提示已入队，浮条显示待同步数量
  await expect(page.getByText("已离线保存，联网后自动同步")).toBeVisible();
  await expect(page.getByText(/1 条待同步/)).toBeVisible();

  // 恢复网络：自动回放（回放完成会触发 router.refresh，无需手动跳转）
  await context.setOffline(false);
  await expect(page.getByText("已同步")).toBeVisible({ timeout: 20_000 });

  // 数据确实落库并渲染出来
  await expect(page.getByText("离线拉面")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/条待同步/)).toBeHidden();
});
