import { describe, expect, it } from "vitest";
import { duplicateExpenses, type DuplicateExpense } from "../organize";
import { changedFields, sameSnapshot } from "../activity-data";

const expense = (id: string, overrides: Partial<DuplicateExpense> = {}): DuplicateExpense => ({ id, title: "午餐", amountMinor: 2000, currency: "CNY", paidAt: new Date("2026-09-06T15:00:00Z"), updatedAt: new Date("2026-09-06T15:00:00Z"), ...overrides });
describe("旅程整理", () => {
  it("按旅程本地日期检测重复，不跨天、不跨币种", () => {
    const rows = [expense("a"), expense("b", { title: " 午餐 " }), expense("c", { currency: "JPY" }), expense("d", { paidAt: new Date("2026-09-06T17:00:00Z") })];
    expect(duplicateExpenses(rows, "Asia/Shanghai").map((group) => group.items.map((row) => row.id))).toEqual([["a", "b"]]);
  });
  it("保留确认不受排序影响，记录变化则要求重新核对", () => {
    const rows = [expense("a"), expense("b")];
    const fingerprint = duplicateExpenses(rows, "UTC")[0].fingerprint;
    expect(duplicateExpenses(rows.toReversed(), "UTC")[0].fingerprint).toBe(fingerprint);
    expect(duplicateExpenses([rows[0], expense("b", { updatedAt: new Date() })], "UTC")[0].fingerprint).not.toBe(fingerprint);
  });
  it("快照比较忽略键顺序，保留日期与嵌套字段变化", () => {
    expect(sameSnapshot({ a: new Date("2026-01-01Z"), b: { y: 2, x: 1 } }, { b: { x: 1, y: 2 }, a: "2026-01-01T00:00:00.000Z" })).toBe(true);
    expect(changedFields({ title: "之前", amountMinor: 100 }, { title: "之后", amountMinor: 100 })).toEqual(["title"]);
  });
});
