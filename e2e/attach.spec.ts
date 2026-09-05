import { test, expect } from "@playwright/test";

/** AI 抽屉：选图后作为附件停留在输入框，输入文字一起发送，气泡里显示缩略图 */
test("图片作为附件随文字发送", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill("shot@example.com");
  await page.getByLabel("密码").fill("secret123");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/trips$/);
  await page.getByRole("link", { name: /北海道/ }).first().click();

  await page.getByRole("button", { name: "AI 助手" }).click();
  const dlg = page.getByRole("dialog");
  await expect(dlg).toBeVisible();

  // 选图 → 出现预览，但不应自动发送
  await dlg.locator('input[type="file"]:not([capture])').setInputFiles("/tmp/test-photo.jpg");
  await expect(dlg.getByRole("button", { name: "移除图片" })).toBeVisible();
  await expect(dlg.getByText(/说说这些图片是什么/)).toBeVisible();
  await expect(dlg.getByText(/思考中|正在识别/)).toHaveCount(0);

  // 输入文字并发送
  await dlg.getByPlaceholder("这些图片是…").fill("宝宝第一次看海，存一下");
  await dlg.getByRole("button", { name: "发送" }).click();

  // 用户气泡里有缩略图与文字；预览条消失；模型调用了存照片
  await expect(dlg.locator("img.size-24").first()).toBeVisible();
  await expect(dlg.getByText("宝宝第一次看海，存一下")).toBeVisible();
  await expect(dlg.getByRole("button", { name: "移除图片" })).toHaveCount(0);
  await expect(dlg.getByText("存照片")).toBeVisible({ timeout: 20_000 });
});
