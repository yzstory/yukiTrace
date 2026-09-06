import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Pool, types } from "pg";

// Prisma 的 timestamp 字段按 UTC 解释，测试夹具必须保持相同语义。
types.setTypeParser(1114, (value) => new Date(`${value}Z`));

test("旅程整理：核对重复、编辑 AI 记录、撤销", async ({ page }) => {
  test.setTimeout(120_000);
  if (!/^postgresql:\/\/[^@]+@(localhost|127\.0\.0\.1):/.test(process.env.DATABASE_URL || "")) throw new Error("仅允许本地测试库");
  const db = new Pool({ connectionString: process.env.DATABASE_URL! });
  const email = `organize-${crypto.randomUUID()}@example.com`;
  let userId = "";
  let tripId = "";
  try {
    await page.goto("/signup");
    await page.getByLabel("昵称").fill("整理测试妈妈");
    await page.getByLabel("邮箱").fill(email);
    await page.getByLabel("密码").fill("test-secret123");
    await page.getByRole("button", { name: "注册", exact: true }).click();
    await expect(page).toHaveURL(/\/trips$/);
    userId = (await db.query('SELECT id FROM "User" WHERE email = $1', [email])).rows[0].id;
    tripId = crypto.randomUUID();
    await db.query('INSERT INTO "Trip" (id, "ownerId", title, "startDate", "endDate", "updatedAt") VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE, NOW())', [tripId, userId, "整理流程测试"]);
    for (let i = 0; i < 2; i++) {
      const id = crypto.randomUUID();
      const { rows: [row] } = await db.query('INSERT INTO "Expense" (id, "tripId", "paidById", title, "paidAt", "amountMinor", "amountHomeMinor", "amountCnyMinor", currency, rate, "updatedAt") VALUES ($1, $2, $3, $4, NOW(), 2000, 2000, 2000, $5, 1, NOW()) RETURNING *', [id, tripId, userId, "午餐测试", "CNY"]);
      await db.query('INSERT INTO "Activity" (id, "tripId", "actorId", source, entity, "refId", action, "after") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [crypto.randomUUID(), tripId, userId, "ai", "expense", id, "create", JSON.stringify(row)]);
    }
    await page.goto(`/trips/${tripId}`);
    await page.getByRole("button", { name: "更多" }).click();
    await page.getByRole("menuitem", { name: /旅程整理/ }).click();
    await expect(page.getByRole("heading", { name: "疑似重复账单 · 1 组" })).toBeVisible();
    await page.getByRole("button", { name: "确认是不同消费，全部保留" }).click();
    await expect(page.getByRole("heading", { name: "疑似重复账单 · 0 组" })).toBeVisible();
    const review = page.locator("section").filter({ has: page.getByRole("heading", { name: "AI 记录待确认 · 2", exact: true }) });
    const card = review.locator("section").first();
    await card.getByRole("button", { name: /查看已写入的记录/ }).click();
    // 操作历史不再是独立页面，在记录卡片里核对
    await card.getByText("记录来源与修改历史").click();
    await expect(card.getByText("整理测试妈妈 · 新增 · AI 辅助", { exact: true })).toBeVisible();
    await card.getByRole("button", { name: "修改", exact: true }).click();
    await card.getByLabel("名称", { exact: true }).fill("晚餐已纠正");
    await card.getByLabel("金额", { exact: true }).fill("25");
    await card.getByRole("button", { name: "保存修改" }).click();
    await expect(page.getByRole("heading", { name: "AI 记录待确认 · 1", exact: true })).toBeVisible();
    const remaining = page.locator("section").filter({ has: page.getByRole("heading", { name: "AI 记录待确认 · 1", exact: true }) }).locator("section").first();
    await remaining.getByRole("button", { name: /查看已写入的记录/ }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await remaining.getByRole("button", { name: "撤销 AI 写入" }).click();
    await expect(page.getByRole("heading", { name: "AI 记录待确认 · 0", exact: true })).toBeVisible();
    const { rows: saved } = await db.query('SELECT "amountMinor" FROM "Expense" WHERE "tripId" = $1', [tripId]);
    expect(saved).toHaveLength(1);
    expect(saved[0].amountMinor).toBe(2500);
  } finally {
    if (tripId) await db.query('DELETE FROM "Trip" WHERE id = $1', [tripId]);
    if (userId) await db.query('DELETE FROM "User" WHERE id = $1', [userId]);
    await db.end();
  }
});
