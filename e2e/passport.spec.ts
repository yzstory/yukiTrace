import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Pool, types } from "pg";

types.setTypeParser(1114, (value) => new Date(`${value}Z`));

test("旅行护照：推导城市、单个盖章、全部盖章、入口提示", async ({ page }) => {
  test.setTimeout(120_000);
  if (!/^postgresql:\/\/[^@]+@(localhost|127\.0\.0\.1):/.test(process.env.DATABASE_URL || "")) throw new Error("仅允许本地测试库");
  const db = new Pool({ connectionString: process.env.DATABASE_URL! });
  const email = `passport-${crypto.randomUUID()}@example.com`;
  let userId = "";
  const tripIds: string[] = [];
  try {
    await page.goto("/signup");
    await page.getByLabel("昵称").fill("护照测试妈妈");
    await page.getByLabel("邮箱").fill(email);
    await page.getByLabel("密码").fill("test-secret123");
    await page.getByRole("button", { name: "注册", exact: true }).click();
    await expect(page).toHaveURL(/\/trips$/);
    userId = (await db.query('SELECT id FROM "User" WHERE email = $1', [email])).rows[0].id;

    // 旅程 1（早）：烟台 + 青岛；旅程 2（晚）：青岛 + 威海 → 应得 3 枚章，青岛落在旅程 1
    const seed = async (title: string, start: string, end: string, stops: Array<[string, string, string]>) => {
      const id = crypto.randomUUID();
      tripIds.push(id);
      await db.query('INSERT INTO "Trip" (id, "ownerId", title, "startDate", "endDate", "babyName", "babyBirthDate", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())', [id, userId, title, start, end, "小满", "2025-08-01"]);
      for (const [name, city, at] of stops) {
        await db.query('INSERT INTO "Stop" (id, "tripId", name, type, lat, lng, city, "arriveAt", "updatedAt") VALUES ($1,$2,$3,$4,37.5,121.4,$5,$6,NOW())', [crypto.randomUUID(), id, name, "ATTRACTION", city, at]);
      }
      return id;
    };
    const t1 = await seed("春天去烟台", "2026-03-01", "2026-03-03", [["蓬莱阁", "烟台", "2026-03-01T02:00:00Z"], ["八大关", "青岛", "2026-03-02T02:00:00Z"]]);
    const t2 = await seed("秋天看海", "2026-09-04", "2026-09-06", [["栈桥", "青岛", "2026-09-04T02:00:00Z"], ["刘公岛", "威海", "2026-09-05T02:00:00Z"]]);

    // 旅程页：旅程 2 只有威海是首访 → 提示条只提威海
    await page.goto(`/trips/${t2}`);
    const nudge = page.getByRole("link", { name: /去护照盖章/ });
    await expect(nudge).toBeVisible();
    await expect(nudge).toContainText("威海");
    await expect(nudge).not.toContainText("青岛");

    // 「我」页入口
    await page.goto("/me");
    const card = page.getByRole("link", { name: /小满的旅行护照/ });
    await expect(card).toContainText("3 座城市");
    await expect(card).toContainText("3 枚待盖章");
    await card.click();
    await expect(page).toHaveURL(/\/passport$/);

    // 三枚待盖章，先盖青岛
    await expect(page.getByRole("img", { name: "青岛 待盖章" })).toBeVisible();
    await page.getByRole("button", { name: "给 青岛 盖章" }).click();
    await expect(page.getByRole("img", { name: "青岛 已盖章" })).toBeVisible();
    await expect(page.getByText("去过 2 次")).toBeVisible();
    const { rows } = await db.query('SELECT "tripId", line FROM "CityStamp" WHERE city = $1', ["青岛"]);
    expect(rows).toHaveLength(1);
    expect(rows[0].tripId).toBe(t1);
    expect(String(rows[0].line).length).toBeGreaterThan(3);

    // 全部盖章
    await page.getByRole("button", { name: /全部盖章（2）/ }).click();
    await expect(page.getByRole("img", { name: "烟台 已盖章" })).toBeVisible();
    await expect(page.getByRole("img", { name: "威海 已盖章" })).toBeVisible();
    await expect(page.getByRole("button", { name: /全部盖章/ })).toHaveCount(0);

    // 旅程页提示消失
    await page.goto(`/trips/${t2}`);
    await expect(page.getByRole("link", { name: /去护照盖章/ })).toHaveCount(0);
  } finally {
    for (const id of tripIds) await db.query('DELETE FROM "Trip" WHERE id = $1', [id]);
    if (userId) await db.query('DELETE FROM "User" WHERE id = $1', [userId]);
    await db.end();
  }
});
