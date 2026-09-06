export const ENTITIES = ["stop", "entry", "expense", "photo", "babyLog", "dailyNote", "checklistItem"] as const;
export type Entity = typeof ENTITIES[number];
export type Snapshot = Record<string, unknown>;
export const ENTITY_LABELS: Record<string, string> = { stop: "地点", entry: "条目", expense: "花费", photo: "照片", babyLog: "宝宝状态", dailyNote: "日记", checklistItem: "清单" };
export const FIELD_LABELS: Record<string, string> = {
  title: "名称", name: "地点", note: "备注", content: "日记", caption: "照片说明", aiCaption: "AI 说明", firstMoment: "第一次",
  amountMinor: "原币金额（最小单位）", currency: "币种", amountHomeMinor: "主币金额（最小单位）", amountCnyMinor: "人民币分", rate: "汇率",
  paidAt: "付款时间", arriveAt: "到达", leaveAt: "离开", startAt: "开始", endAt: "结束", at: "记录时间", date: "日期",
  stopId: "关联地点", entryId: "关联条目", type: "类型", category: "分类", isBaby: "宝宝相关", text: "内容", checked: "已完成",
  address: "地址", city: "城市", lat: "纬度", lng: "经度", timezone: "时区", babyTags: "婴儿友好", meta: "附加信息", aiDraft: "AI 草稿",
};
export function snapshot(value: unknown): Snapshot | null {
  return value == null ? null : JSON.parse(JSON.stringify(value)) as Snapshot;
}
export function sameSnapshot(left: unknown, right: unknown): boolean {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalize(item)]));
    return value;
  };
  return JSON.stringify(normalize(snapshot(left))) === JSON.stringify(normalize(snapshot(right)));
}
export function changedFields(before: Snapshot | null, after: Snapshot | null) {
  return Object.keys(FIELD_LABELS).filter((field) => !sameSnapshot(before?.[field] ?? null, after?.[field] ?? null));
}
export function recordTitle(record: Snapshot | null) {
  return String(record?.title || record?.name || record?.caption || record?.aiCaption || record?.text || record?.content || record?.note || "旅行记录");
}
