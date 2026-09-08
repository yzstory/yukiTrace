import "dotenv/config";
import { test, expect, type APIRequestContext } from "@playwright/test";
import { Pool } from "pg";

/**
 * /api/v1 主线：注册拿令牌 → 建旅程 → 记站点 / 条目 / 花费 / 宝宝状态 → 读详情 →
 * 整体替换花费 → 带版本号改记录 → 分页 → 清单模板 → 护照 → 令牌列表 → 注销后令牌失效。
 * 走的是与页面完全相同的服务层，所以这条线也在守护表单提交的行为。
 */
test("JSON API：令牌登录与旅程读写主线", async ({ playwright, baseURL }) => {
  test.setTimeout(120_000);
  if (!/^postgresql:\/\/[^@]+@(localhost|127\.0\.0\.1):/.test(process.env.DATABASE_URL || "")) throw new Error("仅允许本地测试库");
  const db = new Pool({ connectionString: process.env.DATABASE_URL! });
  const email = `api-${crypto.randomUUID()}@example.com`;
  const anon = await playwright.request.newContext({ baseURL });
  let authed: APIRequestContext | null = null;
  let tripId = "";
  let tripId2 = "";
  try {
    // 未登录
    expect((await anon.get("/api/v1/trips")).status()).toBe(401);

    // 注册并签发令牌
    const signup = await anon.post("/api/v1/auth/signup", { data: { email, password: "test-secret123", name: "接口测试妈妈", device: "Playwright" } });
    expect(signup.status()).toBe(200);
    const { token, user } = await signup.json();
    expect(token).toMatch(/^tra_/);
    expect(user.email).toBe(email);

    // 重复注册应被拒绝，密码错应 401
    expect((await anon.post("/api/v1/auth/signup", { data: { email, password: "test-secret123", name: "x" } })).status()).toBe(400);
    expect((await anon.post("/api/v1/auth/login", { data: { email, password: "wrong-password" } })).status()).toBe(401);

    authed = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    const me = await (await authed.get("/api/v1/me")).json();
    expect(me.id).toBe(user.id);

    // 建旅程：校验错误 → 400；成功 → id
    const bad = await authed.post("/api/v1/trips", { data: { title: "", startDate: "2026-10-01", endDate: "2026-10-03", homeCurrency: "CNY" } });
    expect(bad.status()).toBe(400);
    expect((await bad.json()).error).toContain("旅程名称");
    const created = await authed.post("/api/v1/trips", { data: { title: "接口北海道", startDate: "2026-10-01", endDate: "2026-10-03", homeCurrency: "CNY", timezone: "Asia/Tokyo", babyName: "小汤圆", babyBirthDate: "2025-06-15", travelers: ["妈妈", "爸爸"] } });
    expect(created.status()).toBe(200);
    tripId = (await created.json()).id;

    const list = await (await authed.get("/api/v1/trips")).json();
    expect(list.trips.map((t: { id: string }) => t.id)).toContain(tripId);
    expect(list.trips.find((t: { id: string }) => t.id === tripId).role).toBe("OWNER");

    // 站点（JSON 里 lat/lng 是数字、babyTags 是数组）
    const stop = await authed.post(`/api/v1/trips/${tripId}/stops`, { data: { name: "札幌站", type: "STATION", lat: 43.0686, lng: 141.3508, city: "札幌", arriveAt: "2026-10-01T10:00", babyTags: ["nursing_room"] } });
    expect(stop.status()).toBe(200);
    const stopId = (await stop.json()).id;

    // 条目 + 顺手记一笔日元花费
    const entry = await authed.post(`/api/v1/trips/${tripId}/entries`, { data: { type: "MEAL", title: "汤咖喱", stopId, startAt: "2026-10-01T12:00", amount: 1800, currency: "JPY", isBaby: false } });
    expect(entry.status()).toBe(200);
    const entryBody = await entry.json();
    expect(entryBody.expenseId).toBeTruthy();

    // 花费与宝宝状态
    const expense = await authed.post(`/api/v1/trips/${tripId}/expenses`, { data: { title: "地铁", amount: "500", currency: "JPY", category: "TRANSPORT", paidAt: "2026-10-01T09:30", stopId } });
    expect(expense.status()).toBe(200);
    const expenseId = (await expense.json()).id;
    expect((await authed.post(`/api/v1/trips/${tripId}/baby-logs`, { data: { type: "FEED", at: "2026-10-01T13:00", note: "喝了 150ml" } })).status()).toBe(200);
    expect((await authed.put(`/api/v1/trips/${tripId}/notes/2026-10-01`, { data: { content: "第一天到札幌，天气很好。" } })).status()).toBe(200);

    // 详情：站点树、时区与折算
    const detail = await (await authed.get(`/api/v1/trips/${tripId}`)).json();
    expect(detail.trip.timezone).toBe("Asia/Tokyo");
    expect(detail.stops).toHaveLength(1);
    expect(detail.stops[0].entries).toHaveLength(1);
    expect(detail.stops[0].entries[0].expenses[0].currency).toBe("JPY");
    expect(detail.stops[0].expenses.map((e: { id: string }) => e.id)).toContain(expenseId);
    expect(new Date(detail.stops[0].arriveAt).toISOString()).toBe("2026-10-01T01:00:00.000Z"); // 东京 10:00
    expect(detail.babyLogs).toHaveLength(1);
    expect(detail.dailyNotes[0].content).toContain("札幌");
    expect(detail.totalHomeMinor).toBeGreaterThan(0);

    // ?photos=none 只跳过照片，其余结构不变（直接插一行照片，不依赖上传链路）
    await db.query('INSERT INTO "Photo" (id, "tripId", "stopId", "ossKey") VALUES ($1, $2, $3, $4)', [crypto.randomUUID(), tripId, stopId, "trips/test/photo.webp"]);
    const withPhotos = await (await authed.get(`/api/v1/trips/${tripId}`)).json();
    expect(withPhotos.stops[0].photos).toHaveLength(1);
    const lean = await (await authed.get(`/api/v1/trips/${tripId}?photos=none`)).json();
    expect(lean.stops[0].photos).toEqual([]);
    expect(lean.loosePhotos).toEqual([]);
    expect(lean.stops[0].entries).toHaveLength(1);
    expect(lean.totalHomeMinor).toBe(detail.totalHomeMinor);

    // PUT 整体替换花费：改币种与金额后重新折算；改不存在的花费 404
    const put = await authed.put(`/api/v1/trips/${tripId}/expenses/${expenseId}`, { data: { title: "地铁一日券", amount: "12", currency: "CNY", category: "TRANSPORT", paidAt: "2026-10-01T09:30", stopId } });
    expect(put.status()).toBe(200);
    expect((await put.json()).currency).toBe("CNY");
    const afterPut = await (await authed.get(`/api/v1/trips/${tripId}`)).json();
    const changed = afterPut.stops[0].expenses.find((e: { id: string }) => e.id === expenseId);
    expect(changed.amountMinor).toBe(1200);
    expect(changed.amountHomeMinor).toBe(1200);
    expect((await authed.put(`/api/v1/trips/${tripId}/expenses/does-not-exist`, { data: { title: "x", amount: "1", paidAt: "2026-10-01T09:30" } })).status()).toBe(404);

    // 记录：带版本号修改；旧版本号再改应 409
    const record = await (await authed.get(`/api/v1/trips/${tripId}/records/expense/${expenseId}`)).json();
    expect(record.values.title).toBe("地铁一日券");
    const patched = await authed.patch(`/api/v1/trips/${tripId}/records/expense/${expenseId}`, { data: { version: record.version, values: { ...record.values, title: "地铁一日券", currency: "JPY", amount: "830" } } });
    expect(patched.status()).toBe(200);
    const stale = await authed.patch(`/api/v1/trips/${tripId}/records/expense/${expenseId}`, { data: { version: record.version, values: record.values } });
    expect(stale.status()).toBe(409);
    const fresh = await (await authed.get(`/api/v1/trips/${tripId}/records/expense/${expenseId}`)).json();
    expect(fresh.values.title).toBe("地铁一日券");
    expect(fresh.history.length).toBeGreaterThanOrEqual(2);

    // 列表分页：limit=1 拿到 nextCursor，翻第二页应是另一个旅程；坏 cursor 400
    const second = await authed.post("/api/v1/trips", { data: { title: "接口冲绳", startDate: "2026-11-01", endDate: "2026-11-03", homeCurrency: "CNY" } });
    tripId2 = (await second.json()).id;
    const page1 = await (await authed.get("/api/v1/trips?limit=1")).json();
    expect(page1.trips).toHaveLength(1);
    expect(page1.nextCursor).toBeTruthy();
    const page2 = await (await authed.get(`/api/v1/trips?limit=1&cursor=${page1.nextCursor}`)).json();
    expect(page2.trips).toHaveLength(1);
    expect(page2.trips[0].id).not.toBe(page1.trips[0].id);
    expect([page1.trips[0].id, page2.trips[0].id].sort()).toEqual([tripId, tripId2].sort());
    expect(page2.nextCursor).toBeNull();
    expect((await authed.get("/api/v1/trips?limit=1&cursor=nope")).status()).toBe(400);
    expect((await authed.get("/api/v1/trips?limit=0")).status()).toBe(400);
    // 不传 limit 仍返回全部
    expect((await (await authed.get("/api/v1/trips")).json()).trips.length).toBeGreaterThanOrEqual(2);
    expect((await authed.delete(`/api/v1/trips/${tripId2}`)).status()).toBe(200);
    tripId2 = "";

    // 清单模板、整理报告、护照、分享链接
    const template = await (await authed.post(`/api/v1/trips/${tripId}/checklist/template`)).json();
    expect(template.added).toBeGreaterThan(10);
    expect((await (await authed.get(`/api/v1/trips/${tripId}/checklist`)).json()).items.length).toBe(template.added);
    const tidy = await (await authed.get(`/api/v1/trips/${tripId}/tidy`)).json();
    expect(typeof tidy.count).toBe("number");
    const passport = await (await authed.get("/api/v1/passport")).json();
    expect(passport.stamps.map((s: { city: string }) => s.city)).toContain("札幌");
    const share = await (await authed.post(`/api/v1/trips/${tripId}/share-links`, { data: { hideExpense: true } })).json();
    expect(share.url).toContain("/share/");
    expect((await anon.get(share.url)).status()).toBe(200);

    // 令牌列表里能看到本次登录，且标为 api
    const tokens = await (await authed.get("/api/v1/tokens")).json();
    expect(tokens.some((t: { scope: string; name: string }) => t.scope === "api" && t.name === "Playwright")).toBe(true);

    // MCP 令牌不能用于 API
    const mcp = await (await authed.post("/api/v1/tokens", { data: { name: "只读", scope: "mcp" } })).json();
    const viaMcp = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${mcp.token}` } });
    expect((await viaMcp.get("/api/v1/me")).status()).toBe(401);
    await viaMcp.dispose();

    // 删除旅程后不可见；注销后令牌失效
    expect((await authed.delete(`/api/v1/trips/${tripId}`)).status()).toBe(200);
    expect((await authed.get(`/api/v1/trips/${tripId}`)).status()).toBe(404);
    tripId = "";
    expect((await authed.post("/api/v1/auth/logout")).status()).toBe(200);
    expect((await authed.get("/api/v1/me")).status()).toBe(401);
  } finally {
    await authed?.dispose();
    await anon.dispose();
    for (const id of [tripId, tripId2].filter(Boolean)) await db.query('DELETE FROM "Trip" WHERE id = $1', [id]);
    await db.query('DELETE FROM "User" WHERE email = $1', [email]);
    await db.end();
  }
});
