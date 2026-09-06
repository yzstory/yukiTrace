import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { db } from "../db";
import { auditedDb, activityId } from "../activity";
import { changeRecord, undoActivity, versionOf } from "../record-service";

const enabled = process.env.RUN_DB_TESTS === "1";
const users: string[] = [];
let tripId = "";
let ownerId = "";
let viewerId = "";
const context = () => ({ tripId, userId: ownerId, source: "ai" as const });
describe.skipIf(!enabled)("操作历史真实数据库事务", () => {
  beforeAll(async () => {
    if (!/^postgresql:\/\/[^@]+@(localhost|127\.0\.0\.1):/.test(process.env.DATABASE_URL || "")) throw new Error("数据库测试只允许本机数据库");
    for (const role of ["owner", "viewer"]) {
      const user = await db.user.create({ data: { name: `audit-test-${role}`, email: `audit-${role}-${crypto.randomUUID()}@example.com`, passwordHash: "not-a-login" } });
      users.push(user.id);
    }
    [ownerId, viewerId] = users;
    const trip = await db.trip.create({ data: { ownerId, title: "审计测试专用", startDate: new Date(), endDate: new Date(), members: { create: [{ userId: ownerId, role: "OWNER" }, { userId: viewerId, role: "VIEWER" }] } } });
    tripId = trip.id;
  });
  afterAll(async () => {
    if (tripId) await db.trip.delete({ where: { id: tripId } });
    if (users.length) await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });
  const create = () => auditedDb(context()).stop.create({ data: { tripId, name: "AI 地点", lat: 31, lng: 121, arriveAt: new Date() } });
  it("写入与历史原子保存，撤销可重复调用", async () => {
    const row = await create();
    const event = await db.activity.findUniqueOrThrow({ where: { id: activityId(row) } });
    expect(event.actorId).toBe(ownerId);
    expect(event.source).toBe("ai");
    await undoActivity(context(), event.id);
    await undoActivity(context(), event.id);
    expect(await db.stop.findUnique({ where: { id: row.id } })).toBeNull();
    expect(await db.activity.count({ where: { refId: row.id, action: "undo" } })).toBe(1);
  });
  it("后续修改阻止原 AI 撤销和旧版本覆盖", async () => {
    const row = await create();
    const raw = await db.stop.findUniqueOrThrow({ where: { id: row.id } });
    const version = versionOf(raw);
    await changeRecord({ tripId, userId: ownerId }, "stop", row.id, version, { name: "家人修改" });
    await expect(undoActivity(context(), activityId(row))).rejects.toThrow("记录已被修改");
    await expect(changeRecord(context(), "stop", row.id, version, { name: "过期修改" })).rejects.toThrow("已更新");
    expect((await db.stop.findUniqueOrThrow({ where: { id: row.id } })).name).toBe("家人修改");
  });
  it("只读成员无法写入或撤销", async () => {
    const row = await create();
    await expect(auditedDb({ tripId, userId: viewerId }).stop.update({ where: { id: row.id }, data: { name: "越权" } })).rejects.toThrow("没有编辑权限");
    await expect(undoActivity({ tripId, userId: viewerId }, activityId(row))).rejects.toThrow("没有编辑权限");
  });
  it("有关联记录时阻止级联误删", async () => {
    const row = await create();
    await auditedDb(context()).entry.create({ data: { tripId, stopId: row.id, title: "关联条目", type: "MOMENT", startAt: new Date() } });
    await expect(undoActivity(context(), activityId(row))).rejects.toThrow("关联");
    expect(await db.stop.findUnique({ where: { id: row.id } })).not.toBeNull();
  });
  it("AI 覆盖日记后撤销还原旧内容", async () => {
    const date = new Date("2026-09-06Z");
    await auditedDb({ tripId, userId: ownerId }).dailyNote.create({ data: { tripId, date, content: "原日记" } });
    const row = await auditedDb(context()).dailyNote.upsert({ where: { tripId_date: { tripId, date } }, create: { tripId, date, content: "新日记" }, update: { content: "新日记" } });
    await undoActivity(context(), activityId(row));
    expect((await db.dailyNote.findUniqueOrThrow({ where: { id: row.id } })).content).toBe("原日记");
  });
});
